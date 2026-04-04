// src/hooks/use-lsp.ts
// React hook for LSP (Language Server Protocol) integration

import type { editor } from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { lspService } from '@/services/lsp';
import { lspConnectionManager } from '@/services/lsp/lsp-connection-manager';
import type { Diagnostic, Hover, Location } from '@/services/lsp/lsp-protocol';
import {
  findWorkspaceRoot,
  getLanguageDisplayName,
  getLanguageIdForPath,
  getLspLanguageIdForPath,
  getServerConfig,
  hasLspSupport,
} from '@/services/lsp/lsp-servers';
import { type PendingDownload, useLspStore } from '@/stores/lsp-store';

// ============================================================================
// Types
// ============================================================================

interface UseLspOptions {
  editor: editor.IStandaloneCodeEditor | null;
  filePath: string | null;
  rootPath: string | null;
  enabled?: boolean;
}

interface UseLspResult {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  serverId: string | null;

  // Actions
  openDocument: (content: string) => Promise<void>;
  updateDocument: (content: string) => Promise<void>;
  closeDocument: () => Promise<void>;

  // Language features
  getHover: (line: number, character: number) => Promise<Hover | null>;
  getDefinition: (line: number, character: number) => Promise<Location[] | null>;
  getReferences: (line: number, character: number) => Promise<Location[] | null>;
}

// ============================================================================
// Helpers (defined before hook to ensure hoisting works)
// ============================================================================

