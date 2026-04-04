/**
 * Test File System Adapter
 *
 * Uses a temporary directory for real file operations during tests.
 * Provides interfaces compatible with Tauri's plugin-fs and file-related invoke commands.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface FileSystemConfig {
  /** Custom root path (defaults to temp directory) */
  rootPath?: string;
  /** Initial files to create { relativePath: content } */
  initialFiles?: Record<string, string>;
}

export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
}

export interface SearchResult {
  name: string;
  path: string;
  is_directory: boolean;
  score: number;
}

export interface ContentSearchMatch {
  line_number: number;
  line_content: string;
}

export interface ContentSearchResult {
  file_path: string;
  matches: ContentSearchMatch[];
}

export class TestFileSystemAdapter {
  private tempDir: string;
  private isOwnTempDir: boolean;

  constructor(config: FileSystemConfig = {}) {
    if (config.rootPath) {
      this.tempDir = config.rootPath;
      this.isOwnTempDir = false;
    } else {
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talkcody-test-'));
      this.isOwnTempDir = true;
    }

    // Create initial files if provided
    if (config.initialFiles) {
      for (const [filePath, content] of Object.entries(config.initialFiles)) {
        this.createFile(filePath, content);
      }
    }
  }

  /**
   * Get the root path of the test file system
   */
  getRootPath(): string {
    return this.tempDir;
  }

  // ============================================
  // Tauri plugin-fs compatible interface
  // ============================================

  /**
   * Read text file content
   */
  async readTextFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * Write text content to file
   */
  async writeTextFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
  }

  /**
   * Read file as binary
   */
  async readFile(filePath: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(filePath);
    const buffer = fs.readFileSync(fullPath);
    return new Uint8Array(buffer);
  }

  /**
   * Write binary content to file
   */
  async writeFile(filePath: string, content: Uint8Array): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
  }

  /**
   * Check if file/directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Read directory contents
   */
  async readDir(
    dirPath: string
  ): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>> {
    const fullPath = this.resolvePath(dirPath);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }

  /**
   * Create directory
   */
  async mkdir(dirPath: string): Promise<void> {
    const fullPath = this.resolvePath(dirPath);
    fs.mkdirSync(fullPath, { recursive: true });
  }

  /**
   * Remove file or directory
   */
  async remove(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }

  /**
   * Rename/move file or directory
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    const fullOldPath = this.resolvePath(oldPath);
    const fullNewPath = this.resolvePath(newPath);
    fs.renameSync(fullOldPath, fullNewPath);
  }

  /**
   * Copy file
   */
  async copyFile(source: string, destination: string): Promise<void> {
    const fullSource = this.resolvePath(source);
    const fullDest = this.resolvePath(destination);

    const destDir = path.dirname(fullDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(fullSource, fullDest);
  }

  /**
   * Get file/directory stats
   */
  async stat(
    filePath: string
  ): Promise<{ mtime: Date; size: number; isDirectory: boolean; isFile: boolean }> {
    const fullPath = this.resolvePath(filePath);
    const stats = fs.statSync(fullPath);

    return {
      mtime: stats.mtime,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  }

  // ============================================
  // Tauri invoke commands (search_files_fast, search_file_content)
  // ============================================

  /**
   * Handle search_files_fast command
   */
  searchFiles(args: { query: string; rootPath: string; maxResults?: number }): SearchResult[] {
    const results: SearchResult[] = [];
    const query = args.query.toLowerCase();
    const searchRoot = this.resolvePath(args.rootPath);

    this.walkDir(searchRoot, (filePath, isDir) => {
      const name = path.basename(filePath);
      const lowerName = name.toLowerCase();

      if (lowerName.includes(query)) {
        // Calculate simple score based on match quality
        const score = lowerName === query ? 1.0 : lowerName.startsWith(query) ? 0.8 : 0.5;

        results.push({
          name,
          path: filePath,
          is_directory: isDir,
          score,
        });
      }
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, args.maxResults ?? 20);
  }

  /**
   * Handle search_file_content command
   */
  searchContent(args: {
    query: string;
    rootPath: string;
    fileTypes?: string[];
    excludeDirs?: string[];
  }): ContentSearchResult[] {
    const results: ContentSearchResult[] = [];
    const searchRoot = this.resolvePath(args.rootPath);

    this.walkDir(searchRoot, (filePath, isDir) => {
      if (isDir) return;

      // Check file extension filter
      if (args.fileTypes && args.fileTypes.length > 0) {
        const ext = path.extname(filePath).slice(1);
        if (!args.fileTypes.includes(ext)) return;
      }

      // Check excluded directories
      if (args.excludeDirs) {
        for (const excludeDir of args.excludeDirs) {
          if (filePath.includes(`/${excludeDir}/`) || filePath.includes(`\\${excludeDir}\\`)) {
            return;
          }
        }
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const matches: ContentSearchMatch[] = [];

        lines.forEach((line, index) => {
          if (line.includes(args.query)) {
            matches.push({
              line_number: index + 1,
              line_content: line,
            });
          }
        });

        if (matches.length > 0) {
          results.push({
            file_path: filePath,
            matches,
          });
        }
      } catch {
        // Ignore read errors (binary files, permission issues)
      }
    });

    return results;
  }

  // ============================================
  // Test utility methods
  // ============================================

  /**
   * Create a file with content (synchronous, for test setup)
   */
  createFile(relativePath: string, content: string): string {
    const fullPath = path.join(this.tempDir, relativePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
    return fullPath;
  }

  /**
   * Read a file (synchronous, for test assertions)
   */
  readFile_sync(relativePath: string): string {
    return fs.readFileSync(path.join(this.tempDir, relativePath), 'utf-8');
  }

  /**
   * Check if file exists (synchronous, for test assertions)
   */
  fileExists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.tempDir, relativePath));
  }

  /**
   * Create a directory (synchronous, for test setup)
   */
  createDir(relativePath: string): string {
    const fullPath = path.join(this.tempDir, relativePath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
  }

  /**
   * List files in directory (synchronous, for test assertions)
   */
  listFiles(relativePath: string = ''): string[] {
    const fullPath = path.join(this.tempDir, relativePath);
    if (!fs.existsSync(fullPath)) return [];

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    return entries.map((e) => e.name);
  }

  /**
   * Clean up temporary directory
   */
  cleanup(): void {
    if (this.isOwnTempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error);
      }
    }
  }

  // ============================================
  // Private helpers
  // ============================================

  /**
   * Resolve a path to absolute, within the temp directory
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      // If it's already absolute and within temp dir, use as-is
      if (filePath.startsWith(this.tempDir)) {
        return filePath;
      }
      // Otherwise, treat as relative to temp dir
      return path.join(this.tempDir, path.basename(filePath));
    }
    return path.join(this.tempDir, filePath);
  }

  /**
   * Walk directory tree recursively
   */
  private walkDir(dir: string, callback: (filePath: string, isDir: boolean) => void): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip common ignored directories
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.bun') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const isDir = entry.isDirectory();

      callback(fullPath, isDir);

      if (isDir) {
        this.walkDir(fullPath, callback);
      }
    }
  }
}
