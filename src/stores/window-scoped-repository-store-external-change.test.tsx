import { renderHook, waitFor, act } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryStoreProvider, useRepositoryStore } from './window-scoped-repository-store';

// Mock dependencies
vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    invalidateCache: vi.fn(),
    readFileWithCache: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    getFileNameFromPath: (path: string) => path.split('/').pop() || '',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/locales', () => ({
  getLocale: vi.fn(() => ({
    RepositoryStore: {
      errors: {
        failedToSave: vi.fn((msg: string) => `Failed to save: ${msg}`),
        failedToLoadDirectory: 'Failed to load directory',
        failedToOpen: vi.fn((msg: string) => `Failed to open: ${msg}`),
        failedToRead: vi.fn((msg: string) => `Failed to read: ${msg}`),
        failedToRefresh: vi.fn((msg: string) => `Failed to refresh: ${msg}`),
        failedToRefreshTree: vi.fn((msg: string) => `Failed to refresh tree: ${msg}`),
        searchFailed: 'Search failed',
      },
      success: {
        repositoryOpened: 'Repository opened',
        fileSaved: vi.fn((name: string) => `File ${name} saved`),
        fileRefreshed: 'File refreshed',
        fileReloaded: vi.fn((name: string) => `File ${name} reloaded`),
      },
    },
  })),
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      language: 'en',
      getAutoApproveEditsGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
    })),
  },
  settingsManager: {
    setCurrentRootPath: vi.fn(),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RepositoryStoreProvider>{children}</RepositoryStoreProvider>
);

describe('handleExternalFileChange', () => {
  const testFilePath = '/test/path/file.ts';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should ignore self-triggered file changes from recent saves', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Add file to openFiles via selectFile
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('initial content');
    await result.current.selectFile(testFilePath);

    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('saved content');

    // Save the file (this should mark it as recently saved)
    await result.current.saveFile(testFilePath, 'saved content');

    // Clear the toast calls from saveFile
    vi.clearAllMocks();

    // Immediately trigger external file change (simulating file system watcher)
    await result.current.handleExternalFileChange(testFilePath);

    // Should NOT update the file or show toast because it's a self-triggered change
    expect(repositoryService.invalidateCache).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();

    // Clean up timers
    vi.runAllTimers();
  });

  it('should auto-update editor content when file has no unsaved changes', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Add file to openFiles via selectFile
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('old content');
    await result.current.selectFile(testFilePath);

    // Mock disk content to be different
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('new content from disk');

    // Wait for recent save timeout to expire (2000ms + 100ms buffer)
    vi.advanceTimersByTime(2100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    // The store should update synchronously in this case
    const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(openFile?.content).toBe('new content from disk');

    expect(repositoryService.invalidateCache).toHaveBeenCalledWith(testFilePath);
  });

  it('should show conflict dialog when file has unsaved changes', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Add file to openFiles via selectFile
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('modified content');
    await result.current.selectFile(testFilePath);

    // Mark file as having unsaved changes
    result.current.updateFileContent(testFilePath, 'modified content', true);

    // Mock disk content to be different
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('external content');

    // Wait for recent save timeout to expire (2000ms + 100ms buffer)
    vi.advanceTimersByTime(2100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    // The state should be updated synchronously
    expect(result.current.pendingExternalChange).toEqual({
      filePath: testFilePath,
      diskContent: 'external content',
    });

    // File content should NOT be auto-updated
    const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(openFile?.content).toBe('modified content');
  });

  it('should not update when disk content is the same as editor content', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { toast } = await import('sonner');
    const { logger } = await import('@/lib/logger');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Add file to openFiles via selectFile
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('same content');
    await result.current.selectFile(testFilePath);

    // Mock disk content to be the same
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('same content');

    // Wait for recent save timeout to expire (2000ms + 100ms buffer)
    vi.advanceTimersByTime(2100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    // The logger should be called synchronously
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('External file content unchanged')
    );

    // Should not show toast or update content
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('should apply external change correctly when user chooses to load disk version', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Set up pending external change by using handleExternalFileChange
    const { repositoryService } = await import('@/services/repository-service');
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('local content');
    await result.current.selectFile(testFilePath);

    // Mark file as having unsaved changes FIRST
    result.current.updateFileContent(testFilePath, 'local content', true);

    // Then trigger external file change
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('disk content');

    // Wait for recent save timeout to expire (2000ms + 100ms buffer)
    vi.advanceTimersByTime(2100);

    // Trigger external file change with unsaved content
    await result.current.handleExternalFileChange(testFilePath);

    // Verify pendingExternalChange is set
    expect(result.current.pendingExternalChange).toEqual({
      filePath: testFilePath,
      diskContent: 'disk content',
    });

    // User chooses to load disk version
    act(() => {
      result.current.applyExternalChange(false);
    });

    // The state should be updated synchronously
    const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(openFile?.content).toBe('disk content');
    expect(openFile?.hasUnsavedChanges).toBe(false);
    expect(result.current.pendingExternalChange).toBeNull();

    expect(toast.success).toHaveBeenCalled();
  });

  it('should apply external change correctly when user chooses to keep local', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Set up pending external change by using handleExternalFileChange
    const { repositoryService } = await import('@/services/repository-service');
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('local content');
    await result.current.selectFile(testFilePath);

    // Mark file as having unsaved changes FIRST
    result.current.updateFileContent(testFilePath, 'local content', true);

    // Then trigger external file change
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('disk content');

    // Wait for recent save timeout to expire (2000ms + 100ms buffer)
    vi.advanceTimersByTime(2100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    // Verify pendingExternalChange is set
    expect(result.current.pendingExternalChange).toEqual({
      filePath: testFilePath,
      diskContent: 'disk content',
    });

    // User chooses to keep local changes
    act(() => {
      result.current.applyExternalChange(true);
    });

    // The state should be updated synchronously
    const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(openFile?.content).toBe('local content');
    expect(openFile?.hasUnsavedChanges).toBe(true);
    expect(result.current.pendingExternalChange).toBeNull();
  });

  it('should mark file as recently saved when using markRecentSave', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Add file to openFiles
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('initial content');
    await result.current.selectFile(testFilePath);

    // Mark file as recently saved
    result.current.markRecentSave(testFilePath);

    // Mock disk content to be different
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('new disk content');

    // Immediately trigger external file change (within the 1s window)
    await result.current.handleExternalFileChange(testFilePath);

    // Should NOT trigger external change dialog or update content
    // because file is marked as recently saved
    expect(result.current.pendingExternalChange).toBeNull();
    const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(openFile?.content).toBe('initial content');

    // Wait for recent save timeout to expire (2000ms + 100ms buffer)
    vi.advanceTimersByTime(2100);

    // Now trigger external file change again
    await result.current.handleExternalFileChange(testFilePath);

    // Now it should update the content (no unsaved changes)
    const updatedFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(updatedFile?.content).toBe('new disk content');
  });
});
