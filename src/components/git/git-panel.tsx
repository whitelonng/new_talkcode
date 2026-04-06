import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Globe,
  Loader2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTranslation } from '@/hooks/use-locale';
import { useGitStore } from '@/stores/git-store';
import { GitRemoteActions, GitStagingActions } from './git-action-bar';
import { GitBranchSelector } from './git-branch-selector';
import { GitCommitBox } from './git-commit-box';
import { GitCommitLog } from './git-commit-log';
import { GitFileList } from './git-file-list';
import { GitRemoteManager } from './git-remote-manager';

type GitTab = 'changes' | 'history';

export function GitPanel() {
  const t = useTranslation();
  const gp = t.GitPanel;

  const gitStatus = useGitStore((state) => state.gitStatus);
  const isGitRepository = useGitStore((state) => state.isGitRepository);
  const isLoading = useGitStore((state) => state.isLoading);
  const refreshStatus = useGitStore((state) => state.refreshStatus);
  const remotes = useGitStore((state) => state.remotes);

  const [activeTab, setActiveTab] = useState<GitTab>('changes');
  const [showBranches, setShowBranches] = useState(false);
  const [showRemotes, setShowRemotes] = useState(false);

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
      {/* Branch row — click to expand branch list */}
      <Collapsible open={showBranches} onOpenChange={setShowBranches}>
        <div className="flex items-center border-b border-border">
          <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 px-3 py-2 min-w-0 hover:bg-accent/30 transition-colors">
            {showBranches ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
          </CollapsibleTrigger>

          {/* Action bar stays visible always */}
          <div className="flex items-center gap-1 pr-2">
            {gitStatus && gitStatus.changesCount > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {gitStatus.changesCount}
              </Badge>
            )}
            <GitRemoteActions />
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-b border-border max-h-[240px] overflow-auto">
            <GitBranchSelector />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Remote row — click to expand remote manager */}
      {(branch?.upstream || remotes.length > 0) && (
        <Collapsible open={showRemotes} onOpenChange={setShowRemotes}>
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 border-b border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent/30 transition-colors">
            {showRemotes ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{branch?.upstream ?? remotes[0]?.fetchUrl ?? ''}</span>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-b border-border max-h-[200px] overflow-auto">
              <GitRemoteManager />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Staging actions row */}
      <div className="flex items-center justify-end gap-0.5 border-b border-border px-3 py-1">
        <GitStagingActions />
      </div>

      {/* Tab bar: Changes / History */}
      <div className="flex border-b border-border">
        <button
          type="button"
          className={`flex-1 py-1.5 text-xs font-medium text-center transition-colors ${
            activeTab === 'changes'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('changes')}
        >
          {gp.changesTab}
          {gitStatus && gitStatus.changesCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {gitStatus.changesCount}
            </Badge>
          )}
        </button>
        <button
          type="button"
          className={`flex-1 py-1.5 text-xs font-medium text-center transition-colors ${
            activeTab === 'history'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('history')}
        >
          {gp.historyTab}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'changes' ? (
        <>
          {/* File list - scrollable middle area */}
          <div className="flex-1 overflow-auto">
            <GitFileList />
          </div>

          {/* Commit box - fixed at bottom */}
          <div className="border-t border-border">
            <GitCommitBox />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto">
          <GitCommitLog />
        </div>
      )}
    </div>
  );
}
