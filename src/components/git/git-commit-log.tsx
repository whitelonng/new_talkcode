import { Clock, GitCommitHorizontal, Loader2, User } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';
import type { CommitLogEntry } from '@/types/git';

const COMMIT_PAGE_SIZE = 50;

/**
 * Converts an epoch-seconds timestamp to a human-readable relative time string.
 * Examples: "just now", "2m ago", "3h ago", "5d ago", "2w ago", "4mo ago", "1y ago"
 */
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);

  if (diff < 60) return 'just now';

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

interface CommitRowProps {
  entry: CommitLogEntry;
  commitByLabel: string;
}

function CommitRow({ entry, commitByLabel }: CommitRowProps) {
  const fullMessage = entry.body ? `${entry.message}\n\n${entry.body}` : entry.message;

  const tooltipText = `${entry.hash}\n${fullMessage}\n\n${commitByLabel} ${entry.authorName} <${entry.authorEmail}>`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'group flex items-start gap-2 px-3 py-1.5',
            'hover:bg-accent/50 rounded-sm cursor-default',
            'transition-colors duration-100'
          )}
        >
          {/* Commit icon + short hash */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <GitCommitHorizontal className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
              {entry.shortHash}
            </span>
          </div>

          {/* Message + author */}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate text-xs text-foreground leading-5">{entry.message}</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground leading-4">
              <User className="size-3 shrink-0" />
              <span className="truncate">{entry.authorName}</span>
            </span>
          </div>

          {/* Relative time */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <Clock className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(entry.timestamp)}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs whitespace-pre-wrap break-all">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

export function GitCommitLog() {
  const t = useTranslation();
  const gp = t.GitPanel;

  const commitLog = useGitStore((state) => state.commitLog);
  const isCommitLogLoading = useGitStore((state) => state.isCommitLogLoading);
  const loadMoreCommits = useGitStore((state) => state.loadMoreCommits);

  const handleLoadMore = useCallback(() => {
    loadMoreCommits();
  }, [loadMoreCommits]);

  const hasMore = commitLog.length >= COMMIT_PAGE_SIZE && commitLog.length % COMMIT_PAGE_SIZE === 0;

  // Empty state
  if (!isCommitLogLoading && commitLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <GitCommitHorizontal className="size-6" />
        <span>{gp.noCommits}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Commit list */}
      <ul className="flex flex-col">
        {commitLog.map((entry) => (
          <li key={entry.hash}>
            <CommitRow entry={entry} commitByLabel={gp.commitBy} />
          </li>
        ))}
      </ul>

      {/* Load more / loading indicator */}
      <div className="flex justify-center px-3 py-2">
        {isCommitLogLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : hasMore ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleLoadMore}
          >
            {gp.loadMore}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
