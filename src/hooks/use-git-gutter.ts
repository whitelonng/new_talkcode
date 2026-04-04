import type * as Monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useGitStore } from '@/stores/git-store';
import { DiffLineType } from '@/types/git';

// Extend Window interface for Monaco
declare global {
  interface Window {
    monaco: typeof Monaco;
  }
}

/**
 * Hook to add Git gutter indicators to Monaco editor
 * Shows green bars for additions, blue bars for modifications, and red triangles for deletions
 */
export function useGitGutter(
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  filePath: string | null,
  repositoryPath: string | null
) {
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!editor || !filePath || !repositoryPath) {
      // Clear decorations if no editor or file
      if (editor && decorationsRef.current.length > 0) {
        editor.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
      return;
    }

    // Check if editor model is ready
    const model = editor.getModel();
    if (!model) {
      logger.debug('Editor model not ready yet, skipping Git gutter update');
      return;
    }

    const updateGutterIndicators = async () => {
      try {
        // Get line changes from Git (with caching)
        const lineChanges = await useGitStore.getState().getLineChanges(filePath);

        if (!window.monaco) {
          logger.error('Monaco is not available on window');
          return;
        }

        // Convert line changes to Monaco decorations
        const decorations: Monaco.editor.IModelDeltaDecoration[] = lineChanges.map(
          ([lineNumber, changeType]) => {
            const decorationOptions = getDecorationOptions(changeType);

            return {
              range: new window.monaco.Range(lineNumber, 1, lineNumber, 1),
              options: decorationOptions,
            };
          }
        );

        // Apply decorations
        const newDecorations = editor.deltaDecorations(decorationsRef.current, decorations);
        decorationsRef.current = newDecorations;

        logger.debug(`Applied ${decorations.length} Git gutter decorations to ${filePath}`);
      } catch (error) {
        logger.error('Failed to update Git gutter indicators:', error);
        // Clear decorations on error
        if (decorationsRef.current.length > 0) {
          editor.deltaDecorations(decorationsRef.current, []);
          decorationsRef.current = [];
        }
      }
    };

    updateGutterIndicators();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (editor && decorationsRef.current.length > 0) {
        editor.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
    };
  }, [editor, filePath, repositoryPath]);

  return {
    refreshGutterIndicators: async () => {
      if (!editor || !filePath || !repositoryPath) {
        return;
      }

      // Check if editor model is ready
      const model = editor.getModel();
      if (!model) {
        logger.debug('Editor model not ready yet, skipping Git gutter refresh');
        return;
      }

      try {
        const lineChanges = await useGitStore.getState().getLineChanges(filePath);
        const decorations: Monaco.editor.IModelDeltaDecoration[] = lineChanges.map(
          ([lineNumber, changeType]) => {
            const decorationOptions = getDecorationOptions(changeType);

            return {
              range: new window.monaco.Range(lineNumber, 1, lineNumber, 1),
              options: decorationOptions,
            };
          }
        );

        const newDecorations = editor.deltaDecorations(decorationsRef.current, decorations);
        decorationsRef.current = newDecorations;
      } catch (error) {
        logger.error('Failed to refresh Git gutter indicators:', error);
      }
    },
  };
}

/**
 * Get Monaco decoration options based on Git change type
 */
function getDecorationOptions(changeType: DiffLineType): Monaco.editor.IModelDecorationOptions {
  switch (changeType) {
    case DiffLineType.Addition:
      return {
        isWholeLine: true,
        linesDecorationsClassName: 'git-line-added',
        overviewRuler: {
          color: 'rgba(34, 197, 94, 0.7)', // green
          position: 7, // Right
        },
        minimap: {
          color: 'rgba(34, 197, 94, 0.7)',
          position: 2, // Inline
        },
      };

    case DiffLineType.Deletion:
      return {
        isWholeLine: true,
        linesDecorationsClassName: 'git-line-deleted',
        overviewRuler: {
          color: 'rgba(239, 68, 68, 0.7)', // red
          position: 7,
        },
        minimap: {
          color: 'rgba(239, 68, 68, 0.7)',
          position: 2,
        },
      };
    default:
      return {
        isWholeLine: true,
        linesDecorationsClassName: 'git-line-modified',
        overviewRuler: {
          color: 'rgba(59, 130, 246, 0.7)', // blue
          position: 7,
        },
        minimap: {
          color: 'rgba(59, 130, 246, 0.7)',
          position: 2,
        },
      };
  }
}
