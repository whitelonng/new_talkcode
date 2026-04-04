/**
 * Marketplace Skill Types
 *
 * Types for skills published to the marketplace (Cloudflare R2)
 */

import type { SkillScriptPermissionLevel } from './skill-permission';

/**
 * Marketplace skill metadata (stored in database)
 */
export interface MarketplaceSkillMetadata {
  /** Unique skill ID */
  skillId: string;

  /** Skill slug (URL-friendly identifier) */
  slug?: string;

  /** Skill name */
  name: string;

  /** Short description */
  description: string;

  /** Detailed description (markdown) */
  longDescription?: string;

  /** Author information */
  author: {
    name: string;
    email?: string;
    url?: string;
  };

  /** Skill version (semver) */
  version: string;

  /** Category/tags */
  tags: string[];

  /** License */
  license: string;

  /** Required permission level */
  requiredPermission: SkillScriptPermissionLevel;

  /** R2 storage URL */
  storageUrl: string;

  /** Package size in bytes */
  packageSize: number;

  /** Package checksum (SHA-256) */
  checksum?: string;

  /** Published timestamp */
  publishedAt: number;

  /** Last updated timestamp */
  updatedAt: number;

  /** Download count */
  downloadCount: number;

  /** Rating (0-5) */
  rating?: number;

  /** Number of ratings */
  ratingCount?: number;

  /** Repository URL */
  repositoryUrl?: string;

  /** Homepage URL */
  homepageUrl?: string;

  /** Minimum TalkCody version required */
  minAppVersion?: string;
}

/**
 * Skill package manifest (included in .tar.gz)
 */
export interface SkillPackageManifest {
  /** Skill metadata */
  metadata: Omit<
    MarketplaceSkillMetadata,
    'storageUrl' | 'packageSize' | 'downloadCount' | 'rating' | 'ratingCount' | 'checksum'
  >;

  /** Files included in package */
  files: string[];

  /** Checksum for verification */
  checksum: string;

  /** Packaging timestamp */
  packagedAt: number;
}

/**
 * R2 upload result
 */
export interface R2UploadResult {
  /** R2 object key */
  key: string;

  /** Public URL */
  url: string;

  /** File size */
  size: number;

  /** Upload timestamp */
  uploadedAt: number;
}

/**
 * Skill install result
 */
export interface SkillInstallResult {
  /** Installed skill ID */
  skillId: string;

  /** Skill name */
  name: string;

  /** Local directory path */
  localPath: string;

  /** Installation success */
  success: boolean;

  /** Error message if failed */
  error?: string;
}
