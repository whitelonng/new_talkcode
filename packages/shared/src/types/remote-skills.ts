/**
 * Remote Skills Configuration Types
 * 
 * Simplified schema for remote skills stored in JSON format
 */

export interface RemoteSkillConfig {
  /** Unique identifier for the skill */
  id: string;
  /** Display name of the skill */
  name: string;
  /** Category classification (single category) */
  category: string;
  /** Brief description of the skill */
  description: string;
  /** GitHub repository (e.g., "talkcody/skills") */
  repository: string;
  /** Path within the GitHub repository (e.g., "skills/theme-factory") */
  githubPath: string;
}

export interface RemoteSkillsConfiguration {
  /** ISO 8601 timestamp of the configuration version */
  version: string;
  /** Array of remote skill configurations */
  remoteSkills: RemoteSkillConfig[];
}

export interface RemoteSkillVersionResponse {
  /** Current version timestamp */
  version: string;
}
