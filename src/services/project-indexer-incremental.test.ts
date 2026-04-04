/**
 * Tests for the incremental indexing bug fix.
 *
 * Bug description:
 * - When some files fail to be indexed (e.g., tree-sitter parse error),
 *   they were not added to file_definitions in the backend.
 * - However, their timestamps were saved to the persisted index.
 * - On next load, incremental update detected these files as "unchanged"
 *   because they had timestamps, even though they were never actually indexed.
 * - Result: These files would never be indexed.
 *
 * Fix:
 * 1. Only save timestamps for files that were actually indexed
 * 2. During incremental update, check if files exist in glob but not in indexedFilesSet,
 *    and add them to filesToIndex
 */
import { describe, expect, it } from 'vitest';

/**
 * Pure function to calculate which files need indexing.
 * This is the core logic extracted from project-indexer.ts
 */
function calculateFilesToIndex(
  allFiles: string[],
  currentTimestamps: Record<string, number>,
  persistedTimestamps: Record<string, number>
): string[] {
  const filesToIndex: string[] = [];

  for (const filePath of allFiles) {
    const currentTime = currentTimestamps[filePath] ?? 0;
    const persistedTime = persistedTimestamps[filePath] ?? 0;

    if (persistedTime === 0 || currentTime > persistedTime) {
      filesToIndex.push(filePath);
    }
  }

  return filesToIndex;
}

/**
 * Pure function to find files that exist but weren't indexed.
 * This is the fix for the bug - check if files in glob are not in indexedFilesSet
 */
function findUnindexedFiles(allFiles: string[], indexedFilesSet: Set<string>): string[] {
  const unindexedFiles: string[] = [];

  for (const filePath of allFiles) {
    if (!indexedFilesSet.has(filePath)) {
      unindexedFiles.push(filePath);
    }
  }

  return unindexedFiles;
}

/**
 * Pure function to calculate timestamps to save.
 * FIX: Only save timestamps for files that were actually indexed.
 */
function calculateTimestampsToSave(
  indexedFiles: string[],
  currentTimestamps: Record<string, number>
): Record<string, number> {
  const timestampsToSave: Record<string, number> = {};

  for (const filePath of indexedFiles) {
    if (currentTimestamps[filePath] !== undefined) {
      timestampsToSave[filePath] = currentTimestamps[filePath];
    }
  }

  return timestampsToSave;
}

/**
 * OLD buggy function - saves timestamps for ALL files, not just indexed ones
 */
function calculateTimestampsToSave_BUGGY(
  _indexedFiles: string[],
  currentTimestamps: Record<string, number>
): Record<string, number> {
  // BUG: This saves timestamps for ALL files, including those that failed to index
  return { ...currentTimestamps };
}

