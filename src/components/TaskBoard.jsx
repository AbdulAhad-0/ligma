import React, { useEffect } from 'react'
import supabase from '../lib/supabase'
import { useTaskStore } from '../stores/useTaskStore'
import { CheckCircle2, Circle, Clock, MessageSquare, Target, HelpCircle, BookOpen, MapPin, ShieldCheck, Sparkles } from 'lucide-react'

const intentStyles = {
  action_item: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
    icon: <Target size={12} className="text-emerald-500" />,
    label: 'Action Item'
  },
  decision: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
    icon: <ShieldCheck size={12} className="text-indigo-500" />,
    label: 'Decision'
  },
  open_question: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    icon: <HelpCircle size={12} className="text-amber-500" />,
    label: 'Question'
  },
  reference: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-100',
    icon: <BookOpen size={12} className="text-slate-500" />,
    label: 'Reference'
  },
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const diff = Math.floor((new Date() - new Date(dateString)) / 60000)
  if (diff < 1) return 'JUST NOW'
  if (diff < 60) return `${diff} MIN AGO`
  if (diff < 1440) return `${Math.floor(diff / 60)} HOURS AGO`
  return `${Math.floor(diff / 1440)} DAYS AGO`
}

export default function TaskBoard({ workspaceId, canvasRef }) {
  const { tasks, setTasks, updateTaskStatus, filter, setFilter } = useTaskStore()

  useEffect(() => {
    if (!workspaceId) return

    const loadTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles!created_by(username)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading tasks:', error)
      } else {
        setTasks(data || [])
      }
    }

    loadTasks()
  }, [workspaceId, setTasks])

  const handleStatusChange = async (task, newStatus) => {
    updateTaskStatus(task.id, newStatus)
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
  }

  const handleJump = (nodeId) => {
    if (canvasRef?.current?.jumpToNode) {
      canvasRef.current.jumpToNode(nodeId)
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true
    return t.intent_type === filter
  })

  const counts = {
    all: tasks.length,
    action_item: tasks.filter(t => t.intent_type === 'action_item').length,
    decision: tasks.filter(t => t.intent_type === 'decision').length,
    open_question: tasks.filter(t => t.intent_type === 'open_question').length,
    reference: tasks.filter(t => t.intent_type === 'reference').length,
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/60 bg-white/40 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Intelligence</h2>
            <h3 className="text-xl font-black tracking-tighter text-slate-900">Task Board</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 text-white font-black text-sm">
            {counts.all}
          </div>
        </div>
        
        {/* Filter Tabs - Figma Style */}
        <div className="flex flex-wrap gap-2">
          {['all', 'action_item', 'decision', 'open_question', 'reference'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-white/60 text-slate-500 border border-slate-200/50 hover:bg-white hover:border-slate-300'
              }`}
            >
              {f === 'all' ? 'Everything' : intentStyles[f]?.label}
              <span className={`opacity-40`}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/20">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
              <Sparkles size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Ligma is waiting...<br />Write on the canvas to begin.
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            No entries found in this sector.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const style = intentStyles[task.intent_type] || intentStyles.reference
            return (
              <div key={task.id} className="group relative bg-white rounded-[2rem] border border-slate-200/80 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-indigo-200 active:scale-[0.98]">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                    {style.icon}
                    <span className="text-[10px] font-black uppercase tracking-widest">{style.label}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value)}
                      className="text-[9px] font-black uppercase tracking-widest border border-slate-100 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-600 outline-none cursor-pointer hover:border-slate-300 transition-all appearance-none text-center"
                    >
                      <option value="todo">TO DO</option>
                      <option value="in_progress">ACTIVE</option>
                      <option value="done">DONE</option>
                    </select>
                  </div>
                </div>
                
                <h3 className="font-black text-slate-900 text-base mb-5 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors">
                  {task.title}
                </h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-md">
                      {(task.profiles?.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-900 leading-none">{task.profiles?.username || 'Unknown'}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{timeAgo(task.created_at)}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleJump(task.node_id)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-all hover:bg-indigo-600 hover:text-white group-hover:scale-105 active:scale-95"
                  >
                    <MapPin size={18} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
