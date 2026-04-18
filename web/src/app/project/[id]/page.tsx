'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Share2, PanelRightClose, PanelRightOpen, Code, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Marker } from '@/components/ui/Marker'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ExportPanel } from '@/components/ExportPanel'
import { DesignSystemPanel } from '@/components/DesignSystemPanel'
import { createClient } from '@/lib/supabase/client'
import { AdvancedSiteCard } from '@/components/AdvancedSiteCard'
import CommandCenter from '@/components/CommandCenter'
import { Palette } from 'lucide-react'

import { useRealtimeSync } from '@/hooks/useRealtimeSync'

export default function ProjectPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  const router = useRouter()

  // Granular Stores
  const { 
    projects, 
    currentProject, 
    fetchProjects, 
    setCurrentProject,
    isLoading: isProjectLoading, 
    error: projectError 
  } = useProjectStore()
  const { comments, fetchComments, error: commentError } = useCommentStore()
  const { activeTesters, setConnected } = useRealtimeStore()
  const { markers, pendingMarker, setMode, addMarker } = useOverlayStore()
  const { 
    isCommandCenterOpen, 
    isExportPanelOpen, 
    isDesignSystemOpen,
    toggleCommandCenter, 
    toggleExportPanel,
    toggleDesignSystem
  } = useUIStore()
  
  const [proxyStatus, setProxyStatus] = useState<'loading' | 'ok' | 'advanced' | 'failed'>('loading')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastEmitRef = useRef(0)

  // Handled by the industrial-grade sync hook
  const wsRef = useRealtimeSync(id)

  // Initial Sync
  useEffect(() => {
    if (!id) return;
    fetchProjects().then(() => {
      const allProjects = useProjectStore.getState().projects
      const found = allProjects.find(p => p.id === id)
      if (found) setCurrentProject(found)
      fetchComments(id);
    });
  }, [id, fetchProjects, fetchComments, setCurrentProject])

  // Mouse Tracking
  const handleMouseMove = (e: React.MouseEvent) => {
    const now = Date.now()
    if (now - lastEmitRef.current < 50) return // Throttled
    lastEmitRef.current = now

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
    }
  }

  // Pre-flight Proxy Verification
  useEffect(() => {
    if (!currentProject?.target_url) return
    
    const preflight = async () => {
      setProxyStatus('loading')
      try {
        const proxyUrl = `${env.apiBase}/proxy?url=${encodeURIComponent(currentProject.target_url)}`
        const res = await fetch(proxyUrl, { method: 'GET' })
        const status = res.headers.get('X-Entrext-Status') ?? 'ok'
        
        if (status === 'advanced') setProxyStatus('advanced')
        else if (status === 'timeout' || status === 'error') setProxyStatus('failed')
        else setProxyStatus('ok')
      } catch (err) {
        console.error('[PROXY_PREFLIGHT_FAILED]', err)
        setProxyStatus('failed')
      }
    }

    preflight()
  }, [currentProject?.target_url])

  // Design System Synchronization to Iframe
  useEffect(() => {
    if (!currentProject?.design_system || !iframeRef.current) return
    
    const sync = () => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'DESIGN_SYSTEM_CONFIG',
        config: currentProject.design_system
      }, '*')
    }

    // Attempt sync on load and whenever config changes
    sync()
    const frame = iframeRef.current
    frame.addEventListener('load', sync)
    return () => frame.removeEventListener('load', sync)
  }, [currentProject?.design_system])

  // Cross-Window Listener
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'FEEDBACK_CLICK') {
        const { x, y, selector, elementLabel, screenshot } = e.data
        addMarker({
          id: crypto.randomUUID(),
          x,
          y,
          selector: selector || 'unknown',
          elementLabel: elementLabel || '',
          screenshot: screenshot || null,
        })
        toggleCommandCenter(true)
      }
      
      if (e.data?.type === 'MODE_CHANGED') {
        setMode(e.data.mode)
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [addMarker, setMode, toggleCommandCenter])

  if (isProjectLoading) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0a0a0a] gap-6">
       <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
       <p className="text-white/20 text-[10px] font-black uppercase tracking-widest animate-pulse">Initializing Audit Core...</p>
    </div>
  )

  const error = projectError || commentError;
  if (error || !currentProject) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0a0a0a] gap-8 p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
           <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
           <h2 className="text-2xl font-black text-rose-500 tracking-tight uppercase">Audit Interrupted</h2>
           <p className="max-w-xs text-white/40 text-[10px] font-bold uppercase leading-relaxed tracking-widest">
              {error?.message || 'PROJECT_SYNC_FAILURE'}
           </p>
        </div>
        <Button onClick={() => router.push('/dashboard')} variant="secondary" className="rounded-xl h-12 px-10 font-black text-[10px] tracking-widest">
           RETURN TO BASE
        </Button>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-transparent overflow-hidden font-sans antialiased">
        <AnimatePresence>
          {isExportPanelOpen && currentProject && (
            <ExportPanel 
              projectId={currentProject.id} 
              projectName={currentProject.name}
              commentCount={comments.length}
              onClose={() => toggleExportPanel(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDesignSystemOpen && currentProject && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-lg"
                >
                    <button 
                        onClick={() => toggleDesignSystem(false)}
                        className="absolute -top-12 right-0 p-2 text-white/40 hover:text-white transition-all uppercase text-[10px] font-black tracking-widest flex items-center gap-2"
                    >
                        <X className="w-4 h-4" /> Close Configuration
                    </button>
                    <DesignSystemPanel 
                        projectId={currentProject.id} 
                        initialConfig={currentProject.design_system}
                        onSave={(next) => {
                            setCurrentProject({ ...currentProject, design_system: next })
                            toggleDesignSystem(false)
                        }}
                    />
                </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative border-r border-white/5 bg-white">
          {/* Header Toolbar */}
          <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none gap-4">
            <div className="flex items-center gap-3 pointer-events-auto">
               <Button onClick={() => router.push('/dashboard')} variant="secondary" className="tactile-glass h-11 px-7 shadow-2xl">
                  <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                  Audit Exit
               </Button>
               <div className="h-11 px-7 tactile-glass rounded-full flex items-center gap-3 shadow-2xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{currentProject.name}</span>
               </div>
               <div className="h-11 px-5 tactile-glass rounded-full flex items-center gap-2 shadow-2xl">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{activeTesters.length} PEERS</span>
               </div>
            </div>

            <div className="flex items-center gap-3 pointer-events-auto">
               <ThemeToggle />
               <Button 
                  variant="secondary"
                  onClick={() => toggleDesignSystem()}
                  className={`tactile-glass h-11 w-11 p-0 flex items-center justify-center transition-all ${isDesignSystemOpen ? 'bg-cyan-500 text-black shadow-[0_0_20px_#06b6d4]' : ''}`}
               >
                  <Palette className="w-4 h-4" />
               </Button>
               <Button 
                 variant="vibrant"
                 onClick={() => toggleExportPanel(true)}
                 className="h-11 px-8 shadow-2xl nexus-shadow font-black text-[10px] tracking-widest"
               >
                  <Code className="w-4 h-4 mr-2" />
                  EXPORT
               </Button>
               <Button 
                  variant="secondary"
                  onClick={() => toggleCommandCenter()}
                  className="tactile-glass h-11 w-11 p-0 flex items-center justify-center"
               >
                  {isCommandCenterOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
               </Button>
            </div>
          </div>

          <div className="w-full h-full relative flex flex-col pt-24">
             <div className="relative flex-1" onMouseMove={handleMouseMove}>
                <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                   {/* Render Persistent Markers */}
                   {markers.map((marker) => (
                      <motion.div
                        key={marker.id}
                        className="absolute pointer-events-auto cursor-pointer"
                        style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: 'translate(-50%, -50%)' }}
                        initial={{ scale: 0, y: -20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-2xl border-2 select-none transition-all",
                          marker.status === 'saved' ? "bg-purple-600 border-purple-400 text-white" : "",
                          marker.status === 'pending' ? "bg-white border-purple-500/50 text-purple-600" : "",
                          marker.status === 'failed' ? "bg-rose-600 border-rose-400 text-white" : ""
                        )}>
                          {marker.number}
                        </div>
                      </motion.div>
                   ))}
                   {pendingMarker && (
                    <Marker 
                       number={markers.length + 1}
                       x={pendingMarker.x}
                       y={pendingMarker.y}
                       isActive
                    />
                  )}
                </div>

                {proxyStatus === 'loading' && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/50 backdrop-blur-sm z-20">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-white/20 text-[9px] font-black uppercase tracking-widest animate-pulse font-mono">Verifying Audit Tunnel...</p>
                   </div>
                )}

                {proxyStatus === 'ok' && (
                  <iframe 
                    ref={iframeRef}
                    src={`${env.apiBase}/proxy?url=${encodeURIComponent(currentProject.target_url)}`} 
                    className="w-full h-full border-none relative z-0"
                    title="Audit Context"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    allow="clipboard-read; clipboard-write;"
                  />
                )}

                {(proxyStatus === 'advanced' || proxyStatus === 'failed') && (
                  <AdvancedSiteCard 
                    url={currentProject.target_url}
                    projectId={currentProject.id}
                    reason={proxyStatus}
                  />
                )}
             </div>
          </div>
        </div>

        {isCommandCenterOpen && <CommandCenter />}
      </div>
    </ErrorBoundary>
  )
}
