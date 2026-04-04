/**
 * Claude Code Skills Importer
 *
 * Import skills from Claude Code's skills directories:
 * - ~/.claude/skills/ (personal skills)
 * - ~/.talkcody/skills/ (personal skills)
 * - .claude/skills/ (project skills)
 * - .talkcody/skills/ (project skills)
 */

import { homeDir, join, normalize } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import { getEffectiveWorkspaceRoot } from '@/services/workspace-root-service';

export interface ClaudeCodeSkillLocation {
  path: string;
  type: 'personal' | 'project';
}

export interface ClaudeCodeSkillDirectory {
  path: string;
  type: 'personal' | 'project';
}

export interface ClaudeCodeSkillInfo {
  directoryName: string;
  hasSkillMd: boolean;
  hasReferenceMd: boolean;
  hasScriptsDir: boolean;
  scriptFiles: string[];
  sourcePath: string;
  skillName: string;
  description: string;
  isValid: boolean;
  error?: string;
}

export class ClaudeCodeImporter {
  static async getClaudeCodePaths(): Promise<ClaudeCodeSkillLocation[]> {
    const paths: ClaudeCodeSkillLocation[] = [];
    const seen = new Set<string>();

    const addIfExists = async (path: string, type: ClaudeCodeSkillLocation['type']) => {
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
      // Personal skills: ~/.claude/skills/
      const home = await homeDir();
      const personalPath = await join(home, '.claude', 'skills');
      await addIfExists(personalPath, 'personal');

      // Personal skills: ~/.talkcody/skills/
      const personalTalkcodyPath = await join(home, '.talkcody', 'skills');
      await addIfExists(personalTalkcodyPath, 'personal');
    } catch (error) {
      logger.warn('Failed to check personal Claude Code skills directory:', error);
    }

    let workspaceRoot = '';
    try {
      workspaceRoot = await getEffectiveWorkspaceRoot('');
    } catch (error) {
      logger.warn('Failed to resolve workspace root for Claude Code skills:', error);
    }

    if (workspaceRoot) {
      try {
        const projectClaudePath = await join(workspaceRoot, '.claude', 'skills');
        await addIfExists(projectClaudePath, 'project');

        const projectTalkcodyPath = await join(workspaceRoot, '.talkcody', 'skills');
        await addIfExists(projectTalkcodyPath, 'project');
      } catch (error) {
        logger.warn('Failed to check project Claude Code skills directories:', error);
      }
    }

    return paths;
  }

  /**
   * Get Claude Code skill directory paths for auto-loading
   */
  static async getClaudeCodeSkillDirs(): Promise<ClaudeCodeSkillDirectory[]> {
    const locations = await ClaudeCodeImporter.getClaudeCodePaths();
    return locations.map((location) => ({ path: location.path, type: location.type }));
  }
}
