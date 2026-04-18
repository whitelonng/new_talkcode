import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserBridgeService } from '@/services/browser-bridge-service';
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
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('marks external URLs as embedded external mode', async () => {
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
      expect(useBrowserStore.getState().bridgeMode).toBe('externalNativeControlled');
      expect(useBrowserStore.getState().bridgeSessionMeta.isExternalPage).toBe(true);
      expect(useBrowserStore.getState().bridgeSessionMeta.supportsNativeHost).toBe(true);
    });
  });

  it('disables picker for non-localhost external URLs', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    const button = await screen.findByRole('button', { name: 'Close Native' });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(browserBridgeService.getSnapshot().bridgeStatus).toBe('closed');
    });
  });

  it('opens devtools from the browser toolbar', async () => {
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue(undefined);

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    const button = screen.getAllByRole('button')[2];
    await act(async () => {
      fireEvent.click(button as HTMLButtonElement);
    });

    expect(mockInvoke).toHaveBeenCalledWith('open_current_window_devtools');
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

  it('dispatches pressKey bridge command', async () => {
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
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.mode).toBe('externalNativeControlled');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.platform).toBe('windowsWebview2');
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

  it('keeps native session ready when backend returns a different native session id', async () => {
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
      expect(browserBridgeService.getSnapshot().bridgeStatus).toBe('ready');
      expect(browserBridgeService.getSnapshot().bridgeSessionMeta.platform).toBe('windowsWebview2');
    });
  });

  it('renders native session controls for external URLs and refreshes state with active native session id', async () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    expect(await screen.findByText('external-native-controlled')).toBeInTheDocument();
    expect(await screen.findByText('windows-webview2')).toBeInTheDocument();

    await waitFor(() => {
      expect(browserBridgeService.getSnapshot().bridgeStatus).toBe('ready');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh State' }));
    });

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('browser_native_get_state', {
        sessionId: 'native-session-id',
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close Native' }));
    });

    await waitFor(() => {
      expect(browserBridgeService.getSnapshot().bridgeStatus).toBe('closed');
    });
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
