// src/stores/background-task-store.ts
// Background task state management using Zustand

import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import {
  type BackgroundTask,
  type GetIncrementalOutputResponse,
  type GetTaskStatusResponse,
  type ListTasksResponse,
  MAX_CONCURRENT_TASKS,
  POLLING_INTERVAL_MS,
  type SpawnBackgroundTaskResponse,
} from '@/types/background-task';

interface BackgroundTaskState {
  // State
  tasks: Map<string, BackgroundTask>;
  isPolling: boolean;
  pollingInterval: number | null;
  pollingIntervalMs: number;

  // Actions
  addTask: (task: BackgroundTask) => void;
  updateTask: (taskId: string, updates: Partial<BackgroundTask>) => void;
  removeTask: (taskId: string) => void;
  getTask: (taskId: string) => BackgroundTask | undefined;
  getAllTasks: () => BackgroundTask[];
  getTasksByConversation: (conversationTaskId: string) => BackgroundTask[];
  getRunningTasks: () => BackgroundTask[];

  // Async actions
  spawnTask: (
    command: string,
    conversationTaskId: string,
    toolId: string,
    cwd?: string,
    maxTimeoutMs?: number
  ) => Promise<string>;
  killTask: (taskId: string) => Promise<boolean>;
  fetchOutput: (taskId: string) => Promise<GetIncrementalOutputResponse>;
  refreshTaskStatus: (taskId: string) => Promise<void>;
  refreshAllTasks: () => Promise<void>;
  cleanupOldTasks: () => Promise<void>;

