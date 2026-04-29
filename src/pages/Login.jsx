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

    const redirectTo = import.meta.env.VITE_SITE_URL || window.location.origin

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (signInError) {
      setError(signInError.message)
    } else {
      setMessage('A secure magic link has been dispatched to your inbox.')
    }

    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
      }
    })
    if (googleError) setError(googleError.message)
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
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">Access Terminal</h2>
              <p className="mt-2 text-slate-500 font-medium leading-relaxed">Fast-sync into your creative workspace.</p>
            </div>

            <div className="space-y-4 mb-8">
              <button
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-4 rounded-[2rem] border-2 border-slate-100 bg-white py-4.5 font-black text-slate-900 transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg active:scale-[0.98] shadow-sm"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="tracking-widest uppercase text-[10px]">Continue with Google</span>
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-[1px] flex-1 bg-slate-200" />
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">or magic link</span>
                <div className="h-[1px] flex-1 bg-slate-200" />
              </div>
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
