// src/components/background-tasks/background-task-card.tsx
// Background task card component

import { Clock, FileText, Play, Square, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBackgroundTaskStore } from '@/stores/background-task-store';
import type { BackgroundTask, BackgroundTaskStatus } from '@/types/background-task';

interface BackgroundTaskCardProps {
  task: BackgroundTask;
  onViewOutput?: (taskId: string) => void;
  compact?: boolean;
}

const statusConfig: Record<
  BackgroundTaskStatus,
  { color: string; icon: typeof Play; label: string }
> = {
  running: { color: 'text-green-500', icon: Play, label: 'Running' },
  completed: { color: 'text-blue-500', icon: Square, label: 'Completed' },
  failed: { color: 'text-red-500', icon: Square, label: 'Failed' },
  killed: { color: 'text-gray-500', icon: Square, label: 'Killed' },
  timeout: { color: 'text-amber-500', icon: Clock, label: 'Timeout' },
};

export function BackgroundTaskCard({
  task,
  onViewOutput,
  compact = false,
}: BackgroundTaskCardProps) {
  const { killTask, refreshTaskStatus } = useBackgroundTaskStore();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isKilling, setIsKilling] = useState(false);

  const status = statusConfig[task.status];
  const StatusIcon = status.icon;
  const isRunning = task.status === 'running';
  const startTime = task.startTime;

  // Update elapsed time
  useEffect(() => {
    // For non-running tasks, calculate elapsed time once
    if (!isRunning) {
      const end = task.endTime || Date.now();
      setElapsedTime(end - startTime);
      return;
    }

    // For running tasks, update every second
    const updateElapsed = () => {
      setElapsedTime(Date.now() - startTime);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime, task.endTime, isRunning]);

  // Format elapsed time
  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const handleKill = async () => {
    if (isKilling) return;
    setIsKilling(true);
    try {
      await killTask(task.taskId);
    } finally {
      setIsKilling(false);
    }
  };

  const handleRefresh = async () => {
    await refreshTaskStatus(task.taskId);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${status.color}`} />
          <span className="text-sm font-mono">{task.pid}</span>
          <span className="text-sm truncate max-w-[200px]">{task.command}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{formatElapsed(elapsedTime)}</span>
          {isRunning && (
            <button
              type="button"
              onClick={handleKill}
              disabled={isKilling}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
            >
              <Square className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${status.color}`} />
          <span className={`font-medium ${status.color}`}>{status.label}</span>
          {isRunning && <span className="text-xs text-gray-500 animate-pulse">● Live</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-mono">PID: {task.pid}</span>
          <span className="text-sm text-gray-500">{formatElapsed(elapsedTime)}</span>
        </div>
      </div>

      {/* Command */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Terminal className="h-3 w-3" />
          <span>Command</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 font-mono text-sm break-all">
          {task.command}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Started: {new Date(task.startTime).toLocaleString()}</span>
          {task.maxTimeoutMs && (
            <>
              <span>•</span>
              <span>Timeout: {Math.floor(task.maxTimeoutMs / 60000)}min</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={handleKill}
              disabled={isKilling}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{isKilling ? 'Stopping...' : 'Stop'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span>Refresh</span>
            </button>
          )}

          {onViewOutput && (
            <button
              type="button"
              onClick={() => onViewOutput(task.taskId)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-sm hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>View Output</span>
            </button>
          )}
        </div>
      </div>

      {/* Exit code for completed/failed tasks */}
      {task.exitCode !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Exit Code:</span>
            <span
              className={`font-mono px-2 py-0.5 rounded ${
                task.exitCode === 0
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              }`}
            >
              {task.exitCode}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
