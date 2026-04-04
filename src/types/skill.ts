/**
 * Skills System Type Definitions
 *
 * This file contains all TypeScript types for the Skills feature,
 * which allows users to add domain-specific knowledge packages to their conversations.
 */

/**
 * Documentation item types
 */
export type DocumentationType = 'inline' | 'file' | 'url';

/**
 * Documentation item definition
 * New format: References documentation files stored in skill's references/ directory
 * Legacy format: Supports inline, file path, and URL types for backward compatibility
 */
export interface DocumentationItem {
  // New format (for skills created with file picker)
  filename?: string; // Filename in references/ directory (e.g., 'guide.md')
  originalPath?: string; // Original file path before copying (used during creation)

  // Legacy format (for existing skills and backward compatibility)
  type?: DocumentationType;
  title?: string;
  content?: string; // Used when type = 'inline'
  filePath?: string; // Used when type = 'file' (relative to project root)
  url?: string; // Used when type = 'url'
}

/**
 * Skill content definition
 * Contains the three core components of a skill
 */
export interface SkillContent {
  systemPromptFragment?: string; // Domain knowledge injected into system prompt
  workflowRules?: string; // Specific development workflow rules
  documentation?: DocumentationItem[]; // Reference documentation files
  hasScripts?: boolean; // Whether the skill includes executable scripts
  scriptFiles?: string[]; // List of script filenames (e.g., ['analyze.py', 'format.sh'])
  scriptContents?: Map<string, string>; // Script contents during creation (not persisted)

  // Directory indicators (from Agent Skills Specification)
  hasReferences?: boolean; // Whether the skill has references
  hasAssets?: boolean; // Whether the skill has assets
  hasScriptsDir?: boolean; // Whether the skill has scripts/ directory
  hasReferencesDir?: boolean; // Whether the skill has references/ directory
  hasAssetsDir?: boolean; // Whether the skill has assets/ directory
}

/**
 * Marketplace metadata for a skill
 */
export interface SkillMarketplaceMetadata {
  marketplaceId: string; // ID in the marketplace
  slug?: string; // URL-friendly slug for the skill
  version: string; // Version number
  author: string; // Author name
  authorDisplayName?: string; // Author display name
  authorId: string; // Author ID
  authorAvatar?: string; // Author avatar URL
  downloads: number; // Total downloads
  rating: number; // Average rating
  lastSynced?: number; // Last sync timestamp
}

/**
 * Local metadata for a skill
 */
export interface SkillLocalMetadata {
  isBuiltIn: boolean; // Whether this is a built-in skill
  sourceType?: 'local' | 'marketplace' | 'system' | 'remote'; // Source of the skill
  forkedFromId?: string; // Local skill ID if forked from another local skill
  forkedFromMarketplaceId?: string; // Marketplace ID if forked from marketplace
  isShared?: boolean; // Whether this skill has been shared to marketplace
  tags: string[]; // Tags for categorization
  createdAt: number; // Creation timestamp
  updatedAt: number; // Last update timestamp
  lastUsed?: number; // Last usage timestamp
  // GitHub information for remote skills
  repository?: string; // GitHub repository (e.g., "talkcody/skills")
  githubPath?: string; // Path within the repository (e.g., "skills/theme-factory")
}

/**
 * Complete skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  icon?: string;

  // Frontmatter fields per Agent Skills Specification
  license?: string;
  compatibility?: string;
  frontmatterMetadata?: Record<string, string>; // Agent Skills Spec: metadata field

  content: SkillContent;

  marketplace?: SkillMarketplaceMetadata;
  metadata: SkillLocalMetadata;

  // File system location (for file-based skills)
  localPath?: string; // Absolute path to skill directory
}

/**
 * Task-Skill association
 * Represents the activation state of a skill in a task
 */
export interface TaskSkill {
  taskId: string;
  skillId: string;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  activatedAt: number;
}

/**
 * Marketplace skill (from API response)
 */
export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  categories: SkillCategory[]; // API returns array of categories
  iconUrl?: string;
  bannerUrl?: string;

  // Skill content
  systemPromptFragment?: string;
  workflowRules?: string;
  documentation?: DocumentationItem[];
  hasScripts?: boolean;

  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    bio?: string | null;
    website?: string | null;
    agentCount?: number;
  };

  // Stats
  installCount: number;
  rating: number;
  ratingCount: number;
  latestVersion: string;

  isFeatured: boolean;
  isPublished: boolean;
  tags: SkillTag[];

  createdAt: string;
  updatedAt: string;
}

/**
 * Skill filter options
 */
export interface SkillFilter {
  category?: string;
  tags?: string[];
  search?: string;
  isBuiltIn?: boolean;
}

export type SkillSortOption = 'name' | 'downloads' | 'installs' | 'rating' | 'recent' | 'updated';

/**
 * Skill category definition
 */
export interface SkillCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

/**
 * Skill tag definition
 */
export interface SkillTag {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
}

/**
 * Request parameters for listing skills
 */
export interface ListSkillsRequest {
  search?: string;
  category?: string;
  tags?: string[];
  sort?: SkillSortOption;
  limit?: number;
  offset?: number;
}

/**
 * Create skill request
 */
export interface CreateSkillRequest {
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  icon?: string;
  content: SkillContent;
  tags?: string[];
}

/**
 * Update skill request
 */
export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  longDescription?: string;
  category?: string;
  icon?: string;
  content?: Partial<SkillContent>;
  tags?: string[];
}

/**
 * Skill version definition
 */
export interface SkillVersion {
  id: string;
  skillId: string;
  version: string;
  changelog?: string;
  config: Skill;
  createdAt: string;
}

/**
 * Skill statistics
 */
export interface SkillStats {
  total: number;
  byCategory: Record<string, number>;
  mostUsed: Array<{
    skillId: string;
    name: string;
    usageCount: number;
  }>;
}
