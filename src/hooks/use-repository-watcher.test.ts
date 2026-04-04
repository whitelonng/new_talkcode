import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store event listeners for simulation
const eventListeners = new Map<string, ((event: { payload: unknown }) => void)[]>();

// Mock WindowManagerService
const mockGetCurrentWindowLabel = vi.fn().mockResolvedValue('test-window-1');
const mockStartWindowFileWatching = vi.fn().mockResolvedValue(undefined);
const mockStopWindowFileWatching = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/window-manager-service', () => ({
  WindowManagerService: {
    getCurrentWindowLabel: () => mockGetCurrentWindowLabel(),
    startWindowFileWatching: (label: string, path: string) => mockStartWindowFileWatching(label, path),
    stopWindowFileWatching: (label: string) => mockStopWindowFileWatching(label),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, callback: (event: { payload: unknown }) => void) => {
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, []);
    }
    eventListeners.get(eventName)!.push(callback);
    return Promise.resolve(() => {
      const listeners = eventListeners.get(eventName);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    });
  }),
}));

vi.mock('@/services/fast-directory-tree-service', () => ({
  fastDirectoryTreeService: {
    invalidatePath: vi.fn(),
  },
}));

// Mock stores
const mockRefreshStatus = vi.fn();
const mockRefreshFileTree = vi.fn();
const mockHandleExternalFileChange = vi.fn();

vi.mock('@/stores/git-store', () => ({
  useGitStore: {
    getState: () => ({
      refreshStatus: mockRefreshStatus,
    }),
  },
}));

const mockRepositoryState = {
  rootPath: '/test/repo',
  refreshFileTree: mockRefreshFileTree,
  openFiles: [],
  handleExternalFileChange: mockHandleExternalFileChange,
};

const mockUseRepositoryStore = Object.assign(
  (selector: (state: typeof mockRepositoryState) => unknown) => {
    return selector(mockRepositoryState);
  },
  {
    getState: () => mockRepositoryState,
  }
);

vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: mockUseRepositoryStore,
}));

// Helper to emit events
function emitEvent(eventName: string, payload: unknown = {}) {
  const listeners = eventListeners.get(eventName);
  if (listeners) {
    for (const listener of listeners) {
      listener({ payload });
    }
  }
}

