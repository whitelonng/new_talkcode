// src/services/repository-service.ts

import { invoke } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import {
  copyFile,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  stat,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import type { FileNode } from '@/types/file-system';
import { fastDirectoryTreeService } from './fast-directory-tree-service';
import {
  getFileExtension,
  getFileNameFromPath,
  getLanguageFromExtension,
  getRelativePath,
  isCodeFile,
  shouldSkipDirectory,
} from './repository-utils';

interface SearchMatch {
  line_number: number;
  line_content: string;
  byte_offset: number;
}

interface SearchResult {
  file_path: string;
  matches: SearchMatch[];
}

interface CachedFile {
  content: string;
  modifiedTime: number;
}

export class RepositoryService {
  private fileCache = new Map<string, CachedFile>();
  private maxCacheSize = 50;

  async selectRepositoryFolder(): Promise<string | null> {
    const path = await open({
      directory: true,
      multiple: false,
      title: 'Select Repository Folder',
    });

    return path as string | null;
  }

  async buildDirectoryTree(path: string, maxDepth = 100, currentDepth = 0): Promise<FileNode> {
    // Use the new high-performance Rust implementation
    return fastDirectoryTreeService.buildDirectoryTree(path, {
      maxImmediateDepth: Math.min(maxDepth - currentDepth, 2), // Load first 2 levels immediately
      enableCache: true,
    });
  }

  async getAllFiles(repositoryPath: string): Promise<string[]> {
    try {
      const files: string[] = [];
      await this.collectAllFiles(repositoryPath, files, 0, 5);
      return files;
    } catch (error) {
      logger.error('Failed to get all files:', error);
      return [];
    }
  }

  async readFileContent(filePath: string): Promise<string> {
    return this.readFileWithCache(filePath);
  }

  getRelativePath(fullPath: string, repositoryPath: string): string {
    return getRelativePath(fullPath, repositoryPath);
  }

  private async collectAllFiles(
    dirPath: string,
    files: string[],
    depth = 0,
    maxDepth = 5
  ): Promise<void> {
    if (depth >= maxDepth) return;

    try {
      const entries = await readDir(dirPath);

      for (const entry of entries) {
        const entryPath = await join(dirPath, entry.name);

        if (entry.isDirectory) {
          if (!shouldSkipDirectory(entry.name)) {
            await this.collectAllFiles(entryPath, files, depth + 1, maxDepth);
          }
        } else if (isCodeFile(entry.name)) {
          files.push(entryPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to collect files in directory: ${dirPath}`, error);
    }
  }

  async getFlatFileList(repositoryPath: string): Promise<FileNode[]> {
    const allFiles = await this.getAllFiles(repositoryPath);
    return allFiles.map((filePath) => ({
      name: getFileNameFromPath(filePath),
      path: filePath,
      is_directory: false,
    }));
  }

  async readFile(rootPath: string, filePath: string): Promise<string> {
    const fullPath = await join(rootPath, filePath);
    return await this.readFileWithCache(fullPath);
  }

  async readFileWithCache(filePath: string): Promise<string> {
    try {
      // Get current file stats
      const fileStats = await stat(filePath);
      const currentModifiedTime = fileStats.mtime?.getTime() || 0;

      // Check cache and validate timestamp
      const cachedFile = this.fileCache.get(filePath);
      if (cachedFile && cachedFile.modifiedTime === currentModifiedTime) {
        // logger.info(`Using cached content for: ${filePath}`); // Debug log
        return cachedFile.content;
      }

      // File not in cache or has been modified, read from disk
      // logger.info(`Reading file from disk: ${filePath}`); // Debug log
      const content = await readTextFile(filePath);

      // Add to cache with LRU eviction
      if (this.fileCache.size >= this.maxCacheSize) {
        const firstKey = this.fileCache.keys().next().value;
        if (firstKey) {
          this.fileCache.delete(firstKey);
        }
      }

      // Store content with timestamp
      this.fileCache.set(filePath, {
        content,
        modifiedTime: currentModifiedTime,
      });

      return content;
    } catch (error) {
      logger.error(`Failed to read file: ${filePath}`, error);
      throw new Error(`Failed to read file: ${filePath}`);
    }
  }

  async isFileModifiedSinceCache(filePath: string): Promise<boolean> {
    try {
      const cachedFile = this.fileCache.get(filePath);
      if (!cachedFile) {
        return true; // Not cached, consider as modified
      }

      const fileStats = await stat(filePath);
      const currentModifiedTime = fileStats.mtime?.getTime() || 0;
      return currentModifiedTime !== cachedFile.modifiedTime;
    } catch (error) {
      logger.error(`Failed to check file modification: ${filePath}`, error);
      return true; // If we can't check, assume it's modified
    }
  }

  async searchFiles(rootPath: string, query: string): Promise<FileNode[]> {
    try {
      // Use the new high-performance Rust file search
      const results: Array<{
        name: string;
        path: string;
        is_directory: boolean;
        score: number;
      }> = await invoke('search_files_fast', {
        query: query.trim(),
        rootPath: rootPath,
        maxResults: 20,
      });

      // Convert to FileNode format
      return results.map((result) => ({
        name: result.name,
        path: result.path,
        is_directory: result.is_directory,
        children: undefined,
      }));
    } catch (error) {
      logger.error('Rust file search failed, falling back to JS implementation:', error);

      // Fallback to the original JavaScript implementation
      const results: FileNode[] = [];
      await this.searchInDirectory(rootPath, query.toLowerCase(), results, 0, 5);
      return results.slice(0, 100);
    }
  }

  async checkFileExists(filePath: string): Promise<boolean> {
    try {
      return await exists(filePath);
    } catch {
      return false;
    }
  }

  getFileNameFromPath(path: string): string {
    return getFileNameFromPath(path);
  }

  getFileExtension(filename: string): string {
    return getFileExtension(filename);
  }

  getLanguageFromExtension(filename: string): string {
    return getLanguageFromExtension(filename);
  }

  private async searchInDirectory(
    dirPath: string,
    query: string,
    results: FileNode[],
    depth = 0,
    maxDepth = 5
  ): Promise<void> {
    if (depth >= maxDepth) return;

    try {
      const entries = await readDir(dirPath);

      for (const entry of entries) {
        const entryPath = await join(dirPath, entry.name);

        if (entry.name.toLowerCase().includes(query)) {
          results.push({
            name: entry.name,
            path: entryPath,
            is_directory: entry.isDirectory,
            children: undefined,
          });
        }

        if (entry.isDirectory && !shouldSkipDirectory(entry.name)) {
          await this.searchInDirectory(entryPath, query, results, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      logger.error(`Failed to search in directory: ${dirPath}`, error);
    }
  }

  // Create a new file or directory
  async createFile(parentPath: string, fileName: string, isDirectory: boolean): Promise<void> {
    try {
      const filePath = await join(parentPath, fileName);

      if (isDirectory) {
        // Create directory
        await mkdir(filePath, { recursive: true });
      } else {
        // Create empty file
        // First ensure parent directory exists
        const parentDir = await dirname(filePath);
        if (!(await exists(parentDir))) {
          await mkdir(parentDir, { recursive: true });
        }
        // Create empty file
        await writeTextFile(filePath, '');
      }

      logger.info(`${isDirectory ? 'Directory' : 'File'} created:`, filePath);
    } catch (error) {
      logger.error('Error creating file/directory:', error);
      throw new Error(
        `Failed to create ${isDirectory ? 'directory' : 'file'}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Rename a file or directory
  async renameFile(oldPath: string, newName: string): Promise<void> {
    try {
      const parentDir = await dirname(oldPath);
      const newPath = await join(parentDir, newName);

      // Check if target already exists
      if (await exists(newPath)) {
        throw new Error(`A file or directory named "${newName}" already exists`);
      }

      await rename(oldPath, newPath);

      // Update cache
      if (this.fileCache.has(oldPath)) {
        const cachedData = this.fileCache.get(oldPath);
        this.fileCache.delete(oldPath);
        if (cachedData) {
          this.fileCache.set(newPath, cachedData);
        }
      }

      logger.info('File/directory renamed:', oldPath, '->', newPath);
    } catch (error) {
      logger.error('Error renaming file/directory:', error);
      throw new Error(
        `Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Move a file or directory to a new location (supports cross-directory moves)
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Check if source exists
      if (!(await exists(sourcePath))) {
        throw new Error('Source file/directory does not exist');
      }

      // Check if destination already exists
      if (await exists(destinationPath)) {
        throw new Error(`A file or directory already exists at "${destinationPath}"`);
      }

      await rename(sourcePath, destinationPath);

      // Update cache
      if (this.fileCache.has(sourcePath)) {
        const cachedData = this.fileCache.get(sourcePath);
        this.fileCache.delete(sourcePath);
        if (cachedData) {
          this.fileCache.set(destinationPath, cachedData);
        }
      }

      logger.info('File/directory moved:', sourcePath, '->', destinationPath);
    } catch (error) {
      logger.error('Error moving file/directory:', error);
      throw new Error(
        `Failed to move: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Clear file cache for testing purposes
  clearCache(): void {
    this.fileCache.clear();
  }

  getCacheSize(): number {
    return this.fileCache.size;
  }

  async searchFileContent(query: string, rootPath: string): Promise<any[]> {
    if (!query.trim()) {
      return [];
    }

    try {
      const startTime = Date.now();
      const results: SearchResult[] = await invoke('search_file_content', {
        query: query.trim(),
        rootPath,
      });
      const endTime = Date.now();
      logger.info(`searchFileContent took ${endTime - startTime}ms`);

      // Transform results to match existing interface
      return results.map((result) => ({
        filePath: result.file_path,
        matches: result.matches.map((match) => ({
          lineNumber: match.line_number,
          lineContent: match.line_content,
        })),
      }));
    } catch (error) {
      logger.error('Ripgrep search failed, falling back to slow search:', error);

      // Fallback to the original slow method if ripgrep fails
      return [];
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = await dirname(filePath);
      try {
        await mkdir(dir, { recursive: true });
      } catch (_error) {
        // Directory might already exist
      }

      await writeTextFile(filePath, content);

      // Update cache
      const fileStats = await stat(filePath);
      const modifiedTime = fileStats.mtime?.getTime() || Date.now();
      this.fileCache.set(filePath, {
        content,
        modifiedTime,
      });

      logger.info(`File written: ${filePath} (${content.length} bytes)`);
    } catch (error) {
      logger.error(`Failed to write file: ${filePath}`, error);
      throw new Error(`Failed to write file: ${filePath}`);
    }
  }

  async updateFile(filePath: string, content: string): Promise<void> {
    await this.writeFile(filePath, content);
  }

  async copyFileOrDirectory(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Check if source exists
      const sourceExists = await this.checkFileExists(sourcePath);
      if (!sourceExists) {
        throw new Error('Source file/directory does not exist');
      }

      // Get source file stats to check if it's a directory
      const sourceStats = await stat(sourcePath);

      if (sourceStats.isDirectory) {
        // For directories, we need to recursively copy
        await this.copyDirectoryRecursive(sourcePath, destinationPath);
      } else {
        // For files, use the built-in copyFile
        await copyFile(sourcePath, destinationPath);
        logger.info('File copied:', sourcePath, '->', destinationPath);
      }
    } catch (error) {
      logger.error('Error copying file/directory:', error);
      throw new Error(
        `Failed to copy: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async copyDirectoryRecursive(sourceDir: string, destinationDir: string): Promise<void> {
    try {
      // Create destination directory
      await mkdir(destinationDir, { recursive: true });

      // Read source directory contents
      const entries = await readDir(sourceDir);

      for (const entry of entries) {
        const sourcePath = await join(sourceDir, entry.name);
        const destinationPath = await join(destinationDir, entry.name);

        if (entry.isDirectory) {
          // Recursively copy subdirectory
          await this.copyDirectoryRecursive(sourcePath, destinationPath);
        } else {
          // Copy file
          await copyFile(sourcePath, destinationPath);
        }
      }

      logger.info('Directory copied:', sourceDir, '->', destinationDir);
    } catch (error) {
      logger.error('Error copying directory:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    let fileStats: any = null;
    try {
      // Check if file exists before attempting to delete
      const fileExists = await this.checkFileExists(filePath);
      if (!fileExists) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      // Check if it's a directory to determine delete strategy
      fileStats = await stat(filePath);
      const isDirectory = fileStats.isDirectory;

      // Delete the file from filesystem
      if (isDirectory) {
        // For directories, use recursive delete
        await remove(filePath, { recursive: true });
      } else {
        // For files, use normal delete
        await remove(filePath);
      }

      // Remove from cache if it was cached
      this.fileCache.delete(filePath);

      logger.info(`${isDirectory ? 'Directory' : 'File'} deleted successfully: ${filePath}`);
    } catch (error) {
      const itemType = fileStats?.isDirectory ? 'directory' : 'file';
      logger.error(`Failed to delete ${itemType}: ${filePath}`, error);
      throw new Error(`Failed to delete ${itemType}: ${filePath}`);
    }
  }

  invalidateCache(filePath?: string): void {
    if (filePath) {
      this.fileCache.delete(filePath);
    } else {
      this.fileCache.clear();
    }
  }
}

export const repositoryService = new RepositoryService();
