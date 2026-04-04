// src/hooks/use-projects.ts
import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  type CreateProjectData,
  databaseService,
  type Project,
  type UpdateProjectData,
} from '@/services/database-service';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      logger.info('Loading projects...');
      const data = await databaseService.getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (data: CreateProjectData) => {
      try {
        await databaseService.createProject(data);
        await loadProjects(); // Refresh the list
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to create project');
      }
    },
    [loadProjects]
  );

  const updateProject = useCallback(
    async (id: string, data: UpdateProjectData) => {
      try {
        await databaseService.updateProject(id, data);
        await loadProjects(); // Refresh the list
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to update project');
      }
    },
    [loadProjects]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        await databaseService.deleteProject(id);
        await loadProjects(); // Refresh the list
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to delete project');
      }
    },
    [loadProjects]
  );

  const getProjectStats = useCallback(async (id: string) => {
    try {
      logger.info('Getting project stats for project ID:', id);
      return await databaseService.getProjectStats(id);
    } catch (err) {
      logger.error('Failed to get project stats:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to get project stats');
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    getProjectStats,
    refreshProjects: loadProjects,
  };
}
