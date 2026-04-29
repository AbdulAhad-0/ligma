import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Mail, Sparkles, ShieldCheck, Zap, ArrowRight } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (signInError) {
      setError(signInError.message)
    } else {
      setMessage('A secure magic link has been dispatched to your inbox.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 selection:bg-indigo-100 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-700">
        {/* Logo Section */}
        <div className="mb-12 text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-indigo-600 shadow-2xl shadow-indigo-200 mb-8 mx-auto ring-8 ring-indigo-50">
            <Zap size={36} className="text-white fill-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-indigo-600">WORKSPACE PORTAL</p>
          <h1 className="mt-4 text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">LIGMA.AI</h1>
        </div>

        {/* Login Card */}
        <div className="overflow-hidden rounded-[4rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-indigo-100/50 backdrop-blur-xl">
          <div className="rounded-[3.5rem] bg-slate-50/50 p-10 sm:p-14">
            <div className="mb-10">
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">Access Terminal</h2>
              <p className="mt-2 text-slate-500 font-medium leading-relaxed">Enter your email to receive a secure, one-time synchronization link.</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                    <Mail size={22} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@neural.link"
                    className="w-full rounded-[2rem] border-2 border-slate-100 bg-white py-5 pl-16 pr-8 text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-600/30 focus:bg-white font-bold text-lg shadow-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center rounded-[2rem] bg-indigo-600 py-5 font-black text-white transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-indigo-200"
              >
                <span className="relative z-10 flex items-center gap-3 tracking-widest uppercase text-xs">
                  {loading ? 'DISPATCHING...' : 'DISPATCH MAGIC LINK'}
                  {!loading && <ArrowRight size={18} strokeWidth={3} />}
                </span>
              </button>
            </form>

            {message && (
              <div className="mt-10 rounded-3xl border border-indigo-100 bg-indigo-50/50 p-6 flex items-start gap-4 animate-in slide-in-from-bottom-2">
                <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-bold text-indigo-900/80 leading-relaxed">{message}</p>
              </div>
            )}

            {error && (
              <div className="mt-10 rounded-3xl border border-rose-100 bg-rose-50 p-6 flex items-start gap-4 animate-in shake">
                <div className="h-3 w-3 rounded-full bg-rose-500 mt-2 animate-pulse shrink-0" />
                <p className="text-sm font-bold text-rose-600 leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 flex items-center justify-center gap-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Created By Abdul Ahad
          </p>
          <div className="h-1 w-1 rounded-full bg-slate-300" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Secure Sync 256-bit
          </p>
        </div>
      </div>
    </div>
  )
}
