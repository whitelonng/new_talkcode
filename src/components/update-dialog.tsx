import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { UseUpdaterReturn } from '@/hooks/use-updater';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updater: UseUpdaterReturn;
}

export function UpdateDialog({ open, onOpenChange, updater }: UpdateDialogProps) {
  const {
    available,
    downloading,
    downloaded,
    error,
    update,
    progress,
    downloadAndInstall,
    restartApp,
    dismissError,
  } = updater;

  // Auto-start download when dialog opens and update is available
  useEffect(() => {
    if (open && available && !downloading && !downloaded && !error) {
      downloadAndInstall();
    }
  }, [open, available, downloading, downloaded, error, downloadAndInstall]);

  const handleRestart = async () => {
    await restartApp();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    dismissError();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {downloaded ? (
              <>
                <RefreshCw className="h-5 w-5" />
                Update Ready
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Update Available
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {downloaded
              ? 'The update has been installed. Restart the application to complete the update.'
              : `A new version (${update?.version}) is available.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Version Info */}
          {update && !downloaded && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Version:</span>
                <span className="font-medium">{update.currentVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New Version:</span>
                <span className="font-medium">{update.version}</span>
              </div>
              {update.date && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Release Date:</span>
                  <span className="font-medium">{new Date(update.date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Release Notes */}
          {update?.body && !downloaded && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">What's New:</h4>
              <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm">
                <pre className="whitespace-pre-wrap font-sans">{update.body}</pre>
              </div>
            </div>
          )}

          {/* Download Progress */}
          {downloading && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Downloading...</span>
                <span className="font-medium">
                  {progress.percentage ? `${Math.round(progress.percentage)}%` : ''}
                </span>
              </div>
              <Progress value={progress.percentage || 0} />
              {progress.total && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(progress.downloaded)}</span>
                  <span>{formatBytes(progress.total)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {downloaded ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Later
              </Button>
              <Button onClick={handleRestart}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Restart Now
              </Button>
            </>
          ) : error ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Close
              </Button>
              <Button onClick={downloadAndInstall} disabled={downloading}>
                Try Again
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleCancel} disabled={downloading}>
              {downloading ? 'Downloading...' : 'Cancel'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
