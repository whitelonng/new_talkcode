import { Check, Moon, Settings, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import type { SupportedLocale } from '@/locales';

export function GeneralSettings() {
  const { locale, t, setLocale, supportedLocales } = useLocale();
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleLanguageChange = async (value: SupportedLocale) => {
    await setLocale(value);
  };

  return (
    <div className="space-y-6">
      {/* Language & Theme Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle className="text-lg">{t.Settings.tabs.general || 'General'}</CardTitle>
          </div>
          <CardDescription>{t.Settings.general.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language Section */}
          <div>
            <h3 className="mb-3 text-sm font-medium">{t.Settings.language.title}</h3>
            <div className="space-y-2">
              {supportedLocales.map((lang) => (
                <button
                  type="button"
                  key={lang.code}
                  className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <span className="font-medium">{lang.name}</span>
                  {locale === lang.code && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Section */}
          <div>
            <h3 className="mb-3 text-sm font-medium">{t.Settings.theme.title}</h3>
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                onClick={() => toggleTheme()}
              >
                <div className="flex items-center gap-3">
                  {resolvedTheme === 'light' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  <span className="font-medium">{t.Settings.theme.options[resolvedTheme]}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {t.Settings.theme.switchTo}{' '}
                  {t.Settings.theme.options[resolvedTheme === 'light' ? 'dark' : 'light']}
                </span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
