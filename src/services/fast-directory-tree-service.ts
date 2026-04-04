// src/services/fast-directory-tree-service.ts
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import type { FileNode } from '@/types/file-system';

export interface DirectoryTreeOptions {
  maxImmediateDepth?: number; // How deep to load immediately (default: 2)
  enableCache?: boolean; // Whether to use caching (default: true)
}

export class FastDirectoryTreeService {
  private static instance: FastDirectoryTreeService;

  static getInstance(): FastDirectoryTreeService {
    if (!FastDirectoryTreeService.instance) {
      FastDirectoryTreeService.instance = new FastDirectoryTreeService();
    }
    return FastDirectoryTreeService.instance;
  }

  /**
   * Build directory tree with immediate loading of first levels
   * This provides VSCode-like experience where root + first level are immediately visible
   */
  async buildDirectoryTree(
    rootPath: string,
    options: DirectoryTreeOptions = {}
  ): Promise<FileNode> {
    const { maxImmediateDepth = 2 } = options;
    try {
      const result = await invoke<FileNode>('build_directory_tree', {
        rootPath,
        maxImmediateDepth,
      });
      return result;
    } catch (error) {
      logger.error('Failed to build directory tree:', error);
      throw new Error(`Failed to build directory tree: ${error}`);
    }
  }

  /**
   * Load children for a lazy-loaded directory
   * This is called when user expands a directory that was marked as lazy-loaded
   */
  async loadDirectoryChildren(dirPath: string): Promise<FileNode[]> {
    try {
      logger.info(`Starting Rust loadDirectoryChildren: ${dirPath}`);
      const result = await invoke<FileNode[]>('load_directory_children', {
        dirPath,
      });
      logger.info(`Completed Rust loadDirectoryChildren: ${dirPath}`);

      return result;
    } catch (error) {
      logger.error('Failed to load directory children:', error);
      throw new Error(`Failed to load directory children: ${error}`);
    }
  }

  /**
   * Clear the entire directory cache
   * Useful when file system changes are detected
   */
  async clearCache(): Promise<void> {
    try {
      await invoke('clear_directory_cache');
      // logger.info('Directory cache cleared');
    } catch (error) {
      logger.error('Failed to clear directory cache:', error);
    }
  }

  /**
   * Invalidate cache for a specific path
   * Useful when a specific directory is known to have changed
   */
  invalidatePath(path: string): void {
    try {
      invoke('invalidate_directory_path', { path });
      logger.debug(`Cache invalidated for path: ${path}`);
    } catch (error) {
      logger.error('Failed to invalidate path cache:', error);
    }
  }

  /**
   * Get directory statistics (file count, etc.)
   * This can be used to show directory info in the UI
   */
  getDirectoryStats(node: FileNode): {
    fileCount: number;
    directoryCount: number;
    totalSize: number;
  } {
    if (!(node.is_directory && node.children)) {
      return { fileCount: 0, directoryCount: 0, totalSize: 0 };
    }

    let fileCount = 0;
    let directoryCount = 0;
    let totalSize = 0;

    const countRecursive = (children: FileNode[]) => {
      for (const child of children) {
        if (child.is_directory) {
          directoryCount++;
          if (child.children) {
            countRecursive(child.children);
          }
        } else {
          fileCount++;
          totalSize += child.size || 0;
        }
      }
    };

    countRecursive(node.children);
    return { fileCount, directoryCount, totalSize };
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Format timestamp to relative time
   */
  formatRelativeTime(timestamp?: number): string {
    if (!timestamp) return 'Unknown';

    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604_800) return `${Math.floor(diff / 86_400)}d ago`;

    return new Date(timestamp * 1000).toLocaleDateString();
  }

  /**
   * Check if a node should be expanded by default
   * Useful for restoring tree state
   */
  shouldExpandByDefault(node: FileNode): boolean {
    // Expand directories that have few children or are at root level
    if (!(node.is_directory && node.children)) return false;

    // Always expand root level
    if (node.path === node.name) return true;

    // Expand small directories
    return node.children.length <= 5;
  }

  /**
   * Find a node by path in the tree
   */
  findNodeByPath(tree: FileNode, targetPath: string): FileNode | null {
    if (tree.path === targetPath) {
      return tree;
    }

    if (tree.children) {
      for (const child of tree.children) {
        const found = this.findNodeByPath(child, targetPath);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Update a node in the tree (immutable)
   */
  updateNodeInTree(tree: FileNode, targetPath: string, updatedNode: FileNode): FileNode {
    if (tree.path === targetPath) {
      return updatedNode;
    }

    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map((child) =>
          this.updateNodeInTree(child, targetPath, updatedNode)
        ),
      };
    }

    return tree;
  }

  /**
   * Get all file paths from the tree (for search functionality)
   */
  getAllFilePaths(tree: FileNode): string[] {
    const paths: string[] = [];

    const collectPaths = (node: FileNode) => {
      if (!node.is_directory) {
        paths.push(node.path);
      }

      if (node.children) {
        node.children.forEach(collectPaths);
      }
    };

    collectPaths(tree);
    return paths;
  }
}

export const fastDirectoryTreeService = FastDirectoryTreeService.getInstance();
