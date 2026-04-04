import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { fastDirectoryTreeService } from '@/services/fast-directory-tree-service';
import { WindowManagerService } from '@/services/window-manager-service';
import { useGitStore } from '@/stores/git-store';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';

const GIT_STATUS_DEBOUNCE_DELAY = 300; // ms
const FILE_TREE_DEBOUNCE_DELAY = 200; // ms

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeFileSystemPaths = (payload: unknown): string[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isNonEmptyString);
  }

  if (isNonEmptyString(payload)) {
    return [payload];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as { path?: unknown; paths?: unknown };
    if (Array.isArray(record.paths)) {
      return record.paths.filter(isNonEmptyString);
    }
    if (isNonEmptyString(record.path)) {
      return [record.path];
    }
  }

  return [];
};

/**
 * Hook to set up file system watching for the currently open repository
 * This should be called in components that need to monitor file system changes
 */
export function useRepositoryWatcher() {
  const rootPath = useRepositoryStore((state) => state.rootPath);
  const refreshFileTree = useRepositoryStore((state) => state.refreshFileTree);
  const openFiles = useRepositoryStore((state) => state.openFiles);
  const handleExternalFileChange = useRepositoryStore((state) => state.handleExternalFileChange);

  // Use refs to access current state values in event callbacks
  const openFilesRef = useRef(openFiles);
  const handleExternalFileChangeRef = useRef(handleExternalFileChange);

  // Keep refs updated
  useEffect(() => {
    openFilesRef.current = openFiles;
    handleExternalFileChangeRef.current = handleExternalFileChange;
  }, [openFiles, handleExternalFileChange]);

  // Use refs to store timeout IDs for proper cleanup and debouncing
  const gitStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileTreeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileChangeGitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Properly debounced git status refresh - cancels previous timeout
  const debouncedRefreshGitStatus = useCallback(() => {
    if (gitStatusTimeoutRef.current) {
      clearTimeout(gitStatusTimeoutRef.current);
    }

    gitStatusTimeoutRef.current = setTimeout(() => {
      useGitStore.getState().refreshStatus();
      gitStatusTimeoutRef.current = null;
    }, GIT_STATUS_DEBOUNCE_DELAY);
  }, []);

  // Properly debounced file tree refresh - cancels previous timeout
  const debouncedRefreshFileTree = useCallback(() => {
    if (fileTreeTimeoutRef.current) {
      clearTimeout(fileTreeTimeoutRef.current);
    }

    fileTreeTimeoutRef.current = setTimeout(() => {
      refreshFileTree();
      fileTreeTimeoutRef.current = null;
    }, FILE_TREE_DEBOUNCE_DELAY);
  }, [refreshFileTree]);

  // Properly debounced git status refresh for file changes - cancels previous timeout
  const debouncedRefreshGitStatusForFileChange = useCallback(() => {
    if (fileChangeGitTimeoutRef.current) {
      clearTimeout(fileChangeGitTimeoutRef.current);
    }

    fileChangeGitTimeoutRef.current = setTimeout(() => {
      useGitStore.getState().refreshStatus();
      fileChangeGitTimeoutRef.current = null;
    }, GIT_STATUS_DEBOUNCE_DELAY);
  }, []);

  // Store window label ref for cleanup
  const windowLabelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rootPath) {
      return;
    }

    // Start file watching with window-specific watcher
    const startWatching = async () => {
      try {
        // Get current window label for window-specific file watching
        const windowLabel = await WindowManagerService.getCurrentWindowLabel();
        windowLabelRef.current = windowLabel;

        // Use window-specific file watching to support multiple windows
        await WindowManagerService.startWindowFileWatching(windowLabel, rootPath);
        logger.info(`File watching started for window ${windowLabel} at:`, rootPath);
      } catch (error) {
        logger.error('Failed to start file watching:', error);
      }
    };

    startWatching();

    // Listen for file system changes
    const unlistenFileSystem = listen('file-system-changed', (event) => {
      const changedPaths = normalizeFileSystemPaths(event.payload);

      if (changedPaths.length > 0) {
        const uniquePaths = Array.from(new Set(changedPaths));
        const currentOpenFiles = openFilesRef.current;
        const openFilePaths = new Set(currentOpenFiles.map((file) => file.path));

        for (const changedPath of uniquePaths) {
          fastDirectoryTreeService.invalidatePath(changedPath);

          // If the changed file is currently open, refresh its content
          if (openFilePaths.has(changedPath)) {
            setTimeout(() => {
              handleExternalFileChangeRef.current(changedPath);
            }, 100);
          }
        }
      }

      // Debounced refresh of file tree
      debouncedRefreshFileTree();

      // Also debounced refresh git status when working directory files change
      // This is needed because .git directory only changes on git add/commit,
      // but git status should reflect working directory changes immediately
      debouncedRefreshGitStatusForFileChange();
    });

    // Listen for git status changes (from .git directory watcher)
    const unlistenGitStatus = listen('git-status-changed', () => {
      debouncedRefreshGitStatus();
    });

    return () => {
      // Clear all pending timeouts on cleanup
      if (gitStatusTimeoutRef.current) {
        clearTimeout(gitStatusTimeoutRef.current);
        gitStatusTimeoutRef.current = null;
      }
      if (fileTreeTimeoutRef.current) {
        clearTimeout(fileTreeTimeoutRef.current);
        fileTreeTimeoutRef.current = null;
      }
      if (fileChangeGitTimeoutRef.current) {
        clearTimeout(fileChangeGitTimeoutRef.current);
        fileChangeGitTimeoutRef.current = null;
      }

      unlistenFileSystem.then((fn) => fn());
      unlistenGitStatus.then((fn) => fn());

      // Stop window-specific file watching
      if (windowLabelRef.current) {
        WindowManagerService.stopWindowFileWatching(windowLabelRef.current).catch(logger.error);
      }
    };
  }, [
    rootPath,
    debouncedRefreshGitStatus,
    debouncedRefreshFileTree,
    debouncedRefreshGitStatusForFileChange,
  ]);
}
