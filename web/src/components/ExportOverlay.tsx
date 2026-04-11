'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, stagger } from 'framer-motion'
import { Copy, Check, X, Terminal, Sparkles, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportOverlayProps {
  isOpen: boolean
  onClose: () => void
  markdown: string
}

export const ExportOverlay = ({ isOpen, onClose, markdown }: ExportOverlayProps) => {
  const [copied, setCopied] = useState(false)
  const [particles, setParticles] = useState<{ id: number, x: number, y: number }[]>([])

  const lines = markdown.split('\n')

  const handleCopy = (e: React.MouseEvent) => {
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    
    // Trigger Particle Burst
    const newParticles = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: e.clientX,
      y: e.clientY
    }))
    setParticles(prev => [...prev, ...newParticles])
    
    setTimeout(() => {
        setCopied(false)
        setParticles([])
    }, 2000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 md:p-24 bg-black/60 backdrop-blur-[48px]"
        >
          {/* Particles Layer */}
          {particles.map(p => (
            <motion.div 
               key={p.id}
               initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
               animate={{ 
                 x: p.x + (Math.random() - 0.5) * 200, 
                 y: p.y + (Math.random() - 0.5) * 200, 
                 scale: 0, 
                 opacity: 0 
               }}
               transition={{ duration: 0.8, ease: "easeOut" }}
               className="fixed w-2 h-2 bg-purple-500 rounded-full pointer-events-none z-[110]"
            />
          ))}

          <motion.div 
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="w-full max-w-4xl max-h-[80vh] flex flex-col tactile-glass rounded-[40px] overflow-hidden nexus-shadow border-white/10"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/20 flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-500/10">
                   <Terminal className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Markdown Export</h2>
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Production Ready Data V1</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

            {/* Matrix Code Reveal Area */}
            <div className="flex-1 overflow-y-auto p-8 font-mono text-sm custom-scrollbar bg-black/40">
               <div className="space-y-1">
                  {lines.map((line, i) => {
                    // Highlight selectors
                    const highlightedLine = line.replace(/(`[^`]+`)/g, '<span class="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">$1</span>')
                    
                    return (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            className="flex gap-4 min-h-[1.5rem]"
                        >
                            <span className="w-8 text-white/10 text-right select-none">{i + 1}</span>
                            <span 
                                className="text-white/70 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: highlightedLine || '&nbsp;' }}
                            />
                        </motion.div>
                    )
                  })}
               </div>
            </div>

            {/* Footer / Copy Action */}
            <div className="p-8 bg-white/[0.02] border-t border-white/5 flex justify-center">
               <Button 
                    onClick={handleCopy}
                    className="h-14 px-12 group relative rounded-full bg-white text-black font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl overflow-hidden"
               >
                    <AnimatePresence mode="wait">
                        {copied ? (
                            <motion.div 
                                key="check"
                                initial={{ y: 20, opacity: 0 }} 
                                animate={{ y: 0, opacity: 1 }} 
                                exit={{ y: -20, opacity: 0 }}
                                className="flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                <span>COPIED!</span>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="copy"
                                initial={{ y: 20, opacity: 0 }} 
                                animate={{ y: 0, opacity: 1 }} 
                                exit={{ y: -20, opacity: 0 }}
                                className="flex items-center gap-2"
                            >
                                <Copy className="w-4 h-4" />
                                <span>COPY TO CLIPBOARD</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    {/* Magnetic Pull Reveal (Simulated with hover effect) */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
