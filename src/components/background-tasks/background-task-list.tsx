// src/components/background-tasks/background-task-list.tsx
// Background task list component

import { Terminal, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useBackgroundTaskStore } from '@/stores/background-task-store';
import { BackgroundTaskCard } from './background-task-card';

interface BackgroundTaskListProps {
  conversationTaskId?: string;
  onViewOutput?: (taskId: string) => void;
  compact?: boolean;
}

export function BackgroundTaskList({
  conversationTaskId,
  onViewOutput,
  compact = false,
}: BackgroundTaskListProps) {
  const {
    tasks,
    getTasksByConversation,
    getRunningTasks,
    startPolling,
    stopPolling,
    cleanupOldTasks,
  } = useBackgroundTaskStore();

  // Filter tasks based on conversation
  const filteredTasks = conversationTaskId
    ? getTasksByConversation(conversationTaskId)
    : Array.from(tasks.values());

  const runningTasks = getRunningTasks();
  const completedTasks = filteredTasks.filter((t) => t.status !== 'running');

  // Start polling on mount, stop on unmount
  useEffect(() => {
    startPolling();

    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const handleCleanup = async () => {
    await cleanupOldTasks();
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No background tasks</p>
        <p className="text-xs mt-1">Use run_in_background: true to start a background task</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {filteredTasks.map((task) => (
          <BackgroundTaskCard key={task.taskId} task={task} onViewOutput={onViewOutput} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Background Tasks
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {runningTasks.length > 0 && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full">
                {runningTasks.length} running
              </span>
            )}
            {completedTasks.length > 0 && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                {completedTasks.length} completed
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCleanup}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Cleanup old tasks"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Cleanup</span>
          </button>
        </div>
      </div>

      {/* Running tasks */}
      {runningTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Running ({runningTasks.length})
          </h4>
          <div className="space-y-2">
            {runningTasks.map((task) => (
              <BackgroundTaskCard key={task.taskId} task={task} onViewOutput={onViewOutput} />
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Completed ({completedTasks.length})
          </h4>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <BackgroundTaskCard key={task.taskId} task={task} onViewOutput={onViewOutput} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
