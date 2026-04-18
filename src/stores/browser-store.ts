import { create } from 'zustand';
import {
  buildBrowserControlSessionMeta,
  DEFAULT_BROWSER_CONTROL_SESSION_META,
  deriveBrowserControlBooleanCapabilities,
  type BrowserControlBooleanCapabilities,
  type BrowserControlCommand,
  type BrowserControlCommandKind,
  type BrowserControlConsoleEntry,
  type BrowserControlErrorCode,
  type BrowserControlMode,
  type BrowserControlNetworkEntry,
  type BrowserControlSessionMeta,
  type BrowserControlSourceType,
  type BrowserControlResult,
  type BrowserControlStatus,
} from '@/types/browser-control';

export type UtilityTab = 'terminal' | 'browser';
export type BrowserSource = BrowserControlSourceType;
export type BrowserBridgeMode = BrowserControlMode;
export type BrowserBridgeStatus = BrowserControlStatus;
export type BrowserBridgeCapabilities = BrowserControlBooleanCapabilities;
export type BrowserBridgeSessionMeta = BrowserControlSessionMeta;
export type BrowserBridgeCommandKind = BrowserControlCommandKind;
export type BrowserBridgeCommand = BrowserControlCommand;
export type BrowserBridgeResult = BrowserControlResult;
export type BrowserConsoleEntry = BrowserControlConsoleEntry;
export type BrowserNetworkEntry = BrowserControlNetworkEntry;
export type BrowserBridgeErrorCode = BrowserControlErrorCode;

const DEFAULT_CAPABILITIES: BrowserBridgeCapabilities = deriveBrowserControlBooleanCapabilities(
  DEFAULT_BROWSER_CONTROL_SESSION_META.capabilitySet
);

interface BrowserState {
  isBrowserVisible: boolean;
  activeUtilityTab: UtilityTab;
  sourceType: BrowserSource;
  currentUrl: string;
  currentFilePath: string | null;
  currentContent: string | null;
  bridgeMode: BrowserBridgeMode;
  bridgeStatus: BrowserBridgeStatus;
  bridgeSessionId: string | null;
  bridgeCapabilities: BrowserBridgeCapabilities;
  bridgeSessionMeta: BrowserBridgeSessionMeta;
  pendingBridgeCommand: BrowserBridgeCommand | null;
  lastBridgeResult: BrowserBridgeResult | null;
  bridgeError: string | null;
  bridgeErrorCode: BrowserBridgeErrorCode | null;
  consoleEntries: BrowserConsoleEntry[];
  networkEntries: BrowserNetworkEntry[];

  setBrowserVisible: (visible: boolean) => void;
  toggleBrowserVisible: () => void;
  setActiveUtilityTab: (tab: UtilityTab) => void;
  openBrowserUrl: (url: string) => void;
  openBrowserFile: (filePath: string, content: string | null) => void;
  setBrowserContent: (content: string | null) => void;
  setBridgeSession: (
    sessionId: string | null,
    status: BrowserBridgeStatus,
    meta: BrowserBridgeSessionMeta
  ) => void;
  setBridgeStatus: (
    status: BrowserBridgeStatus,
    error?: string | null,
    errorCode?: BrowserBridgeErrorCode | null,
    meta?: BrowserBridgeSessionMeta
  ) => void;
  setPendingBridgeCommand: (command: BrowserBridgeCommand | null) => void;
  resolveBridgeCommand: (result: BrowserBridgeResult) => void;
  rejectBridgeCommand: (
    commandId: string,
    error: string,
    errorCode?: BrowserBridgeErrorCode
  ) => void;
  appendConsoleEntry: (entry: BrowserConsoleEntry) => void;
  clearConsoleEntries: () => void;
  appendNetworkEntry: (entry: BrowserNetworkEntry) => void;
  clearNetworkEntries: () => void;
}

export function buildBrowserBridgeSessionMeta(
  meta: Partial<BrowserBridgeSessionMeta> & Pick<BrowserBridgeSessionMeta, 'mode' | 'sourceType'>
): BrowserBridgeSessionMeta {
  return buildBrowserControlSessionMeta(meta);
}

