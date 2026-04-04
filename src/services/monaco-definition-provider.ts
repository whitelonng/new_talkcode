import { exists } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';
import { logger } from '@/lib/logger';
import { settingsManager } from '@/stores/settings-store';
import { findDefinition, findReferencesHybrid, getLangFamily } from './code-navigation-service';
import { getLspCompletion } from './lsp/lsp-completion-provider';
import {
  getLspDefinition,
  getLspReferences,
  hasLspConnection,
} from './lsp/lsp-definition-provider';
import { uriToFilePath } from './lsp/lsp-protocol';

// Languages supported by Tree-sitter backend
const TREE_SITTER_LANGUAGES = [
  'python',
  'rust',
  'go',
  'c',
  'cpp',
  'java',
  'typescript',
  'javascript',
  'vue',
];

// Regex patterns to detect if cursor is on an import path string
const IMPORT_PATH_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"])([^'"]+)(?:['"])/,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
  ],
  javascript: [
    /(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"])([^'"]+)(?:['"])/,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
  ],
  python: [/from\s+([\w.]+)\s+import/, /import\s+([\w.]+)/],
  java: [/import\s+([\w.]+);/],
  cpp: [/#include\s*["<]([^">]+)[">]/],
  c: [/#include\s*["<]([^">]+)[">]/],
  rust: [/use\s+([\w:]+)/, /mod\s+(\w+)/],
  go: [/import\s+["']([^"']+)["']/],
  vue: [
    // Vue 3 composition API imports
    /(?:import\s+)(?:\{[^}]*\}\s+from\s+)?['"]([^'"]+)['"]/,
    // Vue imports with 'from'
    /(?:from\s+['"])([^'"]+)(?:['"])/,
    // require() style imports
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
  ],
};

/**
 * Check if the cursor position is within an import path string
 * Returns the import path if found, null otherwise
 */
function getImportPathAtPosition(
  lineContent: string,
  column: number,
  langId: string
): string | null {
  const patterns = IMPORT_PATH_PATTERNS[langId];
  if (!patterns) return null;

  for (const pattern of patterns) {
    // Reset pattern if it's global
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null = regex.exec(lineContent);

    while (match !== null) {
      const captured = match[1];
      if (captured) {
        const pathStart = match.index + match[0].indexOf(captured);
        const pathEnd = pathStart + captured.length;

        // Check if cursor column is within the import path (1-indexed)
        if (column >= pathStart + 1 && column <= pathEnd + 1) {
          return captured;
        }
      }
      match = regex.exec(lineContent);
    }
  }

  return null;
}

// Helper function to resolve relative paths
function resolvePath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/$/, '');
  const parts = normalizedBase.split('/').filter(Boolean);
  const relParts = relativePath.split('/');
  const rootPrefix = normalizedBase.startsWith('/') ? '/' : '';

  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return `${rootPrefix}${parts.join('/')}`;
}

// File extension mappings for languages without explicit extensions
const EXTENSION_MAPPINGS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'],
  javascript: ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'],
  vue: [
    '.vue',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '/index.vue',
    '/index.ts',
    '/index.tsx',
    '/index.js',
    '/index.jsx',
  ],
  python: ['.py', '/__init__.py'],
  rust: ['.rs', '/mod.rs'],
  go: ['.go'],
};

/**
 * Resolve import path to actual file path
 */
