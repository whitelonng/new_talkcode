import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useLocale } from '@/hooks/use-locale';
import { type Theme, useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export function ThemeStep() {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  const themeOptions: {
    value: Theme;
    icon: typeof Sun;
    labelKey: keyof typeof t.Onboarding.steps.theme;
  }[] = [
    { value: 'light', icon: Sun, labelKey: 'light' },
    { value: 'dark', icon: Moon, labelKey: 'dark' },
    { value: 'system', icon: Monitor, labelKey: 'system' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Sun className="h-12 w-12 mx-auto text-primary mb-3" />
        <h3 className="text-lg font-semibold">{t.Onboarding.steps.theme.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.Onboarding.steps.theme.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const label = t.Onboarding.steps.theme[option.labelKey];
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-lg border p-4 transition-all',
                theme === option.value
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50 hover:bg-accent'
              )}
            >
              <Icon className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">{label}</span>
              {theme === option.value && (
                <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
