/**
 * Local Skill Importer
 * Imports skills from local file system directories
 */

import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, exists, mkdir, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import { getAgentSkillService } from './agent-skill-service';
import { SkillMdParser } from './skill-md-parser';

export interface LocalImportResult {
  success: boolean;
  skillName?: string;
  installedPath?: string;
  message: string;
}

/**
 * Import a skill from a local directory
 * Opens a directory picker, validates SKILL.md, and copies to skills directory
 */
export async function importSkillFromLocal(): Promise<LocalImportResult> {
  // Open directory selection dialog
  const selectedPath = await open({
    directory: true,
    multiple: false,
    title: 'Select Skill Directory',
  });

  if (!selectedPath || typeof selectedPath !== 'string') {
    return {
      success: false,
      message: 'No directory selected',
    };
  }

  return await importSkillFromPath(selectedPath);
}

/**
 * Import a skill from a specific local path
 */
export async function importSkillFromPath(sourcePath: string): Promise<LocalImportResult> {
  // Check if SKILL.md exists
  const skillMdPath = await join(sourcePath, 'SKILL.md');
  if (!(await exists(skillMdPath))) {
    return {
      success: false,
      message: 'Selected directory does not contain a SKILL.md file',
    };
  }

  try {
    // Read and validate SKILL.md
    const skillMdContent = await readTextFile(skillMdPath);
    const parsed = SkillMdParser.parse(skillMdContent, {
      validate: true,
      logWarnings: true,
    });

    if (!parsed.frontmatter.name) {
      return {
        success: false,
        message: 'SKILL.md is missing required "name" field',
      };
    }

    // Get skills directory
    const agentService = await getAgentSkillService();
    const skillsDir = await agentService.getSkillsDirPath();

    // Determine target directory name from skill name
    const { AgentSkillValidator } = await import('./agent-skill-validator');
    const normalizedName = AgentSkillValidator.normalizeName(parsed.frontmatter.name);
    const targetPath = await join(skillsDir, normalizedName);

    // Check if skill already exists
    if (await exists(targetPath)) {
      return {
        success: false,
        message: `Skill "${parsed.frontmatter.name}" already exists at ${targetPath}`,
      };
    }

    // Create target directory
    await mkdir(targetPath, { recursive: true });

    // Copy all files recursively
    await copyDirectoryContents(sourcePath, targetPath);

    logger.info('Successfully imported local skill:', {
      name: parsed.frontmatter.name,
      source: sourcePath,
      target: targetPath,
    });

    return {
      success: true,
      skillName: parsed.frontmatter.name,
      installedPath: targetPath,
      message: `Successfully imported skill "${parsed.frontmatter.name}"`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to import local skill:', error);
    return {
      success: false,
      message: `Failed to import skill: ${errorMessage}`,
    };
  }
}

/**
 * Recursively copy directory contents
 */
async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
  const entries = await readDir(sourcePath);

  for (const entry of entries) {
    const sourceItemPath = await join(sourcePath, entry.name);
    const targetItemPath = await join(targetPath, entry.name);

    if (entry.isDirectory) {
      await mkdir(targetItemPath, { recursive: true });
      await copyDirectoryContents(sourceItemPath, targetItemPath);
    } else if (entry.isFile) {
      await copyFile(sourceItemPath, targetItemPath);
    }
  }
}
