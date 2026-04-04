import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTO_SAVE_DELAY, TYPING_TIMEOUT } from '@/constants/editor';
import { logger } from '@/lib/logger';
import { repositoryService } from '@/services/repository-service';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';

interface UseFileEditorStateProps {
  filePath: string | null;
  fileContent: string | null;
  onFileSaved?: (filePath: string) => void;
  isAICompleting?: boolean;
  currentAICompletion?: any;
  onContentChange?: (content: string) => void;
}

export function useFileEditorState({
  filePath,
  fileContent,
  onFileSaved,
  isAICompleting = false,
  currentAICompletion,
  onContentChange,
}: UseFileEditorStateProps) {
  // Get store methods to sync content and mark recent saves
  const updateFileContent = useRepositoryStore((state) => state.updateFileContent);
  const markRecentSave = useRepositoryStore((state) => state.markRecentSave);

  const [currentContent, setCurrentContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userActionRef = useRef<boolean>(false);
  const currentFilePathRef = useRef<string | null>(filePath);
  const isSwitchingFilesRef = useRef<boolean>(false);
  // Refs for unmount save - avoid triggering cleanup on every state change
  const currentContentRef = useRef<string>('');
  const hasUnsavedChangesRef = useRef<boolean>(false);
  // Refs for async checks in auto-save (avoid stale closure issues)
  const isUserTypingRef = useRef<boolean>(false);
  const isAICompletingRef = useRef<boolean>(isAICompleting);
  const currentAICompletionRef = useRef<any>(currentAICompletion);

  const saveFileInternal = useCallback(
    async (filePathToSave: string, content: string) => {
      if (!filePathToSave || isSaving) {
        return;
      }

      setIsSaving(true);
      try {
        // Mark this file as recently saved BEFORE writing to avoid race condition
        markRecentSave(filePathToSave);

        await repositoryService.writeFile(filePathToSave, content);

        // Sync content to openFiles store to prevent file watcher from treating it as external change
        updateFileContent(filePathToSave, content);

        if (filePathToSave === filePath) {
          setHasUnsavedChanges(false);
          setLastSavedTime(new Date());
        }

        if (onFileSaved) {
          onFileSaved(filePathToSave);
        }
      } catch (error) {
        logger.error('[FileEditorState] Error saving file:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [filePath, onFileSaved, isSaving, updateFileContent, markRecentSave]
  );

  const scheduleAutoSave = useCallback(
    (filePathToSave: string, content: string) => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Use refs to check current values (avoid stale closure issues)
      const shouldDelayAutoSave = (): boolean => {
        return (
          isUserTypingRef.current ||
          isAICompletingRef.current ||
          userActionRef.current ||
          !!currentAICompletionRef.current
        );
      };

      const attemptAutoSave = () => {
        if (shouldDelayAutoSave()) {
          autoSaveTimeoutRef.current = setTimeout(attemptAutoSave, 1000);
          return;
        }
        saveFileInternal(filePathToSave, content);
      };

      autoSaveTimeoutRef.current = setTimeout(attemptAutoSave, AUTO_SAVE_DELAY);
    },
    [saveFileInternal]
  );

  const markUserTyping = useCallback(() => {
    setIsUserTyping(true);
    isUserTypingRef.current = true;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false);
      isUserTypingRef.current = false;
    }, TYPING_TIMEOUT);
  }, []);

  const handleContentChange = useCallback(
    (value: string | undefined) => {
      const newContent = value || '';
      setCurrentContent(newContent);

      // Only mark as typing if this wasn't our own programmatic change
      if (!userActionRef.current) {
        markUserTyping();
      }

      const hasChanges = newContent !== fileContent;
      setHasUnsavedChanges(hasChanges);

      // Call external content change callback if provided
      if (onContentChange && !userActionRef.current) {
        onContentChange(newContent);
      }

      if (hasChanges && filePath && !userActionRef.current) {
        scheduleAutoSave(filePath, newContent);
      }
    },
    [fileContent, filePath, scheduleAutoSave, markUserTyping, onContentChange]
  );

  const handleContentChangeWithCallback = useCallback(
    (value: string | undefined) => {
      const newContent = value || '';
      setCurrentContent(newContent);

      // Only mark as typing if this wasn't our own programmatic change
      if (!userActionRef.current) {
        markUserTyping();
      }

      const hasChanges = newContent !== fileContent;
      setHasUnsavedChanges(hasChanges);

      // Always call external content change callback if provided
      if (onContentChange) {
        onContentChange(newContent);
      }

      if (hasChanges && filePath && !userActionRef.current) {
        scheduleAutoSave(filePath, newContent);
      }
    },
    [fileContent, filePath, scheduleAutoSave, markUserTyping, onContentChange]
  );

  const setUserAction = useCallback((isUserAction: boolean) => {
    userActionRef.current = isUserAction;
  }, []);

  const cleanup = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  // Reset state when file path changes
  useEffect(() => {
    const previousFilePath = currentFilePathRef.current;

    // If file path is actually changing (not initial render)
    if (previousFilePath && previousFilePath !== filePath) {
      // Mark that we're switching files
      isSwitchingFilesRef.current = true;

      // Save any pending changes for the previous file
      if (hasUnsavedChanges && currentContent) {
        saveFileInternal(previousFilePath, currentContent);
      }
      // Clear any scheduled saves to prevent saving to wrong file
      cleanup();

      // Reset the flag after a short delay
      setTimeout(() => {
        isSwitchingFilesRef.current = false;
      }, 0);
    }

    // Update the ref to the new file path
    currentFilePathRef.current = filePath;
  }, [filePath, hasUnsavedChanges, currentContent, saveFileInternal, cleanup]);

  // Reset state when file content changes (file loaded)
  useEffect(() => {
    if (fileContent !== null) {
      setCurrentContent(fileContent);
      setHasUnsavedChanges(false);
      setLastSavedTime(null);
      userActionRef.current = false;
    } else {
      setCurrentContent('');
      setHasUnsavedChanges(false);
      setLastSavedTime(null);
      userActionRef.current = false;
    }
  }, [fileContent]);

  // Keep refs in sync with state for unmount save
  useEffect(() => {
    currentContentRef.current = currentContent;
  }, [currentContent]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Keep AI-related refs in sync with props (for async auto-save checks)
  useEffect(() => {
    isAICompletingRef.current = isAICompleting;
  }, [isAICompleting]);

  useEffect(() => {
    currentAICompletionRef.current = currentAICompletion;
  }, [currentAICompletion]);

  // Save on component unmount if there are unsaved changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally empty - only run on unmount, uses refs for current values
  useEffect(() => {
    return () => {
      // Don't save if we're just switching files (already handled in file switch effect)
      if (
        !isSwitchingFilesRef.current &&
        hasUnsavedChangesRef.current &&
        currentFilePathRef.current &&
        currentContentRef.current
      ) {
        // Use a synchronous approach for cleanup saves
        repositoryService
          .writeFile(currentFilePathRef.current, currentContentRef.current)
          .catch((err) => logger.error('Auto-save error:', err));
      }
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    currentContent,
    hasUnsavedChanges,
    isSaving,
    lastSavedTime,
    isUserTyping,
    handleContentChange,
    setUserAction,
    handleContentChangeWithCallback,
    saveFileInternal,
    cleanup,
  };
}