  // Polling control
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

const DEFAULT_POLLING_INTERVAL = POLLING_INTERVAL_MS;

export const useBackgroundTaskStore = create<BackgroundTaskState>((set, get) => ({
  tasks: new Map(),
  isPolling: false,
  pollingInterval: null,
  pollingIntervalMs: DEFAULT_POLLING_INTERVAL,

  addTask: (task) =>
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.set(task.taskId, task);
      return { tasks: newTasks };
    }),

  updateTask: (taskId, updates) =>
    set((state) => {
      const task = state.tasks.get(taskId);
      if (!task) return state;

      const newTasks = new Map(state.tasks);
      newTasks.set(taskId, { ...task, ...updates });
      return { tasks: newTasks };
    }),

  removeTask: (taskId) =>
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.delete(taskId);
      return { tasks: newTasks };
    }),

  getTask: (taskId) => {
    return get().tasks.get(taskId);
  },

  getAllTasks: () => {
    const { tasks } = get();
    return Array.from(tasks.values());
  },

  getTasksByConversation: (conversationTaskId) => {
    return get()
      .getAllTasks()
      .filter((task) => task.conversationTaskId === conversationTaskId);
  },

  getRunningTasks: () => {
    const { tasks } = get();
    return Array.from(tasks.values()).filter((task) => task.status === 'running');
  },

  spawnTask: async (command, conversationTaskId, toolId, cwd, maxTimeoutMs) => {
    logger.info('Spawning background task:', command);

    // Check concurrent task limit
    const runningTasks = get().getRunningTasks();
    if (runningTasks.length >= MAX_CONCURRENT_TASKS) {
      throw new Error(
        `Maximum concurrent tasks limit reached (${MAX_CONCURRENT_TASKS}). ` +
          'Please stop some running tasks before starting new ones.'
      );
    }

    try {
      const result = await invoke<SpawnBackgroundTaskResponse>('spawn_background_task', {
        request: {
          command,
          cwd,
          maxTimeoutMs,
        },
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to spawn background task');
      }

      const task: BackgroundTask = {
        taskId: result.taskId,
        pid: result.pid,
        command,
        status: 'running',
        startTime: Date.now(),
        outputFile: result.outputFile,
        errorFile: result.errorFile,
        conversationTaskId,
        toolId,
        maxTimeoutMs,
        lastOutput: {
          stdoutBytesRead: 0,
          stderrBytesRead: 0,
        },
      };

      get().addTask(task);
      logger.info('Background task spawned:', result.taskId);

      return result.taskId;
    } catch (error) {
      logger.error('Failed to spawn background task:', error);
      throw error;
    }
  },

  killTask: async (taskId) => {
    logger.info('Killing background task:', taskId);

    try {
      const success = await invoke<boolean>('kill_background_task', { taskId });

      if (success) {
        get().updateTask(taskId, { status: 'killed', endTime: Date.now() });
      }

      return success;
    } catch (error) {
      logger.error('Failed to kill background task:', error);
      return false;
    }
  },

  fetchOutput: async (taskId) => {
    const task = get().getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    try {
      // Get last read position from task state
      const lastOutput = task.lastOutput || { stdoutBytesRead: 0, stderrBytesRead: 0 };

      const response = await invoke<GetIncrementalOutputResponse>('get_background_task_output', {
        taskId,
        stdoutBytesRead: lastOutput.stdoutBytesRead,
        stderrBytesRead: lastOutput.stderrBytesRead,
      });

      // Update the last read position
      get().updateTask(taskId, {
        lastOutput: {
          stdoutBytesRead: response.stdoutBytesRead,
          stderrBytesRead: response.stderrBytesRead,
        },
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch task output:', error);
      throw error;
    }
  },

  refreshTaskStatus: async (taskId) => {
    try {
      const status = await invoke<GetTaskStatusResponse>('get_background_task_status', { taskId });

      const updateData: Partial<BackgroundTask> = {
        status: status.status,
        exitCode: status.exitCode,
      };

      if (status.status !== 'running') {
        updateData.endTime = Date.now();
      }

      get().updateTask(taskId, updateData);
    } catch (error) {
      logger.error('Failed to refresh task status:', error);
    }
  },

  refreshAllTasks: async () => {
    try {
      const listResponse = await invoke<ListTasksResponse>('list_background_tasks');

      // Use batch update to avoid race conditions
      set((state) => {
        const newTasks = new Map(state.tasks);

        // Update or add tasks from the list
        for (const taskInfo of listResponse.tasks) {
          const existingTask = state.tasks.get(taskInfo.taskId);

          if (!existingTask) {
            // Add new task from Rust backend
            const task: BackgroundTask = {
              taskId: taskInfo.taskId,
              pid: taskInfo.pid,
              command: taskInfo.command,
              status: taskInfo.status,
              exitCode: taskInfo.exitCode,
              startTime: taskInfo.startTime,
              endTime: taskInfo.endTime,
              outputFile: taskInfo.outputFile,
              errorFile: taskInfo.errorFile,
              conversationTaskId: '', // These tasks were created before store was active
              toolId: '',
              maxTimeoutMs: taskInfo.maxTimeoutMs,
              isTimedOut: taskInfo.isTimedOut,
              lastOutput: {
                stdoutBytesRead: 0,
                stderrBytesRead: 0,
              },
            };
            newTasks.set(taskInfo.taskId, task);
          } else {
            // Update existing task status
            if (
              taskInfo.status !== existingTask.status ||
              taskInfo.exitCode !== existingTask.exitCode
            ) {
              newTasks.set(taskInfo.taskId, {
                ...existingTask,
                status: taskInfo.status,
                exitCode: taskInfo.exitCode,
                endTime: taskInfo.endTime,
                isTimedOut: taskInfo.isTimedOut,
              });
            }
          }
        }

        // Remove tasks that are no longer in the list (cleanup)
        const activeTaskIds = new Set(listResponse.tasks.map((t) => t.taskId));
        for (const id of newTasks.keys()) {
          if (!activeTaskIds.has(id)) {
            newTasks.delete(id);
          }
        }

        return { tasks: newTasks };
      });
    } catch (error) {
      logger.error('Failed to refresh all tasks:', error);
    }
  },

  cleanupOldTasks: async () => {
    try {
      const cleanedCount = await invoke<number>('cleanup_background_tasks');
      logger.info(`Cleaned up ${cleanedCount} old background tasks`);
    } catch (error) {
      logger.error('Failed to cleanup old tasks:', error);
    }
  },

  startPolling: (intervalMs = DEFAULT_POLLING_INTERVAL) => {
    const { isPolling, refreshAllTasks } = get();

    if (isPolling) {
      logger.warn('Polling already started');
      return;
    }

    // Clamp interval to valid range
    const clampedInterval = Math.max(1000, Math.min(30000, intervalMs));

    logger.info('Starting background task polling with interval:', clampedInterval);

    // Initial refresh
    refreshAllTasks();

    // Set up polling interval
    const interval = window.setInterval(() => {
      refreshAllTasks();
    }, clampedInterval);

    set({
      isPolling: true,
      pollingInterval: interval as unknown as number,
      pollingIntervalMs: clampedInterval,
    });
  },

  stopPolling: () => {
    const { pollingInterval } = get();

    if (pollingInterval !== null) {
      window.clearInterval(pollingInterval);
    }

    set({ isPolling: false, pollingInterval: null });
    logger.info('Stopped background task polling');
  },
}));
