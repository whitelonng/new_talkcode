// src/services/agent-database-service.ts

import { logger } from '@/lib/logger';
import type { TursoClient } from './database/turso-client';
import { databaseService } from './database-service';

/**
 * Service for managing agent data
 * Now uses the unified Turso database instead of a separate agents.db file
 */
export class AgentDatabaseService {
  private db: TursoClient | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  private async internalInitialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Use the unified database instead of a separate file
      await databaseService.initialize();
      this.db = await databaseService.getDb();

      this.isInitialized = true;
      logger.info('Agent database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize agent database service:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.initializationPromise) {
      this.initializationPromise = this.internalInitialize();
    }

    return this.initializationPromise;
  }

  async getDb(): Promise<TursoClient> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('Agent database not initialized');
    }
    return this.db;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Check if the agent database exists and has been initialized
   */
  async isDatabaseReady(): Promise<boolean> {
    try {
      const db = await this.getDb();
      const result = await db.select<any[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='agents'"
      );
      return result.length > 0;
    } catch (error) {
      logger.error('Failed to check agent database readiness:', error);
      return false;
    }
  }

  /**
   * Execute a query on the agent database
   */
  async execute(query: string, params?: any[]): Promise<void> {
    const db = await this.getDb();
    await db.execute(query, params);
  }

  /**
   * Select data from the agent database
   */
  async select<T = any>(query: string, params?: any[]): Promise<T[]> {
    const db = await this.getDb();
    return db.select<T[]>(query, params);
  }

  /**
   * Close the agent database connection
   * Note: Since we now use the unified database, this only resets local state
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db = null;
      this.isInitialized = false;
      this.initializationPromise = null;
      logger.info('Agent database service state cleared');
    }
  }

  /**
   * Reset the agent database service (useful for testing)
   */
  async reset(): Promise<void> {
    await this.close();
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

export const agentDatabaseService = new AgentDatabaseService();
