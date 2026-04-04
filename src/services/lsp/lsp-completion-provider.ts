// src/services/lsp/lsp-completion-provider.ts
// Provides LSP-based code completion

import { logger } from '@/lib/logger';
import { lspConnectionManager } from './lsp-connection-manager';
import type { CompletionItem } from './lsp-protocol';
import { getLanguageIdForPath, hasLspSupport } from './lsp-servers';
import { lspService } from './lsp-service';

// ============================================================================
// LSP Completion Provider
// ============================================================================

/**
 * Get completions using LSP
 * Returns null if LSP is not available for this file
 *
 * @param filePath - Absolute path to the file
 * @param line - 0-indexed line number (LSP format)
 * @param character - 0-indexed character position (LSP format)
 * @param triggerKind - 1: Invoked, 2: TriggerCharacter, 3: TriggerForIncompleteCompletions
 * @param triggerCharacter - The character that triggered completion (if triggerKind is 2)
 */
export async function getLspCompletion(
  filePath: string,
  line: number,
  character: number,
  triggerKind?: number,
  triggerCharacter?: string
): Promise<CompletionItem[] | null> {
  // First check if we have a direct connection for this file
  let conn = lspConnectionManager.getConnection(filePath);

  // If no direct connection, try to find a server for this file's language
  if (!conn) {
    const language = getLanguageIdForPath(filePath);
    if (!language || !hasLspSupport(language)) {
      return null;
    }

    // Prefer a server with a root that matches this file
    const allConns = lspConnectionManager.getAllConnections();
    for (const [, c] of allConns) {
      if (c.language === language && filePath.startsWith(c.rootPath)) {
        conn = c;
        break;
      }
    }

    // Fallback to any server for the language if no root match found
    if (!conn) {
      for (const [, c] of allConns) {
        if (c.language === language) {
          conn = c;
          break;
        }
      }
    }

    if (!conn) {
      logger.debug(`[LspCompletion] No LSP connection for ${filePath}`);
      return null;
    }
  }

  try {
    logger.debug(`[LspCompletion] Getting completion at ${filePath}:${line + 1}:${character + 1}`);
    const result = await lspService.completion(
      conn.serverId,
      filePath,
      line,
      character,
      triggerKind,
      triggerCharacter
    );

    if (!result) {
      return null;
    }

    // Normalize to CompletionItem[]
    const items = Array.isArray(result) ? result : result.items;

    if (items && items.length > 0) {
      logger.debug(`[LspCompletion] Found ${items.length} completions`);
      return items;
    }

    return null;
  } catch (error) {
    logger.error(`[LspCompletion] Error getting completion:`, error);
    return null;
  }
}
