import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/hooks/use-locale';
import { getDocLinks } from '@/lib/doc-links';
import { useLspStore } from '@/stores/lsp-store';

const LSP_SUPPORTED_LANGUAGES = [
  { name: 'TypeScript', extensions: '.ts, .tsx' },
  { name: 'JavaScript', extensions: '.js, .jsx' },
  { name: 'Vue', extensions: '.vue' },
  { name: 'Rust', extensions: '.rs' },
  { name: 'Python', extensions: '.py' },
  { name: 'Go', extensions: '.go' },
  { name: 'C', extensions: '.c, .h' },
  { name: 'C++', extensions: '.cpp, .hpp' },
];

export function LspSettings() {
  const { t } = useLocale();
  const {
    enabled,
    showDiagnostics,
    showErrors,
    showWarnings,
    showInfo,
    showHints,
    setEnabled,
    setShowDiagnostics,
    setShowErrors,
    setShowWarnings,
    setShowInfo,
    setShowHints,
  } = useLspStore();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{t.Lsp.settings.title}</CardTitle>
            <HelpTooltip
              title={t.Lsp.settings.tooltipTitle}
              description={t.Lsp.settings.tooltipDescription}
              docUrl={getDocLinks().features.lsp}
            />
          </div>
          <CardDescription>{t.Lsp.settings.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable LSP */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t.Lsp.settings.enableLsp}</Label>
              <p className="text-sm text-muted-foreground">{t.Lsp.settings.enableLspDesc}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <Separator />

          {/* Supported Languages */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t.Lsp.settings.supportedLanguages}</Label>
            <div className="flex flex-wrap gap-2">
              {LSP_SUPPORTED_LANGUAGES.map((lang) => (
                <Badge key={lang.name} variant="secondary" className="text-xs">
                  {lang.name} ({lang.extensions})
                </Badge>
              ))}
            </div>
          </div>
          <Separator />

          {/* Show Diagnostics */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t.Lsp.settings.showDiagnostics}</Label>
              <p className="text-sm text-muted-foreground">{t.Lsp.settings.showDiagnosticsDesc}</p>
            </div>
            <Switch checked={showDiagnostics} onCheckedChange={setShowDiagnostics} />
          </div>
          <Separator />

          {/* Severity Settings */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t.Lsp.settings.severitySettings}</Label>
              <p className="text-xs text-muted-foreground">{t.Lsp.settings.severitySettingsDesc}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">{t.Lsp.showErrors}</span>
                </div>
                <Switch checked={showErrors} onCheckedChange={setShowErrors} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">{t.Lsp.showWarnings}</span>
                </div>
                <Switch checked={showWarnings} onCheckedChange={setShowWarnings} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{t.Lsp.showInfo}</span>
                </div>
                <Switch checked={showInfo} onCheckedChange={setShowInfo} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{t.Lsp.showHints}</span>
                </div>
                <Switch checked={showHints} onCheckedChange={setShowHints} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
