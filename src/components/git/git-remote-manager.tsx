import { Globe, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';

export function GitRemoteManager() {
  const t = useTranslation();
  const gp = t.GitPanel;

  const remotes = useGitStore((state) => state.remotes);
  const isRemotesLoading = useGitStore((state) => state.isRemotesLoading);
  const loadRemotes = useGitStore((state) => state.loadRemotes);
  const addRemote = useGitStore((state) => state.addRemote);
  const removeRemote = useGitStore((state) => state.removeRemote);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  const handleAdd = useCallback(async () => {
    const trimmedName = newName.trim();
    const trimmedUrl = newUrl.trim();
    if (!trimmedName || !trimmedUrl) return;

    setIsAdding(true);
    try {
      await addRemote(trimmedName, trimmedUrl);
      setNewName('');
      setNewUrl('');
      setShowAddForm(false);
    } finally {
      setIsAdding(false);
    }
  }, [newName, newUrl, addRemote]);

  const handleRemove = useCallback(
    async (name: string) => {
      await removeRemote(name);
      setConfirmingRemove(null);
    },
    [removeRemote]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{gp.remotes}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              <Plus className={cn('h-4 w-4 transition-transform', showAddForm && 'rotate-45')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{gp.addRemote}</TooltipContent>
        </Tooltip>
      </div>

      {/* Add remote form (collapsible) */}
      {showAddForm && (
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={gp.remoteNamePlaceholder}
            className="h-7 text-xs"
            onKeyDown={handleKeyDown}
            disabled={isAdding}
          />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={gp.remoteUrlPlaceholder}
            className="h-7 text-xs"
            onKeyDown={handleKeyDown}
            disabled={isAdding}
          />
          <Button
            size="sm"
            className="h-7 text-xs w-full"
            disabled={!newName.trim() || !newUrl.trim() || isAdding}
            onClick={handleAdd}
          >
            {isAdding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {gp.addRemote}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isRemotesLoading && remotes.length === 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isRemotesLoading && remotes.length === 0 && (
        <div className="px-3 py-4 text-xs text-muted-foreground text-center">{gp.noRemotes}</div>
      )}

      {/* Remote list */}
      {remotes.length > 0 && (
        <ul className="flex flex-col">
          {remotes.map((remote) => (
            <li
              key={remote.name}
              className="group flex flex-col gap-0.5 border-b border-border px-3 py-1.5 last:border-b-0"
            >
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs font-medium text-foreground truncate">{remote.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {confirmingRemove === remote.name ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => handleRemove(remote.name)}
                      >
                        {gp.removeRemote}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => setConfirmingRemove(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => setConfirmingRemove(remote.name)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{gp.removeRemote}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Confirmation message */}
              {confirmingRemove === remote.name && (
                <span className="text-[10px] text-destructive">{gp.confirmRemoveRemote}</span>
              )}

              {/* Fetch URL */}
              {remote.fetchUrl && (
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground shrink-0">fetch</span>
                  <span
                    className="text-[10px] text-muted-foreground truncate"
                    title={remote.fetchUrl}
                  >
                    {remote.fetchUrl}
                  </span>
                </div>
              )}

              {/* Push URL (only show if different from fetch) */}
              {remote.pushUrl && remote.pushUrl !== remote.fetchUrl && (
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground shrink-0">push</span>
                  <span
                    className="text-[10px] text-muted-foreground truncate"
                    title={remote.pushUrl}
                  >
                    {remote.pushUrl}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
