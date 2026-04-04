// packages/shared/src/types/share-tools.ts
// Tool-specific output types for share feature

/**
 * ReadFile tool output structure
 */
export interface ReadFileOutput {
  file_path: string;
  content: string;
}

/**
 * WriteFile tool output structure
 */
export interface WriteFileOutput {
  file_path: string;
  content: string;
}

/**
 * Diff line for EditFile tool
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
  originalLineNumber?: number;
  newLineNumber?: number;
}

/**
 * EditFile tool output structure
 */
export interface EditFileOutput {
  file_path: string;
  diff: DiffLine[];
  stats: {
    added: number;
    removed: number;
  };
}

/**
 * Todo item structure
 */
export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * TodoWrite tool output structure
 */
export interface TodoWriteOutput {
  todos: TodoItem[];
}

/**
 * CodeSearch tool output structure
 */
export interface CodeSearchOutput {
  success: boolean;
  result: string;
  error?: string;
}

/**
 * Type guards
 */
export function isReadFileOutput(output: unknown): output is ReadFileOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'file_path' in output &&
    'content' in output &&
    typeof (output as ReadFileOutput).file_path === 'string' &&
    typeof (output as ReadFileOutput).content === 'string'
  );
}

export function isWriteFileOutput(output: unknown): output is WriteFileOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'file_path' in output &&
    'content' in output &&
    typeof (output as WriteFileOutput).file_path === 'string' &&
    typeof (output as WriteFileOutput).content === 'string'
  );
}

export function isEditFileOutput(output: unknown): output is EditFileOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'file_path' in output &&
    'diff' in output &&
    'stats' in output &&
    Array.isArray((output as EditFileOutput).diff)
  );
}

export function isTodoWriteOutput(output: unknown): output is TodoWriteOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'todos' in output &&
    Array.isArray((output as TodoWriteOutput).todos)
  );
}

export function isCodeSearchOutput(output: unknown): output is CodeSearchOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'success' in output &&
    'result' in output &&
    typeof (output as CodeSearchOutput).success === 'boolean' &&
    typeof (output as CodeSearchOutput).result === 'string'
  );
}
