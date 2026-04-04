/**
 * Skill Package Validator
 *
 * Validates skill packages against Agent Skills Specification
 * https://agentskills.io/specification
 */

import { join, resolve } from '@tauri-apps/api/path';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import type { AgentSkillDirectory } from '@/types/agent-skills-spec';
import { AgentSkillValidator } from './agent-skill-validator';
import { SkillMdParser } from './skill-md-parser';

/**
 * Private files that should not be included in skill packages
 */
const PRIVATE_FILES = [
  '.talkcody-metadata.json',
  '.talkcody',
  '.git',
  '.vscode',
  'node_modules',
  '.DS_Store',
];

/**
 * Required and optional directories per specification
 */
const REQUIRED_DIRS = ['scripts', 'references', 'assets'];

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

/**
 * Validation warning interface
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Directory structure validation result
 */
export interface StructureValidationResult extends ValidationResult {
  directory: AgentSkillDirectory | null;
  privateFiles: string[];
  invalidSubdirectories: string[];
}

/**
 * Directory entry from Tauri fs plugin
 */
interface FsDirEntry {
  name: string;
  isDirectory?: boolean;
  isFile?: boolean;
  isSymlink?: boolean;
  path?: string;
}

/**
 * SkillPackageValidator
 *
 * Validates skill packages according to Agent Skills Specification
 */
export class SkillPackageValidator {
  /**
   * Validate a loaded skill object
   *
   * @param skill - The loaded AgentSkill object to validate
   * @returns ValidationResult with errors and warnings
   */
  static validateSkill(skill: {
    frontmatter: {
      name: string;
      description: string;
      license?: string;
      compatibility?: string;
      metadata?: Record<string, string>;
    };
    directory: { name: string; hasSkillMd: boolean };
    content: string;
  }): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate frontmatter
    const frontmatterResult = AgentSkillValidator.validate(skill.frontmatter);
    errors.push(...frontmatterResult.errors);
    warnings.push(...frontmatterResult.warnings);

    // Check directory name matches skill name
    const directoryResult = AgentSkillValidator.validateDirectoryMatch(
      skill.directory.name,
      skill.frontmatter.name
    );
    errors.push(...directoryResult);

    // Check SKILL.md exists (should always be true for loaded skill)
    if (!skill.directory.hasSkillMd) {
      errors.push({
        field: 'SKILL.md',
        message: 'SKILL.md file is required',
        rule: 'skillmd-required',
      });
    }

