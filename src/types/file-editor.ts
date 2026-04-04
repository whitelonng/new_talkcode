import type { IPosition } from 'monaco-editor';

export interface FileEditorProps {
  filePath: string | null;
  fileContent: string | null;
  error: string | null;
  isLoading: boolean;
  hasUnsavedChanges?: boolean;
  onContentChange?: (content: string) => void;
  onFileSaved?: (filePath: string) => void;
  lineNumber?: number;
  onGlobalSearch?: () => void; // Add this prop
}

export interface AICompletionState {
  completion: string;
  position: IPosition;
  triggerTime: number;
}

export interface EditorState {
  currentContent: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSavedTime: Date | null;
  isUserTyping: boolean;
  isAICompleting: boolean;
  currentAICompletion: AICompletionState | null;
}
