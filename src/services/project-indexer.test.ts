import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
}));


vi.mock('./code-navigation-service', () => ({
  indexFile: vi.fn(),
  indexFilesBatch: vi.fn(),
  clearFileIndex: vi.fn(),
  clearAllIndex: vi.fn(),
  getIndexMetadata: vi.fn(),
  loadIndex: vi.fn(),
  saveIndex: vi.fn(),
  getIndexedFiles: vi.fn(),
}));

vi.mock('./repository-utils', () => ({
  getLanguageFromExtension: vi.fn((path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      java: 'java',
    };
    return langMap[ext || ''] || 'unknown';
  }),
}));

import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { IndexingProgress } from '@/types/file-system';
import {
  clearFileIndex,
  getIndexMetadata,
  getIndexedFiles,
  indexFile,
  indexFilesBatch,
  loadIndex,
  saveIndex,
} from './code-navigation-service';
import { projectIndexer } from './project-indexer';

const mockInvoke = vi.mocked(invoke);
const mockReadTextFile = vi.mocked(readTextFile);
const mockIndexFile = vi.mocked(indexFile);
const mockIndexFilesBatch = vi.mocked(indexFilesBatch);
const mockGetIndexMetadata = vi.mocked(getIndexMetadata);
const mockLoadIndex = vi.mocked(loadIndex);
const mockSaveIndex = vi.mocked(saveIndex);
const mockGetIndexedFiles = vi.mocked(getIndexedFiles);
const mockClearFileIndex = vi.mocked(clearFileIndex);

