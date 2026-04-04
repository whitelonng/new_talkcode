import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { editor } from 'monaco-editor';
import { logger } from '@/lib/logger';

export interface LintDiagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  source: 'biome' | 'typescript' | 'javascript';
  code?: string;
  relatedInformation?: Array<{
    message: string;
    location: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  }>;
}

export interface LintResult {
  filePath: string;
  diagnostics: LintDiagnostic[];
  timestamp: number;
}

/**
 * Response from Rust backend lint command
 */
interface RustLintResult {
  file_path: string;
  diagnostics: Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    end_line: number;
    end_column: number;
    code: string | null;
  }>;
  request_id: string;
  timestamp: number;
}

class LintService {
  private static instance: LintService;
  private requestId = 0;
  private pendingRequests = new Map<string, (result: LintResult) => void>();
  private unlistenFn: UnlistenFn | null = null;
  private initialized = false;
  private cache = new Map<string, LintResult>();
  private readonly CACHE_DURATION = 5000; // 5 seconds

  static getInstance(): LintService {
    if (!LintService.instance) {
      LintService.instance = new LintService();
    }
    return LintService.instance;
  }

  /**
   * Initialize the lint service by setting up event listeners
   * This should be called once when the app starts
   */
  async init(): Promise<void> {
    logger.info('[LintService] init called, initialized:', this.initialized);

    if (this.initialized) {
      logger.info('[LintService] Already initialized, skipping');
      return;
    }

    try {
      // Listen for lint results from the Rust backend
      logger.info('[LintService] Setting up lint-result event listener');
      this.unlistenFn = await listen<RustLintResult>('lint-result', (event) => {
        logger.info('[LintService] Received lint-result event', {
          requestId: event.payload.request_id,
          filePath: event.payload.file_path,
          diagnosticsCount: event.payload.diagnostics.length,
        });

        const rustResult = event.payload;
        const result = this.convertRustResult(rustResult);

        // Cache the result
        this.cache.set(rustResult.file_path, result);

        // Resolve the pending promise if exists
        const resolve = this.pendingRequests.get(rustResult.request_id);
        logger.info('[LintService] Looking for pending request', {
          requestId: rustResult.request_id,
          found: !!resolve,
          pendingRequestsCount: this.pendingRequests.size,
        });

        if (resolve) {
          resolve(result);
          this.pendingRequests.delete(rustResult.request_id);
          logger.info('[LintService] Resolved pending request', rustResult.request_id);
        } else {
          logger.warn('[LintService] No pending request found for', rustResult.request_id);
        }
      });

      this.initialized = true;
      logger.info('[LintService] Initialized successfully');
    } catch (error) {
      logger.error('[LintService] Failed to initialize:', error);
    }
  }

  /**
   * Convert Rust lint result to frontend format
   */
  private convertRustResult(rustResult: RustLintResult): LintResult {
    const diagnostics: LintDiagnostic[] = rustResult.diagnostics.map((diag, index) => {
      const severityMap: Record<string, 'error' | 'warning' | 'info'> = {
        error: 'error',
        warning: 'warning',
        info: 'info',
      };

      return {
        id: `${rustResult.file_path}:${diag.line}:${diag.column}:${index}`,
        severity: severityMap[diag.severity] || 'error',
        message: diag.message,
        range: {
          start: { line: diag.line, column: diag.column },
          end: { line: diag.end_line, column: diag.end_column },
        },
        source: 'biome' as const,
        code: diag.code || undefined,
      };
    });

    return {
      filePath: rustResult.file_path,
      diagnostics,
      timestamp: rustResult.timestamp,
    };
  }

