// src/services/lsp/lsp-definition-provider.ts
// Provides LSP-based definition and reference lookups

import { logger } from '@/lib/logger';
import { lspConnectionManager } from './lsp-connection-manager';
import type { Location } from './lsp-protocol';
import { getLanguageIdForPath, hasLspSupport } from './lsp-servers';
import { lspService } from './lsp-service';

// ============================================================================
// LSP Definition Provider
// ============================================================================

/**
 * Get definition using LSP
 * Returns null if LSP is not available for this file
 *
 * @param filePath - Absolute path to the file
 * @param line - 0-indexed line number (LSP format)
 * @param character - 0-indexed character position (LSP format)
 */
export async function getLspDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<Location[] | null> {
  // First check if we have a direct connection for this file
  let conn = lspConnectionManager.getConnection(filePath);

  // If no direct connection, try to find a server for this file's language and root
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
      logger.debug(`[LspDefinition] No LSP connection for ${filePath}`);
      return null;
    }
  }

  try {
    logger.info(`[LspDefinition] Getting definition at ${filePath}:${line + 1}:${character + 1}`);
    const result = await lspService.definition(conn.serverId, filePath, line, character);

    if (result && result.length > 0) {
      logger.info(`[LspDefinition] Found ${result.length} definitions`);
      return result;
    }

    return null;
  } catch (error) {
    logger.error(`[LspDefinition] Error getting definition:`, error);
    return null;
  }
}

/**
 * Get references using LSP
 * Returns null if LSP is not available for this file
 *
 * @param filePath - Absolute path to the file
 * @param line - 0-indexed line number (LSP format)
 * @param character - 0-indexed character position (LSP format)
 */
export async function getLspReferences(
  filePath: string,
  line: number,
  character: number
): Promise<Location[] | null> {
  // First check if we have a direct connection for this file
  let conn = lspConnectionManager.getConnection(filePath);

  // If no direct connection, try to find a server for this file's language
  if (!conn) {
    const language = getLanguageIdForPath(filePath);
    if (!language || !hasLspSupport(language)) {
      return null;
    }

    // Try to find a server by checking all connections
    const allConns = lspConnectionManager.getAllConnections();
    for (const [, c] of allConns) {
      if (c.language === language) {
        conn = c;
        break;
      }
    }

    if (!conn) {
      logger.debug(`[LspReferences] No LSP connection for ${filePath}`);
      return null;
    }
  }

  try {
    logger.info(`[LspReferences] Getting references at ${filePath}:${line + 1}:${character + 1}`);
    const result = await lspService.references(conn.serverId, filePath, line, character);

    if (result && result.length > 0) {
      logger.info(`[LspReferences] Found ${result.length} references`);
      return result;
    }

    return null;
  } catch (error) {
    logger.error(`[LspReferences] Error getting references:`, error);
    return null;
  }
}

/**
 * Check if LSP is available for a file
 */
export function hasLspConnection(filePath: string): boolean {
  // Direct connection check
  if (lspConnectionManager.hasConnection(filePath)) {
    return true;
  }

  // Check if language has LSP support and a server is running
  const language = getLanguageIdForPath(filePath);
  if (!language || !hasLspSupport(language)) {
    return false;
  }

  // Check if any server is running for this language
  const allConns = lspConnectionManager.getAllConnections();
  for (const [, c] of allConns) {
    if (c.language === language) {
      return true;
    }
  }

  return false;
}
