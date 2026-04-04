// src/components/background-tasks/background-task-output.tsx
// Background task output viewer component

import { AlertCircle, CheckCircle2, FileText, RefreshCw, Terminal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackgroundTaskStore } from '@/stores/background-task-store';

interface BackgroundTaskOutputProps {
  taskId: string;
  onClose?: () => void;
}

export function BackgroundTaskOutput({ taskId, onClose }: BackgroundTaskOutputProps) {
  const { getTask, fetchOutput, killTask } = useBackgroundTaskStore();
  const task = getTask(taskId);

  const [output, setOutput] = useState<{
    stdout: string;
    stderr: string;
    isComplete: boolean;
  }>({ stdout: '', stderr: '', isComplete: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isKilling, setIsKilling] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const stdoutRef = useRef<HTMLPreElement>(null);
  const stderrRef = useRef<HTMLPreElement>(null);
  const refreshIntervalRef = useRef<number | null>(null);

  // Fetch output with deduplication
  const refreshOutput = useCallback(async () => {
    if (!task) return;

    try {
      const response = await fetchOutput(taskId);

      setOutput((prev) => {
        // Only update if there's new content to append
        if (!response.newStdout && !response.newStderr) {
          // No new content, just update completion status if needed
          if (prev.isComplete === response.isComplete) {
            return prev;
          }
          return { ...prev, isComplete: response.isComplete };
        }
        // Append new content to existing output
        return {
          stdout: prev.stdout + (response.newStdout || ''),
          stderr: prev.stderr + (response.newStderr || ''),
          isComplete: response.isComplete,
        };
      });

      setError(null);

      // Auto-scroll to bottom
      if (stdoutRef.current) {
        stdoutRef.current.scrollTop = stdoutRef.current.scrollHeight;
      }
      if (stderrRef.current) {
        stderrRef.current.scrollTop = stderrRef.current.scrollHeight;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch output');
    } finally {
      setIsLoading(false);
    }
  }, [task, taskId, fetchOutput]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    refreshOutput();

    if (autoRefresh && task?.status === 'running') {
      refreshIntervalRef.current = window.setInterval(refreshOutput, 2000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, task?.status, refreshOutput]);

  // Handle kill
  const handleKill = async () => {
    setIsKilling(true);
    try {
      await killTask(taskId);
      setAutoRefresh(false);
      await refreshOutput();
    } finally {
      setIsKilling(false);
    }
  };

  if (!task) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Task not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {task.status === 'running' ? (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            ) : (
              <CheckCircle2
                className={`h-4 w-4 ${
                  task.status === 'completed'
                    ? 'text-green-500'
                    : task.status === 'failed' || task.status === 'killed' || task.isTimedOut
                      ? 'text-red-500'
                      : 'text-amber-500'
                }`}
              />
            )}
            <span className="font-medium">
              {task.status === 'completed'
                ? 'Completed'
                : task.status === 'failed'
                  ? 'Failed'
                  : task.status === 'killed'
                    ? 'Killed'
                    : task.status === 'timeout'
                      ? 'Timeout'
                      : 'Running'}
            </span>
          </div>
          <span className="text-sm text-gray-500">PID: {task.pid}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>

          {/* Manual refresh */}
          <button
            type="button"
            onClick={refreshOutput}
            disabled={isLoading}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Kill button (only for running tasks) */}
          {task.status === 'running' && (
            <button
              type="button"
              onClick={handleKill}
              disabled={isKilling}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
            >
              <span>{isKilling ? 'Stopping...' : 'Stop Task'}</span>
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Command display */}
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm font-mono text-gray-600 dark:text-gray-400">
          <Terminal className="h-3.5 w-3.5" />
          <span className="truncate">{task.command}</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Output section */}
      <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700">
        {/* stdout */}
        <div className="bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-sm font-medium">stdout</span>
              {task.lastOutput && (
                <span className="text-xs text-gray-500">
                  ({task.lastOutput.stdoutBytesRead} bytes)
                </span>
              )}
            </div>
            {!output.isComplete && task.status === 'running' && (
              <span className="text-xs text-green-500 animate-pulse">Reading...</span>
            )}
          </div>
          <pre
            ref={stdoutRef}
            className="p-3 max-h-96 overflow-auto text-sm font-mono whitespace-pre-wrap break-words"
          >
            {output.stdout || <span className="text-gray-400 italic">No stdout output</span>}
          </pre>
        </div>

        {/* stderr */}
        <div className="bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-sm font-medium">stderr</span>
              {task.lastOutput && (
                <span className="text-xs text-gray-500">
                  ({task.lastOutput.stderrBytesRead} bytes)
                </span>
              )}
            </div>
          </div>
          <pre
            ref={stderrRef}
            className="p-3 max-h-96 overflow-auto text-sm font-mono whitespace-pre-wrap break-words text-red-600 dark:text-red-400"
          >
            {output.stderr || <span className="text-gray-400 italic">No stderr output</span>}
          </pre>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Started: {new Date(task.startTime).toLocaleString()}</span>
          {task.endTime && <span>Ended: {new Date(task.endTime).toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Output file: {task.outputFile}</span>
        </div>
      </div>
    </div>
  );
}
