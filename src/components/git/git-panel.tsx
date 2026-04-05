import { ArrowDown, ArrowUp, GitBranch, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-locale';
import { useGitStore } from '@/stores/git-store';
import { GitActionBar } from './git-action-bar';
import { GitCommitBox } from './git-commit-box';
import { GitFileList } from './git-file-list';

export function GitPanel() {
  const t = useTranslation();
  const gp = t.GitPanel;

  const gitStatus = useGitStore((state) => state.gitStatus);
  const isGitRepository = useGitStore((state) => state.isGitRepository);
  const isLoading = useGitStore((state) => state.isLoading);
  const refreshStatus = useGitStore((state) => state.refreshStatus);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  if (!isGitRepository) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <GitBranch className="h-8 w-8" />
          <span>{gp.notGitRepo}</span>
        </div>
      </div>
    );
  }

  if (isLoading && !gitStatus) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const branch = gitStatus?.branch;
  const ahead = branch?.ahead ?? 0;
  const behind = branch?.behind ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Branch summary header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {branch?.name ?? gp.noBranch}
          </span>
          {ahead > 0 && (
            <Badge
              variant="secondary"
              className="h-5 gap-0.5 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
            >
              <ArrowUp className="h-3 w-3" />
              {ahead}
            </Badge>
          )}
          {behind > 0 && (
            <Badge
              variant="secondary"
              className="h-5 gap-0.5 px-1.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
            >
              <ArrowDown className="h-3 w-3" />
              {behind}
            </Badge>
          )}
          {ahead === 0 && behind === 0 && branch?.upstream && (
            <span className="text-[10px] text-muted-foreground">{gp.upToDate}</span>
          )}
        </div>

        {/* Changes count + action bar */}
        <div className="flex items-center gap-2">
          {gitStatus && gitStatus.changesCount > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {gitStatus.changesCount}
            </Badge>
          )}
          <GitActionBar />
        </div>
      </div>

      {/* Upstream info */}
      {branch?.upstream && (
        <div className="border-b border-border px-3 py-1 text-[11px] text-muted-foreground truncate">
          ↔ {branch.upstream}
        </div>
      )}

      {/* File list - scrollable middle area */}
      <div className="flex-1 overflow-auto">
        <GitFileList />
      </div>

      {/* Commit box - fixed at bottom */}
      <div className="border-t border-border">
        <GitCommitBox />
      </div>
    </div>
  );
}
