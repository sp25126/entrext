'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, ShareLink, ShareLinkCreate } from '@/lib/api'

type Role = 'tester' | 'reviewer' | 'viewer'

interface SharePanelProps {
  projectId: string
  onClose: () => void
}

const ROLE_STYLES: Record<Role, string> = {
  tester:   'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  reviewer: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  viewer:   'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

const ROLE_LABELS: Record<Role, string> = {
  tester: '✏️ Tester', reviewer: '🔍 Reviewer', viewer: '👁 Viewer'
}

export function SharePanel({ projectId, onClose }: SharePanelProps) {
  const [links, setLinks]       = useState<ShareLink[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied]     = useState<string | null>(null)

  const [form, setForm] = useState({
    label: '',
    role: 'tester' as Role,
    expires_in_days: '',
    max_uses: '',
    password: '',
  })

  // ── Load links ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.shareLinks.list(projectId)
      setLinks(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[SharePanel] Failed to load links:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // ── Create link ─────────────────────────────────────────────────────────────
  const createLink = async () => {
    setCreating(true)
    setError('')
    try {
      const payload: ShareLinkCreate = {
        label: form.label.trim() || 'Shared Link',
        role: form.role,
      }
      if (form.expires_in_days) payload.expires_in_days = parseInt(form.expires_in_days)
      if (form.max_uses)        payload.max_uses        = parseInt(form.max_uses)
      if (form.password)        payload.password        = form.password

      const newLink = await api.shareLinks.create(projectId, payload)
      setLinks(prev => [newLink, ...prev])
      setForm({ label: '', role: 'tester', expires_in_days: '', max_uses: '', password: '' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[SharePanel] Failed to create link:', msg)
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  // ── Revoke link ─────────────────────────────────────────────────────────────
  const revokeLink = async (linkId: string) => {
    try {
      await api.shareLinks.revoke(projectId, linkId)
      setLinks(prev => prev.map(l =>
        l.id === linkId ? { ...l, is_active: false } : l
      ))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not revoke link')
    }
  }

  // ── Copy URL ────────────────────────────────────────────────────────────────
  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0f0f14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm tracking-wide uppercase tracking-widest text-[10px] font-black opacity-60">Share & Access Control</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Error State */}
        {error && (
            <div className="px-5 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-[10px] font-bold text-center uppercase tracking-widest">
                {error}
            </div>
        )}

        {/* Create form */}
        <div className="p-5 border-b border-white/10 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
              placeholder="Label — e.g. QA Team, Client Review"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
            
            <div className="col-span-2 flex gap-2">
              {(['tester', 'reviewer', 'viewer'] as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, role: r })}
                  className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${
                    form.role === r 
                      ? 'bg-purple-600 border-purple-500 text-white' 
                      : 'bg-white/5 border-white/5 text-white/20 hover:bg-white/10'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest px-1">Expires (Days)</span>
                <input
                    type="number"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/10 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                    placeholder="None"
                    value={form.expires_in_days}
                    onChange={e => setForm({ ...form, expires_in_days: e.target.value })}
                />
            </div>
            
            <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest px-1">Max Uses</span>
                <input
                    type="number"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/10 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                    placeholder="∞"
                    value={form.max_uses}
                    onChange={e => setForm({ ...form, max_uses: e.target.value })}
                />
            </div>
          </div>

          <button
            onClick={createLink}
            disabled={creating}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
          >
            {creating ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : 'Generate Access Token'}
          </button>
        </div>

        {/* Links list */}
        <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="text-center py-10 opacity-20 animate-pulse text-[10px] font-black uppercase tracking-widest">Hydrating links...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-10 opacity-10 text-[10px] font-black uppercase tracking-widest italic">No active access tokens</div>
          ) : (
            links.map(link => (
              <div 
                key={link.id}
                className={`p-4 rounded-2xl border transition-all ${
                  link.is_active ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' : 'bg-black/40 border-white/5 opacity-50 grayscale'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-black text-white/90 uppercase tracking-tight">{link.label}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase ${ROLE_STYLES[link.role]}`}>
                        {link.role}
                      </span>
                      {link.expires_at && (
                        <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest italic">
                          Exp: {new Date(link.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {link.is_active && (
                    <button
                      onClick={() => revokeLink(link.id)}
                      className="text-[8px] font-black text-rose-500/40 hover:text-rose-500 uppercase tracking-widest transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between group/code">
                    <code className="text-[10px] font-mono text-cyan-400 truncate pr-2">{link.share_url}</code>
                    <button
                      onClick={() => copyUrl(link.share_url, link.id)}
                      className="text-[9px] font-black text-white/20 hover:text-cyan-400 uppercase tracking-widest"
                    >
                      {copied === link.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
