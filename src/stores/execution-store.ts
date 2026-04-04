// src/stores/execution-store.ts
/**
 * ExecutionStore - Runtime execution state management
 *
 * This store manages ephemeral (non-persisted) execution state:
 * - Task execution status (running, stopped, completed, error)
 * - Abort controllers for cancellation
 * - Streaming content for UI display
 * - Server status messages
 *
 * Design principles:
 * - Ephemeral state only - nothing is persisted to database
 * - Supports concurrent task execution (max 3 by default)
 * - Each task has isolated execution state
 */

import { create } from 'zustand';
import { logger } from '@/lib/logger';

// Cache for running task IDs to prevent unnecessary re-renders
let cachedRunningIds: {
  ids: string[];
  version: number;
  lastExecutionSize: number;
} = {
  ids: [],
  version: 0,
  lastExecutionSize: 0,
};

// Helper function to check if running IDs actually changed
function getRunningIdsWithCache(executions: Map<string, TaskExecution>): string[] {
  const runningIds = Array.from(executions.values())
    .filter((e) => e.status === 'running')
    .map((e) => e.taskId);

  // Check if cache is still valid
  if (
    cachedRunningIds.ids.length === runningIds.length &&
    cachedRunningIds.lastExecutionSize === executions.size &&
    cachedRunningIds.ids.every((id, index) => id === runningIds[index])
  ) {
    return cachedRunningIds.ids;
  }

  // Update cache
  cachedRunningIds = {
    ids: runningIds,
    version: cachedRunningIds.version + 1,
    lastExecutionSize: executions.size,
  };

  return cachedRunningIds.ids;
}

/**
 * Execution status for a task
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'stopped' | 'error';

/**
 * Execution state for a single task
 */
export interface TaskExecution {
  taskId: string;
  status: ExecutionStatus;
  abortController: AbortController;
  error?: string;
  startTime: Date;

  // Streaming state
  streamingContent: string;
  isStreaming: boolean;

  // Server status message (e.g., "Thinking...", "Executing tool...")
  serverStatus: string;
}

export interface ExecutionState {
  // Execution state (taskId -> TaskExecution)
  executions: Map<string, TaskExecution>;

  // Configuration
  maxConcurrent: number;

  // ============================================
  // Actions
  // ============================================

  /**
   * Start execution for a task.
   * Returns success status and abort controller if successful.
   */
  startExecution: (taskId: string) => {
    success: boolean;
    abortController?: AbortController;
    error?: string;
  };

  /**
   * Stop execution for a task
   */
  stopExecution: (taskId: string) => void;

  /**
   * Mark execution as completed
   */
  completeExecution: (taskId: string) => void;

  /**
   * Set error for a task
   */
  setError: (taskId: string, error: string) => void;

  /**
   * Update streaming content for a task
   */
  updateStreamingContent: (taskId: string, content: string, append?: boolean) => void;

  /**
   * Clear streaming content for a task
   */
  clearStreamingContent: (taskId: string) => void;

  /**
   * Set streaming state
   */
  setIsStreaming: (taskId: string, isStreaming: boolean) => void;

  /**
   * Set server status message
   */
  setServerStatus: (taskId: string, status: string) => void;

  /**
   * Clean up execution state for a task
   */
  cleanupExecution: (taskId: string) => void;

  // ============================================
  // Selectors
  // ============================================

  /**
   * Check if a task is running
   */
  isRunning: (taskId: string) => boolean;

  /**
   * Check if a task is running (alias for backward compatibility)
   */
  isTaskRunning: (taskId: string) => boolean;

  /**
   * Get execution state for a task
   */
  getExecution: (taskId: string) => TaskExecution | undefined;

  /**
   * Get all running task IDs
   */
  getRunningTaskIds: () => string[];

  /**
   * Check if max concurrent executions reached
   */
  isMaxReached: () => boolean;

  /**
   * Get current running count
   */
  getRunningCount: () => number;

  /**
   * Check if a new execution can be started
   */
  canStartNew: () => boolean;
}

const DEFAULT_MAX_CONCURRENT = 5;

