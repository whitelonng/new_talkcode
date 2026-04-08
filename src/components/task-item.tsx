import { Calendar, Edit2, GitBranch, Hash, LoaderCircle, MoreVertical, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-locale';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/services/database-service';
import type { WorktreeInfo } from '@/types/worktree';

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
  isEditing: boolean;
  editingTitle: string;
  /** Whether this task is currently running */
  isRunning?: boolean;
  /** Worktree info if this task is using a worktree */
  worktreeInfo?: WorktreeInfo | null;
  /** Multi-select mode state */
  isMultiSelectEnabled?: boolean;
  /** Whether this task is currently selected in multi-select mode */
  isMultiSelected?: boolean;
  /** Toggle multi-select mode */
  onMultiSelectEnabledChange?: (enabled: boolean) => void;
  /** Toggle selection state for this task */
  onMultiSelectToggle?: (taskId: string, selected: boolean) => void;
  /** Delete all selected tasks */
  onDeleteSelected?: () => void;
  /** Clear multi-selection */
  onClearSelection?: () => void;
  /** Select all tasks */
  onSelectAll?: () => void;
  selectedCount?: number;
  onSelect: (taskId: string) => void;
  onDelete: (taskId: string, e?: React.MouseEvent) => void;
  onStartEditing: (task: Task, e?: React.MouseEvent) => void;
  onSaveEdit: (taskId: string) => void;
  onCancelEdit: () => void;
  onTitleChange: (title: string) => void;
}

export const TaskItem = memo(function TaskItem({
  task,
  isSelected,
  isEditing,
  editingTitle,
  isRunning = false,
  worktreeInfo,
  isMultiSelectEnabled = false,
  isMultiSelected = false,
  onMultiSelectEnabledChange,
  onMultiSelectToggle,
  onDeleteSelected,
  onClearSelection,
  onSelectAll,
  selectedCount = 0,
  onSelect,
  onDelete,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onTitleChange,
}: TaskItemProps) {
  const t = useTranslation();
  const displayTitle = (task.title || '').trim() || 'New Task';

  if (isEditing) {
    return (
      <div
        className={`w-full cursor-pointer rounded-md border bg-background p-3 text-left hover:bg-accent/50 ${isSelected ? 'border-blue-200 bg-blue-50 dark:border-blue-600 dark:bg-blue-950' : 'border-border'}
                `}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
          }
        }}
        role="presentation"
      >
        <div className="space-y-2">
          <Input
            autoFocus
            className="h-7 text-sm"
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSaveEdit(task.id);
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            placeholder="Enter task title"
            value={editingTitle}
          />
          <div className="flex gap-1">
            <Button
              className="h-6 px-2 text-xs"
              onClick={() => onSaveEdit(task.id)}
              size="sm"
              variant="outline"
            >
              Save
            </Button>
            <Button className="h-6 px-2 text-xs" onClick={onCancelEdit} size="sm" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const cardContent = (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`group w-full cursor-pointer rounded-md border bg-background p-3 text-left hover:bg-accent/50 ${isSelected ? 'border-blue-200 bg-blue-50 dark:border-blue-600 dark:bg-blue-950' : 'border-border'}
            `}
          onClick={() => onSelect(task.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(task.id);
            }
          }}
          title={displayTitle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                {isMultiSelectEnabled && (
                  <Checkbox
                    aria-label={t.RepositoryLayout.taskContextMenu.selectTask}
                    checked={isMultiSelected}
                    onCheckedChange={(checked) => {
                      const selected = checked === true;
                      onMultiSelectToggle?.(task.id, selected);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <h5 className="line-clamp-2 font-medium text-sm">{displayTitle}</h5>
                {isRunning && (
                  <LoaderCircle className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
                )}
                {worktreeInfo && <GitBranch className="h-3 w-3 flex-shrink-0 text-green-500" />}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(task.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span>{task.message_count}</span>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className={`h-6 w-6 p-0 transition-all duration-200 ${
                      isSelected
                        ? 'text-muted-foreground opacity-100'
                        : 'text-muted-foreground/60 opacity-0 hover:text-muted-foreground group-hover:opacity-100'
                    }
                                `}
                    onClick={(e) => e.stopPropagation()}
                    size="sm"
                    variant="ghost"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2"
                    onClick={(e) => onStartEditing(task, e)}
                  >
                    <Edit2 className="h-3 w-3" />
                    {t.Common.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMultiSelectEnabledChange?.(!isMultiSelectEnabled);
                    }}
                  >
                    {t.RepositoryLayout.taskContextMenu.multiSelect}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600"
                    onClick={(e) => onDelete(task.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t.Common.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem
          className="flex cursor-pointer items-center gap-2"
          onClick={() => {
            onStartEditing(task);
          }}
        >
          <Edit2 className="h-3 w-3" />
          {t.Common.edit}
        </ContextMenuItem>

        <ContextMenuItem
          className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600"
          onClick={() => {
            onDelete(task.id);
          }}
          variant="destructive"
        >
          <Trash2 className="h-3 w-3" />
          {t.Common.delete}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuCheckboxItem
          checked={isMultiSelectEnabled}
          onCheckedChange={(checked) => {
            onMultiSelectEnabledChange?.(checked === true);
          }}
        >
          {t.RepositoryLayout.taskContextMenu.multiSelect}
        </ContextMenuCheckboxItem>

        {isMultiSelectEnabled && (
          <>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={() => {
                onClearSelection?.();
                onMultiSelectEnabledChange?.(false);
              }}
            >
              {t.RepositoryLayout.taskContextMenu.cancelMultiSelect}
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={() => onSelectAll?.()}
            >
              {t.RepositoryLayout.taskContextMenu.selectAll}
            </ContextMenuItem>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={() => onClearSelection?.()}
            >
              {t.RepositoryLayout.taskContextMenu.clearSelection}
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem
              className="flex cursor-pointer items-center gap-2"
              disabled={selectedCount === 0}
              onClick={() => onDeleteSelected?.()}
              variant="destructive"
            >
              <Trash2 className="h-3 w-3" />
              {t.RepositoryLayout.taskContextMenu.deleteSelected(selectedCount)}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );

  // Wrap with HoverCard if worktreeInfo exists
  if (worktreeInfo) {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>{cardContent}</HoverCardTrigger>
        <HoverCardContent side="right" className="w-auto max-w-sm p-2">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Branch:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {worktreeInfo.branch}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Path:</span>
              <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {worktreeInfo.path}
              </code>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return cardContent;
});
