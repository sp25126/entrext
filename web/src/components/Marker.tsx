'use client';

import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarkerProps {
  x: number;
  y: number;
  index?: number;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Marker = ({ x, y, index, active, onClick, className }: MarkerProps) => {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0, y: -20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      whileHover={{ scale: 1.15, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={cn(
        'absolute z-50 flex items-center justify-center w-8 h-8 -ml-4 -mt-4 rounded-full border-2 transition-colors duration-200 shadow-md',
        active
          ? 'bg-indigo-600 border-white text-white scale-110 shadow-indigo-200'
          : 'bg-white border-indigo-600 text-indigo-600 hover:bg-slate-50',
        className
      )}
    >
      {index !== undefined ? (
        <span className="text-xs font-bold font-mono">{index}</span>
      ) : (
        <MessageSquare className="w-4 h-4" />
      )}
    </motion.button>
  );
};
