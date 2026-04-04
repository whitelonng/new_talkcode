// src/services/task-file-service.ts

import { join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import { getEffectiveWorkspaceRoot } from './workspace-root-service';

export type FileType = 'output' | 'plan' | 'context' | 'tool';

/**
 * TaskFileService - Unified task file storage service
 *
 * All files are stored in the .talkcody/ subdirectory of the project root:
 * {projectRoot}/.talkcody/{type}/{taskId}/{fileName}
 */
export class TaskFileService {
  private static instance: TaskFileService | null = null;

  static getInstance(): TaskFileService {
    if (!TaskFileService.instance) {
      TaskFileService.instance = new TaskFileService();
    }
    return TaskFileService.instance;
  }

  /**
   * Get the base path of the .talkcody directory
   */
  private async getBaseDir(taskId: string): Promise<string> {
    const workspaceRoot = await getEffectiveWorkspaceRoot(taskId);
    return join(workspaceRoot, '.talkcody');
  }

  /**
   * Get the directory path for a specific type
   */
  private async getTypeDirectory(type: FileType, taskId: string): Promise<string> {
    const baseDir = await this.getBaseDir(taskId);
    const typeDir = await join(baseDir, type, taskId);

    if (!(await exists(typeDir))) {
      try {
        await mkdir(typeDir, { recursive: true });
      } catch (error) {
        logger.error(`Failed to create directory ${typeDir}:`, error);
        throw new Error(
          `Failed to create task file directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return typeDir;
  }

  // ============ Output Operations ============

  /**
   * Save tool output to a file
   */
  async saveOutput(
    taskId: string,
    toolUseId: string,
    content: string,
    suffix?: string
  ): Promise<string> {
    // Sanitize toolUseId for use in file name to prevent path traversal
    const sanitizedToolUseId = this.sanitizeFileName(toolUseId || 'unknown');
    const safeSuffix = suffix ? this.ensureSafeFileName(suffix) : undefined;

    const typeDir = await this.getTypeDirectory('output', taskId);
    const fileName = safeSuffix
      ? `${sanitizedToolUseId}_${safeSuffix}.log`
      : `${sanitizedToolUseId}.log`;
    const filePath = await join(typeDir, fileName);

    await writeTextFile(filePath, content);
    logger.info(`Saved output to: ${filePath}`);
    return filePath;
  }

  /**
   * Sanitize file name to prevent path traversal and invalid characters
   */
  private sanitizeFileName(fileName: string): string {
    const safeName = fileName || 'unknown';
    return safeName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.\./g, '_')
      .trim();
  }

  private ensureSafeFileName(fileName: string): string {
    const safeFileName = this.sanitizeFileName(fileName);
    if (safeFileName !== fileName) {
      throw new Error('Invalid file name');
    }
    return safeFileName;
  }

  /**
   * Read tool output file
   */
  async getOutput(taskId: string, toolUseId: string, suffix?: string): Promise<string | null> {
    const sanitizedToolUseId = this.sanitizeFileName(toolUseId || 'unknown');
    const safeSuffix = suffix ? this.ensureSafeFileName(suffix) : undefined;
    const workspaceRoot = await getEffectiveWorkspaceRoot(taskId);
    const fileName = safeSuffix
      ? `${sanitizedToolUseId}_${safeSuffix}.log`
      : `${sanitizedToolUseId}.log`;
    const filePath = await join(workspaceRoot, '.talkcody', 'output', taskId, fileName);

    try {
      return await readTextFile(filePath);
    } catch (error) {
      logger.error(`Error reading output file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Remove a specific output file
   */
  async removeOutput(taskId: string, toolUseId: string, suffix?: string): Promise<boolean> {
    try {
      const sanitizedToolUseId = this.sanitizeFileName(toolUseId || 'unknown');
      const safeSuffix = suffix ? this.ensureSafeFileName(suffix) : undefined;
      const workspaceRoot = await getEffectiveWorkspaceRoot(taskId);
      const fileName = safeSuffix
        ? `${sanitizedToolUseId}_${safeSuffix}.log`
        : `${sanitizedToolUseId}.log`;
      const filePath = await join(workspaceRoot, '.talkcody', 'output', taskId, fileName);

      if (await exists(filePath)) {
        await remove(filePath);
        logger.info(`Removed output file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error removing output file:`, error);
      return false;
    }
  }

  // ============ Generic File Operations ============

  /**
   * Write arbitrary file
   */
  async writeFile(
    type: FileType,
    taskId: string,
    fileName: string,
    content: string
  ): Promise<string> {
    const typeDir = await this.getTypeDirectory(type, taskId);
    const safeFileName = this.ensureSafeFileName(fileName);
    const filePath = await join(typeDir, safeFileName);
    await writeTextFile(filePath, content);
    logger.info(`Wrote file: ${filePath}`);
    return filePath;
  }

  /**
   * Read arbitrary file
   */
  async readFile(type: FileType, taskId: string, fileName: string): Promise<string | null> {
    const workspaceRoot = await getEffectiveWorkspaceRoot(taskId);
    const safeFileName = this.ensureSafeFileName(fileName);
    const filePath = await join(workspaceRoot, '.talkcody', type, taskId, safeFileName);

    try {
      if (!(await exists(filePath))) {
        return null;
      }
      return await readTextFile(filePath);
    } catch (error) {
      logger.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  // ============ Cleanup Operations ============

  /**
   * Clean up all files for a specific task (only removes task-specific subdirectories)
   */
  async cleanupTask(taskId: string): Promise<void> {
    try {
      const workspaceRoot = await getEffectiveWorkspaceRoot(taskId);
      const fileTypes: FileType[] = ['output', 'plan', 'context', 'tool'];

      for (const type of fileTypes) {
        const taskDir = await join(workspaceRoot, '.talkcody', type, taskId);
        if (await exists(taskDir)) {
          await this.removeDirectory(taskDir);
          logger.info(`Cleaned up ${type} directory for task ${taskId}`);
        }
      }
    } catch (error) {
      logger.error(`Error cleaning up task ${taskId}:`, error);
    }
  }

  /**
   * Clean up files for a specific type
   */
  async cleanupType(type: FileType, taskId: string): Promise<void> {
    try {
      const workspaceRoot = await getEffectiveWorkspaceRoot(taskId);
      const typeDir = await join(workspaceRoot, '.talkcody', type, taskId);

      if (await exists(typeDir)) {
        await this.removeDirectory(typeDir);
        logger.info(`Cleaned up ${type} directory for task ${taskId}`);
      }
    } catch (error) {
      logger.error(`Error cleaning up ${type} for task ${taskId}:`, error);
    }
  }

  private static readonly MAX_DIRECTORY_DEPTH = 10;

  private async removeDirectory(dirPath: string, depth = 0): Promise<void> {
    if (depth > TaskFileService.MAX_DIRECTORY_DEPTH) {
      logger.warn(
        `Max directory depth (${TaskFileService.MAX_DIRECTORY_DEPTH}) exceeded, stopping removal at: ${dirPath}`
      );
      return;
    }

    const entries = await readDir(dirPath);
    for (const entry of entries) {
      const entryPath = await join(dirPath, entry.name || '');
      if (this.isDirectory(entry)) {
        await this.removeDirectory(entryPath, depth + 1);
      } else {
        await remove(entryPath);
      }
    }
    await remove(dirPath);
  }

  /**
   * Check if a directory entry is a directory
   * Note: Type check depends on Tauri plugin-fs version, using any to be compatible
   */
  private isDirectory(entry: unknown): boolean {
    const e = entry as Record<string, unknown>;
    // Check for type property (exists in some Tauri versions)
    if (typeof e.type === 'string' && e.type === 'directory') {
      return true;
    }
    // Check for isDirectory property (exists in other Tauri versions)
    if (e.isDirectory === true) {
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const taskFileService = TaskFileService.getInstance();
