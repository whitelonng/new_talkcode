import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Theme, ThemeProviderContext, type ThemeVariant } from '@/lib/theme-context';

const STORAGE_KEY = 'theme';
const SUPPORTED_THEMES: Theme[] = [
  'dark',
  'light',
  'system',
  'apple-light',
  'apple-dark',
  'retroma-light',
  'retroma-dark',
];

function normalizeTheme(theme: string | null | undefined, fallback: Theme): Theme {
  if (theme === 'retroma-dark') {
    return 'retroma-light';
  }

  if (theme && SUPPORTED_THEMES.includes(theme as Theme)) {
    return theme as Theme;
  }

  return fallback;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  if (theme.endsWith('-light')) {
    return 'light';
  }

  if (theme.endsWith('-dark')) {
    return 'dark';
  }

  return getSystemTheme();
}

function getThemeVariant(theme: Theme): ThemeVariant {
  if (theme.startsWith('apple-')) {
    return 'apple';
  }

  if (theme.startsWith('retroma-')) {
    return 'retroma';
  }

  return 'default';
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const getInitialTheme = () => {
    const initialTheme = normalizeTheme(localStorage.getItem(STORAGE_KEY), defaultTheme);
    localStorage.setItem(STORAGE_KEY, initialTheme);
    return initialTheme;
  };

  // Initialize from localStorage (synchronous, prevents flash)
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(getInitialTheme())
  );

  const themeVariant = useMemo(() => getThemeVariant(theme), [theme]);
  const isAppleTheme = themeVariant === 'apple';
  const isRetromaTheme = themeVariant === 'retroma';

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(
      'light',
      'dark',
      'theme-default',
      'theme-apple',
      'theme-retroma',
      'apple-theme',
      'retroma-theme'
    );
    root.classList.add(resolvedTheme);
    root.classList.add(`theme-${themeVariant}`);

    if (themeVariant === 'apple') {
      root.classList.add('apple-theme');
    }

    if (themeVariant === 'retroma') {
      root.classList.add('retroma-theme');
    }

    // Notify other components (Monaco editor, etc.)
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: { resolvedTheme, theme, themeVariant, isAppleTheme, isRetromaTheme },
      })
    );
  }, [resolvedTheme, theme, themeVariant, isAppleTheme, isRetromaTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      const normalizedTheme = normalizeTheme(newTheme, defaultTheme);
      setThemeState(normalizedTheme);
      setResolvedTheme(resolveTheme(normalizedTheme));
      localStorage.setItem(STORAGE_KEY, normalizedTheme);
    },
    [defaultTheme]
  );

  const toggleTheme = useCallback(() => {
    const newTheme =
      themeVariant === 'apple'
        ? resolvedTheme === 'light'
          ? 'apple-dark'
          : 'apple-light'
        : themeVariant === 'retroma'
          ? 'retroma-light'
          : resolvedTheme === 'light'
            ? 'dark'
            : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme, themeVariant]);

  return (
    <ThemeProviderContext.Provider
      value={{
        theme,
        resolvedTheme,
        themeVariant,
        isAppleTheme,
        isRetromaTheme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}
