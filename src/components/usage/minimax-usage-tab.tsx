// src/pages/usage/minimax-usage-tab.tsx
// MiniMax usage tab component

import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/hooks/use-locale';
import {
  getRemainingPercentage as getMinimaxRemainingPercentage,
  getTimeUntilReset as getMinimaxTimeUntilReset,
  getUsageLevel as getMinimaxUsageLevel,
  testMinimaxCookie,
} from '@/services/minimax-usage-service';
import { useMinimaxUsageStore } from '@/stores/minimax-usage-store';
import { settingsManager } from '@/stores/settings-store';

// Helper to get color classes based on usage level
function getLevelColor(level: string): string {
  switch (level) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'high':
      return 'text-orange-600 dark:text-orange-400';
    case 'critical':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

export function MinimaxUsageTab() {
  const { t } = useLocale();
  const cookieUpdateTextareaId = useId();

  // Usage state
  const usageData = useMinimaxUsageStore((state) => state.usageData);
  const isLoading = useMinimaxUsageStore((state) => state.isLoading);
  const error = useMinimaxUsageStore((state) => state.error);
  const initialize = useMinimaxUsageStore((state) => state.initialize);
  const refresh = useMinimaxUsageStore((state) => state.refresh);
  const reset = useMinimaxUsageStore((state) => state.reset);

  // Cookie configuration state
  const [cookieInput, setCookieInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle save cookie
  const handleSaveCookie = async () => {
    if (!cookieInput.trim()) {
      toast.error('Please paste the cURL command or cookie');
      return;
    }

    setIsSaving(true);
    try {
      // Test the cookie first
      await testMinimaxCookie(cookieInput);

      // Save to settings
      await settingsManager.setMinimaxCookie(cookieInput);

      // Clear input and reset store state before refresh
      setCookieInput('');
      reset();

      toast.success('Cookie saved successfully!');

      // Refresh usage data
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save cookie';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle test connection
  const handleTestCookie = async () => {
    if (!cookieInput.trim()) {
      toast.error('Please paste the cURL command or cookie');
      return;
    }

    setIsTesting(true);
    try {
      await testMinimaxCookie(cookieInput);
      toast.success('Connection test successful!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      toast.error(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    await refresh();
  };

  // Missing/expired cookie state (initial not configured or expired/missing from API)
  const isCookieMissing =
    error?.includes('cookie not configured') ||
    error?.includes('SESSION_EXPIRED') ||
    error?.toLowerCase().includes('cookie is missing');

  if (isCookieMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.minimaxUsage.title}</CardTitle>
          <CardDescription>{t.minimaxUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Error / info */}
          {error?.includes('SESSION_EXPIRED') ||
          error?.toLowerCase().includes('cookie is missing') ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t.minimaxUsage.sessionExpired}</AlertTitle>
              <AlertDescription>{t.minimaxUsage.sessionExpiredDescription}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuration Required</AlertTitle>
              <AlertDescription>
                Follow the steps below to configure your MiniMax session cookie.
              </AlertDescription>
            </Alert>
          )}

          {/* Step-by-step Guide */}
          <div className="space-y-4">
            <h3 className="font-semibold">
              {error ? 'Update your cookie:' : 'How to get your cookie:'}
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Open{' '}
                <a
                  href="https://platform.minimaxi.com/user-center/payment/coding-plan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  MiniMax Coding Plan page
                </a>
              </li>
              <li>Open DevTools (F12) → Network tab</li>
              <li>Refresh the page</li>
              <li>
                Find the <code className="bg-muted px-1 rounded">remains</code> request
              </li>
              <li>Right-click → Copy as cURL</li>
              <li>Paste below</li>
            </ol>
          </div>

          {/* Input Area */}
          <div className="space-y-2">
            <Label htmlFor={cookieUpdateTextareaId}>Paste cURL Command</Label>
            <textarea
              id={cookieUpdateTextareaId}
              className="w-full min-h-[120px] p-3 text-sm border rounded-md font-mono"
              placeholder="curl 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains?GroupId=...' ..."
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              💡 Tip: You can paste the entire cURL command. We'll automatically extract the cookie.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleTestCookie}
              disabled={isTesting || !cookieInput.trim()}
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button onClick={handleSaveCookie} disabled={isSaving || !cookieInput.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : error ? (
                'Update & Reconnect'
              ) : (
                'Save & Connect'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.minimaxUsage.title}</CardTitle>
          <CardDescription>{t.minimaxUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.minimaxUsage.error}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.minimaxUsage.refreshing}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t.minimaxUsage.retry}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading && !usageData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.minimaxUsage.title}</CardTitle>
          <CardDescription>{t.minimaxUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!usageData || !usageData.five_hour) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.minimaxUsage.title}</CardTitle>
          <CardDescription>{t.minimaxUsage.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.minimaxUsage.noData}</AlertTitle>
            <AlertDescription>{t.minimaxUsage.noDataDescription}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get usage level
  const usageLevel = getMinimaxUsageLevel(usageData.five_hour.utilization_pct);
  const remainingPercentage = getMinimaxRemainingPercentage(usageData.five_hour.utilization_pct);

  // Format last validated time
  const lastValidated = usageData.last_validated_at
    ? new Date(usageData.last_validated_at).toLocaleString()
    : 'Unknown';

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.minimaxUsage.refreshing}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.minimaxUsage.refresh}
            </>
          )}
        </Button>
      </div>

      {/* Session Info */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          {t.minimaxUsage.lastValidated}: {lastValidated}
        </AlertDescription>
      </Alert>

      {/* 5-Hour Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.minimaxUsage.fiveHour.title}</CardTitle>
              <CardDescription>{t.minimaxUsage.fiveHour.description}</CardDescription>
            </div>
            {usageData.five_hour.reset_at && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.minimaxUsage.resetsIn}: {getMinimaxTimeUntilReset(usageData.five_hour.reset_at)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.minimaxUsage.used}: {usageData.five_hour.utilization_pct.toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${getLevelColor(usageLevel)}`}>
                {t.minimaxUsage.remaining}: {remainingPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={usageData.five_hour.utilization_pct} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.minimaxUsage.used}
              </p>
              <p className="text-lg font-bold">
                <span className="text-orange-500">{Math.round(usageData.five_hour.used ?? 0)}</span>
                <span className="text-muted-foreground ml-2 text-sm">
                  ({usageData.five_hour.utilization_pct.toFixed(1)}%)
                </span>
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.minimaxUsage.remaining}
              </p>
              <p className="text-lg font-bold">
                <span className="text-green-500">
                  {Math.round(usageData.five_hour.remaining ?? 0)}
                </span>
                <span className="text-muted-foreground ml-2 text-sm">
                  ({remainingPercentage.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>

          {usageLevel === 'critical' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t.minimaxUsage.criticalWarning}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
