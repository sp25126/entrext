'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Target, MousePointer2 } from 'lucide-react'

interface MarkerProps {
  number: number
  x: number
  y: number
  isActive?: boolean
  onClick?: () => void
  selector?: string
  isSaved?: boolean
}

export const Marker = ({ number, x, y, isActive, onClick, selector, isSaved }: MarkerProps) => {
  return (
    <motion.div
        className="absolute z-40 pointer-events-auto cursor-pointer group"
        initial={{ scale: 0.5, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
        style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)'
        }}
        onClick={onClick}
    >
        {/* Infinite Pulsing Outer Ring */}
        <motion.div 
            animate={{ scale: [1, 1.5], opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className={cn(
                "absolute inset-0 rounded-full border",
                isSaved ? "border-purple-500/50" : "border-cyan-500/50"
            )}
        />

        {/* The Precise Targeting Node */}
        <div 
            className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black bg-black border-2 transition-all duration-300 relative z-10",
                isActive 
                    ? "border-pink-500 shadow-[0_0_15px_rgba(255,0,127,0.4)]" 
                    : isSaved 
                        ? "border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                        : "border-[#00f0ff] group-hover:border-purple-500 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
            )}
        >
            <span className={cn(
                "text-white drop-shadow-sm font-mono",
                isSaved && "text-purple-300"
            )}>{number}</span>
        </div>

        {/* High-Tech Selector Tooltip */}
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                whileHover={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 p-3 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 flex items-center gap-2 shadow-2xl"
            >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#00f0ff]" />
                <span className="text-[10px] font-mono tracking-widest text-[#888899] uppercase">Target ID:</span>
                <span className="text-[10px] font-mono text-cyan-400 truncate max-w-[200px]">
                    {selector || 'viewport_origin'}
                </span>
            </motion.div>
        </AnimatePresence>
        
        {/* Focus Glow for Active Node */}
        {isActive && (
            <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -inset-6 bg-cyan-500/10 blur-3xl rounded-full -z-10"
            />
        )}
    </motion.div>
  )
}
