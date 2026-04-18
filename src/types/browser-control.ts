export type BrowserControlSourceType = 'none' | 'url' | 'file';
export type BrowserControlMode =
  | 'none'
  | 'fileControlled'
  | 'localhostControlled'
  | 'externalEmbedded'
  | 'externalNativeControlled';
export type BrowserControlStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'navigating'
  | 'initializing'
  | 'opening-window'
  | 'failed'
  | 'closed';
export type BrowserControlPlatform = 'web' | 'windowsWebview2';
export type BrowserControlCapabilityState = 'available' | 'unavailable' | 'partial';
export type BrowserControlErrorCode =
  | 'BROWSER_NOT_OPEN'
  | 'BRIDGE_NOT_READY'
  | 'COMMAND_ALREADY_PENDING'
  | 'CAPABILITY_UNAVAILABLE'
  | 'SCRIPT_EXECUTION_UNAVAILABLE'
  | 'IFRAME_NOT_READY'
  | 'COMMAND_TIMED_OUT'
  | 'SESSION_RESET'
  | 'COMMAND_FAILED'
  | 'NATIVE_NOT_SUPPORTED'
  | 'NATIVE_NOT_IMPLEMENTED';

export interface BrowserControlCapabilitySet {
  navigation: BrowserControlCapabilityState;
  domRead: BrowserControlCapabilityState;
  domWrite: BrowserControlCapabilityState;
  scriptEval: BrowserControlCapabilityState;
  consoleRead: BrowserControlCapabilityState;
  networkObserve: BrowserControlCapabilityState;
  screenshot: BrowserControlCapabilityState;
  keyboardInput: BrowserControlCapabilityState;
  mouseInput: BrowserControlCapabilityState;
  externalControl: BrowserControlCapabilityState;
}

export interface BrowserControlBooleanCapabilities {
  navigation: boolean;
  domControl: boolean;
  scriptExecution: boolean;
  consoleCapture: boolean;
  domRead: boolean;
  domWrite: boolean;
  scriptEval: boolean;
  consoleRead: boolean;
  networkObserve: boolean;
  screenshot: boolean;
  keyboardInput: boolean;
  mouseInput: boolean;
  externalControl: boolean;
}

export interface BrowserControlSessionMeta {
  mode: BrowserControlMode;
  sourceType: BrowserControlSourceType;
  platform: BrowserControlPlatform;
  url: string | null;
  filePath: string | null;
  isExternalPage: boolean;
  supportsNativeHost: boolean;
  capabilitySet: BrowserControlCapabilitySet;
}

export type BrowserControlCommandKind =
  | 'click'
  | 'type'
  | 'executeScript'
  | 'snapshot'
  | 'waitFor'
  | 'scroll'
  | 'highlightElement'
  | 'listInteractiveElements'
  | 'getElementInfo'
  | 'pressKey'
  | 'clearConsole'
  | 'evaluateExpression'
  | 'getNetworkLogs'
  | 'findNetworkRequest'
  | 'getRequestDetail'
  | 'clearNetworkLogs'
  | 'getPageState'
  | 'waitForNavigation'
  | 'waitForText'
  | 'waitForElementState'
  | 'queryElements'
  | 'getDomTree'
  | 'focus'
  | 'blur'
  | 'hover'
  | 'selectOption'
  | 'check'
  | 'uncheck';

export interface BrowserControlCommand {
  id: string;
  kind: BrowserControlCommandKind;
  params: Record<string, unknown>;
  createdAt: number;
}

export interface BrowserControlResult {
  commandId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: BrowserControlErrorCode;
}

export interface BrowserControlConsoleEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface BrowserControlNetworkEntry {
  requestId: string;
  url: string;
  method: string;
  status: number | null;
  type: 'fetch' | 'xhr';
  requestHeaders?: Record<string, string>;
  requestBodyPreview?: string | null;
  responseHeaders?: Record<string, string>;
  responseBodyPreview?: string | null;
  startedAt: number;
  durationMs: number | null;
  success: boolean;
  error?: string | null;
}

export interface BrowserControlNetworkRequestQuery {
  requestId?: string;
  urlIncludes?: string;
  method?: string;
  status?: number;
  type?: BrowserControlNetworkEntry['type'];
  success?: boolean;
}

export interface BrowserControlReadyEvent {
  type: 'talkcody-browser-bridge';
  event: 'ready';
  sessionId: string;
  capabilities: Partial<BrowserControlCapabilitySet>;
}

export interface BrowserControlConsoleEvent {
  type: 'talkcody-browser-bridge';
  event: 'console';
  sessionId: string;
  entry: BrowserControlConsoleEntry;
}

export interface BrowserControlNetworkEvent {
  type: 'talkcody-browser-bridge';
  event: 'network';
  sessionId: string;
  entry: BrowserControlNetworkEntry;
}

export interface BrowserControlResultEvent {
  type: 'talkcody-browser-bridge';
  event: 'result';
  sessionId: string;
  commandId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: BrowserControlErrorCode | null;
}

