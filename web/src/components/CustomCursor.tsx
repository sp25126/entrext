'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export const CustomCursor = () => {
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)
    
    // Dot Physics (Fast)
    const dotX = useSpring(mouseX, { stiffness: 800, damping: 35, mass: 0.5 })
    const dotY = useSpring(mouseY, { stiffness: 800, damping: 35, mass: 0.5 })
    
    // Ring Physics (Lagging)
    const ringX = useSpring(mouseX, { stiffness: 400, damping: 28 })
    const ringY = useSpring(mouseY, { stiffness: 400, damping: 28 })
    
    const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null)
    const [isPointer, setIsPointer] = useState(false)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX)
            mouseY.set(e.clientY)
        }

        const handleMouseOver = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('button, a, .magnetic') as HTMLElement
            if (target) {
                setHoveredRect(target.getBoundingClientRect())
                setIsPointer(true)
            } else {
                setHoveredRect(null)
                setIsPointer(false)
            }
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseover', handleMouseOver)
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseover', handleMouseOver)
        }
    }, [mouseX, mouseY])

    const ringVariants = {
        default: {
            width: 32,
            height: 32,
            borderRadius: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            x: -16,
            y: -16,
        },
        magnetic: {
            width: hoveredRect?.width ? hoveredRect.width + 12 : 32,
            height: hoveredRect?.height ? hoveredRect.height + 12 : 32,
            borderRadius: hoveredRect ? getComputedStyle(document.activeElement || document.body).borderRadius || '12px' : '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            x: hoveredRect ? -((hoveredRect.width + 12) / 2) : -16,
            y: hoveredRect ? -((hoveredRect.height + 12) / 2) : -16,
        }
    }

    // Actual coordinates for the ring when magnetic
    const targetX = hoveredRect ? hoveredRect.left + hoveredRect.width / 2 : ringX
    const targetY = hoveredRect ? hoveredRect.top + hoveredRect.height / 2 : ringY

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
            {/* The Fast Dot */}
            <motion.div 
                style={{ x: dotX, y: dotY, translateX: '-50%', translateY: '-50%' }}
                className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_2px_rgba(255,255,255,0.4)]"
            />
            
            {/* The Magnetic Ring */}
            <motion.div 
                animate={hoveredRect ? 'magnetic' : 'default'}
                variants={ringVariants}
                style={{ 
                    x: hoveredRect ? hoveredRect.left + hoveredRect.width / 2 : ringX, 
                    y: hoveredRect ? hoveredRect.top + hoveredRect.height / 2 : ringY,
                    translateX: hoveredRect ? -((hoveredRect.width + 12) / 2) : -16,
                    translateY: hoveredRect ? -((hoveredRect.height + 12) / 2) : -16,
                }}
                transition={{ type: "spring", stiffness: 450, damping: 25, mass: 1 }}
                className="absolute transition-colors duration-300"
            />

            {/* Glowing Flare on click */}
            <motion.div 
                style={{ x: dotX, y: dotY, translateX: '-50%', translateY: '-50%' }}
                className="w-20 h-20 bg-purple-500/10 blur-xl rounded-full"
            />
        </div>
    )
}
