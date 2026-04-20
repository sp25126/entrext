'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, Settings, Sparkles, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/store/projectStore'
import { ProjectCard } from '@/components/ProjectCard'
import { SharePanel } from '@/components/SharePanel'

export default function Dashboard() {
  const router = useRouter()
  const [showSharePanel, setShowSharePanel] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<any>(null)
  
  const fetchProjects = useProjectStore((state) => state.fetchProjects)
  const deleteProject = useProjectStore((state) => state.deleteProject)
  const projects = useProjectStore((state) => state.projects)
  const isLoading = useProjectStore((state) => state.isLoading)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleDelete = async () => {
    if (!projectToDelete) return
    try {
      await deleteProject(projectToDelete.id)
      setProjectToDelete(null)
    } catch (err) {
      console.error('Failed to delete project:', err)
      // Store handles rollback, we just close modal
      setProjectToDelete(null)
    }
  }

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0c]">
      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40 tracking-tight flex items-center gap-3">
              Dashboard
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 tracking-widest uppercase">Production</span>
            </h1>
            <p className="text-white/40 text-sm">Monitor stability and engagement across your project substrate.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
                variant="outline" 
                onClick={() => router.push('/settings')}
                className="w-12 h-12 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all p-0"
                title="Settings"
            >
                <Settings className="w-5 h-5 opacity-40" />
            </Button>
            <Button 
                onClick={() => router.push('/projects/new')}
                className="h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 font-bold px-8 shadow-xl shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                <Plus className="w-5 h-5 mr-2" />
                New Project
            </Button>
          </div>
        </div>

        {/* Project List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
                <ProjectCard 
                    project={project} 
                    onClick={() => router.push(`/project/${project.id}`)} 
                />
                
                {/* Custom Action Bar Substrate */}
                <div className="absolute bottom-7 right-7 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-20">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(project.target_url, '_blank');
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/60 border border-white/5 text-white/40 hover:text-cyan-400 hover:bg-black/80 transition-all backdrop-blur-md"
                        title="External Open"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSharePanel(project.id);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/60 border border-white/5 text-white/40 hover:text-purple-400 hover:bg-black/80 transition-all backdrop-blur-md"
                        title="Share & Access"
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/60 border border-white/5 text-white/40 hover:text-rose-500 hover:bg-black/80 transition-all backdrop-blur-md"
                        title="Delete Project"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div 
              onClick={() => router.push('/projects/new')}
              className="aspect-video lg:aspect-square border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-6 hover:border-purple-500/30 hover:bg-purple-500/[0.02] cursor-pointer transition-all group lg:col-span-3"
            >
              <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-white/5 shadow-inner">
                <Plus className="w-10 h-10 text-white/20" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-black text-2xl text-white/40 tracking-tight">Zero Project States</p>
                <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-white/10">Initialize your first observation</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals & Panels */}
      <AnimatePresence>
        {/* Share Panel Modal */}
        {showSharePanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-end p-6 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    className="w-full max-w-md h-full bg-[#0c0c0e] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl"
                >
                    <SharePanel 
                        projectId={showSharePanel} 
                        onClose={() => setShowSharePanel(null)} 
                    />
                </motion.div>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {projectToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-sm bg-[#0c0c0e] border border-white/10 rounded-[32px] p-8 text-center space-y-6 shadow-2xl"
                >
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-white font-black text-2xl tracking-tighter uppercase mb-2">Confirm Destruction</h3>
                        <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                            Are you sure you want to delete <span className="text-white">"{projectToDelete.name}"</span>? This action is irreversible and will purge all audit data.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setProjectToDelete(null)}
                            className="flex-1 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                            Abort
                        </button>
                        <button 
                            onClick={handleDelete}
                            className="flex-1 h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-rose-900/20"
                        >
                            Destroy
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-8 py-4 bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-full text-[10px] font-bold uppercase tracking-[0.4em] text-white/10 pointer-events-none group hover:text-white/30 transition-colors">
        Entrext OS • <span className="text-purple-500/30">Stable Release</span>
      </div>
    </div>
  )
}
