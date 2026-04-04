import { createContext } from 'react';

export type Theme = 'dark' | 'light' | 'system';

export interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => null,
  toggleTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
