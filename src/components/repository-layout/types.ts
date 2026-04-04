export type FullscreenPanel = 'none' | 'editor' | 'terminal' | 'chat';

export interface PendingDeletion {
  taskId: string;
}

export interface ConflictData {
  branchName: string;
  conflictingFiles: string[];
  message?: string;
}

export interface MergeResult {
  success: boolean;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
}
