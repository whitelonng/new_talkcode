import { describe, expect, it, vi } from 'vitest';
import { browserBridgeService } from '@/services/browser-bridge-service';
import {
  buildBrowserControlSessionMeta,
  deriveBrowserControlBooleanCapabilities,
} from '@/types/browser-control';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string, payload: Record<string, unknown>) => {
    if (command === 'browser_native_session_start') {
      return {
        sessionId: (payload.request as { sessionId: string }).sessionId,
        status: 'opening-window',
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
        errorCode: 'NATIVE_NOT_IMPLEMENTED',
        error: 'pending',
      };
    }

    if (command === 'browser_native_close_session') {
      return {
        sessionId: (payload.request as { sessionId: string }).sessionId,
        closed: true,
        status: 'closed',
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
      };
    }

    return {
      sessionId: (payload.request as { url?: string; sessionId?: string } | undefined)?.sessionId ?? payload.sessionId,
      status: 'ready',
      url: (payload.request as { url?: string } | undefined)?.url ?? 'https://example.com/live',
      requestedUrl: (payload.request as { url?: string } | undefined)?.url ?? 'https://example.com/live',
      title: null,
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
      errorCode: 'NATIVE_NOT_IMPLEMENTED',
      error: 'pending',
      createdAt: 1,
      updatedAt: 2,
      lastNavigatedAt: 2,
      closedAt: null,
    };
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, handler: (payload: { payload: unknown }) => void) => {
    handler({
      payload: {
        sessionId: 'session-1',
        status: 'ready',
        url: 'https://example.com/live',
        requestedUrl: 'https://example.com/live',
        title: 'Live',
        mode: 'external-native-controlled',
        platform: 'windows-webview2',
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
        errorCode: 'NATIVE_NOT_IMPLEMENTED',
        error: 'pending',
        createdAt: 1,
        updatedAt: 3,
        lastNavigatedAt: 3,
        closedAt: null,
      },
    });
    return vi.fn();
  }),
}));

describe('browser control protocol types', () => {
  it('builds session meta with default capability fallbacks', () => {
    const meta = buildBrowserControlSessionMeta({
      mode: 'externalNativeControlled',
      sourceType: 'url',
      platform: 'windowsWebview2',
      supportsNativeHost: true,
      capabilitySet: {
        navigation: 'available',
        screenshot: 'available',
      },
    });

    expect(meta.mode).toBe('externalNativeControlled');
    expect(meta.sourceType).toBe('url');
    expect(meta.platform).toBe('windowsWebview2');
    expect(meta.capabilitySet.screenshot).toBe('available');
    expect(meta.capabilitySet.domRead).toBe('unavailable');
  });

  it('derives boolean capability flags from capability states', () => {
    const flags = deriveBrowserControlBooleanCapabilities({
      navigation: 'available',
      domRead: 'partial',
      domWrite: 'unavailable',
      scriptEval: 'partial',
      consoleRead: 'unavailable',
      networkObserve: 'partial',
      screenshot: 'available',
      keyboardInput: 'available',
      mouseInput: 'partial',
      externalControl: 'available',
    });

    expect(flags.navigation).toBe(true);
    expect(flags.domControl).toBe(true);
    expect(flags.domWrite).toBe(false);
    expect(flags.scriptExecution).toBe(true);
    expect(flags.consoleCapture).toBe(false);
    expect(flags.screenshot).toBe(true);
  });

  it('listens to native lifecycle state events', async () => {
    const states: Array<{ sessionId: string; status: string; updatedAt: number }> = [];

    const unlisten = await browserBridgeService.listenNativeWindowsState((state) => {
      states.push({
        sessionId: state.sessionId,
        status: state.status,
        updatedAt: state.updatedAt,
      });
    });

    expect(states).toEqual([
      {
        sessionId: 'session-1',
        status: 'ready',
        updatedAt: 3,
      },
    ]);
    expect(typeof unlisten).toBe('function');
  });
});
