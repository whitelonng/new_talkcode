import type { editor, IPosition } from 'monaco-editor';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AI_COMPLETION_DELAY } from '@/constants/editor';
import { logger } from '@/lib/logger';
import { aiCompletionService } from '@/services/ai/ai-completion-service';
import { settingsManager } from '@/stores/settings-store';
import type { AICompletionState } from '@/types/file-editor';
import { cleanAICompletion } from '@/utils/monaco-utils';

export function useAICompletion(filePath: string | null) {
  const [isAICompleting, setIsAICompleting] = useState(false);
  const [currentAICompletion, setCurrentAICompletion] = useState<AICompletionState | null>(null);

  const completionStateRef = useRef<AICompletionState | null>(null);
  const aiRequestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCurrentAICompletionWithRef = useCallback((completion: AICompletionState | null) => {
    logger.info('Setting completion state:', !!completion);
    completionStateRef.current = completion;
    setCurrentAICompletion(completion);
  }, []);

  const getCurrentCompletionState = useCallback(() => {
    return completionStateRef.current;
  }, []);

  const clearAICompletion = useCallback(() => {
    logger.info('Clearing AI completion');
    setCurrentAICompletionWithRef(null);
  }, [setCurrentAICompletionWithRef]);

  const requestAICompletion = useCallback(
    async (
      model: editor.ITextModel,
      position: IPosition,
      editorRef: React.RefObject<editor.IStandaloneCodeEditor>
    ) => {
      // Clear any existing timeout
      if (aiRequestTimeoutRef.current) {
        clearTimeout(aiRequestTimeoutRef.current);
      }

      // Set a new timeout for debouncing
      aiRequestTimeoutRef.current = setTimeout(async () => {
        // Check if AI completion is enabled
        if (!settingsManager.getAICompletionEnabled()) {
          return;
        }

        // Double-check conditions before making request
        if (isAICompleting) {
          return;
        }

        // Verify editor and cursor position are still valid
        const currentPosition = editorRef.current?.getPosition();
        if (!currentPosition) {
          return;
        }

        // Check if cursor moved too far from the original position
        const lineDifference = Math.abs(currentPosition.lineNumber - position.lineNumber);
        const columnDifference = Math.abs(currentPosition.column - position.column);

        // Cancel if:
        // 1. Moved more than 3 lines away, or
        // 2. Moved significantly within the same line (more than 20 characters)
        if (
          lineDifference > 3 ||
          (currentPosition.lineNumber === position.lineNumber && columnDifference > 20)
        ) {
          logger.info('Cursor moved too far from original position, cancelling AI completion');
          logger.info(`Line diff: ${lineDifference}, Column diff: ${columnDifference}`);
          return;
        }

        logger.info('Requesting AI completion at position:', position);
        setIsAICompleting(true);

        try {
          const fileContent = model.getValue();
          const offset = model.getOffsetAt(position);
          const fileName = filePath || 'untitled';
          const language = model.getLanguageId();

          const completionResult = await aiCompletionService.getCompletion({
            fileContent,
            cursorPosition: offset,
            fileName,
            language,
          });

          // Check if cursor is still in the same place after async operation
          const finalPosition = editorRef.current?.getPosition();
          if (!finalPosition) {
            return;
          }

          const finalLineDifference = Math.abs(finalPosition.lineNumber - position.lineNumber);
          const finalColumnDifference = Math.abs(finalPosition.column - position.column);

          if (
            finalLineDifference > 3 ||
            (finalPosition.lineNumber === position.lineNumber && finalColumnDifference > 20)
          ) {
            logger.info('Cursor moved during AI completion, discarding result');
            return;
          }

          if (completionResult?.completion?.trim()) {
            const cleanCompletion = cleanAICompletion(completionResult.completion);

            logger.info('Setting AI completion state');
            setCurrentAICompletionWithRef({
              completion: cleanCompletion,
              position: { ...finalPosition },
              triggerTime: Date.now(),
            });

            // Gently trigger inline suggestions
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.trigger(
                  'ai-completion',
                  'editor.action.inlineSuggest.trigger',
                  {}
                );
              }
            }, 200);
          } else {
            logger.info('No AI completion available');
          }
        } catch (error) {
          logger.error('AI completion failed:', error);
        } finally {
          setIsAICompleting(false);
        }
      }, AI_COMPLETION_DELAY);
    },
    [filePath, isAICompleting, setCurrentAICompletionWithRef]
  );

  const acceptAICompletion = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: any): boolean => {
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!(model && position)) return false;

      const currentCompletion = getCurrentCompletionState();

      if (
        currentCompletion &&
        Math.abs(currentCompletion.position.lineNumber - position.lineNumber) <= 2
      ) {
        // Allow accepting completion even if cursor moved slightly
        const columnDifference = Math.abs(currentCompletion.position.column - position.column);
        if (
          currentCompletion.position.lineNumber === position.lineNumber &&
          columnDifference > 10
        ) {
          return false;
        }

        logger.info('Accepting AI completion');

        // Accept the completion
        const edit = {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: currentCompletion.completion,
        };

        editor.executeEdits('ai-completion-accept', [edit]);

        // Calculate new cursor position
        const lines = currentCompletion.completion.split('\n');
        const lastLine = lines[lines.length - 1];
        const newPosition =
          lines.length === 1
            ? new monaco.Position(
                position.lineNumber,
                position.column + currentCompletion.completion.length
              )
            : new monaco.Position(
                position.lineNumber + lines.length - 1,
                (lastLine?.length ?? 0) + 1
              );

        editor.setPosition(newPosition);
        setCurrentAICompletionWithRef(null);
        toast.success('AI completion accepted');
        return true;
      }

      return false;
    },
    [getCurrentCompletionState, setCurrentAICompletionWithRef]
  );

  const dismissAICompletion = useCallback(() => {
    const currentCompletion = getCurrentCompletionState();
    if (currentCompletion) {
      logger.info('Dismissing AI completion');
      setCurrentAICompletionWithRef(null);
      toast.info('AI completion dismissed');
      return true;
    }
    return false;
  }, [getCurrentCompletionState, setCurrentAICompletionWithRef]);

  const shouldClearCompletion = useCallback(
    (newPosition: IPosition, currentCompletion: AICompletionState | null): boolean => {
      if (!currentCompletion) return false;

      const lineDifference = Math.abs(
        newPosition.lineNumber - currentCompletion.position.lineNumber
      );
      const columnDifference = Math.abs(newPosition.column - currentCompletion.position.column);

      // Clear completion if moved more than 2 lines or significantly within same line
      return (
        lineDifference > 2 ||
        (newPosition.lineNumber === currentCompletion.position.lineNumber && columnDifference > 15)
      );
    },
    []
  );

  // Cleanup
  const cleanup = useCallback(() => {
    if (aiRequestTimeoutRef.current) {
      clearTimeout(aiRequestTimeoutRef.current);
    }
  }, []);

  return {
    isAICompleting,
    currentAICompletion,
    getCurrentCompletionState,
    clearAICompletion,
    requestAICompletion,
    acceptAICompletion,
    dismissAICompletion,
    shouldClearCompletion,
    cleanup,
  };
}
