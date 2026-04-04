/**
 * Skill Script Permission Types
 *
 * Defines permission levels and management for skill script execution
 */

/**
 * Permission levels for script execution
 */
export type SkillScriptPermissionLevel =
  | 'read-only' // Can only read files in workspace
  | 'write-project' // Can write within project directory
  | 'write-all' // Can write anywhere on filesystem
  | 'network' // Can make network requests
  | 'full'; // Full system access (dangerous)

/**
 * Permission grant for a specific skill
 */
export interface SkillPermissionGrant {
  /** Skill ID */
  skillId: string;

  /** Skill name for display */
  skillName: string;

  /** Permission level granted */
  level: SkillScriptPermissionLevel;

  /** When permission was granted */
  grantedAt: number;

  /** Whether permission applies to all scripts in the skill */
  applyToAllScripts: boolean;

  /** Specific script files allowed (if not applyToAllScripts) */
  allowedScripts?: string[];

  /** Auto-approve future script executions */
  autoApprove: boolean;
}

/**
 * Permission request from AI/user
 */
export interface SkillPermissionRequest {
  /** Request ID for tracking */
  requestId: string;

  /** Skill requesting permission */
  skillId: string;

  /** Skill name */
  skillName: string;

  /** Script path being executed */
  scriptPath: string;

  /** Script type */
  scriptType: string;

  /** Requested permission level */
  requestedLevel: SkillScriptPermissionLevel;

  /** Reason for the request (from AI or skill description) */
  reason?: string;

  /** Timestamp of request */
  requestedAt: number;
}

/**
 * Permission decision
 */
export interface PermissionDecision {
  /** Request ID */
  requestId: string;

  /** Whether permission was granted */
  granted: boolean;

  /** Permission level granted (if granted) */
  level?: SkillScriptPermissionLevel;

  /** Remember decision for future */
  remember: boolean;

  /** Decided at timestamp */
  decidedAt: number;
}
