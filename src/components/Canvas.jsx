import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { Lock, Unlock, CheckCircle2, ChevronDown } from 'lucide-react'
import { logEvent } from '../lib/events'
import supabase from '../lib/supabase'

const updateTimers = {}

const Canvas = forwardRef(function Canvas({ workspaceId, userId }, ref) {
  const editorRef = useRef(null)
  const yLocksRef = useRef(null)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [userRole, setUserRole] = useState('viewer')
  const userRoleRef = useRef('viewer')
  const [selectionCount, setSelectionCount] = useState(0)
  const [statusMsg, setStatusMsg] = useState(null)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const isApplyingRemoteRef = useRef(false)
  const unsubscribeRef = useRef(null)

  useEffect(() => { userRoleRef.current = userRole }, [userRole])

  useImperativeHandle(ref, () => ({
    jumpToNode(nodeId) {
      const editor = editorRef.current
      if (editor) {
        // Find shape by its meta nodeId
        const shape = editor.getCurrentPageShapes().find(s => s.meta?.nodeId === nodeId)
        if (shape) editor.zoomToShapes([shape.id])
      }
    }
  }))

  const getIsLockedForMe = (minRole) => {
    const myRole = userRoleRef.current
    if (myRole === 'lead') return false
    if (minRole === 'lead') return true
    if (minRole === 'contributor' && myRole === 'viewer') return true
    return false
  }

  // 1. Real-time Collaboration Engine
  useEffect(() => {
    if (!isEditorReady || !editorRef.current || !workspaceId) return
    const editor = editorRef.current
    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(import.meta.env.VITE_WS_URL.replace('http', 'ws'), `workspace-${workspaceId}`, yDoc)
    const yShapes = yDoc.getMap('shapes')
    const yLocks = yDoc.getMap('locks')
    yLocksRef.current = yLocks

    yShapes.observe((event) => {
      if (isApplyingRemoteRef.current) return
      isApplyingRemoteRef.current = true
      try {
        editor.store.mergeRemoteChanges(() => {
          event.changes.keys.forEach((change, key) => {
            if (change.action === 'add' || change.action === 'update') {
              const shape = yShapes.get(key)
              if (shape) {
                const minRole = yLocks.get(key) || 'viewer'
                editor.store.put([{ ...shape, isLocked: getIsLockedForMe(minRole) }])
              }
            } else if (change.action === 'delete') {
              editor.store.remove([key])
            }
          })
        })
      } finally { isApplyingRemoteRef.current = false }
    })

    yLocks.observe(() => {
      const updates = []
      yLocks.forEach((minRole, shapeId) => {
        const shape = editor.getShape(shapeId)
        if (shape) {
          const shouldLock = getIsLockedForMe(minRole)
          if (shape.isLocked !== shouldLock) updates.push({ id: shapeId, isLocked: shouldLock })
        }
      })
      if (updates.length > 0) {
        isApplyingRemoteRef.current = true
        editor.updateShapes(updates)
        isApplyingRemoteRef.current = false
      }
    })

    const unlisten = editor.store.listen(({ changes }) => {
      if (isApplyingRemoteRef.current) return
      yDoc.transact(() => {
        Object.values(changes.added).forEach(r => { if (r.typeName === 'shape') yShapes.set(r.id, r) })
        Object.values(changes.updated).forEach(([_, r]) => { if (r.typeName === 'shape') yShapes.set(r.id, r) })
        Object.values(changes.removed).forEach(r => { if (r.typeName === 'shape') yShapes.delete(r.id) })
      })
    }, { source: 'user', scope: 'document' })

    return () => { unlisten(); provider.disconnect(); yDoc.destroy() }
  }, [isEditorReady, workspaceId])

  // 2. Persistence & Data Loading
  useEffect(() => {
    if (!isEditorReady || !editorRef.current || !workspaceId) return
    const editor = editorRef.current

    const init = async () => {
      const { data: member } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).single()
      if (member) setUserRole(member.role)

      const { data: nodes } = await supabase.from('canvas_nodes').select('*').eq('workspace_id', workspaceId).eq('is_deleted', false)
      if (nodes) {
        isApplyingRemoteRef.current = true
        editor.store.mergeRemoteChanges(() => {
          const existingShapes = editor.getCurrentPageShapes()
          const shapes = nodes.map(n => {
            // Avoid duplicates: check if we already have this node ID in meta
            const isDuplicate = existingShapes.some(s => s.meta?.nodeId === n.id || s.id === `shape:${n.id}`)
            if (isDuplicate) return null

            const props = typeof n.props === 'string' ? JSON.parse(n.props) : (n.props || {})
            const minRole = props.min_role || 'viewer'
            const cleanProps = { ...props }; delete cleanProps.min_role
            const typeToUse = (n.type === 'shape' || n.type === 'sticky_note') ? 'geo' : n.type
            
            const supportsText = ['geo', 'note', 'text'].includes(typeToUse)
            const finalProps = { ...cleanProps }
            if (supportsText) finalProps.text = n.content || cleanProps.text || ''

            return {
              id: `shape:${n.id}`, type: typeToUse, x: n.x, y: n.y,
              isLocked: getIsLockedForMe(minRole),
              meta: { nodeId: n.id },
              props: finalProps
            }
          }).filter(Boolean)
          
          if (shapes.length > 0) editor.createShapes(shapes)
        })
        isApplyingRemoteRef.current = false
      }
    }

    const sub = supabase.channel('db_locks').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'canvas_nodes' }, (p) => {
      const node = p.new
      const minRole = node.props?.min_role || 'viewer'
      isApplyingRemoteRef.current = true
      editor.store.mergeRemoteChanges(() => {
        editor.updateShapes([{ id: `shape:${node.id}`, isLocked: getIsLockedForMe(minRole) }])
      })
      isApplyingRemoteRef.current = false
    }).subscribe()

    init()
    return () => { supabase.removeChannel(sub) }
  }, [isEditorReady, workspaceId])

  const handleLock = async (role) => {
    const selected = editorRef.current?.getSelectedShapes()
    if (!selected?.length) return
    for (const shape of selected) {
      const nodeId = shape.meta?.nodeId || shape.id.replace('shape:', '')
      if (yLocksRef.current) yLocksRef.current.set(shape.id, role)
      await fetch(import.meta.env.VITE_WS_URL + '/api/lock-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, userId, workspaceId, role })
      })
    }
    setStatusMsg(role === 'viewer' ? 'Unlocked All' : `Locked for ${role === 'lead' ? 'ALL' : 'Viewers'}`)
    setActiveDropdown(null)
    setTimeout(() => setStatusMsg(null), 3000)
  }

  return (
    <div className="relative h-screen w-full">
      <Tldraw
        onMount={(editor) => {
          editorRef.current = editor
          setIsEditorReady(true)
          
          // D. Auto-Repair: Ensure every shape has a nodeId in meta
          const repairShapes = () => {
            const shapes = editor.getCurrentPageShapes()
            const updates = []
            shapes.forEach(s => {
              if (s.typeName === 'shape' && !s.meta?.nodeId) {
                updates.push({ id: s.id, meta: { ...s.meta, nodeId: crypto.randomUUID() } })
              }
            })
            if (updates.length > 0) {
              isApplyingRemoteRef.current = true
              editor.updateShapes(updates)
              isApplyingRemoteRef.current = false
              console.log(`[Canvas] Repaired ${updates.length} shapes with new IDs`)
            }
          }
          repairShapes()

          // Helper to sync nodes via backend to bypass RLS issues
          const syncNode = async (nodeData) => {
            try {
              const res = await fetch(`${import.meta.env.VITE_WS_URL}/api/sync-node`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workspaceId,
                  userId,
                  ...nodeData
                })
              })
              return await res.json()
            } catch (err) {
              console.error('[Canvas] Sync Failed:', err)
              return { error: err.message }
            }
          }

          const unsub = editor.store.listen(async ({ changes }) => {
            if (isApplyingRemoteRef.current) return

            // A. Handle Added Shapes
            const addedShapes = Object.values(changes.added).filter(r => r.typeName === 'shape')
            for (const s of addedShapes) {
              const nodeId = s.meta?.nodeId || crypto.randomUUID()
              if (!s.meta?.nodeId) {
                isApplyingRemoteRef.current = true
                editor.updateShapes([{ id: s.id, meta: { ...s.meta, nodeId } }])
                isApplyingRemoteRef.current = false
              }

              const result = await syncNode({
                nodeId, type: s.type, x: s.x, y: s.y, props: s.props, content: s.props.text || ''
              })

              if (!result.error) {
                logEvent({ workspaceId, nodeId: result.nodeId || nodeId, eventType: 'node_created', payload: { type: s.type }, actorId: userId })
              }
            }

            // B. Handle Updated Shapes
            const updatedShapes = Object.values(changes.updated).filter(([_, r]) => r.typeName === 'shape')
            for (const [_, s] of updatedShapes) {
              const nodeId = s.meta?.nodeId
              if (!nodeId || nodeId.length < 20) continue
              
              clearTimeout(updateTimers[nodeId])
              updateTimers[nodeId] = setTimeout(async () => {
                const result = await syncNode({
                  nodeId, type: s.type, x: s.x, y: s.y, props: s.props, content: s.props.text || ''
                })

                if (!result.error) {
                  logEvent({ workspaceId, nodeId: result.nodeId || nodeId, eventType: 'node_updated', payload: { type: s.type }, actorId: userId })
                  
                  // AI Classification Trigger
                  const text = s.props.text || ''
                  if (text.trim().length >= 10) {
                    fetch(`${import.meta.env.VITE_WS_URL}/api/classify`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        content: text,
                        nodeId: result.nodeId || nodeId,
                        workspaceId,
                        actorId: userId
                      })
                    }).catch(e => console.error('[AI] Classify failed:', e))
                  }
                }
              }, 2000)
            }

            // C. Handle Removed Shapes
            const removedShapes = Object.values(changes.removed).filter(r => r.typeName === 'shape')
            for (const s of removedShapes) {
              const nodeId = s.meta?.nodeId
              if (nodeId && nodeId.length >= 20) {
                const result = await syncNode({ nodeId, isDeleted: true })
                logEvent({ workspaceId, nodeId: result.nodeId || nodeId, eventType: 'node_deleted', payload: {}, actorId: userId })
              }
            }
          }, { source: 'user', scope: 'document' })

          editor.on('change', () => setSelectionCount(editor.getSelectedShapeIds().length))
          unsubscribeRef.current = unsub
        }}
      />

      {userRole === 'lead' && selectionCount > 0 && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[9999] bg-white/95 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/20">
          <div className="px-3 py-1 text-xs font-black text-slate-400 border-r border-slate-100 uppercase tracking-tighter">{selectionCount} Selected</div>
          <div className="relative">
            <button onClick={() => setActiveDropdown(activeDropdown === 'lock' ? null : 'lock')} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition-all">
              <Lock size={16} /> Lock <ChevronDown size={14} />
            </button>
            {activeDropdown === 'lock' && (
              <div className="absolute bottom-full mb-3 left-0 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden">
                <button onClick={() => handleLock('lead')} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 flex flex-col">
                  <span className="font-bold text-sm text-slate-900">Lock for ALL</span>
                  <span className="text-[10px] text-slate-500 uppercase">Only Lead can edit</span>
                </button>
                <button onClick={() => handleLock('contributor')} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col">
                  <span className="font-bold text-sm text-slate-900">Lock for Viewers</span>
                  <span className="text-[10px] text-slate-500 uppercase">Lead & Contributors can edit</span>
                </button>
              </div>
            )}
          </div>
          <button onClick={() => handleLock('viewer')} className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-600 border border-emerald-100 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm">
            <Unlock size={16} /> Unlock All
          </button>
          {statusMsg && (
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-black shadow-2xl">
              <CheckCircle2 size={18} className="text-emerald-400" /> {statusMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default Canvas
