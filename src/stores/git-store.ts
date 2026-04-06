import { toast } from 'sonner';
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { gitService } from '@/services/git-service';
import type {
  BranchInfo,
  CommitLogEntry,
  FileStatusMap,
  GitStatus,
  LineChange,
  RemoteInfo,
} from '@/types/git';
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

  // Branch state
  branches: BranchInfo[];
  isBranchesLoading: boolean;

  // Remote state
  remotes: RemoteInfo[];
  isRemotesLoading: boolean;

  // Commit log state
  commitLog: CommitLogEntry[];
  isCommitLogLoading: boolean;
  commitLogBranch: string | null;

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

  // Branch actions
  loadBranches: () => Promise<void>;
  checkoutBranch: (branchName: string) => Promise<void>;
  createBranch: (branchName: string, checkout: boolean) => Promise<void>;
  deleteBranch: (branchName: string, force: boolean) => Promise<void>;

  // Remote actions
  loadRemotes: () => Promise<void>;
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string) => Promise<void>;

  // Commit log actions
  loadCommitLog: (maxCount?: number, branchName?: string) => Promise<void>;
  loadMoreCommits: () => Promise<void>;

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

  // Branch state
  branches: [],
  isBranchesLoading: false,

  // Remote state
  remotes: [],
  isRemotesLoading: false,

  // Commit log state
  commitLog: [],
  isCommitLogLoading: false,
  commitLogBranch: null,

  // Initialize Git for a repository
  initialize: async (repoPath: string) => {
    logger.info(`Initializing Git for repository: ${repoPath}`);
    set({ isLoading: true, error: null, repositoryPath: repoPath });

    try {
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

      await get().refreshStatus();
      // Load branches and remotes in background
      get().loadBranches();
      get().loadRemotes();
      get().loadCommitLog();
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
      const [gitStatus, fileStatuses] = await Promise.all([
        gitService.getStatus(repositoryPath),
        gitService.getAllFileStatuses(repositoryPath),
      ]);

      if (Object.keys(fileStatuses).length > 0) {
        logger.debug('Sample file paths in status map:', Object.keys(fileStatuses).slice(0, 5));
      }

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

    if (!repositoryPath || !isGitRepository) {
      return null;
    }

    let status = fileStatuses[filePath];

    if (status) {
      return status[0];
    }

    if (filePath.startsWith(repositoryPath)) {
      const normalizedRepoPath = repositoryPath.replace(/\/$/, '');
      const relativePath = filePath.slice(normalizedRepoPath.length).replace(/^\//, '');

      status = fileStatuses[relativePath];

      if (status) {
        return status[0];
      }
    } else {
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

    let status = fileStatuses[filePath];

    if (status) {
      return status[1];
    }

    if (filePath.startsWith(repositoryPath)) {
      const normalizedRepoPath = repositoryPath.replace(/\/$/, '');
      const relativePath = filePath.slice(normalizedRepoPath.length).replace(/^\//, '');
      status = fileStatuses[relativePath];

      if (status) {
        return status[1];
      }
    } else {
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

    if (lineChangesCache.has(filePath)) {
      logger.debug(`Cache hit for line changes: ${filePath}`);
      return lineChangesCache.get(filePath) || [];
    }

    if (fetchingPromises.has(filePath)) {
      logger.debug(`Fetch already in progress for ${filePath}, waiting...`);
      return fetchingPromises.get(filePath) as Promise<LineChange[]>;
    }

    logger.debug(`Cache miss for line changes: ${filePath}, fetching...`);

    const fetchPromise = (async () => {
      try {
        const lineChanges = await gitService.getLineChanges(repositoryPath, filePath);
        get().setLineChanges(filePath, lineChanges);
        return lineChanges;
      } catch (error) {
        logger.error(`Failed to get line changes for ${filePath}:`, error);
        return [];
      } finally {
        fetchingPromises.delete(filePath);
      }
    })();

    fetchingPromises.set(filePath, fetchPromise);

    return fetchPromise;
  },

  setLineChanges: (filePath: string, changes: LineChange[]): void => {
    const { lineChangesCache } = get();
    lineChangesCache.set(filePath, changes);
    logger.debug(`Cached line changes for: ${filePath} (${changes.length} changes)`);
  },

  clearLineChangesCache: (): void => {
    const { lineChangesCache } = get();
    const count = lineChangesCache.size;
    lineChangesCache.clear();
    fetchingPromises.clear();
    logger.debug(`Cleared line changes cache (${count} entries)`);
  },

  clearState: () => {
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
      branches: [],
      isBranchesLoading: false,
      remotes: [],
      isRemotesLoading: false,
      commitLog: [],
      isCommitLogLoading: false,
      commitLogBranch: null,
      selectedFiles: new Set(),
      commitMessage: '',
      isStaging: false,
      isCommitting: false,
      isPushing: false,
      isPulling: false,
    });
  },

  // ============================================================================
  // Branch Actions
  // ============================================================================

  loadBranches: async () => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    set({ isBranchesLoading: true });
    try {
      const branches = await gitService.listBranches(repositoryPath);
      set({ branches, isBranchesLoading: false });
    } catch (error) {
      logger.error('Failed to load branches:', error);
      set({ isBranchesLoading: false });
    }
  },

  checkoutBranch: async (branchName: string) => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    try {
      await gitService.checkoutBranch(repositoryPath, branchName);
      toast.success(`Switched to ${branchName}`);
      await Promise.all([get().refreshStatus(), get().loadBranches(), get().loadCommitLog()]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to switch branch';
      logger.error('Failed to checkout branch:', error);
      toast.error(msg);
    }
  },

  createBranch: async (branchName: string, checkout: boolean) => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    try {
      await gitService.createBranch(repositoryPath, branchName, checkout);
      toast.success(`Branch '${branchName}' created`);
      await Promise.all([get().refreshStatus(), get().loadBranches()]);
      if (checkout) {
        await get().loadCommitLog();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create branch';
      logger.error('Failed to create branch:', error);
      toast.error(msg);
    }
  },

  deleteBranch: async (branchName: string, force: boolean) => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    try {
      await gitService.deleteBranch(repositoryPath, branchName, force);
      toast.success(`Branch '${branchName}' deleted`);
      await get().loadBranches();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete branch';
      logger.error('Failed to delete branch:', error);
      toast.error(msg);
    }
  },

  // ============================================================================
  // Remote Actions
  // ============================================================================

  loadRemotes: async () => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    set({ isRemotesLoading: true });
    try {
      const remotes = await gitService.getRemotes(repositoryPath);
      set({ remotes, isRemotesLoading: false });
    } catch (error) {
      logger.error('Failed to load remotes:', error);
      set({ isRemotesLoading: false });
    }
  },

  addRemote: async (name: string, url: string) => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    try {
      await gitService.addRemote(repositoryPath, name, url);
      toast.success(`Remote '${name}' added`);
      await get().loadRemotes();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to add remote';
      logger.error('Failed to add remote:', error);
      toast.error(msg);
    }
  },

  removeRemote: async (name: string) => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    try {
      await gitService.removeRemote(repositoryPath, name);
      toast.success(`Remote '${name}' removed`);
      await get().loadRemotes();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to remove remote';
      logger.error('Failed to remove remote:', error);
      toast.error(msg);
    }
  },

  // ============================================================================
  // Commit Log Actions
  // ============================================================================

  loadCommitLog: async (maxCount?: number, branchName?: string) => {
    const { repositoryPath, isGitRepository } = get();
    if (!repositoryPath || !isGitRepository) return;

    set({ isCommitLogLoading: true, commitLogBranch: branchName ?? null });
    try {
      const commitLog = await gitService.getCommitLog(repositoryPath, maxCount ?? 50, branchName);
      set({ commitLog, isCommitLogLoading: false });
    } catch (error) {
      logger.error('Failed to load commit log:', error);
      set({ isCommitLogLoading: false });
    }
  },

  loadMoreCommits: async () => {
    const { repositoryPath, isGitRepository, commitLog, commitLogBranch } = get();
    if (!repositoryPath || !isGitRepository) return;

    set({ isCommitLogLoading: true });
    try {
      const moreCommits = await gitService.getCommitLog(
        repositoryPath,
        commitLog.length + 50,
        commitLogBranch ?? undefined
      );
      set({ commitLog: moreCommits, isCommitLogLoading: false });
    } catch (error) {
      logger.error('Failed to load more commits:', error);
      set({ isCommitLogLoading: false });
    }
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
      await Promise.all([get().refreshStatus(), get().loadCommitLog()]);
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
      await Promise.all([get().refreshStatus(), get().loadBranches()]);
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
      await Promise.all([get().refreshStatus(), get().loadBranches(), get().loadCommitLog()]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to pull';
      logger.error('Failed to pull:', error);
      toast.error(msg);
      set({ error: msg, isPulling: false });
    }
  },
}));
