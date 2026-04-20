'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'

type Mode = 'signin' | 'signup' | 'magic'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  
  const { signInWithEmail, signInWithGoogle, sendMagicLink, signUp, loading } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/projects'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'magic') {
        await sendMagicLink(email)
        setMagicSent(true)
        return
      }
      if (mode === 'signup') {
        await signUp(email, password, name)
      } else {
        await signInWithEmail(email, password)
      }
      router.push(redirect)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (magicSent) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-white text-xl font-bold mb-2">Check your email</h2>
          <p className="text-white/50">Magic link sent to <span className="text-purple-400">{email}</span></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-white font-mono text-2xl font-bold tracking-widest uppercase">ENTREXT</div>
          <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em] mt-1 italic">Developer Perception Platform</div>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/5">
          {(['signin', 'signup', 'magic'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all ${
                mode === m ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-white/40 hover:text-white/60 font-bold'
              }`}>
              {m === 'signin' ? 'Sign In' : m === 'signup' ? 'Sign Up' : 'Magic Link'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Full Name" required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-white/10"
            />
          )}

          <input value={email} onChange={e => setEmail(e.target.value)}
            type="email" placeholder="Email Address" required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-white/10"
          />

          {mode !== 'magic' && (
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" placeholder="Account Password"
              required={mode !== 'magic'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-white/10"
            />
          )}

          {error && <p className="text-rose-400 text-[11px] font-bold text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full h-12 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-purple-900/20">
            {loading ? 'Processing...' : mode === 'magic' ? 'Send Link' : mode === 'signup' ? 'Create Base' : 'Authorize Session'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-white/10 text-[9px] font-black uppercase tracking-widest">or continue with</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <button onClick={() => signInWithGoogle()}
          className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Cloud ID
        </button>
      </motion.div>
    </div>
  )
}