describe('useRepositoryWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    eventListeners.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Need to import after mocks are set up
  const getHook = async () => {
    const { useRepositoryWatcher } = await import('./use-repository-watcher');
    return useRepositoryWatcher;
  };

  describe('git-status-changed debouncing', () => {
    it('should debounce multiple rapid git-status-changed events', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      // Wait for listeners to be set up
      await vi.waitFor(() => {
        expect(eventListeners.has('git-status-changed')).toBe(true);
      });

      // Simulate rapid events (like git commit generating multiple .git file changes)
      act(() => {
        emitEvent('git-status-changed', {});
      });
      vi.advanceTimersByTime(50);

      act(() => {
        emitEvent('git-status-changed', {});
      });
      vi.advanceTimersByTime(50);

      act(() => {
        emitEvent('git-status-changed', {});
      });
      vi.advanceTimersByTime(50);

      act(() => {
        emitEvent('git-status-changed', {});
      });

      // Before debounce completes, refresh should not be called
      expect(mockRefreshStatus).not.toHaveBeenCalled();

      // Advance past debounce delay (300ms)
      vi.advanceTimersByTime(300);

      // Should only be called once despite 4 events
      expect(mockRefreshStatus).toHaveBeenCalledTimes(1);
    });

    it('should call refreshStatus after debounce delay for single event', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('git-status-changed')).toBe(true);
      });

      act(() => {
        emitEvent('git-status-changed', {});
      });

      // Not called immediately
      expect(mockRefreshStatus).not.toHaveBeenCalled();

      // Called after delay
      vi.advanceTimersByTime(300);
      expect(mockRefreshStatus).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on new event', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('git-status-changed')).toBe(true);
      });

      // First event
      act(() => {
        emitEvent('git-status-changed', {});
      });

      // Wait 200ms (not enough to trigger)
      vi.advanceTimersByTime(200);
      expect(mockRefreshStatus).not.toHaveBeenCalled();

      // Second event resets timer
      act(() => {
        emitEvent('git-status-changed', {});
      });

      // Another 200ms (still not enough from second event)
      vi.advanceTimersByTime(200);
      expect(mockRefreshStatus).not.toHaveBeenCalled();

      // Another 100ms completes the debounce from second event
      vi.advanceTimersByTime(100);
      expect(mockRefreshStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should cancel pending timeouts on unmount', async () => {
      const useRepositoryWatcher = await getHook();

      const { unmount } = renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('git-status-changed')).toBe(true);
      });

      // Emit event but unmount before debounce completes
      act(() => {
        emitEvent('git-status-changed', {});
      });
      vi.advanceTimersByTime(100);

      unmount();

      // Advance past debounce
      vi.advanceTimersByTime(300);

      // Should not have been called since component unmounted
      expect(mockRefreshStatus).not.toHaveBeenCalled();
    });
  });

  describe('file-system-changed handling', () => {
    it('should trigger external file refresh for open files in multi-path payload', async () => {
      const useRepositoryWatcher = await getHook();

      mockRepositoryState.openFiles = [
        { path: '/test/repo/file1.ts', content: 'a', isLoading: false, error: null },
        { path: '/test/repo/file2.ts', content: 'b', isLoading: false, error: null },
      ];

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('file-system-changed')).toBe(true);
      });

      act(() => {
        emitEvent('file-system-changed', [
          '/test/repo/file1.ts',
          '/test/repo/file1.ts',
          '/test/repo/file3.ts',
        ]);
      });

      vi.advanceTimersByTime(150);

      expect(mockHandleExternalFileChange).toHaveBeenCalledTimes(1);
      expect(mockHandleExternalFileChange).toHaveBeenCalledWith('/test/repo/file1.ts');
    });

    it('should handle single object payload with path', async () => {
      const useRepositoryWatcher = await getHook();

      mockRepositoryState.openFiles = [
        { path: '/test/repo/file1.ts', content: 'a', isLoading: false, error: null },
      ];

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('file-system-changed')).toBe(true);
      });

      act(() => {
        emitEvent('file-system-changed', { path: '/test/repo/file1.ts' });
      });

      vi.advanceTimersByTime(150);

      expect(mockHandleExternalFileChange).toHaveBeenCalledTimes(1);
      expect(mockHandleExternalFileChange).toHaveBeenCalledWith('/test/repo/file1.ts');
    });

    it('should handle payload with paths array', async () => {
      const useRepositoryWatcher = await getHook();

      mockRepositoryState.openFiles = [
        { path: '/test/repo/file2.ts', content: 'b', isLoading: false, error: null },
      ];

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('file-system-changed')).toBe(true);
      });

      act(() => {
        emitEvent('file-system-changed', { paths: ['/test/repo/file2.ts', '/test/repo/file3.ts'] });
      });

      vi.advanceTimersByTime(150);

      expect(mockHandleExternalFileChange).toHaveBeenCalledTimes(1);
      expect(mockHandleExternalFileChange).toHaveBeenCalledWith('/test/repo/file2.ts');
    });

    it('should debounce file tree refresh', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('file-system-changed')).toBe(true);
      });

      // Multiple file changes
      act(() => {
        emitEvent('file-system-changed', ['/test/repo/file1.ts']);
      });
      act(() => {
        emitEvent('file-system-changed', ['/test/repo/file2.ts']);
      });
      act(() => {
        emitEvent('file-system-changed', ['/test/repo/file3.ts']);
      });

      // Before debounce completes
      expect(mockRefreshFileTree).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);

      // Should only refresh once
      expect(mockRefreshFileTree).toHaveBeenCalledTimes(1);
    });

    it('should also trigger git status refresh on file changes', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('file-system-changed')).toBe(true);
      });

      act(() => {
        emitEvent('file-system-changed', ['/test/repo/file.ts']);
      });

      vi.advanceTimersByTime(300);

      // Git status should also be refreshed when files change
      expect(mockRefreshStatus).toHaveBeenCalled();
    });
  });

  describe('event listener setup', () => {
    it('should set up listeners for both events', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(eventListeners.has('file-system-changed')).toBe(true);
        expect(eventListeners.has('git-status-changed')).toBe(true);
      });
    });

    it('should start window-specific file watching on mount', async () => {
      const useRepositoryWatcher = await getHook();

      renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        // Should get current window label
        expect(mockGetCurrentWindowLabel).toHaveBeenCalled();
        // Should start watching for this specific window
        expect(mockStartWindowFileWatching).toHaveBeenCalledWith('test-window-1', '/test/repo');
      });
    });

    it('should stop window-specific file watching on unmount', async () => {
      const useRepositoryWatcher = await getHook();

      const { unmount } = renderHook(() => useRepositoryWatcher());

      await vi.waitFor(() => {
        expect(mockStartWindowFileWatching).toHaveBeenCalledWith('test-window-1', '/test/repo');
      });

      unmount();

      await vi.waitFor(() => {
        expect(mockStopWindowFileWatching).toHaveBeenCalledWith('test-window-1');
      });
    });

    it('should support multiple windows with different labels', async () => {
      // Simulate different window labels for different instances
      mockGetCurrentWindowLabel
        .mockResolvedValueOnce('window-project-a')
        .mockResolvedValueOnce('window-project-b');

      const useRepositoryWatcher = await getHook();

      // First window
      const { unmount: unmount1 } = renderHook(() => useRepositoryWatcher());
      await vi.waitFor(() => {
        expect(mockStartWindowFileWatching).toHaveBeenCalledWith('window-project-a', '/test/repo');
      });

      // Second window
      const { unmount: unmount2 } = renderHook(() => useRepositoryWatcher());
      await vi.waitFor(() => {
        expect(mockStartWindowFileWatching).toHaveBeenCalledWith('window-project-b', '/test/repo');
      });

      // Each window should have its own watcher
      expect(mockStartWindowFileWatching).toHaveBeenCalledTimes(2);

      // Cleanup
      unmount1();
      unmount2();
    });
  });
});
