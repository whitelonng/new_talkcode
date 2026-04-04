import { FileText, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';

export function GitStatusBar() {
  const gitStatus = useGitStore((state) => state.gitStatus);
  const isGitRepository = useGitStore((state) => state.isGitRepository);
  const isLoading = useGitStore((state) => state.isLoading);

  if (!isGitRepository || !gitStatus) {
    return null;
  }

  const { branch, changesCount, modified, staged, untracked, conflicted } = gitStatus;

  const hasChanges = changesCount > 0;
  const hasConflicts = conflicted.length > 0;

  return (
    <div className="flex items-center gap-3 border-t border-border bg-muted/50 px-4 py-1.5 text-xs text-foreground">
      {/* Branch Info */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{branch?.name || 'Unknown'}</span>
              {branch?.ahead !== null && branch?.ahead !== undefined && branch.ahead > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 px-1 py-0 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                >
                  ↑{branch.ahead}
                </Badge>
              )}
              {branch?.behind !== null && branch?.behind !== undefined && branch.behind > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 px-1 py-0 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                >
                  ↓{branch.behind}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div className="font-medium">Branch: {branch?.name}</div>
              {branch?.upstream && (
                <div className="text-muted-foreground">Upstream: {branch.upstream}</div>
              )}
              {branch?.ahead !== null && branch?.ahead !== undefined && branch.ahead > 0 && (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {branch.ahead} commit{branch.ahead > 1 ? 's' : ''} ahead
                </div>
              )}
              {branch?.behind !== null && branch?.behind !== undefined && branch.behind > 0 && (
                <div className="text-amber-600 dark:text-amber-400">
                  {branch.behind} commit{branch.behind > 1 ? 's' : ''} behind
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Separator */}
      <div className="h-3 w-px bg-border" />

      {/* Changes Summary */}
      {hasChanges && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors',
                  hasConflicts && 'text-destructive hover:text-destructive'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">
                  {changesCount} change{changesCount > 1 ? 's' : ''}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-h-64 max-w-xs overflow-y-auto text-xs space-y-2">
                {staged.length > 0 && (
                  <div>
                    <div className="font-medium text-emerald-600 dark:text-emerald-400">
                      Staged ({staged.length})
                    </div>
                    {staged.map((file) => (
                      <div
                        key={file.path}
                        className="ml-2 truncate text-emerald-600/80 dark:text-emerald-400/80"
                      >
                        {file.path}
                      </div>
                    ))}
                  </div>
                )}
                {modified.length > 0 && (
                  <div>
                    <div className="font-medium text-sky-600 dark:text-sky-400">
                      Modified ({modified.length})
                    </div>
                    {modified.map((file) => (
                      <div
                        key={file.path}
                        className="ml-2 truncate text-sky-600/80 dark:text-sky-400/80"
                      >
                        {file.path}
                      </div>
                    ))}
                  </div>
                )}
                {untracked.length > 0 && (
                  <div>
                    <div className="font-medium text-muted-foreground">
                      Untracked ({untracked.length})
                    </div>
                    {untracked.map((path) => (
                      <div key={path} className="ml-2 truncate text-muted-foreground/80">
                        {path}
                      </div>
                    ))}
                  </div>
                )}
                {conflicted.length > 0 && (
                  <div>
                    <div className="font-medium text-destructive">
                      Conflicts ({conflicted.length})
                    </div>
                    {conflicted.map((path) => (
                      <div key={path} className="ml-2 truncate text-destructive/80">
                        {path}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {!hasChanges && !isLoading && <span className="text-muted-foreground">No changes</span>}

      {isLoading && <span className="text-muted-foreground animate-pulse">Loading...</span>}
    </div>
  );
}
