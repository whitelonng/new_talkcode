import { FileSearch, FolderTree, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

interface FileTreeHeaderProps {
  onOpenFileSearch?: () => void;
  onOpenContentSearch?: () => void;
}

export function FileTreeHeader({ onOpenFileSearch, onOpenContentSearch }: FileTreeHeaderProps) {
  const t = useTranslation();
  const { isAppleTheme, isRetromaTheme } = useTheme();

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-between border-b px-3',
        isAppleTheme
          ? 'h-[36px] border-white/10 bg-black/20 backdrop-blur-xl dark:bg-white/5'
          : isRetromaTheme
            ? 'retroma-pane-header h-[38px]'
            : 'h-[32px] bg-gray-50 dark:bg-gray-900'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FolderTree className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t.Sidebar.files}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {onOpenFileSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  'p-0',
                  isAppleTheme
                    ? 'h-7 w-7 rounded-full hover:bg-white/10 dark:hover:bg-white/10'
                    : isRetromaTheme
                      ? 'h-7 w-7 rounded-full hover:bg-accent'
                      : 'h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
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

        {onOpenContentSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  'p-0',
                  isAppleTheme
                    ? 'h-7 w-7 rounded-full hover:bg-white/10 dark:hover:bg-white/10'
                    : isRetromaTheme
                      ? 'h-7 w-7 rounded-full hover:bg-accent'
                      : 'h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
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
