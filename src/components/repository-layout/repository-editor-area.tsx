import { Maximize2, Minimize2 } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import { BrowserPanel } from '@/components/browser/browser-panel';
import { DiagnosticsPanel } from '@/components/diagnostics/diagnostics-panel';
import { FileEditor } from '@/components/file-editor';
import { FileTabs } from '@/components/file-tabs';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import type { LintDiagnostic } from '@/services/lint-service';
import type { BrowserSource, UtilityTab } from '@/stores/browser-store';
import type { OpenFile } from '@/types/file-system';

interface RepositoryEditorAreaProps {
  editorAreaPanelId: string;
  fileEditorPanelId: string;
  terminalPanelId: string;
  showChatPanel: boolean;
  showEditor: boolean;
  showUtilityPanel: boolean;
  showTerminal: boolean;
  showBrowser: boolean;
  showProblemsPanel: boolean;
  hasOpenFiles: boolean;
  isEditorFullscreen: boolean;
  isTerminalFullscreen: boolean;
  activeUtilityTab: UtilityTab;
  browserSourceType: BrowserSource;
  currentBrowserUrl: string;
  currentBrowserFilePath: string | null;
  currentBrowserContent: string | null;
  openFiles: OpenFile[];
  activeFileIndex: number;
  currentFile: OpenFile | null | undefined;
  rootPath: string | null;
  onTabClose: (index: number) => void;
  onCloseOthers: (keepIndex: number) => void;
  onCloseAll: () => void;
  onCopyPath: (filePath: string) => void;
  onCopyRelativePath: (filePath: string, rootPath: string) => void;
  onAddFileToChat: (filePath: string, fileContent: string) => Promise<void>;
  onOpenFileInBrowser: (filePath: string) => Promise<void>;
  onTabSelect: (index: number) => void;
  onContentChange: (content: string) => void;
  onToggleContentSearch: () => void;
  onToggleEditorFullscreen: () => void;
  onDiagnosticClick: (diagnostic: LintDiagnostic & { filePath: string }) => void;
  onCopyTerminalToChat: (content: string) => void;
  onCloseTerminal: () => void;
  onToggleTerminalFullscreen: () => void;
  onCloseBrowser: () => void;
  onOpenBrowserUrl: (url: string) => void;
  onUtilityTabChange: (tab: UtilityTab) => void;
}

