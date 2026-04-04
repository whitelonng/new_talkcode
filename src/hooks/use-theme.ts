import { useContext } from 'react';
import { type Theme, ThemeProviderContext } from '@/lib/theme-context';

export type { Theme };

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
