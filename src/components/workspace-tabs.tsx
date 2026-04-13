import { FolderOpen, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { useWorkspaceTabsStore } from '@/stores/workspace-tabs-store';

interface WorkspaceTabsProps {
  currentProjectId: string | null;
  currentProjectName: string;
  currentTaskId?: string | null;
  onTabSelect?: (projectId: string | null, rootPath: string | null) => void;
  onImportRepository?: () => void;
}

export function WorkspaceTabs({
  currentProjectId,
  currentProjectName,
  currentTaskId,
  onTabSelect,
  onImportRepository,
}: WorkspaceTabsProps) {
  const { t } = useLocale();
  const { isAppleTheme } = useTheme();
  const projects = useProjectStore((state) => state.projects);
  const loadProjects = useProjectStore((state) => state.loadProjects);

  const { tabs, activeTabId, addTab, removeTab, setActiveTab, updateTab, initializeFirstTab } =
    useWorkspaceTabsStore();

  // Load projects
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Keep the active tab aligned with the actual current project selection.
  useEffect(() => {
    if (tabs.length === 0 || !(currentProjectId || currentProjectName)) {
      return;
    }

    const currentProject = projects.find((project) => project.id === currentProjectId);
    const nextProjectName = currentProjectName || currentProject?.name || '';
    const nextRootPath = currentProject?.root_path || null;
    const existingTab = currentProjectId
      ? tabs.find((tab) => tab.projectId === currentProjectId)
      : undefined;

    if (existingTab) {
      if (activeTabId !== existingTab.id) {
        setActiveTab(existingTab.id);
      }

      if (
        existingTab.projectName !== nextProjectName ||
        existingTab.rootPath !== nextRootPath
      ) {
        updateTab(existingTab.id, {
          projectId: currentProjectId,
          projectName: nextProjectName,
          rootPath: nextRootPath,
        });
      }

      return;
    }

    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab) {
      if (
        activeTab.projectId !== currentProjectId ||
        activeTab.projectName !== nextProjectName ||
        activeTab.rootPath !== nextRootPath
      ) {
        updateTab(activeTab.id, {
          projectId: currentProjectId,
          projectName: nextProjectName,
          rootPath: nextRootPath,
        });
      }
      return;
    }

    initializeFirstTab(currentProjectId, nextProjectName, nextRootPath);
  }, [
    activeTabId,
    currentProjectId,
    currentProjectName,
    initializeFirstTab,
    projects,
    setActiveTab,
    tabs,
    updateTab,
  ]);

  // Projects not already assigned to a tab
  const availableProjects = useMemo(() => {
    const usedProjectIds = new Set(tabs.filter((t) => t.projectId).map((t) => t.projectId));
    return projects.filter((p) => !usedProjectIds.has(p.id));
  }, [projects, tabs]);

  const canAddTab = tabs.length < 3;

  const handleAddTab = useCallback(() => {
    if (!canAddTab) {
      toast.error(t.Titlebar.workspaceTabs.maxTabsReached);
      return;
    }
    addTab();
  }, [addTab, canAddTab, t.Titlebar.workspaceTabs.maxTabsReached]);

  useEffect(() => {
    window.addEventListener('workspace:create', handleAddTab);
    return () => {
      window.removeEventListener('workspace:create', handleAddTab);
    };
  }, [handleAddTab]);

  const handleSelectProjectForTab = (tabId: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    updateTab(tabId, {
      projectId: project.id,
      projectName: project.name,
      rootPath: project.root_path || null,
    });

    setActiveTab(tabId);
    onTabSelect?.(project.id, project.root_path || null);
  };

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    setActiveTab(tabId);
    onTabSelect?.(tab.projectId, tab.rootPath);
  };

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const wasActive = tabId === activeTabId;
    removeTab(tabId);

    if (wasActive) {
      const newState = useWorkspaceTabsStore.getState();
      const newActiveTab = newState.tabs.find((t) => t.id === newState.activeTabId);
      if (newActiveTab) {
        onTabSelect?.(newActiveTab.projectId, newActiveTab.rootPath);
      }
    }
  };

  return (
    <div className="flex items-center gap-0.5 h-full">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const hasProject = !!tab.projectId;

        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            className={cn(
              'group relative flex min-w-[12ch] items-center justify-center h-7 rounded-md px-8 cursor-pointer transition-colors text-xs select-none',
              isActive
                ? isAppleTheme
                  ? 'bg-white/15 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : isAppleTheme
                  ? 'hover:bg-white/10 text-white/70'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            )}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleTabClick(tab.id);
              }
            }}
          >
            {hasProject ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block max-w-[120px] truncate text-center text-xs font-medium">
                    {tab.projectName}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="space-y-1">
                    <p>{tab.rootPath || tab.projectName}</p>
                    {isActive && currentTaskId && (
                      <p className="text-[11px] text-muted-foreground">Task: {currentTaskId}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span className="flex items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground">
                    <FolderOpen className="h-3 w-3" />
                    {t.Titlebar.workspaceTabs.selectProject}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
                  {availableProjects.length > 0 ? (
                    availableProjects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProjectForTab(tab.id, project.id);
                        }}
                        className="flex flex-col items-start gap-1"
                      >
                        <div className="w-full truncate font-medium">{project.name}</div>
                        {project.root_path && (
                          <div className="w-full truncate text-muted-foreground text-xs">
                            {project.root_path}
                          </div>
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      {t.Titlebar.workspaceTabs.noProject}
                    </DropdownMenuItem>
                  )}
                  {onImportRepository && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onImportRepository();
                        }}
                        className="flex items-center gap-2"
                      >
                        <FolderOpen className="h-4 w-4" />
                        {t.Titlebar.workspaceTabs.importRepository}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              type="button"
              className={cn(
                'absolute right-2 rounded p-0.5 transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                isAppleTheme ? 'hover:bg-white/20' : 'hover:bg-gray-300 dark:hover:bg-gray-600'
              )}
              onClick={(e) => handleRemoveTab(e, tab.id)}
              title={t.Titlebar.workspaceTabs.closeTab}
            >
              <X className="h-3 w-3" />
            </button>

            {/* Active tab indicator */}
            {isActive && (
              <div
                className={cn(
                  'absolute bottom-0 left-1 right-1 h-0.5 rounded-full',
                  isAppleTheme ? 'bg-white/50' : 'bg-blue-500'
                )}
              />
            )}
          </div>
        );
      })}

      {/* Add tab button */}
      {canAddTab ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 w-6 p-0 ml-0.5',
                isAppleTheme ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              onClick={handleAddTab}
            >
              <Plus
                className={cn(
                  'h-3.5 w-3.5',
                  isAppleTheme ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t.Titlebar.workspaceTabs.newTab}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-0.5 opacity-30 cursor-not-allowed"
              disabled
            >
              <Plus className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t.Titlebar.workspaceTabs.maxTabsReached}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
