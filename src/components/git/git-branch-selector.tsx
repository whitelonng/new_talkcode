import { ArrowDown, ArrowUp, Check, GitBranch, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';
import type { BranchInfo } from '@/types/git';

export function GitBranchSelector() {
  const t = useTranslation();
  const gp = t.GitPanel;

  const branches = useGitStore((state) => state.branches);
  const isBranchesLoading = useGitStore((state) => state.isBranchesLoading);
  const loadBranches = useGitStore((state) => state.loadBranches);
  const checkoutBranch = useGitStore((state) => state.checkoutBranch);
  const createBranch = useGitStore((state) => state.createBranch);
  const deleteBranch = useGitStore((state) => state.deleteBranch);
  const gitStatus = useGitStore((state) => state.gitStatus);

  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);

  const currentBranchName = gitStatus?.branch?.name ?? null;

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleCheckout = useCallback(
    async (branchName: string) => {
      if (branchName === currentBranchName) return;
      setSwitchingBranch(branchName);
      try {
        await checkoutBranch(branchName);
      } finally {
        setSwitchingBranch(null);
      }
    },
    [checkoutBranch, currentBranchName]
  );

  const handleCreate = useCallback(async () => {
    const name = newBranchName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      await createBranch(name, true);
      setNewBranchName('');
    } finally {
      setIsCreating(false);
    }
  }, [createBranch, newBranchName]);

  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }
    },
    [handleCreate]
  );

  const handleDelete = useCallback(
    async (branchName: string) => {
      setDeletingBranch(branchName);
      try {
        await deleteBranch(branchName, false);
      } finally {
        setDeletingBranch(null);
        setConfirmDelete(null);
      }
    },
    [deleteBranch]
  );

  const handleDeleteClick = useCallback(
    (branchName: string) => {
      if (confirmDelete === branchName) {
        handleDelete(branchName);
      } else {
        setConfirmDelete(branchName);
      }
    },
    [confirmDelete, handleDelete]
  );

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(null);
  }, []);

  // Sort branches: current first, then alphabetically
  const sortedBranches = [...branches].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full flex-col">
      {/* Current branch highlight */}
      {!currentBranchName && (
        <div className="border-b border-border px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{gp.currentBranch}:</span>
            <span className="font-semibold text-foreground">{'None'}</span>
          </div>
        </div>
      )}

      {/* Branch list - scrollable */}
      <div className="flex-1 overflow-auto">
        {isBranchesLoading && branches.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedBranches.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">{gp.noBranches}</div>
        ) : (
          <ul className="flex flex-col py-1">
            {sortedBranches.map((branch) => (
              <BranchItem
                key={branch.name}
                branch={branch}
                isCurrent={branch.name === currentBranchName}
                isSwitching={switchingBranch === branch.name}
                isDeleting={deletingBranch === branch.name}
                isConfirmingDelete={confirmDelete === branch.name}
                onCheckout={handleCheckout}
                onDeleteClick={handleDeleteClick}
                onCancelDelete={handleCancelDelete}
                gp={gp}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Create branch input - fixed at bottom */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-1.5">
          <Input
            placeholder={gp.branchNamePlaceholder}
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            disabled={isCreating}
            className="h-7 text-xs"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                disabled={isCreating || !newBranchName.trim()}
                onClick={handleCreate}
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{gp.createBranch}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch list item
// ---------------------------------------------------------------------------

interface BranchItemProps {
  branch: BranchInfo;
  isCurrent: boolean;
  isSwitching: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onCheckout: (name: string) => void;
  onDeleteClick: (name: string) => void;
  onCancelDelete: () => void;
  gp: ReturnType<typeof useTranslation>['GitPanel'];
}

function BranchItem({
  branch,
  isCurrent,
  isSwitching,
  isDeleting,
  isConfirmingDelete,
  onCheckout,
  onDeleteClick,
  onCancelDelete,
  gp,
}: BranchItemProps) {
  const ahead = branch.ahead ?? 0;
  const behind = branch.behind ?? 0;

  return (
    <li
      className={cn(
        'group flex items-center gap-1.5 px-2 py-1 text-xs select-none',
        isCurrent ? 'bg-accent/60 dark:bg-accent/40' : 'hover:bg-accent/50 cursor-pointer'
      )}
    >
      {/* Clickable area for switching */}
      <button
        type="button"
        className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
        disabled={isCurrent || isSwitching}
        onClick={() => onCheckout(branch.name)}
      >
        {/* Current indicator */}
        {isCurrent ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : isSwitching ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        {/* Branch name */}
        <span
          className={cn(
            'truncate',
            isCurrent ? 'font-semibold text-foreground' : 'text-foreground'
          )}
          title={branch.name}
        >
          {branch.name}
        </span>

        {/* Upstream info badges */}
        {ahead > 0 && (
          <Badge
            variant="secondary"
            className="h-4 gap-0.5 px-1 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
          >
            <ArrowUp className="h-2.5 w-2.5" />
            {ahead}
          </Badge>
        )}
        {behind > 0 && (
          <Badge
            variant="secondary"
            className="h-4 gap-0.5 px-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
          >
            <ArrowDown className="h-2.5 w-2.5" />
            {behind}
          </Badge>
        )}
      </button>

      {/* Upstream label (compact) */}
      {branch.upstream && (
        <span
          className="hidden group-hover:inline shrink-0 text-[10px] text-muted-foreground max-w-[80px] truncate"
          title={branch.upstream}
        >
          ↔ {branch.upstream}
        </span>
      )}

      {/* Delete controls - only for non-current branches */}
      {!isCurrent && (
        <div className="flex items-center shrink-0">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-0.5">
              {/* Confirm delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/50"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(branch.name);
                    }}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{gp.confirmDeleteBranch}</TooltipContent>
              </Tooltip>

              {/* Cancel delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelDelete();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(branch.name);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{gp.deleteBranch}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </li>
  );
}
