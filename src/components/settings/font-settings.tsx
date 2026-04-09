import { Type } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/hooks/use-locale';
import { useSettingsStore } from '@/stores/settings-store';

export function FontSettings() {
  const { t } = useLocale();

  const appFontSize = useSettingsStore((state) => state.app_font_size);
  const setAppFontSize = useSettingsStore((state) => state.setAppFontSize);
  const chatFontSize = useSettingsStore((state) => state.chat_font_size);
  const setChatFontSize = useSettingsStore((state) => state.setChatFontSize);
  const codeFontSize = useSettingsStore((state) => state.code_font_size);
  const setCodeFontSize = useSettingsStore((state) => state.setCodeFontSize);

  // Local state to avoid frequent store updates
  const [localAppFontSize, setLocalAppFontSize] = useState(appFontSize);
  const [localChatFontSize, setLocalChatFontSize] = useState(chatFontSize);
  const [localCodeFontSize, setLocalCodeFontSize] = useState(codeFontSize);

  // Sync local state with store state
  useEffect(() => {
    setLocalAppFontSize(appFontSize);
  }, [appFontSize]);

  useEffect(() => {
    setLocalChatFontSize(chatFontSize);
  }, [chatFontSize]);

  useEffect(() => {
    setLocalCodeFontSize(codeFontSize);
  }, [codeFontSize]);

  // Clamp value within range and commit to store
  const commitAppFontSize = () => {
    const clamped = Math.min(20, Math.max(12, localAppFontSize));
    setLocalAppFontSize(clamped);
    if (clamped !== appFontSize) {
      setAppFontSize(clamped);
    }
  };

  const commitChatFontSize = () => {
    const clamped = Math.min(24, Math.max(12, localChatFontSize));
    setLocalChatFontSize(clamped);
    if (clamped !== chatFontSize) {
      setChatFontSize(clamped);
    }
  };

  const commitCodeFontSize = () => {
    const clamped = Math.min(20, Math.max(10, localCodeFontSize));
    setLocalCodeFontSize(clamped);
    if (clamped !== codeFontSize) {
      setCodeFontSize(clamped);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            <CardTitle className="text-lg">
              {t.Settings.fontSettings?.title || 'Font Size'}
            </CardTitle>
          </div>
          <CardDescription>
            {t.Settings.fontSettings?.description ||
              'Configure font sizes for different areas of the application'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* App Font Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t.Settings.fontSettings?.appFontSize || 'Application Font Size'}
            </Label>
            <Input
              type="number"
              min="12"
              max="20"
              value={localAppFontSize}
              onChange={(e) => setLocalAppFontSize(Number(e.target.value))}
              onBlur={commitAppFontSize}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              {t.Settings.fontSettings?.appFontSizeHint ||
                'Controls the overall UI text size (12-20px)'}
            </p>
          </div>

          {/* Chat Font Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t.Settings.fontSettings?.chatFontSize || 'Chat Font Size'}
            </Label>
            <Input
              type="number"
              min="12"
              max="24"
              value={localChatFontSize}
              onChange={(e) => setLocalChatFontSize(Number(e.target.value))}
              onBlur={commitChatFontSize}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              {t.Settings.fontSettings?.chatFontSizeHint ||
                'Controls chat message text size (12-24px)'}
            </p>
          </div>

          {/* Code Font Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t.Settings.fontSettings?.codeFontSize || 'Code Block Font Size'}
            </Label>
            <Input
              type="number"
              min="10"
              max="20"
              value={localCodeFontSize}
              onChange={(e) => setLocalCodeFontSize(Number(e.target.value))}
              onBlur={commitCodeFontSize}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              {t.Settings.fontSettings?.codeFontSizeHint ||
                'Controls code block text size (10-20px)'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
