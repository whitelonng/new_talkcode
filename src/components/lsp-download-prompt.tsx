// src/components/lsp-download-prompt.tsx
// Component to prompt users to download LSP servers

import { AlertCircle, Check, Download, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { logger } from '@/lib/logger';
import { lspService } from '@/services/lsp';
import { type DownloadProgress, useLspStore } from '@/stores/lsp-store';

export function LspDownloadPrompt() {
  const {
    pendingDownloads,
    removePendingDownload,
    downloadProgress,
    setDownloadProgress,
    isDownloading,
    setIsDownloading,
  } = useLspStore();

  const [currentDownload, setCurrentDownload] = useState<string | null>(null);

  // Listen for download progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await lspService.onDownloadProgress((progress: DownloadProgress) => {
        setDownloadProgress(progress);

        if (progress.status === 'completed') {
          // Remove from pending and reset state after a short delay
          setTimeout(() => {
            removePendingDownload(progress.language);
            setDownloadProgress(null);
            setIsDownloading(false);
            setCurrentDownload(null);
          }, 1500);
        } else if (progress.status === 'error') {
          setIsDownloading(false);
          setCurrentDownload(null);
        }
      });
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, [removePendingDownload, setDownloadProgress, setIsDownloading]);

  const handleDownload = async (language: string) => {
    if (isDownloading) return;

    setIsDownloading(true);
    setCurrentDownload(language);

    try {
      await lspService.downloadServer(language);
    } catch (error) {
      logger.error('[LspDownloadPrompt] Download failed:', error);
      setDownloadProgress({
        language,
        status: 'error',
        message: error instanceof Error ? error.message : 'Download failed',
      });
      setIsDownloading(false);
      setCurrentDownload(null);
    }
  };

  const handleDismiss = (language: string) => {
    removePendingDownload(language);
  };

  if (pendingDownloads.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {pendingDownloads.map((download) => {
        const isCurrentlyDownloading = currentDownload === download.language;
        const progress = isCurrentlyDownloading ? downloadProgress : null;

        return (
          <div
            key={download.language}
            className="bg-background border border-border rounded-lg shadow-lg p-4 w-80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground">
                  Install {download.serverName}?
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {download.languageDisplayName} language support requires installing{' '}
                  {download.serverName}.
                </p>
              </div>
              {!isCurrentlyDownloading && (
                <button
                  type="button"
                  onClick={() => handleDismiss(download.language)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {progress && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  {progress.status === 'downloading' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Downloading...</span>
                    </>
                  )}
                  {progress.status === 'extracting' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  )}
                  {progress.status === 'completed' && (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Installed successfully!</span>
                    </>
                  )}
                  {progress.status === 'error' && (
                    <>
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {progress.message || 'Installation failed'}
                      </span>
                    </>
                  )}
                </div>
                {progress.progress !== undefined &&
                  progress.status !== 'completed' &&
                  progress.status !== 'error' && (
                    <Progress value={progress.progress * 100} className="h-1" />
                  )}
              </div>
            )}

            {!isCurrentlyDownloading && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDismiss(download.language)}
                  disabled={isDownloading}
                >
                  Not now
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownload(download.language)}
                  disabled={isDownloading}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