async function resolveImportPath(
  importPath: string,
  langId: string,
  currentFile: string,
  rootPath: string
): Promise<string | null> {
  const possiblePaths: string[] = [];
  const currentDir = currentFile
    ? currentFile.replace(/\\/g, '/').substring(0, currentFile.replace(/\\/g, '/').lastIndexOf('/'))
    : '';

  switch (langId) {
    case 'typescript':
    case 'javascript': {
      const extensions = EXTENSION_MAPPINGS[langId] || [];
      // Handle @/ alias -> src/
      if (importPath.startsWith('@/')) {
        const basePath = `${rootPath}/src/${importPath.slice(2)}`;
        for (const ext of extensions) {
          possiblePaths.push(`${basePath}${ext}`);
        }
        possiblePaths.push(basePath);
      }
      // Handle relative paths
      else if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const basePath = resolvePath(currentDir, importPath);
        for (const ext of extensions) {
          possiblePaths.push(`${basePath}${ext}`);
        }
        possiblePaths.push(basePath);
      }
      break;
    }
    case 'cpp':
    case 'c': {
      // Relative to current file
      possiblePaths.push(resolvePath(currentDir, importPath));
      // Relative to root
      possiblePaths.push(`${rootPath}/${importPath}`);
      // Common include directories
      possiblePaths.push(`${rootPath}/include/${importPath}`);
      possiblePaths.push(`${rootPath}/src/${importPath}`);
      break;
    }
    case 'python': {
      const modulePath = importPath.replace(/\./g, '/');
      const extensions = EXTENSION_MAPPINGS.python || [];
      for (const ext of extensions) {
        possiblePaths.push(`${rootPath}/${modulePath}${ext}`);
      }
      for (const ext of extensions) {
        possiblePaths.push(`${currentDir}/${modulePath}${ext}`);
      }
      break;
    }
    case 'rust': {
      let modulePath = importPath;
      if (modulePath.startsWith('crate::')) {
        modulePath = modulePath.substring(7);
      }
      modulePath = modulePath.replace(/::/g, '/');
      const extensions = EXTENSION_MAPPINGS.rust || [];
      for (const ext of extensions) {
        possiblePaths.push(`${rootPath}/src/${modulePath}${ext}`);
      }
      for (const ext of extensions) {
        possiblePaths.push(`${currentDir}/${modulePath}${ext}`);
      }
      break;
    }
    case 'java': {
      const filePath = importPath.replace(/\./g, '/');
      possiblePaths.push(`${rootPath}/src/main/java/${filePath}.java`);
      possiblePaths.push(`${rootPath}/src/${filePath}.java`);
      possiblePaths.push(`${rootPath}/${filePath}.java`);
      break;
    }
    case 'go': {
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        possiblePaths.push(`${rootPath}/${importPath}`);
      }
      const packageName = importPath.split('/').pop() || importPath;
      possiblePaths.push(`${rootPath}/${packageName}`);
      possiblePaths.push(`${rootPath}/pkg/${packageName}`);
      possiblePaths.push(`${rootPath}/internal/${packageName}`);
      break;
    }
    case 'vue': {
      // Vue files use the same resolution logic as TypeScript/JavaScript
      const extensions = EXTENSION_MAPPINGS.typescript || [];
      // Handle @/ alias -> src/
      if (importPath.startsWith('@/')) {
        const basePath = `${rootPath}/src/${importPath.slice(2)}`;
        // First try .vue extension
        possiblePaths.push(`${basePath}.vue`);
        // Then try other common extensions
        for (const ext of extensions) {
          possiblePaths.push(`${basePath}${ext}`);
        }
        possiblePaths.push(basePath);
      }
      // Handle relative paths
      else if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const basePath = resolvePath(currentDir, importPath);
        // First try .vue extension
        possiblePaths.push(`${basePath}.vue`);
        // Then try other common extensions
        for (const ext of extensions) {
          possiblePaths.push(`${basePath}${ext}`);
        }
        possiblePaths.push(basePath);
      }
      // Handle bare imports (node modules)
      else {
        // Try to resolve as node module
        const basePath = `${rootPath}/node_modules/${importPath}`;
        for (const ext of ['.vue', ...extensions]) {
          possiblePaths.push(`${basePath}${ext}`);
        }
        possiblePaths.push(basePath);
      }
      break;
    }
  }

  // Check each possible path and return the first one that exists
  for (const path of possiblePaths) {
    try {
      if (await exists(path)) {
        return path;
      }
    } catch {
      // Ignore errors, continue trying next path
    }
  }

  logger.debug(
    `[CodeNav] No file found for import ${importPath}, tried: ${possiblePaths.join(', ')}`
  );
  return null;
}

let providersRegistered = false;

// Cache the last definition result for Cmd+Click handling
let lastDefinitionResult: {
  word: string;
  position: { lineNumber: number; column: number };
  definitions: Array<{
    file_path: string;
    start_line: number;
    start_column: number;
  }>;
  timestamp: number;
} | null = null;

