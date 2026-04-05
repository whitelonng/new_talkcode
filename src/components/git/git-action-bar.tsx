import { ArrowDown, ArrowUp, Loader2, Minus, Plus, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { useGitStore } from '@/stores/git-store';

export function GitActionBar() {
  const t = useTranslation();

  const gitStatus = useGitStore((state) => state.gitStatus);
  const selectedFiles = useGitStore((state) => state.selectedFiles);
  const isLoading = useGitStore((state) => state.isLoading);
  const isStaging = useGitStore((state) => state.isStaging);
  const isPushing = useGitStore((state) => state.isPushing);
  const isPulling = useGitStore((state) => state.isPulling);
  const stageSelected = useGitStore((state) => state.stageSelected);
  const unstageSelected = useGitStore((state) => state.unstageSelected);
  const stageAll = useGitStore((state) => state.stageAll);
  const unstageAll = useGitStore((state) => state.unstageAll);
  const push = useGitStore((state) => state.push);
  const pull = useGitStore((state) => state.pull);
  const refreshStatus = useGitStore((state) => state.refreshStatus);
  const fileStatuses = useGitStore((state) => state.fileStatuses);

  const hasUnstagedSelected = useMemo(() => {
    if (!selectedFiles.size) return false;
    for (const file of selectedFiles) {
      const status = fileStatuses[file];
      if (status && !status[1]) return true;
    }
    return false;
  }, [selectedFiles, fileStatuses]);

  const hasStagedSelected = useMemo(() => {
    if (!selectedFiles.size) return false;
    for (const file of selectedFiles) {
      const status = fileStatuses[file];
      if (status && status[1]) return true;
    }
    return false;
  }, [selectedFiles, fileStatuses]);

  const hasModifiedOrUntracked = Boolean(
    gitStatus && (gitStatus.modified.length > 0 || gitStatus.untracked.length > 0)
  );

  const hasStagedChanges = Boolean(gitStatus && gitStatus.staged.length > 0);

  const gp = t.GitPanel;

  return (
    <div className="flex items-center gap-0.5">
      {/* Stage Selected */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasUnstagedSelected || isStaging}
            onClick={stageSelected}
          >
            {isStaging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{gp.stageSelected}</TooltipContent>
      </Tooltip>

      {/* Unstage Selected */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasStagedSelected || isStaging}
            onClick={unstageSelected}
          >
            {isStaging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{gp.unstageSelected}</TooltipContent>
      </Tooltip>

      {/* Stage All */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasModifiedOrUntracked || isStaging}
            onClick={stageAll}
          >
            {isStaging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{gp.stageAll}</TooltipContent>
      </Tooltip>

      {/* Unstage All */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasStagedChanges || isStaging}
            onClick={unstageAll}
          >
            {isStaging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Minus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{gp.unstageAll}</TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className="mx-1 h-4 w-px bg-border" />

      {/* Pull */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isPulling}
            onClick={pull}
          >
            {isPulling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPulling ? gp.pulling : gp.pull}</TooltipContent>
      </Tooltip>

      {/* Push */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isPushing}
            onClick={push}
          >
            {isPushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPushing ? gp.pushing : gp.push}</TooltipContent>
      </Tooltip>

      {/* Refresh */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isLoading}
            onClick={refreshStatus}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isLoading ? gp.refreshing : gp.refresh}</TooltipContent>
      </Tooltip>
    </div>
  );
}
