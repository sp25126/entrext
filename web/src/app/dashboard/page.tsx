'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Project } from '@/lib/api-contracts'
import { Plus, MessageSquare, ExternalLink, Share2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

import { useProjectStore } from '@/store/projectStore'

export default function Dashboard() {
  const [copiedId, setCopiedId] = useState<string|null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchProjects = useProjectStore((state) => state.fetchProjects)
  const projects = useProjectStore((state) => state.projects)
  const isLoading = useProjectStore((state) => state.isLoading)

  useEffect(() => {
    fetchProjects()
  }, [])

  const copyShareLink = (token: string, id: string) => {
    const url = `${window.location.origin}/test/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-['Inter']">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40 tracking-tight">Dashboard</h1>
            <p className="text-white/40 text-sm">Interactive feedback engine is live for all projects.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
                variant="outline" 
                onClick={() => router.push('/')}
                className="rounded-full border-white/5 bg-white/5 hover:bg-white/10"
            >
                Portfolio
            </Button>
            <Button 
                onClick={() => router.push('/projects/new')}
                className="rounded-full bg-purple-600 hover:bg-purple-500 font-bold px-6 shadow-xl shadow-purple-900/20 transition-all hover:scale-[1.02]"
            >
                <Plus className="w-4 h-4 mr-2" />
                New Project
            </Button>
          </div>
        </div>

        {/* Project List */}
        <div className="grid grid-cols-1 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className="group relative bg-white/[0.02] border border-white/5 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8 hover:bg-white/[0.04] hover:border-purple-500/20 transition-all duration-500"
            >
              <div className="flex items-center gap-6 min-w-0 flex-1">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shrink-0 border border-white/5">
                   <MessageSquare className="w-8 h-8 opacity-40" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black tracking-tight text-white mb-1 truncate group-hover:text-purple-400 transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/20">
                    <span className="truncate max-w-[200px]">{project.target_url}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-12 shrink-0">
                <div className="flex flex-col gap-1 items-end">
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">ENGINE STATUS</span>
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
                      <span className="text-xs font-bold text-white/60">ACTIVE</span>
                   </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="h-10 px-6 rounded-full font-black text-[10px] tracking-widest uppercase hover:bg-white/10 transition-all"
                    onClick={() => router.push(`/project/${project.id}`)}
                  >
                    Review
                  </Button>
                  <Button 
                    variant="vibrant"
                    size="sm"
                    className={`h-10 px-6 rounded-full font-black text-[10px] tracking-widest uppercase transition-all ${
                        copiedId === project.id ? 'opacity-50' : ''
                    }`}
                    onClick={() => project.share_token && copyShareLink(project.share_token, project.id)}
                  >
                    {copiedId === project.id ? 'Copied' : 'Share'}
                  </Button>
                </div>
              </div>
              
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px] pointer-events-none" />
            </div>
          ))}

          {projects.length === 0 && (
            <div 
              onClick={() => router.push('/projects/new')}
              className="h-80 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-6 hover:border-purple-500/30 hover:bg-purple-500/[0.02] cursor-pointer transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-white/5">
                <Plus className="w-8 h-8 text-white/20" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-black text-xl text-white/40 tracking-tight">Zero Sessions</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/10">Initialize your first project</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 pointer-events-none">
        Entrext Beta • Phase 2 Secure Environment
      </div>
    </div>
  )
}