  /**
   * Run biome lint on a single file
   * This sends a request to the Rust backend and waits for the result via event
   * Note: This lints the saved file directly, so ensure the file is saved before calling
   * @param filePath - Absolute path to the file to lint
   * @param rootPath - Project root path where biome.json is located
   */
  async runBiomeLint(filePath: string, rootPath: string): Promise<LintResult> {
    logger.debug('[LintService] runBiomeLint called', {
      filePath,
      rootPath,
      initialized: this.initialized,
    });

    // Ensure service is initialized
    if (!this.initialized) {
      await this.init();
    }

    // Generate unique request ID
    const requestId = `lint-${++this.requestId}-${Date.now()}`;

    // Check cache first (using file path as cache key since we lint saved files)
    const cached = this.cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.debug('[LintService] Returning cached result for', filePath);
      return cached;
    }

    return new Promise((resolve) => {
      // Set a timeout to avoid hanging forever
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          logger.warn('[LintService] Request timed out:', requestId);
          resolve({
            filePath,
            diagnostics: [],
            timestamp: Date.now(),
          });
        }
      }, 30000); // 30 second timeout

      // Store the resolve function to be called when we receive the result
      this.pendingRequests.set(requestId, (result) => {
        clearTimeout(timeoutId);
        logger.debug('[LintService] Request resolved', {
          requestId,
          diagnosticsCount: result.diagnostics.length,
        });
        // Update cache
        this.cache.set(filePath, result);
        resolve(result);
      });

      // Send request to Rust backend (fire-and-forget)
      invoke('run_lint', { filePath, rootPath, requestId }).catch((error) => {
        logger.error('[LintService] Failed to invoke run_lint:', error);
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        resolve({
          filePath,
          diagnostics: [],
          timestamp: Date.now(),
        });
      });
    });
  }

  /**
   * Convert diagnostic to Monaco marker format
   */
  convertToMonacoMarker(diagnostic: LintDiagnostic): editor.IMarkerData {
    const severityMap = {
      error: 8, // MarkerSeverity.Error
      warning: 4, // MarkerSeverity.Warning
      info: 2, // MarkerSeverity.Info
    };

    return {
      severity: severityMap[diagnostic.severity],
      message: diagnostic.message,
      startLineNumber: diagnostic.range.start.line,
      startColumn: diagnostic.range.start.column,
      endLineNumber: diagnostic.range.end.line,
      endColumn: diagnostic.range.end.column,
      source: diagnostic.source,
      code: diagnostic.code,
    };
  }

  /**
   * Apply diagnostics to Monaco editor
   */
  applyDiagnosticsToEditor(
    editorInstance: editor.IStandaloneCodeEditor,
    diagnostics: LintDiagnostic[]
  ): void {
    logger.info('[LintService] applyDiagnosticsToEditor called', {
      diagnosticsCount: diagnostics.length,
    });

    const model = editorInstance.getModel();
    if (!model) {
      logger.warn('[LintService] No model found in editor');
      return;
    }

    const monaco = (window as unknown as { monaco?: typeof import('monaco-editor') }).monaco;
    if (!monaco) {
      logger.warn('[LintService] Monaco not found on window');
      return;
    }

    // Convert diagnostics to Monaco markers
    const markers = diagnostics.map((d) => this.convertToMonacoMarker(d));
    logger.info('[LintService] Applying markers to editor', {
      markersCount: markers.length,
      modelUri: model.uri.toString(),
    });

    // Apply markers to the model
    monaco.editor.setModelMarkers(model, 'biome', markers);
    logger.info('[LintService] Markers applied successfully');
  }

  /**
   * Clear all diagnostics for a model
   */
  clearDiagnostics(editor: editor.IStandaloneCodeEditor): void {
    const model = editor.getModel();
    if (!model) return;

    const monaco = (window as unknown as { monaco?: typeof import('monaco-editor') }).monaco;
    if (!monaco) return;

    monaco.editor.setModelMarkers(model, 'biome', []);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; pendingRequests: number } {
    return {
      size: this.cache.size,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Clear cache for a specific file
   */
  clearCacheForFile(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup resources when service is no longer needed
   */
  cleanup(): void {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.pendingRequests.clear();
    this.cache.clear();
    this.initialized = false;
  }
}

export const lintService = LintService.getInstance();
