// Turso Client Wrapper
// Provides a unified interface compatible with the old Tauri SQL plugin API
// Uses Tauri backend commands for database operations

import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Database filename (for local mode) */
  filename: string;
  /** Optional remote URL (for Turso cloud mode) */
  url?: string;
  /** Optional auth token (for Turso cloud mode) */
  authToken?: string;
}

/**
 * Result set structure matching libsql
 */
export interface ResultSet {
  rows: unknown[];
  rowsAffected?: number;
}

/**
 * Turso Client Wrapper
 * Provides compatibility layer with old Tauri SQL plugin API
 * Uses Rust backend for actual database operations
 */
export class TursoClient {
  private initialized = false;

  constructor(_config: DatabaseConfig) {
    // Config is stored for future use if needed
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      logger.info(`Initializing Turso client via Tauri backend`);

      // Connect via Tauri command
      await invoke('db_connect');

      this.initialized = true;
      logger.info('Turso client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Turso client:', error);
      throw error;
    }
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)
   * Compatible with old Tauri SQL plugin API
   */
  async execute(sql: string, params?: unknown[]): Promise<ResultSet> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.debug('Executing SQL:', sql, params);
      const result = await invoke<ResultSet>('db_execute', {
        sql,
        params: params || [],
      });
      return result;
    } catch (error) {
      logger.error('SQL execute error:', error, sql, params);
      throw error;
    }
  }

  /**
   * Execute a SELECT query and return results
   * Compatible with old Tauri SQL plugin API
   */
  async select<T = unknown[]>(sql: string, params?: unknown[]): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.debug('Executing SELECT:', sql, params);
      const result = await invoke<ResultSet>('db_query', {
        sql,
        params: params || [],
      });

      // Return rows for compatibility
      return result.rows as T;
    } catch (error) {
      logger.error('SQL select error:', error, sql, params);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<ResultSet[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.debug('Executing batch:', statements.length, 'statements');

      const batchStatements = statements.map((stmt) => [stmt.sql, stmt.params || []]);

      const results = await invoke<ResultSet[]>('db_batch', {
        statements: batchStatements,
      });

      return results;
    } catch (error) {
      logger.error('SQL batch error:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.initialized) {
      this.initialized = false;
      logger.info('Turso client connection state cleared');
    }
  }

  /**
   * Get the underlying client (for compatibility)
   */
  getClient(): unknown {
    return this.initialized ? {} : null;
  }
}

/**
 * Factory function to create database instance
 * Compatible with old Database.load() API
 */
export async function loadDatabase(config: DatabaseConfig): Promise<TursoClient> {
  const client = new TursoClient(config);
  await client.initialize();
  return client;
}
