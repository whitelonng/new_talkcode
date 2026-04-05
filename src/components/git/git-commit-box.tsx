import { useCallback, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { aiGitMessagesService } from '@/services/ai/ai-git-messages-service';
import { gitService } from '@/services/git-service';
import { useGitStore } from '@/stores/git-store';

export function GitCommitBox() {
  const t = useTranslation();

  const repositoryPath = useGitStore((state) => state.repositoryPath);
  const gitStatus = useGitStore((state) => state.gitStatus);
  const refreshStatus = useGitStore((state) => state.refreshStatus);

  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const hasStagedChanges = (gitStatus?.staged.length ?? 0) > 0;
  const isCommitDisabled = isCommitting || !commitMessage.trim() || !hasStagedChanges;

  const handleCommit = useCallback(async () => {
    if (!repositoryPath || !commitMessage.trim() || !hasStagedChanges) return;

    setIsCommitting(true);
    try {
      await gitService.commitStaged(repositoryPath, commitMessage.trim());
      toast.success(t.GitPanel.commitSuccess);
      setCommitMessage('');
      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.GitPanel.commitFailed;
      toast.error(message);
    } finally {
      setIsCommitting(false);
    }
  }, [repositoryPath, commitMessage, hasStagedChanges, refreshStatus, t]);

  const handleGenerateMessage = useCallback(async () => {
    if (!repositoryPath) return;

    setIsGenerating(true);
    try {
      const diffText = await gitService.getRawDiffText(repositoryPath);

      if (!diffText || diffText.trim().length === 0) {
        toast.info(t.GitPanel.noChanges);
        return;
      }

      const result = await aiGitMessagesService.generateCommitMessage({ diffText });

      if (result?.message) {
        setCommitMessage(result.message);
      } else {
        toast.error(t.GitPanel.commitFailed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t.GitPanel.commitFailed;
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [repositoryPath, t]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <Textarea
        placeholder={t.GitPanel.commitMessagePlaceholder}
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        disabled={isCommitting}
        className="min-h-[72px] resize-none text-sm"
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={isCommitDisabled}
          onClick={handleCommit}
        >
          {isCommitting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {t.GitPanel.committing}
            </>
          ) : (
            t.GitPanel.commit
          )}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={isGenerating}
              onClick={handleGenerateMessage}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isGenerating ? t.GitPanel.generatingMessage : t.GitPanel.generateCommitMessage}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
