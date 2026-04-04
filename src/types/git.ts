/**
 * Git type definitions matching Rust backend types
 */

export enum GitFileStatus {
  Modified = 'modified',
  Added = 'added',
  Deleted = 'deleted',
  Renamed = 'renamed',
  Untracked = 'untracked',
  Conflicted = 'conflicted',
}

export interface FileStatus {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isHead: boolean;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
}

export interface GitStatus {
  branch: BranchInfo | null;
  modified: FileStatus[];
  staged: FileStatus[];
  untracked: string[];
  conflicted: string[];
  changesCount: number;
}

export enum DiffLineType {
  Addition = 'addition',
  Deletion = 'deletion',
  Context = 'context',
}

export interface DiffLine {
  lineType: DiffLineType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath: string | null;
  status: GitFileStatus;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
}

// Helper types for UI components
export type LineChange = [number, DiffLineType];

export interface FileStatusMap {
  [path: string]: [GitFileStatus, boolean]; // [status, isStaged]
}
