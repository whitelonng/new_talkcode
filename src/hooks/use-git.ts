import { useState } from 'react';
import { toast } from 'sonner';
import { aiGitMessagesService } from '@/services/ai/ai-git-messages-service';
import { gitService } from '@/services/git-service';
import { useGitStore } from '@/stores/git-store';
import { type GitResult, gitAddAndCommit } from '@/utils/git-utils';

export function useGit() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [lastResult, setLastResult] = useState<GitResult | null>(null);

  /**
   * Commit with AI-generated message - full flow:
   * 1. Check for changes first (fast)
   * 2. Get raw diff text from git
   * 3. Generate AI commit message with diff text and user message
   * 4. Execute git commit
   */
  const commitWithAIMessage = async (userMessage?: string, basePath = '.') => {
    setIsLoading(true);

    try {
      // Check if we're in a git repository and have changes using git store
      const { isGitRepository, gitStatus } = useGitStore.getState();
      if (!isGitRepository) {
        toast.error('Not a git repository');
        return { success: false, message: 'Not a git repository' };
      }

      if (!gitStatus || gitStatus.changesCount === 0) {
        toast.info('No changes to commit');
        return { success: true, message: 'No changes to commit' };
      }

      // Get raw diff text from git (simpler format for AI)
      const diffText = await gitService.getRawDiffText(basePath);

      if (!diffText || diffText.trim().length === 0) {
        toast.info('No file changes detected');
        return { success: true, message: 'No file changes detected' };
      }

      // Generate AI commit message with raw diff text and user message
      setIsGeneratingMessage(true);
      const commitResult = await aiGitMessagesService.generateCommitMessage({
        userInput: userMessage,
        diffText,
      });
      setIsGeneratingMessage(false);

      if (!commitResult?.message) {
        toast.error('Failed to generate commit message');
        return { success: false, message: 'Failed to generate commit message' };
      }

      // Execute git commit
      const result = await gitAddAndCommit(commitResult.message, basePath);
      setLastResult(result);

      if (result.success) {
        toast.success('Changes committed successfully');
      } else {
        toast.error(`Failed to commit: ${result.error || result.message}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error: ${errorMessage}`);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
      setIsGeneratingMessage(false);
    }
  };

  return {
    commitWithAIMessage,
    isLoading,
    isGeneratingMessage,
    lastResult,
  };
}
