'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Check, Sparkles, Activity, Code, Lightbulb, ChevronDown, ChevronUp, AlertCircle, X, Send } from 'lucide-react'
import { useCommentStore } from '@/store/commentStore'
import { useRealtimeStore } from '@/store/realtimeStore'
import { useOverlayStore } from '@/store/overlayStore'
import { useProjectStore } from '@/store/projectStore'
import { Button } from '@/components/ui/button'
import { SessionReplay } from './SessionReplay'

const SEVERITY_STYLES: any = {
  P0: 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
  P1: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  P2: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  P3: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

const CommentCard = React.memo(({ comment, index }: { comment: any, index: number }) => {
  const [expanded, setExpanded] = useState(false)
  const [showSession, setShowSession] = useState(false)
  const resolveComment = useCommentStore(state => state.resolveComment)
  
  const isResolved = comment.status === 'resolved'
  const isAnalyzing = !comment.severity && comment.status === 'saving'

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isResolved ? 0.4 : 1, x: 0 }}
      className={`group relative m-2 p-5 rounded-3xl transition-all ${
        isResolved ? 'bg-white/[0.02] border border-white/5 opacity-40 grayscale pointer-events-none' : 'bg-[#1a1a1f] border border-white/[0.03] hover:border-white/10'
      }`}
    >
      {/* Resolved Strikethrough Effect */}
      {isResolved && (
        <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="absolute top-1/2 left-0 h-[1px] bg-white/20 z-10" />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Marker number */}
          <div className="w-6 h-6 rounded-xl bg-purple-600 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-lg shadow-purple-900/40">
            {index + 1}
          </div>
          
          {/* Severity badge or shimmer */}
          {comment.severity ? (
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${SEVERITY_STYLES[comment.severity] ?? SEVERITY_STYLES.P3}`}>
              {comment.severity}
            </span>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 border border-white/10 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <span className="text-[8px] font-black tracking-widest text-white/20 uppercase">Analyzing...</span>
            </div>
          )}

          {/* Design system violation flag */}
          {comment.session_data?.designViolations?.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 group/ds cursor-help">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">DS Violation</span>
                {/* Tooltip */}
                <div className="absolute top-10 left-0 w-64 p-3 bg-black border border-white/10 rounded-xl opacity-0 group-hover/ds:opacity-100 transition-all z-50 pointer-events-none text-[9px] text-white/60 leading-relaxed font-mono">
                    {comment.session_data.designViolations[0].message}
                </div>
            </div>
          )}
        </div>
        <span className="text-white/10 text-[9px] font-black uppercase tracking-widest mt-1">
          {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* AI summary (bold) + raw text */}
      {comment.ai_summary && (
        <h4 className="text-[11px] font-black text-white mb-1.5 tracking-tight leading-tight uppercase group-hover:text-cyan-400 transition-colors">{comment.ai_summary}</h4>
      )}
      <p className={`text-xs text-white/50 leading-relaxed ${isResolved ? 'line-through' : ''}`}>
        {comment.text}
      </p>

      {/* Selector chip */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/5">
            <Code className="w-3 h-3 text-cyan-400" />
            <code className="text-[9px] font-mono text-cyan-400/80">{comment.component_selector || '#viewport'}</code>
        </div>
        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{comment.tester_name}</span>
      </div>

      {/* Screenshot thumbnail */}
      {comment.screenshot_url && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-white/5 bg-black/20 group/img relative">
           <img
             src={comment.screenshot_url}
             alt="Element screenshot"
             className={`w-full h-20 object-cover cursor-zoom-in transition-all duration-500 ${expanded ? 'h-auto opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
             loading="lazy"
             onClick={() => setExpanded(!expanded)}
           />
           {!expanded && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 pointer-events-none transition-all">
                <span className="text-[8px] font-black text-white px-3 py-1 bg-black/50 backdrop-blur-md rounded-full tracking-widest border border-white/10">EXPAND CONTEXT</span>
           </div>}
        </div>
      )}

      {/* Suggested fix */}
      {comment.suggested_fix && (
        <div className="mt-4 p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">AI Intelligence</span>
          </div>
          <p className="text-[10px] text-white/50 italic leading-relaxed">"{comment.suggested_fix}"</p>
        </div>
      )}

      {/* Session replay toggle */}
      {comment.session_data && (
        <div className="mt-4">
          <button 
            onClick={() => setShowSession(!showSession)}
            className="flex items-center gap-2 text-[9px] font-black text-white/20 hover:text-white transition-all uppercase tracking-widest"
          >
            <Activity className="w-3.5 h-3.5" />
            {showSession ? 'Hide Narrative' : 'Replay User Narrative'}
            {showSession ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          <AnimatePresence>
            {showSession && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="pt-4">
                        <SessionReplay sessionData={comment.session_data} />
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Actions */}
      {!isResolved && (
        <div className="mt-6 flex gap-2">
            {comment.status === 'failed' && (
                <button
                    onClick={() => useCommentStore.getState().retryComment(comment.id)}
                    className="flex-1 h-9 rounded-xl bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase tracking-widest transition-all border border-rose-500/20 hover:bg-rose-500/20"
                >
                   ↻ Retry
                </button>
            )}
            <button
                onClick={() => resolveComment(comment.id)}
                className="flex-1 h-9 rounded-xl bg-white/5 hover:bg-green-500/10 text-white/20 hover:text-green-400 text-[9px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-green-500/20"
            >
                Authorize Resolution
            </button>
        </div>
      )}
    </motion.div>
  )
})

import { GitHubExportPanel } from './GitHubExportPanel'

export default function CommandCenter() {
  const { currentProject } = useProjectStore()
  const comments = useCommentStore(state => state.comments)
  const addComment = useCommentStore(state => state.addComment)
  const activeTesters = useRealtimeStore(state => state.activeTesters)
  const { pendingMarker, clearPending } = useOverlayStore()

  const [text, setText] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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

      <div className="p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tighter text-white">Command Center</h2>
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Audit Enrichment Stream</p>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-2 rounded-xl border transition-all ${isSettingsOpen ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/40' : 'bg-white/5 border-white/5 text-white/20 hover:text-white/40'}`}
        >
          <Activity className={`w-4 h-4 ${isSettingsOpen ? 'animate-spin-slow' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isSettingsOpen && currentProject && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <GitHubExportPanel projectId={currentProject.id} />
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="p-2 space-y-2">
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
