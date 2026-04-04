// src/pages/usage/github-copilot-usage-tab.tsx
// GitHub Copilot usage tab component

import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useUiNavigation } from '@/contexts/ui-navigation';
import { useLocale } from '@/hooks/use-locale';
import { useGitHubCopilotOAuthStore } from '@/providers/oauth/github-copilot-oauth-store';
import {
  getRemainingPercentage as getCopilotRemainingPercentage,
  getUsageLevel as getCopilotUsageLevel,
} from '@/services/github-copilot-usage-service';
import { useGitHubCopilotUsageStore } from '@/stores/github-copilot-usage-store';
import { NavigationView } from '@/types/navigation';

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

export function GitHubCopilotUsageTab() {
  const { t } = useLocale();
  const { setActiveView } = useUiNavigation();

  // GitHub Copilot OAuth state
  const isOAuthConnected = useGitHubCopilotOAuthStore((state) => state.isConnected);
  const initializeOAuth = useGitHubCopilotOAuthStore((state) => state.initialize);

  // Usage state
  const usageData = useGitHubCopilotUsageStore((state) => state.usageData);
  const isLoading = useGitHubCopilotUsageStore((state) => state.isLoading);
  const error = useGitHubCopilotUsageStore((state) => state.error);
  const initialize = useGitHubCopilotUsageStore((state) => state.initialize);
  const refresh = useGitHubCopilotUsageStore((state) => state.refresh);

  // Initialize OAuth on mount
  useEffect(() => {
    void initializeOAuth();
  }, [initializeOAuth]);

  // Initialize on mount
  useEffect(() => {
    if (isOAuthConnected) {
      initialize();
    }
  }, [isOAuthConnected, initialize]);

  // Handle navigate to settings for connection
  const handleConnect = () => {
    setActiveView(NavigationView.SETTINGS);
  };

  // Handle refresh
  const handleRefresh = async () => {
    await refresh();
  };

  // Not connected state
  if (!isOAuthConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.githubCopilotUsage.title}</CardTitle>
          <CardDescription>{t.githubCopilotUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.githubCopilotUsage.notConnected}</AlertTitle>
            <AlertDescription>{t.githubCopilotUsage.connectPrompt}</AlertDescription>
          </Alert>
          <Button onClick={handleConnect}>{t.githubCopilotUsage.connectButton}</Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.githubCopilotUsage.title}</CardTitle>
          <CardDescription>{t.githubCopilotUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.githubCopilotUsage.error}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.githubCopilotUsage.refreshing}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t.githubCopilotUsage.retry}
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
          <CardTitle>{t.githubCopilotUsage.title}</CardTitle>
          <CardDescription>{t.githubCopilotUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!usageData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.githubCopilotUsage.title}</CardTitle>
          <CardDescription>{t.githubCopilotUsage.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.githubCopilotUsage.noData}</AlertTitle>
            <AlertDescription>{t.githubCopilotUsage.noDataDescription}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get usage level
  const usageLevel = getCopilotUsageLevel(usageData.utilization_pct);
  const remainingPercentage = getCopilotRemainingPercentage(usageData.utilization_pct);

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.githubCopilotUsage.refreshing}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.githubCopilotUsage.refresh}
            </>
          )}
        </Button>
      </div>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.githubCopilotUsage.usage.title}</CardTitle>
              <CardDescription>{t.githubCopilotUsage.usage.description}</CardDescription>
            </div>
            {usageData.reset_date && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.githubCopilotUsage.resetsOn}:{' '}
                {new Date(usageData.reset_date).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.githubCopilotUsage.used}: {usageData.utilization_pct.toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${getLevelColor(usageLevel)}`}>
                {t.githubCopilotUsage.remaining}: {remainingPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={usageData.utilization_pct} className="h-2" />
          </div>

          {usageData.entitlement !== undefined && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t.githubCopilotUsage.used}
                </p>
                <p className="text-lg font-bold">
                  <span className="text-orange-500">{Math.round(usageData.used ?? 0)}</span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    ({usageData.utilization_pct.toFixed(1)}%)
                  </span>
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t.githubCopilotUsage.remaining}
                </p>
                <p className="text-lg font-bold">
                  <span className="text-green-500">{Math.round(usageData.remaining ?? 0)}</span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    ({remainingPercentage.toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>
          )}

          {usageLevel === 'critical' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t.githubCopilotUsage.criticalWarning}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Plan Info */}
      {usageData.plan && (
        <Card>
          <CardHeader>
            <CardTitle>{t.githubCopilotUsage.plan.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium">{usageData.plan}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
