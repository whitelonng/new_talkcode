/**
 * RecentProjectsService Tests
 *
 * Uses real database operations with in-memory SQLite for accurate testing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestDatabaseAdapter } from '@/test/infrastructure/adapters/test-database-adapter';
import { mockLogger } from '@/test/mocks';

vi.mock('@/lib/logger', () => mockLogger);

import { RecentProjectsService } from './recent-projects-service';

describe('RecentProjectsService', () => {
  let db: TestDatabaseAdapter;
  let recentProjectsService: RecentProjectsService;

  const PROJECT_1 = {
    id: 'project-1',
    name: 'Project One',
    rootPath: '/Users/test/project1',
  };

  const PROJECT_2 = {
    id: 'project-2',
    name: 'Project Two',
    rootPath: '/Users/test/project2',
  };

  const PROJECT_3 = {
    id: 'project-3',
    name: 'Project Three',
    rootPath: '/Users/test/project3',
  };

  beforeEach(() => {
    db = new TestDatabaseAdapter();
    recentProjectsService = new RecentProjectsService(db.getTursoClientAdapter());
  });

  afterEach(() => {
    db.close();
  });

  describe('trackProjectOpened', () => {
    it('should add a new recent project', async () => {
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );

      const projects = await recentProjectsService.getRecentProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_id).toBe(PROJECT_1.id);
      expect(projects[0]?.project_name).toBe(PROJECT_1.name);
      expect(projects[0]?.root_path).toBe(PROJECT_1.rootPath);
    });

    it('should update opened_at if project already exists', async () => {
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );
      const firstProjects = await recentProjectsService.getRecentProjects();
      const firstTimestamp = firstProjects[0]?.opened_at;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 20));

      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );
      const secondProjects = await recentProjectsService.getRecentProjects();

      expect(secondProjects).toHaveLength(1);
      expect(secondProjects[0]?.opened_at).toBeGreaterThan(firstTimestamp ?? 0);
    });

    it('should update project name when reopened', async () => {
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        'Old Name',
        PROJECT_1.rootPath
      );

      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        'New Name',
        PROJECT_1.rootPath
      );

      const projects = await recentProjectsService.getRecentProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_name).toBe('New Name');
    });

    it('should update root path when reopened', async () => {
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        '/old/path'
      );

      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        '/new/path'
      );

      const projects = await recentProjectsService.getRecentProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]?.root_path).toBe('/new/path');
    });

    it('should move reopened project to the top of the list', async () => {
      // Open projects in sequence: project1, project2, project3
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recentProjectsService.trackProjectOpened(
        PROJECT_2.id,
        PROJECT_2.name,
        PROJECT_2.rootPath
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recentProjectsService.trackProjectOpened(
        PROJECT_3.id,
        PROJECT_3.name,
        PROJECT_3.rootPath
      );

      // Verify initial order: project3, project2, project1
      const initialProjects = await recentProjectsService.getRecentProjects();
      expect(initialProjects[0]?.project_id).toBe(PROJECT_3.id);
      expect(initialProjects[1]?.project_id).toBe(PROJECT_2.id);
      expect(initialProjects[2]?.project_id).toBe(PROJECT_1.id);

      // Reopen project1 (which was opened first)
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );

      // Verify project1 is now at the top: project1, project3, project2
      const afterReopenProjects = await recentProjectsService.getRecentProjects();
      expect(afterReopenProjects).toHaveLength(3);
      expect(afterReopenProjects[0]?.project_id).toBe(PROJECT_1.id);
      expect(afterReopenProjects[1]?.project_id).toBe(PROJECT_3.id);
      expect(afterReopenProjects[2]?.project_id).toBe(PROJECT_2.id);
    });

    it('should cleanup old entries when exceeding max limit', async () => {
      // Add 12 projects with small delays to ensure different timestamps
      for (let i = 1; i <= 12; i++) {
        await recentProjectsService.trackProjectOpened(
          `project-${i}`,
          `Project ${i}`,
          `/path/to/project${i}`
        );
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      const projects = await recentProjectsService.getRecentProjects(20); // Request more than limit

      // Should keep only 10 most recent projects (MAX_RECENT_PROJECTS)
      expect(projects.length).toBeLessThanOrEqual(10);

      // The most recent projects (10, 11, 12) should be present
      const projectIds = projects.map((p) => p.project_id);
      expect(projectIds).toContain('project-12');
      expect(projectIds).toContain('project-11');
      expect(projectIds).toContain('project-10');

      // The oldest projects (project-1, project-2) should have been removed
      expect(projectIds).not.toContain('project-1');
      expect(projectIds).not.toContain('project-2');
    });
  });

  describe('getRecentProjects', () => {
    beforeEach(async () => {
      // Add some test projects
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );
      await new Promise((resolve) => setTimeout(resolve, 5));
      await recentProjectsService.trackProjectOpened(
        PROJECT_2.id,
        PROJECT_2.name,
        PROJECT_2.rootPath
      );
      await new Promise((resolve) => setTimeout(resolve, 5));
      await recentProjectsService.trackProjectOpened(
        PROJECT_3.id,
        PROJECT_3.name,
        PROJECT_3.rootPath
      );
    });

    it('should return projects ordered by most recently opened', async () => {
      const projects = await recentProjectsService.getRecentProjects();

      expect(projects).toHaveLength(3);
      // Most recent first
      expect(projects[0]?.project_id).toBe(PROJECT_3.id);
      expect(projects[1]?.project_id).toBe(PROJECT_2.id);
      expect(projects[2]?.project_id).toBe(PROJECT_1.id);
    });

    it('should respect limit parameter', async () => {
      const projects = await recentProjectsService.getRecentProjects(2);

      expect(projects).toHaveLength(2);
      expect(projects[0]?.project_id).toBe(PROJECT_3.id);
      expect(projects[1]?.project_id).toBe(PROJECT_2.id);
    });

    it('should use default limit of 5', async () => {
      // Add more projects
      for (let i = 4; i <= 8; i++) {
        await recentProjectsService.trackProjectOpened(
          `project-${i}`,
          `Project ${i}`,
          `/path/to/project${i}`
        );
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      const projects = await recentProjectsService.getRecentProjects();

      // Default limit is 5
      expect(projects).toHaveLength(5);
    });

    it('should not exceed max limit of 10', async () => {
      const projects = await recentProjectsService.getRecentProjects(100);

      // Should cap at 10 even if we request more
      expect(projects.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no projects tracked', async () => {
      await recentProjectsService.clearRecentProjects();
      const projects = await recentProjectsService.getRecentProjects();

      expect(projects).toHaveLength(0);
    });
  });

  describe('removeProject', () => {
    beforeEach(async () => {
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );
      await recentProjectsService.trackProjectOpened(
        PROJECT_2.id,
        PROJECT_2.name,
        PROJECT_2.rootPath
      );
    });

    it('should remove a specific project from recent list', async () => {
      await recentProjectsService.removeProject(PROJECT_1.id);

      const projects = await recentProjectsService.getRecentProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_id).toBe(PROJECT_2.id);
    });

    it('should handle removing non-existent project', async () => {
      // Should not throw when removing non-existent project
      await recentProjectsService.removeProject('non-existent-id');

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(2);
    });
  });

  describe('clearRecentProjects', () => {
    beforeEach(async () => {
      await recentProjectsService.trackProjectOpened(
        PROJECT_1.id,
        PROJECT_1.name,
        PROJECT_1.rootPath
      );
      await recentProjectsService.trackProjectOpened(
        PROJECT_2.id,
        PROJECT_2.name,
        PROJECT_2.rootPath
      );
    });

    it('should clear all recent projects', async () => {
      await recentProjectsService.clearRecentProjects();

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(0);
    });

    it('should handle clearing empty list', async () => {
      await recentProjectsService.clearRecentProjects();

      // Should not throw when clearing again
      await recentProjectsService.clearRecentProjects();

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(0);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent project additions', async () => {
      await Promise.all([
        recentProjectsService.trackProjectOpened(
          PROJECT_1.id,
          PROJECT_1.name,
          PROJECT_1.rootPath
        ),
        recentProjectsService.trackProjectOpened(
          PROJECT_2.id,
          PROJECT_2.name,
          PROJECT_2.rootPath
        ),
        recentProjectsService.trackProjectOpened(
          PROJECT_3.id,
          PROJECT_3.name,
          PROJECT_3.rootPath
        ),
      ]);

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(3);
    });

    it('should handle concurrent additions of same project (UNIQUE constraint)', async () => {
      // This tests the UNIQUE constraint handling when multiple concurrent calls
      // try to insert the same project
      await Promise.all([
        recentProjectsService.trackProjectOpened(
          PROJECT_1.id,
          PROJECT_1.name,
          PROJECT_1.rootPath
        ),
        recentProjectsService.trackProjectOpened(
          PROJECT_1.id,
          PROJECT_1.name,
          PROJECT_1.rootPath
        ),
        recentProjectsService.trackProjectOpened(
          PROJECT_1.id,
          PROJECT_1.name,
          PROJECT_1.rootPath
        ),
      ]);

      const projects = await recentProjectsService.getRecentProjects();
      // Should still have only 1 entry due to UNIQUE constraint
      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_id).toBe(PROJECT_1.id);
    });
  });

  describe('Edge cases', () => {
    it('should handle project with special characters in name', async () => {
      const specialProject = {
        id: 'special-project',
        name: "Project's \"Name\" with <special> & characters",
        rootPath: '/path/with spaces/and "quotes"',
      };

      await recentProjectsService.trackProjectOpened(
        specialProject.id,
        specialProject.name,
        specialProject.rootPath
      );

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_name).toBe(specialProject.name);
      expect(projects[0]?.root_path).toBe(specialProject.rootPath);
    });

    it('should handle empty project name', async () => {
      await recentProjectsService.trackProjectOpened('empty-name', '', '/path/to/project');

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_name).toBe('');
    });

    it('should handle very long project names', async () => {
      const longName = 'A'.repeat(1000);

      await recentProjectsService.trackProjectOpened('long-name', longName, '/path/to/project');

      const projects = await recentProjectsService.getRecentProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.project_name).toBe(longName);
    });
  });
});
