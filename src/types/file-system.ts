export interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileNode[];
  is_lazy_loaded?: boolean; // Indicates if children are loaded lazily
  has_children?: boolean; // Indicates if directory has children (for lazy loading)
  modified_time?: number; // File modification timestamp
  size?: number; // File size in bytes
  is_git_ignored?: boolean; // Indicates if file/directory is git-ignored (starts with .)
}

export interface OpenFile {
  path: string;
  content: string | null;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges?: boolean;
  lineNumber?: number;
}

export type LoadingPhase =
  | 'idle'
  | 'selecting'
  | 'creating-project'
  | 'building-tree'
  | 'indexing'
  | 'complete';

export interface IndexingProgress {
  phase: 'searching' | 'loading' | 'indexing' | 'saving' | 'complete';
  current: number;
  total: number;
  currentFile?: string;
}

export interface PendingExternalChange {
  filePath: string;
  diskContent: string;
}

export interface RepositoryState {
  rootPath: string | null;
  fileTree: FileNode | null;
  openFiles: OpenFile[];
  activeFileIndex: number;
  isLoading: boolean;
  error: string | null;
  expandedPaths: Set<string>;
  selectedFilePath: string | null;
  loadingPhase: LoadingPhase;
  indexingProgress: IndexingProgress | null;
  pendingExternalChange: PendingExternalChange | null;
  openRepositoryRequestId: number;
}
