import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings-store';
import App from './app';

const { mockClose, mockHide, mockOnCloseRequested, mockInvoke, mockExecutionState } = vi.hoisted(() => ({
  mockClose: vi.fn(() => Promise.resolve()),
  mockHide: vi.fn(() => Promise.resolve()),
  mockOnCloseRequested: vi.fn(() => Promise.resolve(() => {})),
  mockInvoke: vi.fn(() => Promise.resolve(undefined)),
  mockExecutionState: {
    getRunningTaskIds: () => [] as string[],
    executions: new Map(),
  },
}));

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
    hide: mockHide,
    setFocus: vi.fn(),
    listen: vi.fn(() => Promise.resolve(() => {})),
    onCloseRequested: mockOnCloseRequested,
    close: mockClose,
    isMainWindow: vi.fn(() => Promise.resolve(true)),
    label: 'main',
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
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

vi.mock('@/stores/settings-store', () => {
  const state = {
    onboarding_completed: true,
    language: 'en',
    setLanguage: vi.fn(),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
    app_font_size: 14,
    chat_font_size: 14,
    code_font_size: 13,
    close_to_tray: false,
    isInitialized: true,
  };

  const useSettingsStore = vi.fn((selector) => {
    return selector ? selector(state) : state;
  });
  (useSettingsStore as typeof useSettingsStore & { getState: () => typeof state }).getState = () =>
    state;

  return {
    useSettingsStore,
    __mockState: state,
    DEFAULT_PROJECT: 'planner',
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
  };
});

vi.mock('@/stores/execution-store', () => ({
  useExecutionStore: vi.fn((selector) => (selector ? selector(mockExecutionState) : mockExecutionState)),
}));

vi.mock('@/hooks/use-locale', () => ({
  useLocale: vi.fn(() => ({
    t: {
      App: {
        runningTasksExitTitle: 'Tasks are still running',
        runningTasksExitDescription: (count: number) =>
          `${count} task${count === 1 ? '' : 's'} still running. Are you sure you want to exit TalkCody?`,
        confirmExit: 'Exit anyway',
      },
      Common: {
        cancel: 'Cancel',
      },
    },
  })),
  useTranslation: vi.fn(() => ({
    Common: {
      cancel: 'Cancel',
    },
  })),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    handleOAuthCallback: vi.fn(),
  })),
}));

vi.mock('@/components/lsp-download-prompt', () => ({
  LspDownloadPrompt: () => null,
}));

vi.mock('@/components/remote/telegram-remote-runner', () => ({
  RemoteServiceRunner: () => null,
}));

vi.mock('@/components/whats-new-dialog', () => ({
  WhatsNewDialog: () => null,
}));

vi.mock('@/components/main-content', () => ({
  MainContent: () => <div data-testid="main-content" />,
}));

vi.mock('@/components/custom-titlebar', () => ({
  CustomTitlebar: () => <div data-testid="custom-titlebar" />,
}));

vi.mock('@/stores/window-scoped-repository-store', () => ({
  RepositoryStoreProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWindowScopedRepositoryStore: vi.fn(),
  useRepositoryStore: vi.fn((selector) => {
    const state = {
      rootPath: null,
      hasRepository: false,
      isLoading: false,
      selectedFile: null,
      openFiles: [],
      expandedDirs: new Set<string>(),
      fileTree: [],
      openRepository: vi.fn(),
      closeRepository: vi.fn(),
      setSelectedFile: vi.fn(),
      toggleDirectory: vi.fn(),
      refreshFileTree: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
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
  useTheme: vi.fn(() => ({
    theme: 'system',
    resolvedTheme: 'light',
    isAppleTheme: false,
    setTheme: vi.fn(),
  })),
}));

vi.mock('@/services/window-manager-service', () => ({
  WindowManagerService: {
    getCurrentWindowLabel: vi.fn(() => Promise.resolve('main')),
  },
}));

describe('App - Shift+Esc Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const settingsState = (useSettingsStore as typeof useSettingsStore & { getState: () => { close_to_tray: boolean } }).getState();
    settingsState.close_to_tray = false;
    mockExecutionState.getRunningTaskIds = () => [];
    mockExecutionState.executions = new Map();
    mockClose.mockResolvedValue(undefined);
    mockHide.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
    mockOnCloseRequested.mockImplementation((handler) => {
      (mockOnCloseRequested as unknown as { handler?: unknown }).handler = handler;
      return Promise.resolve(() => {});
    });
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

  it('should sync close-to-tray setting to backend after initialization', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_close_to_tray', { enabled: false });
    });
  });

  it('should hide main window instead of closing when close-to-tray is enabled', async () => {
    const settingsState = (useSettingsStore as typeof useSettingsStore & {
      getState: () => { close_to_tray: boolean };
    }).getState();
    settingsState.close_to_tray = true;

    render(<App />);

    await waitFor(() => {
      expect(mockOnCloseRequested).toHaveBeenCalled();
    });

    const handler = (mockOnCloseRequested as unknown as {
      handler?: (event: { preventDefault: () => void }) => Promise<void>;
    }).handler;
    const preventDefault = vi.fn();

    await handler?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(mockHide).toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('should prevent close and show confirmation when tasks are running', async () => {
    mockExecutionState.getRunningTaskIds = () => ['task-1', 'task-2'];
    mockExecutionState.executions = new Map([
      ['task-1', { status: 'running', isStreaming: false }],
      ['task-2', { status: 'running', isStreaming: false }],
    ]);

    render(<App />);

    await waitFor(() => {
      expect(mockOnCloseRequested).toHaveBeenCalled();
    });

    const handler = (mockOnCloseRequested as unknown as { handler?: (event: { preventDefault: () => void }) => Promise<void> }).handler;
    const preventDefault = vi.fn();

    await handler?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(await screen.findByText('Tasks are still running')).toBeInTheDocument();
    expect(
      screen.getByText('2 tasks still running. Are you sure you want to exit TalkCody?')
    ).toBeInTheDocument();
  });

  it('should force close after user confirms exit with running tasks', async () => {
    mockExecutionState.getRunningTaskIds = () => ['task-1'];
    mockExecutionState.executions = new Map([
      ['task-1', { status: 'running', isStreaming: false }],
    ]);

    render(<App />);

    await waitFor(() => {
      expect(mockOnCloseRequested).toHaveBeenCalled();
    });

    const handler = (mockOnCloseRequested as unknown as { handler?: (event: { preventDefault: () => void }) => Promise<void> }).handler;
    await handler?.({ preventDefault: vi.fn() });

    fireEvent.click(await screen.findByText('Exit anyway'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_force_exit_on_close', { enabled: true });
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
