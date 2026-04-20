// src/store/projectStore.ts
import { create } from 'zustand'
import { api, Project, ProjectCreate } from '@/lib/api'

interface ProjectState {
  projects:        Project[]
  currentProject:  Project | null
  loading:         boolean
  error:           string | null
  
  fetchProjects:     () => Promise<void>
  createProject:     (input: ProjectCreate) => Promise<Project>
  deleteProject:     (id: string) => Promise<void>
  setCurrentProject: (project: Project | null) => void
  clearError:        () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects:       [],
  currentProject: null,
  loading:        false,
  error:          null,

  setCurrentProject: (project) => set({ currentProject: project }),
  clearError:        () => set({ error: null }),

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await api.projects.list()
      set({ projects, loading: false })
    } catch (err: unknown) {
      set({ 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch projects' 
      })
    }
  },

  createProject: async (input) => {
    set({ loading: true, error: null })
    try {
      const project = await api.projects.create(input)
      set(s => ({ 
        projects: [project, ...s.projects],
        currentProject: project,
        loading: false 
      }))
      return project
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create project'
      set({ loading: false, error: msg })
      throw err
    }
  },

  deleteProject: async (id) => {
    const prev = get().projects
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }))
    
    try {
      await api.projects.delete(id)
    } catch (err: unknown) {
      set({ 
        projects: prev, 
        error: err instanceof Error ? err.message : 'Failed to delete project' 
      })
      throw err
    }
  }
}))
