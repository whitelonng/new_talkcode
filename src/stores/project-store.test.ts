import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/types';
import { useProjectStore } from './project-store';

vi.mock('@/services/database-service', () => ({
  databaseService: {
    getProjects: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'test-id',
  name: 'Test Project',
  description: '',
  created_at: Date.now(),
  updated_at: Date.now(),
  context: '',
  rules: '',
  ...overrides,
});

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      isLoading: false,
      error: null,
      isInitialized: false,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with default state', () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('loadProjects', () => {
    it('should load projects from database', async () => {
      const { databaseService } = await import('@/services/database-service');
      const mockProjects = [
        createMockProject({ id: '1', name: 'Project 1' }),
        createMockProject({ id: '2', name: 'Project 2' }),
      ];
      vi.mocked(databaseService.getProjects).mockResolvedValue(mockProjects);

      await useProjectStore.getState().loadProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should not reload if already initialized', async () => {
      const { databaseService } = await import('@/services/database-service');
      vi.mocked(databaseService.getProjects).mockResolvedValue([]);

      useProjectStore.setState({ isInitialized: true });

      await useProjectStore.getState().loadProjects();

      expect(databaseService.getProjects).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const { databaseService } = await import('@/services/database-service');
      vi.mocked(databaseService.getProjects).mockRejectedValue(new Error('Database error'));

      await useProjectStore.getState().loadProjects();

      const state = useProjectStore.getState();
      expect(state.error).toBe('Database error');
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('deleteProject', () => {
    it('should remove project from state after delete', async () => {
      const { databaseService } = await import('@/services/database-service');
      vi.mocked(databaseService.deleteProject).mockResolvedValue(undefined);

      useProjectStore.setState({
        projects: [
          createMockProject({ id: '1', name: 'Project 1', updated_at: 1 }),
          createMockProject({ id: '2', name: 'Project 2', updated_at: 2 }),
        ],
        isInitialized: true,
      });

      await useProjectStore.getState().deleteProject('1');

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('2');
    });

    it('should call databaseService.deleteProject', async () => {
      const { databaseService } = await import('@/services/database-service');
      vi.mocked(databaseService.deleteProject).mockResolvedValue(undefined);

      useProjectStore.setState({
        projects: [createMockProject({ id: '1' })],
        isInitialized: true,
      });

      await useProjectStore.getState().deleteProject('1');

      expect(databaseService.deleteProject).toHaveBeenCalledWith('1');
    });

    it('should throw error on failure', async () => {
      const { databaseService } = await import('@/services/database-service');
      vi.mocked(databaseService.deleteProject).mockRejectedValue(new Error('Delete failed'));

      useProjectStore.setState({
        projects: [createMockProject({ id: '1' })],
        isInitialized: true,
      });

      await expect(useProjectStore.getState().deleteProject('1')).rejects.toThrow('Delete failed');

      const state = useProjectStore.getState();
      expect(state.error).toBe('Delete failed');
      // Projects should not be modified on error
      expect(state.projects).toHaveLength(1);
    });
  });

  describe('refreshProjects', () => {
    it('should reload projects even if initialized', async () => {
      const { databaseService } = await import('@/services/database-service');
      const newProjects = [createMockProject({ id: 'new', name: 'New Project' })];
      vi.mocked(databaseService.getProjects).mockResolvedValue(newProjects);

      useProjectStore.setState({
        projects: [createMockProject({ id: 'old', name: 'Old Project' })],
        isInitialized: true,
      });

      await useProjectStore.getState().refreshProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('new');
    });
  });

  describe('getRecentProjects', () => {
    it('should return projects sorted by updated_at descending', () => {
      useProjectStore.setState({
        projects: [
          createMockProject({ id: '1', name: 'Old', updated_at: 100 }),
          createMockProject({ id: '2', name: 'New', updated_at: 300 }),
          createMockProject({ id: '3', name: 'Mid', updated_at: 200 }),
        ],
        isInitialized: true,
      });

      const recent = useProjectStore.getState().getRecentProjects();
      expect(recent[0].id).toBe('2');
      expect(recent[1].id).toBe('3');
      expect(recent[2].id).toBe('1');
    });

    it('should return empty array when no projects', () => {
      const recent = useProjectStore.getState().getRecentProjects();
      expect(recent).toEqual([]);
    });

    it('should not mutate original projects array', () => {
      const projects = [
        createMockProject({ id: '1', updated_at: 100 }),
        createMockProject({ id: '2', updated_at: 200 }),
      ];
      useProjectStore.setState({ projects, isInitialized: true });

      useProjectStore.getState().getRecentProjects();

      // Original order should be preserved
      const state = useProjectStore.getState();
      expect(state.projects[0].id).toBe('1');
      expect(state.projects[1].id).toBe('2');
    });
  });

  describe('project sync after import', () => {
    it('should show newly imported project after refreshProjects', async () => {
      const { databaseService } = await import('@/services/database-service');

      // Initial state: only default project
      const initialProjects = [createMockProject({ id: 'default', name: 'Default Project' })];
      vi.mocked(databaseService.getProjects).mockResolvedValue(initialProjects);

      await useProjectStore.getState().loadProjects();

      let state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('default');

      // After import: new project added
      const updatedProjects = [
        createMockProject({ id: 'default', name: 'Default Project' }),
        createMockProject({ id: 'new-project', name: 'docs', root_path: '/Users/test/docs' }),
      ];
      vi.mocked(databaseService.getProjects).mockResolvedValue(updatedProjects);

      await useProjectStore.getState().refreshProjects();

      state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.projects.find((p) => p.id === 'new-project')).toBeDefined();
      expect(state.projects.find((p) => p.name === 'docs')).toBeDefined();
    });

    it('should update projects list immediately after delete without needing refresh', async () => {
      const { databaseService } = await import('@/services/database-service');
      vi.mocked(databaseService.deleteProject).mockResolvedValue(undefined);

      // Initial state: multiple projects
      useProjectStore.setState({
        projects: [
          createMockProject({ id: 'proj-1', name: 'Project 1' }),
          createMockProject({ id: 'proj-2', name: 'Project 2' }),
          createMockProject({ id: 'proj-3', name: 'Project 3' }),
        ],
        isInitialized: true,
      });

      // Delete project 2
      await useProjectStore.getState().deleteProject('proj-2');

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.projects.find((p) => p.id === 'proj-2')).toBeUndefined();
      expect(state.projects.find((p) => p.id === 'proj-1')).toBeDefined();
      expect(state.projects.find((p) => p.id === 'proj-3')).toBeDefined();
    });

    it('should sync across multiple refreshProjects calls', async () => {
      const { databaseService } = await import('@/services/database-service');

      // Simulate project being added then deleted
      vi.mocked(databaseService.getProjects).mockResolvedValue([
        createMockProject({ id: '1', name: 'Project 1' }),
      ]);

      await useProjectStore.getState().refreshProjects();
      expect(useProjectStore.getState().projects).toHaveLength(1);

      // Project added externally
      vi.mocked(databaseService.getProjects).mockResolvedValue([
        createMockProject({ id: '1', name: 'Project 1' }),
        createMockProject({ id: '2', name: 'Project 2' }),
      ]);

      await useProjectStore.getState().refreshProjects();
      expect(useProjectStore.getState().projects).toHaveLength(2);

      // Project deleted externally
      vi.mocked(databaseService.getProjects).mockResolvedValue([
        createMockProject({ id: '1', name: 'Project 1' }),
      ]);

      await useProjectStore.getState().refreshProjects();
      expect(useProjectStore.getState().projects).toHaveLength(1);
    });
  });
});
