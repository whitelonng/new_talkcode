import { AppWindowMac } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/hooks/use-locale';
import { useSettingsStore } from '@/stores/settings-store';

export function TraySettings() {
  const { t } = useLocale();
  const closeToTray = useSettingsStore((s) => s.close_to_tray);
  const setCloseToTray = useSettingsStore((s) => s.setCloseToTray);

  const handleToggle = async (checked: boolean) => {
    await setCloseToTray(checked);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AppWindowMac className="h-5 w-5" />
            <CardTitle className="text-lg">{t.Settings.tray?.title || 'System Tray'}</CardTitle>
          </div>
          <CardDescription>
            {t.Settings.tray?.description ||
              'Configure system tray behavior when closing the application'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="close-to-tray">
                {t.Settings.tray?.closeToTray || 'Minimize to tray on close'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t.Settings.tray?.closeToTrayDescription ||
                  'When enabled, closing the window will minimize the app to the system tray instead of quitting'}
              </p>
            </div>
            <Switch id="close-to-tray" checked={closeToTray} onCheckedChange={handleToggle} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
