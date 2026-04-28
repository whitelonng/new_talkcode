import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { browserBridgeService } from '@/services/browser-bridge-service';
import { repositoryService } from '@/services/repository-service';
import { useBrowserStore } from '@/stores/browser-store';
import { BrowserPanel } from './browser-panel';

const {
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockClipboardWriteText,
  mockSimpleFetch,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockClipboardWriteText: vi.fn(),
  mockSimpleFetch: vi.fn(),
}));

function emitBridgeReady(source: Window, sessionId: string | null, capabilities?: Record<string, string>) {
  window.dispatchEvent(
    new MessageEvent('message', {
      source,
      data: {
        type: 'talkcody-browser-bridge',
        event: 'ready',
        sessionId,
        capabilities:
          capabilities ?? {
            navigation: 'available',
            domRead: 'available',
            domWrite: 'available',
            scriptEval: 'available',
            consoleRead: 'available',
            networkObserve: 'available',
            screenshot: 'unavailable',
            keyboardInput: 'available',
            mouseInput: 'available',
            externalControl: 'unavailable',
          },
      },
    })
  );
}

function emitBridgeRuntimeError(source: Window, sessionId: string | null, error: string) {
  window.dispatchEvent(
    new MessageEvent('message', {
      source,
      data: {
        type: 'talkcody-browser-bridge',
        event: 'runtimeError',
        sessionId,
        error,
      },
    })
  );
}

function markRuntimeReadyForCurrentSession() {
  const sessionId = useBrowserStore.getState().bridgeSessionId;
  if (!sessionId) {
    throw new Error('Missing bridge session id in test setup.');
  }
  browserBridgeService.markBridgeReady(sessionId);
  browserBridgeService.markRuntimeReady(sessionId);
}

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
  },
}));

vi.mock('@/lib/tauri-fetch', () => ({
  simpleFetch: (...args: unknown[]) => mockSimpleFetch(...args),
}));

vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    readFileWithCache: vi.fn(),
  },
}));

vi.mock('@/hooks/use-locale', () => ({
  useTranslation: () => ({
    RepositoryLayout: {
      stylePickerCopied: 'Style information copied to clipboard',
      stylePickerCopyFailed: 'Failed to copy style information',
      stylePickerUrlLimited: 'Style picker currently works for local HTML/SVG previews.',
      browserEmptyState: 'Empty browser state',
      browserAddressPlaceholder: 'Enter URL',
      openBrowser: 'Open',
      refreshBrowser: 'Refresh',
      openDevtools: 'Developer mode',
      closeBrowser: 'Close',
      stylePickerActive: 'Style picker active',
      stylePickerIdle: 'Style picker idle',
      localhostPreviewLoading: 'Loading localhost page for style picking...',
      browserPanelTitle: 'Browser panel',
      browserPanelDescription: 'Preview project pages',
      stylePickerActiveHint: 'Click an element in the preview to copy its styles.',
      stylePickerActivate: 'Activate style picker',
      openDevtoolsFailed: 'Failed to open developer mode',
      localhostPreviewLoadFailed: 'Failed to load localhost preview',
    },
  }),
}));