export interface BrowserControlCommandEnvelope {
  type: 'talkcody-browser-bridge';
  event: 'command';
  sessionId: string;
  commandId: string;
  command: BrowserControlCommand;
}

export type BrowserControlBridgeEvent =
  | BrowserControlReadyEvent
  | BrowserControlConsoleEvent
  | BrowserControlNetworkEvent
  | BrowserControlResultEvent;

export interface BrowserNativeSessionRequest {
  sessionId: string;
  url: string;
  mode: Extract<BrowserControlMode, 'externalNativeControlled'>;
}

export interface BrowserNativeNavigateRequest {
  sessionId: string;
  url: string;
}

export interface BrowserNativeCloseSessionRequest {
  sessionId: string;
}

export interface BrowserNativeCloseSessionResponse {
  sessionId: string;
  closed: boolean;
  status: BrowserControlStatus;
  mode: Extract<BrowserControlMode, 'externalNativeControlled'>;
  platform: BrowserControlPlatform;
  capabilities: BrowserControlCapabilitySet;
  errorCode?: BrowserControlErrorCode;
  error?: string;
}

export interface BrowserNativeSessionResponse {
  sessionId: string;
  status: BrowserControlStatus;
  mode: Extract<BrowserControlMode, 'externalNativeControlled'>;
  platform: BrowserControlPlatform;
  capabilities: BrowserControlCapabilitySet;
  errorCode?: BrowserControlErrorCode;
  error?: string;
}

export interface BrowserNativeStateResponse {
  sessionId: string;
  status: BrowserControlStatus;
  url: string | null;
  requestedUrl: string | null;
  title: string | null;
  mode: BrowserControlMode;
  platform: BrowserControlPlatform;
  capabilities: BrowserControlCapabilitySet;
  errorCode?: BrowserControlErrorCode;
  error?: string;
  createdAt: number;
  updatedAt: number;
  lastNavigatedAt?: number | null;
  closedAt?: number | null;
}

export interface BrowserNativeStateChangedEvent {
  sessionId: string;
  status: BrowserControlStatus;
  url: string | null;
  requestedUrl: string | null;
  title: string | null;
  mode: BrowserControlMode;
  platform: BrowserControlPlatform;
  capabilities: BrowserControlCapabilitySet;
  errorCode?: BrowserControlErrorCode;
  error?: string;
  createdAt: number;
  updatedAt: number;
  lastNavigatedAt?: number | null;
  closedAt?: number | null;
}

export interface BrowserNativeScreenshotRequest {
  sessionId: string;
}

export interface BrowserNativeScreenshotResponse {
  sessionId: string;
  status: BrowserControlStatus;
  mimeType: string | null;
  base64Data: string | null;
  errorCode?: BrowserControlErrorCode;
  error?: string;
}

export const DEFAULT_BROWSER_CONTROL_CAPABILITY_SET: BrowserControlCapabilitySet = {
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
};

export const DEFAULT_BROWSER_CONTROL_SESSION_META: BrowserControlSessionMeta = {
  mode: 'none',
  sourceType: 'none',
  platform: 'web',
  url: null,
  filePath: null,
  isExternalPage: false,
  supportsNativeHost: false,
  capabilitySet: { ...DEFAULT_BROWSER_CONTROL_CAPABILITY_SET },
};

export function deriveBrowserControlBooleanCapabilities(
  capabilitySet: BrowserControlCapabilitySet
): BrowserControlBooleanCapabilities {
  const isAvailable = (value: BrowserControlCapabilityState) => value !== 'unavailable';
  return {
    navigation: isAvailable(capabilitySet.navigation),
    domControl: isAvailable(capabilitySet.domRead) || isAvailable(capabilitySet.domWrite),
    scriptExecution: isAvailable(capabilitySet.scriptEval),
    consoleCapture: isAvailable(capabilitySet.consoleRead),
    domRead: isAvailable(capabilitySet.domRead),
    domWrite: isAvailable(capabilitySet.domWrite),
    scriptEval: isAvailable(capabilitySet.scriptEval),
    consoleRead: isAvailable(capabilitySet.consoleRead),
    networkObserve: isAvailable(capabilitySet.networkObserve),
    screenshot: isAvailable(capabilitySet.screenshot),
    keyboardInput: isAvailable(capabilitySet.keyboardInput),
    mouseInput: isAvailable(capabilitySet.mouseInput),
    externalControl: isAvailable(capabilitySet.externalControl),
  };
}

export function buildBrowserControlSessionMeta(
  meta: Partial<BrowserControlSessionMeta> &
    Pick<BrowserControlSessionMeta, 'mode' | 'sourceType'>
): BrowserControlSessionMeta {
  const capabilitySet = {
    ...DEFAULT_BROWSER_CONTROL_CAPABILITY_SET,
    ...meta.capabilitySet,
  };

  return {
    ...DEFAULT_BROWSER_CONTROL_SESSION_META,
    ...meta,
    capabilitySet,
  };
}