/**
 * Get the cached definition result (for Cmd+Click handler)
 * Cache is valid for 5 seconds
 */
export function getLastDefinitionResult() {
  if (lastDefinitionResult && Date.now() - lastDefinitionResult.timestamp < 5000) {
    return lastDefinitionResult;
  }
  return null;
}

/**
 * Register definition and reference providers for Tree-sitter supported languages
 */
export function registerDefinitionProviders(monaco: typeof Monaco) {
  if (providersRegistered) return;

  logger.info('[CodeNav] Registering definition providers for languages:', TREE_SITTER_LANGUAGES);

  for (const langId of TREE_SITTER_LANGUAGES) {
    // Go to Definition (F12 / Cmd+Click)
    monaco.languages.registerDefinitionProvider(langId, {
      provideDefinition: async (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const modelLangId = model.getLanguageId();
        const currentFile = model.uri.path;

        // Check if cursor is on an import path
        const importPath = getImportPathAtPosition(lineContent, position.column, modelLangId);
        if (importPath) {
          logger.info('[CodeNav] Cursor is on import path:', importPath);

          // Try to resolve the import path to an actual file
          const rootPath = settingsManager.getCurrentRootPath();
          if (rootPath) {
            const resolvedPath = await resolveImportPath(
              importPath,
              modelLangId,
              currentFile,
              rootPath
            );
            if (resolvedPath) {
              logger.info('[CodeNav] Resolved import path to:', resolvedPath);

              // Cache the result for Cmd+Click handler
              lastDefinitionResult = {
                word: importPath,
                position: { lineNumber: position.lineNumber, column: position.column },
                definitions: [
                  {
                    file_path: resolvedPath,
                    start_line: 1,
                    start_column: 1,
                  },
                ],
                timestamp: Date.now(),
              };

              // Return the resolved file location
              return {
                uri: monaco.Uri.file(resolvedPath),
                range: new monaco.Range(1, 1, 1, 1),
              };
            }
          }

          logger.info('[CodeNav] Could not resolve import path');
          return null;
        }

        const word = model.getWordAtPosition(position);
        logger.info(
          '[CodeNav] provideDefinition called for:',
          word?.word,
          'at',
          position.lineNumber,
          position.column
        );
        if (!word) return null;

        // ========================================
        // Try LSP first (more accurate, type-aware)
        // ========================================
        if (hasLspConnection(currentFile)) {
          try {
            // LSP uses 0-indexed line/character, Monaco uses 1-indexed
            const lspLine = position.lineNumber - 1;
            const lspChar = position.column - 1;

            logger.info(`[CodeNav] Trying LSP definition for ${currentFile}:${lspLine}:${lspChar}`);
            const lspResult = await getLspDefinition(currentFile, lspLine, lspChar);

            if (lspResult && lspResult.length > 0) {
              // Filter out definitions at the current position
              const filteredLspResults = lspResult.filter((loc) => {
                const defPath = uriToFilePath(loc.uri);
                const defLine = loc.range.start.line + 1; // Convert to 1-indexed
                return !(defPath === currentFile && defLine === position.lineNumber);
              });

              if (filteredLspResults.length > 0) {
                // Cache the result for Cmd+Click handler
                lastDefinitionResult = {
                  word: word.word,
                  position: { lineNumber: position.lineNumber, column: position.column },
                  definitions: filteredLspResults.map((loc) => ({
                    file_path: uriToFilePath(loc.uri),
                    start_line: loc.range.start.line + 1,
                    start_column: loc.range.start.character + 1,
                  })),
                  timestamp: Date.now(),
                };

                const result = filteredLspResults.map((loc) => ({
                  uri: monaco.Uri.file(uriToFilePath(loc.uri)),
                  range: new monaco.Range(
                    loc.range.start.line + 1,
                    loc.range.start.character + 1,
                    loc.range.end.line + 1,
                    loc.range.end.character + 1
                  ),
                }));

                logger.info('[CodeNav] LSP returned definition locations:', result.length);
                return result;
              }
            }
            logger.info('[CodeNav] LSP returned no results, falling back to Tree-sitter');
          } catch (error) {
            logger.warn('[CodeNav] LSP definition failed, falling back to Tree-sitter:', error);
          }
        }

        // ========================================
        // Fallback to Tree-sitter
        // ========================================
        try {
          const langFamily = getLangFamily(modelLangId);
          const definitions = await findDefinition(word.word, langFamily);
          logger.info(
            '[CodeNav] findDefinition (Tree-sitter) returned:',
            definitions.length,
            'results for',
            word.word,
            'in lang family',
            langFamily
          );
          if (definitions.length === 0) return null;

          // Filter out definitions at the current position (clicking on definition itself should not jump)
          const filteredDefinitions = definitions.filter((def) => {
            // If definition is in the same file and on the same line, skip it
            if (def.file_path === currentFile && def.start_line === position.lineNumber) {
              return false;
            }
            return true;
          });

          if (filteredDefinitions.length === 0) {
            logger.info('[CodeNav] All definitions filtered out (cursor is on definition)');
            return null;
          }

          // Cache the result for Cmd+Click handler
          lastDefinitionResult = {
            word: word.word,
            position: { lineNumber: position.lineNumber, column: position.column },
            definitions: filteredDefinitions.map((def) => ({
              file_path: def.file_path,
              start_line: def.start_line,
              start_column: def.start_column,
            })),
            timestamp: Date.now(),
          };

          // Always return definition locations - let Monaco show the link
          // The actual navigation is handled by our onMouseDown handler
          const result = filteredDefinitions.map((def) => ({
            uri: monaco.Uri.file(def.file_path),
            range: new monaco.Range(def.start_line, def.start_column, def.end_line, def.end_column),
          }));
          logger.info('[CodeNav] Returning definition locations:', result);
          return result;
        } catch (error) {
          logger.error('[CodeNav] Error finding definition:', error);
          return null;
        }
      },
    });

    // Find References (Shift+F12)
    monaco.languages.registerReferenceProvider(langId, {
      provideReferences: async (model, position, _context) => {
        const word = model.getWordAtPosition(position);
        const modelLangId = model.getLanguageId();
        const currentFile = model.uri.path;
        logger.info('[CodeNav] provideReferences called for:', word?.word);

        if (!word) return [];

        // ========================================
        // Try LSP first (more accurate, type-aware)
        // ========================================
        if (hasLspConnection(currentFile)) {
          try {
            // LSP uses 0-indexed line/character, Monaco uses 1-indexed
            const lspLine = position.lineNumber - 1;
            const lspChar = position.column - 1;

            logger.info(`[CodeNav] Trying LSP references for ${currentFile}:${lspLine}:${lspChar}`);
            const lspResult = await getLspReferences(currentFile, lspLine, lspChar);

            if (lspResult && lspResult.length > 0) {
              const result = lspResult.map((loc) => ({
                uri: monaco.Uri.file(uriToFilePath(loc.uri)),
                range: new monaco.Range(
                  loc.range.start.line + 1,
                  loc.range.start.character + 1,
                  loc.range.end.line + 1,
                  loc.range.end.character + 1
                ),
              }));

              logger.info('[CodeNav] LSP returned references:', result.length);
              return result;
            }
            logger.info('[CodeNav] LSP returned no references, falling back to Tree-sitter');
          } catch (error) {
            logger.warn('[CodeNav] LSP references failed, falling back to Tree-sitter:', error);
          }
        }

        // ========================================
        // Fallback to Tree-sitter + ripgrep hybrid
        // ========================================
        try {
          const langFamily = getLangFamily(modelLangId);
          const rootPath = settingsManager.getCurrentRootPath();

          if (!rootPath) {
            logger.warn('[CodeNav] No root path set, cannot find references');
            return [];
          }

          // Use hybrid search: ripgrep text search + tree-sitter filtering
          const references = await findReferencesHybrid(word.word, langFamily, rootPath);
          logger.info(
            '[CodeNav] findReferencesHybrid (Tree-sitter) returned:',
            references.length,
            'results for',
            word.word,
            'in lang family',
            langFamily
          );

          return references.map((ref) => ({
            uri: monaco.Uri.file(ref.file_path),
            range: new monaco.Range(ref.start_line, ref.start_column, ref.end_line, ref.end_column),
          }));
        } catch (error) {
          logger.error('[CodeNav] Error finding references:', error);
          return [];
        }
      },
    });

    // Code Completion via LSP (replaces Monaco's built-in TypeScript worker)
    monaco.languages.registerCompletionItemProvider(langId, {
      triggerCharacters: ['.', ':', '<', '"', "'", '/', '@', '(', ' '],

      provideCompletionItems: async (model, position, context) => {
        const currentFile = model.uri.path;

        if (!hasLspConnection(currentFile)) {
          return { suggestions: [] };
        }

        try {
          const lspLine = position.lineNumber - 1;
          const lspChar = position.column - 1;

          // Map Monaco trigger kind to LSP
          let triggerKind: number | undefined;
          let triggerCharacter: string | undefined;

          if (context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter) {
            triggerKind = 2; // LSP TriggerCharacter
            triggerCharacter = context.triggerCharacter;
          } else if (context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke) {
            triggerKind = 1; // LSP Invoked
          }

          const completions = await getLspCompletion(
            currentFile,
            lspLine,
            lspChar,
            triggerKind,
            triggerCharacter
          );

          if (!completions || completions.length === 0) {
            return { suggestions: [] };
          }

          // Map LSP CompletionItem to Monaco CompletionItem
          const suggestions = completions.map((item) => {
            // Map LSP CompletionItemKind to Monaco CompletionItemKind
            const kindMap: Record<number, Monaco.languages.CompletionItemKind> = {
              1: monaco.languages.CompletionItemKind.Text,
              2: monaco.languages.CompletionItemKind.Method,
              3: monaco.languages.CompletionItemKind.Function,
              4: monaco.languages.CompletionItemKind.Constructor,
              5: monaco.languages.CompletionItemKind.Field,
              6: monaco.languages.CompletionItemKind.Variable,
              7: monaco.languages.CompletionItemKind.Class,
              8: monaco.languages.CompletionItemKind.Interface,
              9: monaco.languages.CompletionItemKind.Module,
              10: monaco.languages.CompletionItemKind.Property,
              11: monaco.languages.CompletionItemKind.Unit,
              12: monaco.languages.CompletionItemKind.Value,
              13: monaco.languages.CompletionItemKind.Enum,
              14: monaco.languages.CompletionItemKind.Keyword,
              15: monaco.languages.CompletionItemKind.Snippet,
              16: monaco.languages.CompletionItemKind.Color,
              17: monaco.languages.CompletionItemKind.File,
              18: monaco.languages.CompletionItemKind.Reference,
              19: monaco.languages.CompletionItemKind.Folder,
              20: monaco.languages.CompletionItemKind.EnumMember,
              21: monaco.languages.CompletionItemKind.Constant,
              22: monaco.languages.CompletionItemKind.Struct,
              23: monaco.languages.CompletionItemKind.Event,
              24: monaco.languages.CompletionItemKind.Operator,
              25: monaco.languages.CompletionItemKind.TypeParameter,
            };

            const monacoKind = item.kind
              ? kindMap[item.kind] || monaco.languages.CompletionItemKind.Text
              : monaco.languages.CompletionItemKind.Text;

            // Get documentation as string
            let documentation: string | undefined;
            if (typeof item.documentation === 'string') {
              documentation = item.documentation;
            } else if (item.documentation?.value) {
              documentation = item.documentation.value;
            }

            return {
              label: item.label,
              kind: monacoKind,
              detail: item.detail,
              documentation,
              insertText: item.insertText || item.label,
              insertTextRules:
                item.insertTextFormat === 2
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
              sortText: item.sortText,
              filterText: item.filterText,
              preselect: item.preselect,
            } as Monaco.languages.CompletionItem;
          });

          return { suggestions };
        } catch (error) {
          logger.error('[CodeNav] LSP completion error:', error);
          return { suggestions: [] };
        }
      },
    });
  }

  providersRegistered = true;
}