describe('Incremental Indexing Bug Fix', () => {
  describe('Bug Reproduction', () => {
    it('should demonstrate the bug: files with timestamps but not indexed are never retried', () => {
      // Scenario: 5 files found by glob, but only 3 were successfully indexed

      // Current state from glob
      const allFiles = [
        '/test/file1.ts',
        '/test/file2.ts',
        '/test/file3.ts',
        '/test/file4.ts', // Failed to index (e.g., tree-sitter error)
        '/test/file5.ts', // Failed to index
      ];

      const currentTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        '/test/file2.ts': 1000,
        '/test/file3.ts': 1000,
        '/test/file4.ts': 1000,
        '/test/file5.ts': 1000,
      };

      // Simulate: First indexing run
      // Only 3 files were successfully indexed
      const indexedFilesAfterFirstRun = ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'];

      // BUG: Old code saves timestamps for ALL 5 files
      const buggyTimestamps = calculateTimestampsToSave_BUGGY(
        indexedFilesAfterFirstRun,
        currentTimestamps
      );

      // Now simulate second run - loading persisted index
      const persistedTimestamps = buggyTimestamps;

      // Calculate files to index based on timestamps alone
      const filesToIndex = calculateFilesToIndex(allFiles, currentTimestamps, persistedTimestamps);

      // BUG: No files need indexing because all have matching timestamps!
      expect(filesToIndex).toHaveLength(0);

      // But file4 and file5 are still not indexed!
      const indexedFilesSet = new Set(indexedFilesAfterFirstRun);
      expect(indexedFilesSet.has('/test/file4.ts')).toBe(false);
      expect(indexedFilesSet.has('/test/file5.ts')).toBe(false);
    });
  });

  describe('Fix Verification', () => {
    it('should only save timestamps for actually indexed files', () => {
      const currentTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        '/test/file2.ts': 1000,
        '/test/file3.ts': 1000,
        '/test/file4.ts': 1000, // Not indexed
        '/test/file5.ts': 1000, // Not indexed
      };

      // Only 3 files were successfully indexed
      const indexedFiles = ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'];

      // FIX: Only save timestamps for indexed files
      const timestampsToSave = calculateTimestampsToSave(indexedFiles, currentTimestamps);

      // Should only have 3 entries
      expect(Object.keys(timestampsToSave)).toHaveLength(3);
      expect(timestampsToSave['/test/file1.ts']).toBe(1000);
      expect(timestampsToSave['/test/file2.ts']).toBe(1000);
      expect(timestampsToSave['/test/file3.ts']).toBe(1000);
      expect(timestampsToSave['/test/file4.ts']).toBeUndefined();
      expect(timestampsToSave['/test/file5.ts']).toBeUndefined();
    });

    it('should detect files that exist but are not in indexed set', () => {
      const allFiles = [
        '/test/file1.ts',
        '/test/file2.ts',
        '/test/file3.ts',
        '/test/file4.ts',
        '/test/file5.ts',
      ];

      // Only 3 files are in the indexed set
      const indexedFilesSet = new Set(['/test/file1.ts', '/test/file2.ts', '/test/file3.ts']);

      // FIX: Find files that need to be indexed
      const unindexedFiles = findUnindexedFiles(allFiles, indexedFilesSet);

      expect(unindexedFiles).toHaveLength(2);
      expect(unindexedFiles).toContain('/test/file4.ts');
      expect(unindexedFiles).toContain('/test/file5.ts');
    });

    it('should correctly retry unindexed files on next run with fix applied', () => {
      // Scenario: Second run after fix is applied

      const allFiles = [
        '/test/file1.ts',
        '/test/file2.ts',
        '/test/file3.ts',
        '/test/file4.ts',
        '/test/file5.ts',
      ];

      const currentTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        '/test/file2.ts': 1000,
        '/test/file3.ts': 1000,
        '/test/file4.ts': 1000,
        '/test/file5.ts': 1000,
      };

      // First run: only 3 files indexed
      const indexedFilesAfterFirstRun = ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'];

      // FIX: Only save timestamps for indexed files
      const fixedTimestamps = calculateTimestampsToSave(indexedFilesAfterFirstRun, currentTimestamps);

      // Second run: load persisted index
      const persistedTimestamps = fixedTimestamps;

      // Step 1: Calculate files to index based on timestamps
      const filesToIndexFromTimestamps = calculateFilesToIndex(
        allFiles,
        currentTimestamps,
        persistedTimestamps
      );

      // file4 and file5 have no persisted timestamp, so they should be detected
      expect(filesToIndexFromTimestamps).toContain('/test/file4.ts');
      expect(filesToIndexFromTimestamps).toContain('/test/file5.ts');
    });

    it('should handle edge case: file previously indexed but now fails (modification)', () => {
      // Scenario: A file was indexed before, then modified, and the new version fails to index

      const allFiles = ['/test/file1.ts', '/test/file2.ts'];

      // First run timestamps
      const firstRunTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        '/test/file2.ts': 1000,
      };

      // First run: both files indexed
      const indexedFilesFirstRun = ['/test/file1.ts', '/test/file2.ts'];
      const savedTimestamps = calculateTimestampsToSave(indexedFilesFirstRun, firstRunTimestamps);

      // Second run: file2 was modified and failed to index
      const secondRunTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000, // Unchanged
        '/test/file2.ts': 2000, // Modified
      };

      // Load persisted index - both files were previously indexed
      const indexedFilesFromBackend = ['/test/file1.ts', '/test/file2.ts'];
      const indexedFilesSet = new Set(indexedFilesFromBackend);

      // Calculate files to index based on timestamps
      const filesToIndex = calculateFilesToIndex(allFiles, secondRunTimestamps, savedTimestamps);

      // file2 should be detected as changed
      expect(filesToIndex).toContain('/test/file2.ts');
      expect(filesToIndex).not.toContain('/test/file1.ts');

      // Simulate: file2 indexing fails
      // After indexing attempt, only file1 remains in indexed set
      const indexedFilesAfterSecondRun = ['/test/file1.ts'];

      // Save timestamps for only successfully indexed files
      const timestampsAfterSecondRun = calculateTimestampsToSave(
        indexedFilesAfterSecondRun,
        secondRunTimestamps
      );

      // Only file1's timestamp should be saved
      expect(Object.keys(timestampsAfterSecondRun)).toHaveLength(1);
      expect(timestampsAfterSecondRun['/test/file1.ts']).toBe(1000);
      expect(timestampsAfterSecondRun['/test/file2.ts']).toBeUndefined();

      // Third run: file2 should be retried
      const thirdRunTimestamps = { ...secondRunTimestamps };
      const filesToIndexThirdRun = calculateFilesToIndex(
        allFiles,
        thirdRunTimestamps,
        timestampsAfterSecondRun
      );

      expect(filesToIndexThirdRun).toContain('/test/file2.ts');
    });
  });

  describe('Combined Fix Logic', () => {
    it('should correctly combine timestamp check and indexed set check', () => {
      // This test simulates the full incremental update logic with both fixes

      // Current file system state
      const allFiles = [
        '/test/old1.ts', // Unchanged, indexed
        '/test/old2.ts', // Unchanged, NOT indexed (failed before)
        '/test/modified.ts', // Modified, indexed before
        '/test/new.ts', // New file
      ];

      const currentTimestamps: Record<string, number> = {
        '/test/old1.ts': 1000,
        '/test/old2.ts': 1000,
        '/test/modified.ts': 2000, // Modified
        '/test/new.ts': 3000, // New
      };

      // Persisted state (with FIX applied - only indexed files have timestamps)
      const persistedTimestamps: Record<string, number> = {
        '/test/old1.ts': 1000, // Has timestamp, was indexed
        // old2.ts is missing - it failed to index before
        '/test/modified.ts': 1500, // Has timestamp, but file was modified
        // new.ts is missing - it's a new file
      };

      // Backend index state (what was actually indexed)
      const indexedFilesFromBackend = ['/test/old1.ts', '/test/modified.ts'];
      const indexedFilesSet = new Set(indexedFilesFromBackend);

      // Step 1: Calculate files to index based on timestamp comparison
      const filesToIndexByTimestamp = calculateFilesToIndex(
        allFiles,
        currentTimestamps,
        persistedTimestamps
      );

      // old2.ts: persistedTime === 0 (not in persisted), should be detected
      // modified.ts: currentTime (2000) > persistedTime (1500), should be detected
      // new.ts: persistedTime === 0 (not in persisted), should be detected
      expect(filesToIndexByTimestamp).toContain('/test/old2.ts');
      expect(filesToIndexByTimestamp).toContain('/test/modified.ts');
      expect(filesToIndexByTimestamp).toContain('/test/new.ts');
      expect(filesToIndexByTimestamp).not.toContain('/test/old1.ts');

      // Step 2: Additional check - find files not in indexed set
      const unindexedFiles = findUnindexedFiles(allFiles, indexedFilesSet);

      // old2.ts: not in indexed set
      // new.ts: not in indexed set
      expect(unindexedFiles).toContain('/test/old2.ts');
      expect(unindexedFiles).toContain('/test/new.ts');

      // Step 3: Combine both lists (remove duplicates)
      const allFilesToIndex = [...new Set([...filesToIndexByTimestamp, ...unindexedFiles])];

      // Should have old2, modified, new
      expect(allFilesToIndex).toHaveLength(3);
      expect(allFilesToIndex).toContain('/test/old2.ts');
      expect(allFilesToIndex).toContain('/test/modified.ts');
      expect(allFilesToIndex).toContain('/test/new.ts');
    });

    it('should handle the specific bug case: file exists with timestamp but not in index', () => {
      // This specifically tests the scenario from the bug report

      // User opens project, 225 files found by glob
      const allFiles = Array.from({ length: 225 }, (_, i) => `/test/file${i}.ts`);
      const currentTimestamps: Record<string, number> = {};
      for (const file of allFiles) {
        currentTimestamps[file] = 1000;
      }

      // Persisted index has 208 files with timestamps (buggy old behavior)
      // But only 208 files are actually in file_definitions
      const persistedTimestamps: Record<string, number> = {};
      for (let i = 0; i < 225; i++) {
        // BUG: All 225 files have timestamps in persisted index
        persistedTimestamps[`/test/file${i}.ts`] = 1000;
      }

      // Backend only has 208 files indexed
      const indexedFilesFromBackend = allFiles.slice(0, 208);
      const indexedFilesSet = new Set(indexedFilesFromBackend);

      // With old code: timestamp check finds 0 files to index
      const filesToIndexByTimestamp = calculateFilesToIndex(
        allFiles,
        currentTimestamps,
        persistedTimestamps
      );
      expect(filesToIndexByTimestamp).toHaveLength(0); // BUG behavior

      // With fix: check indexed set finds 17 missing files
      const unindexedFiles = findUnindexedFiles(allFiles, indexedFilesSet);
      expect(unindexedFiles).toHaveLength(17);

      // Verify the correct files are detected
      for (let i = 208; i < 225; i++) {
        expect(unindexedFiles).toContain(`/test/file${i}.ts`);
      }
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty file list', () => {
      const allFiles: string[] = [];
      const currentTimestamps: Record<string, number> = {};
      const persistedTimestamps: Record<string, number> = {};
      const indexedFilesSet = new Set<string>();

      const filesToIndex = calculateFilesToIndex(allFiles, currentTimestamps, persistedTimestamps);
      const unindexedFiles = findUnindexedFiles(allFiles, indexedFilesSet);
      const timestampsToSave = calculateTimestampsToSave([], currentTimestamps);

      expect(filesToIndex).toHaveLength(0);
      expect(unindexedFiles).toHaveLength(0);
      expect(Object.keys(timestampsToSave)).toHaveLength(0);
    });

    it('should handle all files indexed successfully', () => {
      const allFiles = ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'];
      const currentTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        '/test/file2.ts': 1000,
        '/test/file3.ts': 1000,
      };

      // All files indexed
      const indexedFiles = [...allFiles];
      const indexedFilesSet = new Set(indexedFiles);

      const unindexedFiles = findUnindexedFiles(allFiles, indexedFilesSet);
      const timestampsToSave = calculateTimestampsToSave(indexedFiles, currentTimestamps);

      expect(unindexedFiles).toHaveLength(0);
      expect(Object.keys(timestampsToSave)).toHaveLength(3);
    });

    it('should handle no files indexed', () => {
      const allFiles = ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'];
      const currentTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        '/test/file2.ts': 1000,
        '/test/file3.ts': 1000,
      };

      // No files indexed (all failed)
      const indexedFiles: string[] = [];
      const indexedFilesSet = new Set(indexedFiles);

      const unindexedFiles = findUnindexedFiles(allFiles, indexedFilesSet);
      const timestampsToSave = calculateTimestampsToSave(indexedFiles, currentTimestamps);

      expect(unindexedFiles).toHaveLength(3);
      expect(Object.keys(timestampsToSave)).toHaveLength(0);
    });

    it('should handle files in indexed set but not in current timestamps', () => {
      // Edge case: indexed file was deleted from filesystem

      const currentTimestamps: Record<string, number> = {
        '/test/file1.ts': 1000,
        // file2.ts was deleted
      };

      const indexedFiles = ['/test/file1.ts', '/test/file2.ts'];

      const timestampsToSave = calculateTimestampsToSave(indexedFiles, currentTimestamps);

      // Should only save timestamp for file1 (file2 has no current timestamp)
      expect(Object.keys(timestampsToSave)).toHaveLength(1);
      expect(timestampsToSave['/test/file1.ts']).toBe(1000);
      expect(timestampsToSave['/test/file2.ts']).toBeUndefined();
    });
  });
});
