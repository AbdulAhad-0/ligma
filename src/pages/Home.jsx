import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'

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
    return profile?.username || user?.email || 'User'
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between gap-4 rounded-[2rem] border border-slate-200/80 bg-white/80 px-5 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-700">LIGMA</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Your workspaces</h1>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <div className="font-medium text-slate-900">{displayName}</div>
              <div className="text-slate-500">{user?.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Workspace dashboard</h2>
            <p className="text-sm text-slate-500">Open an existing workspace or create a new one.</p>
          </div>

          <button
            onClick={() => setShowCreateForm((value) => !value)}
            className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
          >
            Create Workspace
          </button>
        </div>

        {showCreateForm ? (
          <form
            onSubmit={handleCreateWorkspace}
            className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Workspace name</span>
              <input
                type="text"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="New product launch"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-slate-500 shadow-sm">
            No workspaces yet. Create your first workspace to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((memberRow) => {
              const workspace = memberRow.workspaces
              if (!workspace) {
                return null
              }

              return (
                <button
                  key={`${workspace.id}-${memberRow.role}`}
                  onClick={() => handleWorkspaceClick(workspace.id)}
                  className="group rounded-[2rem] border border-slate-200 bg-white p-5 text-left shadow-[0_16px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_20px_60px_rgba(6,182,212,0.12)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{workspace.name}</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        Created {new Date(workspace.created_at).toLocaleString()}
                      </p>
                    </div>

                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                      {memberRow.role}
                    </span>
                  </div>

                  <div className="mt-5 text-sm font-medium text-cyan-700 transition group-hover:text-cyan-600">
                    Open workspace →
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
