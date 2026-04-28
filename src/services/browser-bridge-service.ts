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

interface BrowserBridgePreflightResult {
  error: string;
  errorCode: BrowserControlErrorCode;
}

interface BrowserBridgeStatusContext {
  status: string;
  error: string | null;
  errorCode: BrowserControlErrorCode | null;
}

interface BrowserBridgeExecuteResult {
  success: boolean;
  commandId: string;
  mode: string;
  data?: unknown;
  error?: string;
  errorCode?: BrowserBridgeErrorCode;
}

interface BrowserBridgeReadyState {
  sessionId: string | null;
  receivedAt: number;
}

interface BrowserBridgeRuntimeState {
  sessionId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  receivedAt: number;
}

interface BrowserBridgeCommandTracker {
  commandId: string;
  kind: BrowserBridgeCommandKind;
  sessionId: string | null;
  startedAt: number;
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

  private currentSessionId: string | null = null;

  private bridgeReadyState: BrowserBridgeReadyState = {
    sessionId: null,
    receivedAt: 0,
  };

  private runtimeState: BrowserBridgeRuntimeState = {
    sessionId: null,
    status: 'idle',
    receivedAt: 0,
  };

  private activeCommand: BrowserBridgeCommandTracker | null = null;

  private lastBridgeStatusContext: BrowserBridgeStatusContext = {
    status: 'idle',
    error: null,
    errorCode: null,
  };

  private deferReject(entry: { reject: (error: Error) => void }, error: Error) {
    queueMicrotask(() => {
      entry.reject(error);
    });
  }

  private removePending(commandId: string) {
    const entry = this.pending.get(commandId);
    if (!entry) {
      return null;
    }
    clearTimeout(entry.timeoutId);
    this.pending.delete(commandId);
    if (this.activeCommand?.commandId === commandId) {
      this.activeCommand = null;
    }
    return entry;
  }

  private resetBridgeReadyState(sessionId: string | null = null) {
    this.bridgeReadyState = {
      sessionId,
      receivedAt: 0,
    };
    this.runtimeState = {
      sessionId,
      status: sessionId ? 'loading' : 'idle',
      receivedAt: 0,
    };
  }

  markBridgeReady(sessionId: string) {
    const receivedAt = Date.now();
    this.bridgeReadyState = {
      sessionId,
      receivedAt,
    };
    this.runtimeState = {
      sessionId,
      status: 'ready',
      receivedAt,
    };
  }

  markRuntimeReady(sessionId: string) {
    this.runtimeState = {
      sessionId,
      status: 'ready',
      receivedAt: Date.now(),
    };
  }

  markRuntimeLoading(sessionId: string | null) {
    this.runtimeState = {
      sessionId,
      status: sessionId ? 'loading' : 'idle',
      receivedAt: sessionId ? Date.now() : 0,
    };

    if (!sessionId || this.bridgeReadyState.sessionId !== sessionId) {
      this.bridgeReadyState = {
        sessionId,
        receivedAt: 0,
      };
    }
  }

  private hasBridgeReadySignal(sessionId: string | null): boolean {
    return !!sessionId && this.bridgeReadyState.sessionId === sessionId && this.bridgeReadyState.receivedAt > 0;
  }

  private isRuntimeReady(sessionId: string | null): boolean {
    return (
      !!sessionId &&
      this.runtimeState.sessionId === sessionId &&
      this.runtimeState.status === 'ready' &&
      this.runtimeState.receivedAt > 0 &&
      this.hasBridgeReadySignal(sessionId)
    );
  }

  private restoreRuntimeReadyForActiveSession(sessionId: string | null) {
    const state = useBrowserStore.getState();
    if (
      !sessionId ||
      state.bridgeSessionId !== sessionId ||
      state.bridgeStatus !== 'ready' ||
      this.activeCommand?.sessionId === sessionId
    ) {
      return;
    }
    this.markBridgeReady(sessionId);
  }

  private getRuntimeNotReadyReason(sessionId: string | null): BrowserBridgePreflightResult {
    if (!sessionId) {
      return {
        error: 'Browser bridge session is missing.',
        errorCode: 'BRIDGE_NOT_READY',
      };
    }

    if (this.runtimeState.sessionId !== sessionId) {
      return {
        error: 'Browser bridge runtime is out of sync with the current session.',
        errorCode: 'SESSION_RESET',
      };
    }

    if (this.runtimeState.status === 'error') {
      return {
        error:
          this.lastBridgeStatusContext.error ?? 'Browser bridge runtime failed before becoming ready.',
        errorCode: this.lastBridgeStatusContext.errorCode ?? 'BRIDGE_RUNTIME_ERROR',
      };
    }

    if (!this.hasBridgeReadySignal(sessionId)) {
      return {
        error: 'Browser bridge ready handshake has not arrived yet.',
        errorCode: 'BRIDGE_NOT_READY',
      };
    }

    return {
      error: 'Browser bridge runtime is still initializing.',
      errorCode: 'BRIDGE_RUNTIME_NOT_READY',
    };
  }

