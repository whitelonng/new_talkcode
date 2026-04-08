import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Theme, ThemeProviderContext, type ThemeVariant } from '@/lib/theme-context';

const STORAGE_KEY = 'theme';

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

  if (theme === 'apple-light') {
    return 'light';
  }

  if (theme === 'apple-dark') {
    return 'dark';
  }

  return theme;
}

function getThemeVariant(theme: Theme): ThemeVariant {
  return theme.startsWith('apple-') ? 'apple' : 'default';
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const getInitialTheme = () => (localStorage.getItem(STORAGE_KEY) as Theme) || defaultTheme;

  // Initialize from localStorage (synchronous, prevents flash)
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(getInitialTheme())
  );

  const themeVariant = useMemo(() => getThemeVariant(theme), [theme]);
  const isAppleTheme = themeVariant === 'apple';

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'theme-default', 'theme-apple', 'apple-theme');
    root.classList.add(resolvedTheme);
    root.classList.add(themeVariant === 'apple' ? 'theme-apple' : 'theme-default');

    if (themeVariant === 'apple') {
      root.classList.add('apple-theme');
    }

    // Notify other components (Monaco editor, etc.)
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: { resolvedTheme, theme, themeVariant, isAppleTheme },
      })
    );
  }, [resolvedTheme, theme, themeVariant, isAppleTheme]);

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

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = isAppleTheme
      ? resolvedTheme === 'light'
        ? 'apple-dark'
        : 'apple-light'
      : resolvedTheme === 'light'
        ? 'dark'
        : 'light';
    setTheme(newTheme);
  }, [isAppleTheme, resolvedTheme, setTheme]);

  return (
    <ThemeProviderContext.Provider
      value={{ theme, resolvedTheme, themeVariant, isAppleTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}
