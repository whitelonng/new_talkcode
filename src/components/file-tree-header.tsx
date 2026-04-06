import { FileSearch, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { ProjectDropdown } from './project-dropdown';

interface FileTreeHeaderProps {
  currentProjectId?: string | null;
  onProjectSelect?: (projectId: string) => Promise<void>;
  onImportRepository?: () => Promise<void>;
  isLoadingProject?: boolean;
  onOpenFileSearch?: () => void;
  onOpenContentSearch?: () => void;
}

export function FileTreeHeader({
  currentProjectId,
  onProjectSelect,
  onImportRepository,
  isLoadingProject,
  onOpenFileSearch,
  onOpenContentSearch,
}: FileTreeHeaderProps) {
  const t = useTranslation();

  return (
    <div className="flex h-[42px] flex-shrink-0 items-center justify-between border-b bg-gray-50 px-3 dark:bg-gray-900">
      {/* Left: Project Dropdown */}
      <div className="flex min-w-0 flex-1 items-center">
        {onProjectSelect && onImportRepository && (
          <ProjectDropdown
            currentProjectId={currentProjectId || null}
            onProjectSelect={onProjectSelect}
            onImportRepository={onImportRepository}
            isLoading={isLoadingProject || false}
          />
        )}
      </div>

      {/* Right: Search Actions */}
      <div className="flex items-center gap-1">
        {/* File Search */}
        {onOpenFileSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={onOpenFileSearch}
                size="sm"
                variant="ghost"
              >
                <FileSearch className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t.Chat.toolbar.searchFiles}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Content Search */}
        {onOpenContentSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={onOpenContentSearch}
                size="sm"
                variant="ghost"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t.Chat.toolbar.searchContent}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
