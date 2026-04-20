import { create } from 'zustand'

export interface Marker {
  id: string
  number: number
  x: number        // percentage of iframe width
  y: number        // percentage of iframe height
  selector: string
  xpath?: string
  tagName?: string
  innerText?: string
  pageUrl?: string
  elementLabel: string
  screenshot: string | null
  status: 'pending' | 'saved' | 'failed'
}

interface OverlayStore {
  markers: Marker[]
  pendingMarker: Marker | null
  mode: 'browse' | 'feedback'
  addMarker: (m: Omit<Marker, 'number' | 'status'>) => void
  confirmMarker: (id: string) => void
  failMarker: (id: string) => void
  clearPending: () => void
  setMode: (m: 'browse' | 'feedback') => void
}

export const useOverlayStore = create<OverlayStore>((set, get) => ({
  markers: [],
  pendingMarker: null,
  mode: 'browse',
  
  addMarker: (m) => {
    const number = get().markers.length + 1
    const marker: Marker = { ...m, number, status: 'pending' }
    set(state => ({
      markers: [...state.markers, marker],
      pendingMarker: marker,
    }))
  },
  
  confirmMarker: (id) => set(state => ({
    markers: state.markers.map(m => m.id === id ? { ...m, status: 'saved' } : m),
    pendingMarker: null,
  })),
  
  failMarker: (id) => set(state => ({
    markers: state.markers.map(m => m.id === id ? { ...m, status: 'failed' } : m),
  })),
  
  clearPending: () => set({ pendingMarker: null }),
  
  setMode: (mode) => set({ mode }),
}))
