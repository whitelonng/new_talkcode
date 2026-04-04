import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { LINT_SUPPORTED_LANGUAGES_DISPLAY } from '@/constants/lint';
import { useLocale } from '@/hooks/use-locale';
import { getDocLinks } from '@/lib/doc-links';
import { useLintStore } from '@/stores/lint-store';

interface RuntimeStatus {
  bun_available: boolean;
  node_available: boolean;
}

export function LintSettings() {
  const { t } = useLocale();
  const { settings, updateSettings } = useLintStore();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  useEffect(() => {
    invoke<RuntimeStatus>('check_lint_runtime')
      .then(setRuntimeStatus)
      .catch(() => {
        setRuntimeStatus({ bun_available: false, node_available: false });
      });
  }, []);

  const handleLintToggle = (key: keyof typeof settings) => (value: boolean) => {
    updateSettings({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{t.Lint.settings.title}</CardTitle>
            <HelpTooltip
              title={t.Lint.settings.tooltipTitle}
              description={t.Lint.settings.tooltipDescription}
              docUrl={getDocLinks().features.codeLint}
            />
          </div>
          <CardDescription>{t.Lint.settings.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Runtime Warning */}
          {runtimeStatus && !runtimeStatus.bun_available && !runtimeStatus.node_available && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t.Lint.settings.runtimeWarning}</AlertTitle>
              <AlertDescription>
                <p className="mb-3">{t.Lint.settings.runtimeWarningDesc}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://nodejs.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-1"
                    >
                      {t.Lint.settings.downloadNode}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://bun.sh/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-1"
                    >
                      {t.Lint.settings.downloadBun}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Enable Lint */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t.Lint.settings.enableLint}</Label>
              <p className="text-sm text-muted-foreground">{t.Lint.settings.enableLintDesc}</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={handleLintToggle('enabled')} />
          </div>
          <Separator />

          {/* Supported Languages */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t.Lint.settings.supportedLanguages}</Label>
            <div className="flex flex-wrap gap-2">
              {LINT_SUPPORTED_LANGUAGES_DISPLAY.map((lang) => (
                <Badge key={lang.name} variant="secondary" className="text-xs">
                  {lang.name} ({lang.extensions})
                </Badge>
              ))}
            </div>
          </div>
          <Separator />

          {/* Severity Settings */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t.Lint.settings.severitySettings}</Label>
              <p className="text-xs text-muted-foreground">
                {t.Lint.settings.severitySettingsDesc}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">{t.Lint.showErrors}</span>
                </div>
                <Switch
                  checked={settings.showErrors}
                  onCheckedChange={handleLintToggle('showErrors')}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">{t.Lint.showWarnings}</span>
                </div>
                <Switch
                  checked={settings.showWarnings}
                  onCheckedChange={handleLintToggle('showWarnings')}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{t.Lint.showInfo}</span>
                </div>
                <Switch
                  checked={settings.showInfo}
                  onCheckedChange={handleLintToggle('showInfo')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
