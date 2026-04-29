import React, { useEffect, useMemo, useRef } from 'react'
import socket from '../lib/socket'
import usePresenceStore from '../stores/usePresenceStore'
import useAuthStore from '../stores/useAuthStore'

const CURSOR_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

export function getUserColor(userId) {
  const input = String(userId || '')
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0
  }

  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

export default function CursorOverlay({ workspaceId }) {
  const overlayRef = useRef(null)
  const throttleRef = useRef({ lastCall: 0, timeoutId: null, lastEvent: null })

  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const cursors = usePresenceStore((state) => state.cursors)
  const updateCursor = usePresenceStore((state) => state.updateCursor)
  const removeCursor = usePresenceStore((state) => state.removeCursor)

  const userColor = useMemo(() => getUserColor(user?.id), [user?.id])

  useEffect(() => {
    if (!workspaceId) {
      return undefined
    }

    const onCursorMove = (data) => {
      if (!data?.userId) {
        return
      }

      updateCursor(data.userId, {
        ...data,
        lastSeen: Date.now(),
      })
    }

    const onUserLeft = (data) => {
      if (data?.userId) {
        removeCursor(data.userId)
      }
    }

    socket.on('cursor-move', onCursorMove)
    socket.on('user-left', onUserLeft)

    return () => {
      socket.off('cursor-move', onCursorMove)
      socket.off('user-left', onUserLeft)
    }
  }, [removeCursor, updateCursor, workspaceId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const currentCursors = usePresenceStore.getState().cursors

      Object.entries(currentCursors).forEach(([userId, cursor]) => {
        const lastSeen = cursor?.lastSeen || 0
        if (now - lastSeen > 5000) {
          removeCursor(userId)
        }
      })
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [removeCursor])

  useEffect(() => {
    const container = overlayRef.current?.parentElement
    if (!container || !workspaceId || !user?.id) {
      return undefined
    }

    const emitMove = (event) => {
      const rect = container.getBoundingClientRect()
      const payload = {
        workspaceId,
        userId: user.id,
        username: profile?.username || user.email || 'User',
        color: userColor,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      socket.emit('cursor-move', payload)
      updateCursor(user.id, {
        ...payload,
        lastSeen: Date.now(),
      })
    }

    const onMouseMove = (event) => {
      const now = Date.now()
      const throttleState = throttleRef.current
      throttleState.lastEvent = event

      if (now - throttleState.lastCall >= 50) {
        throttleState.lastCall = now
        emitMove(event)
        return
      }

      if (!throttleState.timeoutId) {
        throttleState.timeoutId = window.setTimeout(() => {
          throttleState.timeoutId = null
          throttleState.lastCall = Date.now()
          if (throttleState.lastEvent) {
            emitMove(throttleState.lastEvent)
          }
        }, 50)
      }
    }

    container.addEventListener('mousemove', onMouseMove)

    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      if (throttleRef.current.timeoutId) {
        window.clearTimeout(throttleRef.current.timeoutId)
        throttleRef.current.timeoutId = null
      }
    }
  }, [profile?.username, removeCursor, updateCursor, user?.email, user?.id, userColor, workspaceId])

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.entries(cursors).map(([userId, cursor]) => {
        if (!cursor || cursor.x == null || cursor.y == null) {
          return null
        }

        const color = cursor.color || getUserColor(userId)
        return (
          <div
            key={userId}
            className="pointer-events-none absolute"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(0, 0)',
            }}
          >
            <div className="flex items-center gap-2 rounded-full bg-white/95 px-2 py-1 shadow">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-slate-800">{cursor.username || 'User'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