describe('BrowserPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'browser_native_session_start') {
        return {
          sessionId: 'native-session-id',
          status: 'ready',
          mode: 'externalNativeControlled',
          platform: 'windowsWebview2',
          capabilities: {
            navigation: 'available',
            domRead: 'unavailable',
            domWrite: 'unavailable',
            scriptEval: 'unavailable',
            consoleRead: 'unavailable',
            networkObserve: 'unavailable',
            screenshot: 'unavailable',
            keyboardInput: 'available',
            mouseInput: 'available',
            externalControl: 'available',
          },
        };
      }
      if (command === 'browser_native_get_state') {
        const sessionId = (args as { sessionId: string }).sessionId;
        return {
          sessionId,
          status: 'ready',
          url: 'https://example.com',
          requestedUrl: 'https://example.com',
          title: 'Example',
          mode: 'externalNativeControlled',
          platform: 'windowsWebview2',
          capabilities: {
            navigation: 'available',
            domRead: 'unavailable',
            domWrite: 'unavailable',
            scriptEval: 'unavailable',
            consoleRead: 'unavailable',
            networkObserve: 'unavailable',
            screenshot: 'unavailable',
            keyboardInput: 'available',
            mouseInput: 'available',
            externalControl: 'available',
          },
          createdAt: 1,
          updatedAt: 2,
          lastNavigatedAt: 2,
          closedAt: null,
        };
      }
      if (command === 'browser_native_close_session') {
        return {
          sessionId: (args as { request: { sessionId: string } }).request.sessionId,
          closed: true,
          status: 'closed',
          mode: 'externalNativeControlled',
          platform: 'windowsWebview2',
          capabilities: {
            navigation: 'available',
            domRead: 'unavailable',
            domWrite: 'unavailable',
            scriptEval: 'unavailable',
            consoleRead: 'unavailable',
            networkObserve: 'unavailable',
            screenshot: 'unavailable',
            keyboardInput: 'available',
            mouseInput: 'available',
            externalControl: 'available',
          },
        };
      }
      if (command === 'browser_native_navigate') {
        const request = (args as { request: { sessionId: string; url: string } }).request;
        return {
          sessionId: request.sessionId,
          status: 'ready',
          url: request.url,
          requestedUrl: request.url,
          title: 'Navigated Example',
          mode: 'externalNativeControlled',
          platform: 'windowsWebview2',
          capabilities: {
            navigation: 'available',
            domRead: 'unavailable',
            domWrite: 'unavailable',
            scriptEval: 'unavailable',
            consoleRead: 'unavailable',
            networkObserve: 'unavailable',
            screenshot: 'unavailable',
            keyboardInput: 'available',
            mouseInput: 'available',
            externalControl: 'available',
          },
          createdAt: 1,
          updatedAt: 3,
          lastNavigatedAt: 3,
          closedAt: null,
        };
      }
      return undefined;
    });
    useBrowserStore.setState({
      isBrowserVisible: false,
      activeUtilityTab: 'terminal',
      sourceType: 'none',
      currentUrl: '',
      currentFilePath: null,
      currentContent: null,
      bridgeMode: 'none',
      bridgeStatus: 'idle',
      bridgeSessionId: null,
      bridgeCapabilities: {
        navigation: true,
        domControl: false,
        scriptExecution: false,
        consoleCapture: false,
        domRead: false,
        domWrite: false,
        scriptEval: false,
        consoleRead: false,
        networkObserve: false,
        screenshot: false,
        keyboardInput: false,
        mouseInput: false,
        externalControl: false,
      },
      bridgeSessionMeta: {
        mode: 'none',
        sourceType: 'none',
        platform: 'web',
        url: null,
        filePath: null,
        isExternalPage: false,
        supportsNativeHost: false,
        capabilitySet: {
          navigation: 'available',
          domRead: 'unavailable',
          domWrite: 'unavailable',
          scriptEval: 'unavailable',
          consoleRead: 'unavailable',
          networkObserve: 'unavailable',
          screenshot: 'unavailable',
          keyboardInput: 'unavailable',
          mouseInput: 'unavailable',
          externalControl: 'unavailable',
        },
      },
      pendingBridgeCommand: null,
      lastBridgeResult: null,
      bridgeError: null,
      bridgeErrorCode: null,
      consoleEntries: [],
      networkEntries: [],
    });
    mockClipboardWriteText.mockResolvedValue(undefined);
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue(
      '<html><body><input id="name" /><button id="submit">Go</button></body></html>'
    );
    mockSimpleFetch.mockResolvedValue(
      new Response('<html><body><input id="name" /><button id="submit">Go</button></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    Object.assign(navigator, {
      clipboard: {
        writeText: mockClipboardWriteText,
      },
    });
  });

  it('falls back to ready for file session when runtime handshake does not arrive in time', async () => {
    vi.useFakeTimers();
    try {
      useBrowserStore.setState({
        isBrowserVisible: true,
        activeUtilityTab: 'browser',
        sourceType: 'file',
      });

      render(
        <BrowserPanel
          sourceType="file"
          currentUrl=""
          currentFilePath="/repo/page.html"
          currentContent="<html><body><main>Hello</main></body></html>"
          onOpenUrl={vi.fn()}
        />
      );

      const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: {} as Window,
      });

      await act(async () => {
        fireEvent.load(iframe);
      });

      expect(useBrowserStore.getState().bridgeStatus).toBe('loading');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1300);
      });

      const state = useBrowserStore.getState();
      expect(state.bridgeStatus).toBe('ready');
      expect(state.bridgeMode).toBe('fileControlled');
      expect(state.bridgeCapabilities.domRead).toBe(true);
      expect(state.bridgeCapabilities.domWrite).toBe(true);
      expect(state.bridgeCapabilities.scriptEval).toBe(true);

      expect(logger.warn).toHaveBeenCalledWith(
        '[BrowserPanel] file bridge ready handshake timed out; activating fallback ready state',
        expect.objectContaining({
          currentFilePath: '/repo/page.html',
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not apply file ready fallback after runtime error', async () => {
    vi.useFakeTimers();
    try {
      useBrowserStore.setState({
        isBrowserVisible: true,
        activeUtilityTab: 'browser',
        sourceType: 'file',
      });

      render(
        <BrowserPanel
          sourceType="file"
          currentUrl=""
          currentFilePath="/repo/page.html"
          currentContent="<html><body><main>Hello</main></body></html>"
          onOpenUrl={vi.fn()}
        />
      );

      const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: window,
      });

      await act(async () => {
        fireEvent.load(iframe);
      });

      const sessionId = useBrowserStore.getState().bridgeSessionId;

      await act(async () => {
        emitBridgeRuntimeError(window, sessionId, 'Bridge boot failed');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1300);
      });

      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Bridge boot failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('executes getPageState locally for file preview when iframe document is accessible', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><head><title>Demo Page</title></head><body><main>Hello</main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage, location: { href: 'about:srcdoc' } },
    });
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: document.implementation.createHTMLDocument('Demo Page'),
    });
    iframe.contentDocument!.body.innerHTML = '<main>Hello</main>';

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await expect(
      browserBridgeService.executeCommand({
        kind: 'getPageState',
        params: {},
        timeoutMs: 50,
      })
    ).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({
        title: 'Demo Page',
        readyState: expect.any(String),
        url: 'about:srcdoc',
      }),
    });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('executes snapshot and interactive listing locally for file preview when iframe document is accessible', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><button id="save-btn">Save</button><input id="name" /></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    const fileDoc = document.implementation.createHTMLDocument('File Preview');
    fileDoc.body.innerHTML = '<button id="save-btn">Save</button><input id="name" />';
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage, location: { href: 'about:srcdoc' }, getComputedStyle: window.getComputedStyle.bind(window) },
    });
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: fileDoc,
    });

    const elements = fileDoc.querySelectorAll('*');
    for (const element of elements) {
      Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }),
      });
    }

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await expect(
      browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 50,
      })
    ).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({
        text: expect.stringContaining('Save'),
      }),
    });

    await expect(
      browserBridgeService.executeCommand({
        kind: 'listInteractiveElements',
        params: { limit: 10 },
        timeoutMs: 50,
      })
    ).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'save-btn' }),
        expect.objectContaining({ id: 'name' }),
      ]),
    });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('logs bridge runtime diagnostics from console events', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'console',
            sessionId,
            entry: {
              level: 'info',
              message: '[BridgeRuntime] ready-handshake-attempt attempt=1',
              timestamp: Date.now(),
            },
          },
        })
      );
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[BrowserPanel] browser bridge runtime diagnostic',
      expect.objectContaining({
        sessionId,
        mode: 'fileControlled',
        diagnostic: '[BridgeRuntime] ready-handshake-attempt attempt=1',
      })
    );

    expect(useBrowserStore.getState().consoleEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: '[BridgeRuntime] ready-handshake-attempt attempt=1',
        }),
      ])
    );
  });

  it('logs ignored bridge messages from unexpected source for external sessions', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
    });

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    const transportWindow = { postMessage: vi.fn() } as never as Window;
    const unexpectedWindow = { postMessage: vi.fn() } as never as Window;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: transportWindow,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: unexpectedWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              domRead: 'available',
            },
          },
        })
      );
    });

    expect(logger.warn).toHaveBeenCalledWith(
      '[BrowserPanel] ignored browser bridge message from unexpected source',
      expect.objectContaining({
        eventType: 'ready',
        receivedSessionId: sessionId,
        currentSessionId: sessionId,
      })
    );
  });

  it('logs file session load and ready handshake diagnostics', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[BrowserPanel] file session loaded; waiting for runtime ready handshake',
      expect.objectContaining({
        sessionMode: 'fileControlled',
        sessionSourceType: 'file',
        currentFilePath: '/repo/page.html',
      })
    );

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      emitBridgeReady(window, sessionId);
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[BrowserPanel] browser bridge ready handshake accepted',
      expect.objectContaining({
        sessionId,
        mode: 'fileControlled',
      })
    );
  });

  it('logs ignored bridge messages with stale session id', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId: 'stale-session-id',
            capabilities: {
              domRead: 'available',
            },
          },
        })
      );
    });

    expect(logger.warn).toHaveBeenCalledWith(
      '[BrowserPanel] ignored browser bridge message due to session mismatch',
      expect.objectContaining({
        eventType: 'ready',
        receivedSessionId: 'stale-session-id',
      })
    );
  });

  it('accepts file bridge ready handshake even when message source is not iframe window', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const fakeWindow = {} as Window;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: fakeWindow,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
            },
          },
        })
      );
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('ready');
      expect(useBrowserStore.getState().bridgeMode).toBe('fileControlled');
    });
  });

  it('marks file preview bridge ready after runtime ready message so file:// commands can execute', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    expect(useBrowserStore.getState().bridgeStatus).toBe('loading');

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      fireEvent.load(iframe);
    });

    expect(useBrowserStore.getState().bridgeStatus).toBe('loading');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              navigation: 'available',
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
              networkObserve: 'partial',
              screenshot: 'unavailable',
              keyboardInput: 'partial',
              mouseInput: 'partial',
              externalControl: 'partial',
            },
          },
        })
      );
    });

    await waitFor(() => {
      const state = useBrowserStore.getState();
      expect(state.bridgeStatus).toBe('ready');
      expect(state.bridgeMode).toBe('fileControlled');
      expect(state.bridgeCapabilities.domRead).toBe(true);
      expect(state.bridgeCapabilities.domWrite).toBe(true);
      expect(state.bridgeCapabilities.scriptEval).toBe(true);
    });

    let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      promise = browserBridgeService.executeCommand({
        kind: 'getPageState',
        params: {},
        timeoutMs: 100,
      });
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId,
            commandId: useBrowserStore.getState().pendingBridgeCommand?.id,
            success: true,
            data: {
              title: '',
              readyState: 'complete',
            },
          },
        })
      );
    });

    await expect(promise!).resolves.toMatchObject({
      success: true,
      data: {
        title: '',
        readyState: 'complete',
      },
    });
  });

  it('marks file preview bridge ready on iframe load after session rotation during render', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    useBrowserStore.setState({
      sourceType: 'none',
      bridgeStatus: 'idle',
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    emitBridgeReady(window, useBrowserStore.getState().bridgeSessionId);

    await waitFor(() => {
      const state = useBrowserStore.getState();
      expect(state.bridgeStatus).toBe('ready');
      expect(state.bridgeMode).toBe('fileControlled');
      expect(state.sourceType).toBe('none');
      expect(state.bridgeSessionMeta.sourceType).toBe('file');
    });
  });

  it('does not dispatch file preview commands before runtime ready handshake arrives', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    expect(useBrowserStore.getState().bridgeStatus).toBe('loading');

    await expect(async () =>
      browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 50,
      })
    ).rejects.toThrow('Browser bridge is not ready. Current status: loading');
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('keeps file session ready when store sourceType drifts before iframe load', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    useBrowserStore.setState({
      sourceType: 'none',
      bridgeStatus: 'idle',
      bridgeSessionMeta: {
        ...useBrowserStore.getState().bridgeSessionMeta,
        sourceType: 'file',
        mode: 'fileControlled',
      },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    emitBridgeReady(window, useBrowserStore.getState().bridgeSessionId);

    await waitFor(() => {
      const state = useBrowserStore.getState();
      expect(state.bridgeStatus).toBe('ready');
      expect(state.bridgeMode).toBe('fileControlled');
      expect(state.bridgeSessionMeta.sourceType).toBe('file');
    });
  });

  it('keeps file preview srcDoc stable while toggling picker inspector mode', async () => {
    const { container } = render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/index.html"
        currentContent="<html><body><main class='hero'>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser');
    const initialSrcDoc = iframe.getAttribute('srcdoc');

    expect(initialSrcDoc).toContain('talkcody-style-picker-highlight');
    expect(initialSrcDoc).toContain('talkcody-picker-runtime');

    await act(async () => {
      fireEvent.load(iframe);
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons[3]).toBeDefined();
    await act(async () => {
      fireEvent.click(buttons[3] as HTMLButtonElement);
    });

    expect(screen.getByText('Click an element in the preview to copy its styles.')).toBeInTheDocument();
    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc);
  });

  it('renders file preview with picker injection for HTML files', () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><h1>Test</h1></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser');
    const srcDoc = iframe.getAttribute('srcdoc') || '';

    expect(srcDoc).toContain('talkcody-style-picker-highlight');
    expect(srcDoc).toContain('talkcody-picker-runtime');
    expect(srcDoc).toContain('scheduleBridgeReadyHandshake');
    expect(srcDoc).toContain('<h1>Test</h1>');
  });

  it('copies element info to clipboard on postMessage from iframe', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><h1>Test</h1></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    emitBridgeReady(window, useBrowserStore.getState().bridgeSessionId);

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-picker',
            action: 'picked',
            sessionId,
            summary: 'selector: h1\ntag: h1\ntext: Test',
            selector: 'h1',
            tag: 'h1',
          },
        })
      );
    });

    expect(mockClipboardWriteText).toHaveBeenCalledWith('selector: h1\ntag: h1\ntext: Test');
    expect(mockToastSuccess).toHaveBeenCalledWith('Style information copied to clipboard');
  });

  it('ignores picker message from another session', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><h1>Test</h1></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'talkcody-picker',
            action: 'picked',
            sessionId: 'wrong-session',
            summary: 'selector: h1',
          },
        })
      );
    });

    expect(mockClipboardWriteText).not.toHaveBeenCalled();
  });

  it('switches browser visibility off when leaving browser utility tab', () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      currentFilePath: '/repo/page.html',
      currentContent: '<html><body>Test</body></html>',
    });

    useBrowserStore.getState().setActiveUtilityTab('terminal');

    expect(useBrowserStore.getState().activeUtilityTab).toBe('terminal');
    expect(useBrowserStore.getState().isBrowserVisible).toBe(false);
  });

  it('updates browser visibility based on selected utility tab', () => {
    useBrowserStore.getState().setActiveUtilityTab('browser');

    expect(useBrowserStore.getState().activeUtilityTab).toBe('browser');
    expect(useBrowserStore.getState().isBrowserVisible).toBe(true);

    useBrowserStore.getState().setActiveUtilityTab('terminal');

    expect(useBrowserStore.getState().activeUtilityTab).toBe('terminal');
    expect(useBrowserStore.getState().isBrowserVisible).toBe(false);
  });

  it('loads localhost URL through controllable bridge fetch flow', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="http://localhost:3000"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockSimpleFetch).toHaveBeenCalledWith('http://localhost:3000', {
        method: 'GET',
        headers: {
          'x-talkcody-allow-private-ip': 'true',
        },
      });
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeMode).toBe('localhostControlled');
      expect(useBrowserStore.getState().bridgeSessionMeta.capabilitySet.networkObserve).toBe('partial');
    });
  });

  it('routes file URLs through file preview mode for controllable bridge support', async () => {
    const { browserNavigateTool } = await import('@/lib/tools/browser-navigate-tool');

    const result = await browserNavigateTool.execute({ url: 'file:///C:/repo/test.html' });

    expect(vi.mocked(repositoryService.readFileWithCache)).toHaveBeenCalledWith('C:/repo/test.html');
    expect(result).toMatchObject({
      success: true,
      url: 'file:///C:/repo/test.html',
      filePath: 'C:/repo/test.html',
      message: 'Opened built-in browser file preview: C:/repo/test.html',
    });
    expect(useBrowserStore.getState().sourceType).toBe('file');
    expect(useBrowserStore.getState().currentFilePath).toBe('C:/repo/test.html');
    expect(useBrowserStore.getState().currentContent).toContain('<input id="name" />');
    expect(useBrowserStore.getState().currentUrl).toBe('');
  });

  it('marks external URLs as embedded mode and prepares built-in bridge session', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockSimpleFetch).toHaveBeenCalledWith('https://example.com', {
        method: 'GET',
      });
      expect(useBrowserStore.getState().bridgeMode).toBe('externalEmbedded');
      expect(useBrowserStore.getState().bridgeSessionMeta.isExternalPage).toBe(true);
      expect(useBrowserStore.getState().bridgeSessionMeta.supportsNativeHost).toBe(false);
      expect(useBrowserStore.getState().bridgeStatus).toBe('loading');
      expect(useBrowserStore.getState().bridgeCapabilities.domRead).toBe(true);
      expect(useBrowserStore.getState().bridgeCapabilities.scriptEval).toBe(true);
    });

    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith(
      'browser_native_session_start',
      expect.anything()
    );
  });

  it('renders external URLs inside injected built-in iframe instead of native controls', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toContain('talkcody-picker-runtime');
    expect(browserBridgeService.getSnapshot().bridgeCapabilities.domRead).toBe(true);
    expect(screen.queryByRole('button', { name: 'Close Native' })).not.toBeInTheDocument();
  });

  it('submits a new external URL through the embedded browser path', async () => {
    const onOpenUrl = vi.fn();
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={onOpenUrl}
      />
    );

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeMode).toBe('externalEmbedded');
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter URL');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://talkcody.com' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });

    expect(onOpenUrl).toHaveBeenCalledWith('https://talkcody.com');
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('browser_native_navigate', expect.anything());
  });

  it('keeps external URL bridge loading until ready handshake arrives', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    expect(useBrowserStore.getState().bridgeStatus).toBe('loading');
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
    });

    await expect(
      Promise.resolve().then(() =>
        browserBridgeService.executeCommand({
          kind: 'getPageState',
          params: {},
          timeoutMs: 100,
        })
      )
    ).rejects.toThrow('Browser bridge is not ready. Current status: loading');

    expect(postMessage).not.toHaveBeenCalled();

    const sessionId = useBrowserStore.getState().bridgeSessionId;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              navigation: 'available',
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
              networkObserve: 'partial',
              keyboardInput: 'partial',
              mouseInput: 'partial',
              externalControl: 'partial',
            },
          },
        })
      );
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('ready');
      expect(useBrowserStore.getState().bridgeSessionMeta.mode).toBe('externalEmbedded');
      expect(useBrowserStore.getState().bridgeCapabilities.domRead).toBe(true);
    });

    let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      promise = browserBridgeService.executeCommand({
        kind: 'getPageState',
        params: {},
        timeoutMs: 100,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    const payload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
    };

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: payload.sessionId,
            commandId: payload.commandId,
            success: true,
            data: { ok: true },
          },
        })
      );
    });

    await expect(promise!).resolves.toMatchObject({ success: true, data: { ok: true } });
  });

  it('marks external embedded bridge as runtime-not-ready when ready handshake never arrives', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
    });

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    expect(useBrowserStore.getState().bridgeStatus).toBe('error');
    expect(useBrowserStore.getState().bridgeErrorCode).toBe('BRIDGE_RUNTIME_NOT_READY');
    expect(useBrowserStore.getState().bridgeError).toContain(
      'External embedded bridge ready handshake did not arrive in time.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[BrowserPanel] embedded bridge ready handshake timed out',
      expect.objectContaining({
        mode: 'externalEmbedded',
        currentUrl: 'https://example.com',
      })
    );
  });

  it('clears embedded ready timeout after ready handshake arrives', async () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
    });

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              navigation: 'available',
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
              networkObserve: 'partial',
              keyboardInput: 'partial',
              mouseInput: 'partial',
              externalControl: 'partial',
            },
          },
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    expect(useBrowserStore.getState().bridgeStatus).toBe('ready');
    expect(useBrowserStore.getState().bridgeError).toBeNull();
  });

  it('marks bridge as error when runtime reports initialization failure before ready', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      emitBridgeRuntimeError(window, sessionId, 'Bridge init crashed');
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Bridge init crashed');
      expect(useBrowserStore.getState().bridgeErrorCode).toBe('BRIDGE_RUNTIME_ERROR');
    });

    await expect(
      Promise.resolve().then(() =>
        browserBridgeService.executeCommand({
          kind: 'getPageState',
          params: {},
          timeoutMs: 100,
        })
      )
    ).rejects.toThrow('Browser bridge is not ready. Current status: error');
  });

  it('keeps bridge in error state after runtime error even if a late ready event arrives', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    const transportWindow = { postMessage: vi.fn() } as never as Window;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: transportWindow,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      emitBridgeRuntimeError(transportWindow, sessionId, 'Bridge boot failed');
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Bridge boot failed');
    });

    await act(async () => {
      emitBridgeReady(transportWindow, sessionId, {
        navigation: 'available',
        domRead: 'available',
        domWrite: 'available',
        scriptEval: 'available',
        consoleRead: 'available',
        networkObserve: 'partial',
        keyboardInput: 'partial',
        mouseInput: 'partial',
        externalControl: 'partial',
      });
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Bridge boot failed');
      expect(useBrowserStore.getState().bridgeErrorCode).toBe('BRIDGE_RUNTIME_ERROR');
    });

    await expect(
      Promise.resolve().then(() =>
        browserBridgeService.executeCommand({
          kind: 'getPageState',
          params: {},
          timeoutMs: 100,
        })
      )
    ).rejects.toThrow('Browser bridge is not ready. Current status: error');
  });


  it('does not let external iframe load reset bridge error back to loading', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    const transportWindow = { postMessage: vi.fn() } as never as Window;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: transportWindow,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      emitBridgeRuntimeError(transportWindow, sessionId, 'Bridge boot failed');
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Bridge boot failed');
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Bridge boot failed');
    });
  });

  it('keeps latest runtime error message when external preview fetch fails before bridge ready', async () => {
    mockSimpleFetch.mockRejectedValueOnce(new Error('Network blocked'));

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('error');
      expect(useBrowserStore.getState().bridgeError).toBe('Network blocked');
      expect(useBrowserStore.getState().bridgeErrorCode).toBe('COMMAND_FAILED');
    });
  });

  it('ignores bridge runtime messages from another iframe source or session', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const transportWindow = { postMessage: vi.fn() } as never as Window;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: transportWindow,
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;

    await act(async () => {
      emitBridgeRuntimeError(window, 'wrong-session', 'Wrong source should be ignored');
      emitBridgeRuntimeError(transportWindow, 'wrong-session', 'Wrong session should be ignored');
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('loading');
      expect(useBrowserStore.getState().bridgeError).toBeNull();
    });
  });

  it('dispatches browser bridge command for external URL after ready event', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Project browser external page') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    const sessionId = useBrowserStore.getState().bridgeSessionId;
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              navigation: 'available',
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
              networkObserve: 'partial',
              keyboardInput: 'partial',
              mouseInput: 'partial',
              externalControl: 'partial',
            },
          },
        })
      );
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('ready');
      expect(useBrowserStore.getState().bridgeCapabilities.domRead).toBe(true);
    });

    let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      promise = browserBridgeService.executeCommand({
        kind: 'getPageState',
        params: {},
        timeoutMs: 100,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    const payload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
      command: { kind: string };
    };

    expect(payload.command.kind).toBe('getPageState');
    expect(browserBridgeService.getActiveCommandSnapshot()).toMatchObject({
      commandId: payload.commandId,
      kind: 'getPageState',
      sessionId: payload.sessionId,
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: payload.sessionId,
            commandId: payload.commandId,
            success: true,
            data: { title: 'Example', url: 'https://example.com' },
          },
        })
      );
    });

    await expect(promise!).resolves.toMatchObject({
      success: true,
      data: { title: 'Example', url: 'https://example.com' },
    });
    expect(browserBridgeService.getActiveCommandSnapshot()).toBeNull();
  });

  it('ignores native state change listeners for embedded external URLs', async () => {
    let nativeStateListener: ((state: {
      sessionId: string;
      status: string;
      url: string | null;
      requestedUrl: string | null;
      title: string | null;
      mode: string;
      platform: string;
      capabilities: Record<string, string>;
      createdAt: number;
      updatedAt: number;
      lastNavigatedAt: number | null;
      closedAt: number | null;
      errorCode?: string;
      error?: string;
    }) => void) | null = null;
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      nativeStateListener = (state) => {
        handler({ payload: state } as never);
      };
      return () => {};
    });

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    });

    expect(vi.mocked(listen)).not.toHaveBeenCalledWith(
      'browser-native-state-changed',
      expect.any(Function)
    );

    await act(async () => {
      nativeStateListener?.({
        sessionId: 'native-session-id',
        status: 'navigating',
        url: 'https://talkcody.com',
        requestedUrl: 'https://talkcody.com',
        title: 'TalkCody',
        mode: 'externalNativeControlled',
        platform: 'windowsWebview2',
        capabilities: {
          navigation: 'available',
          domRead: 'partial',
          domWrite: 'partial',
          scriptEval: 'partial',
          consoleRead: 'partial',
          networkObserve: 'partial',
          screenshot: 'available',
          keyboardInput: 'available',
          mouseInput: 'available',
          externalControl: 'available',
        },
        createdAt: 1,
        updatedAt: 4,
        lastNavigatedAt: 4,
        closedAt: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
      expect(screen.queryByText('title: TalkCody')).not.toBeInTheDocument();
      expect(useBrowserStore.getState().bridgeStatus).toBe('loading');
      expect(useBrowserStore.getState().bridgeSessionMeta.url).toBe('https://example.com');
    });
  });

  it('keeps bridge loading until runtime ready event arrives', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    browserBridgeService.markRuntimeReady('stale-runtime-session');

    await expect(
      Promise.resolve().then(() =>
        browserBridgeService.executeCommand({
          kind: 'snapshot',
          params: {},
        })
      )
    ).rejects.toThrow('Browser bridge runtime is out of sync with the current session.');

    expect(postMessage).not.toHaveBeenCalled();
    expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();

    const sessionId = useBrowserStore.getState().bridgeSessionId;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
              networkObserve: 'available',
              keyboardInput: 'available',
              mouseInput: 'available',
            },
          },
        })
      );
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('ready');
    });

    let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      promise = browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 100,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    const payload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
    };

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: payload.sessionId,
            commandId: payload.commandId,
            success: true,
            data: { ok: true },
          },
        })
      );
    });

    await expect(promise!).resolves.toMatchObject({ success: true });
  });


  it('dispatches browser bridge command and resolves snapshot result', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      promise = browserBridgeService.executeCommand({ kind: 'snapshot', params: {} });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    const payload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
      type: string;
      event: string;
    };

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: payload.sessionId,
            commandId: payload.commandId,
            success: true,
            data: {
              title: 'Demo',
              text: 'Hello',
            },
          },
        })
      );
    });

    await expect(promise!).resolves.toMatchObject({
      success: true,
      data: {
        title: 'Demo',
        text: 'Hello',
      },
    });
  });

  it('rejects immediately when iframe transport is not ready and allows retry afterwards', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: null,
    });

    let firstPromise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      firstPromise = browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 100,
      });
    });

    await expect(firstPromise!).rejects.toThrow('Built-in browser iframe is not ready.');
    expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();
    expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
      success: false,
      errorCode: 'IFRAME_NOT_READY',
    });

    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    let retryPromise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      retryPromise = browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 100,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    const payload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
    };

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: payload.sessionId,
            commandId: payload.commandId,
            success: true,
            data: { ok: true },
          },
        })
      );
    });

    await expect(retryPromise!).resolves.toMatchObject({ success: true });
  });

  it('releases pending command after timeout and allows next command', async () => {
    vi.useFakeTimers();
    try {
      render(
        <BrowserPanel
          sourceType="file"
          currentUrl=""
          currentFilePath="/repo/page.html"
          currentContent="<html><body><main>Hello</main></body></html>"
          onOpenUrl={vi.fn()}
        />
      );

      const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
      const postMessage = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: { postMessage },
      });

      await act(async () => {
        fireEvent.load(iframe);
      });

      useBrowserStore.setState({
        isBrowserVisible: true,
        activeUtilityTab: 'browser',
        sourceType: 'file',
        bridgeStatus: 'ready',
        bridgeCapabilities: {
          navigation: true,
          domControl: true,
          scriptExecution: true,
          consoleCapture: true,
          domRead: true,
          domWrite: true,
          scriptEval: true,
          consoleRead: true,
          networkObserve: true,
          screenshot: false,
          keyboardInput: true,
          mouseInput: true,
          externalControl: false,
        },
      });
      markRuntimeReadyForCurrentSession();

      let timedOutPromise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
      await act(async () => {
        timedOutPromise = browserBridgeService.executeCommand({
          kind: 'snapshot',
          params: {},
          timeoutMs: 20,
        });
      });

      expect(useBrowserStore.getState().pendingBridgeCommand).not.toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(25);
      });

      await expect(timedOutPromise!).rejects.toThrow('Browser bridge command timed out.');
      expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();
      expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
        success: false,
        errorCode: 'COMMAND_TIMED_OUT',
      });

      postMessage.mockClear();
      let nextPromise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
      await act(async () => {
        markRuntimeReadyForCurrentSession();
        nextPromise = browserBridgeService.executeCommand({
          kind: 'snapshot',
          params: {},
          timeoutMs: 50,
        });
      });

      expect(useBrowserStore.getState().pendingBridgeCommand).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(postMessage).toHaveBeenCalled();

      const payload = postMessage.mock.calls[0][0] as {
        commandId: string;
        sessionId: string;
      };

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: iframe.contentWindow,
            data: {
              type: 'talkcody-browser-bridge',
              event: 'result',
              sessionId: payload.sessionId,
              commandId: payload.commandId,
              success: true,
              data: { ok: true },
            },
          })
        );
      });

      await expect(nextPromise!).resolves.toMatchObject({ success: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases pending command on session reset and ignores stale result afterwards', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    let firstPromise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      firstPromise = browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 50,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    const firstPayload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
    };

    await act(async () => {
      browserBridgeService.clearPendingForSessionReset('Browser bridge session changed.');
    });

    await expect(firstPromise!).rejects.toThrow('Browser bridge session changed.');
    expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();
    expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
      commandId: firstPayload.commandId,
      success: false,
      errorCode: 'SESSION_RESET',
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: firstPayload.sessionId,
            commandId: firstPayload.commandId,
            success: true,
            data: { stale: true },
          },
        })
      );
    });

    expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
      commandId: firstPayload.commandId,
      success: false,
      errorCode: 'SESSION_RESET',
    });

    postMessage.mockClear();
    let secondPromise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      markRuntimeReadyForCurrentSession();
      secondPromise = browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 50,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    const secondPayload = postMessage.mock.calls[0][0] as {
      commandId: string;
      sessionId: string;
    };

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'result',
            sessionId: secondPayload.sessionId,
            commandId: secondPayload.commandId,
            success: true,
            data: { ok: true },
          },
        })
      );
    });

    await expect(secondPromise!).resolves.toMatchObject({ success: true });
  });

  it('clears runtime ready state after session reset and requires ready handshake again', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();
    markRuntimeReadyForCurrentSession();

    const sessionId = useBrowserStore.getState().bridgeSessionId;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            type: 'talkcody-browser-bridge',
            event: 'ready',
            sessionId,
            capabilities: {
              domRead: 'available',
              domWrite: 'available',
              scriptEval: 'available',
              consoleRead: 'available',
              networkObserve: 'available',
              keyboardInput: 'available',
              mouseInput: 'available',
            },
          },
        })
      );
    });

    await waitFor(() => {
      expect(useBrowserStore.getState().bridgeStatus).toBe('ready');
    });

    await act(async () => {
      browserBridgeService.clearPendingForSessionReset('Browser bridge session changed.');
    });

    await act(async () => {
      browserBridgeService.markRuntimeReady('stale-runtime-session');
    });

    await expect(
      Promise.resolve().then(() =>
        browserBridgeService.executeCommand({
          kind: 'snapshot',
          params: {},
        })
      )
    ).rejects.toThrow('Browser bridge runtime is out of sync with the current session.');

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('reads console entries from browser bridge service without dispatching iframe command', () => {
    useBrowserStore.setState({
      consoleEntries: [
        { level: 'log', message: 'hello', timestamp: 1 },
        { level: 'error', message: 'boom', timestamp: 2 },
      ],
    });

    expect(browserBridgeService.getConsoleEntries({ limit: 10 })).toEqual([
      { level: 'log', message: 'hello', timestamp: 1 },
      { level: 'error', message: 'boom', timestamp: 2 },
    ]);

    expect(browserBridgeService.getConsoleEntries({ limit: 10, level: 'error' })).toEqual([
      { level: 'error', message: 'boom', timestamp: 2 },
    ]);
  });

  it('supports reading only console error entries from browser bridge service store', () => {
    useBrowserStore.setState({
      consoleEntries: [
        { level: 'log', message: 'hello', timestamp: 1 },
        { level: 'warn', message: 'careful', timestamp: 2 },
        { level: 'error', message: 'boom', timestamp: 3 },
      ],
    });

    expect(browserBridgeService.getConsoleEntries({ limit: 10, level: 'error' })).toEqual([
      { level: 'error', message: 'boom', timestamp: 3 },
    ]);
  });

  it('clears console entries from browser bridge service store', () => {
    useBrowserStore.setState({
      consoleEntries: [
        { level: 'log', message: 'hello', timestamp: 1 },
        { level: 'error', message: 'boom', timestamp: 2 },
      ],
    });

    useBrowserStore.getState().clearConsoleEntries();

    expect(browserBridgeService.getConsoleEntries({ limit: 10 })).toEqual([]);
  });

  it('reads network entries from browser bridge service store', () => {
    useBrowserStore.setState({
      networkEntries: [
        {
          requestId: 'req-1',
          url: 'https://example.com/a',
          method: 'GET',
          status: 200,
          type: 'fetch',
          startedAt: 1,
          durationMs: 30,
          success: true,
        },
        {
          requestId: 'req-2',
          url: 'https://example.com/b',
          method: 'POST',
          status: 500,
          type: 'xhr',
          startedAt: 2,
          durationMs: 40,
          success: false,
          error: 'boom',
        },
      ],
    });

    expect(browserBridgeService.getNetworkEntries({ limit: 10 })).toEqual([
      {
        requestId: 'req-1',
        url: 'https://example.com/a',
        method: 'GET',
        status: 200,
        type: 'fetch',
        startedAt: 1,
        durationMs: 30,
        success: true,
      },
      {
        requestId: 'req-2',
        url: 'https://example.com/b',
        method: 'POST',
        status: 500,
        type: 'xhr',
        startedAt: 2,
        durationMs: 40,
        success: false,
        error: 'boom',
      },
    ]);

    expect(browserBridgeService.getNetworkEntries({ limit: 10, type: 'xhr' })).toEqual([
      {
        requestId: 'req-2',
        url: 'https://example.com/b',
        method: 'POST',
        status: 500,
        type: 'xhr',
        startedAt: 2,
        durationMs: 40,
        success: false,
        error: 'boom',
      },
    ]);
  });

  it('clears network entries from browser bridge service store', () => {
    useBrowserStore.setState({
      networkEntries: [
        {
          requestId: 'req-1',
          url: 'https://example.com/a',
          method: 'GET',
          status: 200,
          type: 'fetch',
          startedAt: 1,
          durationMs: 30,
          success: true,
        },
      ],
    });

    useBrowserStore.getState().clearNetworkEntries();

    expect(browserBridgeService.getNetworkEntries({ limit: 10 })).toEqual([]);
  });

  it('dispatches highlightElement bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><main id="app">Hello</main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'highlightElement',
          params: { selector: '#app', durationMs: 1500 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'highlightElement',
        params: { selector: '#app', durationMs: 1500 },
      },
    });
  });

  it('dispatches listInteractiveElements bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><button id="save">Save</button></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'listInteractiveElements',
          params: { limit: 10 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'listInteractiveElements',
        params: { limit: 10 },
      },
    });
  });

  it('dispatches pressKey bridge command metadata in embedded external mode', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.mode).toBe('externalEmbedded');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.platform).toBe('web');
    });
  });

  it('dispatches getPageState bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><main>Hello</main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'getPageState',
          params: {},
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'getPageState',
        params: {},
      },
    });
  });

  it('dispatches waitForNavigation bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><main>Wait Nav</main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'waitForNavigation',
          params: { urlIncludes: 'target', timeoutMs: 500, pollIntervalMs: 50 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'waitForNavigation',
        params: { urlIncludes: 'target', timeoutMs: 500, pollIntervalMs: 50 },
      },
    });
  });

  it('dispatches waitForText bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><main>Hello</main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'waitForText',
          params: { text: 'Hello', timeoutMs: 20, pollIntervalMs: 5 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'waitForText',
        params: { text: 'Hello', timeoutMs: 20, pollIntervalMs: 5 },
      },
    });
  });

  it('dispatches waitForElementState bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><button id="save">Save</button></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'waitForElementState',
          params: { selector: '#save', state: 'visible', timeoutMs: 20, pollIntervalMs: 5 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'waitForElementState',
        params: { selector: '#save', state: 'visible', timeoutMs: 20, pollIntervalMs: 5 },
      },
    });
  });

  it('dispatches queryElements bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><button class="item">One</button><button class="item">Two</button></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'queryElements',
          params: { selector: '.item', limit: 10 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'queryElements',
        params: { selector: '.item', limit: 10 },
      },
    });
  });

  it('dispatches getDomTree bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><main id="app"><section><button>Save</button></section></main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'getDomTree',
          params: { selector: '#app', maxDepth: 3, maxChildren: 10 },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'getDomTree',
        params: { selector: '#app', maxDepth: 3, maxChildren: 10 },
      },
    });
  });

  it('dispatches clickByText bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><button>Save changes</button></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'clickByText',
          params: { text: 'Save', exact: false, caseSensitive: false },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'clickByText',
        params: { text: 'Save', exact: false, caseSensitive: false },
      },
    });
  });

  it('dispatches fillForm bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={
          '<html><body><form id="f"><input id="email" /><input id="agree" type="checkbox" /><select id="role"><option value="user">User</option><option value="admin">Admin</option></select></form></body></html>'
        }
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'fillForm',
          params: {
            fields: [
              { selector: '#email', value: 'user@example.com' },
              { selector: '#agree', checked: true },
              { selector: '#role', optionValue: 'admin' },
            ],
            submit: false,
          },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'fillForm',
        params: {
          fields: [
            { selector: '#email', value: 'user@example.com' },
            { selector: '#agree', checked: true },
            { selector: '#role', optionValue: 'admin' },
          ],
          submit: false,
        },
      },
    });
  });

  it('finds matching network request from browser bridge service store', () => {
    useBrowserStore.setState({
      networkEntries: [
        {
          requestId: 'req-1',
          url: 'https://api.example.com/users',
          method: 'GET',
          status: 200,
          type: 'fetch',
          requestHeaders: { accept: 'application/json' },
          requestBodyPreview: null,
          responseHeaders: { 'content-type': 'application/json' },
          responseBodyPreview: '{"items":[]}',
          startedAt: 1,
          durationMs: 12,
          success: true,
          error: null,
        },
        {
          requestId: 'req-2',
          url: 'https://api.example.com/login',
          method: 'POST',
          status: 401,
          type: 'xhr',
          requestHeaders: { 'content-type': 'application/json' },
          requestBodyPreview: '{"email":"test@example.com"}',
          responseHeaders: { 'content-type': 'application/json' },
          responseBodyPreview: '{"error":"unauthorized"}',
          startedAt: 2,
          durationMs: 30,
          success: false,
          error: 'Unauthorized',
        },
      ],
    });

    const matched = browserBridgeService.findNetworkRequest({
      urlIncludes: 'login',
      method: 'post',
      success: false,
    });

    expect(matched).toMatchObject({
      requestId: 'req-2',
      url: 'https://api.example.com/login',
      method: 'POST',
      status: 401,
      type: 'xhr',
      success: false,
    });
  });

  it('returns network request detail by request id from browser bridge service store', () => {
    useBrowserStore.setState({
      networkEntries: [
        {
          requestId: 'req-detail',
          url: 'https://api.example.com/report',
          method: 'POST',
          status: 500,
          type: 'fetch',
          requestHeaders: { 'content-type': 'application/json' },
          requestBodyPreview: '{"query":"status"}',
          responseHeaders: { 'content-type': 'application/json' },
          responseBodyPreview: '{"error":"boom"}',
          startedAt: 10,
          durationMs: 45,
          success: false,
          error: 'Server error',
        },
      ],
    });

    expect(browserBridgeService.getNetworkRequestDetail('req-detail')).toMatchObject({
      requestId: 'req-detail',
      url: 'https://api.example.com/report',
      method: 'POST',
      requestBodyPreview: '{"query":"status"}',
      responseBodyPreview: '{"error":"boom"}',
      error: 'Server error',
    });
    expect(browserBridgeService.getNetworkRequestDetail('missing-request')).toBeNull();
  });

  it('dispatches evaluateExpression bridge command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><main>Eval</main></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    await act(async () => {
      void browserBridgeService
        .executeCommand({
          kind: 'evaluateExpression',
          params: { expression: 'document.title' },
          timeoutMs: 20,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'talkcody-browser-bridge',
      event: 'command',
      command: {
        kind: 'evaluateExpression',
        params: { expression: 'document.title' },
      },
    });
  });

  it('dispatches focus/blur/hover/select/check/uncheck bridge commands', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent={'<html><body><input id="name" /><select id="role"><option value="user">User</option></select><input id="agree" type="checkbox" /></body></html>'}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    const commands = [
      { kind: 'focus', params: { selector: '#name' } },
      { kind: 'blur', params: { selector: '#name' } },
      { kind: 'hover', params: { selector: '#name' } },
      { kind: 'selectOption', params: { selector: '#role', value: 'user' } },
      { kind: 'check', params: { selector: '#agree' } },
      { kind: 'uncheck', params: { selector: '#agree' } },
    ] as const;

    for (const command of commands) {
      postMessage.mockClear();
      let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
      await act(async () => {
        markRuntimeReadyForCurrentSession();
        promise = browserBridgeService.executeCommand({
          kind: command.kind,
          params: command.params,
          timeoutMs: 20,
        });
      });

      await waitFor(() => {
        expect(postMessage).toHaveBeenCalled();
      });

      const payload = postMessage.mock.calls[0][0] as {
        commandId: string;
        sessionId: string;
      };

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: iframe.contentWindow,
            data: {
              type: 'talkcody-browser-bridge',
              event: 'result',
              sessionId: payload.sessionId,
              commandId: payload.commandId,
              success: true,
              data: { ok: true },
            },
          })
        );
      });

      await expect(promise!).resolves.toMatchObject({ success: true });

      expect(postMessage.mock.calls[0][0]).toMatchObject({
        type: 'talkcody-browser-bridge',
        event: 'command',
        command,
      });
    }
  });

  it('keeps external URLs in embedded mode metadata', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(browserBridgeService.getSnapshot().bridgeStatus).toBe('loading');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.mode).toBe('externalEmbedded');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.platform).toBe('web');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.supportsNativeHost).toBe(false);
    });
  });

  it('rejects pending command when bridge status drops from ready to loading', async () => {
    vi.useFakeTimers();
    try {
      render(
        <BrowserPanel
          sourceType="file"
          currentUrl=""
          currentFilePath="/repo/page.html"
          currentContent="<html><body><main>Hello</main></body></html>"
          onOpenUrl={vi.fn()}
        />
      );

      const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
      const postMessage = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: { postMessage },
      });

      await act(async () => {
        fireEvent.load(iframe);
      });

      useBrowserStore.setState({
        isBrowserVisible: true,
        activeUtilityTab: 'browser',
        sourceType: 'file',
        bridgeStatus: 'ready',
        bridgeCapabilities: {
          navigation: true,
          domControl: true,
          scriptExecution: true,
          consoleCapture: true,
          domRead: true,
          domWrite: true,
          scriptEval: true,
          consoleRead: true,
          networkObserve: true,
          screenshot: false,
          keyboardInput: true,
          mouseInput: true,
          externalControl: false,
        },
      });
      markRuntimeReadyForCurrentSession();

      let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
      await act(async () => {
        promise = browserBridgeService.executeCommand({
          kind: 'snapshot',
          params: {},
          timeoutMs: 100,
        });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(postMessage).toHaveBeenCalled();
      expect(useBrowserStore.getState().pendingBridgeCommand).not.toBeNull();

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: iframe.contentWindow,
            data: {
              type: 'talkcody-browser-bridge',
              event: 'ready',
              sessionId: useBrowserStore.getState().bridgeSessionId,
              capabilities: {
                navigation: 'available',
                domRead: 'available',
                domWrite: 'available',
                scriptEval: 'available',
                consoleRead: 'available',
                networkObserve: 'partial',
                screenshot: 'unavailable',
                keyboardInput: 'partial',
                mouseInput: 'partial',
                externalControl: 'partial',
              },
            },
          })
        );
      });

      await act(async () => {
        useBrowserStore.getState().setBridgeStatus('loading');
        browserBridgeService.handleBridgeStatusChange('loading');
      });

      await expect(promise!).rejects.toThrow('Browser bridge is not ready. Current status: loading');
      expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();
      expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
        success: false,
        errorCode: 'BRIDGE_NOT_READY',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows capability-unavailable error to surface before pending-command error', () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      bridgeSessionId: 'session-capability-check',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: false,
        scriptExecution: false,
        consoleCapture: false,
        domRead: false,
        domWrite: false,
        scriptEval: false,
        consoleRead: false,
        networkObserve: false,
        screenshot: false,
        keyboardInput: false,
        mouseInput: false,
        externalControl: false,
      },
      pendingBridgeCommand: {
        id: 'pending-command',
        kind: 'getPageState',
        params: {},
        createdAt: Date.now(),
      },
    });

    browserBridgeService.markBridgeReady('session-capability-check');
    browserBridgeService.markRuntimeReady('session-capability-check');

    expect(() =>
      browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
      })
    ).toThrow('Browser bridge command "snapshot" is not available for current page.');
  });

  it('recovers from stale pending state before executing a new command', () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      bridgeSessionId: 'session-ready',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
      pendingBridgeCommand: {
        id: 'stale-command',
        kind: 'snapshot',
        params: {},
        createdAt: Date.now(),
      },
    });

    browserBridgeService.markBridgeReady('session-ready');
    browserBridgeService.markRuntimeReady('session-ready');

    const promise = browserBridgeService.executeCommand({
      kind: 'getPageState',
      params: {},
      timeoutMs: 1000,
    });

    expect(useBrowserStore.getState().bridgeErrorCode).toBeNull();
    expect(useBrowserStore.getState().pendingBridgeCommand?.kind).toBe('getPageState');

    browserBridgeService.rejectCommand(useBrowserStore.getState().pendingBridgeCommand?.id ?? '', 'Manual cleanup');

    return expect(promise).rejects.toThrow('Manual cleanup');
  });

  it('returns runtime error details when bridge status is ready but runtime already failed', () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      bridgeSessionId: 'session-runtime-error',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });

    browserBridgeService.markBridgeReady('session-runtime-error');
    browserBridgeService.handleBridgeStatusChange('error', 'Bridge runtime crashed', 'BRIDGE_RUNTIME_ERROR');

    expect(() =>
      browserBridgeService.executeCommand({
        kind: 'getPageState',
        params: {},
      })
    ).toThrow('Bridge runtime crashed');
  });

  it('returns runtime initializing error when runtime is missing for the current session and no ready handshake exists', () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      bridgeSessionId: 'session-runtime-loading',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });

    browserBridgeService.syncSession('session-runtime-loading');

    expect(() =>
      browserBridgeService.executeCommand({
        kind: 'getNetworkLogs',
        params: {},
      })
    ).toThrow('Browser bridge ready handshake has not arrived yet.');
  });

  it('uses runtime error code when bridge status change rejects an active command', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><main>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      fireEvent.load(iframe);
    });

    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      bridgeStatus: 'ready',
      bridgeCapabilities: {
        navigation: true,
        domControl: true,
        scriptExecution: true,
        consoleCapture: true,
        domRead: true,
        domWrite: true,
        scriptEval: true,
        consoleRead: true,
        networkObserve: true,
        screenshot: false,
        keyboardInput: true,
        mouseInput: true,
        externalControl: false,
      },
    });
    markRuntimeReadyForCurrentSession();

    let promise: Promise<Awaited<ReturnType<typeof browserBridgeService.executeCommand>>>;
    await act(async () => {
      promise = browserBridgeService.executeCommand({
        kind: 'snapshot',
        params: {},
        timeoutMs: 100,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });

    await act(async () => {
      useBrowserStore.getState().setBridgeStatus('error', 'Bridge runtime failed', 'BRIDGE_RUNTIME_ERROR');
      browserBridgeService.handleBridgeStatusChange('error', 'Bridge runtime failed', 'BRIDGE_RUNTIME_ERROR');
    });

    await expect(promise!).rejects.toThrow('Bridge runtime failed');
    expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();
    expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
      success: false,
      errorCode: 'BRIDGE_RUNTIME_ERROR',
      error: 'Bridge runtime failed',
    });
  });

  it('clears store pending state when bridge status changes without tracked pending entry', () => {
    useBrowserStore.setState({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      bridgeSessionId: 'session-ready',
      bridgeStatus: 'ready',
      pendingBridgeCommand: {
        id: 'orphan-command',
        kind: 'snapshot',
        params: {},
        createdAt: Date.now(),
      },
    });

    browserBridgeService.handleBridgeStatusChange('loading');

    expect(useBrowserStore.getState().pendingBridgeCommand).toBeNull();
    expect(useBrowserStore.getState().lastBridgeResult).toMatchObject({
      commandId: 'orphan-command',
      success: false,
      errorCode: 'BRIDGE_NOT_READY',
    });
  });

  it('embeds external URLs instead of starting native session controls', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(browserBridgeService.getSnapshot().bridgeStatus).toBe('loading');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.mode).toBe('externalEmbedded');
      expect(screen.getByTitle('Project browser external page')).toBeInTheDocument();
    });

    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith(
      'browser_native_session_start',
      expect.anything()
    );
    expect(screen.queryByText('external-native-controlled')).not.toBeInTheDocument();
    expect(screen.queryByText('windows-webview2')).not.toBeInTheDocument();
  });

  it('submits URL from address bar on Enter', () => {
    const onOpenUrl = vi.fn();
    render(
      <BrowserPanel
        sourceType="none"
        currentUrl=""
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={onOpenUrl}
      />
    );

    const input = screen.getByPlaceholderText('Enter URL');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onOpenUrl).toHaveBeenCalledWith('http://example.com');
  });

  it('does not normalize URLs that already have protocol', () => {
    const onOpenUrl = vi.fn();
    render(
      <BrowserPanel
        sourceType="none"
        currentUrl=""
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={onOpenUrl}
      />
    );

    const input = screen.getByPlaceholderText('Enter URL');
    fireEvent.change(input, { target: { value: 'https://secure.example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onOpenUrl).toHaveBeenCalledWith('https://secure.example.com');
  });
});
