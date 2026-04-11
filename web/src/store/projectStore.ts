import { create } from 'zustand';
import { Project, CreateProjectInput } from '../lib/api-contracts';
import { api } from '../lib/api';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: any | null;
  
  fetchProjects: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  setCurrentProject: (project) => set({ currentProject: project }),
  clearError: () => set({ error: null }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.listProjects();
      set({ projects: data, isLoading: false });
    } catch (err: any) {
      set({ error: err, isLoading: false });
    }
  },

  createProject: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const project = await api.createProject(input);
      set({ 
        projects: [project, ...get().projects],
        currentProject: project,
        isLoading: false 
      });
      return project;
    } catch (err: any) {
      set({ error: err, isLoading: false });
      throw err;
    }
  }
}));
