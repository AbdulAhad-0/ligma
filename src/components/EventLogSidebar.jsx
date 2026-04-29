import React, { useMemo } from 'react'
import { useEventLogStore } from '../stores/useEventLogStore'
import { Zap, Plus, Edit3, Trash2, ShieldCheck, Activity, Clock } from 'lucide-react'

function timeAgo(dateString) {
  if (!dateString) return ''
  const diff = Math.floor((new Date() - new Date(dateString)) / 60000)
  if (diff < 1) return 'JUST NOW'
  if (diff < 60) return `${diff}M AGO`
  if (diff < 1440) return `${Math.floor(diff / 60)}H AGO`
  return `${Math.floor(diff / 1440)}D AGO`
}

const eventStyles = {
  node_created: {
    icon: <Plus size={14} className="text-emerald-500" />,
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    label: 'Created'
  },
  node_updated: {
    icon: <Edit3 size={14} className="text-indigo-500" />,
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
    label: 'Updated'
  },
  node_deleted: {
    icon: <Trash2 size={14} className="text-rose-500" />,
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    label: 'Deleted'
  },
  intent_classified: {
    icon: <Zap size={14} className="text-amber-500" />,
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    label: 'Ligma Insight'
  },
}

export default function EventLogSidebar() {
  const events = useEventLogStore((state) => state.events)

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [events])

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/60 bg-white/40 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Chronology</h2>
            <h3 className="text-xl font-black tracking-tighter text-slate-900">Activity Log</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white font-black text-sm">
            {events.length}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/50">
          <Activity size={12} className="text-slate-400" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Workspace Sync</span>
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-9 top-10 bottom-10 w-[2px] bg-slate-100 -z-10" />

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/20">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
              Waiting for neural events...
            </p>
          </div>
        ) : (
          sortedEvents.map((event, idx) => {
            const style = eventStyles[event.event_type] || {
              icon: <Activity size={14} className="text-slate-500" />,
              bg: 'bg-slate-50',
              border: 'border-slate-100',
              label: 'Event'
            }
            
            return (
              <div key={event.id || idx} className="flex gap-5 group">
                {/* Timeline Icon */}
                <div className={`relative z-10 shrink-0 h-8 w-8 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${style.bg} transition-all group-hover:scale-110 group-hover:shadow-md`}>
                  {style.icon}
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${style.text || 'text-slate-900'}`}>
                      {style.label}
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      <Clock size={10} />
                      {timeAgo(event.created_at)}
                    </div>
                  </div>
                  
                  <div className="bg-white/60 border border-slate-100 rounded-2xl p-3 shadow-sm transition-all group-hover:bg-white group-hover:border-indigo-100 group-hover:shadow-md">
                    <p className="text-[11px] font-bold text-slate-600 truncate mb-1">
                      {event.actor_id?.slice(0, 8) || 'Anonymous'}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 truncate leading-snug">
                      {event.node_id ? `Shape ID: ${event.node_id.slice(0, 8)}` : 'Workspace interaction'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