  private getCapabilityError(input: BrowserBridgeCommandInput): BrowserBridgePreflightResult | null {
    const state = useBrowserStore.getState();

    if (
      [
        'click',
        'clickByText',
        'type',
        'fillForm',
        'snapshot',
        'waitFor',
        'scroll',
        'highlightElement',
      ].includes(input.kind) &&
      !state.bridgeCapabilities.domControl
    ) {
      return {
        error: `Browser bridge command "${input.kind}" is not available for current page.`,
        errorCode: 'CAPABILITY_UNAVAILABLE',
      };
    }

    if (input.kind === 'executeScript' && !state.bridgeCapabilities.scriptExecution) {
      return {
        error: 'Script execution is not available for current page.',
        errorCode: 'SCRIPT_EXECUTION_UNAVAILABLE',
      };
    }

    return null;
  }

  private getPreflightError(input: BrowserBridgeCommandInput): BrowserBridgePreflightResult | null {
    const state = useBrowserStore.getState();

    if (!state.isBrowserVisible) {
      return {
        error: 'Built-in browser is not open.',
        errorCode: 'BROWSER_NOT_OPEN',
      };
    }

    const sessionId = state.bridgeSessionId;

    if (state.bridgeStatus !== 'ready') {
      return {
        error: `Browser bridge is not ready. Current status: ${state.bridgeStatus}`,
        errorCode: 'BRIDGE_NOT_READY',
      };
    }

    if (!this.isRuntimeReady(sessionId)) {
      const canProceedWithDeferredRuntime =
        !!sessionId &&
        this.runtimeState.sessionId === sessionId &&
        this.runtimeState.status === 'loading' &&
        this.hasBridgeReadySignal(sessionId);

      if (!canProceedWithDeferredRuntime) {
        return this.getRuntimeNotReadyReason(sessionId);
      }
    }

    const capabilityError = this.getCapabilityError(input);
    if (capabilityError) {
      return capabilityError;
    }

    if (state.pendingBridgeCommand) {
      const activePending = this.pending.get(state.pendingBridgeCommand.id);
      if (!activePending) {
        useBrowserStore
          .getState()
          .rejectBridgeCommand(
            state.pendingBridgeCommand.id,
            'Recovered from stale browser bridge command state.',
            'SESSION_RESET'
          );
      } else {
        return {
          error: 'Another browser bridge command is still pending.',
          errorCode: 'COMMAND_ALREADY_PENDING',
        };
      }
    }

    return null;
  }

  private updateBridgeStatusContext(
    status: string,
    error?: string | null,
    errorCode?: BrowserControlErrorCode | null
  ) {
    this.lastBridgeStatusContext = {
      status,
      error: error ?? null,
      errorCode: errorCode ?? null,
    };
  }

  openUrl(url: string) {
    useBrowserStore.getState().openBrowserUrl(url);
  }

