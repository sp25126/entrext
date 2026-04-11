import { create } from 'zustand';

interface Tester {
  tester_id: string;
  tester_name: string;
}

interface RealtimeState {
  isConnected: boolean;
  activeTesters: Tester[];
  cursors: Record<string, { x: number; y: number; name: string }>;
  
  setConnected: (connected: boolean) => void;
  setActiveTesters: (testers: Tester[]) => void;
  updateCursor: (testerId: string, x: number, y: number, name: string) => void;
  removeCursor: (testerId: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  isConnected: false,
  activeTesters: [],
  cursors: {},
  
  setConnected: (isConnected) => set({ isConnected }),
  setActiveTesters: (testers) => set({ activeTesters: testers }),
  updateCursor: (testerId, x, y, name) => set((state) => ({
    cursors: {
      ...state.cursors,
      [testerId]: { x, y, name }
    }
  })),
  removeCursor: (testerId) => set((state) => {
    const newCursors = { ...state.cursors };
    delete newCursors[testerId];
    return { cursors: newCursors };
  }),
}));
