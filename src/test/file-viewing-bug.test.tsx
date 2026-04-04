import { renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryStoreProvider, useRepositoryStore } from '@/stores/window-scoped-repository-store';

// Mock the repository service
vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    readFileWithCache: vi.fn((path: string) => Promise.resolve(`Content of ${path}`)),
    buildDirectoryTree: vi.fn(() =>
      Promise.resolve({ path: '/test', name: 'test', is_directory: true, children: [] })
    ),
    writeFile: vi.fn(() => Promise.resolve()),
    getFileNameFromPath: (path: string) => path.split('/').pop(),
    getLanguageFromExtension: () => 'plaintext',
    selectRepositoryFolder: vi.fn(() => Promise.resolve('/test')),
    clearCache: vi.fn(),
    invalidateCache: vi.fn(),
    getCacheSize: vi.fn(() => 0),
  },
}));

// Mock the database service
vi.mock('@/services/database-service', () => ({
  databaseService: {
    createOrGetProjectForRepository: vi.fn(() =>
      Promise.resolve({ id: 'test-project', name: 'Test Project' })
    ),
    startSpan: vi.fn().mockResolvedValue(undefined),
    endSpan: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the settings manager
vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    setCurrentRootPath: vi.fn(),
    getCurrentRootPath: vi.fn(() => ''),
    setCurrentProjectId: vi.fn().mockResolvedValue(undefined),
    getProject: vi.fn(() => Promise.resolve('test-project')),
    setProject: vi.fn(),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
  useSettingsStore: {
    getState: vi.fn().mockReturnValue({
      language: 'en',
      getReasoningEffort: vi.fn(() => 'medium'),
      getAutoApproveEditsGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
    }),
  },
}));

// Mock the fast directory tree service
vi.mock('@/services/fast-directory-tree-service', () => ({
  fastDirectoryTreeService: {
    clearCache: vi.fn(() => Promise.resolve()),
    loadDirectoryChildren: vi.fn(() => Promise.resolve([])),
  },
}));

// Mock window manager and restore services
vi.mock('@/services/window-manager-service', () => ({
  WindowManagerService: {
    getCurrentWindowLabel: vi.fn().mockResolvedValue('main'),
    updateWindowProject: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/window-restore-service', () => ({
  WindowRestoreService: {
    saveCurrentWindowState: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RepositoryStoreProvider>{children}</RepositoryStoreProvider>
);

describe('File Viewing Bug - currentFile should update when switching tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct currentFile when opening multiple files', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open first file
    await result.current.selectFile('/test/file1.txt');

    // Verify first file is open and active
    expect(result.current.openFiles.length).toBe(1);
    expect(result.current.activeFileIndex).toBe(0);
    expect(result.current.openFiles[0].path).toBe('/test/file1.txt');

    // Wait for content to load
    await vi.waitFor(() => {
      return result.current.openFiles[0].content !== null;
    });

    // Verify content is loaded
    expect(result.current.openFiles[0].content).toBe('Content of /test/file1.txt');

    // Open second file
    await result.current.selectFile('/test/file2.txt');

    // Verify both files are open and second is active
    expect(result.current.openFiles.length).toBe(2);
    expect(result.current.activeFileIndex).toBe(1);
    expect(result.current.openFiles[1].path).toBe('/test/file2.txt');
  });

  it('should update activeFileIndex when switching tabs', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open two files
    await result.current.selectFile('/test/file1.txt');
    await result.current.selectFile('/test/file2.txt');

    expect(result.current.activeFileIndex).toBe(1);
    expect(result.current.openFiles[1].path).toBe('/test/file2.txt');

    // Switch to first tab
    await result.current.switchToTab(0);

    expect(result.current.activeFileIndex).toBe(0);
    expect(result.current.openFiles[0].path).toBe('/test/file1.txt');
  });

  it('should return correct file based on activeFileIndex (currentFile derivation test)', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open three files
    await result.current.selectFile('/test/file1.txt');
    await result.current.selectFile('/test/file2.txt');
    await result.current.selectFile('/test/file3.txt');

    // Wait for all content to load
    await vi.waitFor(() => {
      return result.current.openFiles.every((file) => file.content !== null);
    });

    // Test that deriving currentFile works correctly
    const deriveCurrentFile = () => {
      if (
        result.current.activeFileIndex >= 0 &&
        result.current.activeFileIndex < result.current.openFiles.length
      ) {
        return result.current.openFiles[result.current.activeFileIndex];
      }
      return null;
    };

    // Check file 3 (currently active)
    let currentFile = deriveCurrentFile();
    expect(currentFile?.path).toBe('/test/file3.txt');
    expect(currentFile?.content).toBe('Content of /test/file3.txt');

    // Switch to file 1
    await result.current.switchToTab(0);
    currentFile = deriveCurrentFile();
    expect(currentFile?.path).toBe('/test/file1.txt');
    expect(currentFile?.content).toBe('Content of /test/file1.txt');

    // Switch to file 2
    await result.current.switchToTab(1);
    currentFile = deriveCurrentFile();
    expect(currentFile?.path).toBe('/test/file2.txt');
    expect(currentFile?.content).toBe('Content of /test/file2.txt');
  });

  it('should return null currentFile when no files are open', () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    const deriveCurrentFile = () => {
      if (
        result.current.activeFileIndex >= 0 &&
        result.current.activeFileIndex < result.current.openFiles.length
      ) {
        return result.current.openFiles[result.current.activeFileIndex];
      }
      return null;
    };

    const currentFile = deriveCurrentFile();
    expect(currentFile).toBeNull();
  });

  it('should return null currentFile after closing all files', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open files
    await result.current.selectFile('/test/file1.txt');
    await result.current.selectFile('/test/file2.txt');

    // Close all files
    result.current.closeAllFiles();

    // Wait for state to update
    await vi.waitFor(() => {
      expect(result.current.openFiles.length).toBe(0);
      expect(result.current.activeFileIndex).toBe(-1);
    });

    const deriveCurrentFile = () => {
      if (
        result.current.activeFileIndex >= 0 &&
        result.current.activeFileIndex < result.current.openFiles.length
      ) {
        return result.current.openFiles[result.current.activeFileIndex];
      }
      return null;
    };

    const currentFile = deriveCurrentFile();
    expect(currentFile).toBeNull();
  });

  it('should re-open already open file and switch to it', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open two files
    await result.current.selectFile('/test/file1.txt');
    await result.current.selectFile('/test/file2.txt');

    expect(result.current.openFiles.length).toBe(2);
    expect(result.current.activeFileIndex).toBe(1); // file2 is active

    // Try to open file1 again
    await result.current.selectFile('/test/file1.txt');

    expect(result.current.openFiles.length).toBe(2); // Still only 2 files
    expect(result.current.activeFileIndex).toBe(0); // Switched to file1
    expect(result.current.openFiles[0].path).toBe('/test/file1.txt');
  });
});
