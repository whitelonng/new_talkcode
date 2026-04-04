import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

declare const document: Document;

describe('useTheme', () => {
  beforeEach(async () => {
    vi.resetModules();

    // Clear localStorage
    localStorage.clear();

    // jsdom does not implement matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
    vi.clearAllMocks();
  });

  // Create wrapper with custom ThemeProvider
  async function createWrapper() {
    const { ThemeProvider } = await import('@/components/theme-provider');
    return function Wrapper({ children }: { children: ReactNode }) {
      return <ThemeProvider defaultTheme="system">{children}</ThemeProvider>;
    };
  }

  it('initializes theme from localStorage', async () => {
    localStorage.setItem('theme', 'light');

    const { useTheme } = await import('./use-theme');
    const wrapper = await createWrapper();
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
  });

  it('setTheme writes to localStorage', async () => {
    const { useTheme } = await import('./use-theme');
    const wrapper = await createWrapper();
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('dark');
    });

    // Should persist to localStorage
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggleTheme switches between light and dark', async () => {
    // Set initial theme to light
    localStorage.setItem('theme', 'light');

    const { useTheme } = await import('./use-theme');
    const wrapper = await createWrapper();
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Wait for initial render
    await act(async () => {});

    act(() => {
      result.current.toggleTheme();
    });

    // Should have toggled to dark
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('applies theme class to document element', async () => {
    localStorage.setItem('theme', 'dark');

    const { useTheme } = await import('./use-theme');
    const wrapper = await createWrapper();
    renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
