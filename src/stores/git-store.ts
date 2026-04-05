import { toast } from 'sonner';
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { gitService } from '@/services/git-service';
import type { FileStatusMap, GitStatus, LineChange } from '@/types/git';
import { GitFileStatus } from '@/types/git';

interface GitStore {
  // State
  repositoryPath: string | null;
  isGitRepository: boolean;
  gitStatus: GitStatus | null;
  fileStatuses: FileStatusMap;
  lineChangesCache: Map<string, LineChange[]>;
  isLoading: boolean;
  error: string | null;
  lastRefresh: number | null;

  // Actions
  initialize: (repoPath: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  getFileStatus: (filePath: string) => GitFileStatus | null;
  isFileModified: (filePath: string) => boolean;
  isFileStaged: (filePath: string) => boolean;
  getLineChanges: (filePath: string) => Promise<LineChange[]>;
  setLineChanges: (filePath: string, changes: LineChange[]) => void;
  clearLineChangesCache: () => void;
  clearState: () => void;

  // Git Panel State
  selectedFiles: Set<string>;
  commitMessage: string;
  isStaging: boolean;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;

  // Git Panel Actions
  toggleFileSelection: (filePath: string) => void;
  selectAllFiles: (files: string[]) => void;
  clearSelection: () => void;
  setCommitMessage: (message: string) => void;
  stageSelected: () => Promise<void>;
  unstageSelected: () => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commitStaged: () => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
}

// Track in-flight requests to prevent duplicate fetches
const fetchingPromises = new Map<string, Promise<LineChange[]>>();

export const useGitStore = create<GitStore>((set, get) => ({
  // Initial state
  repositoryPath: null,
  isGitRepository: false,
  gitStatus: null,
  fileStatuses: {},
  lineChangesCache: new Map(),
  isLoading: false,
  error: null,
  lastRefresh: null,

  // Initialize Git for a repository
  initialize: async (repoPath: string) => {
    logger.info(`Initializing Git for repository: ${repoPath}`);
    set({ isLoading: true, error: null, repositoryPath: repoPath });

    try {
      // Check if it's a Git repository
      const isRepo = await gitService.isRepository(repoPath);

      if (!isRepo) {
        logger.info(`${repoPath} is not a Git repository`);
        set({
          isGitRepository: false,
          gitStatus: null,
          fileStatuses: {},
          isLoading: false,
        });
        return;
      }

      logger.info(`${repoPath} is a valid Git repository`);
      set({ isGitRepository: true });

      // Get initial Git status
      await get().refreshStatus();
      logger.info('Git initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize Git:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize Git',
        isLoading: false,
      });
    }
  },

  // Refresh Git status
  refreshStatus: async () => {
    const { repositoryPath, isGitRepository } = get();

    if (!repositoryPath || !isGitRepository) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Get full Git status
      const [gitStatus, fileStatuses] = await Promise.all([
        gitService.getStatus(repositoryPath),
        gitService.getAllFileStatuses(repositoryPath),
      ]);

      if (Object.keys(fileStatuses).length > 0) {
        logger.debug('Sample file paths in status map:', Object.keys(fileStatuses).slice(0, 5));
      }

      // Clear line changes cache since Git status has changed
      get().clearLineChangesCache();

      set({
        gitStatus,
        fileStatuses,
        isLoading: false,
        lastRefresh: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to refresh Git status:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh Git status',
        isLoading: false,
      });
    }
  },

  // Get status for a specific file
  getFileStatus: (filePath: string): GitFileStatus | null => {
    const { fileStatuses, repositoryPath, isGitRepository } = get();

    // Silently return null if Git is not initialized yet or not a Git repository
    if (!repositoryPath || !isGitRepository) {
      return null;
    }

    // Try with absolute path first
    let status = fileStatuses[filePath];

    if (status) {
      return status[0];
    }

    // If not found, try with relative path
    if (filePath.startsWith(repositoryPath)) {
      // Normalize repository path (remove trailing slash)
      const normalizedRepoPath = repositoryPath.replace(/\/$/, '');
      const relativePath = filePath.slice(normalizedRepoPath.length).replace(/^\//, '');

      status = fileStatuses[relativePath];

      if (status) {
        return status[0];
      }
    } else {
      // FilePath doesn't start with repositoryPath, try as relative path directly
      status = fileStatuses[filePath];
      if (status) {
        return status[0];
      }
    }

    return null;
  },

  // Check if a file is modified
  isFileModified: (filePath: string): boolean => {
    const status = get().getFileStatus(filePath);
    return (
      status === GitFileStatus.Modified ||
      status === GitFileStatus.Deleted ||
      status === GitFileStatus.Added
    );
  },

  // Check if a file is staged
  isFileStaged: (filePath: string): boolean => {
    const { fileStatuses, repositoryPath } = get();

    if (!repositoryPath) {
      return false;
    }

    // Try with absolute path first
    let status = fileStatuses[filePath];

    if (status) {
      return status[1];
    }

    // If not found, try with relative path
    if (filePath.startsWith(repositoryPath)) {
      // Normalize repository path (remove trailing slash)
      const normalizedRepoPath = repositoryPath.replace(/\/$/, '');
      const relativePath = filePath.slice(normalizedRepoPath.length).replace(/^\//, '');
      status = fileStatuses[relativePath];

      if (status) {
        return status[1];
      }
    } else {
      // FilePath doesn't start with repositoryPath, try as relative path directly
      status = fileStatuses[filePath];
      if (status) {
        return status[1];
      }
    }

    return false;
  },

  // Get line changes for a file (with caching and duplicate fetch prevention)
  getLineChanges: async (filePath: string): Promise<LineChange[]> => {
    const { lineChangesCache, repositoryPath, isGitRepository } = get();

    if (!repositoryPath || !isGitRepository) {
      return [];
    }

    // Check cache first
    if (lineChangesCache.has(filePath)) {
      logger.debug(`Cache hit for line changes: ${filePath}`);
      return lineChangesCache.get(filePath) || [];
    }

    // Check if already fetching this file
    if (fetchingPromises.has(filePath)) {
      logger.debug(`Fetch already in progress for ${filePath}, waiting...`);
      return fetchingPromises.get(filePath) as Promise<LineChange[]>;
    }

    // Cache miss - fetch from backend
    logger.debug(`Cache miss for line changes: ${filePath}, fetching...`);

    // Create and track the fetch promise
    const fetchPromise = (async () => {
      try {
        const lineChanges = await gitService.getLineChanges(repositoryPath, filePath);

        // Store in cache
        get().setLineChanges(filePath, lineChanges);

        return lineChanges;
      } catch (error) {
        logger.error(`Failed to get line changes for ${filePath}:`, error);
        return [];
      } finally {
        // Remove from tracking map when done
        fetchingPromises.delete(filePath);
      }
    })();

    // Track this promise
    fetchingPromises.set(filePath, fetchPromise);

    return fetchPromise;
  },

  // Set line changes in cache
  setLineChanges: (filePath: string, changes: LineChange[]): void => {
    const { lineChangesCache } = get();
    lineChangesCache.set(filePath, changes);
    logger.debug(`Cached line changes for: ${filePath} (${changes.length} changes)`);
  },

  // Clear line changes cache
  clearLineChangesCache: (): void => {
    const { lineChangesCache } = get();
    const count = lineChangesCache.size;
    lineChangesCache.clear();
    fetchingPromises.clear(); // Also clear in-flight requests
    logger.debug(`Cleared line changes cache (${count} entries)`);
  },

  // Clear all Git state
  clearState: () => {
    // Clear the cache before resetting state
    get().clearLineChangesCache();

    set({
      repositoryPath: null,
      isGitRepository: false,
      gitStatus: null,
      fileStatuses: {},
      lineChangesCache: new Map(),
      isLoading: false,
      error: null,
      lastRefresh: null,
      selectedFiles: new Set(),
      commitMessage: '',
      isStaging: false,
      isCommitting: false,
      isPushing: false,
      isPulling: false,
    });
  },

  // Git Panel Initial State
  selectedFiles: new Set(),
  commitMessage: '',
  isStaging: false,
  isCommitting: false,
  isPushing: false,
  isPulling: false,

  // Git Panel Actions
  toggleFileSelection: (filePath: string) => {
    const { selectedFiles } = get();
    const next = new Set(selectedFiles);
    if (next.has(filePath)) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    set({ selectedFiles: next });
  },

  selectAllFiles: (files: string[]) => {
    set({ selectedFiles: new Set(files) });
  },

  clearSelection: () => {
    set({ selectedFiles: new Set() });
  },

  setCommitMessage: (message: string) => {
    set({ commitMessage: message });
  },

  stageSelected: async () => {
    const { repositoryPath, isGitRepository, selectedFiles } = get();
    if (!repositoryPath || !isGitRepository) return;

    const files = Array.from(selectedFiles);
    if (files.length === 0) return;

    logger.info(`Staging ${files.length} selected files`);
    set({ isStaging: true, error: null });

    try {
      await gitService.stageFiles(repositoryPath, files);
      logger.info('Successfully staged selected files');
      set({ isStaging: false });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to stage files';
      logger.error('Failed to stage selected files:', error);
      toast.error(msg);
      set({ error: msg, isStaging: false });
    }
  },

  unstageSelected: async () => {
    const { repositoryPath, isGitRepository, selectedFiles } = get();
    if (!repositoryPath || !isGitRepository) return;

    const files = Array.from(selectedFiles);
    if (files.length === 0) return;

    logger.info(`Unstaging ${files.length} selected files`);
    set({ isStaging: true, error: null });

    try {
      await gitService.unstageFiles(repositoryPath, files);
      logger.info('Successfully unstaged selected files');
      set({ isStaging: false });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to unstage files';
      logger.error('Failed to unstage selected files:', error);
      toast.error(msg);
      set({ error: msg, isStaging: false });
    }
  },

  stageAll: async () => {
    const { repositoryPath, isGitRepository, fileStatuses } = get();
    if (!repositoryPath || !isGitRepository) return;

    const files = Object.keys(fileStatuses);
    if (files.length === 0) return;

    logger.info(`Staging all ${files.length} files`);
    set({ isStaging: true, error: null });

    try {
      await gitService.stageFiles(repositoryPath, files);
      logger.info('Successfully staged all files');
      set({ isStaging: false });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to stage all files';
      logger.error('Failed to stage all files:', error);
      toast.error(msg);
      set({ error: msg, isStaging: false });
    }
  },

  unstageAll: async () => {
    const { repositoryPath, isGitRepository, fileStatuses } = get();
    if (!repositoryPath || !isGitRepository) return;

    const files = Object.keys(fileStatuses);
    if (files.length === 0) return;

    logger.info(`Unstaging all ${files.length} files`);
    set({ isStaging: true, error: null });

    try {
      await gitService.unstageFiles(repositoryPath, files);
      logger.info('Successfully unstaged all files');
      set({ isStaging: false });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to unstage all files';
      logger.error('Failed to unstage all files:', error);
      toast.error(msg);
      set({ error: msg, isStaging: false });
    }
  },

  commitStaged: async () => {
    const { repositoryPath, isGitRepository, commitMessage } = get();
    if (!repositoryPath || !isGitRepository) return;

    if (!commitMessage.trim()) {
      set({ error: 'Commit message cannot be empty' });
      return;
    }

    logger.info('Committing staged changes');
    set({ isCommitting: true, error: null });

    try {
      await gitService.commitStaged(repositoryPath, commitMessage.trim());
      logger.info('Successfully committed staged changes');
      toast.success('Changes committed successfully');
      set({ isCommitting: false, commitMessage: '' });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to commit';
      logger.error('Failed to commit:', error);
      toast.error(msg);
      set({ error: msg, isCommitting: false });
    }
  },

  push: async () => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    logger.info('Pushing to remote');
    set({ isPushing: true, error: null });

    try {
      await gitService.push(repositoryPath);
      logger.info('Successfully pushed to remote');
      toast.success('Pushed to remote successfully');
      set({ isPushing: false });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to push';
      logger.error('Failed to push:', error);
      toast.error(msg);
      set({ error: msg, isPushing: false });
    }
  },

  pull: async () => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    logger.info('Pulling from remote');
    set({ isPulling: true, error: null });

    try {
      await gitService.pull(repositoryPath);
      logger.info('Successfully pulled from remote');
      toast.success('Pulled from remote successfully');
      set({ isPulling: false });
      await get().refreshStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to pull';
      logger.error('Failed to pull:', error);
      toast.error(msg);
      set({ error: msg, isPulling: false });
    }
  },
}));
