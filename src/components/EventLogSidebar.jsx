import React, { useMemo } from 'react'
import { useEventLogStore } from '../stores/useEventLogStore'

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  node_created: {
    label: 'created',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  node_updated: {
    label: 'updated',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  node_deleted: {
    label: 'deleted',
    bg: 'bg-red-100',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  node_locked: {
    label: 'locked',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  acl_changed: {
    label: 'acl',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
  },
}

const DEFAULT_CONFIG = {
  label: 'event',
  bg: 'bg-slate-100',
  text: 'text-slate-600',
  dot: 'bg-slate-400',
}

// ── Time-ago helper ───────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)

  if (diff < 5)  return 'just now'
  if (diff < 60) return `${diff}s ago`

  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`

  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`

  return `${Math.floor(hrs / 24)}d ago`
}

// ── Event row ─────────────────────────────────────────────────────────────────
function EventRow({ event }) {
  const cfg = EVENT_CONFIG[event.event_type] ?? DEFAULT_CONFIG

  const actor = event.actor_username ?? event.actor_id ?? 'Unknown'
  const when  = timeAgo(event.inserted_at ?? event.created_at)

  return (
    <li className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
      {/* Colour dot */}
      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />

      <div className="flex-1 min-w-0">
        {/* Badge + actor */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
          >
            {cfg.label}
          </span>
          <span className="truncate text-xs font-medium text-slate-700">
            {actor}
          </span>
        </div>

        {/* Timestamp */}
        <p className="mt-0.5 text-[11px] text-slate-400">{when}</p>
      </div>
    </li>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function EventLogSidebar() {
  const events = useEventLogStore((state) => state.events)

  // Newest first
  const reversed = useMemo(() => [...events].reverse(), [events])

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">
          Event Log
        </h2>
        {events.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">
            {events.length}
          </span>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-4">
        {reversed.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
            No events yet
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reversed.map((event, idx) => (
              <EventRow key={event.id ?? idx} event={event} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
