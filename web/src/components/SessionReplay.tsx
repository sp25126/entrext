'use client'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface SessionEvent {
  type: 'CLICK' | 'SCROLL' | 'RAGE_CLICK' | 'HESITATION'
  t: number
  selector?: string
  x?: number
  y?: number
  count?: number
  duration?: number
}

interface SessionData {
  events: SessionEvent[]
  rageClicks: SessionEvent[]
  hesitations: SessionEvent[]
  totalEvents: number
}

const EVENT_COLORS = {
  CLICK: '#a855f7',
  SCROLL: '#06b6d4',
  RAGE_CLICK: '#ef4444',
  HESITATION: '#f59e0b',
}

const EVENT_EMOJI = {
  CLICK: '👆',
  SCROLL: '↕',
  RAGE_CLICK: '🔥',
  HESITATION: '⏸',
}

export function SessionReplay({ sessionData }: { sessionData: SessionData | null }) {
  const [activeEvent, setActiveEvent] = useState<SessionEvent | null>(null)

  if (!sessionData || !sessionData.events?.length) {
    return (
      <div className="text-white/30 text-xs text-center py-4 px-2 bg-white/5 rounded-xl border border-white/5 mx-2 my-1">
        No session data recorded
      </div>
    )
  }

  const { events, rageClicks, hesitations } = sessionData
  const start = events[0]?.t ?? 0
  const end = events[events.length - 1]?.t ?? 1
  const duration = end - start

  const formatTime = (ms: number) => {
    const s = Math.floor((ms - start) / 1000)
    return `${s}s`
  }

  return (
    <div className="p-4 space-y-4 bg-white/5 rounded-2xl border border-white/5 mx-2 my-1">
      {/* Stats bar */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
          <span className="text-[10px] text-rose-400 font-black uppercase">🔥 {rageClicks.length} Rage</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-[10px] text-yellow-400 font-black uppercase">⏸ {hesitations.length} Hesitations</span>
        </div>
        <div className="flex-1" />
        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">⏱ {Math.floor(duration / 1000)}s Session</span>
      </div>

      {/* Timeline scrubber */}
      <div className="relative h-12 bg-black/40 rounded-xl overflow-hidden border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-cyan-500/5" />
        
        {events.map((event, i) => {
          const pos = duration > 0 ? ((event.t - start) / duration) * 100 : 0
          const color = EVENT_COLORS[event.type] ?? '#ffffff'
          
          return (
            <motion.button
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full cursor-pointer z-10 transition-shadow hover:shadow-[0_0_8px_currentColor]"
              style={{
                left: `${pos}%`,
                width: event.type === 'RAGE_CLICK' ? 14 : 7,
                height: event.type === 'RAGE_CLICK' ? 14 : 7,
                backgroundColor: color,
                color: color
              }}
              whileHover={{ scale: 2.5, zIndex: 20 }}
              onClick={() => setActiveEvent(event)}
              title={`${EVENT_EMOJI[event.type]} ${event.type} @ ${formatTime(event.t)}`}
            />
          )
        })}

        {/* Floating Scrubber Line */}
        {activeEvent && (
            <motion.div 
               layoutId="scrubber"
               className="absolute top-0 bottom-0 w-px bg-white/40 z-0"
               style={{ left: `${((activeEvent.t - start) / duration) * 100}%` }}
            />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {Object.entries(EVENT_EMOJI).map(([type, emoji]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: EVENT_COLORS[type as keyof typeof EVENT_COLORS] }} />
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest leading-none mt-0.5">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Active event detail */}
      <div className="min-h-[64px]">
        {activeEvent ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] rounded-xl p-3 border border-white/5 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm">{EVENT_EMOJI[activeEvent.type]}</span>
                    <div>
                        <div className="text-[10px] font-black text-white uppercase tracking-widest" style={{ color: EVENT_COLORS[activeEvent.type] }}>
                            {activeEvent.type}
                        </div>
                        <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-0.5">Time: {formatTime(activeEvent.t)}</div>
                    </div>
                </div>
            </div>

            {activeEvent.selector && (
                <div className="mt-2 flex items-center gap-2 px-2 py-1 rounded bg-black/20 border border-white/5">
                    <span className="text-[8px] font-black text-white/20 uppercase">Selector</span>
                    <code className="text-[9px] font-mono text-cyan-400/80 truncate">{activeEvent.selector}</code>
                </div>
            )}
            
            {(activeEvent.count || activeEvent.duration) && (
                <div className="mt-2 text-[10px] font-bold text-white/60">
                    {activeEvent.count && <span className="text-rose-400">Repeated {activeEvent.count}× in rapid sequence</span>}
                    {activeEvent.duration && <span className="text-yellow-400">Interaction lasted {activeEvent.duration}ms</span>}
                </div>
            )}
          </motion.div>
        ) : (
             <div className="h-full flex items-center justify-center border-2 border-dashed border-white/[0.02] rounded-xl px-4 py-3">
                <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">Select an event to replay intelligence</p>
             </div>
        )}
      </div>
    </div>
  )
}
