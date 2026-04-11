'use client'

import React, { Suspense, useState, useEffect } from 'react'
import Spline from '@splinetool/react-spline'
import { motion, AnimatePresence } from 'framer-motion'

export const SplineBackground = () => {
    const [isLoading, setIsLoading] = useState(true)

    return (
        <div className="fixed inset-0 w-full h-full -z-10 bg-[#0A0A0C] pointer-events-none">
            <Suspense fallback={null}>
                <Spline 
                    scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" 
                    onLoad={() => setIsLoading(false)}
                />
            </Suspense>
            
            {/* Loading Overlay with Backdrop Blur */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div 
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="absolute inset-0 z-20 bg-[#0A0A0C] flex items-center justify-center"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                className="w-12 h-12 border-2 border-white/5 border-t-purple-500 rounded-full"
                            />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Spatial Canvas 0.1</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Ambient vignette for depth */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/40 pointer-events-none" />
        </div>
    )
}
