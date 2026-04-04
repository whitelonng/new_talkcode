// src/services/database/recent-files-service.ts

import { logger } from '@/lib/logger';
import type { TursoClient } from './turso-client';

/**
 * Check if an error is a UNIQUE constraint violation
 * Handles different error formats from various SQLite drivers
 */
function isUniqueConstraintError(error: unknown): boolean {
  if (!error) return false;

  // Check error code (some drivers use this)
  if (typeof error === 'object') {
    const err = error as { code?: string; errno?: number; message?: string };
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
    if (err.errno === 2067) return true;
    // Check error message (libsql uses this format)
    if (err.message?.includes('UNIQUE constraint failed')) return true;
  }

  // Check if error is a string or has toString
  const errorStr = String(error);
  if (errorStr.includes('UNIQUE constraint failed')) return true;

  return false;
}

export interface RecentFile {
  id: number;
  file_path: string;
  repository_path: string;
  opened_at: number;
}

export class RecentFilesService {
  private readonly MAX_RECENT_FILES = 50;

  constructor(private db: TursoClient) {}

  /**
   * Add a file to the recent files list
   * If the file already exists, update its opened_at timestamp
   */
  async addRecentFile(filePath: string, repositoryPath: string): Promise<void> {
    try {
      const now = Date.now();

      // Use a two-step approach to handle concurrency:
      // 1. Try to update existing entry
      const updateResult = await this.db.execute(
        'UPDATE recent_files SET opened_at = ? WHERE file_path = ? AND repository_path = ?',
        [now, filePath, repositoryPath]
      );

      // 2. If no rows were updated, insert new entry
      const updated = updateResult.rowsAffected && updateResult.rowsAffected > 0;

      if (!updated) {
        try {
          await this.db.execute(
            'INSERT INTO recent_files (file_path, repository_path, opened_at) VALUES (?, ?, ?)',
            [filePath, repositoryPath, now]
          );
        } catch (insertError: unknown) {
          // If insert fails due to UNIQUE constraint (concurrent insert), try update again
          if (isUniqueConstraintError(insertError)) {
            await this.db.execute(
              'UPDATE recent_files SET opened_at = ? WHERE file_path = ? AND repository_path = ?',
              [now, filePath, repositoryPath]
            );
          } else {
            throw insertError;
          }
        }

        // Only cleanup after a new insert when we're at or near the limit
        const count = await this.getFilesCount(repositoryPath);
        if (count > this.MAX_RECENT_FILES) {
          await this.cleanupOldEntries(repositoryPath);
        }
      }
    } catch (error) {
      logger.error('Failed to add recent file:', error);
      throw error;
    }
  }

  /**
   * Get recent files for a repository, ordered by most recently opened
   */
  async getRecentFiles(repositoryPath: string, limit = 50): Promise<RecentFile[]> {
    try {
      const effectiveLimit = Math.min(limit, this.MAX_RECENT_FILES);

      const result = await this.db.select<RecentFile[]>(
        `SELECT id, file_path, repository_path, opened_at
         FROM recent_files
         WHERE repository_path = ?
         ORDER BY opened_at DESC
         LIMIT ?`,
        [repositoryPath, effectiveLimit]
      );

      return result;
    } catch (error) {
      logger.error('Failed to get recent files:', error);
      throw error;
    }
  }

  /**
   * Clear all recent files for a repository
   */
  async clearRecentFiles(repositoryPath: string): Promise<void> {
    try {
      await this.db.execute('DELETE FROM recent_files WHERE repository_path = ?', [repositoryPath]);
      logger.info(`Cleared recent files for repository: ${repositoryPath}`);
    } catch (error) {
      logger.error('Failed to clear recent files:', error);
      throw error;
    }
  }

  /**
   * Get the count of recent files for a repository
   */
  private async getFilesCount(repositoryPath: string): Promise<number> {
    try {
      const result = await this.db.select<Array<{ count: number }>>(
        'SELECT COUNT(*) as count FROM recent_files WHERE repository_path = ?',
        [repositoryPath]
      );
      return result[0]?.count ?? 0;
    } catch (error) {
      logger.error('Failed to get recent files count:', error);
      return 0;
    }
  }

  /**
   * Clean up old entries, keeping only the most recent MAX_RECENT_FILES
   * Uses ROW_NUMBER() for efficient deletion (SQLite 3.25+)
   */
  private async cleanupOldEntries(repositoryPath: string): Promise<void> {
    try {
      // Use ROW_NUMBER() to efficiently identify entries to delete
      // This is more efficient than NOT IN subquery
      await this.db.execute(
        `DELETE FROM recent_files
         WHERE repository_path = ?
         AND rowid IN (
           SELECT rowid FROM recent_files
           WHERE repository_path = ?
           ORDER BY opened_at DESC
           LIMIT -1 OFFSET ?
         )`,
        [repositoryPath, repositoryPath, this.MAX_RECENT_FILES]
      );
    } catch (error) {
      logger.error('Failed to cleanup old recent files:', error);
      // Don't throw - this is a background cleanup operation
    }
  }
}
