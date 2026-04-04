import type { editor } from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { lintService } from '@/services/lint-service';
import { useLintStore } from '@/stores/lint-store';

interface UseLintDiagnosticsProps {
  editor: editor.IStandaloneCodeEditor | null;
  filePath: string | null;
  rootPath: string | null;
  enabled?: boolean;
}

/**
 * Hook for running lint diagnostics on files
 *
 * This hook lints saved files directly (no temp files).
 * Lint is triggered:
 * 1. When the editor first becomes ready (to show existing issues)
 * 2. When triggerLint() is called (should be called after file save)
 */
export function useLintDiagnostics({
  editor,
  filePath,
  rootPath,
  enabled = true,
}: UseLintDiagnosticsProps) {
  const isInitialized = useRef(false);
  const { settings, setFileDiagnostics, setFileDiagnosticsLoading, setFileDiagnosticsError } =
    useLintStore();

  // Use ref to access latest settings without adding to dependencies
  // This prevents re-running lint when only filter settings change
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const runLint = useCallback(async () => {
    const currentSettings = settingsRef.current;
    if (!filePath || !rootPath || !editor || !enabled || !currentSettings.enabled) {
      return;
    }

    try {
      setFileDiagnosticsLoading(filePath, true);
      setFileDiagnosticsError(filePath, undefined);

      logger.debug('[Lint] Running lint diagnostics for:', filePath, 'in', rootPath);

      // Run biome lint on the saved file
      const result = await lintService.runBiomeLint(filePath, rootPath);

      // Filter diagnostics based on settings
      const filteredDiagnostics = result.diagnostics.filter((diagnostic) => {
        switch (diagnostic.severity) {
          case 'error':
            return currentSettings.showErrors;
          case 'warning':
            return currentSettings.showWarnings;
          case 'info':
            return currentSettings.showInfo;
          default:
            return true;
        }
      });

      // Update store (this already updates counts incrementally)
      setFileDiagnostics(filePath, filteredDiagnostics);

      // Apply to editor if enabled
      if (currentSettings.showInEditor && editor) {
        lintService.applyDiagnosticsToEditor(editor, filteredDiagnostics);
      }

      logger.debug('[Lint] Lint completed for:', filePath, {
        total: filteredDiagnostics.length,
        errors: filteredDiagnostics.filter((d) => d.severity === 'error').length,
        warnings: filteredDiagnostics.filter((d) => d.severity === 'warning').length,
      });
    } catch (error) {
      logger.error('[Lint] Lint failed for:', filePath, error);
      setFileDiagnosticsError(filePath, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setFileDiagnosticsLoading(filePath, false);
    }
  }, [
    filePath,
    rootPath,
    editor,
    enabled,
    setFileDiagnostics,
    setFileDiagnosticsLoading,
    setFileDiagnosticsError,
  ]);

  // Run lint when editor becomes ready or when lint is enabled
  // Also re-run when settings.enabled changes from false to true
  useEffect(() => {
    if (editor && filePath && enabled && settings.enabled) {
      // Small delay to ensure the file is loaded
      const timer = setTimeout(() => {
        runLint();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editor, filePath, enabled, settings.enabled, runLint]);

  // Initialize lint service on mount
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      lintService.init().catch((error) => {
        logger.error('[Lint] Failed to initialize lint service:', error);
      });
    }
  }, []);

  // Clear diagnostics when file changes or editor is disabled
  useEffect(() => {
    if (!filePath || !enabled || !settings.enabled) {
      if (editor && filePath) {
        lintService.clearDiagnostics(editor);
      }
    }
  }, [filePath, enabled, settings.enabled, editor]);

  // Manual trigger function - call this after file is saved
  const triggerLint = useCallback(() => {
    // Clear cache for this file to ensure fresh lint
    if (filePath) {
      lintService.clearCacheForFile(filePath);
    }
    runLint();
  }, [filePath, runLint]);

  // Clear all diagnostics
  const clearDiagnostics = useCallback(() => {
    if (filePath && editor) {
      lintService.clearDiagnostics(editor);
    }
  }, [filePath, editor]);

  return {
    triggerLint,
    clearDiagnostics,
    isEnabled: enabled && settings.enabled,
    settings,
  };
}
