// src/pages/usage/openai-usage-tab.tsx
// OpenAI usage tab component

import { AlertCircle, CheckCircle2, Clock, Coins, Loader2, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/hooks/use-locale';
import { useOpenAIOAuthStore } from '@/providers/oauth/openai-oauth-store';
import {
  getRemainingPercentage as getOpenAIRemainingPercentage,
  getTimeUntilReset as getOpenAITimeUntilReset,
  getUsageLevel as getOpenAIUsageLevel,
  getWeeklyResetDisplay as getOpenAIWeeklyResetDisplay,
} from '@/services/openai-usage-service';
import { useOpenAIUsageStore } from '@/stores/openai-usage-store';

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

export function OpenAIUsageTab() {
  const { t } = useLocale();

  // OpenAI OAuth state
  const isOAuthConnected = useOpenAIOAuthStore((state) => state.isConnected);
  const initializeOAuth = useOpenAIOAuthStore((state) => state.initialize);
  const startOAuth = useOpenAIOAuthStore((state) => state.startOAuthWithAutoCallback);

  // Usage state
  const usageData = useOpenAIUsageStore((state) => state.usageData);
  const isLoading = useOpenAIUsageStore((state) => state.isLoading);
  const error = useOpenAIUsageStore((state) => state.error);
  const initialize = useOpenAIUsageStore((state) => state.initialize);
  const refresh = useOpenAIUsageStore((state) => state.refresh);

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

  // Handle OAuth login
  const handleConnect = async () => {
    try {
      const url = await startOAuth();
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to start OAuth:', err);
    }
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
          <CardTitle>{t.openaiUsage.title}</CardTitle>
          <CardDescription>{t.openaiUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.openaiUsage.notConnected}</AlertTitle>
            <AlertDescription>{t.openaiUsage.connectPrompt}</AlertDescription>
          </Alert>
          <Button onClick={handleConnect}>{t.openaiUsage.connectButton}</Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.openaiUsage.title}</CardTitle>
          <CardDescription>{t.openaiUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.openaiUsage.error}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.openaiUsage.refreshing}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t.openaiUsage.retry}
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
          <CardTitle>{t.openaiUsage.title}</CardTitle>
          <CardDescription>{t.openaiUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!usageData || !usageData.five_hour || !usageData.seven_day) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.openaiUsage.title}</CardTitle>
          <CardDescription>{t.openaiUsage.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.openaiUsage.noData}</AlertTitle>
            <AlertDescription>{t.openaiUsage.noDataDescription}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get usage levels with safe access
  const fiveHourLevel = getOpenAIUsageLevel(usageData.five_hour?.utilization_pct ?? 0);
  const sevenDayLevel = getOpenAIUsageLevel(usageData.seven_day?.utilization_pct ?? 0);

  // Calculate remaining percentages
  const fiveHourRemaining = getOpenAIRemainingPercentage(usageData.five_hour?.utilization_pct ?? 0);
  const sevenDayRemaining = getOpenAIRemainingPercentage(usageData.seven_day?.utilization_pct ?? 0);

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.openaiUsage.refreshing}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.openaiUsage.refresh}
            </>
          )}
        </Button>
      </div>

      {/* 5-Hour Session Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.openaiUsage.fiveHour.title}</CardTitle>
              <CardDescription>{t.openaiUsage.fiveHour.description}</CardDescription>
            </div>
            {usageData.five_hour.reset_at && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.openaiUsage.resetsIn}: {getOpenAITimeUntilReset(usageData.five_hour.reset_at)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.openaiUsage.used}: {(usageData.five_hour?.utilization_pct ?? 0).toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${getLevelColor(fiveHourLevel)}`}>
                {t.openaiUsage.remaining}: {fiveHourRemaining.toFixed(1)}%
              </span>
            </div>
            <Progress value={usageData.five_hour?.utilization_pct ?? 0} className="h-2" />
          </div>
          {fiveHourLevel === 'critical' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t.openaiUsage.criticalWarning}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 7-Day Weekly Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.openaiUsage.sevenDay.title}</CardTitle>
              <CardDescription>{t.openaiUsage.sevenDay.description}</CardDescription>
            </div>
            {usageData.seven_day.reset_at && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.openaiUsage.resetsIn}:{' '}
                {getOpenAIWeeklyResetDisplay(usageData.seven_day.reset_at)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.openaiUsage.used}: {(usageData.seven_day?.utilization_pct ?? 0).toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${getLevelColor(sevenDayLevel)}`}>
                {t.openaiUsage.remaining}: {sevenDayRemaining.toFixed(1)}%
              </span>
            </div>
            <Progress value={usageData.seven_day?.utilization_pct ?? 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Credits */}
      {usageData.credits && (
        <Card>
          <CardHeader>
            <CardTitle>{t.openaiUsage.credits.title}</CardTitle>
            <CardDescription>{t.openaiUsage.credits.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t.openaiUsage.credits.balance}</p>
                <p className="text-2xl font-bold">
                  {usageData.credits.unlimited
                    ? t.openaiUsage.credits.unlimited
                    : usageData.credits.balance.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code Review Usage */}
      {typeof usageData.code_review_utilization === 'number' && (
        <Card>
          <CardHeader>
            <CardTitle>{t.openaiUsage.codeReview.title}</CardTitle>
            <CardDescription>{t.openaiUsage.codeReview.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.openaiUsage.used}: {usageData.code_review_utilization.toFixed(1)}%
              </span>
            </div>
            <Progress value={usageData.code_review_utilization} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Plan Info */}
      {usageData.rate_limit_tier && (
        <Card>
          <CardHeader>
            <CardTitle>{t.openaiUsage.plan.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium">{usageData.rate_limit_tier}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
