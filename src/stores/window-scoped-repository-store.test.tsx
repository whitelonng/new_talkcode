import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import type React from 'react';
import type { FileNode } from '@/types/file-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { RepositoryStoreProvider, useRepositoryStore } from './window-scoped-repository-store';
import { settingsManager } from './settings-store';

// Mock all external dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('./settings-store', () => ({
  settingsManager: {
    setCurrentRootPath: vi.fn(),
    getCurrentRootPath: vi.fn().mockReturnValue(''),
    setCurrentProjectId: vi.fn().mockResolvedValue(undefined),
  },
  useSettingsStore: {
    getState: vi.fn().mockReturnValue({ language: 'en' }),
  },
}));

vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    buildDirectoryTree: vi.fn().mockResolvedValue({
      path: '/test/path',
      name: 'test',
      is_directory: true,
      children: [],
    }),
    clearCache: vi.fn(),
    selectRepositoryFolder: vi.fn(),
    readFileWithCache: vi.fn(),
    writeFile: vi.fn(),
    invalidateCache: vi.fn(),
    getFileNameFromPath: vi.fn((path: string) => path.split('/').pop()),
    renameFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/fast-directory-tree-service', () => ({
  fastDirectoryTreeService: {
    clearCache: vi.fn().mockResolvedValue(undefined),
    loadDirectoryChildren: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/database-service', () => ({
  databaseService: {
    createOrGetProjectForRepository: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
    getProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
    trackProjectOpened: vi.fn().mockResolvedValue(undefined),
  },
}));

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

describe('window-scoped-repository-store - selectRepository UI freeze bug', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RepositoryStoreProvider>{children}</RepositoryStoreProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  it('should return immediately without blocking UI when selecting repository', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { databaseService } = await import('@/services/database-service');

    vi.mocked(repositoryService.selectRepositoryFolder).mockResolvedValue('/test/new-project');
    vi.mocked(repositoryService.buildDirectoryTree).mockImplementation(
      () =>
        new Promise((resolve) => {
          // Simulate slow directory tree building (500ms)
          setTimeout(() => {
            resolve({
              path: '/test/new-project',
              name: 'new-project',
              is_directory: true,
              children: [],
            });
          }, 500);
        })
    );

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    const startTime = Date.now();
    const selectRepositoryPromise = result.current.selectRepository();

    // selectRepository should return quickly (before tree building completes)
    const project = await selectRepositoryPromise;
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should return in less than 200ms (not wait for 500ms tree building)
    expect(duration).toBeLessThan(200);
    expect(project).toEqual({ id: 'proj-1', name: 'Test Project' });
    expect(databaseService.createOrGetProjectForRepository).toHaveBeenCalledWith('/test/new-project');
  });


  it('should ignore stale openRepository completions', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const firstTreePromise = new Promise<FileNode>((resolve) => {
      setTimeout(() => {
        resolve({ path: '/test/first', name: 'first', is_directory: true, children: [] });
      }, 30);
    });

    const secondTreePromise = new Promise<FileNode>((resolve) => {
      setTimeout(() => {
        resolve({ path: '/test/second', name: 'second', is_directory: true, children: [] });
      }, 10);
    });

    vi.mocked(repositoryService.buildDirectoryTree)
      .mockImplementationOnce(() => firstTreePromise)
      .mockImplementationOnce(() => secondTreePromise);

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    result.current.openRepository('/test/first', 'proj-1');
    result.current.openRepository('/test/second', 'proj-2');

    await waitFor(() => expect(result.current.rootPath).toBe('/test/second'), { timeout: 200 });
  });



  it('should allow hooks from reloaded modules to access provider context', async () => {
    const { RepositoryStoreProvider: ProviderFromFirstModule } = await import(
      './window-scoped-repository-store'
    );

    vi.resetModules();

    const { useRepositoryStore: useRepositoryStoreFromReloadedModule } = await import(
      './window-scoped-repository-store'
    );

    const Consumer = () => {
      const rootPath = useRepositoryStoreFromReloadedModule((state) => state.rootPath);
      return <div data-testid="root-path">{rootPath ?? 'none'}</div>;
    };

    expect(() => {
      render(
        <ProviderFromFirstModule>
          <Consumer />
        </ProviderFromFirstModule>
      );
    }).not.toThrow();

    expect(screen.getByTestId('root-path')).toHaveTextContent('none');
  });

  it('should apply content to the correct file when reads resolve out of order', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const firstRead = new Promise<string>((resolve) => {
      setTimeout(() => resolve('content-a'), 30);
    });
    const secondRead = new Promise<string>((resolve) => {
      setTimeout(() => resolve('content-b'), 10);
    });

    vi.mocked(repositoryService.readFileWithCache)
      .mockImplementationOnce(() => firstRead)
      .mockImplementationOnce(() => secondRead);

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    await act(async () => {
      result.current.selectFile('/test/path/a.ts');
      result.current.selectFile('/test/path/b.ts');
    });

    await waitFor(() => {
      const fileA = result.current.openFiles.find((f) => f.path === '/test/path/a.ts');
      const fileB = result.current.openFiles.find((f) => f.path === '/test/path/b.ts');
      expect(fileA?.content).toBe('content-a');
      expect(fileB?.content).toBe('content-b');
    });
  });

  it('should set error on the correct file when read fails', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    vi.mocked(repositoryService.readFileWithCache).mockImplementationOnce(() => {
      return Promise.reject(new Error('read failed'));
    });

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    await act(async () => {
      result.current.selectFile('/test/path/err.ts');
    });

    await waitFor(() => {
      const fileErr = result.current.openFiles.find((f) => f.path === '/test/path/err.ts');
      expect(fileErr?.error).toBe('read failed');
      expect(fileErr?.isLoading).toBe(false);
    });
  });


  it('should run openRepository in background without blocking', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    vi.mocked(repositoryService.selectRepositoryFolder).mockResolvedValue('/test/background-project');
    vi.mocked(repositoryService.buildDirectoryTree).mockImplementation(
      () =>
        new Promise((resolve) => {
          // Simulate slow directory tree building (500ms)
          setTimeout(() => {
            resolve({
              path: '/test/background-project',
              name: 'background-project',
              is_directory: true,
              children: [],
            });
          }, 500);
        })
    );

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Start selection
    await result.current.selectRepository();

    // openRepository should be called in background
    expect(repositoryService.buildDirectoryTree).toHaveBeenCalled();

    // Repository should eventually open (after background processing)
    await waitFor(() => expect(result.current.rootPath).toBe('/test/background-project'), {
      timeout: 1000,
    });
  });



  it('should not rebuild directory tree for same path', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // First open
    await result.current.openRepository('/test/same-project', 'proj-1');

    // Wait for openRepository to complete
    await waitFor(() => {
      expect(result.current.rootPath).toBe('/test/same-project');
    });

    vi.clearAllMocks();

    // Try to open the same path again
    await result.current.openRepository('/test/same-project', 'proj-1');

    // buildDirectoryTree should not be called again
    expect(repositoryService.buildDirectoryTree).not.toHaveBeenCalled();
  });
});