describe('ProjectIndexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the indexer state by clearing all indexed files
    projectIndexer.clearAll();
    projectIndexer.clearProgressCallback();
  });

  describe('Parallel Glob Search', () => {
    it('should search all extensions in parallel', async () => {
      const callTimes: number[] = [];
      const searchDelay = 50; // ms

      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'search_files_by_glob') {
          callTimes.push(Date.now());
          // Simulate some async work
          await new Promise((r) => setTimeout(r, searchDelay));
          return [];
        }
        return [];
      });

      const startTime = Date.now();
      await projectIndexer.indexProjectByPath('/test');
      const totalTime = Date.now() - startTime;

      // With 11 extensions searching in parallel, total time should be much less than sequential
      // Sequential would take ~550ms (11 * 50ms), parallel should take ~50ms + overhead
      // Allow some overhead but it should definitely be less than 200ms
      expect(totalTime).toBeLessThan(200);

      // All glob calls should have started within a short time window (parallel execution)
      if (callTimes.length > 1) {
        const maxTimeDiff = Math.max(...callTimes) - Math.min(...callTimes);
        // All calls should start within 20ms of each other for true parallel execution
        expect(maxTimeDiff).toBeLessThan(20);
      }
    });

    it('should handle individual extension failures gracefully', async () => {
      let callCount = 0;
      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          callCount++;
          const pattern = (args as { pattern: string }).pattern;
          // Fail for .py files
          if (pattern.includes('.py')) {
            throw new Error('Failed to search');
          }
          // Return one file for .ts extension
          if (pattern.includes('.ts')) {
            return [{ path: '/test/file.ts', is_directory: false, modified_time: 0 }];
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should have attempted all extensions even though one failed
      expect(callCount).toBe(11); // 11 supported extensions

      // Should have indexed the successful file
      expect(projectIndexer.isIndexed('/test/file.ts')).toBe(true);
    });
  });

  describe('Batch Indexing', () => {
    it('should use indexFilesBatch instead of individual indexFile calls', async () => {
      const testFiles = Array.from({ length: 30 }, (_, i) => ({
        path: `/test/file${i}.ts`,
        is_directory: false,
        modified_time: 0,
      }));

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should have called indexFilesBatch, not individual indexFile calls
      expect(mockIndexFilesBatch).toHaveBeenCalled();
      // Individual indexFile should not have been called (unless batch fails)
      expect(mockIndexFile).not.toHaveBeenCalled();
    });

    it('should process files in batches of 50', async () => {
      // Create 120 test files to ensure multiple batches
      const testFiles = Array.from({ length: 120 }, (_, i) => ({
        path: `/test/file${i}.ts`,
        is_directory: false,
        modified_time: 0,
      }));

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          // Only match exact .ts extension, not .tsx
          if (pattern === '**/*.ts') {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);
      mockGetIndexMetadata.mockResolvedValue(null); // No existing index
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // With 120 files and batch size of 50, we expect 3 batch calls
      expect(mockIndexFilesBatch).toHaveBeenCalledTimes(3);

      // Check batch sizes
      const firstBatchCall = mockIndexFilesBatch.mock.calls[0][0];
      const secondBatchCall = mockIndexFilesBatch.mock.calls[1][0];
      const thirdBatchCall = mockIndexFilesBatch.mock.calls[2][0];

      expect(firstBatchCall.length).toBe(50);
      expect(secondBatchCall.length).toBe(50);
      expect(thirdBatchCall.length).toBe(20);
    });

    it('should fall back to individual indexing if batch fails', async () => {
      const testFiles = [
        { path: '/test/file1.ts', is_directory: false, modified_time: 0 },
        { path: '/test/file2.ts', is_directory: false, modified_time: 0 },
      ];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          // Only match exact .ts extension, not .tsx
          if (pattern === '**/*.ts') {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockRejectedValue(new Error('Batch indexing failed'));
      mockIndexFile.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Batch should have been attempted
      expect(mockIndexFilesBatch).toHaveBeenCalled();

      // Fallback to individual indexing should have been called
      expect(mockIndexFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Progress Callback', () => {
    it('should call progress callback during indexing', async () => {
      const progressUpdates: IndexingProgress[] = [];
      projectIndexer.setProgressCallback((p) => progressUpdates.push({ ...p }));

      const testFiles = Array.from({ length: 10 }, (_, i) => ({
        path: `/test/file${i}.ts`,
        is_directory: false,
        modified_time: 0,
      }));

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          // Only match exact .ts extension
          if (pattern === '**/*.ts') {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should have received searching, indexing, and complete phases
      expect(progressUpdates.some((p) => p.phase === 'searching')).toBe(true);
      expect(progressUpdates.some((p) => p.phase === 'indexing')).toBe(true);
      expect(progressUpdates.some((p) => p.phase === 'complete')).toBe(true);

      // Complete phase should have correct totals
      const completeUpdate = progressUpdates.find((p) => p.phase === 'complete');
      expect(completeUpdate?.current).toBe(10);
      expect(completeUpdate?.total).toBe(10);
    });

    it('should include current file in indexing progress', async () => {
      const progressUpdates: IndexingProgress[] = [];
      projectIndexer.setProgressCallback((p) => progressUpdates.push({ ...p }));

      const testFiles = [{ path: '/test/myfile.ts', is_directory: false, modified_time: 0 }];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      const indexingUpdate = progressUpdates.find((p) => p.phase === 'indexing');
      expect(indexingUpdate?.currentFile).toBe('/test/myfile.ts');
    });
  });

  describe('Non-blocking Behavior', () => {
    it('should prevent concurrent indexing', async () => {
      let indexingStarted = 0;

      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'search_files_by_glob') {
          indexingStarted++;
          // Simulate slow operation
          await new Promise((r) => setTimeout(r, 100));
          return [];
        }
        return [];
      });

      // Start two indexing operations simultaneously
      const promise1 = projectIndexer.indexProjectByPath('/test1');
      const promise2 = projectIndexer.indexProjectByPath('/test2');

      await Promise.all([promise1, promise2]);

      // Only one should have actually started glob searches
      // The second should have been skipped due to indexingInProgress flag
      // With 11 extensions, we expect 11 calls if only one indexing ran
      expect(indexingStarted).toBe(11);
    });

    it('should report indexing status correctly', async () => {
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'search_files_by_glob') {
          await new Promise((r) => setTimeout(r, 50));
          return [];
        }
        return [];
      });

      // Initially not indexing
      expect(projectIndexer.isIndexing()).toBe(false);

      const indexPromise = projectIndexer.indexProjectByPath('/test');

      // Should be indexing now (after a small delay for async to start)
      await new Promise((r) => setTimeout(r, 10));
      expect(projectIndexer.isIndexing()).toBe(true);

      await indexPromise;

      // Should be done indexing
      expect(projectIndexer.isIndexing()).toBe(false);
    });
  });

  describe('File Filtering', () => {
    it('should only index supported file types', async () => {
      const testFiles = [
        { path: '/test/code.ts', is_directory: false, modified_time: 0 },
        { path: '/test/image.png', is_directory: false, modified_time: 0 },
        { path: '/test/style.css', is_directory: false, modified_time: 0 },
      ];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return [testFiles[0]];
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Only the .ts file should be indexed
      expect(projectIndexer.isIndexed('/test/code.ts')).toBe(true);
      expect(projectIndexer.isIndexed('/test/image.png')).toBe(false);
      expect(projectIndexer.isIndexed('/test/style.css')).toBe(false);
    });

    it('should skip directories in glob results', async () => {
      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return [
              { path: '/test/file.ts', is_directory: false, modified_time: 0 },
              { path: '/test/dir.ts', is_directory: true, modified_time: 0 }, // Directory with .ts name
            ];
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Only the file should be indexed, not the directory
      expect(projectIndexer.getIndexedCount()).toBe(1);
      expect(projectIndexer.isIndexed('/test/file.ts')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      const testFiles = [
        { path: '/test/good.ts', is_directory: false, modified_time: 0 },
        { path: '/test/bad.ts', is_directory: false, modified_time: 0 },
      ];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockImplementation(async (path) => {
        if (path === '/test/bad.ts') {
          throw new Error('Permission denied');
        }
        return 'const x = 1;';
      });

      mockIndexFilesBatch.mockResolvedValue(undefined);

      // Should not throw
      await expect(projectIndexer.indexProjectByPath('/test')).resolves.not.toThrow();

      // Good file should still be indexed
      expect(projectIndexer.isIndexed('/test/good.ts')).toBe(true);
    });

    it('should handle empty project gracefully', async () => {
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'search_files_by_glob') {
          return [];
        }
        return [];
      });

      const progressUpdates: IndexingProgress[] = [];
      projectIndexer.setProgressCallback((p) => progressUpdates.push({ ...p }));

      // Should not throw
      await expect(projectIndexer.indexProjectByPath('/empty')).resolves.not.toThrow();

      // Should report complete with 0 files
      const completeUpdate = progressUpdates.find((p) => p.phase === 'complete');
      expect(completeUpdate?.total).toBe(0);
    });
  });

  describe('Index Persistence', () => {
    it('should save index after full indexing', async () => {
      const testFiles = [{ path: '/test/file.ts', is_directory: false, modified_time: 1000 }];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);
      mockGetIndexMetadata.mockResolvedValue(null); // No existing index
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should save index with timestamps
      expect(mockSaveIndex).toHaveBeenCalledWith('/test', {
        '/test/file.ts': 1000,
      });
    });

    it('should load persisted index and skip unchanged files', async () => {
      const testFiles = [
        { path: '/test/unchanged.ts', is_directory: false, modified_time: 1000 },
        { path: '/test/changed.ts', is_directory: false, modified_time: 2000 },
      ];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          // Only match exact .ts extension, not .tsx
          if (pattern === '**/*.ts') {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      // Existing persisted index metadata
      mockGetIndexMetadata.mockResolvedValue({
        version: 1,
        root_path: '/test',
        last_updated: 1000,
        file_count: 2,
        definition_count: 10,
        reference_count: 20,
        file_timestamps: {
          '/test/unchanged.ts': 1000, // Same timestamp - unchanged
          '/test/changed.ts': 1500, // Lower timestamp - changed
        },
      });

      mockLoadIndex.mockResolvedValue(true);
      mockGetIndexedFiles.mockResolvedValue(['/test/unchanged.ts', '/test/changed.ts']);
      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should load persisted index
      expect(mockLoadIndex).toHaveBeenCalledWith('/test');

      // Should only index the changed file
      expect(mockIndexFilesBatch).toHaveBeenCalledTimes(1);
      const indexedFiles = mockIndexFilesBatch.mock.calls[0][0];
      expect(indexedFiles.length).toBe(1);
      expect(indexedFiles[0][0]).toBe('/test/changed.ts');
    });

    it('should remove deleted files from index', async () => {
      const testFiles = [{ path: '/test/existing.ts', is_directory: false, modified_time: 1000 }];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      // Persisted index has a file that no longer exists
      mockGetIndexMetadata.mockResolvedValue({
        version: 1,
        root_path: '/test',
        last_updated: 1000,
        file_count: 2,
        definition_count: 10,
        reference_count: 20,
        file_timestamps: {
          '/test/existing.ts': 1000,
          '/test/deleted.ts': 1000, // This file was deleted
        },
      });

      mockLoadIndex.mockResolvedValue(true);
      mockGetIndexedFiles.mockResolvedValue(['/test/existing.ts', '/test/deleted.ts']);
      mockClearFileIndex.mockResolvedValue(undefined);
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should clear the deleted file from index
      expect(mockClearFileIndex).toHaveBeenCalledWith('/test/deleted.ts');
    });

    it('should fall back to full index if load fails', async () => {
      const testFiles = [{ path: '/test/file.ts', is_directory: false, modified_time: 1000 }];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          // Only match exact .ts extension, not .tsx
          if (pattern === '**/*.ts') {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      // Metadata exists but load fails
      mockGetIndexMetadata.mockResolvedValue({
        version: 1,
        root_path: '/test',
        last_updated: 1000,
        file_count: 1,
        definition_count: 5,
        reference_count: 10,
        file_timestamps: {
          '/test/file.ts': 1000,
        },
      });

      mockLoadIndex.mockResolvedValue(false); // Load failed
      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should index all files (full index)
      expect(mockIndexFilesBatch).toHaveBeenCalled();
      const indexedFiles = mockIndexFilesBatch.mock.calls[0][0];
      expect(indexedFiles.length).toBe(1);
      expect(indexedFiles[0][0]).toBe('/test/file.ts');
    });

    it('should detect new files not in persisted index', async () => {
      const testFiles = [
        { path: '/test/old.ts', is_directory: false, modified_time: 1000 },
        { path: '/test/new.ts', is_directory: false, modified_time: 2000 },
      ];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          // Only match exact .ts extension, not .tsx
          if (pattern === '**/*.ts') {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      // Persisted index only has the old file
      mockGetIndexMetadata.mockResolvedValue({
        version: 1,
        root_path: '/test',
        last_updated: 1000,
        file_count: 1,
        definition_count: 5,
        reference_count: 10,
        file_timestamps: {
          '/test/old.ts': 1000,
        },
      });

      mockLoadIndex.mockResolvedValue(true);
      mockGetIndexedFiles.mockResolvedValue(['/test/old.ts']);
      mockReadTextFile.mockResolvedValue('const x = 1;');
      mockIndexFilesBatch.mockResolvedValue(undefined);
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should only index the new file
      expect(mockIndexFilesBatch).toHaveBeenCalledTimes(1);
      const indexedFiles = mockIndexFilesBatch.mock.calls[0][0];
      expect(indexedFiles.length).toBe(1);
      expect(indexedFiles[0][0]).toBe('/test/new.ts');
    });

    it('should report loading and saving phases in progress', async () => {
      const progressUpdates: IndexingProgress[] = [];
      projectIndexer.setProgressCallback((p) => progressUpdates.push({ ...p }));

      const testFiles = [{ path: '/test/file.ts', is_directory: false, modified_time: 1000 }];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      mockGetIndexMetadata.mockResolvedValue({
        version: 1,
        root_path: '/test',
        last_updated: 1000,
        file_count: 1,
        definition_count: 5,
        reference_count: 10,
        file_timestamps: {
          '/test/file.ts': 1000,
        },
      });

      mockLoadIndex.mockResolvedValue(true);
      mockGetIndexedFiles.mockResolvedValue(['/test/file.ts']);
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should have loading and saving phases
      expect(progressUpdates.some((p) => p.phase === 'loading')).toBe(true);
      expect(progressUpdates.some((p) => p.phase === 'saving')).toBe(true);
    });

    it('should skip indexing when no files changed', async () => {
      const testFiles = [{ path: '/test/file.ts', is_directory: false, modified_time: 1000 }];

      mockInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'search_files_by_glob') {
          const pattern = (args as { pattern: string }).pattern;
          if (pattern.includes('.ts')) {
            return testFiles;
          }
          return [];
        }
        return [];
      });

      // File timestamp unchanged
      mockGetIndexMetadata.mockResolvedValue({
        version: 1,
        root_path: '/test',
        last_updated: 1000,
        file_count: 1,
        definition_count: 5,
        reference_count: 10,
        file_timestamps: {
          '/test/file.ts': 1000, // Same timestamp
        },
      });

      mockLoadIndex.mockResolvedValue(true);
      mockGetIndexedFiles.mockResolvedValue(['/test/file.ts']);
      mockSaveIndex.mockResolvedValue(undefined);

      await projectIndexer.indexProjectByPath('/test');

      // Should not call indexFilesBatch since no files changed
      expect(mockIndexFilesBatch).not.toHaveBeenCalled();
    });
  });
});
