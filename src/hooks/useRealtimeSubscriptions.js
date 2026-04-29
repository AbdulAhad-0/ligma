import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useEventLogStore } from '../stores/useEventLogStore'
import { useTaskStore } from '../stores/useTaskStore'
import { usePresenceStore } from '../stores/usePresenceStore'
import { useAuthStore } from '../stores/useAuthStore'

export default function useRealtimeSubscriptions(workspaceId) {
  const appendEvent = useEventLogStore((state) => state.appendEvent)
  const setLastSeq = useEventLogStore((state) => state.setLastSeq)
  const lastSeq = useEventLogStore((state) => state.lastSeq)

  const addTask = useTaskStore((state) => state.addTask)

  const updateCursor = usePresenceStore((state) => state.updateCursor)
  const removeCursor = usePresenceStore((state) => state.removeCursor)

  const profile = useAuthStore((state) => state.profile)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!workspaceId) return undefined

    // Replay missed events since lastSeq
    const replayMissed = async () => {
      try {
        const { data, error } = await supabase
          .from('canvas_events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .gt('seq', lastSeq || 0)
          .order('seq', { ascending: true })

        if (error) {
          console.error('[useRealtimeSubscriptions] replay error', error)
          return
        }

        if (Array.isArray(data) && data.length) {
          data.forEach((ev) => appendEvent(ev))
          setLastSeq(data[data.length - 1].seq)
        }
      } catch (e) {
        // ignore
      }
    }

    replayMissed()

    // Channel 1 — canvas_events INSERT
    const eventsCh = supabase
      .channel('events-' + workspaceId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'canvas_events', filter: 'workspace_id=eq.' + workspaceId },
        (payload) => {
          if (payload?.new) {
            appendEvent(payload.new)
            if (payload.new.seq != null) setLastSeq(payload.new.seq)
          }
        }
      )
      .subscribe()

    // Channel 2 — tasks INSERT
    const tasksCh = supabase
      .channel('tasks-' + workspaceId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: 'workspace_id=eq.' + workspaceId },
        (payload) => {
          if (payload?.new) addTask(payload.new)
        }
      )
      .subscribe()

    // Channel 3 — presence (cursors, no DB writes)
    const presenceCh = supabase.channel('presence-' + workspaceId)

    presenceCh
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = presenceCh.presenceState()
          Object.values(state || {}).forEach((arr) => {
            if (!Array.isArray(arr)) return
            arr.forEach((p) => {
              if (!p?.userId) return
              updateCursor(p.userId, {
                userId: p.userId,
                username: p.username || p.name || 'User',
                color: p.color,
                x: p.x,
                y: p.y,
                lastSeen: Date.now(),
              })
            })
          })
        } catch (e) {
          // ignore
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        try {
          if (Array.isArray(leftPresences)) {
            leftPresences.forEach((p) => {
              if (p?.userId) removeCursor(p.userId)
            })
          }
        } catch (e) {
          // ignore
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            const userId = user?.id
            const username = profile?.username || user?.email || 'User'
            const color = profile?.color || '#6366f1'
            if (userId) await presenceCh.track({ userId, username, color })
          } catch (e) {
            // ignore
          }
        }
      })

    // Channel 4 — members changes
    const membersCh = supabase
      .channel('members-' + workspaceId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: 'workspace_id=eq.' + workspaceId },
        () => {
          // Trigger a refresh event or just rely on manual refetch
          // For now, let's just log and we'll handle the refetch in Workspace.jsx
          console.log('[Realtime] Members changed')
          window.dispatchEvent(new CustomEvent('workspace-members-changed'))
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      try {
        eventsCh.unsubscribe?.()
        tasksCh.unsubscribe?.()
        presenceCh.unsubscribe?.()
        membersCh.unsubscribe?.()
      } catch (e) {
        // ignore
      }
      try {
        supabase.removeChannel?.(eventsCh)
        supabase.removeChannel?.(tasksCh)
        supabase.removeChannel?.(presenceCh)
        supabase.removeChannel?.(membersCh)
      } catch (e) {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user?.id, profile?.username])
}
