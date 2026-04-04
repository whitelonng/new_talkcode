/**
 * ProjectService Tests with Real Database
 *
 * Tests ProjectService with real SQLite database operations
 * instead of mocks, providing more reliable integration testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectService } from './project-service';
import { TestDatabaseAdapter } from '@/test/infrastructure/adapters/test-database-adapter';
import { mockLogger } from '@/test/mocks';

vi.mock('@/lib/logger', () => mockLogger);

vi.mock('@/lib/timer', () => ({
  timedMethod: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
    descriptor,
}));

describe('ProjectService with Real Database', () => {
  let db: TestDatabaseAdapter;
  let projectService: ProjectService;

  beforeEach(() => {
    // Create a real in-memory database for each test
    db = new TestDatabaseAdapter({ enableLogging: false });
    projectService = new ProjectService(db.getTursoClientAdapter());
  });

  afterEach(() => {
    db.close();
  });

  describe('createProject', () => {
    it('should create a project and persist to database', async () => {
      const name = 'Test Project';
      const description = 'Test Description';

      const projectId = await projectService.createProject({ name, description });

      expect(projectId).toBeDefined();

      // Verify the project was actually inserted into the database
      const rows = db.rawQuery<{ id: string; name: string; description: string }>(
        'SELECT id, name, description FROM projects WHERE id = ?',
        [projectId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(projectId);
      expect(rows[0]?.name).toBe(name);
      expect(rows[0]?.description).toBe(description);
    });

    it('should set correct timestamps on creation', async () => {
      const before = Date.now();
      const projectId = await projectService.createProject({ name: 'Timestamp Test' });
      const after = Date.now();

      const rows = db.rawQuery<{ created_at: number; updated_at: number }>(
        'SELECT created_at, updated_at FROM projects WHERE id = ?',
        [projectId]
      );

      expect(rows[0]?.created_at).toBeGreaterThanOrEqual(before);
      expect(rows[0]?.created_at).toBeLessThanOrEqual(after);
      expect(rows[0]?.updated_at).toBe(rows[0]?.created_at);
    });

    it('should store context and rules if provided', async () => {
      const context = 'Project context';
      const rules = 'Project rules';
      const projectId = await projectService.createProject({
        name: 'Full Project',
        context,
        rules,
      });

      const rows = db.rawQuery<{ context: string; rules: string }>(
        'SELECT context, rules FROM projects WHERE id = ?',
        [projectId]
      );

      expect(rows[0]?.context).toBe(context);
      expect(rows[0]?.rules).toBe(rules);
    });

    it('should store root_path if provided', async () => {
      const rootPath = '/path/to/repo';
      const projectId = await projectService.createProject({
        name: 'Repo Project',
        root_path: rootPath,
      });

      const rows = db.rawQuery<{ root_path: string }>(
        'SELECT root_path FROM projects WHERE id = ?',
        [projectId]
      );

      expect(rows[0]?.root_path).toBe(rootPath);
    });
  });

  describe('getProjects', () => {
    it('should return all projects including default', async () => {
      await projectService.createProject({ name: 'Project 1' });
      await projectService.createProject({ name: 'Project 2' });

      const projects = await projectService.getProjects();

      // Default project + 2 new ones
      expect(projects.length).toBeGreaterThanOrEqual(3);
    });

    it('should return projects ordered by updated_at DESC', async () => {
      const id1 = await projectService.createProject({ name: 'Older' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const id2 = await projectService.createProject({ name: 'Newer' });

      const projects = await projectService.getProjects();

      const idx1 = projects.findIndex((p) => p.id === id1);
      const idx2 = projects.findIndex((p) => p.id === id2);

      expect(idx2).toBeLessThan(idx1);
    });
  });

  describe('getProject', () => {
    it('should return a project by ID', async () => {
      const projectId = await projectService.createProject({ name: 'Find Me' });

      const project = await projectService.getProject(projectId);

      expect(project.id).toBe(projectId);
      expect(project.name).toBe('Find Me');
    });

    it('should throw error for non-existent project', async () => {
      await expect(projectService.getProject('non-existent')).rejects.toThrow();
    });
  });

  describe('updateProject', () => {
    it('should update project name', async () => {
      const projectId = await projectService.createProject({ name: 'Old Name' });

      await projectService.updateProject(projectId, { name: 'New Name' });

      const project = await projectService.getProject(projectId);
      expect(project.name).toBe('New Name');
    });

    it('should update project description', async () => {
      const projectId = await projectService.createProject({
        name: 'Project',
        description: 'Old Desc',
      });

      await projectService.updateProject(projectId, { description: 'New Desc' });

      const project = await projectService.getProject(projectId);
      expect(project.description).toBe('New Desc');
    });

    it('should update multiple fields at once', async () => {
      const projectId = await projectService.createProject({ name: 'Old', context: 'Old' });

      await projectService.updateProject(projectId, { name: 'New', context: 'New' });

      const project = await projectService.getProject(projectId);
      expect(project.name).toBe('New');
      expect(project.context).toBe('New');
    });

    it('should update updated_at timestamp', async () => {
      const projectId = await projectService.createProject({ name: 'Project' });
      const firstUpdate = (await projectService.getProject(projectId)).updated_at;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await projectService.updateProject(projectId, { name: 'Updated' });

      const secondUpdate = (await projectService.getProject(projectId)).updated_at;
      expect(secondUpdate).toBeGreaterThan(firstUpdate);
    });

    it('should do nothing if no fields to update', async () => {
      const projectId = await projectService.createProject({ name: 'Project' });
      const before = (await projectService.getProject(projectId)).updated_at;

      await projectService.updateProject(projectId, {});

      const after = (await projectService.getProject(projectId)).updated_at;
      expect(after).toBe(before);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const projectId = await projectService.createProject({ name: 'To Delete' });

      await projectService.deleteProject(projectId);

      await expect(projectService.getProject(projectId)).rejects.toThrow();
    });

    it('should throw error when deleting default project', async () => {
      await expect(projectService.deleteProject('default')).rejects.toThrow();
    });

    it('should move conversations to default project when deleting', async () => {
      const projectId = await projectService.createProject({ name: 'Project with tasks' });

      // Add a conversation to this project using raw SQL (since we don't have TaskService here)
      db.rawExecute(
        'INSERT INTO conversations (id, title, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['conv-1', 'Test Conversation', projectId, Date.now(), Date.now()]
      );

      await projectService.deleteProject(projectId);

      const rows = db.rawQuery<{ project_id: string }>(
        'SELECT project_id FROM conversations WHERE id = ?',
        ['conv-1']
      );
      expect(rows[0]?.project_id).toBe('default');
    });
  });

  describe('getProjectStats', () => {
    it('should return task count for project', async () => {
      const projectId = await projectService.createProject({ name: 'Stats Project' });

      db.rawExecute(
        'INSERT INTO conversations (id, title, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['c1', 'T1', projectId, Date.now(), Date.now()]
      );
      db.rawExecute(
        'INSERT INTO conversations (id, title, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['c2', 'T2', projectId, Date.now(), Date.now()]
      );

      const stats = await projectService.getProjectStats(projectId);
      expect(stats.taskCount).toBe(2);
    });

    it('should return 0 for project with no tasks', async () => {
      const projectId = await projectService.createProject({ name: 'Empty Project' });
      const stats = await projectService.getProjectStats(projectId);
      expect(stats.taskCount).toBe(0);
    });
  });

  describe('getProjectByRootPath', () => {
    it('should find project by root path', async () => {
      const rootPath = '/path/to/my/repo';
      const projectId = await projectService.createProject({ name: 'Repo', root_path: rootPath });

      const project = await projectService.getProjectByRootPath(rootPath);
      expect(project?.id).toBe(projectId);
    });

    it('should find project with legacy unnormalized root path', async () => {
      const legacyPath = 'C:\\Users\\dev\\legacy-repo\\';
      db.rawExecute(
        'INSERT INTO projects (id, name, description, created_at, updated_at, context, rules, root_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['legacy-1', 'Legacy', '', Date.now(), Date.now(), '', '', legacyPath]
      );

      const project = await projectService.getProjectByRootPath('C:/Users/dev/legacy-repo');
      expect(project?.id).toBe('legacy-1');
    });

    it('should return null for non-existent root path', async () => {
      const project = await projectService.getProjectByRootPath('/non/existent');
      expect(project).toBeNull();
    });
  });

  describe('createOrGetProjectForRepository', () => {
    it('should return existing project if root path matches', async () => {
      const rootPath = '/existing/repo/';
      const projectId = await projectService.createProject({
        name: 'Existing',
        root_path: '/existing/repo',
      });

      const project = await projectService.createOrGetProjectForRepository(rootPath);
      expect(project.id).toBe(projectId);
    });

    it('should normalize and store root_path without trailing separator', async () => {
      const rootPath = '/new/repo/';
      const project = await projectService.createOrGetProjectForRepository(rootPath);

      expect(project.root_path).toBe('/new/repo');
      expect(project.name).toBe('repo');
    });

    it('should extract repo name from path', async () => {
      const project = await projectService.createOrGetProjectForRepository('/a/b/my-repo');
      expect(project.name).toBe('my-repo');
    });

    it('should extract repo name from Windows-style path', async () => {
      const rootPath = 'C:\\Users\\dev\\my-repo';
      const project = await projectService.createOrGetProjectForRepository(rootPath);

      expect(project.root_path).toBe('C:/Users/dev/my-repo');
      expect(project.name).toBe('my-repo');
    });

    it('should extract repo name from mixed separators', async () => {
      const rootPath = 'C:/Users/dev\\mixed-repo';
      const project = await projectService.createOrGetProjectForRepository(rootPath);

      expect(project.root_path).toBe('C:/Users/dev/mixed-repo');
      expect(project.name).toBe('mixed-repo');
    });

    it('should handle trailing separators', async () => {
      const windowsRoot = 'C:\\Users\\dev\\trail-repo\\';
      const unixRoot = '/Users/dev/trail-repo/';

      const windowsProject = await projectService.createOrGetProjectForRepository(windowsRoot);
      const unixProject = await projectService.createOrGetProjectForRepository(unixRoot);

      expect(windowsProject.root_path).toBe('C:/Users/dev/trail-repo');
      expect(unixProject.root_path).toBe('/Users/dev/trail-repo');
      expect(windowsProject.name).toBe('trail-repo');
      expect(unixProject.name).toBe('trail-repo');
    });
  });

  describe('clearRepositoryPath', () => {
    it('should clear the root_path of a project', async () => {
      const projectId = await projectService.createProject({
        name: 'Repo',
        root_path: '/some/path',
      });

      await projectService.clearRepositoryPath(projectId);

      const project = await projectService.getProject(projectId);
      expect(project.root_path).toBeNull();
    });

    it('should be able to clear root_path using updateProject with null', async () => {
      const projectId = await projectService.createProject({
        name: 'Repo',
        root_path: '/some/path',
      });

      await projectService.updateProject(projectId, { root_path: null as any });

      const project = await projectService.getProject(projectId);
      expect(project.root_path).toBeNull();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent project creations', async () => {
      const results = await Promise.all([
        projectService.createProject({ name: 'P1' }),
        projectService.createProject({ name: 'P2' }),
        projectService.createProject({ name: 'P3' }),
      ]);

      expect(new Set(results).size).toBe(3);
      const all = await projectService.getProjects();
      expect(all.length).toBeGreaterThanOrEqual(4); // 3 + default
    });
  });
});
