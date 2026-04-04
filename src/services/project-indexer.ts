import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import type { IndexingProgress } from '@/types/file-system';
import {
  clearAllIndex,
  clearFileIndex,
  getIndexedFiles,
  getIndexMetadata,
  indexFile,
  indexFilesBatch,
  loadIndex,
  saveIndex,
} from './code-navigation-service';
import { getLanguageFromExtension } from './repository-utils';

// Languages supported by Tree-sitter backend
const SUPPORTED_LANGUAGES = [
  'python',
  'rust',
  'go',
  'c',
  'cpp',
  'java',
  'typescript',
  'javascript',
];

// File extensions for supported languages (used for glob patterns)
const SUPPORTED_EXTENSIONS = ['py', 'rs', 'go', 'c', 'cpp', 'h', 'java', 'ts', 'tsx', 'js', 'jsx'];

// Batch size for indexing files
const BATCH_SIZE = 50;

interface GlobResult {
  path: string;
  is_directory: boolean;
  modified_time: number;
}

class ProjectIndexer {
  private indexingInProgress = false;
  private progressCallback?: (progress: IndexingProgress) => void;
  // Internal state for indexed files (per project path)
  private indexedFilesMap = new Map<string, Set<string>>();
  private currentProjectPath: string | null = null;

  // Get indexed files for current project
  private getIndexedFiles(): Set<string> {
    if (!this.currentProjectPath) return new Set();
    if (!this.indexedFilesMap.has(this.currentProjectPath)) {
      this.indexedFilesMap.set(this.currentProjectPath, new Set());
    }
    return this.indexedFilesMap.get(this.currentProjectPath)!;
  }

  // Set indexed files for current project
  private setIndexedFiles(files: Set<string>): void {
    if (!this.currentProjectPath) return;
    this.indexedFilesMap.set(this.currentProjectPath, files);
  }

  // Add indexed file for current project
  private addIndexedFile(path: string): void {
    this.getIndexedFiles().add(path);
  }

  // Add indexed files for current project
  private addIndexedFiles(paths: string[]): void {
    const files = this.getIndexedFiles();
    for (const path of paths) {
      files.add(path);
    }
  }

  // Remove indexed file for current project
  private removeIndexedFile(path: string): void {
    this.getIndexedFiles().delete(path);
  }

  // Clear indexed files for current project
  private clearIndexedFiles(): void {
    if (this.currentProjectPath) {
      this.indexedFilesMap.set(this.currentProjectPath, new Set());
    }
  }

  // Check if file is indexed for current project
  private isFileIndexed(path: string): boolean {
    return this.getIndexedFiles().has(path);
  }

