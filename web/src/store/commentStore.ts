import { create } from 'zustand'
import { api } from '@/lib/api'

export interface Comment {
  id: string
  project_id: string
  text: string
  component_selector: string
  page_url?: string
  tester_name: string
  screenshot_url?: string
  severity?: 'P0' | 'P1' | 'P2' | 'P3'
  x: number
  y: number
  status: 'open' | 'resolved'
  created_at: string
}

interface CommentStore {
  comments: Comment[]
  isLoading: boolean
  error: any | null
  fetchComments: (projectId: string) => Promise<void>
  addComment: (payload: {
    project_id: string
    text: string
    component_selector: string
    page_url: string
    tester_name: string
    screenshot_url: string
    x: number
    y: number
    markerId: string        // for confirming the overlay marker
  }) => Promise<void>
  resolveComment: (commentId: string) => Promise<void>
}

export const useCommentStore = create<CommentStore>((set, get) => ({
  comments: [],
  isLoading: false,
  error: null,
  
  fetchComments: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.getComments(projectId) as Comment[]
      set({ comments: data })
    } catch (err: any) {
      set({ error: err })
    } finally {
      set({ isLoading: false })
    }
  },
  
  addComment: async (payload) => {
    const { markerId, ...body } = payload
    
    // Optimistic: add immediately with temp id
    const tempId = `temp_${Date.now()}`
    const optimistic: Comment = {
      id: tempId, 
      status: 'open', 
      created_at: new Date().toISOString(), 
      ...body
    }
    
    set(state => ({ comments: [...state.comments, optimistic] }))
    
    try {
      const saved = await api.createComment(body) as Comment
      
      // Replace temp with real
      set(state => ({
        comments: state.comments.map(c => c.id === tempId ? saved : c)
      }))
      
      // Confirm the marker turns purple/saved
      const { useOverlayStore } = await import('./overlayStore')
      useOverlayStore.getState().confirmMarker(markerId)
      
    } catch (err: any) {
      console.error('Failed to save comment:', err)
      
      // Mark as failed — keep it visible so user can retry
      set(state => ({
        comments: state.comments.map(c => c.id === tempId ? { ...c, status: 'failed' as any } : c)
      }))
      
      const { useOverlayStore } = await import('./overlayStore')
      useOverlayStore.getState().failMarker(markerId)
    }
  },
  
  resolveComment: async (commentId) => {
    set(state => ({
      comments: state.comments.map(c => c.id === commentId ? { ...c, status: 'resolved' } : c)
    }))
    try {
      await api.resolveComment(commentId)
    } catch (err: any) {
      console.error('Failed to resolve comment:', err)
      // Rollback or handle error
    }
  },
}))
