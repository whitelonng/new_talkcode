// src/services/lsp/lsp-servers.ts
// LSP server configurations for different languages
//
// IMPORTANT: All language mappings are derived from LSP_SERVERS.
// When adding a new language, only modify LSP_SERVERS - all other
// mappings are generated automatically.

import { dirname, normalize } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';

/**
 * Extension-specific LSP language ID mapping
 * Used when different extensions of the same server need different languageIds
 * e.g., .tsx needs 'typescriptreact' while .ts needs 'typescript'
 */
export interface ExtensionLanguageId {
  /** File extension (e.g., '.tsx') */
  extension: string;
  /** LSP languageId to send to server (e.g., 'typescriptreact') */
  lspLanguageId: string;
}

export interface LspServerConfig {
  /** Display name for the server */
  name: string;
  /** Display name for the language (for UI) */
  displayName: string;
  /** Language ID used by LSP (default for this server) */
  languageId: string;
  /** File extensions this server handles */
  extensions: string[];
  /**
   * Extension-specific languageId overrides
   * If not specified, uses languageId for all extensions
   */
  extensionLanguageIds?: ExtensionLanguageId[];
  /** Command to start the server */
  command: string;
  /** Command line arguments */
  args: string[];
  /** Root file patterns to detect project root */
  rootPatterns: string[];
}

/**
 * LSP server configurations for supported languages
 */
export const LSP_SERVERS: Record<string, LspServerConfig> = {
  typescript: {
    name: 'TypeScript Language Server',
    displayName: 'TypeScript',
    languageId: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    extensionLanguageIds: [
      { extension: '.ts', lspLanguageId: 'typescript' },
      { extension: '.tsx', lspLanguageId: 'typescriptreact' },
      { extension: '.mts', lspLanguageId: 'typescript' },
      { extension: '.cts', lspLanguageId: 'typescript' },
    ],
    command: 'typescript-language-server',
    args: ['--stdio'],
    rootPatterns: [
      'package-lock.json',
      'bun.lockb',
      'bun.lock',
      'pnpm-lock.yaml',
      'yarn.lock',
      'tsconfig.json',
      'package.json',
    ],
  },
  javascript: {
    name: 'TypeScript Language Server (JavaScript)',
    displayName: 'JavaScript',
    languageId: 'javascript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    extensionLanguageIds: [
      { extension: '.js', lspLanguageId: 'javascript' },
      { extension: '.jsx', lspLanguageId: 'javascriptreact' },
      { extension: '.mjs', lspLanguageId: 'javascript' },
      { extension: '.cjs', lspLanguageId: 'javascript' },
    ],
    command: 'typescript-language-server',
    args: ['--stdio'],
    rootPatterns: [
      'package-lock.json',
      'bun.lockb',
      'bun.lock',
      'pnpm-lock.yaml',
      'yarn.lock',
      'jsconfig.json',
      'package.json',
    ],
  },
  rust: {
    name: 'rust-analyzer',
    displayName: 'Rust',
    languageId: 'rust',
    extensions: ['.rs'],
    command: 'rust-analyzer',
    args: [],
    rootPatterns: ['Cargo.toml', 'Cargo.lock'],
  },
  python: {
    name: 'Pyright',
    displayName: 'Python',
    languageId: 'python',
    extensions: ['.py', '.pyi'],
    command: 'pyright-langserver',
    args: ['--stdio'],
    rootPatterns: [
      'pyproject.toml',
      'setup.py',
      'setup.cfg',
      'requirements.txt',
      'Pipfile',
      'pyrightconfig.json',
    ],
  },
  go: {
    name: 'gopls',
    displayName: 'Go',
    languageId: 'go',
    extensions: ['.go'],
    command: 'gopls',
    args: [],
    // go.work takes priority for multi-module workspaces
    rootPatterns: ['go.work', 'go.mod', 'go.sum'],
  },
  c: {
    name: 'clangd',
    displayName: 'C',
    languageId: 'c',
    extensions: ['.c', '.h'],
    command: 'clangd',
    args: [],
    rootPatterns: [
      'compile_commands.json',
      'compile_flags.txt',
      '.clangd',
      'CMakeLists.txt',
      'Makefile',
    ],
  },
  cpp: {
    name: 'clangd',
    displayName: 'C++',
    languageId: 'cpp',
    extensions: ['.cpp', '.cc', '.cxx', '.c++', '.hpp', '.hh', '.hxx', '.h++'],
    command: 'clangd',
    args: [],
    rootPatterns: [
      'compile_commands.json',
      'compile_flags.txt',
      '.clangd',
      'CMakeLists.txt',
      'Makefile',
    ],
  },
  vue: {
    name: 'Vue Language Server',
    displayName: 'Vue',
    languageId: 'vue',
    extensions: ['.vue'],
    command: 'vue-language-server',
    args: ['--stdio'],
    rootPatterns: [
      'package.json',
      'vite.config.ts',
      'vite.config.js',
      'vue.config.js',
      'nuxt.config.ts',
      'package-lock.json',
      'bun.lockb',
      'bun.lock',
      'pnpm-lock.yaml',
      'yarn.lock',
    ],
  },
} as const;

// ============================================================================
// Derived Constants (auto-generated from LSP_SERVERS)
// ============================================================================