  /**
   * Set a callback to receive indexing progress updates
   */
  setProgressCallback(callback: (progress: IndexingProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Clear the progress callback
   */
  clearProgressCallback(): void {
    this.progressCallback = undefined;
  }

  /**
   * Report progress to the callback if set
   */
  private reportProgress(progress: IndexingProgress): void {
    this.progressCallback?.(progress);
  }

  /**
   * Check if a language is supported for indexing
   */
  isSupported(langId: string): boolean {
    return SUPPORTED_LANGUAGES.includes(langId);
  }

  /**
   * Index all supported files in a project using glob patterns
   * This method uses the Rust backend to efficiently find all files
   * Optimized with parallel glob search, batch indexing, and persistence
   */
  async indexProjectByPath(rootPath: string): Promise<void> {
    if (this.indexingInProgress) {
      logger.info('Indexing already in progress, skipping...');
      return;
    }

    this.indexingInProgress = true;
    this.currentProjectPath = rootPath;
    const startTime = Date.now();
    logger.info(`Starting project indexing for: ${rootPath}`);

    try {
      // Report searching phase
      this.reportProgress({ phase: 'searching', current: 0, total: SUPPORTED_EXTENSIONS.length });

      // Search for all extensions in PARALLEL instead of sequentially
      // Note: For indexing, we need ALL matching files, not just a limited sample.
      // The glob search already respects .gitignore to exclude node_modules, etc.
      // Default max_results is 100 which is too low for indexing - we need all files.
      const globPromises = SUPPORTED_EXTENSIONS.map((ext) =>
        invoke<GlobResult[]>('search_files_by_glob', {
          pattern: `**/*.${ext}`,
          path: rootPath,
          maxResults: 999999, // Effectively unlimited - rely on .gitignore filtering
        }).catch((error) => {
          logger.error(`Failed to search for *.${ext} files:`, error);
          return [] as GlobResult[];
        })
      );

      const results = await Promise.all(globPromises);

      // Flatten results and filter directories, keep timestamps
      const allFilesWithTimestamps = results.flat().filter((r) => !r.is_directory);

      // Build current file timestamps map
      const currentTimestamps: Record<string, number> = {};
      for (const file of allFilesWithTimestamps) {
        currentTimestamps[file.path] = file.modified_time;
      }

      const allFiles = allFilesWithTimestamps.map((r) => r.path);
      const totalFiles = allFiles.length;
      logger.info(`Found ${totalFiles} files (glob took ${Date.now() - startTime}ms)`);

      if (totalFiles === 0) {
        this.reportProgress({ phase: 'complete', current: 0, total: 0 });
        return;
      }

      // Try to load persisted index
      const metadata = await getIndexMetadata(rootPath);
      let filesToIndex: string[] = [];
      const filesToRemove: string[] = [];

      if (metadata) {
        // Report loading phase
        this.reportProgress({ phase: 'loading', current: 0, total: 1 });
        logger.info(
          `Found persisted index with ${metadata.file_count} files, checking for changes...`
        );

        // Load the persisted index into memory
        const loaded = await loadIndex(rootPath);
        if (loaded) {
          // Calculate changed files
          const persistedTimestamps = metadata.file_timestamps;

          // Find new or modified files
          for (const filePath of allFiles) {
            const currentTime = currentTimestamps[filePath] ?? 0;
            const persistedTime = persistedTimestamps[filePath] ?? 0;

            if (persistedTime === 0 || currentTime > persistedTime) {
              filesToIndex.push(filePath);
            }
          }

          // Find deleted files
          for (const filePath of Object.keys(persistedTimestamps)) {
            if (!currentTimestamps[filePath]) {
              filesToRemove.push(filePath);
            }
          }

          logger.info(
            `Incremental update: ${filesToIndex.length} changed, ${filesToRemove.length} deleted, ${allFiles.length - filesToIndex.length} unchanged`
          );

          // Update store with loaded indexed files
          const indexedFiles = await getIndexedFiles();
          const indexedFilesSet = new Set(indexedFiles);
          this.setIndexedFiles(indexedFilesSet);

          // Also check for files that have timestamps but weren't actually indexed
          // This can happen if indexing failed for some files
          for (const filePath of allFiles) {
            if (!indexedFilesSet.has(filePath)) {
              // File exists but wasn't indexed - add to filesToIndex
              if (!filesToIndex.includes(filePath)) {
                filesToIndex.push(filePath);
              }
            }
          }

          if (filesToIndex.length > 0) {
            logger.info(
              `Found ${filesToIndex.length} files that need (re)indexing (including files with timestamps but not in index)`
            );
          }

          // Remove deleted files from index
          for (const filePath of filesToRemove) {
            await clearFileIndex(filePath);
            this.removeIndexedFile(filePath);
          }
        } else {
          // Index load failed, fall back to full index
          logger.warn('Failed to load persisted index, performing full index');
          filesToIndex = allFiles;
        }
      } else {
        // No persisted index, index all files
        logger.info('No persisted index found, performing full index');
        filesToIndex = allFiles;
      }

      // Index the files that need updating
      if (filesToIndex.length > 0) {
        const indexStartTime = Date.now();
        let processedCount = 0;

        for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
          const batch = filesToIndex.slice(i, i + BATCH_SIZE);

          // Report progress
          this.reportProgress({
            phase: 'indexing',
            current: processedCount,
            total: filesToIndex.length,
            currentFile: batch[0],
          });

          // Clear existing index for files being re-indexed
          for (const filePath of batch) {
            if (this.isFileIndexed(filePath)) {
              await clearFileIndex(filePath);
              this.removeIndexedFile(filePath);
            }
          }

          // Read all files in the batch in parallel
          const filesWithContent = await Promise.all(
            batch.map(async (filePath) => {
              const lang = getLanguageFromExtension(filePath);
              if (!SUPPORTED_LANGUAGES.includes(lang)) {
                return null;
              }

              try {
                const content = await readTextFile(filePath);
                return [filePath, content, lang] as [string, string, string];
              } catch (error) {
                logger.debug(`Failed to read file: ${filePath}`, error);
                return null;
              }
            })
          );

          // Filter out null values and index the batch
          const validFiles = filesWithContent.filter(
            (f): f is [string, string, string] => f !== null
          );

          if (validFiles.length > 0) {
            try {
              await indexFilesBatch(validFiles);
              // Mark files as indexed in store (triggers UI update)
              const indexedPaths = validFiles.map(([filePath]) => filePath);
              this.addIndexedFiles(indexedPaths);
            } catch (error) {
              logger.error('Batch indexing failed, falling back to individual indexing:', error);
              // Fallback to individual indexing if batch fails
              for (const [filePath, content, lang] of validFiles) {
                try {
                  await indexFile(filePath, content, lang);
                  this.addIndexedFile(filePath);
                } catch (e) {
                  logger.debug(`Failed to index file: ${filePath}`, e);
                }
              }
            }
          }

          processedCount += batch.length;
        }

        const indexTime = Date.now() - indexStartTime;
        logger.info(`Indexed ${filesToIndex.length} files in ${indexTime}ms`);
      }

      // Save the index with timestamps of ONLY indexed files
      // This ensures files that failed to index will be retried next time
      this.reportProgress({ phase: 'saving', current: 0, total: 1 });
      const indexedFilesArray = Array.from(this.getIndexedFiles());
      const indexedTimestamps: Record<string, number> = {};
      for (const filePath of indexedFilesArray) {
        if (currentTimestamps[filePath] !== undefined) {
          indexedTimestamps[filePath] = currentTimestamps[filePath];
        }
      }
      await saveIndex(rootPath, indexedTimestamps);

      const totalTime = Date.now() - startTime;
      const indexedCount = this.getIndexedFiles().size;
      logger.info(`Project indexing complete: ${indexedCount} files (total: ${totalTime}ms)`);

      // Report completion
      this.reportProgress({ phase: 'complete', current: totalFiles, total: totalFiles });
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Index all supported files in a project (legacy method, kept for compatibility)
   */
  async indexProject(files: string[]): Promise<void> {
    if (this.indexingInProgress) {
      logger.info('Indexing already in progress, skipping...');
      return;
    }

    this.indexingInProgress = true;
    logger.info(`Starting project indexing for ${files.length} files...`);

    try {
      const filesToIndex = files.filter((f) => {
        const lang = getLanguageFromExtension(f);
        return SUPPORTED_LANGUAGES.includes(lang);
      });

      logger.info(`Found ${filesToIndex.length} files to index`);

      // Index files sequentially to avoid overwhelming the backend
      for (const filePath of filesToIndex) {
        await this.indexSingleFile(filePath);
      }

      logger.info(`Indexed ${this.getIndexedFiles().size} files`);
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Index a single file (internal method)
   */
  private async indexSingleFile(filePath: string): Promise<void> {
    if (this.isFileIndexed(filePath)) {
      return;
    }

    const lang = getLanguageFromExtension(filePath);
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return;
    }

    try {
      const content = await readTextFile(filePath);
      await indexFile(filePath, content, lang);
      this.addIndexedFile(filePath);
    } catch (error) {
      logger.error(`Failed to index file: ${filePath}`, error);
    }
  }

  /**
   * Index a single file (public method for external use)
   */
  async indexFile(filePath: string): Promise<void> {
    await this.indexSingleFile(filePath);
  }

  /**
   * Re-index a file (when it changes)
   */
  async reindexFile(filePath: string): Promise<void> {
    const lang = getLanguageFromExtension(filePath);
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return;
    }

    try {
      await clearFileIndex(filePath);
      this.removeIndexedFile(filePath);
      await this.indexSingleFile(filePath);
    } catch (error) {
      logger.error(`Failed to reindex file: ${filePath}`, error);
    }
  }

  /**
   * Remove a file from the index
   */
  async removeFile(filePath: string): Promise<void> {
    try {
      await clearFileIndex(filePath);
      this.removeIndexedFile(filePath);
    } catch (error) {
      logger.error(`Failed to remove file from index: ${filePath}`, error);
    }
  }

  /**
   * Clear all indexed files
   */
  async clearAll(): Promise<void> {
    try {
      await clearAllIndex();
      this.clearIndexedFiles();
    } catch (error) {
      logger.error('Failed to clear index:', error);
    }
  }

  /**
   * Get count of indexed files
   */
  getIndexedCount(): number {
    return this.getIndexedFiles().size;
  }

  /**
   * Check if a file is indexed
   */
  isIndexed(filePath: string): boolean {
    return this.isFileIndexed(filePath);
  }

  /**
   * Check if indexing is currently in progress
   */
  isIndexing(): boolean {
    return this.indexingInProgress;
  }
}

// Export singleton instance
export const projectIndexer = new ProjectIndexer();
