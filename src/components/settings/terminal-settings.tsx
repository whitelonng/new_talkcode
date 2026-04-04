import { platform } from '@tauri-apps/plugin-os';
import { Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/hooks/use-locale';
import { getDocLinks } from '@/lib/doc-links';
import { useSettingsStore } from '@/stores/settings-store';

// Shell options for Windows
const SHELL_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Automatically detect best shell' },
  { value: 'pwsh', label: 'PowerShell Core', description: 'Modern cross-platform PowerShell' },
  { value: 'powershell', label: 'Windows PowerShell', description: 'Built-in Windows PowerShell' },
  { value: 'cmd', label: 'CMD', description: 'Windows Command Prompt' },
] as const;

export function TerminalSettings() {
  const { t } = useLocale();
  const [isWindows, setIsWindows] = useState(false);
  const terminalShell = useSettingsStore((state) => state.terminal_shell);
  const setTerminalShell = useSettingsStore((state) => state.setTerminalShell);
  const terminalFont = useSettingsStore((state) => state.terminal_font);
  const setTerminalFont = useSettingsStore((state) => state.setTerminalFont);
  const terminalFontSize = useSettingsStore((state) => state.terminal_font_size);
  const setTerminalFontSize = useSettingsStore((state) => state.setTerminalFontSize);

  // Local state for font input to avoid frequent store updates
  const [localTerminalFont, setLocalTerminalFont] = useState(terminalFont);
  const [localTerminalFontSize, setLocalTerminalFontSize] = useState(terminalFontSize);

  useEffect(() => {
    setIsWindows(platform() === 'windows');
  }, []);

  // Sync local state with store state
  useEffect(() => {
    setLocalTerminalFont(terminalFont);
  }, [terminalFont]);

  useEffect(() => {
    setLocalTerminalFontSize(terminalFontSize);
  }, [terminalFontSize]);

  // Handle font input blur to commit changes
  const handleFontBlur = () => {
    if (localTerminalFont !== terminalFont) {
      setTerminalFont(localTerminalFont);
    }
  };

  const handleFontSizeBlur = () => {
    if (localTerminalFontSize !== terminalFontSize) {
      setTerminalFontSize(localTerminalFontSize);
    }
  };

  return (
    <div className="space-y-6">
      {/* Terminal Font Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <CardTitle className="text-lg">{t.Settings.terminal?.title || 'Terminal'}</CardTitle>
            <HelpTooltip
              title={t.Settings.terminal?.tooltipTitle}
              description={t.Settings.terminal?.tooltipDescription}
              docUrl={getDocLinks().features.terminal}
            />
          </div>
          <CardDescription>
            {t.Settings.terminal?.description || 'Configure terminal appearance and behavior'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Font Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t.Settings.terminalFont.title}</h3>

            {/* Font Family */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t.Settings.terminalFont.fontFamily}</Label>
              <Input
                value={localTerminalFont}
                onChange={(e) => setLocalTerminalFont(e.target.value)}
                onBlur={handleFontBlur}
                placeholder={t.Settings.terminalFont.placeholder}
                className="font-mono text-sm"
              />
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t.Settings.terminalFont.fontSize}</Label>
              <Input
                type="number"
                min="8"
                max="72"
                value={localTerminalFontSize}
                onChange={(e) => setLocalTerminalFontSize(Number(e.target.value))}
                onBlur={handleFontSizeBlur}
                className="w-24"
              />
            </div>

            <p className="text-sm text-muted-foreground">{t.Settings.terminalFont.description}</p>
          </div>

          {/* Shell Settings - Windows Only */}
          {isWindows && (
            <>
              <div className="border-t pt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t.Settings.terminal?.defaultShell || 'Default Shell'}
                  </Label>
                  <Select
                    value={terminalShell || 'auto'}
                    onValueChange={(value) => setTerminalShell(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select shell" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHELL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t.Settings.terminal?.shellHint ||
                      'Changes will take effect on the next terminal session.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
