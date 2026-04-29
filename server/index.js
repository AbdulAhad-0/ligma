require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { WebSocketServer } = require('ws')
const { setupWSConnection } = require('y-websocket/bin/utils')
const cors = require('cors')
const ai = require('./ai')
const rbac = require('./rbac')
const { createClient } = require('@supabase/supabase-js')

const PORT = process.env.PORT || 4000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const app = express()
app.use(express.json())
app.use(cors({ origin: FRONTEND_URL }))

// Supabase server client (optional)
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] }
})

const yjsWss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, 'http://localhost').pathname

  if (pathname.startsWith('/socket.io/')) {
    return
  }

  // Yjs collaborative rooms are handled here through y-websocket.
  yjsWss.handleUpgrade(req, socket, head, (ws) => {
    setupWSConnection(ws, req)
  })
})

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id)

  socket.on('join-workspace', (data) => {
    const { workspaceId, userId } = data || {}
    if (!workspaceId) return
    socket.join(workspaceId)
    socket.data.workspaceId = workspaceId
    if (userId) socket.data.userId = userId
    socket.to(workspaceId).emit('user-joined', { userId })
    console.log(`${socket.id} joined workspace ${workspaceId}`)
  })

  socket.on('canvas-delta', (payload) => {
    const { workspaceId } = payload || {}
    if (!workspaceId) return
    // broadcast to others in the room
    socket.to(workspaceId).emit('canvas-delta', payload)
  })

  socket.on('cursor-move', (payload) => {
    const { workspaceId } = payload || {}
    if (!workspaceId) return
    socket.to(workspaceId).emit('cursor-move', payload)
  })

  socket.on('disconnect', () => {
    const userId = socket.data.userId
    const workspaceId = socket.data.workspaceId
    if (workspaceId) {
      socket.to(workspaceId).emit('user-left', { userId })
    }
    console.log('socket disconnected:', socket.id)
  })
})

// API routes
app.post('/api/classify', (req, res) => {
  return ai.classify(req, res)
})

app.post('/api/summary', (req, res) => {
  return ai.summary(req, res)
})

app.post('/api/lock-node', async (req, res) => {
  try {
    let { nodeId, userId, workspaceId, role } = req.body
    if (nodeId.includes(':')) nodeId = nodeId.split(':')[1] // Strip 'shape:' prefix if exists

    // Only lead can lock
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (member?.role !== 'lead') return res.status(403).json({ error: 'Only lead can lock' })

    const { data: node } = await supabase.from('canvas_nodes').select('props').eq('id', nodeId).single()
    const newProps = { ...(node?.props || {}), min_role: role }

    const { error } = await supabase
      .from('canvas_nodes')
      .update({ props: newProps })
      .eq('id', nodeId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[API] Lock Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/unlock-node', async (req, res) => {
  try {
    let { nodeId, userId, workspaceId } = req.body
    if (nodeId.includes(':')) nodeId = nodeId.split(':')[1]

    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (member?.role !== 'lead') return res.status(403).json({ error: 'Only lead can unlock' })

    // Unlocking means setting min_role to 'viewer' (everyone can edit)
    const { data: node } = await supabase.from('canvas_nodes').select('props').eq('id', nodeId).single()
    const newProps = { ...(node?.props || {}), min_role: 'viewer' }

    const { error } = await supabase
      .from('canvas_nodes')
      .update({ props: newProps })
      .eq('id', nodeId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[API] Unlock Error:', err)
    res.status(500).json({ error: err.message })
  }
})

const toGuid = (tldrawId) => {
  if (!tldrawId) return null
  const parts = tldrawId.split(':')
  const idPart = parts[parts.length - 1]
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(idPart)) return idPart

  let hexString = ''
  for (let i = 0; i < idPart.length; i++) {
    hexString += idPart.charCodeAt(i).toString(16).padStart(2, '0')
  }
  hexString = hexString.padEnd(32, '0').slice(0, 32)
  return `${hexString.slice(0, 8)}-${hexString.slice(8, 12)}-${hexString.slice(12, 16)}-${hexString.slice(16, 20)}-${hexString.slice(20, 32)}`
}

app.post('/api/sync-node', async (req, res) => {
  try {
    let { nodeId, workspaceId, userId, type, x, y, props, content, isDeleted } = req.body
    nodeId = toGuid(nodeId)
    if (!nodeId) return res.status(400).json({ error: 'Invalid nodeId' })

    // 1. Check if user is a member
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()
      
    if (!member) return res.status(403).json({ error: 'Not a member of this workspace' })

    // 2. Check RBAC permissions
    const canEdit = await rbac.canEditNode(userId, nodeId, workspaceId)
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this node' })
    }

    // 3. Perform upsert using Service Role
    const { error } = await supabase.from('canvas_nodes').upsert({
      id: nodeId,
      workspace_id: workspaceId,
      type,
      x,
      y,
      props,
      content: content || '',
      created_by: userId,
      is_deleted: !!isDeleted,
      updated_at: new Date().toISOString()
    })

    if (error) throw error
    res.json({ success: true, nodeId })
  } catch (err) {
    console.error('[API] Sync Error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/workspaces', async (req, res) => {
  try {
    const { name, userId } = req.body || {}

    if (!name || !userId) {
      return res.status(400).json({ error: 'name and userId are required' })
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({ name, created_by: userId })
      .select('id')
      .single()

    if (workspaceError) {
      return res.status(400).json({ error: workspaceError.message })
    }

    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'lead',
    })

    if (memberError) {
      return res.status(400).json({ error: memberError.message })
    }
    return res.status(201).json({ workspaceId: workspace.id })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create workspace' })
  }
})

app.post('/api/invite-member', async (req, res) => {
  try {
    const { workspaceId, requesterId, invitedEmail, role } = req.body

    // 1. Verify requester is Lead
    const { data: requester } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', requesterId)
      .single()

    if (requester?.role !== 'lead') {
      return res.status(403).json({ error: 'Only Leads can invite members' })
    }

    // 2. Find user by email
    const { data: userData, error: findError } = await supabase.auth.admin.listUsers()
    if (findError) throw findError
    
    const invitedUser = userData.users.find(u => u.email?.toLowerCase() === invitedEmail?.toLowerCase())
    if (!invitedUser) {
      return res.status(404).json({ error: 'User not found. They must sign up for LIGMA first.' })
    }

    // 3. Add to workspace
    const { error: inviteError } = await supabase.from('workspace_members').upsert({
      workspace_id: workspaceId,
      user_id: invitedUser.id,
      role: role || 'viewer'
    })

    if (inviteError) throw inviteError

    res.json({ success: true, message: `Invited ${invitedEmail} as ${role}` })
  } catch (err) {
    console.error('[API] Invite Error:', err)
    res.status(500).json({ error: err.message })
  }
})

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
