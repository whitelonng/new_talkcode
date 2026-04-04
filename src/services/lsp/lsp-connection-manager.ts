// src/services/lsp/lsp-connection-manager.ts
// Manages LSP connections for files, used by Monaco definition provider
// Tracks file references for proper server lifecycle management

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface LspConnection {
  serverId: string;
  language: string;
  rootPath: string;
}

// Track files that reference each server
interface ServerFileReferences {
  serverId: string;
  language: string;
  rootPath: string;
  filePaths: Set<string>; // All files using this server
}

// ============================================================================
// Connection Manager
// ============================================================================

class LspConnectionManager {
  // Map from file path to connection info
  private connections: Map<string, LspConnection> = new Map();

  // Map from rootPath + language to server file references
  private serverReferences: Map<string, ServerFileReferences> = new Map();

  /**
   * Check if a file has an active LSP connection
   */
  hasConnection(filePath: string): boolean {
    return this.connections.has(filePath);
  }

  /**
   * Get LSP connection info for a file
   */
  getConnection(filePath: string): LspConnection | null {
    return this.connections.get(filePath) || null;
  }

  /**
   * Get LSP connection by root path and language
   * This is useful when we need to find a server for a file that hasn't been opened yet
   */
  getConnectionByRoot(rootPath: string, language: string): LspConnection | null {
    const key = `${rootPath}:${language}`;
    const refs = this.serverReferences.get(key);
    if (!refs) return null;

    return {
      serverId: refs.serverId,
      language: refs.language,
      rootPath: refs.rootPath,
    };
  }

  /**
   * Register an LSP connection for a file
   * Tracks file references for proper reference counting
   */
  register(filePath: string, serverId: string, language: string, rootPath: string): void {
    logger.debug(
      `[LspConnectionManager] Registering connection for ${filePath}: server=${serverId}, lang=${language}`
    );

    this.connections.set(filePath, {
      serverId,
      language,
      rootPath,
    });

    // Track by root + language for cross-file lookups and reference counting
    const key = `${rootPath}:${language}`;
    let refs = this.serverReferences.get(key);
    if (!refs) {
      refs = {
        serverId,
        language,
        rootPath,
        filePaths: new Set(),
      };
      this.serverReferences.set(key, refs);
    }
    refs.filePaths.add(filePath);
    logger.debug(
      `[LspConnectionManager] Server ${serverId} now has ${refs.filePaths.size} file references`
    );
  }

  /**
   * Unregister an LSP connection for a file
   * Returns true if this was the last reference to the server
   */
  unregister(filePath: string): boolean {
    logger.debug(`[LspConnectionManager] Unregistering connection for ${filePath}`);

    const conn = this.connections.get(filePath);
    if (!conn) {
      return false;
    }

    // Remove from connections
    this.connections.delete(filePath);

    // Update server references
    const key = `${conn.rootPath}:${conn.language}`;
    const refs = this.serverReferences.get(key);
    if (refs) {
      refs.filePaths.delete(filePath);
      logger.debug(
        `[LspConnectionManager] Server ${conn.serverId} now has ${refs.filePaths.size} file references`
      );

      // Return true if this was the last reference
      const wasLastReference = refs.filePaths.size === 0;
      if (wasLastReference) {
        this.serverReferences.delete(key);
        logger.debug(`[LspConnectionManager] Last reference removed for server ${conn.serverId}`);
      }
      return wasLastReference;
    }

    return false;
  }

  /**
   * Unregister all connections for a server
   */
  unregisterServer(serverId: string): void {
    logger.debug(`[LspConnectionManager] Unregistering all connections for server ${serverId}`);

    // Remove file connections
    const pathsToRemove: string[] = [];
    for (const [filePath, conn] of this.connections) {
      if (conn.serverId === serverId) {
        pathsToRemove.push(filePath);
      }
    }
    for (const path of pathsToRemove) {
      this.connections.delete(path);
    }

    // Remove server references
    const keysToRemove: string[] = [];
    for (const [key, refs] of this.serverReferences) {
      if (refs.serverId === serverId) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.serverReferences.delete(key);
    }
  }

  /**
   * Get all registered connections
   */
  getAllConnections(): Map<string, LspConnection> {
    return new Map(this.connections);
  }

  /**
   * Get the number of file references for a server
   */
  getFileReferenceCount(serverId: string): number {
    let count = 0;
    for (const refs of this.serverReferences.values()) {
      if (refs.serverId === serverId) {
        count += refs.filePaths.size;
      }
    }
    return count;
  }

  /**
   * Get all file paths that reference a server
   */
  getFileReferences(serverId: string): string[] {
    const paths: string[] = [];
    for (const refs of this.serverReferences.values()) {
      if (refs.serverId === serverId) {
        paths.push(...refs.filePaths);
      }
    }
    return paths;
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.connections.clear();
    this.serverReferences.clear();
  }
}

// Export singleton instance
export const lspConnectionManager = new LspConnectionManager();
