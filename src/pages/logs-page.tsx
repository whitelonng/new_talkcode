import { Check, CopyIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { logService } from '@/services/log-service';

export function LogsPage() {
  const [logFilePath, setLogFilePath] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [filePath, latestLogs] = await Promise.all([
        logService.getDisplayLogFilePath(),
        logService.getLatestLogs(100),
      ]);
      setLogFilePath(filePath);
      setLogs(latestLogs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load logs';
      setError(message);
      logger.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(logFilePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy log path:', err);
    }
  };

  const handleRefresh = () => {
    loadLogs();
  };

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">{t.Logs.title}</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">{t.Logs.description}</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          {t.Logs.refresh}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Log Directory Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.Logs.logDirectory}</CardTitle>
              <CardDescription>{t.Logs.logDirectoryDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-6 w-full" />
              ) : error ? (
                <div className="text-red-600 dark:text-red-400">{error}</div>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm dark:bg-gray-800">
                    {logFilePath}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyPath}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Log Content */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>{t.Logs.latestEntries}</CardTitle>
              <CardDescription>{t.Logs.latestEntriesDescription}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : error ? (
                <div className="p-4 text-red-600 dark:text-red-400">{error}</div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-gray-500 dark:text-gray-400">{t.Logs.noLogsFound}</div>
              ) : (
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm">
                    {logs.join('\n')}
                  </pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
