// src/pages/usage/zhipu-usage-tab.tsx
// Zhipu AI usage tab component

import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useUiNavigation } from '@/contexts/ui-navigation';
import { useLocale } from '@/hooks/use-locale';
import {
  getRemainingPercentage as getZhipuRemainingPercentage,
  getTimeUntilReset as getZhipuTimeUntilReset,
  getUsageLevel as getZhipuUsageLevel,
} from '@/services/zhipu-usage-service';
import { useZhipuUsageStore } from '@/stores/zhipu-usage-store';
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

export function ZhipuUsageTab() {
  const { t } = useLocale();
  const { setActiveView } = useUiNavigation();

  // Usage state
  const usageData = useZhipuUsageStore((state) => state.usageData);
  const isLoading = useZhipuUsageStore((state) => state.isLoading);
  const error = useZhipuUsageStore((state) => state.error);
  const initialize = useZhipuUsageStore((state) => state.initialize);
  const refresh = useZhipuUsageStore((state) => state.refresh);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle navigate to settings for API key configuration
  const handleConfigure = () => {
    setActiveView(NavigationView.SETTINGS);
  };

  // Handle refresh
  const handleRefresh = async () => {
    await refresh();
  };

  // Not configured state (no API key)
  if (error?.includes('API key not configured')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.zhipuUsage.title}</CardTitle>
          <CardDescription>{t.zhipuUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.zhipuUsage.notConfigured}</AlertTitle>
            <AlertDescription>{t.zhipuUsage.configurePrompt}</AlertDescription>
          </Alert>
          <Button onClick={handleConfigure}>{t.zhipuUsage.configureButton}</Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.zhipuUsage.title}</CardTitle>
          <CardDescription>{t.zhipuUsage.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.zhipuUsage.error}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.zhipuUsage.refreshing}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t.zhipuUsage.retry}
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
          <CardTitle>{t.zhipuUsage.title}</CardTitle>
          <CardDescription>{t.zhipuUsage.description}</CardDescription>
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
          <CardTitle>{t.zhipuUsage.title}</CardTitle>
          <CardDescription>{t.zhipuUsage.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.zhipuUsage.noData}</AlertTitle>
            <AlertDescription>{t.zhipuUsage.noDataDescription}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get usage level
  const usageLevel = getZhipuUsageLevel(usageData.five_hour.utilization_pct);
  const remainingPercentage = getZhipuRemainingPercentage(usageData.five_hour.utilization_pct);

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.zhipuUsage.refreshing}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.zhipuUsage.refresh}
            </>
          )}
        </Button>
      </div>

      {/* 5-Hour Session Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.zhipuUsage.fiveHour.title}</CardTitle>
              <CardDescription>{t.zhipuUsage.fiveHour.description}</CardDescription>
            </div>
            {usageData.five_hour.reset_at && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.zhipuUsage.resetsIn}: {getZhipuTimeUntilReset(usageData.five_hour.reset_at)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.zhipuUsage.used}: {usageData.five_hour.utilization_pct.toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${getLevelColor(usageLevel)}`}>
                {t.zhipuUsage.remaining}: {remainingPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={usageData.five_hour.utilization_pct} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.zhipuUsage.used}
              </p>
              <p className="text-lg font-bold">
                <span className="text-orange-500">
                  {(usageData.five_hour.used ?? 0).toLocaleString()}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.zhipuUsage.remaining}
              </p>
              <p className="text-lg font-bold">
                <span className="text-green-500">
                  {(usageData.five_hour.remaining ?? 0).toLocaleString()}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.zhipuUsage.limit}
              </p>
              <p className="text-lg font-bold">
                <span className="text-blue-500">
                  {(usageData.five_hour.limit ?? 0).toLocaleString()}
                </span>
              </p>
            </div>
          </div>

          {usageLevel === 'critical' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t.zhipuUsage.criticalWarning}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Model-Specific Usage */}
      {usageData.usage_details && usageData.usage_details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.zhipuUsage.modelUsage.title}</CardTitle>
            <CardDescription>{t.zhipuUsage.modelUsage.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usageData.usage_details.map((detail) => (
                <div key={detail.model} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{detail.model}</span>
                    <span className="text-sm text-muted-foreground">
                      {(detail.used ?? 0).toLocaleString()}
                      {detail.limit > 0 && ` / ${detail.limit.toLocaleString()}`}
                    </span>
                  </div>
                  {detail.limit > 0 && (
                    <Progress
                      value={detail.limit > 0 ? (detail.used / detail.limit) * 100 : 0}
                      className="h-2"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Info */}
      {usageData.plan_name && (
        <Card>
          <CardHeader>
            <CardTitle>{t.zhipuUsage.plan.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium">{usageData.plan_name}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
