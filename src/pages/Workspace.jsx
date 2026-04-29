import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import socket from '../lib/socket'
import useAuthStore from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import useRealtimeSubscriptions from '../hooks/useRealtimeSubscriptions'
import Canvas from '../components/Canvas'
import CursorOverlay from '../components/CursorOverlay'
import EventLogSidebar from '../components/EventLogSidebar'
import TaskBoard from '../components/TaskBoard'

export default function Workspace() {
  const { id: workspaceId } = useParams()
  const user = useAuthStore((state) => state.user)
  
  console.log('[Workspace] Rendering with:', { workspaceId, userId: user?.id, userEmail: user?.email })
  
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)
  const setMembers = useWorkspaceStore((state) => state.setMembers)
  const setMyRole = useWorkspaceStore((state) => state.setMyRole)
  const workspace = useWorkspaceStore((state) => state.workspace)
  const members = useWorkspaceStore((state) => state.members)
  const myRole = useWorkspaceStore((state) => state.myRole)
  const canvasRef = useRef(null)

  useRealtimeSubscriptions(workspaceId)

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!workspaceId || !user?.id) {
        return
      }

      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('id, name, created_at')
        .eq('id', workspaceId)
        .single()

      if (workspaceData) {
        setWorkspace(workspaceData)
      }

      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('user_id, role, profiles(id, username, avatar_url)')
        .eq('workspace_id', workspaceId)

      if (memberRows) {
        setMembers(memberRows)
        const mine = memberRows.find((member) => member.user_id === user.id)
        setMyRole(mine?.role || null)
      }

      if (!socket.connected) {
        socket.connect()
      }

      socket.emit('join-workspace', {
        workspaceId,
        userId: user.id,
      })
    }

    loadWorkspace()

    return () => {
      socket.disconnect()
    }
  }, [setMembers, setMyRole, setWorkspace, user?.id, workspaceId])

  const roleBadgeClass = useMemo(() => {
    if (myRole === 'lead') return 'bg-cyan-100 text-cyan-700 border-cyan-200'
    if (myRole === 'editor') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }, [myRole])

  const [showInvite, setShowInvite] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState('viewer')
  const [inviteStatus, setInviteStatus] = React.useState(null)

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteStatus('Inviting...')
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
        setInviteStatus('Success!')
        setInviteEmail('')
        setTimeout(() => {
          setShowInvite(false)
          setInviteStatus(null)
        }, 1500)
      } else {
        setInviteStatus('Error: ' + data.error)
      }
    } catch (err) {
      setInviteStatus('Failed to invite')
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{workspace?.name || 'Workspace'}</h1>
          <p className="text-xs text-slate-500">{members.length} members</p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${roleBadgeClass}`}>
            {myRole || 'viewer'}
          </span>
          
          {myRole === 'lead' && (
            <div className="relative">
              <button 
                onClick={() => setShowInvite(!showInvite)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" heigh