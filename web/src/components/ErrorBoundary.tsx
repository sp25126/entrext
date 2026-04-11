'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL_UI_FAILURE:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-[#09090b] rounded-[32px] border border-rose-500/20 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-2">Interface Engine Failure</h2>
          <p className="text-xs text-white/40 mb-6 max-w-xs mx-auto leading-relaxed">
            The auditing engine encountered a critical render error. This has been logged for system recovery.
          </p>
          
          <div className="w-full max-w-md p-4 bg-black/40 rounded-xl border border-white/5 mb-8 text-left overflow-hidden">
             <p className="text-[10px] font-mono text-rose-400 opacity-60 break-all">
                {this.state.error?.message || 'UNKNOWN_RUNTIME_EXCEPTION'}
             </p>
          </div>

          <Button 
            onClick={() => window.location.reload()}
            className="bg-white text-black hover:bg-white/90 font-black text-[10px] tracking-widest px-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            REINITIALIZE ENGINE
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
