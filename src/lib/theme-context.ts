import { createContext } from 'react';

export type Theme =
  | 'dark'
  | 'light'
  | 'system'
  | 'apple-light'
  | 'apple-dark'
  | 'retroma-light'
  | 'retroma-dark';

export type ThemeVariant = 'default' | 'apple' | 'retroma';

export interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  themeVariant: ThemeVariant;
  isAppleTheme: boolean;
  isRetromaTheme: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'dark',
  themeVariant: 'default',
  isAppleTheme: false,
  isRetromaTheme: false,
  setTheme: () => null,
  toggleTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
