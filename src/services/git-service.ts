import { invoke } from '@tauri-apps/api/core';
import type { FileDiff, FileStatusMap, GitStatus, LineChange } from '../types/git';

/**
 * Service layer for Git operations using Tauri commands
 */
export class GitService {
  /**
   * Gets the full Git status for a repository
   */
  async getStatus(repoPath: string): Promise<GitStatus> {
    return invoke<GitStatus>('git_get_status', { repoPath });
  }

  /**
   * Checks if a path is a Git repository
   */
  async isRepository(repoPath: string): Promise<boolean> {
    return invoke<boolean>('git_is_repository', { repoPath });
  }

  /**
   * Gets all file statuses as a map
   */
  async getAllFileStatuses(repoPath: string): Promise<FileStatusMap> {
    return invoke<FileStatusMap>('git_get_all_file_statuses', { repoPath });
  }

  /**
   * Gets line-level changes for a file (for editor gutter indicators)
   */
  async getLineChanges(repoPath: string, filePath: string): Promise<LineChange[]> {
    return invoke<LineChange[]>('git_get_line_changes', {
      repoPath,
      filePath,
    });
  }

  /**
   * Gets full diff for all changed files in the repository
   */
  async getAllFileDiffs(repoPath: string): Promise<FileDiff[]> {
    return invoke<FileDiff[]>('git_get_all_file_diffs', { repoPath });
  }

  /**
   * Gets raw diff text for all changed files (for AI commit message generation)
   * Returns text similar to `git diff` output
   */
  async getRawDiffText(repoPath: string): Promise<string> {
    return invoke<string>('git_get_raw_diff_text', { repoPath });
  }
}

// Export a singleton instance
export const gitService = new GitService();