export const useExecutionStore = create<ExecutionState>()((set, get) => ({
  executions: new Map(),
  maxConcurrent: DEFAULT_MAX_CONCURRENT,

  // ============================================
  // Actions
  // ============================================

  startExecution: (taskId) => {
    const state = get();
    const existing = state.executions.get(taskId);

    // Check if already running
    if (existing?.status === 'running') {
      logger.warn('[ExecutionStore] Task already running', { taskId });
      return { success: false, error: 'Task is already running' };
    }

    // Check concurrency limit
    const runningCount = state.getRunningCount();
    if (runningCount >= state.maxConcurrent) {
      logger.warn('[ExecutionStore] Max concurrent executions reached', {
        taskId,
        runningCount,
        max: state.maxConcurrent,
      });
      return {
        success: false,
        error: `Maximum ${state.maxConcurrent} concurrent tasks reached`,
      };
    }

    const abortController = new AbortController();

    set((state) => {
      const newExecutions = new Map(state.executions);
      newExecutions.set(taskId, {
        taskId,
        status: 'running',
        abortController,
        startTime: new Date(),
        streamingContent: '',
        isStreaming: false,
        serverStatus: '',
      });
      return { executions: newExecutions };
    });

    return { success: true, abortController };
  },

  stopExecution: (taskId) => {
    const execution = get().executions.get(taskId);
    if (!execution) {
      logger.warn('[ExecutionStore] No execution found to stop', { taskId });
      return;
    }

    // Abort the execution
    execution.abortController.abort();

    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      if (existing) {
        newExecutions.set(taskId, {
          ...existing,
          status: 'stopped',
          isStreaming: false,
        });
      }
      return { executions: newExecutions };
    });
  },

  completeExecution: (taskId) => {
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      // Only mark as completed if not already in a terminal state (stopped, error)
      if (existing && existing.status === 'running') {
        newExecutions.set(taskId, {
          ...existing,
          status: 'completed',
          isStreaming: false,
        });
      }
      return { executions: newExecutions };
    });
  },

  setError: (taskId, error) => {
    logger.error('[ExecutionStore] Setting error', { taskId, error });
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      if (existing) {
        newExecutions.set(taskId, {
          ...existing,
          status: 'error',
          error,
          isStreaming: false,
        });
      }
      return { executions: newExecutions };
    });
  },

  updateStreamingContent: (taskId, content, append = false) => {
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      if (existing) {
        newExecutions.set(taskId, {
          ...existing,
          streamingContent: append ? existing.streamingContent + content : content,
          isStreaming: true,
        });
      }
      return { executions: newExecutions };
    });
  },

  clearStreamingContent: (taskId) => {
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      if (existing) {
        newExecutions.set(taskId, {
          ...existing,
          streamingContent: '',
          isStreaming: false,
        });
      }
      return { executions: newExecutions };
    });
  },

  setIsStreaming: (taskId, isStreaming) => {
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      if (existing) {
        newExecutions.set(taskId, {
          ...existing,
          isStreaming,
        });
      }
      return { executions: newExecutions };
    });
  },

  setServerStatus: (taskId, status) => {
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(taskId);
      if (existing) {
        newExecutions.set(taskId, {
          ...existing,
          serverStatus: status,
        });
      }
      return { executions: newExecutions };
    });
  },

  cleanupExecution: (taskId) => {
    const execution = get().executions.get(taskId);
    if (!execution) return;

    // Only cleanup if not running
    if (execution.status === 'running') {
      logger.warn('[ExecutionStore] Cannot cleanup running execution', { taskId });
      return;
    }

    logger.info('[ExecutionStore] Cleaning up execution', { taskId });
    set((state) => {
      const newExecutions = new Map(state.executions);
      newExecutions.delete(taskId);
      return { executions: newExecutions };
    });
  },

  // ============================================
  // Selectors
  // ============================================

  isRunning: (taskId) => {
    const execution = get().executions.get(taskId);
    return execution?.status === 'running';
  },

  // Alias for backward compatibility
  isTaskRunning: (taskId) => {
    const execution = get().executions.get(taskId);
    return execution?.status === 'running';
  },

  getExecution: (taskId) => {
    return get().executions.get(taskId);
  },

  getRunningTaskIds: () => {
    const { executions } = get();
    return getRunningIdsWithCache(executions);
  },

  isMaxReached: () => {
    const state = get();
    return state.getRunningCount() >= state.maxConcurrent;
  },

  getRunningCount: () => {
    const { executions } = get();
    return Array.from(executions.values()).filter((e) => e.status === 'running').length;
  },

  canStartNew: () => {
    return !get().isMaxReached();
  },
}));

// Export store instance for direct access in non-React contexts
export const executionStore = useExecutionStore;
