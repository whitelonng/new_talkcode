import { Check, ChevronDown, Folder, GitBranch, ListTodo, Plus } from 'lucide-react';
import type React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EmptyRepositoryState } from '@/components/empty-repository-state';
import { FileTree } from '@/components/file-tree';
import { FileTreeHeader } from '@/components/file-tree-header';
import { GitPanel } from '@/components/git/git-panel';
import { TaskList } from '@/components/task-list';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResizableHandle, ResizablePanel } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { useStableRunningIds } from '@/hooks/use-stable-running-ids';
import { useTasks } from '@/hooks/use-tasks';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { useExecutionStore } from '@/stores/execution-store';
import { useTaskStore } from '@/stores/task-store';
import { useWorktreeStore } from '@/stores/worktree-store';
import type { ExternalAgentBackend } from '@/types';
import type { FileNode } from '@/types/file-system';
import { SidebarView } from '@/types/navigation';

interface RepositorySidebarProps {
  emptyRepoPanelId: string;
  fileTreePanelId: string;
  shouldShowSidebar: boolean;
  hasRepository: boolean;
  sidebarView: SidebarView;
  onSidebarViewChange: (view: SidebarView) => void;
  currentProjectId: string;
  onSelectRepository: () => Promise<void>;
  onOpenRepository: (path: string, projectId: string) => Promise<void>;
  isLoadingProject: boolean;
  onOpenFileSearch?: () => void;
  onOpenContentSearch?: () => void;
  rootPath: string | null;
  fileTree: FileNode | null;
  expandedPaths: Set<string>;
  selectedFilePath: string | null;
  onFileCreate: (parentPath: string, fileName: string, isDirectory: boolean) => Promise<void>;
  onFileDelete: (filePath: string) => Promise<void>;
  onFileRename: (oldPath: string, newName: string) => Promise<void>;
  onFileSelect: (filePath: string, lineNumber?: number) => void;
  onOpenFileInBrowser: (filePath: string) => Promise<void>;
  onRefreshFileTree: () => void;
  onLoadChildren: (node: FileNode) => Promise<FileNode[]>;
  onToggleExpansion: (path: string) => void;
  onReferenceToChat?: (filePath: string) => void;
  taskSearchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const RepositorySidebar = memo(function RepositorySidebar({
  emptyRepoPanelId,
  fileTreePanelId,
  shouldShowSidebar,
  hasRepository,
  sidebarView,
  onSidebarViewChange,
  currentProjectId,
  onSelectRepository,
  onOpenRepository,
  isLoadingProject,
  onOpenFileSearch,
  onOpenContentSearch,
  rootPath,
  fileTree,
  expandedPaths,
  selectedFilePath,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onFileSelect,
  onOpenFileInBrowser,
  onRefreshFileTree,
  onLoadChildren,
  onToggleExpansion,
  onReferenceToChat,
  taskSearchInputRef,
}: RepositorySidebarProps) {
  const t = useTranslation();
  const { isAppleTheme, themeVariant } = useTheme();
  const panelId = shouldShowSidebar ? fileTreePanelId : emptyRepoPanelId;

  const { isMaxReached } = useExecutionStore(
    useShallow((state) => ({ isMaxReached: state.isMaxReached() }))
  );

  const [sidebarTaskSearch, _setSidebarTaskSearch] = useState('');
  const [debouncedTaskSearch, setDebouncedTaskSearch] = useState('');
  const stableRunningTaskIds = useStableRunningIds();

  // Task data + actions scoped to sidebar to avoid rerenders upstream
  const {
    tasks,
    loading: tasksLoading,
    loadingMore,
    hasMore,
    loadMoreTasks,
    editingId,
    editingTitle,
    setEditingTitle,
    deleteTask,
    finishEditing,
    startEditing,
    cancelEditing,
    selectTask,
    currentTaskId,
    selectedNewTaskBackend,
    startNewTask,
    loadTasks,
  } = useTasks();

  const { getWorktreeForTask } = useWorktreeStore(
    useShallow((state) => ({ getWorktreeForTask: state.getWorktreeForTask }))
  );

  const normalizedTaskSearch = useMemo(() => debouncedTaskSearch.trim(), [debouncedTaskSearch]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedTaskSearch(sidebarTaskSearch);
    }, 200);

    return () => window.clearTimeout(handle);
  }, [sidebarTaskSearch]);

  useEffect(() => {
    if (sidebarView === SidebarView.TASKS) {
      loadTasks(currentProjectId || undefined, normalizedTaskSearch);
    }
  }, [sidebarView, currentProjectId, normalizedTaskSearch, loadTasks]);

  // Keep input controlled externally if provided
  useEffect(() => {
    if (taskSearchInputRef.current) {
      taskSearchInputRef.current.value = sidebarTaskSearch;
    }
  }, [sidebarTaskSearch, taskSearchInputRef]);

  const currentBackend = selectedNewTaskBackend ?? 'native';
  const [backendMenuOpen, setBackendMenuOpen] = useState(false);

  const backendItems: Array<{
    value: ExternalAgentBackend;
    label: string;
  }> = [
    { value: 'native', label: 'TalkCody' },
    { value: 'claude', label: 'Claude' },
    { value: 'codex', label: 'Codex' },
  ];

  const currentBackendLabel =
    backendItems.find((item) => item.value === currentBackend)?.label ?? 'TalkCody';

  const taskScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sidebarDefaultSize = shouldShowSidebar
    ? themeVariant === 'retroma'
      ? '22%'
      : '20%'
    : '50%';
  const sidebarMaxSize = shouldShowSidebar ? (themeVariant === 'retroma' ? '30%' : '35%') : '70%';
  const sidebarMinSize = shouldShowSidebar ? (themeVariant === 'retroma' ? '18%' : '15%') : '10%';

  return (
    <>
      <ResizablePanel
        id={panelId}
        order={1}
        className={
          shouldShowSidebar
            ? isAppleTheme
              ? 'bg-transparent px-2 py-2'
              : themeVariant === 'retroma'
                ? 'bg-transparent'
                : 'border-r bg-white dark:bg-gray-950'
            : isAppleTheme
              ? 'flex items-center justify-center bg-transparent px-2 py-2'
              : themeVariant === 'retroma'
                ? 'flex items-center justify-center bg-transparent'
                : 'flex items-center justify-center bg-white dark:bg-gray-950'
        }
        defaultSize={sidebarDefaultSize}
        maxSize={sidebarMaxSize}
        minSize={sidebarMinSize}
      >
        {shouldShowSidebar ? (
          <div
            className={cn(
              'flex h-full flex-col',
              isAppleTheme && 'apple-panel apple-scrollbar min-h-0 overflow-hidden',
              themeVariant === 'retroma' &&
                'retroma-surface-sidebar retroma-scrollbar retroma-layout-sidebar min-h-0 overflow-hidden'
            )}
          >
            {hasRepository && (
              <div
                className={cn(
                  'border-b px-2 py-1',
                  isAppleTheme && 'border-white/10',
                  themeVariant === 'retroma' && 'border-border/80'
                )}
              >
                <Tabs
                  value={sidebarView}
                  onValueChange={(value) => {
                    onSidebarViewChange(value as SidebarView);
                  }}
                >
                  <TabsList
                    className={cn(
                      'grid w-full grid-cols-3 p-0.5',
                      isAppleTheme
                        ? 'h-8 rounded-full bg-white/5 dark:bg-white/5'
                        : themeVariant === 'retroma'
                          ? 'h-9 rounded-[18px] bg-transparent p-1'
                          : 'h-7 bg-muted/50'
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={SidebarView.FILES}
                          className={cn(
                            'h-6 px-2.5 data-[state=active]:shadow-none',
                            isAppleTheme && 'rounded-full data-[state=active]:bg-white/10',
                            themeVariant === 'retroma' &&
                              'h-7 rounded-[14px] text-[11px] uppercase tracking-[0.08em]'
                          )}
                        >
                          <Folder className="h-3.5 w-3.5" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t.Sidebar.files}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={SidebarView.GIT}
                          className={cn(
                            'h-6 px-2.5 data-[state=active]:shadow-none',
                            isAppleTheme && 'rounded-full data-[state=active]:bg-white/10',
                            themeVariant === 'retroma'
                              ? 'h-7 rounded-[14px] text-[11px] uppercase tracking-[0.08em]'
                              : 'rounded-full data-[state=active]:bg-white/10'
                          )}
                        >
                          <GitBranch className="h-3.5 w-3.5" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t.Sidebar.git}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={SidebarView.TASKS}
                          className={cn(
                            'h-6 px-2.5 data-[state=active]:shadow-none',
                            isAppleTheme && 'rounded-full data-[state=active]:bg-white/10',
                            themeVariant === 'retroma'
                              ? 'h-7 rounded-[14px] text-[11px] uppercase tracking-[0.08em]'
                              : 'rounded-full data-[state=active]:bg-white/10'
                          )}
                        >
                          <ListTodo className="h-3.5 w-3.5" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t.Sidebar.tasks}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {hasRepository && (
              <div
                className={
                  sidebarView === SidebarView.FILES
                    ? cn(
                        'flex flex-1 flex-col overflow-hidden',
                        isAppleTheme && 'apple-scrollbar',
                        themeVariant === 'retroma' && 'retroma-scrollbar'
                      )
                    : 'hidden'
                }
              >
                <FileTreeHeader
                  onOpenFileSearch={onOpenFileSearch}
                  onOpenContentSearch={onOpenContentSearch}
                />

                <div
                  className={cn(
                    'flex-1 overflow-auto',
                    isAppleTheme && 'apple-scrollbar',
                    themeVariant === 'retroma' && 'retroma-scrollbar px-1 pb-1'
                  )}
                >
                  {fileTree && rootPath && (
                    <FileTree
                      key={rootPath}
                      fileTree={fileTree}
                      repositoryPath={rootPath}
                      expandedPaths={expandedPaths}
                      onFileCreate={onFileCreate}
                      onFileDelete={onFileDelete}
                      onFileRename={onFileRename}
                      onFileSelect={onFileSelect}
                      onOpenInBrowser={onOpenFileInBrowser}
                      onRefresh={onRefreshFileTree}
                      selectedFile={selectedFilePath}
                      onLoadChildren={async (node) => {
                        await onLoadChildren(node);
                        return node.children || [];
                      }}
                      onToggleExpansion={onToggleExpansion}
                      onReferenceToChat={onReferenceToChat}
                    />
                  )}
                </div>
              </div>
            )}

            {hasRepository && (
              <div
                className={
                  sidebarView === SidebarView.GIT
                    ? 'flex flex-1 flex-col overflow-hidden'
                    : 'hidden'
                }
              >
                <GitPanel />
              </div>
            )}

            <div
              className={
                !hasRepository || sidebarView === SidebarView.TASKS
                  ? 'flex flex-1 flex-col overflow-hidden'
                  : 'hidden'
              }
            >
              <div
                className={cn(
                  'border-b p-2',
                  themeVariant === 'retroma' && 'retroma-sidebar-section'
                )}
              >
                <div
                  className={cn(
                    'relative overflow-hidden rounded-xl border bg-background',
                    themeVariant === 'retroma' &&
                      'retroma-new-task-shell rounded-[16px] border-border/60 bg-transparent shadow-none'
                  )}
                >
                  <Button
                    className="h-9 w-full justify-between rounded-xl border-0 px-3 pr-10 shadow-none"
                    disabled={isMaxReached}
                    onClick={() => startNewTask(selectedNewTaskBackend)}
                    size="sm"
                    variant="ghost"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Plus className="h-4 w-4 flex-shrink-0" />
                      <span>新任务</span>
                    </span>
                    <span className="min-w-0 truncate pr-4 text-muted-foreground text-xs">
                      {currentBackendLabel}
                    </span>
                  </Button>

                  <Popover open={backendMenuOpen} onOpenChange={setBackendMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        aria-label={`选择新任务后端，当前 ${currentBackendLabel}`}
                        className="absolute top-1 right-1 h-7 w-7 rounded-lg p-0 shadow-none"
                        disabled={isMaxReached}
                        size="sm"
                        variant="ghost"
                      >
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-44 p-1" side="bottom" sideOffset={4}>
                      <div className="space-y-0.5">
                        {backendItems.map((item) => {
                          const selected = item.value === currentBackend;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                                selected && 'bg-accent'
                              )}
                              onClick={() => {
                                useTaskStore.getState().setSelectedNewTaskBackend(item.value);
                                if (item.value === 'codex') {
                                  useWorktreeStore.getState().setWorktreeMode(true);
                                }
                                setBackendMenuOpen(false);
                              }}
                            >
                              <span>{item.label}</span>
                              {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div
                ref={taskScrollContainerRef}
                className={cn(
                  'flex-1 overflow-auto',
                  themeVariant === 'retroma' && 'retroma-scrollbar retroma-sidebar-scroll px-1 pb-1'
                )}
              >
                <TaskList
                  tasks={tasks}
                  currentTaskId={currentTaskId ?? undefined}
                  editingId={editingId}
                  editingTitle={editingTitle}
                  loading={tasksLoading}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  onLoadMore={() =>
                    loadMoreTasks(currentProjectId || undefined, normalizedTaskSearch)
                  }
                  getWorktreeForTask={getWorktreeForTask}
                  onCancelEdit={cancelEditing}
                  onTaskSelect={(taskId) => {
                    selectTask(taskId);
                  }}
                  onDeleteTask={(taskId, e) => {
                    e?.stopPropagation();
                    deleteTask(taskId).then((result) => {
                      if (result.requiresConfirmation && result.changesCount && result.message) {
                        useWorktreeStore.getState().setPendingDeletion?.({
                          taskId,
                          changesCount: result.changesCount,
                          message: result.message,
                        });
                      }
                    });
                  }}
                  onDeleteTasks={(taskIds) => {
                    // If any task requires confirmation, show dialog for the first one and abort bulk
                    // (keeps current UX consistent with existing single-delete confirmation flow)
                    void (async () => {
                      for (const taskId of taskIds) {
                        const result = await deleteTask(taskId);
                        if (result.requiresConfirmation && result.changesCount && result.message) {
                          useWorktreeStore.getState().setPendingDeletion?.({
                            taskId,
                            changesCount: result.changesCount,
                            message: result.message,
                          });
                          return;
                        }
                      }
                    })();
                  }}
                  onSaveEdit={finishEditing}
                  onStartEditing={startEditing}
                  onTitleChange={setEditingTitle}
                  runningTaskIds={stableRunningTaskIds}
                  scrollRoot={taskScrollContainerRef.current}
                />
              </div>
            </div>
          </div>
        ) : (
          <EmptyRepositoryState
            isLoading={isLoadingProject}
            onSelectRepository={onSelectRepository}
            onOpenRepository={onOpenRepository}
          />
        )}
      </ResizablePanel>

      <ResizableHandle withHandle className={cn(themeVariant === 'retroma' && 'retroma-handle')} />
    </>
  );
});
