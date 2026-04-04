import { FileText, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/hooks/use-locale';
import { getDocLinks } from '@/lib/doc-links';
import { hookConfigService } from '@/services/hooks/hook-config-service';
import { hookSnapshotService } from '@/services/hooks/hook-snapshot-service';
import { useSettingsStore } from '@/stores/settings-store';
import type { HookConfigScope, HooksConfigFile } from '@/types/hooks';

const CONFIG_SCOPES: Array<{ value: HookConfigScope; labelKey: 'user' | 'project' }> = [
  { value: 'user', labelKey: 'user' },
  { value: 'project', labelKey: 'project' },
];

function formatJson(value: HooksConfigFile): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(text: string): HooksConfigFile | null {
  try {
    return JSON.parse(text) as HooksConfigFile;
  } catch {
    return null;
  }
}

export function HooksSettings() {
  const { t } = useLocale();
  const hooksEnabled = useSettingsStore((state) => state.hooks_enabled);
  const setHooksEnabled = useSettingsStore((state) => state.setHooksEnabled);
  const [activeScope, setActiveScope] = useState<HookConfigScope>('project');
  const [rawConfig, setRawConfig] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const scopeOptions = useMemo(
    () =>
      CONFIG_SCOPES.map((scope) => ({
        ...scope,
        label: t.Settings.hooks.scope[scope.labelKey],
      })),
    [t]
  );

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const resolved = await hookConfigService.getConfigByScope(activeScope);
        if (!active) return;
        setRawConfig(formatJson(resolved.config));
      } catch (_error) {
        if (!active) return;
        toast.error(t.Settings.hooks.loadFailed);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadConfig();
    return () => {
      active = false;
    };
  }, [activeScope, t.Settings.hooks.loadFailed]);

  const handleSave = async () => {
    const parsed = parseJson(rawConfig);
    if (!parsed) {
      toast.error(t.Settings.hooks.invalidJson);
      return;
    }
    setIsSaving(true);
    try {
      await hookConfigService.updateConfig(activeScope, parsed);
      await hookSnapshotService.initializeSession();
      toast.success(t.Settings.hooks.saveSuccess);
    } catch {
      toast.error(t.Settings.hooks.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReload = async () => {
    setIsLoading(true);
    try {
      const resolved = await hookConfigService.getConfigByScope(activeScope);
      setRawConfig(formatJson(resolved.config));
    } catch {
      toast.error(t.Settings.hooks.loadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    try {
      await setHooksEnabled(value);
      await hookSnapshotService.refreshEnabledState();
      toast.success(value ? t.Settings.hooks.enabledToast : t.Settings.hooks.disabledToast);
    } catch {
      toast.error(t.Settings.hooks.toggleFailed);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{t.Settings.hooks.title}</CardTitle>
            <HelpTooltip
              title={t.Settings.hooks.tooltipTitle}
              description={t.Settings.hooks.tooltipDescription}
              docUrl={getDocLinks().features.hooks}
            />
          </div>
          <CardDescription>{t.Settings.hooks.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t.Settings.hooks.enableLabel}</Label>
              <p className="text-sm text-muted-foreground">{t.Settings.hooks.enableDescription}</p>
            </div>
            <Switch checked={hooksEnabled} onCheckedChange={handleToggle} />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/50 dark:text-amber-100">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              {t.Settings.hooks.warningTitle}
            </div>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {t.Settings.hooks.warningBody}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle className="text-lg">{t.Settings.hooks.configTitle}</CardTitle>
          </div>
          <CardDescription>{t.Settings.hooks.configDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t.Settings.hooksScopeHint}</p>
          <div className="flex flex-wrap gap-2">
            {scopeOptions.map((scope) => (
              <Button
                key={scope.value}
                variant={scope.value === activeScope ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveScope(scope.value)}
                disabled={isLoading || isSaving}
              >
                {scope.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t.Settings.hooks.configEditorLabel}</Label>
            <Textarea
              value={rawConfig}
              onChange={(event) => setRawConfig(event.target.value)}
              className="min-h-[240px] font-mono text-xs"
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? t.Settings.hooks.saving : t.Settings.hooks.save}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReload}
              disabled={isSaving || isLoading}
            >
              {t.Settings.hooks.reload}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
