import { invoke } from '@tauri-apps/api/core';

export interface SymbolInfo {
  name: string;
  kind: string;
  file_path: string;
  lang_family: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
}

/**
 * Get language family for language isolation
 * C/C++ share references, TypeScript/JavaScript share references
 */
export function getLangFamily(langId: string): string {
  switch (langId) {
    case 'c':
    case 'cpp':
      return 'c_family';
    case 'typescript':
    case 'javascript':
      return 'js_family';
    case 'python':
      return 'python';
    case 'rust':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    default:
      return 'unknown';
  }
}

/**
 * Index a file for code navigation
 */
export async function indexFile(filePath: string, content: string, langId: string): Promise<void> {
  await invoke('code_nav_index_file', {
    filePath,
    content,
    langId,
  });
}

/**
 * Find definition of a symbol with language family filtering
 */
export async function findDefinition(
  symbolName: string,
  langFamily: string
): Promise<SymbolInfo[]> {
  return invoke('code_nav_find_definition', { symbolName, langFamily });
}

/**
 * Find all references of a symbol using hybrid search (ripgrep + tree-sitter filtering)
 * This approach uses text search to find all occurrences, then filters using tree-sitter
 * to exclude strings, comments, property names, object keys, etc.
 */
export async function findReferencesHybrid(
  symbolName: string,
  langFamily: string,
  rootPath: string
): Promise<SymbolInfo[]> {
  return invoke('code_nav_find_references_hybrid', { symbolName, langFamily, rootPath });
}

/**
 * Clear index for a specific file
 */
export async function clearFileIndex(filePath: string): Promise<void> {
  await invoke('code_nav_clear_file', { filePath });
}

/**
 * Clear all indexed files
 */
export async function clearAllIndex(): Promise<void> {
  await invoke('code_nav_clear_all');
}

/**
 * Batch index multiple files in parallel
 */
export async function indexFilesBatch(
  files: Array<[string, string, string]> // [filePath, content, langId]
): Promise<void> {
  await invoke('code_nav_index_files_batch', { files });
}

// ============================================================================
// Index Persistence
// ============================================================================

/**
 * Metadata about a persisted index
 */
export interface IndexMetadata {
  version: number;
  root_path: string;
  last_updated: number;
  file_count: number;
  definition_count: number;
  // Note: reference_count removed since references are now searched on-demand via hybrid search
  file_timestamps: Record<string, number>;
}

/**
 * Save the current index to disk
 */
export async function saveIndex(
  rootPath: string,
  fileTimestamps: Record<string, number>
): Promise<void> {
  await invoke('code_nav_save_index', { rootPath, fileTimestamps });
}

/**
 * Load a persisted index from disk
 * Returns true if index was loaded successfully, false if no index exists
 */
export async function loadIndex(rootPath: string): Promise<boolean> {
  return invoke('code_nav_load_index', { rootPath });
}

/**
 * Get metadata about a persisted index without loading it
 * Returns null if no index exists or index is incompatible
 */
export async function getIndexMetadata(rootPath: string): Promise<IndexMetadata | null> {
  return invoke('code_nav_get_index_metadata', { rootPath });
}

/**
 * Delete a persisted index
 */
export async function deleteIndex(rootPath: string): Promise<void> {
  await invoke('code_nav_delete_index', { rootPath });
}

/**
 * Get list of indexed files from the current in-memory index
 */
export async function getIndexedFiles(): Promise<string[]> {
  return invoke('code_nav_get_indexed_files');
}

// ============================================================================
// Code Summarization for Message Compaction
// ============================================================================

/**
 * Result of code summarization
 */
export interface CodeSummary {
  success: boolean;
  summary: string;
  original_lines: number;
  lang_id: string;
}

/**
 * Summarize code content using tree-sitter to extract only signatures and key definitions.
 * This is used for message compaction to reduce token usage while preserving semantic information.
 *
 * The summary includes:
 * - Function/method signatures with their doc comments
 * - Class/struct/interface/enum definitions (fields only, not method bodies)
 * - Type aliases
 * - Top-level constants
 *
 * @param content - The code content to summarize
 * @param langId - Language identifier (e.g., 'typescript', 'python', 'rust')
 * @param filePath - File path for error messages
 * @returns CodeSummary with success=true if summarized, success=false if unsupported language
 */
export async function summarizeCodeContent(
  content: string,
  langId: string,
  filePath: string
): Promise<CodeSummary> {
  return invoke('summarize_code_content', { content, langId, filePath });
}

// ============================================================================
// Token Estimation for Message Compaction
// ============================================================================

/**
 * Estimate token count using character-based heuristics.
 * - CJK characters: 1 char ≈ 1 token
 * - Other characters: 4 chars ≈ 1 token
 *
 * This is used to quickly check if tree-sitter compression has reduced
 * tokens enough to skip AI-based compression.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export async function estimateTokens(text: string): Promise<number> {
  return invoke('estimate_tokens', { text });
}

/**
 * Get language ID from file extension
 */
export function getLangIdFromPath(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  switch (ext) {
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
    case 'hxx':
      return 'cpp';
    case 'java':
      return 'java';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    default:
      return null;
  }
}