/**
 * Extension to server key mapping
 * e.g., '.ts' -> 'typescript', '.tsx' -> 'typescript'
 */
export const EXTENSION_TO_SERVER: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(LSP_SERVERS).reduce(
    (acc, [serverKey, config]) => {
      for (const ext of config.extensions) {
        acc[ext] = serverKey;
      }
      return acc;
    },
    {} as Record<string, string>
  )
);

/**
 * Extension to LSP languageId mapping
 * e.g., '.ts' -> 'typescript', '.tsx' -> 'typescriptreact'
 */
export const EXTENSION_TO_LSP_LANGUAGE_ID: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(LSP_SERVERS).reduce(
    (acc, [_serverKey, config]) => {
      for (const ext of config.extensions) {
        // Check for extension-specific override
        const override = config.extensionLanguageIds?.find((e) => e.extension === ext);
        acc[ext] = override?.lspLanguageId ?? config.languageId;
      }
      return acc;
    },
    {} as Record<string, string>
  )
);

/**
 * Monaco language to server key mapping
 * e.g., 'typescript' -> 'typescript', 'typescriptreact' -> 'typescript'
 */
export const MONACO_TO_SERVER: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(LSP_SERVERS).reduce(
    (acc, [serverKey, config]) => {
      // Map the default languageId
      acc[config.languageId] = serverKey;
      // Map any extension-specific languageIds
      if (config.extensionLanguageIds) {
        for (const { lspLanguageId } of config.extensionLanguageIds) {
          acc[lspLanguageId] = serverKey;
        }
      }
      return acc;
    },
    {} as Record<string, string>
  )
);

/**
 * Server key to display name mapping
 * e.g., 'typescript' -> 'TypeScript'
 */
export const SERVER_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(LSP_SERVERS).reduce(
    (acc, [serverKey, config]) => {
      acc[serverKey] = config.displayName;
      return acc;
    },
    {} as Record<string, string>
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the language ID for a file extension
 */
export function getLanguageIdForExtension(extension: string): string | null {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return EXTENSION_TO_SERVER[ext] ?? null;
}

/**
 * Get the server key for a file path
 */
export function getLanguageIdForPath(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return EXTENSION_TO_SERVER[ext] ?? null;
}

/**
 * Get the LSP server config for a language
 */
export function getServerConfig(language: string): LspServerConfig | null {
  return LSP_SERVERS[language] || null;
}

/**
 * Check if a language has LSP support
 */
export function hasLspSupport(language: string): boolean {
  return language in LSP_SERVERS;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LSP_SERVERS);
}

/**
 * Map Monaco language ID to LSP server key (for server selection)
 */
export function monacoToLspLanguage(monacoLanguage: string): string | null {
  return MONACO_TO_SERVER[monacoLanguage] ?? null;
}

/**
 * Get the correct LSP languageId for a file path
 * This returns the proper languageId to send to the LSP server when opening a document
 * (e.g., 'typescriptreact' for .tsx files, not 'typescript')
 */
export function getLspLanguageIdForPath(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return EXTENSION_TO_LSP_LANGUAGE_ID[ext] ?? null;
}

/**
 * Get the display name for a language/server key
 */
export function getLanguageDisplayName(language: string): string {
  return SERVER_DISPLAY_NAMES[language] ?? language;
}

/**
 * Find the workspace root for a file based on rootPatterns
 * Walks up the directory tree to find the nearest directory containing a rootPattern file
 */
export async function findWorkspaceRoot(
  filePath: string,
  language: string,
  repoRoot: string
): Promise<string> {
  const config = getServerConfig(language);
  if (!config || config.rootPatterns.length === 0) {
    return repoRoot;
  }

  const normalizedFilePath = await normalize(filePath);
  const normalizedRepoRoot = await normalize(repoRoot);

  const normalizeForCompare = (value: string): string =>
    value.replace(/\\/g, '/').replace(/\/$/, '');

  const toOriginalSeparators = (value: string, template: string): string => {
    if (template.includes('\\')) {
      return value.replace(/\//g, '\\');
    }
    return value;
  };

  const repoRootComparable = normalizeForCompare(normalizedRepoRoot);

  // Start from the file's directory
  let currentDir = await dirname(normalizedFilePath);

  // Walk up until we find a rootPattern or reach repoRoot
  while (
    normalizeForCompare(currentDir).startsWith(repoRootComparable) &&
    normalizeForCompare(currentDir).length >= repoRootComparable.length
  ) {
    // Check if any rootPattern file exists in this directory
    for (const pattern of config.rootPatterns) {
      const checkPath = `${currentDir}/${pattern}`;
      const altCheckPath = checkPath.replace(/\//g, '\\');
      try {
        if (await exists(checkPath)) {
          return toOriginalSeparators(currentDir, normalizedFilePath);
        }
        if (altCheckPath !== checkPath && (await exists(altCheckPath))) {
          return toOriginalSeparators(currentDir, normalizedFilePath);
        }
      } catch {
        // File check failed, continue to next pattern
      }
    }

    // Move up one directory
    const parentDir = await dirname(currentDir);
    if (
      parentDir === currentDir ||
      normalizeForCompare(parentDir).length < repoRootComparable.length
    ) {
      break;
    }
    currentDir = parentDir;
  }

  // Fall back to repo root if no rootPattern found
  return toOriginalSeparators(repoRoot, normalizedFilePath);
}
