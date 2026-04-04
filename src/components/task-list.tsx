import { MessageSquare } from 'lucide-react';
import { forwardRef } from 'react';
import InfiniteScroll from '@/components/ui/infinite-scroll';
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
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onTitleChange,
}: TaskListProps) {
  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-muted-foreground">
        <MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/30" />
        <div className="text-center">
          <p className="mb-1 font-medium text-sm">No tasks yet</p>
          <p className="text-muted-foreground/60 text-xs">Start a new chat to begin!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1">
      {tasks.map((task) => (
        <div className="mb-1" key={task.id}>
          <TaskItem
            task={task}
            editingTitle={editingTitle}
            isEditing={editingId === task.id}
            isRunning={runningTaskIds.includes(task.id)}
            isSelected={currentTaskId === task.id}
            worktreeInfo={getWorktreeForTask?.(task.id)}
            onCancelEdit={onCancelEdit}
            onDelete={onDeleteTask}
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
