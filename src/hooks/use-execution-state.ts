// src/hooks/use-execution-state.ts
/**
 * useExecutionState - Optimized hook for subscribing to execution state of a specific task
 *
 * This hook provides fine-grained subscription to execution state for a single task.
 * It prevents unnecessary re-renders when other tasks' execution state changes.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  ExecutionStatus,
  ExecutionState as StoreExecutionState,
} from '@/stores/execution-store';
import { useExecutionStore } from '@/stores/execution-store';

export interface ExecutionState {
  isLoading: boolean;
  serverStatus: string;
  error?: string;
  status?: ExecutionStatus;
  streamingContent?: string;
  isStreaming?: boolean;
}

/**
 * Hook to get execution state for a specific task
 * @param taskId Task ID to subscribe to (undefined for no task)
 * @returns Execution state for the specified task
 */
export function useExecutionState(taskId?: string): ExecutionState {
  const selector = useCallback(
    (state: StoreExecutionState) => {
      if (!taskId) {
        return {
          isLoading: false,
          serverStatus: '',
          error: undefined,
          status: undefined,
          streamingContent: '',
          isStreaming: false,
        };
      }

      const execution = state.getExecution(taskId);
      const isLoading = state.isTaskRunning(taskId);

      return {
        isLoading,
        serverStatus: execution?.serverStatus ?? '',
        error: execution?.error,
        status: execution?.status,
        streamingContent: execution?.streamingContent ?? '',
        isStreaming: execution?.isStreaming ?? false,
      };
    },
    [taskId]
  );

  return useExecutionStore(useShallow(selector));
}

/**
 * Hook to check if a specific task is running
 * @param taskId Task ID to check
 * @returns boolean indicating if the task is running
 */
export function useIsTaskRunning(taskId?: string): boolean {
  const selector = useCallback(
    (state: StoreExecutionState) => {
      if (!taskId) return false;
      return state.isTaskRunning(taskId);
    },
    [taskId]
  );

  return useExecutionStore(selector);
}

/**
 * Hook to get server status for a specific task
 * @param taskId Task ID to get status for
 * @returns Server status string
 */
export function useServerStatus(taskId?: string): string {
  const selector = useCallback(
    (state: StoreExecutionState) => {
      if (!taskId) return '';
      const execution = state.getExecution(taskId);
      return execution?.serverStatus ?? '';
    },
    [taskId]
  );

  return useExecutionStore(selector);
}

/**
 * Hook to get error for a specific task
 * @param taskId Task ID to get error for
 * @returns Error string or undefined
 */
export function useExecutionError(taskId?: string): string | undefined {
  const selector = useCallback(
    (state: StoreExecutionState) => {
      if (!taskId) return undefined;
      const execution = state.getExecution(taskId);
      return execution?.error;
    },
    [taskId]
  );

  return useExecutionStore(selector);
}
