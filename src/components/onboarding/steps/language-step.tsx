import { Check, Globe } from 'lucide-react';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';

export function LanguageStep() {
  const { locale, t, setLocale, supportedLocales } = useLocale();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Globe className="h-12 w-12 mx-auto text-primary mb-3" />
        <h3 className="text-lg font-semibold">{t.Onboarding.steps.language.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t.Onboarding.steps.language.description}
        </p>
      </div>

      <div className="space-y-3">
        {supportedLocales.map((lang) => (
          <button
            type="button"
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all',
              locale === lang.code
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50 hover:bg-accent'
            )}
          >
            <span className="font-medium">{lang.name}</span>
            {locale === lang.code && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
