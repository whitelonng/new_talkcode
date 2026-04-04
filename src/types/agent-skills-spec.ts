/**
 * Agent Skills Specification Types
 * Based on https://agentskills.io/specification
 *
 * This file contains type definitions that strictly follow the Agent Skills Specification.
 * No TalkCody-specific extensions are included to ensure full interoperability.
 */

/**
 * Directory entry type for file system operations
 * Matches Tauri plugin-fs DirEntry type
 */
export interface DirEntry {
  name: string;
  children?: DirEntry[];
}

/**
 * Standard frontmatter as per Agent Skills Specification
 *
 * Required fields:
 * - name: 1-64 chars, lowercase, hyphens, no consecutive --, no leading/trailing -
 * - description: 1-1024 chars, describes what the skill does and when to use it
 *
 * Optional fields:
 * - license: License name or reference to a bundled license file
 * - compatibility: Environment requirements (max 500 chars)
 * - metadata: Arbitrary key-value mapping for additional metadata
 * - allowed-tools: Space-delimited list of pre-approved tools (experimental)
 */
export interface AgentSkillFrontmatter {
  // Required fields
  name: string;
  description: string;

  // Optional fields
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  'allowed-tools'?: string;
}

/**
 * Skill directory structure per specification
 */
export interface AgentSkillDirectory {
  name: string; // Directory name (must match frontmatter.name)
  path: string; // Absolute path to skill directory

  // Required
  hasSkillMd: boolean;

  // Optional directories
  hasScriptsDir: boolean;
  hasReferencesDir: boolean;
  hasAssetsDir: boolean;

  // File listings
  scriptFiles: string[]; // Files in scripts/
  referenceFiles: string[]; // Files in references/
  assetFiles: string[]; // Files in assets/
}

/**
 * Loaded skill (in-memory representation)
 */
export interface AgentSkill {
  // Identification
  name: string; // From frontmatter.name
  path: string; // Absolute directory path

  // Frontmatter
  frontmatter: AgentSkillFrontmatter;

  // SKILL.md body content (Markdown after frontmatter)
  content: string;

  // Directory structure info
  directory: AgentSkillDirectory;
}

/**
 * Progressive disclosure levels
 *
 * Discovery: name + description only (~100 tokens per skill)
 * Activation: Full SKILL.md content (<5000 tokens recommended)
 * Execution: Scripts, references, assets loaded on demand
 */
export enum DisclosureLevel {
  Discovery = 'discovery',
  Activation = 'activation',
  Execution = 'execution',
}

/**
 * Skill discovery info (for Discovery level)
 */
export interface SkillDiscoveryInfo {
  name: string;
  description: string;
  compatibility?: string;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
}

/**
 * Skill creation parameters
 */
export interface CreateSkillParams {
  name: string;
  description: string;
  content: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

/**
 * Skill update parameters
 */
export interface UpdateSkillParams {
  description?: string;
  content?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

/**
 * Validation error type
 */
export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

/**
 * Validation warning type
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

/**
 * Complete validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
