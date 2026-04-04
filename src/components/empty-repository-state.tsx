import { exists } from '@tauri-apps/plugin-fs';
import { Clock, FolderGit2, FolderOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import type { Project } from '@/services/database-service';
import { useProjectStore } from '@/stores/project-store';

interface EmptyRepositoryStateProps {
  onSelectRepository: () => void;
  onOpenRepository: (path: string, projectId: string) => Promise<void>;
  isLoading: boolean;
}

export function EmptyRepositoryState({
  onSelectRepository,
  onOpenRepository,
  isLoading,
}: EmptyRepositoryStateProps) {
  const { t } = useLocale();
  const [isOpeningRepository, setIsOpeningRepository] = useState<string | null>(null);

  // Use project store for shared state
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const projects = useProjectStore((state) => state.projects);

  // Sort projects by updated_at descending (most recent first)
  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.updated_at - a.updated_at),
    [projects]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleOpenRepository = async (project: Project) => {
    if (!project.root_path) {
      toast.error(t.Projects.noRepository);
      return;
    }

    try {
      // Validate path exists before opening to prevent unnecessary error loops
      const pathExists = await exists(project.root_path);
      if (!pathExists) {
        toast.error(
          t.Repository.directoryNotFound || `Directory no longer exists: ${project.root_path}`
        );
        return;
      }

      setIsOpeningRepository(project.id);
      await onOpenRepository(project.root_path, project.id);
    } catch (error) {
      logger.error('Failed to open repository:', error);
      toast.error(t.Repository.openFailed(project.root_path));
    } finally {
      setIsOpeningRepository(null);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <FolderOpen className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h2 className="mb-2 font-semibold text-xl">{t.Repository.emptyState.title}</h2>
          <p className="mb-6 text-gray-600">{t.Repository.emptyState.description}</p>
          <Button disabled={isLoading} onClick={onSelectRepository}>
            {isLoading ? t.Repository.importing : t.Repository.selectRepository}
          </Button>
        </div>

        {recentProjects.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-muted-foreground text-sm">
                {t.Projects.recentProjects}
              </h3>
            </div>

            <div className="max-h-[500px] space-y-2 overflow-y-auto">
              {recentProjects.map((project) => (
                <Card
                  key={project.id}
                  className={`cursor-pointer transition-all hover:shadow-sm ${
                    project.root_path ? 'hover:border-primary/50' : 'opacity-60'
                  }`}
                  onClick={() => project.root_path && handleOpenRepository(project)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <FolderGit2
                          className={`h-4 w-4 flex-shrink-0 ${
                            project.root_path ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium text-sm">{project.name}</p>
                            {project.id === 'default' && (
                              <Badge variant="outline" className="text-xs">
                                {t.Common.default}
                              </Badge>
                            )}
                          </div>
                          {project.root_path ? (
                            <p
                              className="truncate text-muted-foreground text-xs"
                              title={project.root_path}
                            >
                              {project.root_path}
                            </p>
                          ) : (
                            <p className="text-muted-foreground text-xs">
                              {t.Projects.noRepository}
                            </p>
                          )}
                        </div>
                      </div>

                      {isOpeningRepository === project.id && (
                        <div className="text-muted-foreground text-xs">{t.Projects.opening}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
