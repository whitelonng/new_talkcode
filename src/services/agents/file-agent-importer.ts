/**
 * File Agent Importer
 *
 * Auto-discover local agent markdown files from:
 * - ~/.claude/agents/ (personal agents)
 * - <workspace>/.claude/agents/ (project agents)
 * - <workspace>/.talkcody/agents/ (project agents)
 */

import type { RemoteAgentConfig } from '@talkcody/shared/types/remote-agents';
import { homeDir, join, normalize } from '@tauri-apps/api/path';
import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import { getEffectiveWorkspaceRoot } from '@/services/workspace-root-service';
import { buildRemoteAgentConfig, parseAgentMarkdown } from './github-import-agent-service';

type DirEntryKey = 'isDirectory' | 'isFile';

type DirEntryFlag = boolean | (() => boolean);

function getEntryBoolean(entry: unknown, key: DirEntryKey): boolean | undefined {
  const value = (entry as Record<string, unknown>)[key] as DirEntryFlag | undefined;
  if (typeof value === 'function') {
    return value();
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function isFileEntry(entry: unknown): boolean {
  const entryType = (entry as Record<string, unknown>).type;
  if (entryType === 'file') return true;
  if (entryType === 'directory') return false;

  const isFile = getEntryBoolean(entry, 'isFile');
  if (isFile !== undefined) return isFile;

  const isDirectory = getEntryBoolean(entry, 'isDirectory');
  if (isDirectory !== undefined) return !isDirectory;

  return false;
}

export interface ClaudeCodeAgentLocation {
  path: string;
  type: 'personal' | 'project';
}

export interface ClaudeCodeAgentDirectory {
  path: string;
  type: 'personal' | 'project';
}

export interface LocalAgentImportResult {
  agents: RemoteAgentConfig[];
  errors: Array<{ path: string; error: unknown }>;
}

export class FileAgentImporter {
  static async getClaudeAgentPaths(): Promise<ClaudeCodeAgentLocation[]> {
    const paths: ClaudeCodeAgentLocation[] = [];
    const seen = new Set<string>();

    const addIfExists = async (path: string, type: ClaudeCodeAgentLocation['type']) => {
      const normalizedPath = await normalize(path);
      if (seen.has(normalizedPath)) {
        return;
      }
      if (await exists(path)) {
        paths.push({ path, type });
        seen.add(normalizedPath);
      }
    };

    try {
      const home = await homeDir();
      const personalPath = await join(home, '.claude', 'agents');
      await addIfExists(personalPath, 'personal');
    } catch (error) {
      logger.warn('Failed to check personal Claude Code agents directory:', error);
    }

    let workspaceRoot = '';
    try {
      workspaceRoot = await getEffectiveWorkspaceRoot('');
    } catch (error) {
      logger.warn('Failed to resolve workspace root for Claude Code agents:', error);
    }

    if (workspaceRoot) {
      try {
        const projectClaudePath = await join(workspaceRoot, '.claude', 'agents');
        await addIfExists(projectClaudePath, 'project');

        const projectTalkcodyPath = await join(workspaceRoot, '.talkcody', 'agents');
        await addIfExists(projectTalkcodyPath, 'project');
      } catch (error) {
        logger.warn('Failed to check project Claude Code agents directories:', error);
      }
    }

    return paths;
  }

  static async getClaudeAgentDirs(): Promise<ClaudeCodeAgentDirectory[]> {
    const locations = await FileAgentImporter.getClaudeAgentPaths();
    return locations.map((location) => ({ path: location.path, type: location.type }));
  }

  static async importAgentsFromDirectories(): Promise<LocalAgentImportResult> {
    const directories = await FileAgentImporter.getClaudeAgentDirs();
    const agents: RemoteAgentConfig[] = [];
    const errors: Array<{ path: string; error: unknown }> = [];
    const seenAgentIds = new Set<string>();

    for (const directory of directories) {
      try {
        const entries = await readDir(directory.path);
        const markdownFiles = entries.filter(
          (entry) => isFileEntry(entry) && entry.name.toLowerCase().endsWith('.md')
        );

        for (const entry of markdownFiles) {
          const filePath = await join(directory.path, entry.name);
          const content = await readTextFile(filePath);

          try {
            const parsed = parseAgentMarkdown(content);
            const fallbackId = entry.name.replace(/\.md$/i, '');
            const agentConfig = buildRemoteAgentConfig({
              parsed,
              repository: directory.type === 'personal' ? 'local-personal' : 'local-project',
              githubPath: filePath,
              fallbackId,
              defaultCategory: 'local',
            });

            if (seenAgentIds.has(agentConfig.id)) {
              continue;
            }
            seenAgentIds.add(agentConfig.id);
            agents.push(agentConfig);
          } catch (parseError) {
            logger.warn('Skipping invalid local agent markdown file:', {
              filePath,
              error: parseError,
            });
            errors.push({ path: filePath, error: parseError });
          }
        }
      } catch (error) {
        logger.warn('Failed to read local agent directory:', {
          directory: directory.path,
          error,
        });
        errors.push({ path: directory.path, error });
      }
    }

    return { agents, errors };
  }
}
