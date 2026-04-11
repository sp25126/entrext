'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Check, Sparkles, Activity, Code, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { useCommentStore } from '@/store/commentStore'
import { useRealtimeStore } from '@/store/realtimeStore'
import { useOverlayStore } from '@/store/overlayStore'
import { useProjectStore } from '@/store/projectStore'
import { Button } from '@/components/ui/button'
import { X, Send } from 'lucide-react'

const SeverityBadge = ({ severity, isAnalyzing }: { severity?: string, isAnalyzing?: boolean }) => {
  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 animate-pulse">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        <span className="text-[8px] font-black tracking-widest text-white/20 uppercase">Analyzing...</span>
      </div>
    )
  }
  
  const colors: any = {
    P0: 'bg-rose-500 shadow-[0_0_12px_#f43f5e]',
    P1: 'bg-orange-500 shadow-[0_0_12px_#f97316]',
    P2: 'bg-yellow-500 shadow-[0_0_12px_#eab308]',
    P3: 'bg-slate-500 shadow-[0_0_12px_#64748b]'
  }
  
  return (
    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-widest ${colors[severity || 'P3']}`}>
      {severity || 'P3'}
    </div>
  )
}

const CommentCard = React.memo(({ comment, index }: { comment: any, index: number }) => {
  const [showFix, setShowFix] = useState(false)
  const resolveComment = useCommentStore(state => state.resolveComment)
  
  const isAnalyzing = !comment.severity && comment.status === 'saving';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group relative m-2 p-5 rounded-2xl bg-[#1a1a1f] border border-white/[0.03] transition-all hover:border-white/10 ${comment.status === 'resolved' ? 'opacity-40 grayscale pointer-events-none' : ''}`}
    >
      {/* Resolved Strikethrough Effect */}
      {comment.status === 'resolved' && (
        <motion.div initial={{ width: 0 }} animate={{ width: '100% '}} className="absolute top-1/2 left-0 h-[2px] bg-white/20 z-10" />
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
           <SeverityBadge severity={comment.severity} isAnalyzing={isAnalyzing} />
           <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
              <Code className="w-3 h-3 text-cyan-400" />
              <code className="text-[9px] font-mono text-cyan-400/80">{comment.component_selector || '#viewport'}</code>
           </div>
        </div>
        <span className="text-[9px] font-black text-white/10 tracking-widest">#{index + 1}</span>
      </div>

      {comment.ai_summary && (
        <p className="text-[11px] font-black text-white mb-1 tracking-tight leading-tight">{comment.ai_summary}</p>
      )}
      <p className="text-xs text-white/50 mb-3 leading-relaxed">{comment.text}</p>

      {comment.screenshot_url && (
        <div className="mb-3 rounded-xl overflow-hidden border border-white/5 bg-black/20 group-hover:border-white/20 transition-all">
           <img 
             src={comment.screenshot_url} 
             loading="lazy" 
             className="w-full h-20 object-cover opacity-60 hover:h-auto hover:opacity-100 transition-all duration-500 cursor-zoom-in" 
           />
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
         <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
               <Activity className="w-3 h-3 text-white/20" />
            </div>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{comment.author_name}</span>
         </div>
         
         <div className="flex items-center gap-2">
           {comment.suggested_fix && (
             <button 
               onClick={() => setShowFix(!showFix)}
               className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
             >
               <Lightbulb className="w-3.5 h-3.5" />
             </button>
           )}
           <button 
             onClick={() => resolveComment(comment.id)}
             className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all font-black text-[9px] tracking-widest"
           >
             RESOLVE
           </button>
         </div>
      </div>

      <AnimatePresence>
        {showFix && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10"
          >
            <p className="text-[10px] text-cyan-400/80 italic">" {comment.suggested_fix} "</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default function CommandCenter() {
  const { currentProject } = useProjectStore()
  const comments = useCommentStore(state => state.comments)
  const addComment = useCommentStore(state => state.addComment)
  const activeTesters = useRealtimeStore(state => state.activeTesters)
  const { pendingMarker, clearPending } = useOverlayStore()

  const [text, setText] = useState('')
  const [testerName, setTesterName] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('tester_name') ?? '' : ''
  )

  const handleSave = async () => {
    if (!text.trim() || !pendingMarker || !currentProject) return

    if (!localStorage.getItem('tester_name') && testerName) {
      localStorage.setItem('tester_name', testerName)
    }

    await addComment({
      project_id: currentProject.id,
      text: text.trim(),
      component_selector: pendingMarker.selector,
      page_url: currentProject.target_url,
      tester_name: testerName || 'Anonymous',
      screenshot_url: pendingMarker.screenshot ?? '',
      x: pendingMarker.x,
      y: pendingMarker.y,
      markerId: pendingMarker.id,
    })

    setText('')
    clearPending()
  }

  const sortedComments = useMemo(() => {
    const severityMap: any = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return [...comments].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'resolved' ? 1 : -1;
      const sevA = severityMap[a.severity || 'P3'] ?? 4;
      const sevB = severityMap[b.severity || 'P3'] ?? 4;
      return sevA - sevB;
    });
  }, [comments]);

  return (
    <motion.div className="fixed right-8 top-24 w-96 h-[calc(100vh-160px)] flex flex-col bg-[#121216]/95 backdrop-blur-3xl border border-white/5 rounded-[32px] z-50 shadow-2xl overflow-hidden">
      {/* Presence Bar */}
      <div className="px-6 py-3 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.02]">
         <div className="flex -space-x-2">
            <AnimatePresence>
              {activeTesters.map((t) => (
                <motion.div 
                   key={t.tester_id}
                   initial={{ scale: 0, x: -10 }}
                   animate={{ scale: 1, x: 0 }}
                   exit={{ scale: 0, x: 10 }}
                   className="w-6 h-6 rounded-full bg-cyan-500 border-2 border-[#121216] flex items-center justify-center text-[10px] font-black text-black group relative"
                >
                  {t.tester_name ? t.tester_name[0] : '?'}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black rounded text-[8px] opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-50">
                    {t.tester_name}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
         </div>
         <div className="flex items-center gap-1.5 p-1 px-2 rounded-full bg-cyan-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#06b6d4]" />
            <span className="text-[9px] font-black text-cyan-400 tracking-tighter uppercase">Live Network: {activeTesters.length}</span>
         </div>
      </div>

      <div className="p-6">
        <h2 className="text-xl font-black tracking-tighter text-white">Command Center</h2>
        <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Audit Enrichment Stream</p>
      </div>

      <AnimatePresence>
        {pendingMarker && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 pb-6 border-b border-white/[0.03] space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
                <Code className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] font-mono text-purple-400 font-bold">{pendingMarker.selector}</span>
              </div>
              <button onClick={clearPending} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-4 h-4 text-white/20" />
              </button>
            </div>

            {pendingMarker.screenshot && (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 h-24">
                <img src={pendingMarker.screenshot} className="w-full h-full object-cover opacity-80" alt="Captured context" />
              </div>
            )}

            {!localStorage.getItem('tester_name') && (
              <input
                placeholder="Audit Signature (Your Name)"
                value={testerName}
                onChange={e => setTesterName(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/10 focus:border-purple-500/50 outline-none transition-all"
              />
            )}

            <div className="relative">
              <textarea
                placeholder="Describe the issue or improvement..."
                value={text}
                onChange={e => setText(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/10 focus:border-purple-500/50 outline-none transition-all resize-none min-h-[100px]"
              />
              <button 
                onClick={handleSave}
                disabled={!text.trim()}
                className="absolute bottom-3 right-3 p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-lg transition-all shadow-xl shadow-purple-900/20"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
         {sortedComments.length > 0 ? (
           <div className="p-2">
             {sortedComments.map((comment, index) => (
               <CommentCard key={comment.id} comment={comment} index={index} />
             ))}
           </div>
         ) : (
           <div className="flex flex-col items-center justify-center h-full opacity-20 filter grayscale">
              <Sparkles className="w-12 h-12 mb-4" />
              <p className="text-[10px] font-black tracking-widest uppercase">Awaiting Audits</p>
           </div>
         )}
      </div>
    </motion.div>
  )
}
