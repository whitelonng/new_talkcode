import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  type BrowserControlErrorCode,
  type BrowserControlNetworkRequestQuery,
  type BrowserNativeCloseSessionRequest,
  type BrowserNativeCloseSessionResponse,
  type BrowserNativeNavigateRequest,
  type BrowserNativeSessionRequest,
  type BrowserNativeSessionResponse,
  type BrowserNativeStateResponse,
} from '@/types/browser-control';
import { logger } from '@/lib/logger';
import {
  buildBrowserBridgeSessionMeta,
  useBrowserStore,
  type BrowserBridgeCommandKind,
  type BrowserBridgeErrorCode,
  type BrowserConsoleEntry,
  type BrowserNetworkEntry,
} from '@/stores/browser-store';

interface BrowserBridgeCommandInput {
  kind: BrowserBridgeCommandKind;
  params?: Record<string, unknown>;
  timeoutMs?: number;
}

interface BrowserBridgeExecuteResult {
  success: boolean;
  commandId: string;
  mode: string;
  data?: unknown;
  error?: string;
  errorCode?: BrowserBridgeErrorCode;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class BrowserBridgeService {
  private pending = new Map<
    string,
    {
      resolve: (result: BrowserBridgeExecuteResult) => void;
      reject: (error: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  openUrl(url: string) {
    useBrowserStore.getState().openBrowserUrl(url);
  }

  getState() {
    return useBrowserStore.getState();
  }

  getSnapshot() {
    const state = useBrowserStore.getState();
    return {
      isBrowserVisible: state.isBrowserVisible,
      sourceType: state.sourceType,
      currentUrl: state.currentUrl,
      currentFilePath: state.currentFilePath,
      bridgeMode: state.bridgeMode,
      bridgeStatus: state.bridgeStatus,
      bridgeCapabilities: state.bridgeCapabilities,
      bridgeSessionMeta: state.bridgeSessionMeta,
      bridgeErrorCode: state.bridgeErrorCode,
      pendingCommandId: state.pendingBridgeCommand?.id ?? null,
      lastBridgeResult: state.lastBridgeResult,
      consoleEntries: state.consoleEntries,
      networkEntries: state.networkEntries,
      bridgeError: state.bridgeError,
    };
  }

  getConsoleEntries(input?: {
    limit?: number;
    level?: BrowserConsoleEntry['level'];
  }): BrowserConsoleEntry[] {
    const entries = useBrowserStore.getState().consoleEntries;
    const filtered = input?.level ? entries.filter((entry) => entry.level === input.level) : entries;
    const limit = input?.limit ?? 50;
    return filtered.slice(-limit);
  }

  getNetworkEntries(input?: {
    limit?: number;
    type?: BrowserNetworkEntry['type'];
    success?: boolean;
  }): BrowserNetworkEntry[] {
    const entries = useBrowserStore.getState().networkEntries;
    const filtered = entries.filter((entry) => {
      if (input?.type && entry.type !== input.type) {
        return false;
      }
      if (typeof input?.success === 'boolean' && entry.success !== input.success) {
        return false;
      }
      return true;
    });
    const limit = input?.limit ?? 50;
    return filtered.slice(-limit);
  }

  findNetworkRequest(query: BrowserControlNetworkRequestQuery): BrowserNetworkEntry | null {
    const requestId = query.requestId?.trim();
    const urlIncludes = query.urlIncludes?.trim().toLowerCase();
    const method = query.method?.trim().toUpperCase();

    const entries = useBrowserStore.getState().networkEntries;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!entry) {
        continue;
      }
      if (requestId && entry.requestId !== requestId) {
        continue;
      }
      if (urlIncludes && !entry.url.toLowerCase().includes(urlIncludes)) {
        continue;
      }
      if (method && entry.method.toUpperCase() !== method) {
        continue;
      }
      if (typeof query.status === 'number' && entry.status !== query.status) {
        continue;
      }
      if (query.type && entry.type !== query.type) {
        continue;
      }
      if (typeof query.success === 'boolean' && entry.success !== query.success) {
        continue;
      }
      return entry;
    }
    return null;
  }

  getNetworkRequestDetail(requestId: string): BrowserNetworkEntry | null {
    const normalizedRequestId = requestId.trim();
    if (!normalizedRequestId) {
      return null;
    }
    const entries = useBrowserStore.getState().networkEntries;
    return entries.find((entry) => entry.requestId === normalizedRequestId) ?? null;
  }

  async executeCommand(input: BrowserBridgeCommandInput): Promise<BrowserBridgeExecuteResult> {
    const state = useBrowserStore.getState();
    const timeoutMs = input.timeoutMs ?? 10000;

    if (!state.isBrowserVisible) {
      throw new Error('Built-in browser is not open.');
    }

    if (state.bridgeStatus !== 'ready') {
      throw new Error(`Browser bridge is not ready. Current status: ${state.bridgeStatus}`);
    }

    if (state.pendingBridgeCommand) {
      throw new Error('Another browser bridge command is still pending.');
    }

    if (
      ['click', 'type', 'snapshot', 'waitFor', 'scroll', 'highlightElement'].includes(input.kind) &&
      !state.bridgeCapabilities.domControl
    ) {
      throw new Error(`Browser bridge command "${input.kind}" is not available for current page.`);
    }

    if (input.kind === 'executeScript' && !state.bridgeCapabilities.scriptExecution) {
      throw new Error('Script execution is not available for current page.');
    }

    const commandId = generateId('browser-command');
    useBrowserStore.getState().setPendingBridgeCommand({
      id: commandId,
      kind: input.kind,
      params: input.params ?? {},
      createdAt: Date.now(),
    });

    logger.info('[BrowserBridge] queued command', {
      commandId,
      kind: input.kind,
      mode: state.bridgeMode,
      sessionMeta: state.bridgeSessionMeta,
    });

    return await new Promise<BrowserBridgeExecuteResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(commandId);
        useBrowserStore
          .getState()
          .rejectBridgeCommand(commandId, 'Browser bridge command timed out.', 'COMMAND_TIMED_OUT');
        reject(new Error('Browser bridge command timed out.'));
      }, timeoutMs);

