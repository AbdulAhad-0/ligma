import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Plus, LayoutGrid, LogOut, ExternalLink, Calendar, Users, ArrowRight } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const signOut = useAuthStore((state) => state.signOut)
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')

  const displayName = useMemo(() => {
    return profile?.username || user?.email?.split('@')[0] || 'User'
  }, [profile, user])

  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(id, name, created_at)')
        .eq('user_id', user.id)

      if (fetchError) {
        setError(fetchError.message)
        setWorkspaces([])
      } else {
        setWorkspaces(data || [])
      }

      setLoading(false)
    }

    fetchWorkspaces()
  }, [user?.id])

  const handleCreateWorkspace = async (event) => {
    event.preventDefault()

    if (!workspaceName.trim() || !user?.id) {
      return
    }

    setCreating(true)
    setError('')

    const response = await fetch(`${import.meta.env.VITE_WS_URL}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: workspaceName.trim(),
        userId: user.id,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result?.error || 'Failed to create workspace')
      setCreating(false)
      return
    }

    navigate(`/workspace/${result.workspaceId}`)
  }

  const handleWorkspaceClick = (workspaceId) => {
    navigate(`/workspace/${workspaceId}`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-100 font-sans">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Modern Header */}
        <header className="mb-12 flex items-center justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white px-6 py-4 shadow-xl shadow-slate-200/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
              <LayoutGrid size={24} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600/80">COLLABORATIVE</p>
              <h1 className="text-xl font-black tracking-tighter text-slate-950">LIGMA.AI</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <div className="text-sm font-black text-slate-950">{displayName}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{user?.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
            >
              <LogOut size={20} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
            </button>
          </div>
        </header>

        {/* Hero & CTA */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-8 px-4">
          <div className="max-w-xl">
            <h2 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl leading-[1.1]">
              Think <span className="text-indigo-600">Together.</span><br />
              Build <span className="text-cyan-500">Faster.</span>
            </h2>
            <p className="mt-6 text-lg text-slate-500 font-medium leading-relaxed">
              Experience the next generation of brainstorming. Powered by Gemini, built for teams.
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="group relative flex items-center gap-3 rounded-[2rem] bg-indigo-600 px-8 py-5 text-sm font-black text-white transition-all hover:bg-indigo-700 hover:scale-[1.05] active:scale-[0.98] shadow-2xl shadow-indigo-200"
          >
            <Plus size={20} strokeWidth={3} />
            CREATE NEW WORKSPACE
          </button>
        </div>

        {/* Create Form Container */}
        {showCreateForm && (
          <div className="mb-12 overflow-hidden rounded-[3rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-indigo-100 animate-in zoom-in-95 duration-300">
            <div className="rounded-[2.8rem] bg-slate-50 p-10">
              <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-8 md:flex-row md:items-end">
                <div className="flex-1">
                  <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">WORKSPACE IDENTITY</span>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Enter a creative name..."
                    className="w-full bg-transparent border-b-2 border-slate-200 py-4 text-3xl font-black text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-indigo-600"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-full bg-indigo-600 px-10 py-5 font-black text-white transition-all hover:bg-indigo-700 hover:shadow-xl disabled:opacity-50"
                  >
                    {creating ? 'CREATING...' : 'LAUNCH'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-full border border-slate-200 bg-white px-8 py-5 font-black text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-10 rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm font-bold text-rose-600 flex items-center gap-3 animate-in slide-in-from-top-4">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            {error}
          </div>
        )}

        {/* Dashboard Grid Header */}
        <div className="mb-8 flex items-center gap-4 px-4">
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">YOUR WORKSPACES</span>
          <div className="h-[1px] flex-1 bg-slate-200" />
        </div>

        {/* Grid Content */}
        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-[3.5rem] bg-white border border-slate-200 animate-pulse shadow-sm" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed border-slate-200 bg-white py-32 text-center transition-all">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-indigo-50 text-indigo-200">
              <LayoutGrid size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-950">No workspaces yet</h3>
            <p className="mt-4 text-slate-500 max-w-sm font-medium">Ready to start your first collaborative brainstorm?</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((memberRow) => {
              const ws = memberRow.workspaces
              if (!ws) return null

              return (
                <button
                  key={ws.id}
                  onClick={() => handleWorkspaceClick(ws.id)}
                  className="group relative flex flex-col overflow-hidden rounded-[3.5rem] border border-slate-200 bg-white p-10 text-left transition-all duration-500 hover:-translate-y-3 hover:border-indigo-600/30 hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.1)] active:scale-[0.98]"
                >
                  <div className="mb-10 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all duration-500">
                      <Users size={20} className="text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <span className="rounded-full bg-slate-100 border border-slate-200 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:bg-indigo-50 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                      {memberRow.role}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-3xl font-black tracking-tight text-slate-950 group-hover:text-indigo-600 transition-all duration-500">
                      {ws.name}
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Calendar size={12} />
                      Opened {new Date(ws.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="mt-12 flex items-center justify-between">
                    <div className="flex -space-x-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-10 w-10 rounded-full border-[3px] border-white bg-slate-100" />
                      ))}
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white transition-all duration-500 group-hover:bg-indigo-600 group-hover:scale-110 shadow-xl">
                      <ArrowRight size={20} strokeWidth={3} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
