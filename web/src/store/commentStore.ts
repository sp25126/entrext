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
  updateTriage: (commentId: string, triage: Partial<Comment>) => void
  addFromRemote: (comment: Comment) => void
  retryComment: (tempId: string) => Promise<void>
  submitting: Set<string>
}

export const useCommentStore = create<CommentStore>((set, get) => ({
  comments: [],
  isLoading: false,
  error: null,
  submitting: new Set(),
  
  updateTriage: (commentId, triage) => set(state => ({
    comments: state.comments.map(c => c.id === commentId ? { ...c, ...triage } : c)
  })),

  addFromRemote: (comment) => set(state => {
    // Don't add duplicates (might already be added via optimistic update)
    if (state.comments.find(c => c.id === comment.id)) return state
    return { comments: [...state.comments, comment] }
  }),
  
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
    const { submitting } = get()
    if (submitting.has(payload.markerId)) {
      console.warn('[Entrext] Duplicate submission blocked')
      return
    }

    set(state => ({ submitting: new Set([...state.submitting, payload.markerId]) }))
    const { markerId, ...body } = payload
    
    // Optimistic: add immediately with temp id
    const tempId = markerId // Using markerId as tempId for retry context
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
      const os = useOverlayStore.getState()
      if (os.failMarker) os.failMarker(markerId)
    } finally {
      set(state => {
        const next = new Set(state.submitting)
        next.delete(payload.markerId)
        return { submitting: next }
      })
    }
  },

  retryComment: async (tempId: string) => {
    const comment = get().comments.find(c => c.id === tempId)
    if (!comment) return

    set(state => ({
      comments: state.comments.map(c => c.id === tempId ? { ...c, status: 'saving' as any } : c)
    }))

    try {
      const { markerId, status, id, ...body } = comment as any
      const saved = await api.createComment(body) as Comment
      set(state => ({
        comments: state.comments.map(c => c.id === tempId ? saved : c)
      }))
    } catch {
      set(state => ({
        comments: state.comments.map(c => c.id === tempId ? { ...c, status: 'failed' as any } : c)
      }))
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