      this.pending.set(commandId, {
        resolve,
        reject,
        timeoutId,
      });
    });
  }

  resolveCommand(
    commandId: string,
    success: boolean,
    data?: unknown,
    error?: string,
    errorCode?: BrowserBridgeErrorCode
  ) {
    const entry = this.pending.get(commandId);
    useBrowserStore.getState().resolveBridgeCommand({
      commandId,
      success,
      data,
      error,
      errorCode,
    });

    if (!entry) {
      return;
    }

    clearTimeout(entry.timeoutId);
    this.pending.delete(commandId);
    entry.resolve({
      success,
      commandId,
      data,
      error,
      errorCode,
      mode: useBrowserStore.getState().bridgeMode,
    });
  }

  rejectCommand(commandId: string, error: string, errorCode: BrowserBridgeErrorCode = 'COMMAND_FAILED') {
    const entry = this.pending.get(commandId);
    useBrowserStore.getState().rejectBridgeCommand(commandId, error, errorCode);

    if (!entry) {
      return;
    }

    clearTimeout(entry.timeoutId);
    this.pending.delete(commandId);
    entry.reject(new Error(error));
  }

  clearPendingForSessionReset(reason: string) {
    for (const [commandId, entry] of this.pending.entries()) {
      clearTimeout(entry.timeoutId);
      entry.reject(new Error(reason));
      this.pending.delete(commandId);
      useBrowserStore.getState().rejectBridgeCommand(commandId, reason, 'SESSION_RESET');
    }
  }

  async startNativeWindowsSession(
    input: BrowserNativeSessionRequest
  ): Promise<BrowserNativeSessionResponse> {
    const response = await invoke<BrowserNativeSessionResponse>('browser_native_session_start', {
      request: input,
    });
    return response;
  }

  async navigateNativeWindowsSession(
    input: BrowserNativeNavigateRequest
  ): Promise<BrowserNativeStateResponse> {
    return await invoke<BrowserNativeStateResponse>('browser_native_navigate', {
      request: input,
    });
  }

  async closeNativeWindowsSession(
    input: BrowserNativeCloseSessionRequest
  ): Promise<BrowserNativeCloseSessionResponse> {
    return await invoke<BrowserNativeCloseSessionResponse>('browser_native_close_session', {
      request: input,
    });
  }

  async getNativeWindowsState(sessionId: string): Promise<BrowserNativeStateResponse> {
    return await invoke<BrowserNativeStateResponse>('browser_native_get_state', {
      sessionId,
    });
  }

  async listenNativeWindowsState(
    onState: (state: BrowserNativeStateResponse) => void
  ): Promise<UnlistenFn> {
    return await listen<BrowserNativeStateResponse>('browser-native-state-changed', (event) => {
      onState(event.payload);
    });
  }

  getNativeCapabilityError(): BrowserControlErrorCode {
    return 'NATIVE_NOT_IMPLEMENTED';
  }
}

export const browserBridgeService = new BrowserBridgeService();