    // Validate content length
    const contentWarnings = AgentSkillValidator.validateContentLength(skill.content);
    warnings.push(...contentWarnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a package file (zip, tar.gz, etc.)
   *
   * Note: This method validates the extracted contents.
   *
   * @param packagePath - Path to the package file
   * @param extractedDir - Path to the extracted directory
   * @returns ValidationResult with errors and warnings
   */
  static async validatePackage(
    packagePath: string,
    extractedDir: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate the extracted directory
    const structureResult = await SkillPackageValidator.validateStructure(extractedDir);

    errors.push(...structureResult.errors);
    warnings.push(...structureResult.warnings);

    // Check for package-level issues
    if (packagePath.endsWith('.zip')) {
      // Additional zip-specific validation could go here
    } else if (packagePath.endsWith('.tar.gz') || packagePath.endsWith('.tgz')) {
      // Additional tar.gz-specific validation could go here
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Find private files in a directory
   *
   * @param dir - Directory path to scan
   * @returns Array of paths to private files
   */
  static async findPrivateFiles(dir: string): Promise<string[]> {
    const privateFiles: string[] = [];
    await SkillPackageValidator.scanDirectory(dir, privateFiles);
    return privateFiles;
  }

  /**
   * Recursively scan directory for private files
   *
   * @param dir - Directory path to scan
   * @param privateFiles - Array to collect private file paths
   */
  private static async scanDirectory(dir: string, privateFiles: string[]): Promise<void> {
    try {
      const entries = await readDir(dir);

      for (const entry of entries) {
        const fullPath = await join(dir, entry.name);

        if (PRIVATE_FILES.includes(entry.name)) {
          privateFiles.push(fullPath);
        }

        // Recursively scan subdirectories
        if (entry.isDirectory === true) {
          await SkillPackageValidator.scanDirectory(fullPath, privateFiles);
        }
      }
    } catch {
      // Ignore errors - file may not exist or be accessible
    }
  }

  /**
   * Validate the directory structure of a skill package
   *
   * @param dir - Directory path to validate
   * @returns StructureValidationResult with detailed validation results
   */
  static async validateStructure(dir: string): Promise<StructureValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const privateFiles: string[] = [];
    const invalidSubdirectories: string[] = [];

    let directoryInfo: AgentSkillDirectory | null = null;
    let skillName = '';

    try {
      const entries = await readDir(dir);
      const entryNames = entries.map((e) => e.name);

      // Check for required SKILL.md
      if (!entryNames.includes('SKILL.md')) {
        errors.push({
          field: 'SKILL.md',
          message: 'SKILL.md file is required',
          rule: 'skillmd-required',
        });
      } else {
        // Parse SKILL.md
        const skillMdPath = await join(dir, 'SKILL.md');
        try {
          const content = await readTextFile(skillMdPath);
          const parsed = SkillMdParser.parse(content);

          // Validate frontmatter
          const frontmatterResult = AgentSkillValidator.validate(parsed.frontmatter);
          errors.push(...frontmatterResult.errors);
          warnings.push(...frontmatterResult.warnings);

          skillName = parsed.frontmatter.name;

          // Check description is not empty
          if (
            !parsed.frontmatter.description ||
            parsed.frontmatter.description.trim().length === 0
          ) {
            errors.push({
              field: 'description',
              message: 'Description is required in frontmatter',
              rule: 'description-required',
            });
          }
        } catch {
          errors.push({
            field: 'SKILL.md',
            message: 'Failed to parse SKILL.md file',
            rule: 'skillmd-parse-error',
          });
        }
      }

      // Initialize directory info
      const dirName = await SkillPackageValidator.getDirectoryName(dir);
      directoryInfo = {
        name: dirName,
        path: dir,
        hasSkillMd: entryNames.includes('SKILL.md'),
        hasScriptsDir: false,
        hasReferencesDir: false,
        hasAssetsDir: false,
        scriptFiles: [],
        referenceFiles: [],
        assetFiles: [],
      };

      // Check for optional directories and validate their contents
      for (const dirName of REQUIRED_DIRS) {
        if (entryNames.includes(dirName)) {
          const subDirPath = await join(dir, dirName);
          const subDirEntries = await readDir(subDirPath);

          // Check that all entries are files, not directories
          const subdirs = subDirEntries.filter((e: FsDirEntry) => e.isDirectory === true);
          if (subdirs.length > 0) {
            const invalidNames = subdirs.map((e: FsDirEntry) => e.name).join(', ');
            invalidSubdirectories.push(`${dirName}/: ${invalidNames}`);
            errors.push({
              field: dirName,
              message: `${dirName}/ directory cannot contain subdirectories`,
              rule: 'directory-no-subdirs',
            });
          }

          // Collect file names
          const fileNames = subDirEntries
            .filter((e: FsDirEntry) => e.isFile === true || e.isDirectory !== true)
            .map((e: FsDirEntry) => e.name);

          switch (dirName) {
            case 'scripts':
              directoryInfo.hasScriptsDir = true;
              directoryInfo.scriptFiles = fileNames;
              break;
            case 'references':
              directoryInfo.hasReferencesDir = true;
              directoryInfo.referenceFiles = fileNames;
              break;
            case 'assets':
              directoryInfo.hasAssetsDir = true;
              directoryInfo.assetFiles = fileNames;
              break;
          }
        }
      }

      // Check for private files in root directory
      for (const entry of entries) {
        if (PRIVATE_FILES.includes(entry.name)) {
          privateFiles.push(entry.name);
          errors.push({
            field: entry.name,
            message: `Private file "${entry.name}" is not allowed`,
            rule: 'private-file-not-allowed',
          });
        }
      }

      // Recursively scan for private files in subdirectories
      const allPrivateFiles = await SkillPackageValidator.findPrivateFiles(dir);
      const rootPrivateFiles = privateFiles.map((f) => f.split('/').pop() || f);
      for (const privateFile of allPrivateFiles) {
        const fileName = privateFile.split('/').pop() || privateFile;
        if (!rootPrivateFiles.includes(fileName)) {
          privateFiles.push(privateFile);
        }
      }

      // Check directory name matches skill name
      if (skillName && dirName !== skillName) {
        errors.push({
          field: 'name',
          message: `Directory name "${dirName}" must match skill name "${skillName}"`,
          rule: 'name-directory-match',
        });
      }

      // Add warnings for missing optional directories
      if (!directoryInfo.hasScriptsDir) {
        warnings.push({
          field: 'scripts',
          message: 'scripts/ directory is missing',
          suggestion: 'Consider adding a scripts/ directory with executable scripts for your skill',
        });
      }

      if (!directoryInfo.hasReferencesDir) {
        warnings.push({
          field: 'references',
          message: 'references/ directory is missing',
          suggestion:
            'Consider adding a references/ directory with additional documentation and resources',
        });
      }

      if (!directoryInfo.hasAssetsDir) {
        warnings.push({
          field: 'assets',
          message: 'assets/ directory is missing',
          suggestion:
            'Consider adding an assets/ directory for supporting files like images or data',
        });
      }

      // Check if there are files in root directory (besides SKILL.md)
      const rootFiles = entryNames.filter(
        (name) =>
          name !== 'SKILL.md' && !REQUIRED_DIRS.includes(name) && !PRIVATE_FILES.includes(name)
      );
      if (rootFiles.length > 0) {
        warnings.push({
          field: 'root',
          message: `Unexpected files in root directory: ${rootFiles.join(', ')}`,
          suggestion: 'All skill files should be in scripts/, references/, or assets/ directories',
        });
      }
    } catch {
      errors.push({
        field: 'directory',
        message: `Failed to read directory: ${dir}`,
        rule: 'directory-read-error',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      directory: directoryInfo,
      privateFiles,
      invalidSubdirectories,
    };
  }

  /**
   * Get the name of a directory from its path
   *
   * @param dirPath - Directory path
   * @returns The directory name (last component of the path)
   */
  private static async getDirectoryName(dirPath: string): Promise<string> {
    try {
      const resolved = await resolve(dirPath);
      // Support both forward and backward slashes for cross-platform compatibility
      const parts = resolved.split(/[\\/]/);
      return parts[parts.length - 1] || '';
    } catch {
      // Fallback: return the last part of the path (support both separators)
      const parts = dirPath.split(/[\\/]/);
      return parts[parts.length - 1] || '';
    }
  }

  /**
   * Get list of private file names
   *
   * @returns Array of private file names
   */
  static getPrivateFileNames(): string[] {
    return [...PRIVATE_FILES];
  }

  /**
   * Check if a file is private
   *
   * @param fileName - File name to check
   * @returns True if the file is a private file
   */
  static isPrivateFile(fileName: string): boolean {
    return PRIVATE_FILES.includes(fileName);
  }

  /**
   * Validate that a directory contains only allowed content
   *
   * @param dir - Directory path to validate
   * @param allowedSubdirs - Additional allowed subdirectory names
   * @returns ValidationResult with errors and warnings
   */
  static async validateDirectoryContents(
    dir: string,
    allowedSubdirs: string[] = []
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const entries = await readDir(dir);

      // Check for disallowed subdirectories
      for (const entry of entries) {
        if (entry.isDirectory === true) {
          const subDirName = entry.name;

          // Check if it's an allowed directory
          const isAllowedDir =
            REQUIRED_DIRS.includes(subDirName) || allowedSubdirs.includes(subDirName);

          if (!isAllowedDir) {
            errors.push({
              field: subDirName,
              message: `Subdirectory "${subDirName}" is not allowed in skill package`,
              rule: 'disallowed-subdirectory',
            });
          }

          // Check that allowed directories only contain files
          if (REQUIRED_DIRS.includes(subDirName)) {
            const subDirEntries = await readDir(await join(dir, subDirName));
            const subdirs = subDirEntries.filter((e: FsDirEntry) => e.isDirectory === true);
            if (subdirs.length > 0) {
              errors.push({
                field: subDirName,
                message: `${subDirName}/ directory cannot contain subdirectories`,
                rule: 'directory-no-subdirs',
              });
            }
          }
        }
      }

      // Check for private files
      const privateFiles = await SkillPackageValidator.findPrivateFiles(dir);
      if (privateFiles.length > 0) {
        const fileNames = privateFiles.map((f) => f.split('/').pop() || f).join(', ');
        errors.push({
          field: 'private-files',
          message: `Private files not allowed: ${fileNames}`,
          rule: 'private-file-not-allowed',
        });
      }
    } catch {
      errors.push({
        field: 'directory',
        message: `Failed to read directory: ${dir}`,
        rule: 'directory-read-error',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Singleton instance for skill package validation
 */
export const skillPackageValidator = new SkillPackageValidator();
