import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock all the necessary modules
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn(),
    setFocus: vi.fn(),
    listen: vi.fn(() => Promise.resolve(() => {})),
    isMainWindow: vi.fn(() => Promise.resolve(true)),
    label: 'main',
  })),
}));

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  getCurrentDeepLinkUrls: vi.fn(() => Promise.resolve([])),
  onOpenUrl: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@/services/initialization-manager', () => ({
  initializationManager: {
    initialize: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      onboarding_completed: true,
      language: 'en',
      setLanguage: vi.fn(),
      getAutoApproveEditsGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
  settingsManager: {
    getAllShortcuts: vi.fn(() =>
      Promise.resolve({
        globalFileSearch: { key: 'p', ctrlKey: true },
        globalContentSearch: { key: 'g', ctrlKey: true },
        fileSearch: { key: 'f', ctrlKey: true },
        saveFile: { key: 's', ctrlKey: true },
        newWindow: { key: 'n', ctrlKey: true },
        openModelSettings: { key: 'm', ctrlKey: true },
        toggleTerminal: { key: 'j', ctrlKey: true },
        nextTerminalTab: { key: 'Tab', ctrlKey: true },
        previousTerminalTab: { key: 'Tab', ctrlKey: true, shiftKey: true },
        newTerminalTab: { key: 't', ctrlKey: true },
      })
    ),
    getAutoApproveEditsGlobal: vi.fn(() => false),
  },
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    handleOAuthCallback: vi.fn(),
  })),
}));

vi.mock('@/stores/window-scoped-repository-store', () => ({
  RepositoryStoreProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWindowScopedRepositoryStore: vi.fn(),
}));

vi.mock('@/contexts/window-context', () => ({
  WindowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWindowContext: vi.fn(() => ({
    isMainWindow: true,
    windowLabel: 'main',
  })),
}));

vi.mock('@/contexts/ui-navigation', () => ({
  UiNavigationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useUiNavigation: vi.fn(() => ({
    activeView: 'chat',
    setActiveView: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@/services/window-manager-service', () => ({
  WindowManagerService: {
    createProjectWindow: vi.fn(),
    checkNewWindowFlag: vi.fn(() => Promise.resolve(false)),
  },
}));

vi.mock('@/services/window-restore-service', () => ({
  WindowRestoreService: {
    restoreWindowState: vi.fn(),
  },
}));

describe('App - Shift+Esc Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should prevent Shift+Esc from triggering browser task manager', async () => {
    render(<App />);

    // Wait for app to initialize
    await waitFor(() => {
      expect(document.querySelector('.flex')).toBeInTheDocument();
    });

    // Create a Shift+Esc keyboard event
    const shiftEscEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      bubbles: true,
      cancelable: true,
    });

    // Spy on preventDefault to verify it's called
    const preventDefaultSpy = vi.spyOn(shiftEscEvent, 'preventDefault');
    const stopPropagationSpy = vi.spyOn(shiftEscEvent, 'stopPropagation');
    const stopImmediatePropagationSpy = vi.spyOn(shiftEscEvent, 'stopImmediatePropagation');

    // Dispatch the event on document
    document.dispatchEvent(shiftEscEvent);

    // Verify that preventDefault, stopPropagation, and stopImmediatePropagation were called
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(stopImmediatePropagationSpy).toHaveBeenCalled();
  });

  it('should NOT prevent regular Esc key (without Shift)', async () => {
    render(<App />);

    // Wait for app to initialize
    await waitFor(() => {
      expect(document.querySelector('.flex')).toBeInTheDocument();
    });

    // Create a regular Esc keyboard event (no Shift)
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      bubbles: true,
      cancelable: true,
    });

    // Spy on preventDefault to verify it's NOT called
    const preventDefaultSpy = vi.spyOn(escEvent, 'preventDefault');

    // Dispatch the event on document
    document.dispatchEvent(escEvent);

    // Verify that preventDefault was NOT called for regular Esc
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should NOT prevent Shift+Esc with additional modifiers (Ctrl, Alt, Meta)', async () => {
    render(<App />);

    // Wait for app to initialize
    await waitFor(() => {
      expect(document.querySelector('.flex')).toBeInTheDocument();
    });

    // Test Ctrl+Shift+Esc
    const ctrlShiftEscEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      shiftKey: true,
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy1 = vi.spyOn(ctrlShiftEscEvent, 'preventDefault');
    document.dispatchEvent(ctrlShiftEscEvent);
    expect(preventDefaultSpy1).not.toHaveBeenCalled();

    // Test Alt+Shift+Esc
    const altShiftEscEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy2 = vi.spyOn(altShiftEscEvent, 'preventDefault');
    document.dispatchEvent(altShiftEscEvent);
    expect(preventDefaultSpy2).not.toHaveBeenCalled();

    // Test Meta+Shift+Esc
    const metaShiftEscEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      shiftKey: true,
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy3 = vi.spyOn(metaShiftEscEvent, 'preventDefault');
    document.dispatchEvent(metaShiftEscEvent);
    expect(preventDefaultSpy3).not.toHaveBeenCalled();
  });

  it('should prevent Shift+Esc even when focus is on different elements', async () => {
    render(<App />);

    // Wait for app to initialize
    await waitFor(() => {
      expect(document.querySelector('.flex')).toBeInTheDocument();
    });

    // Create a div to simulate different focus targets
    const testDiv = document.createElement('div');
    document.body.appendChild(testDiv);
    testDiv.focus();

    // Create a Shift+Esc keyboard event
    const shiftEscEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy = vi.spyOn(shiftEscEvent, 'preventDefault');

    // Dispatch from the test div
    testDiv.dispatchEvent(shiftEscEvent);

    // Verify that preventDefault was called even when focus is elsewhere
    expect(preventDefaultSpy).toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(testDiv);
  });
});
