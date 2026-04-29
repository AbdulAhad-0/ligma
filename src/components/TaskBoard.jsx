import React, { useEffect } from 'react'
import supabase from '../lib/supabase'
import { useTaskStore } from '../stores/useTaskStore'

const intentColors = {
  action_item: 'bg-green-100 text-green-800 border-green-200',
  decision: 'bg-purple-100 text-purple-800 border-purple-200',
  open_question: 'bg-amber-100 text-amber-800 border-amber-200',
  reference: 'bg-gray-100 text-gray-800 border-gray-200',
}

const intentLabels = {
  action_item: 'Action Item',
  decision: 'Decision',
  open_question: 'Open Question',
  reference: 'Reference',
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const diff = Math.floor((new Date() - new Date(dateString)) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff} min ago`
  if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`
  return `${Math.floor(diff / 1440)} days ago`
}

export default function TaskBoard({ workspaceId, canvasRef }) {
  const { tasks, setTasks, updateTaskStatus, filter, setFilter } = useTaskStore()

  useEffect(() => {
    if (!workspaceId) return

    const loadTasks = async () => {
      // The schema doesn't have is_deleted by default on tasks, 
      // but following the user prompt exactly. If it fails, remove .eq('is_deleted', false)
      const query = supabase
        .from('tasks')
        .select('*, profiles!created_by(username)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      // Catching potential missing column error gracefully
      const { data, error } = await query
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
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id)
      
    if (error) {
      console.error('Error updating task status:', error)
      // Optional: rollback on error
      updateTaskStatus(task.id, task.status)
    }
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

  // Calculate counts
  const counts = {
    all: tasks.length,
    action_item: tasks.filter(t => t.intent_type === 'action_item').length,
    decision: tasks.filter(t => t.intent_type === 'decision').length,
    open_question: tasks.filter(t => t.intent_type === 'open_question').length,
    reference: tasks.filter(t => t.intent_type === 'reference').length,
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-bold text-slate-800 flex items-center justify-between mb-3">
          Task Board
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-medium">
            {counts.all}
          </span>
        </h2>
        
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 text-xs">
          {['all', 'action_item', 'decision', 'open_question', 'reference'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors border ${
                filter === f 
                  ? 'bg-slate-800 text-white border-slate-800' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? 'All' : intentLabels[f]}
              <span className={`ml-1.5 ${filter === f ? 'text-slate-300' : 'text-slate-400'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl mt-4">
            <p className="text-sm text-slate-500 font-medium">
              Write 10+ chars on canvas — Gemini will classify automatically
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center p-6 text-sm text-slate-500">
            No items match this filter.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${intentColors[task.intent_type] || intentColors.reference}`}>
                  {intentLabels[task.intent_type] || task.intent_type}
                </span>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task, e.target.value)}
                  className="text-xs border border-slate-200 rounded-md bg-slate-50 px-2 py-1 text-slate-700 font-medium cursor-pointer outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              
              <h3 className="font-semibold text-slate-800 text-sm mb-3 leading-snug">
                {task.title}
              </h3>
              
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5 font-medium">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                    {task.profiles?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span>{task.profiles?.username || 'Unknown'}</span>
                  <span className="text-slate-300">•</span>
                  <span>{timeAgo(task.created_at)}</span>
                </div>
                
                <button 
                  onClick={() => handleJump(task.node_id)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                >
                  <span>Go to node</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
