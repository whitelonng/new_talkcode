import { BookOpen, Check, Monitor, Moon, Sun } from 'lucide-react';
import { useLocale } from '@/hooks/use-locale';
import { type Theme, useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export function ThemeStep() {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  const themeOptions: {
    value: Theme;
    icon: typeof Sun;
    label: string;
  }[] = [
    { value: 'light', icon: Sun, label: t.Onboarding.steps.theme.light },
    { value: 'dark', icon: Moon, label: t.Onboarding.steps.theme.dark },
    { value: 'system', icon: Monitor, label: t.Onboarding.steps.theme.system },
    { value: 'apple-light', icon: Sun, label: t.Settings.theme.options.appleLight },
    { value: 'apple-dark', icon: Moon, label: t.Settings.theme.options.appleDark },
    { value: 'retroma-light', icon: BookOpen, label: t.Settings.theme.options.retromaLight },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Sun className="mx-auto mb-3 h-12 w-12 text-primary" />
        <h3 className="text-lg font-semibold">{t.Onboarding.steps.theme.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t.Onboarding.steps.theme.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {themeOptions.map((option) => {
          const Icon = option.icon;
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
              <Icon className="mb-2 h-8 w-8" />
              <span className="text-center text-sm font-medium">{option.label}</span>
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