  openFile(filePath: string, content: string | null) {
    useBrowserStore.getState().openBrowserFile(filePath, content);
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

  executeCommand(input: BrowserBridgeCommandInput): Promise<BrowserBridgeExecuteResult> {
    const timeoutMs = input.timeoutMs ?? 10000;
    const preflightError = this.getPreflightError(input);

    if (preflightError) {
      throw new Error(preflightError.error);
    }

    const state = useBrowserStore.getState();
    const commandId = generateId('browser-command');
    const sessionId = state.bridgeSessionId;
    let settled = false;

    const promise = new Promise<BrowserBridgeExecuteResult>((resolve, reject) => {
      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        callback();
      };

      const timeoutId = setTimeout(() => {
        this.removePending(commandId);
        useBrowserStore
          .getState()
          .rejectBridgeCommand(commandId, 'Browser bridge command timed out.', 'COMMAND_TIMED_OUT');
        queueMicrotask(() => {
          settle(() => reject(new Error('Browser bridge command timed out.')));
        });
      }, timeoutMs);

      this.pending.set(commandId, {
        resolve: (result) => settle(() => resolve(result)),
        reject: (error) => settle(() => reject(error)),
        timeoutId,
      });
    });

    void promise.catch(() => undefined);

    this.activeCommand = {
      commandId,
      kind: input.kind,
      sessionId,
      startedAt: Date.now(),
    };

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
      sessionId,
      sessionMeta: state.bridgeSessionMeta,
    });

    return promise;
  }

  syncSession(sessionId: string | null) {
    if (this.currentSessionId === sessionId) {
      logger.info('[BrowserBridge] syncSession skipped because session did not change', {
        sessionId,
      });
      return;
    }

    logger.info('[BrowserBridge] syncing session', {
      previousSessionId: this.currentSessionId,
      nextSessionId: sessionId,
    });
    this.currentSessionId = sessionId;
    this.resetBridgeReadyState(sessionId);
    this.updateBridgeStatusContext(sessionId ? 'loading' : 'idle');
    if (!sessionId) {
      this.clearPendingForSessionReset('Browser bridge session changed.');
      return;
    }
    this.markRuntimeLoading(sessionId);
  }

  resolveCommand(
    commandId: string,
    success: boolean,
    data?: unknown,
    error?: string,
    errorCode?: BrowserBridgeErrorCode
  ) {
    const sessionId = useBrowserStore.getState().bridgeSessionId;
    const entry = this.removePending(commandId);
    if (!entry) {
      logger.warn('[BrowserBridge] Ignored resolve for stale command', {
        commandId,
        success,
        errorCode,
      });
      return;
    }

    useBrowserStore.getState().resolveBridgeCommand({
      commandId,
      success,
      data,
      error,
      errorCode,
    });
    this.restoreRuntimeReadyForActiveSession(sessionId);

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
    const sessionId = useBrowserStore.getState().bridgeSessionId;
    const entry = this.removePending(commandId);
    if (!entry) {
      logger.warn('[BrowserBridge] Ignored reject for stale command', {
        commandId,
        errorCode,
      });
      return;
    }

    useBrowserStore.getState().rejectBridgeCommand(commandId, error, errorCode);
    if (errorCode !== 'SESSION_RESET' && errorCode !== 'BRIDGE_NOT_READY') {
      this.restoreRuntimeReadyForActiveSession(sessionId);
    }
    this.deferReject(entry, new Error(error));
  }

  getActiveCommandSnapshot() {
    return this.activeCommand ? { ...this.activeCommand } : null;
  }

  clearPendingForSessionReset(reason: string) {
    this.resetBridgeReadyState(this.currentSessionId);
    for (const commandId of Array.from(this.pending.keys())) {
      const entry = this.removePending(commandId);
      if (!entry) {
        continue;
      }
      useBrowserStore.getState().rejectBridgeCommand(commandId, reason, 'SESSION_RESET');
      this.deferReject(entry, new Error(reason));
    }
  }

  handleBridgeStatusChange(
    status: string,
    error?: string | null,
    errorCode?: BrowserControlErrorCode | null
  ) {
    const state = useBrowserStore.getState();

    logger.info('[BrowserBridge] handling bridge status change', {
      status,
      error,
      errorCode,
      storeSessionId: state.bridgeSessionId,
      currentSessionId: this.currentSessionId,
      pendingCommandId: state.pendingBridgeCommand?.id ?? null,
    });

    if (state.bridgeSessionId !== this.currentSessionId) {
      this.syncSession(state.bridgeSessionId);
    }

    this.updateBridgeStatusContext(status, error, errorCode);

    if (status === 'ready') {
      if (state.bridgeSessionId) {
        logger.info('[BrowserBridge] status moved to ready; waiting for runtime result to confirm readiness', {
          sessionId: state.bridgeSessionId,
        });
        this.markRuntimeLoading(state.bridgeSessionId);
      }
      return;
    }

    if (status === 'error' || status === 'failed') {
      this.runtimeState = {
        sessionId: state.bridgeSessionId,
        status: 'error',
        receivedAt: Date.now(),
      };
    } else {
      this.resetBridgeReadyState(state.bridgeSessionId);
    }

    const activePendingCommandId = state.pendingBridgeCommand?.id;
    if (!activePendingCommandId) {
      return;
    }

    const resolvedErrorCode =
      errorCode ??
      (status === 'error' || status === 'failed' ? 'BRIDGE_RUNTIME_ERROR' : 'BRIDGE_NOT_READY');
    const resolvedError =
      error ??
      (status === 'error' || status === 'failed'
        ? 'Browser bridge runtime failed before becoming ready.'
        : `Browser bridge is not ready. Current status: ${status}`);

    logger.warn('[BrowserBridge] rejecting pending command due to bridge status change', {
      commandId: activePendingCommandId,
      status,
      resolvedError,
      resolvedErrorCode,
    });

    const entry = this.removePending(activePendingCommandId);
    if (!entry) {
      useBrowserStore.getState().rejectBridgeCommand(activePendingCommandId, resolvedError, resolvedErrorCode);
      return;
    }

    useBrowserStore.getState().rejectBridgeCommand(activePendingCommandId, resolvedError, resolvedErrorCode);
    this.deferReject(entry, new Error(resolvedError));
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
