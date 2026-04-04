import { ChevronDown, FolderPlus } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logger } from '@/lib/logger';
import { useProjectStore } from '@/stores/project-store';

interface ProjectSelectorProps {
  currentProjectId: string | null;
  onProjectSelect: (projectId: string) => Promise<void>;
  onImportRepository: () => Promise<void>;
  isLoading: boolean;
}

export function ProjectDropdown({
  currentProjectId,
  onProjectSelect,
  onImportRepository,
  isLoading,
}: ProjectSelectorProps) {
  // Use project store for shared state
  const projects = useProjectStore((state) => state.projects);
  const isLoadingProjects = useProjectStore((state) => state.isLoading);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const refreshProjects = useProjectStore((state) => state.refreshProjects);

  // Derive current project from projects list
  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) || null,
    [projects, currentProjectId]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectSelect = async (projectId: string) => {
    try {
      await onProjectSelect(projectId);
    } catch (error) {
      logger.error('Failed to switch project:', error);
      toast.error('Failed to switch project');
    }
  };

  const handleImportRepository = async () => {
    try {
      await onImportRepository();
      // Reload projects after importing a new repository
      await refreshProjects();
    } catch (error) {
      logger.error('Failed to import repository:', error);
      toast.error('Failed to import repository');
    }
  };

  if (isLoadingProjects) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-800"
          disabled={isLoading}
        >
          {currentProject ? (
            <>
              <span className="max-w-[200px] truncate">{currentProject.name}</span>
              <ChevronDown className="h-4 w-4" />
            </>
          ) : (
            <span className="text-muted-foreground">Select Project</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-96 w-64 overflow-y-auto">
        {projects.length > 0 ? (
          projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className="flex flex-col items-start gap-1"
            >
              <div className="w-full truncate font-medium">{project.name}</div>
              {project.root_path && (
                <div className="w-full truncate text-muted-foreground text-xs">
                  {project.root_path}
                </div>
              )}
              {project.id === 'default' && (
                <div className="text-muted-foreground text-xs">Default Project</div>
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No projects available</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleImportRepository} className="flex items-center gap-2">
          <FolderPlus className="h-4 w-4" />
          Import Repository
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
