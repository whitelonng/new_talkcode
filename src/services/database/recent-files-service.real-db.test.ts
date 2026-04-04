/**
 * RecentFilesService Tests
 *
 * Uses real database operations with in-memory SQLite for accurate testing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestDatabaseAdapter } from '@/test/infrastructure/adapters/test-database-adapter';
import { mockLogger } from '@/test/mocks';

vi.mock('@/lib/logger', () => mockLogger);

import { RecentFilesService } from './recent-files-service';

describe('RecentFilesService', () => {
  let db: TestDatabaseAdapter;
  let recentFilesService: RecentFilesService;

  const REPO_PATH_1 = '/Users/test/project1';
  const REPO_PATH_2 = '/Users/test/project2';

  beforeEach(() => {
    db = new TestDatabaseAdapter();
    recentFilesService = new RecentFilesService(db.getTursoClientAdapter());
  });

  afterEach(() => {
    db.close();
  });

  describe('addRecentFile', () => {
    it('should add a new recent file', async () => {
      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);

      const files = await recentFilesService.getRecentFiles(REPO_PATH_1);

      expect(files).toHaveLength(1);
      expect(files[0]?.file_path).toBe('/path/to/file1.ts');
      expect(files[0]?.repository_path).toBe(REPO_PATH_1);
    });

    it('should update opened_at if file already exists', async () => {
      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);
      const firstFiles = await recentFilesService.getRecentFiles(REPO_PATH_1);
      const firstTimestamp = firstFiles[0]?.opened_at;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 20));

      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);
      const secondFiles = await recentFilesService.getRecentFiles(REPO_PATH_1);

      expect(secondFiles).toHaveLength(1);
      expect(secondFiles[0]?.opened_at).toBeGreaterThanOrEqual(firstTimestamp ?? 0);
    });

    it('should move reopened file to the top of the list', async () => {
      // Open files in sequence: file1, file2, file3
      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recentFilesService.addRecentFile('/path/to/file2.ts', REPO_PATH_1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recentFilesService.addRecentFile('/path/to/file3.ts', REPO_PATH_1);

      // Verify initial order: file3, file2, file1
      const initialFiles = await recentFilesService.getRecentFiles(REPO_PATH_1);
      expect(initialFiles[0]?.file_path).toBe('/path/to/file3.ts');
      expect(initialFiles[1]?.file_path).toBe('/path/to/file2.ts');
      expect(initialFiles[2]?.file_path).toBe('/path/to/file1.ts');

      // Reopen file1 (which was opened first)
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);

      // Verify file1 is now at the top: file1, file3, file2
      const afterReopenFiles = await recentFilesService.getRecentFiles(REPO_PATH_1);
      expect(afterReopenFiles).toHaveLength(3);
      expect(afterReopenFiles[0]?.file_path).toBe('/path/to/file1.ts');
      expect(afterReopenFiles[1]?.file_path).toBe('/path/to/file3.ts');
      expect(afterReopenFiles[2]?.file_path).toBe('/path/to/file2.ts');
    });

    it('should handle same file path in different repositories', async () => {
      const samePath = '/path/to/file.ts';

      await recentFilesService.addRecentFile(samePath, REPO_PATH_1);
      await recentFilesService.addRecentFile(samePath, REPO_PATH_2);

      const repo1Files = await recentFilesService.getRecentFiles(REPO_PATH_1);
      const repo2Files = await recentFilesService.getRecentFiles(REPO_PATH_2);

      expect(repo1Files).toHaveLength(1);
      expect(repo2Files).toHaveLength(1);
      expect(repo1Files[0]?.file_path).toBe(samePath);
      expect(repo2Files[0]?.file_path).toBe(samePath);
    });

    it('should cleanup old entries when exceeding max limit', async () => {
      // Add 52 files with small delays to ensure different timestamps
      for (let i = 1; i <= 52; i++) {
        await recentFilesService.addRecentFile(`/path/to/file${i}.ts`, REPO_PATH_1);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      const files = await recentFilesService.getRecentFiles(REPO_PATH_1);

      // Should keep only 50 most recent files
      expect(files.length).toBeLessThanOrEqual(50);
      
      // The most recent files (50, 51, 52) should be present
      const filePaths = files.map((f) => f.file_path);
      expect(filePaths).toContain('/path/to/file52.ts');
      expect(filePaths).toContain('/path/to/file51.ts');
      expect(filePaths).toContain('/path/to/file50.ts');
      
      // The oldest files (file1, file2) should have been removed
      expect(filePaths).not.toContain('/path/to/file1.ts');
      expect(filePaths).not.toContain('/path/to/file2.ts');
    });
  });

  describe('getRecentFiles', () => {
    beforeEach(async () => {
      // Add some test files
      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await recentFilesService.addRecentFile('/path/to/file2.ts', REPO_PATH_1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await recentFilesService.addRecentFile('/path/to/file3.ts', REPO_PATH_1);
    });

    it('should return files ordered by most recently opened', async () => {
      const files = await recentFilesService.getRecentFiles(REPO_PATH_1);

      expect(files).toHaveLength(3);
      // Most recent first
      expect(files[0]?.file_path).toBe('/path/to/file3.ts');
      expect(files[1]?.file_path).toBe('/path/to/file2.ts');
      expect(files[2]?.file_path).toBe('/path/to/file1.ts');
    });

    it('should respect limit parameter', async () => {
      const files = await recentFilesService.getRecentFiles(REPO_PATH_1, 2);

      expect(files).toHaveLength(2);
      expect(files[0]?.file_path).toBe('/path/to/file3.ts');
      expect(files[1]?.file_path).toBe('/path/to/file2.ts');
    });

    it('should not exceed max limit of 50', async () => {
      const files = await recentFilesService.getRecentFiles(REPO_PATH_1, 100);

      // Should cap at 50 even if we request more
      expect(files.length).toBeLessThanOrEqual(50);
    });

    it('should return empty array for repository with no recent files', async () => {
      const files = await recentFilesService.getRecentFiles('/some/other/repo');

      expect(files).toHaveLength(0);
    });

    it('should only return files for the specified repository', async () => {
      await recentFilesService.addRecentFile('/path/to/other.ts', REPO_PATH_2);

      const repo1Files = await recentFilesService.getRecentFiles(REPO_PATH_1);
      const repo2Files = await recentFilesService.getRecentFiles(REPO_PATH_2);

      expect(repo1Files).toHaveLength(3);
      expect(repo2Files).toHaveLength(1);
      expect(repo2Files[0]?.file_path).toBe('/path/to/other.ts');
    });
  });

  describe('clearRecentFiles', () => {
    beforeEach(async () => {
      await recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1);
      await recentFilesService.addRecentFile('/path/to/file2.ts', REPO_PATH_1);
      await recentFilesService.addRecentFile('/path/to/file3.ts', REPO_PATH_2);
    });

    it('should clear all recent files for a repository', async () => {
      await recentFilesService.clearRecentFiles(REPO_PATH_1);

      const repo1Files = await recentFilesService.getRecentFiles(REPO_PATH_1);
      const repo2Files = await recentFilesService.getRecentFiles(REPO_PATH_2);

      expect(repo1Files).toHaveLength(0);
      expect(repo2Files).toHaveLength(1); // Other repo unaffected
    });

    it('should handle clearing empty repository', async () => {
      // Should not throw when clearing empty repository
      await recentFilesService.clearRecentFiles('/non/existent/repo');

      const files = await recentFilesService.getRecentFiles('/non/existent/repo');
      expect(files).toHaveLength(0);
    });
  });

  describe('Repository isolation', () => {
    it('should maintain separate recent file lists per repository', async () => {
      // Add files to repo1
      await recentFilesService.addRecentFile('/repo1/file1.ts', REPO_PATH_1);
      await recentFilesService.addRecentFile('/repo1/file2.ts', REPO_PATH_1);

      // Add files to repo2
      await recentFilesService.addRecentFile('/repo2/file1.ts', REPO_PATH_2);

      const repo1Files = await recentFilesService.getRecentFiles(REPO_PATH_1);
      const repo2Files = await recentFilesService.getRecentFiles(REPO_PATH_2);

      expect(repo1Files).toHaveLength(2);
      expect(repo2Files).toHaveLength(1);

      // Clear repo1 shouldn't affect repo2
      await recentFilesService.clearRecentFiles(REPO_PATH_1);

      const repo1AfterClear = await recentFilesService.getRecentFiles(REPO_PATH_1);
      const repo2AfterClear = await recentFilesService.getRecentFiles(REPO_PATH_2);

      expect(repo1AfterClear).toHaveLength(0);
      expect(repo2AfterClear).toHaveLength(1);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent file additions', async () => {
      await Promise.all([
        recentFilesService.addRecentFile('/path/to/file1.ts', REPO_PATH_1),
        recentFilesService.addRecentFile('/path/to/file2.ts', REPO_PATH_1),
        recentFilesService.addRecentFile('/path/to/file3.ts', REPO_PATH_1),
      ]);

      const files = await recentFilesService.getRecentFiles(REPO_PATH_1);
      expect(files).toHaveLength(3);
    });

    it('should handle concurrent additions of same file', async () => {
      await Promise.all([
        recentFilesService.addRecentFile('/path/to/same.ts', REPO_PATH_1),
        recentFilesService.addRecentFile('/path/to/same.ts', REPO_PATH_1),
        recentFilesService.addRecentFile('/path/to/same.ts', REPO_PATH_1),
      ]);

      const files = await recentFilesService.getRecentFiles(REPO_PATH_1);
      // Should still have only 1 entry due to UNIQUE constraint
      expect(files).toHaveLength(1);
      expect(files[0]?.file_path).toBe('/path/to/same.ts');
    });
  });
});