export const RepositoryEditorArea = memo(function RepositoryEditorArea({
  editorAreaPanelId,
  fileEditorPanelId,
  terminalPanelId,
  showChatPanel,
  showEditor,
  showUtilityPanel,
  showTerminal,
  showBrowser,
  showProblemsPanel,
  hasOpenFiles,
  isEditorFullscreen,
  isTerminalFullscreen,
  activeUtilityTab,
  browserSourceType,
  currentBrowserUrl,
  currentBrowserFilePath,
  currentBrowserContent,
  openFiles,
  activeFileIndex,
  currentFile,
  rootPath,
  onTabClose,
  onCloseOthers,
  onCloseAll,
  onCopyPath,
  onCopyRelativePath,
  onAddFileToChat,
  onOpenFileInBrowser,
  onTabSelect,
  onContentChange,
  onToggleContentSearch,
  onToggleEditorFullscreen,
  onDiagnosticClick,
  onCopyTerminalToChat,
  onCloseTerminal,
  onToggleTerminalFullscreen,
  onCloseBrowser,
  onOpenBrowserUrl,
  onUtilityTabChange,
}: RepositoryEditorAreaProps) {
  const t = useTranslation();
  const { isAppleTheme } = useTheme();

  return (
    <>
      <ResizablePanel
        id={editorAreaPanelId}
        order={2}
        className={
          showChatPanel
            ? isAppleTheme
              ? 'bg-transparent px-2 py-2'
              : 'border-r'
            : isAppleTheme
              ? 'bg-transparent px-2 py-2 pr-3'
              : ''
        }
        defaultSize={isEditorFullscreen || isTerminalFullscreen ? '100%' : '40%'}
        minSize={'20%'}
        maxSize={'100%'}
      >
        <div className={cn('flex h-full min-h-0 overflow-hidden', isAppleTheme && 'apple-panel')}>
          <ResizablePanelGroup direction="vertical">
            {hasOpenFiles && showEditor && (
              <>
                <ResizablePanel
                  id={fileEditorPanelId}
                  order={1}
                  defaultSize={isEditorFullscreen ? '100%' : showUtilityPanel ? '60%' : '100%'}
                  minSize={'20%'}
                >
                  <div className="flex h-full flex-col">
                    <div
                      className={cn(
                        'flex items-center border-b',
                        isAppleTheme && 'border-white/10 bg-black/10 px-1 backdrop-blur-xl dark:bg-white/5'
                      )}
                    >
                      <div className="flex-1 overflow-hidden">
                        <FileTabs
                          activeFileIndex={activeFileIndex}
                          onTabClose={onTabClose}
                          onCloseOthers={onCloseOthers}
                          onCloseAll={onCloseAll}
                          onCopyPath={onCopyPath}
                          onCopyRelativePath={onCopyRelativePath}
                          onAddFileToChat={onAddFileToChat}
                          onOpenInBrowser={onOpenFileInBrowser}
                          onTabSelect={onTabSelect}
                          openFiles={openFiles}
                          rootPath={rootPath ?? undefined}
                        />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn('mr-1 h-7 w-7', isAppleTheme && 'h-8 w-8 rounded-full')}
                            onClick={onToggleEditorFullscreen}
                          >
                            {isEditorFullscreen ? (
                              <Minimize2 className="h-3.5 w-3.5" />
                            ) : (
                              <Maximize2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {isEditorFullscreen
                            ? t.RepositoryLayout.exitFullscreen
                            : t.RepositoryLayout.fullscreen}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <FileEditor
                        error={currentFile?.error || null}
                        fileContent={currentFile?.content || null}
                        filePath={currentFile?.path || null}
                        hasUnsavedChanges={currentFile?.hasUnsavedChanges}
                        isLoading={currentFile?.isLoading ?? false}
                        lineNumber={currentFile?.lineNumber}
                        onContentChange={onContentChange}
                        onGlobalSearch={onToggleContentSearch}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                {showUtilityPanel && <ResizableHandle withHandle className={cn(isAppleTheme && 'bg-transparent')} />}

                {showProblemsPanel && (
                  <>
                    <ResizableHandle withHandle className={cn(isAppleTheme && 'bg-transparent')} />
                    <DiagnosticsPanel onDiagnosticClick={onDiagnosticClick} />
                  </>
                )}
              </>
            )}

            {showUtilityPanel && (
              <ResizablePanel
                id={terminalPanelId}
                order={2}
                defaultSize={
                  isTerminalFullscreen ? '100%' : hasOpenFiles && showEditor ? '40%' : '100%'
                }
                minSize={'15%'}
                maxSize={'100%'}
              >
                <div className={cn('flex h-full flex-col bg-background', isAppleTheme && 'bg-transparent')}>
                  <div className={cn('border-b px-2 py-1', isAppleTheme && 'border-white/10 backdrop-blur-xl')}>
                    <Tabs
                      value={activeUtilityTab}
                      onValueChange={(value) => onUtilityTabChange(value as UtilityTab)}
                    >
                      <TabsList
                        className={cn(
                          'grid grid-cols-2 p-0.5',
                          isAppleTheme
                            ? 'h-8 w-[190px] rounded-full bg-white/5 dark:bg-white/5'
                            : 'h-7 w-[180px] bg-muted/50'
                        )}
                      >
                        <TabsTrigger
                          value="terminal"
                          className={cn(
                            'h-6 px-2.5 text-[11px] data-[state=active]:shadow-none',
                            isAppleTheme && 'rounded-full data-[state=active]:bg-white/10'
                          )}
                        >
                          {t.RepositoryLayout.terminalTab}
                        </TabsTrigger>
                        <TabsTrigger
                          value="browser"
                          className="h-6 rounded-full px-2.5 text-[11px] data-[state=active]:bg-white/10 data-[state=active]:shadow-none"
                        >
                          {t.RepositoryLayout.browserTab}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {showTerminal && <TerminalPanel onCopyToChat={onCopyTerminalToChat} />}

                    {showBrowser && (
                      <BrowserPanel
                        sourceType={browserSourceType}
                        currentUrl={currentBrowserUrl}
                        currentFilePath={currentBrowserFilePath}
                        currentContent={currentBrowserContent}
                        onOpenUrl={onOpenBrowserUrl}
                        onClose={onCloseBrowser}
                      />
                    )}
                  </div>
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        </div>
      </ResizablePanel>

      {showChatPanel && <ResizableHandle withHandle className={cn(isAppleTheme && 'bg-transparent')} />}
    </>
  );
});
