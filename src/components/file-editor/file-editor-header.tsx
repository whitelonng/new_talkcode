import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-locale';
import { projectIndexer } from '@/services/project-indexer';
import { repositoryService } from '@/services/repository-service';
import { getRelativePath } from '@/services/repository-utils';
import { useLintStore } from '@/stores/lint-store';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';
import type { AICompletionState } from '@/types/file-editor';
import { formatLastSavedTime } from '@/utils/monaco-utils';

interface FileEditorHeaderProps {
  filePath: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isAICompleting: boolean;
  currentAICompletion: AICompletionState | null;
  lastSavedTime: Date | null;
}

export function FileEditorHeader({
  filePath,
  hasUnsavedChanges,
  isSaving,
  isAICompleting,
  currentAICompletion,
  lastSavedTime,
}: FileEditorHeaderProps) {
  const t = useTranslation();
  const fileName = repositoryService.getFileNameFromPath(filePath);
  const language = repositoryService.getLanguageFromExtension(fileName);
  // Subscribe to indexed state from store for automatic re-renders
  const isIndexed = useRepositoryStore((state) => state.indexedFiles.has(filePath));
  const rootPath = useRepositoryStore((state) => state.rootPath);
  const isIndexable = projectIndexer.isSupported(language);

  // Lint diagnostics state - optimized to prevent infinite re-renders
  const { settings, toggleProblemsPanel, errorCount, warningCount, infoCount } = useLintStore();
  const fileDiagnostics = useLintStore((state) => state.getFileDiagnostics(filePath));

  // Display relative path if rootPath is available, otherwise show file name
  const displayPath = rootPath ? getRelativePath(filePath, rootPath) : fileName;

  // Memoized total diagnostics calculation
  const totalDiagnostics = useMemo(() => {
    return (
      (settings.showErrors ? errorCount : 0) +
      (settings.showWarnings ? warningCount : 0) +
      (settings.showInfo ? infoCount : 0)
    );
  }, [
    settings.showErrors,
    settings.showWarnings,
    settings.showInfo,
    errorCount,
    warningCount,
    infoCount,
  ]);

  return (
    <div className="flex h-[42px] flex-shrink-0 items-center border-b bg-gray-50 px-3 dark:bg-gray-900">
      <div className="flex min-w-0 flex-1 items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex items-center gap-2 truncate font-medium text-sm" title={filePath}>
            {displayPath}
          </div>
          {hasUnsavedChanges && (
            <span className="flex flex-shrink-0 items-center gap-1">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-orange-500"
                title={t.Lint.autoSaving}
              />
              {isSaving && <span className="text-gray-500 text-xs">{t.Lint.saving}</span>}
            </span>
          )}
          {isAICompleting && (
            <span className="flex flex-shrink-0 items-center gap-1">
              <span className="text-blue-500 text-xs">{t.Lint.aiAnalyzing}</span>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </span>
          )}
          {currentAICompletion && (
            <span className="flex-shrink-0 rounded bg-green-100 px-2 py-0.5 text-green-600 text-xs dark:bg-green-900 dark:text-green-400">
              {t.Lint.aiSuggestion}
            </span>
          )}
          {lastSavedTime && !hasUnsavedChanges && (
            <span className="flex-shrink-0 text-green-600 text-xs dark:text-green-400">
              {t.Lint.savedAt(formatLastSavedTime(lastSavedTime))}
            </span>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">
            {language}
          </span>
          {isIndexable && (
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                isIndexed
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}
              title={isIndexed ? t.Lint.codeNavigationEnabled : t.Lint.notIndexedYet}
            >
              {isIndexed ? t.Lint.indexed : t.Lint.notIndexed}
            </span>
          )}
          {/* Lint diagnostics */}
          {settings.enabled && errorCount !== undefined && (
            <div className="flex items-center gap-1">
              {errorCount > 0 && settings.showErrors && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleProblemsPanel}
                  className="gap-1 px-2 py-0.5 text-xs hover:bg-red-100 dark:hover:bg-red-900/20"
                  title={t.Lint.showErrors}
                >
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
                    {errorCount}
                  </Badge>
                </Button>
              )}
              {warningCount > 0 && settings.showWarnings && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleProblemsPanel}
                  className="gap-1 px-2 py-0.5 text-xs hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                  title={t.Lint.showWarnings}
                >
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
                    {warningCount}
                  </Badge>
                </Button>
              )}
              {infoCount > 0 && settings.showInfo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleProblemsPanel}
                  className="gap-1 px-2 py-0.5 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/20"
                  title={t.Lint.showInfo}
                >
                  <Info className="h-3 w-3 text-blue-500" />
                  <Badge variant="outline" className="px-1.5 py-0.5 text-xs">
                    {infoCount}
                  </Badge>
                </Button>
              )}
              {totalDiagnostics === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleProblemsPanel}
                  className="gap-1 px-2 py-0.5 text-xs hover:bg-green-100 dark:hover:bg-green-900/20"
                  title={t.Lint.noIssues}
                >
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400">
                    {totalDiagnostics}
                  </span>
                </Button>
              )}
            </div>
          )}
          {fileDiagnostics?.isLoading && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>{t.Lint.checking}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