// Map LSP severity (1=Error, 2=Warning, 3=Info, 4=Hint) to Monaco severity
function mapLspSeverity(
  severity: number | undefined,
  monaco: typeof import('monaco-editor')
): import('monaco-editor').MarkerSeverity {
  switch (severity) {
    case 1: // Error
      return monaco.MarkerSeverity.Error;
    case 2: // Warning
      return monaco.MarkerSeverity.Warning;
    case 3: // Information
      return monaco.MarkerSeverity.Info;
    case 4: // Hint
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useLsp({
  editor,
  filePath,
  rootPath,
  enabled = true,
}: UseLspOptions): UseLspResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);

  const { enabled: storeEnabled, setDiagnostics, addPendingDownload } = useLspStore();
  const isEnabled = enabled && storeEnabled;

  const serverIdRef = useRef<string | null>(null);
  const filePathRef = useRef<string | null>(null);
  const languageRef = useRef<string | null>(null);
  const workspaceRootRef = useRef<string | null>(null);
  const isDocumentOpenRef = useRef(false);
  // Track if we have incremented ref count (either via startServer or incrementRefCount)
  const hasIncrementedRefRef = useRef(false);

  // Get language for the current file (server key, e.g., 'typescript' for both .ts and .tsx)
  const language = filePath ? getLanguageIdForPath(filePath) : null;

  // Compute the correct workspace root based on rootPatterns (async)
  useEffect(() => {
    if (!filePath || !language || !rootPath) {
      setWorkspaceRoot(rootPath);
      return;
    }

    let cancelled = false;
    findWorkspaceRoot(filePath, language, rootPath).then((root) => {
      if (!cancelled) {
        setWorkspaceRoot(root);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filePath, language, rootPath]);

  // Start/stop LSP server based on file and settings
  useEffect(() => {
    // Helper function to perform cleanup synchronously where possible
    const performCleanup = () => {
      const currentServerId = serverIdRef.current;
      const currentFilePath = filePathRef.current;
      const hasIncremented = hasIncrementedRefRef.current;

      // Close document if open (fire and forget - we can't wait in cleanup)
      if (currentServerId && isDocumentOpenRef.current && currentFilePath) {
        lspService.closeDocument(currentServerId, currentFilePath).catch(() => {});
        isDocumentOpenRef.current = false;
      }

      // Unregister connection
      if (currentFilePath) {
        lspConnectionManager.unregister(currentFilePath);
      }

      // Decrement ref count if we incremented it
      if (hasIncremented && currentServerId) {
        lspService.decrementRefCount(currentServerId);
        hasIncrementedRefRef.current = false;
      }

      // Reset state refs
      serverIdRef.current = null;
      filePathRef.current = null;
    };

    if (!isEnabled || !filePath || !workspaceRoot || !language) {
      // Cleanup if disabled - only if we had a previous connection
      if (serverIdRef.current || hasIncrementedRefRef.current) {
        performCleanup();
        setIsConnected(false);
        setServerId(null);
      }
      return;
    }

    // Check if language has LSP support
    if (!hasLspSupport(language)) {
      logger.info(`[useLsp] No LSP support for language: ${language}`);
      return;
    }

    let isMounted = true;

    const initializeConnection = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First check server status
        const status = await lspService.getServerStatus(language);

        if (!status.available) {
          // Server not available, check if we can download
          if (status.canDownload) {
            // Add to pending downloads for user confirmation
            const config = getServerConfig(language);
            const pendingDownload: PendingDownload = {
              language,
              languageDisplayName: getLanguageDisplayName(language),
              serverName: config?.name || language,
              downloadUrl: status.downloadUrl,
            };
            addPendingDownload(pendingDownload);

            if (isMounted) {
              setError(
                `LSP server for ${getLanguageDisplayName(language)} is not installed. Click to install.`
              );
              setIsLoading(false);
            }
            return;
          } else {
            // Cannot auto-download
            if (isMounted) {
              const config = getServerConfig(language);
              setError(`LSP server not available. Please install: ${config?.command || 'unknown'}`);
              setIsLoading(false);
            }
            return;
          }
        }

        // Check if there's already an existing server for this language + root
        const existingConnection = lspConnectionManager.getConnectionByRoot(
          workspaceRoot,
          language
        );
        let serverId: string | null = null;

        if (existingConnection) {
          // Try to reuse existing server by incrementing ref count
          const success = lspService.incrementRefCount(existingConnection.serverId);
          if (success) {
            // Successfully incremented ref count
            serverId = existingConnection.serverId;
            logger.info(
              `[useLsp] Reusing existing LSP server for ${language} in ${workspaceRoot}: ${serverId}`
            );
            hasIncrementedRefRef.current = true;
          } else {
            // Server was cleaned up between check and increment, need to start new one
            logger.info(
              `[useLsp] Existing server ${existingConnection.serverId} was cleaned up, starting new one`
            );
            // Clean up stale connection manager entry
            lspConnectionManager.unregisterServer(existingConnection.serverId);
          }
        }

        if (!serverId) {
          // Need to start a new server (startServer sets refCount=1 internally, or reuses existing)
          logger.info(
            `[useLsp] Starting LSP server for ${language} with workspace root: ${workspaceRoot}`
          );
          serverId = await lspService.startServer(language, workspaceRoot);
          hasIncrementedRefRef.current = true; // startServer sets refCount=1, so we count as incremented
        }

        if (isMounted) {
          serverIdRef.current = serverId;
          languageRef.current = language;
          workspaceRootRef.current = workspaceRoot;
          setServerId(serverId);
          setIsConnected(true);

          // Register connection with connection manager for cross-file lookups and ref counting
          lspConnectionManager.register(filePath, serverId, language, workspaceRoot);

          logger.info(`[useLsp] Connected to LSP server: ${serverId}`);
        }
      } catch (e) {
        if (isMounted) {
          const errorMessage = e instanceof Error ? e.message : 'Failed to start LSP server';
          setError(errorMessage);
          logger.error(`[useLsp] Failed to start server:`, e);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeConnection();

    return () => {
      isMounted = false;
      // Cleanup: unregister and decrement ref count
      performCleanup();
    };
  }, [isEnabled, language, workspaceRoot, filePath, addPendingDownload]);

  // Subscribe to diagnostics and apply to Monaco editor
  useEffect(() => {
    if (!isEnabled) return;

    let lastUpdate = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingPayload: { uri: string; diagnostics: Diagnostic[] } | null = null;

    const flushMarkers = () => {
      if (!pendingPayload) return;
      const { uri, diagnostics } = pendingPayload;
      pendingPayload = null;
      lastUpdate = Date.now();

      if (!editor || !filePath) {
        return;
      }

      const { showDiagnostics } = useLspStore.getState();
      if (!showDiagnostics) return;

      const model = editor.getModel();
      if (!model) return;

      const monaco = (window as unknown as { monaco?: typeof import('monaco-editor') }).monaco;
      if (!monaco) return;

      // Convert URI to file path for comparison
      const diagnosticFilePath = uri.startsWith('file://') ? uri.slice(7) : uri;
      if (diagnosticFilePath !== filePath) {
        return;
      }

      // Verify the diagnostic is for a file with the same language as current LSP connection
      const diagnosticLang = getLanguageIdForPath(diagnosticFilePath);
      const currentLang = languageRef.current;
      if (diagnosticLang && currentLang && diagnosticLang !== currentLang) {
        logger.info(`[LSP] Diagnostics language mismatch: ${diagnosticLang} vs ${currentLang}`);
        return;
      }

      // Get the language for this file to use as source
      const diagnosticLanguage = getLanguageIdForPath(diagnosticFilePath) || 'lsp';

      // Get severity filter settings
      const { showErrors, showWarnings, showInfo, showHints } = useLspStore.getState();

      // Convert LSP diagnostics to Monaco markers with severity filtering
      const markers = diagnostics
        .filter((d) => {
          switch (d.severity) {
            case 1: // Error
              return showErrors;
            case 2: // Warning
              return showWarnings;
            case 3: // Info
              return showInfo;
            case 4: // Hint
              return showHints;
            default:
              return true;
          }
        })
        .map((d) => ({
          severity: mapLspSeverity(d.severity, monaco),
          message: d.message,
          startLineNumber: d.range.start.line + 1,
          startColumn: d.range.start.character + 1,
          endLineNumber: d.range.end.line + 1,
          endColumn: d.range.end.character + 1,
          source: diagnosticLanguage,
          code: d.code?.toString(),
        }));

      monaco.editor.setModelMarkers(model, 'lsp', markers);
    };

    const unsubscribe = lspService.onDiagnostics((uri, diagnostics) => {
      logger.info(`[LSP] Received ${diagnostics.length} diagnostics for ${uri}`);
      setDiagnostics(uri, diagnostics);

      pendingPayload = { uri, diagnostics };
      const now = Date.now();
      const timeSinceLast = now - lastUpdate;
      const delay = timeSinceLast >= 100 ? 0 : 100 - timeSinceLast;

      if (pendingTimer) {
        clearTimeout(pendingTimer);
      }
      if (delay === 0) {
        flushMarkers();
      } else {
        pendingTimer = setTimeout(flushMarkers, delay);
      }
    });

    return () => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
      }
      unsubscribe();
    };
  }, [isEnabled, setDiagnostics, editor, filePath]);

  // Open document
  const openDocument = useCallback(
    async (content: string) => {
      if (!serverIdRef.current || !filePath || !languageRef.current) {
        throw new Error('LSP server not connected');
      }

      // Skip if document is already open for this file
      if (isDocumentOpenRef.current && filePathRef.current === filePath) {
        return;
      }

      // Use the correct LSP languageId for the file (e.g., 'typescriptreact' for .tsx)
      const lspLanguageId = getLspLanguageIdForPath(filePath) || languageRef.current;

      await lspService.openDocument(serverIdRef.current, filePath, lspLanguageId, content);
      filePathRef.current = filePath;
      isDocumentOpenRef.current = true;
    },
    [filePath]
  );

  // Update document
  const updateDocument = useCallback(async (content: string) => {
    if (!serverIdRef.current || !filePathRef.current) {
      return;
    }

    await lspService.changeDocument(serverIdRef.current, filePathRef.current, content);
  }, []);

  // Close document
  const closeDocument = useCallback(async () => {
    if (!serverIdRef.current || !filePathRef.current) {
      return;
    }

    await lspService.closeDocument(serverIdRef.current, filePathRef.current);
    isDocumentOpenRef.current = false;
  }, []);

  // Get hover
  const getHover = useCallback(async (line: number, character: number): Promise<Hover | null> => {
    if (!serverIdRef.current || !filePathRef.current) {
      return null;
    }

    return lspService.hover(serverIdRef.current, filePathRef.current, line, character);
  }, []);

  // Get definition
  const getDefinition = useCallback(
    async (line: number, character: number): Promise<Location[] | null> => {
      if (!serverIdRef.current || !filePathRef.current) {
        return null;
      }

      return lspService.definition(serverIdRef.current, filePathRef.current, line, character);
    },
    []
  );

  // Get references
  const getReferences = useCallback(
    async (line: number, character: number): Promise<Location[] | null> => {
      if (!serverIdRef.current || !filePathRef.current) {
        return null;
      }

      return lspService.references(serverIdRef.current, filePathRef.current, line, character);
    },
    []
  );

  return {
    isConnected,
    isLoading,
    error,
    serverId,
    openDocument,
    updateDocument,
    closeDocument,
    getHover,
    getDefinition,
    getReferences,
  };
}
