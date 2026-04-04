// src/services/monaco-link-provider.ts
// Provides import/include path clicking support for Monaco editor

import { exists } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';
import { logger } from '@/lib/logger';
import { settingsManager } from '@/stores/settings-store';

const GO_IMPORT_SINGLE = /(?:^|\n)\s*import\s+(?:[\w.]+\s+)?["']([^"']+)["']/g;
const GO_IMPORT_BLOCK = /(?:^|\n)\s*import\s*\(([^)]*)\)/g;
const GO_IMPORT_BLOCK_LINE = /\s*(?:[\w.]+\s+)?["']([^"']+)["']/g;

export function extractGoImportMatches(
  content: string
): Array<{ start: number; importPath: string }> {
  const matches: Array<{ start: number; importPath: string }> = [];

  GO_IMPORT_SINGLE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GO_IMPORT_SINGLE.exec(content)) !== null) {
    if (!match[1]) continue;
    const pathStart = match[0].indexOf(match[1]);
    if (pathStart === -1) continue;
    matches.push({ start: match.index + pathStart, importPath: match[1] });
  }

  GO_IMPORT_BLOCK.lastIndex = 0;
  while ((match = GO_IMPORT_BLOCK.exec(content)) !== null) {
    const block = match[1] ?? '';
    GO_IMPORT_BLOCK_LINE.lastIndex = 0;
    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = GO_IMPORT_BLOCK_LINE.exec(block)) !== null) {
      if (!lineMatch[1]) continue;
      const pathStart = lineMatch[0].indexOf(lineMatch[1]);
      if (pathStart === -1) continue;
      const blockStartOffset = match.index + match[0].indexOf(block);
      matches.push({
        start: blockStartOffset + lineMatch.index + pathStart,
        importPath: lineMatch[1],
      });
    }
  }

  return matches;
}