describe('window-scoped-repository-store - rename path updates', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RepositoryStoreProvider>{children}</RepositoryStoreProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update open file path for Windows-style separators', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    const rootPath = 'C:\\Repo';
    const oldPath = 'C:\\Repo\\src\\old.ts';

    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('content');

    await result.current.openRepository(rootPath, 'proj-1');

    await waitFor(() => {
      expect(result.current.rootPath).toBe(rootPath);
    });

    await result.current.selectFile(oldPath);

    await result.current.renameFile(oldPath, 'new.ts');

    expect(repositoryService.renameFile).toHaveBeenCalledWith(oldPath, 'new.ts');
    expect(result.current.openFiles[0]?.path).toBe('C:\\Repo\\src\\new.ts');
  });

  it('should update open files within renamed directory', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    const rootPath = '/repo';
    const oldDir = '/repo/src';
    const fileA = '/repo/src/a.ts';
    const fileB = '/repo/src/sub/b.ts';

    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('content');

    await result.current.openRepository(rootPath, 'proj-1');

    await waitFor(() => {
      expect(result.current.rootPath).toBe(rootPath);
    });

    await act(async () => {
      await result.current.selectFile(fileA);
      await result.current.selectFile(fileB);
    });

    await result.current.renameFile(oldDir, 'lib');

    expect(repositoryService.renameFile).toHaveBeenCalledWith(oldDir, 'lib');
    const paths = result.current.openFiles.map((f) => f.path);
    expect(paths).toContain('/repo/lib/a.ts');
    expect(paths).toContain('/repo/lib/sub/b.ts');
  });
});

describe('window-scoped-repository-store - external file change handling', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RepositoryStoreProvider>{children}</RepositoryStoreProvider>
  );

  const testFilePath = '/test/path/file.ts';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should invalidate cache when external file change is detected', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Call handleExternalFileChange
    result.current.handleExternalFileChange(testFilePath);

    // Verify that invalidateCache was called with the file path
    expect(repositoryService.invalidateCache).toHaveBeenCalledWith(testFilePath);
  });

  it('should handle multiple file changes by invalidating each cache', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    const file1Path = '/test/path/file1.ts';
    const file2Path = '/test/path/file2.ts';

    // Handle external change for multiple files
    result.current.handleExternalFileChange(file1Path);
    result.current.handleExternalFileChange(file2Path);

    // Verify each file's cache was invalidated
    expect(repositoryService.invalidateCache).toHaveBeenCalledWith(file1Path);
    expect(repositoryService.invalidateCache).toHaveBeenCalledWith(file2Path);
  });
});
