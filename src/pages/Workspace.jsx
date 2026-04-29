import React, { useEffect, useMemo, useRef } from 'react'
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
import { UserPlus, Sparkles, ChevronLeft, LayoutGrid, Users, ShieldCheck, ArrowRight, Zap, Search } from 'lucide-react'

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
  const activeUserIds = useWorkspaceStore((state) => state.activeUserIds || [])
  const canvasRef = useRef(null)

  useRealtimeSubscriptions(workspaceId)

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
      // We'll update the store's activeUserIds
      useWorkspaceStore.setState({ activeUserIds: users })
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
    if (myRole === 'lead') return 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm shadow-indigo-100'
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
              className={`relative h-10 w-10 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[11px] font-black shadow-md transition-all hover:-translate-y-1 hover:z-10 cursor-help ${isOnline ? 'ring-2 ring-emerald-500 ring-offset-2' : 'grayscale-[0.5]'}`}
              title={m.profiles?.username || 'User'}
            >
              {m.profiles?.avatar_url ? (
                <img src={m.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-slate-500">{initials}</span>
              )}
              {isOnline && (
                <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              )}
            </div>
          )
        })}
        {extra > 0 && (
          <div className="h-10 w-10 rounded-full border-2 border-white bg-slate-950 flex items-center justify-center text-[10px] font-black text-white shadow-md">
            +{extra}
          </div>
        )}
      </div>
    )
  }, [members, activeUserIds])

  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] text-slate-900 selection:bg-indigo-100 font-sans">
      {/* Studio Header */}
      <div className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm relative z-[1000]">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => navigate('/')}
            className="group flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg"
          >
            <ChevronLeft size={22} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>
          
          <div className="h-10 w-[1px] bg-slate-200" />

          <div className="flex flex-col">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black tracking-tighter text-slate-950 uppercase leading-none">{workspace?.name || 'WORKSPACE'}</h1>
              <span className={`rounded-full border px-4 py-1 text-[10px] font-black uppercase tracking-widest ${roleBadgeStyle}`}>
                {myRole || 'viewer'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeUserIds.length} ACTIVE NOW</p>
            </div>
          </div>
        </div>

        {/* Center - Gemini Branding */}
        <div className="hidden lg:flex items-center gap-3 px-6 py-2.5 rounded-full border border-slate-100 bg-slate-50/50">
          <Zap size={16} className="text-indigo-600 fill-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">LIGMA Neural Sync Active</span>
        </div>

        <div className="flex items-center gap-8">
          {/* Avatar Stack */}
          <div className="flex items-center gap-4">
            {avatarStack}
          </div>

          <div className="h-10 w-[1px] bg-slate-200" />

          <div className="flex items-center gap-4">
            {myRole === 'lead' && (
              <div className="relative">
                <button 
                  onClick={() => setShowInvite(!showInvite)}
                  className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-95"
                >
                  <UserPlus size={18} />
                  INVITE
                </button>

                {showInvite && (
                  <div className="absolute right-0 top-full mt-4 w-80 overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <Users size={20} className="text-indigo-600" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Add Collaborator</h3>
                      </div>
                      <form onSubmit={handleInvite} className="space-y-4">
                        <div className="space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail Terminal</span>
                          <input
                            type="email"
                            placeholder="teammate@neural.link"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-600/30 focus:bg-white"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Access Rank</span>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600/30 focus:bg-white appearance-none"
                          >
                            <option value="viewer">VIEWER</option>
                            <option value="contributor">CONTRIBUTOR</option>
                            <option value="lead">LEAD</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="w-full rounded-2xl bg-slate-950 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-600 shadow-xl"
                        >
                          DISPATCH INVITE
                        </button>
                        {inviteStatus && (
                          <p className="text-[9px] font-black text-center text-indigo-600 uppercase tracking-widest animate-pulse">{inviteStatus}</p>
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
                    alert("Ligma ANALYTIC SUMMARY:\n\n" + data.summary)
                  }
                } catch (e) {
                  console.error("Summary failed:", e)
                }
              }}
              className="flex items-center gap-3 rounded-2xl bg-indigo-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={18} className="fill-white" />
              SUMMARY
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Grid Layout */}
      <div className="flex h-[calc(100vh-5rem)] overflow-hidden">
        {/* Left Sidebar - Event Log */}
        <aside className="h-full w-[320px] shrink-0 border-r border-slate-200 bg-slate-50/50 backdrop-blur-xl">
          <EventLogSidebar workspaceId={workspaceId} />
        </aside>

        {/* Center - Collaborative Canvas */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-white shadow-inner">
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.02)] z-10" />
          <Canvas ref={canvasRef} workspaceId={workspaceId} userId={user?.id} />
          <CursorOverlay workspaceId={workspaceId} />
        </main>

        {/* Right Sidebar - Neural Task Board */}
        <aside className="h-full w-[360px] shrink-0 border-l border-slate-200 bg-slate-50/50 backdrop-blur-xl">
          <TaskBoard workspaceId={workspaceId} canvasRef={canvasRef} />
        </aside>
      </div>
    </div>
  )
}
