import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import socket from '../lib/socket'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { usePresenceStore } from '../stores/usePresenceStore'
import useRealtimeSubscriptions from '../hooks/useRealtimeSubscriptions'
import Canvas from '../components/Canvas'
import CursorOverlay from '../components/CursorOverlay'
import EventLogSidebar from '../components/EventLogSidebar'
import TaskBoard from '../components/TaskBoard'
import { UserPlus, Sparkles, ChevronLeft, LayoutGrid, Users, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Workspace() {
  const { id: workspaceId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)
  const setMembers = useWorkspaceStore((state) => state.setMembers)
  const setMyRole = useWorkspaceStore((state) => state.setMyRole)
  const workspace = useWorkspaceStore((state) => state.workspace)
  const members = useWorkspaceStore((state) => state.members)
  const myRole = useWorkspaceStore((state) => state.myRole)
  const cursors = usePresenceStore((state) => state.cursors)
  const canvasRef = useRef(null)

  useRealtimeSubscriptions(workspaceId)

  const [activeUserIds, setActiveUserIds] = React.useState([])

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!workspaceId || !user?.id) return

      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('id, name, created_at')
        .eq('id', workspaceId)
        .single()

      if (workspaceData) setWorkspace(workspaceData)

      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('user_id, role, profiles(id, username, avatar_url)')
        .eq('workspace_id', workspaceId)

      if (memberRows) {
        setMembers(memberRows)
        const mine = memberRows.find((m) => m.user_id === user.id)
        setMyRole(mine?.role || null)
      }

      if (!socket.connected) socket.connect()
      socket.emit('join-workspace', { workspaceId, userId: user.id })
    }

    loadWorkspace()

    const onMembersChanged = () => loadWorkspace()
    const onRoomUsers = ({ users }) => {
      console.log('[Socket] Room users update:', users)
      setActiveUserIds(users)
    }

    if (socket.connected) {
      socket.emit('join-workspace', { workspaceId, userId: user.id })
    }

    window.addEventListener('workspace-members-changed', onMembersChanged)
    socket.on('room-users', onRoomUsers)

    return () => {
      socket.disconnect()
      window.removeEventListener('workspace-members-changed', onMembersChanged)
      socket.off('room-users', onRoomUsers)
    }
  }, [setMembers, setMyRole, setWorkspace, user?.id, workspaceId])

  const roleBadgeStyle = useMemo(() => {
    if (myRole === 'lead') return 'bg-indigo-50 text-indigo-600 border-indigo-200'
    if (myRole === 'contributor') return 'bg-emerald-50 text-emerald-600 border-emerald-200'
    return 'bg-slate-50 text-slate-500 border-slate-200'
  }, [myRole])

  const [showInvite, setShowInvite] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState('viewer')
  const [inviteStatus, setInviteStatus] = React.useState(null)

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteStatus('DISPATCHING...')
    try {
      const res = await fetch(`${import.meta.env.VITE_WS_URL}/api/invite-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          requesterId: user.id,
          invitedEmail: inviteEmail,
          role: inviteRole
        })
      })
      const data = await res.json()
      if (data.success) {
        setInviteStatus('MEMBER ADDED')
        setInviteEmail('')
        setTimeout(() => { setShowInvite(false); setInviteStatus(null) }, 2000)
      } else {
        setInviteStatus('ERROR: ' + data.error)
      }
    } catch (err) {
      setInviteStatus('FAILED')
    }
  }

  // Figma-style Avatar Stack
  const avatarStack = useMemo(() => {
    const sortedMembers = [...members].sort((a, b) => {
      const aOnline = activeUserIds.includes(a.user_id)
      const bOnline = activeUserIds.includes(b.user_id)
      return bOnline - aOnline
    })

    const limit = 4
    const display = sortedMembers.slice(0, limit)
    const extra = sortedMembers.length - limit

    return (
      <div className="flex -space-x-3 items-center">
        {display.map((m) => {
          const isOnline = activeUserIds.includes(m.user_id)
          const initials = (m.profiles?.username || 'U')[0].toUpperCase()
          return (
            <div 
              key={m.user_id} 
              className={`relative h-9 w-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[11px] font-black shadow-sm transition-transform hover:-translate-y-1 hover:z-10 cursor-help ${isOnline ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
              title={m.profiles?.username || 'User'}
            >
              {m.profiles?.avatar_url ? (
                <img src={m.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-slate-600">{initials}</span>
              )}
              {isOnline && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              )}
            </div>
          )
        })}
        {extra > 0 && (
          <div className="h-9 w-9 rounded-full border-2 border-white bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
            +{extra}
          </div>
        )}
      </div>
    )
  }, [members, activeUserIds])

  return (
    <div className="h-screen overflow-hidden bg-white text-slate-900 selection:bg-indigo-100 font-sans">
      {/* Bright Premium Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm relative z-[1000]">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/')}
            className="group flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white transition-all hover:bg-slate-50 hover:border-slate-300"
          >
            <ChevronLeft size={20} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
          </button>
          
          <div className="h-8 w-[1px] bg-slate-200" />

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black tracking-tighter text-slate-950 uppercase">{workspace?.name || 'WORKSPACE'}</h1>
              <span className={`rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-widest ${roleBadgeStyle}`}>
                {myRole || 'viewer'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Figma Avatar Stack */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Active</span>
            {avatarStack}
          </div>

          <div className="h-8 w-[1px] bg-slate-200" />

          <div className="flex items-center gap-3">
            {myRole === 'lead' && (
              <div className="relative">
                <button 
                  onClick={() => setShowInvite(!showInvite)}
                  className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                >
                  <UserPlus size={16} />
                  INVITE
                </button>

                {showInvite && (
                  <div className="absolute right-0 top-full mt-3 w-80 overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="p-8">
                      <h3 className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-indigo-600">Collaborator Invite</h3>
                      <form onSubmit={handleInvite} className="space-y-4">
                        <input
                          type="email"
                          placeholder="user@email.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-600/30 focus:bg-white"
                          required
                          autoFocus
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600/30 focus:bg-white appearance-none"
                        >
                          <option value="viewer">VIEWER ACCESS</option>
                          <option value="contributor">CONTRIBUTOR RANK</option>
                          <option value="lead">LEAD PRIVILEGE</option>
                        </select>
                        <button
                          type="submit"
                          className="w-full rounded-2xl bg-indigo-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-100"
                        >
                          SEND INVITE
                        </button>
                        {inviteStatus && (
                          <p className="text-[9px] font-black text-center text-slate-400 uppercase tracking-widest animate-pulse">{inviteStatus}</p>
                        )}
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={async () => {
                try {
                  const res = await fetch(`${import.meta.env.VITE_WS_URL}/api/summary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspaceId })
                  })
                  const data = await res.json()
                  if (data.summary) {
                    alert("GEMINI SUMMARY:\n\n" + data.summary)
                  }
                } catch (e) {
                  console.error("Summary failed:", e)
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Sparkles size={16} className="fill-white" />
              SUMMARY
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left Sidebar - Event Log */}
        <aside className="h-full w-[300px] shrink-0 border-r border-slate-200 bg-slate-50/30">
          <EventLogSidebar workspaceId={workspaceId} />
        </aside>

        {/* Center - Canvas */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-white">
          <Canvas ref={canvasRef} workspaceId={workspaceId} userId={user?.id} />
          <CursorOverlay workspaceId={workspaceId} />
        </main>

        {/* Right Sidebar - Task Board */}
        <aside className="h-full w-[340px] shrink-0 border-l border-slate-200 bg-slate-50/30">
          <TaskBoard workspaceId={workspaceId} canvasRef={canvasRef} />
        </aside>
      </div>
    </div>
  )
}
