import { create } from 'zustand';

interface UIState {
  isCommandCenterOpen: boolean;
  isExportPanelOpen: boolean;
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  
  toggleCommandCenter: (open?: boolean) => void;
  toggleExportPanel: (open?: boolean) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandCenterOpen: true,
  isExportPanelOpen: false,
  toasts: [],
  
  toggleCommandCenter: (open) => set((state) => ({ 
    isCommandCenterOpen: open !== undefined ? open : !state.isCommandCenterOpen 
  })),
  toggleExportPanel: (open) => set((state) => ({ 
    isExportPanelOpen: open !== undefined ? open : !state.isExportPanelOpen 
  })),
  addToast: (message, type) => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({ 
      toasts: [...state.toasts, { id, message, type }] 
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => set((state) => ({ 
    toasts: state.toasts.filter(t => t.id !== id) 
  })),
}));
