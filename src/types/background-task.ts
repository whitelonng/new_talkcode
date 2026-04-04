// src/types/background-task.ts
// Background task type definitions

/**
 * Background task status
 */
export type BackgroundTaskStatus = 'running' | 'completed' | 'failed' | 'killed' | 'timeout';

/**
 * Background task information (camelCase naming)
 */
export interface BackgroundTask {
  taskId: string;
  pid: number;
  command: string;
  status: BackgroundTaskStatus;
  exitCode?: number;
  startTime: number;
  endTime?: number;
  outputFile: string;
  errorFile: string;
  conversationTaskId: string; // Associated conversation task
  toolId: string; // Original tool use ID
  maxTimeoutMs?: number; // Configurable timeout in milliseconds
  lastOutput?: {
    // Track last read position for incremental output
    stdoutBytesRead: number;
    stderrBytesRead: number;
  };
  isTimedOut?: boolean; // Whether task timed out
}

/**
 * Rust response types (snake_case from backend)
 */
export interface RustBackgroundTaskInfo {
  taskId: string;
  pid: number;
  command: string;
  status: BackgroundTaskStatus;
  exitCode?: number;
  startTime: number;
  endTime?: number;
  outputFile: string;
  errorFile: string;
  maxTimeoutMs?: number;
  isTimedOut: boolean;
}

export interface RustGetTaskStatusResponse {
  taskId: string;
  status: BackgroundTaskStatus;
  exitCode?: number;
  runningTimeMs: number;
  outputBytes: number;
  errorBytes: number;
}

export interface RustGetIncrementalOutputResponse {
  taskId: string;
  newStdout: string;
  newStderr: string;
  stdoutBytesRead: number;
  stderrBytesRead: number;
  isComplete: boolean;
}

export interface RustListTasksResponse {
  tasks: RustBackgroundTaskInfo[];
  runningCount: number;
  completedCount: number;
}

/**
 * Convert Rust task info to frontend format
 */
export function toBackgroundTaskInfo(
  dto: RustBackgroundTaskInfo,
  conversationTaskId = '',
  toolId = ''
): BackgroundTask {
  return {
    taskId: dto.taskId,
    pid: dto.pid,
    command: dto.command,
    status: dto.status,
    exitCode: dto.exitCode,
    startTime: dto.startTime,
    endTime: dto.endTime,
    outputFile: dto.outputFile,
    errorFile: dto.errorFile,
    conversationTaskId,
    toolId,
    maxTimeoutMs: dto.maxTimeoutMs,
    isTimedOut: dto.isTimedOut,
  };
}

/**
 * Request to spawn a background task
 */
export interface SpawnBackgroundTaskRequest {
  command: string;
  cwd?: string;
  maxTimeoutMs?: number;
}

/**
 * Response for spawn task
 */
export interface SpawnBackgroundTaskResponse {
  taskId: string;
  pid: number;
  outputFile: string;
  errorFile: string;
  success: boolean;
  error?: string;
}

/**
 * Response for task status
 */
export interface GetTaskStatusResponse {
  taskId: string;
  status: BackgroundTaskStatus;
  exitCode?: number;
  runningTimeMs: number;
  outputBytes: number;
  errorBytes: number;
}

/**
 * Response for incremental output
 */
export interface GetIncrementalOutputResponse {
  taskId: string;
  newStdout: string;
  newStderr: string;
  stdoutBytesRead: number;
  stderrBytesRead: number;
  isComplete: boolean;
}

/**
 * Response for listing tasks
 */
export interface ListTasksResponse {
  tasks: BackgroundTaskInfo[];
  runningCount: number;
  completedCount: number;
}

/**
 * Background task info (simplified for list response)
 */
export interface BackgroundTaskInfo {
  taskId: string;
  pid: number;
  command: string;
  status: BackgroundTaskStatus;
  exitCode?: number;
  startTime: number;
  endTime?: number;
  outputFile: string;
  errorFile: string;
  maxTimeoutMs?: number;
  isTimedOut: boolean;
}

/**
 * Background task execution result (returned to LLM)
 */
export interface BackgroundExecutionResult {
  success: boolean;
  taskId: string;
  pid: number;
  command: string;
  message: string;
  outputFile: string;
  errorFile: string;
}

/**
 * Maximum concurrent tasks limit
 */
export const MAX_CONCURRENT_TASKS = 10;

/**
 * Polling interval configuration
 */
export const POLLING_INTERVAL_MS = 5000;
export const MIN_POLLING_INTERVAL_MS = 1000;
export const MAX_POLLING_INTERVAL_MS = 30000;