function resetBridgeState() {
  return {
    bridgeMode: 'none' as BrowserBridgeMode,
    bridgeStatus: 'idle' as BrowserBridgeStatus,
    bridgeSessionId: null,
    bridgeCapabilities: { ...DEFAULT_CAPABILITIES },
    bridgeSessionMeta: buildBrowserControlSessionMeta({ mode: 'none', sourceType: 'none' }),
    pendingBridgeCommand: null,
    lastBridgeResult: null,
    bridgeError: null,
    bridgeErrorCode: null,
    consoleEntries: [],
    networkEntries: [],
  };
}

export const useBrowserStore = create<BrowserState>((set) => ({
  isBrowserVisible: false,
  activeUtilityTab: 'terminal',
  sourceType: 'none',
  currentUrl: '',
  currentFilePath: null,
  currentContent: null,
  ...resetBridgeState(),

  setBrowserVisible: (visible) =>
    set((state) => ({
      isBrowserVisible: visible,
      activeUtilityTab: visible ? 'browser' : state.activeUtilityTab,
      sourceType: visible ? state.sourceType : state.sourceType,
    })),

  toggleBrowserVisible: () =>
    set((state) => ({
      isBrowserVisible: !state.isBrowserVisible,
      activeUtilityTab: !state.isBrowserVisible ? 'browser' : state.activeUtilityTab,
    })),

  setActiveUtilityTab: (tab) =>
    set((state) => ({
      activeUtilityTab: tab,
      isBrowserVisible: tab === 'browser' ? true : state.isBrowserVisible,
    })),

  openBrowserUrl: (url) =>
    set(() => ({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      currentUrl: url,
      currentFilePath: null,
      currentContent: null,
      ...resetBridgeState(),
    })),

  openBrowserFile: (filePath, content) =>
    set(() => ({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      currentUrl: '',
      currentFilePath: filePath,
      currentContent: content,
      ...resetBridgeState(),
    })),

  setBrowserContent: (content) =>
    set(() => ({
      currentContent: content,
    })),

  setBridgeSession: (sessionId, status, meta) =>
    set(() => ({
      bridgeSessionId: sessionId,
      bridgeMode: meta.mode,
      bridgeStatus: status,
      bridgeCapabilities: deriveBrowserControlBooleanCapabilities(meta.capabilitySet),
      bridgeSessionMeta: {
        ...meta,
        capabilitySet: { ...meta.capabilitySet },
      },
      pendingBridgeCommand: null,
      lastBridgeResult: null,
      bridgeError: null,
      bridgeErrorCode: null,
      consoleEntries: [],
      networkEntries: [],
    })),

  setBridgeStatus: (status, error = null, errorCode = null, meta) =>
    set((state) => {
      const nextMeta = meta
        ? {
            ...meta,
            capabilitySet: { ...meta.capabilitySet },
          }
        : state.bridgeSessionMeta;

      return {
        bridgeStatus: status,
        bridgeMode: nextMeta.mode,
        bridgeError: error,
        bridgeErrorCode: errorCode,
        bridgeCapabilities: deriveBrowserControlBooleanCapabilities(nextMeta.capabilitySet),
        bridgeSessionMeta: nextMeta,
      };
    }),

  setPendingBridgeCommand: (command) =>
    set(() => ({
      pendingBridgeCommand: command,
      lastBridgeResult: null,
      bridgeError: null,
      bridgeErrorCode: null,
    })),

  resolveBridgeCommand: (result) =>
    set((state) => ({
      pendingBridgeCommand:
        state.pendingBridgeCommand?.id === result.commandId ? null : state.pendingBridgeCommand,
      lastBridgeResult: result,
      bridgeError: result.success ? null : result.error ?? null,
      bridgeErrorCode: result.success ? null : result.errorCode ?? null,
    })),

  rejectBridgeCommand: (commandId, error, errorCode = 'COMMAND_FAILED') =>
    set((state) => ({
      pendingBridgeCommand:
        state.pendingBridgeCommand?.id === commandId ? null : state.pendingBridgeCommand,
      lastBridgeResult: {
        commandId,
        success: false,
        error,
        errorCode,
      },
      bridgeError: error,
      bridgeErrorCode: errorCode,
    })),

  appendConsoleEntry: (entry) =>
    set((state) => ({
      consoleEntries: [...state.consoleEntries, entry].slice(-200),
    })),

  clearConsoleEntries: () =>
    set(() => ({
      consoleEntries: [],
    })),

  appendNetworkEntry: (entry) =>
    set((state) => ({
      networkEntries: [...state.networkEntries, entry].slice(-200),
    })),

  clearNetworkEntries: () =>
    set(() => ({
      networkEntries: [],
    })),
}));
