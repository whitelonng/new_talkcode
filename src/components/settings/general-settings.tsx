import { BookOpen, Check, Moon, Settings, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import type { SupportedLocale } from '@/locales';

export function GeneralSettings() {
  const { locale, t, setLocale, supportedLocales } = useLocale();
  const { theme, setTheme } = useTheme();

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
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.Settings.theme.defaultGroupLabel}
                </div>
                <div className="space-y-2">
                  {[
                    {
                      value: 'light' as const,
                      icon: Sun,
                      label: t.Settings.theme.options.light,
                      description: t.Settings.theme.descriptions.light,
                    },
                    {
                      value: 'dark' as const,
                      icon: Moon,
                      label: t.Settings.theme.options.dark,
                      description: t.Settings.theme.descriptions.dark,
                    },
                    {
                      value: 'system' as const,
                      icon: Sun,
                      label: t.Settings.theme.options.system,
                      description: t.Settings.theme.descriptions.system,
                    },
                  ].map((option) => {
                    const Icon = option.icon;
                    const isSelected = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors hover:bg-accent"
                        onClick={() => setTheme(option.value)}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.Settings.theme.appleGroupLabel}
                </div>
                <div className="space-y-2">
                  {[
                    {
                      value: 'apple-light' as const,
                      label: t.Settings.theme.options.appleLight,
                      description: t.Settings.theme.descriptions.appleLight,
                    },
                    {
                      value: 'apple-dark' as const,
                      label: t.Settings.theme.options.appleDark,
                      description: t.Settings.theme.descriptions.appleDark,
                    },
                  ].map((option) => {
                    const isSelected = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors hover:bg-accent"
                        onClick={() => setTheme(option.value)}
                      >
                        <div className="flex items-center gap-3">
                          <Sun className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.Settings.theme.retromaGroupLabel}
                </div>
                <div className="space-y-2">
                  {[
                    {
                      value: 'retroma-light' as const,
                      icon: BookOpen,
                      label: t.Settings.theme.options.retromaLight,
                      description: t.Settings.theme.descriptions.retromaLight,
                    },
                  ].map((option) => {
                    const isSelected = theme === option.value;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors hover:bg-accent"
                        onClick={() => setTheme(option.value)}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