// Import patterns for each language
const LANGUAGE_IMPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    // import { x } from 'path' or import 'path'
    /(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"])([^'"]+)(?:['"])/g,
    // require('path')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // import('path')
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
  javascript: [
    /(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"])([^'"]+)(?:['"])/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
  java: [
    // import com.package.Class;
    /import\s+([\w.]+);/g,
  ],
  cpp: [
    // #include "file.h" or #include <file.h>
    /#include\s*["<]([^">]+)[">]/g,
  ],
  c: [/#include\s*["<]([^">]+)[">]/g],
  python: [
    // from module.submodule import something
    /from\s+([\w.]+)\s+import/g,
    // import module.submodule
    /import\s+([\w.]+)/g,
  ],
  rust: [
    // use crate::module::submodule
    /use\s+([\w:]+)/g,
    // mod module_name
    /mod\s+(\w+)/g,
  ],
  go: [],
  vue: [
    // import { xxx } from 'path'
    /(?:import\s+\{[^}]*\}\s+from\s+['"])([^'"]+)(?:['"])/g,
    // import 'path' or import "path"
    /(?:import\s+['"])([^'"]+)(?:['"])/g,
    // import path from 'path'
    /(?:import\s+\w+\s+from\s+['"])([^'"]+)(?:['"])/g,
  ],
};

// File extension mappings for languages without explicit extensions
const EXTENSION_MAPPINGS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'],
  javascript: ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'],
  python: ['.py', '/__init__.py'],
  rust: ['.rs', '/mod.rs'],
  go: ['.go'],
};

interface PathResolverContext {
  importPath: string;
  rootPath: string;
  currentFile: string;
}

type PathResolver = (ctx: PathResolverContext) => string[];

// Path resolvers that return possible file paths to try
const PATH_RESOLVERS: Record<string, PathResolver> = {
  typescript: ({ importPath, rootPath, currentFile }) => {
    const paths: string[] = [];
    const extensions = EXTENSION_MAPPINGS.typescript || [];
    const normalizedCurrentFile = currentFile.replace(/\\/g, '/');

    // Handle @/ alias -> src/
    if (importPath.startsWith('@/')) {
      const basePath = `${rootPath}/src/${importPath.slice(2)}`;
      // Try with extensions
      for (const ext of extensions) {
        paths.push(`${basePath}${ext}`);
      }
      // Try as-is (might already have extension)
      paths.push(basePath);
    }
    // Handle relative paths
    else if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/'));
      const basePath = resolvePath(currentDir, importPath);
      for (const ext of extensions) {
        paths.push(`${basePath}${ext}`);
      }
      paths.push(basePath);
    }
    // Handle node_modules or absolute paths (skip these)
    return paths;
  },

  javascript: ({ importPath, rootPath, currentFile }) => {
    // Same logic as TypeScript
    const tsResolver = PATH_RESOLVERS.typescript;
    return tsResolver ? tsResolver({ importPath, rootPath, currentFile }) : [];
  },

  java: ({ importPath, rootPath }) => {
    // com.package.Class -> multiple possible paths
    const filePath = importPath.replace(/\./g, '/');
    return [
      `${rootPath}/src/main/java/${filePath}.java`,
      `${rootPath}/src/${filePath}.java`,
      `${rootPath}/${filePath}.java`,
    ];
  },

  cpp: ({ importPath, rootPath, currentFile }) => {
    const paths: string[] = [];
    // Relative to current file
    const normalizedCurrentFile = currentFile.replace(/\\/g, '/');
    const currentDir = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/'));
    paths.push(resolvePath(currentDir, importPath));
    // Relative to root
    paths.push(`${rootPath}/${importPath}`);
    // Common include directories
    paths.push(`${rootPath}/include/${importPath}`);
    paths.push(`${rootPath}/src/${importPath}`);
    return paths;
  },

  c: ({ importPath, rootPath, currentFile }) => {
    // Same as C++
    const cppResolver = PATH_RESOLVERS.cpp;
    return cppResolver ? cppResolver({ importPath, rootPath, currentFile }) : [];
  },

  python: ({ importPath, rootPath, currentFile }) => {
    const paths: string[] = [];
    const modulePath = importPath.replace(/\./g, '/');
    const extensions = EXTENSION_MAPPINGS.python || [];

    // Relative to root
    for (const ext of extensions) {
      paths.push(`${rootPath}/${modulePath}${ext}`);
    }
    // Relative to current file's directory
    const normalizedCurrentFile = currentFile.replace(/\\/g, '/');
    const currentDir = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/'));
    for (const ext of extensions) {
      paths.push(`${currentDir}/${modulePath}${ext}`);
    }
    return paths;
  },

  rust: ({ importPath, rootPath, currentFile }) => {
    const paths: string[] = [];
    // Handle crate:: prefix
    let modulePath = importPath;
    if (modulePath.startsWith('crate::')) {
      modulePath = modulePath.substring(7);
    }
    modulePath = modulePath.replace(/::/g, '/');
    const extensions = EXTENSION_MAPPINGS.rust || [];

    // Relative to src
    for (const ext of extensions) {
      paths.push(`${rootPath}/src/${modulePath}${ext}`);
    }
    // Relative to current file
    const normalizedCurrentFile = currentFile.replace(/\\/g, '/');
    const currentDir = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/'));
    for (const ext of extensions) {
      paths.push(`${currentDir}/${modulePath}${ext}`);
    }
    return paths;
  },

  go: ({ importPath, rootPath }) => {
    const paths: string[] = [];
    // Handle local imports (starting with ./)
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      paths.push(`${rootPath}/${importPath}`);
    }
    // For package imports, try common locations
    const packageName = importPath.split('/').pop() || importPath;
    paths.push(`${rootPath}/${packageName}`);
    paths.push(`${rootPath}/pkg/${packageName}`);
    paths.push(`${rootPath}/internal/${packageName}`);
    return paths;
  },
};

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

