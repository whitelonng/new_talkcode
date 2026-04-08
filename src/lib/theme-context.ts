import { createContext } from 'react';

export type Theme = 'dark' | 'light' | 'system' | 'apple-light' | 'apple-dark';

export type ThemeVariant = 'default' | 'apple';

export interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  themeVariant: ThemeVariant;
  isAppleTheme: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'dark',
  themeVariant: 'default',
  isAppleTheme: false,
  setTheme: () => null,
  toggleTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
