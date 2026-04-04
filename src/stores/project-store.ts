import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { databaseService } from '@/services/database-service';
import type { Project } from '@/types';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface ProjectStore extends ProjectState {
  loadProjects: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  getRecentProjects: () => Project[];
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,
  isInitialized: false,

  loadProjects: async () => {
    const { isInitialized, isLoading } = get();
    if (isInitialized || isLoading) return;

    try {
      set({ isLoading: true, error: null });
      const projects = await databaseService.getProjects();
      set({ projects, isLoading: false, isInitialized: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load projects';
      logger.error('Failed to load projects:', errorMessage);
      set({ error: errorMessage, isLoading: false, isInitialized: true });
    }
  },

  deleteProject: async (id: string) => {
    try {
      await databaseService.deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }));
      logger.info(`Deleted project ${id} from store`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete project';
      logger.error(`Failed to delete project ${id}:`, errorMessage);
      set({ error: errorMessage });
      throw error;
    }
  },

  refreshProjects: async () => {
    try {
      set({ isLoading: true, error: null });
      const projects = await databaseService.getProjects();
      set({ projects, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh projects';
      logger.error('Failed to refresh projects:', errorMessage);
      set({ error: errorMessage, isLoading: false });
    }
  },

  getRecentProjects: () => {
    return [...get().projects].sort((a, b) => b.updated_at - a.updated_at);
  },
}));