// Store disposables for cleanup
let linkProviderDisposables: Monaco.IDisposable[] = [];

/**
 * Register import/include link providers for all supported languages
 */
export function registerImportLinkProviders(monaco: typeof Monaco) {
  const rootPath = settingsManager.getCurrentRootPath();
  if (!rootPath) {
    logger.info('[LinkProvider] No root path available, skipping registration');
    return;
  }

  // Dispose any existing providers
  disposeImportLinkProviders();

  logger.info('[LinkProvider] Registering import link providers for root:', rootPath);

  for (const [langId, patterns] of Object.entries(LANGUAGE_IMPORT_PATTERNS)) {
    const disposable = monaco.languages.registerLinkProvider(langId, {
      provideLinks: (model) => {
        const links: Monaco.languages.ILink[] = [];
        const content = model.getValue();
        const currentFile = model.uri.path;

        if (langId === 'go') {
          for (const match of extractGoImportMatches(content)) {
            const startPos = model.getPositionAt(match.start);
            const endPos = model.getPositionAt(match.start + match.importPath.length);

            links.push({
              range: new monaco.Range(
                startPos.lineNumber,
                startPos.column,
                endPos.lineNumber,
                endPos.column
              ),
              url: undefined,
              data: {
                importPath: match.importPath,
                langId,
                rootPath,
                currentFile,
              },
            } as Monaco.languages.ILink);
          }

          logger.debug(`[LinkProvider] Found ${links.length} import links in ${langId} file`);
          return { links };
        }

        for (const pattern of patterns) {
          // Reset regex state
          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = pattern.exec(content)) !== null) {
            const importPath = match[1];
            if (!importPath) continue;

            const fullMatch = match[0];
            const pathStart = fullMatch.indexOf(importPath);
            if (pathStart === -1) continue;

            const startOffset = match.index + pathStart;
            const startPos = model.getPositionAt(startOffset);
            const endPos = model.getPositionAt(startOffset + importPath.length);

            links.push({
              range: new monaco.Range(
                startPos.lineNumber,
                startPos.column,
                endPos.lineNumber,
                endPos.column
              ),
              // URL will be resolved in resolveLink
              url: undefined,
              // Store data for resolution
              data: { importPath, langId, rootPath, currentFile },
            } as Monaco.languages.ILink);
          }
        }

        logger.debug(`[LinkProvider] Found ${links.length} import links in ${langId} file`);
        return { links };
      },

      resolveLink: async (link) => {
        const data = (link as any).data as PathResolverContext & { langId: string };
        if (!data) return link;

        const { importPath, langId, rootPath: dataRootPath, currentFile } = data;
        const resolver = PATH_RESOLVERS[langId];

        if (resolver) {
          const possiblePaths = resolver({
            importPath,
            rootPath: dataRootPath,
            currentFile,
          });

          // Check each possible path and return the first one that exists
          for (const path of possiblePaths) {
            try {
              if (await exists(path)) {
                logger.info(`[LinkProvider] Resolved ${importPath} to ${path}`);
                // Use Monaco URI format so that clicking triggers openCodeEditor callback
                // instead of Monaco's default file:// handling which doesn't work in Tauri
                return {
                  ...link,
                  url: monaco.Uri.file(path).toString(),
                };
              }
            } catch {
              // Ignore errors, continue trying next path
            }
          }

          // Log if no existing file was found
          logger.debug(
            `[LinkProvider] No existing file found for ${importPath}, tried: ${possiblePaths.join(', ')}`
          );
        }

        return link;
      },
    });

    linkProviderDisposables.push(disposable);
  }

  logger.info(
    `[LinkProvider] Registered providers for ${Object.keys(LANGUAGE_IMPORT_PATTERNS).length} languages`
  );
}

/**
 * Dispose all registered link providers
 */
export function disposeImportLinkProviders() {
  for (const disposable of linkProviderDisposables) {
    disposable.dispose();
  }
  linkProviderDisposables = [];
}
