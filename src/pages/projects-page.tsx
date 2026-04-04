import { ask } from '@tauri-apps/plugin-dialog';
import { ExternalLink, FolderOpen, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUiNavigation } from '@/contexts/ui-navigation';
import { useTranslation } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { databaseService } from '@/services/database-service';
import { WindowManagerService } from '@/services/window-manager-service';
import { useProjectStore } from '@/stores/project-store';
import { settingsManager } from '@/stores/settings-store';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';
import type { Project } from '@/types';
import { NavigationView } from '@/types/navigation';

export function ProjectsPage() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const t = useTranslation();
  const selectRepository = useRepositoryStore((state) => state.selectRepository);
  const openRepository = useRepositoryStore((state) => state.openRepository);
  const { setActiveView } = useUiNavigation();

  // Use project store for shared state
  const projects = useProjectStore((state) => state.projects);
  const isLoading = useProjectStore((state) => state.isLoading);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const refreshProjects = useProjectStore((state) => state.refreshProjects);
  const deleteProjectFromStore = useProjectStore((state) => state.deleteProject);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectSelect = async (projectId: string) => {
    try {
      const project = await databaseService.getProject(projectId);
      if (project) {
        setCurrentProjectId(projectId);

        if (project.root_path) {
          // Project has root_path: open repository and navigate to EXPLORER
          await openRepository(project.root_path, projectId);
        } else {
          // Project has no root_path: set as current project and navigate to CHAT
          await settingsManager.setCurrentProjectId(projectId);
        }
        setActiveView(NavigationView.EXPLORER);
      }
    } catch (error) {
      logger.error('Failed to open project:', error);
    }
  };

  const handleImportRepository = async () => {
    try {
      const newProject = await selectRepository();
      if (newProject) {
        setCurrentProjectId(newProject.id);
        await refreshProjects();
      }
    } catch (error) {
      logger.error('Failed to import repository:', error);
    }
  };

  const handleOpenInNewWindow = async (event: React.MouseEvent, project: Project) => {
    event.stopPropagation(); // Prevent card click
    try {
      if (!project.root_path) {
        toast.error(t.Projects.page.noRepositoryPath);
        return;
      }

      await WindowManagerService.openProjectInWindow(project.root_path, project.id);
      toast.success(t.Projects.page.openedInNewWindow(project.name));
    } catch (error) {
      logger.error('Failed to open project in new window:', error);
      toast.error(t.Projects.page.failedToOpenInWindow);
    }
  };

  const handleDeleteProject = async (event: React.MouseEvent, project: Project) => {
    event.stopPropagation();

    try {
      const shouldDelete = await ask(t.Projects.page.deleteProjectDescription(project.name), {
        title: t.Projects.page.deleteProjectTitle,
        kind: 'warning',
      });

      if (shouldDelete) {
        await deleteProjectFromStore(project.id);
        toast.success(t.Projects.page.deleteProjectSuccess(project.name));
      }
    } catch (error) {
      logger.error('Failed to delete project:', error);
      toast.error(t.Projects.page.deleteProjectError);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t.Projects.page.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.Projects.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t.Projects.page.description}</p>
        </div>
        <Button onClick={handleImportRepository} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t.Projects.page.importRepository}
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t.Projects.page.emptyTitle}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t.Projects.page.emptyDescription}
            </p>
            <Button onClick={handleImportRepository} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t.Projects.page.importRepository}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  currentProjectId === project.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : ''
                }`}
                onClick={() => handleProjectSelect(project.id)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      {project.name}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {project.root_path && (
                          <DropdownMenuItem
                            onClick={(e) => handleOpenInNewWindow(e, project)}
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {t.Projects.page.openInNewWindow}
                          </DropdownMenuItem>
                        )}
                        {project.root_path && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteProject(e, project)}
                          className="flex items-center gap-2 text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t.Projects.page.deleteProject}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{project.root_path}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
