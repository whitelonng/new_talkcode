import { AlertCircle, AlertTriangle, Filter, Info, X } from 'lucide-react';
import type { editor as monacoEditor } from 'monaco-editor';
import { useMemo, useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import type { LintDiagnostic } from '@/services/lint-service';
import { useLintStore } from '@/stores/lint-store';
import { createFixApplier } from '@/utils/fix-applier';
import { DiagnosticItem } from './diagnostic-item';
import { QuickFixMenu } from './quick-fix-menu';

interface DiagnosticsPanelProps {
  className?: string;
  onDiagnosticClick?: (diagnostic: LintDiagnostic & { filePath: string }) => void;
}

export function DiagnosticsPanel({ className, onDiagnosticClick }: DiagnosticsPanelProps) {
  const t = useTranslation();
  const {
    fileDiagnostics,
    settings,
    updateSettings,
    isProblemsPanelOpen,
    setProblemsPanelOpen,
    selectedDiagnostic,
    setSelectedDiagnostic,
    errorCount,
    warningCount,
    infoCount,
  } = useLintStore();

  // Quick fix state
  const [quickFixTarget, setQuickFixTarget] = useState<
    (LintDiagnostic & { filePath: string }) | null
  >(null);
  const [_isFixing, setIsFixing] = useState(false);

  // Flatten all diagnostics and sort by severity and position
  const allDiagnostics = useMemo(() => {
    const diagnostics: Array<LintDiagnostic & { filePath: string }> = [];

    for (const [filePath, fileDiag] of fileDiagnostics.entries()) {
      for (const diagnostic of fileDiag.diagnostics) {
        diagnostics.push({
          ...diagnostic,
          filePath,
        });
      }
    }

    // Sort by severity (errors first, then warnings, then info) and by position
    const severityOrder = { error: 0, warning: 1, info: 2 };

    return diagnostics.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      const lineDiff = a.range.start.line - b.range.start.line;
      if (lineDiff !== 0) return lineDiff;

      return a.range.start.column - b.range.start.column;
    });
  }, [fileDiagnostics]);

  const handleClose = () => {
    setProblemsPanelOpen(false);
  };

  const handleFilterChange = (filter: keyof typeof settings, value: boolean) => {
    updateSettings({ [filter]: value });
  };

  const handleDiagnosticClick = (diagnostic: LintDiagnostic & { filePath: string }) => {
    setSelectedDiagnostic(`${diagnostic.filePath}:${diagnostic.id}`);
    onDiagnosticClick?.(diagnostic);
  };

  const handleQuickFixClick = (
    diagnostic: LintDiagnostic & { filePath: string },
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setQuickFixTarget(diagnostic);
  };

  const handleQuickFixApply = async (fixId: string) => {
    if (!quickFixTarget) return;

    setIsFixing(true);
    try {
      // Get the Monaco editor instance from window
      const monacoInstance = (window as { monaco?: typeof import('monaco-editor') }).monaco;
      if (!monacoInstance) {
        throw new Error('Monaco editor not available');
      }

      // Find the editor for this file
      const model = monacoInstance.editor
        .getModels()
        .find((m: monacoEditor.ITextModel) => m.uri.path === quickFixTarget.filePath);
      if (!model) {
        throw new Error('Editor model not found');
      }

      const editor = monacoInstance.editor
        .getEditors()
        .find((e: monacoEditor.ICodeEditor) => e.getModel() === model);
      if (!editor) {
        throw new Error('Editor instance not found');
      }

      // Create and apply the fix
      const fixApplier = createFixApplier({ editor, filePath: quickFixTarget.filePath });
      await fixApplier.applyFix(quickFixTarget, fixId, t);

      toast.success(t.Lint.fixApplied);
    } catch (error) {
      console.error('Failed to apply fix:', error);
      toast.error(t.Lint.fixFailed(error instanceof Error ? error.message : t.Lint.unknownError));
    } finally {
      setIsFixing(false);
      setQuickFixTarget(null);
    }
  };

  if (!isProblemsPanelOpen) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setProblemsPanelOpen(true)}
          className="gap-2"
        >
          <AlertCircle className="h-4 w-4" />
          {errorCount > 0 && (
            <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
              {errorCount}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
              {warningCount}
            </Badge>
          )}
          {infoCount > 0 && (
            <Badge variant="outline" className="px-1.5 py-0.5 text-xs">
              {infoCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Panel defaultSize={25} minSize={20} maxSize={50} className={className}>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <h3 className="font-medium">{t.Lint.problems}</h3>
            <div className="flex items-center gap-1">
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorCount}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {warningCount}
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Info className="h-3 w-3" />
                  {infoCount}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleFilterChange('showErrors', !settings.showErrors)}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {t.Lint.showErrors} ({errorCount})
                  <div className="ml-auto">
                    <input
                      type="checkbox"
                      checked={settings.showErrors}
                      onChange={() => {}}
                      className="h-3 w-3"
                    />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFilterChange('showWarnings', !settings.showWarnings)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {t.Lint.showWarnings} ({warningCount})
                  <div className="ml-auto">
                    <input
                      type="checkbox"
                      checked={settings.showWarnings}
                      onChange={() => {}}
                      className="h-3 w-3"
                    />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFilterChange('showInfo', !settings.showInfo)}
                >
                  <Info className="mr-2 h-4 w-4" />
                  {t.Lint.showInfo} ({infoCount})
                  <div className="ml-auto">
                    <input
                      type="checkbox"
                      checked={settings.showInfo}
                      onChange={() => {}}
                      className="h-3 w-3"
                    />
                  </div>
                </DropdownMenuItem>
                {/* TODO: Implement refresh and auto-fix functionality before enabling these buttons */}
                {/* <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t.Common.refresh}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBiomeAutoFix} disabled={isFixing}>
                  <Wrench className="mr-2 h-4 w-4" />
                  {t.Lint.autoFixAll}
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {allDiagnostics.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-2">
                <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {settings.enabled ? t.Lint.noProblems : t.Lint.lintDisabled}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {allDiagnostics.map((diagnostic) => (
                <div key={`${diagnostic.filePath}:${diagnostic.id}`} className="relative">
                  <DiagnosticItem
                    diagnostic={diagnostic}
                    isSelected={selectedDiagnostic === `${diagnostic.filePath}:${diagnostic.id}`}
                    onClick={() => handleDiagnosticClick(diagnostic)}
                    onFixClick={(e) => handleQuickFixClick(diagnostic, e)}
                    showFixButton={settings.autoFixEnabled}
                  />
                  <QuickFixMenu
                    diagnostic={diagnostic}
                    isOpen={
                      quickFixTarget?.id === diagnostic.id &&
                      quickFixTarget?.filePath === diagnostic.filePath
                    }
                    onClose={() => setQuickFixTarget(null)}
                    onFixApply={handleQuickFixApply}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
