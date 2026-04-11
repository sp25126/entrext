'use client';

import { motion } from 'framer-motion';

export default function SampleTarget() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 animate-pulse" />
          <span className="font-bold text-xl tracking-tight">FinFlow.io</span>
        </div>
        <div className="flex gap-6 text-sm font-medium text-slate-500">
          <span className="hover:text-indigo-600 cursor-pointer transition-colors">Dashboard</span>
          <span className="hover:text-indigo-600 cursor-pointer transition-colors">Reports</span>
          <span className="hover:text-indigo-600 cursor-pointer transition-colors">Settings</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto">
        <header className="mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-slate-900 mb-4"
          >
            Annual Performance Overview
          </motion.h1>
          <p className="text-slate-500 max-w-lg">
            Track your financial growth and project milestones in real-time. 
            All data is synchronized with your accounts.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 mb-4 group-hover:bg-indigo-50 transition-colors" />
              <div className="h-4 w-24 bg-slate-100 rounded mb-2 group-hover:bg-indigo-100 transition-colors" />
              <div className="h-6 w-32 bg-slate-200 rounded group-hover:bg-indigo-200 transition-colors" />
            </div>
          ))}
        </div>

        <section className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900 mb-6">Revenue Growth</h2>
          <div className="h-64 w-full bg-slate-50 rounded-xl flex items-end justify-between px-8 py-4 gap-2">
            {[40, 70, 45, 90, 65, 80, 50, 85].map((h, i) => (
              <motion.div 
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 1, delay: i * 0.1 }}
                className="w-full bg-indigo-600/20 rounded-t-lg relative group cursor-pointer hover:bg-indigo-600/40 transition-colors"
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  ${h * 123}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      
      <footer className="mt-20 pt-12 border-t border-slate-200 flex justify-between items-center text-slate-400 text-sm">
        <span>© 2024 FinFlow analytics platform</span>
        <div className="flex gap-4">
          <span className="hover:text-slate-600 cursor-pointer">Privacy</span>
          <span className="hover:text-slate-600 cursor-pointer">Terms</span>
        </div>
      </footer>
    </div>
  );
}
