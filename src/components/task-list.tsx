import { MessageSquare } from 'lucide-react';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import InfiniteScroll from '@/components/ui/infinite-scroll';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import type { Task } from '@/services/database-service';
import type { WorktreeInfo } from '@/types/worktree';
import { TaskItem } from './task-item';

const LoadingIndicator = forwardRef<HTMLDivElement>((props, ref) => (
  <div ref={ref} className="flex justify-center my-4">
    <div className="text-muted-foreground text-sm">Loading more tasks...</div>
  </div>
));
LoadingIndicator.displayName = 'LoadingIndicator';

interface TaskListProps {
  tasks: Task[];
  currentTaskId?: string;
  loading: boolean;
  /** Whether there are more tasks to load */
  hasMore?: boolean;
  /** Whether more tasks are being loaded */
  loadingMore?: boolean;
  /** Callback to load more tasks */
  onLoadMore?: () => void;
  /** Scroll container for intersection observer root */
  scrollRoot?: Element | Document | null;
  editingId: string | null;
  editingTitle: string;
  /** IDs of currently running tasks */
  runningTaskIds?: string[];
  /** Function to get worktree info for a task */
  getWorktreeForTask?: (taskId: string) => WorktreeInfo | null;
  onTaskSelect: (taskId: string) => void;
  onDeleteTask: (taskId: string, e?: React.MouseEvent) => void;
  onDeleteTasks?: (taskIds: string[]) => void;
  onStartEditing: (task: Task, e?: React.MouseEvent) => void;
  onSaveEdit: (taskId: string) => void;
  onCancelEdit: () => void;
  onTitleChange: (title: string) => void;
}

export function TaskList({
  tasks,
  currentTaskId,
  loading,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  scrollRoot,
  editingId,
  editingTitle,
  runningTaskIds = [],
  getWorktreeForTask,
  onTaskSelect,
  onDeleteTask,
  onDeleteTasks,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onTitleChange,
}: TaskListProps) {
  const { isRetromaTheme } = useTheme();
  const [isMultiSelectEnabled, setIsMultiSelectEnabled] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedTaskIds.size;

  const allTaskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTaskIds(new Set(allTaskIds));
  }, [allTaskIds]);

  const handleMultiSelectToggle = useCallback((taskId: string, selected: boolean) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedTaskIds.size === 0) return;

    const taskIds = Array.from(selectedTaskIds);
    onDeleteTasks?.(taskIds);
  }, [onDeleteTasks, selectedTaskIds]);

  const handleDeleteTask = useCallback(
    (taskId: string, e?: React.MouseEvent) => {
      onDeleteTask(taskId, e);

      // Multi-select is primarily for batch operations.
      // If the user deletes a task while multi-select is enabled, exit multi-select mode.
      if (isMultiSelectEnabled) {
        clearSelection();
        setIsMultiSelectEnabled(false);
      }
    },
    [clearSelection, isMultiSelectEnabled, onDeleteTask]
  );

  if (loading && tasks.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center py-8',
          isRetromaTheme && 'retroma-task-empty'
        )}
      >
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center px-6 py-12 text-muted-foreground',
          isRetromaTheme && 'retroma-task-empty'
        )}
      >
        <MessageSquare
          className={cn(
            'mb-3 h-12 w-12 text-muted-foreground/30',
            isRetromaTheme && 'retroma-task-empty-icon'
          )}
        />
        <div className="text-center">
          <p
            className={cn('mb-1 font-medium text-sm', isRetromaTheme && 'retroma-task-empty-title')}
          >
            No tasks yet
          </p>
          <p
            className={cn(
              'text-muted-foreground/60 text-xs',
              isRetromaTheme && 'retroma-task-empty-subtitle'
            )}
          >
            Start a new chat to begin!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-1', isRetromaTheme && 'retroma-task-list')}>
      {tasks.map((task) => (
        <div className="mb-1" key={task.id}>
          <TaskItem
            task={task}
            editingTitle={editingTitle}
            isEditing={editingId === task.id}
            isRunning={runningTaskIds.includes(task.id)}
            isSelected={currentTaskId === task.id}
            worktreeInfo={getWorktreeForTask?.(task.id)}
            isMultiSelectEnabled={isMultiSelectEnabled}
            isMultiSelected={selectedTaskIds.has(task.id)}
            selectedCount={selectedCount}
            onMultiSelectEnabledChange={(enabled) => {
              setIsMultiSelectEnabled(enabled);
              if (!enabled) {
                clearSelection();
              }
            }}
            onMultiSelectToggle={handleMultiSelectToggle}
            onDeleteSelected={() => {
              handleDeleteSelected();
              clearSelection();
              setIsMultiSelectEnabled(false);
            }}
            onClearSelection={clearSelection}
            onSelectAll={selectAll}
            onCancelEdit={onCancelEdit}
            onDelete={handleDeleteTask}
            onSaveEdit={onSaveEdit}
            onSelect={onTaskSelect}
            onStartEditing={onStartEditing}
            onTitleChange={onTitleChange}
          />
        </div>
      ))}

      {onLoadMore && (
        <InfiniteScroll
          hasMore={hasMore}
          isLoading={loadingMore}
          next={onLoadMore}
          threshold={1}
          root={scrollRoot}
        >
          {hasMore && <LoadingIndicator />}
        </InfiniteScroll>
      )}
    </div>
  );
}
