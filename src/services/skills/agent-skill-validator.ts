/**
 * Agent Skills Specification Validator
 * Validates skills against https://agentskills.io/specification
 */

import type { AgentSkillFrontmatter } from '@/types/agent-skills-spec';

export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * AgentSkillValidator
 *
 * Validates skill frontmatter and metadata according to Agent Skills Specification
 */
export class AgentSkillValidator {
  /**
   * Validate name per Agent Skills Specification
   *
   * Rules:
   * - Required
   * - 1-64 characters
   * - Only lowercase letters, numbers, and hyphens
   * - Must not start or end with hyphen
   * - Must not contain consecutive hyphens
   */
  static validateName(name: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!name || name.length === 0) {
      errors.push({
        field: 'name',
        message: 'Name is required',
        rule: 'name-required',
      });
      return errors;
    }

    if (name.length > 64) {
      errors.push({
        field: 'name',
        message: 'Name must be at most 64 characters',
        rule: 'name-max-length',
      });
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push({
        field: 'name',
        message: 'Name may only contain lowercase letters, numbers, and hyphens',
        rule: 'name-charset',
      });
    }

    if (name.startsWith('-') || name.endsWith('-')) {
      errors.push({
        field: 'name',
        message: 'Name must not start or end with a hyphen',
        rule: 'name-hyphen-position',
      });
    }

    if (name.includes('--')) {
      errors.push({
        field: 'name',
        message: 'Name must not contain consecutive hyphens',
        rule: 'name-consecutive-hyphens',
      });
    }

    return errors;
  }

  /**
   * Validate description per Agent Skills Specification
   *
   * Rules:
   * - Required
   * - 1-1024 characters
   * - Should describe what the skill does and when to use it
   */
  static validateDescription(description: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!description || description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Description is required',
        rule: 'description-required',
      });
    } else if (description.length > 1024) {
      errors.push({
        field: 'description',
        message: 'Description must be at most 1024 characters',
        rule: 'description-max-length',
      });
    }

    return errors;
  }

  /**
   * Validate compatibility field
   *
   * Rules:
   * - Optional
   * - Max 500 characters if provided
   */
  static validateCompatibility(compatibility?: string): ValidationError[] {
    if (compatibility && compatibility.length > 500) {
      return [
        {
          field: 'compatibility',
          message: 'Compatibility field must be at most 500 characters',
          rule: 'compatibility-max-length',
        },
      ];
    }
    return [];
  }

  /**
   * Validate metadata field
   *
   * Rules:
   * - Optional
   * - Must be a map from string keys to string values
   */
  static validateMetadata(metadata?: Record<string, string>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          errors.push({
            field: 'metadata',
            message: 'Metadata must be a map from string keys to string values',
            rule: 'metadata-type',
          });
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Validate complete frontmatter
   */
  static validate(frontmatter: Partial<AgentSkillFrontmatter>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate required fields
    errors.push(...AgentSkillValidator.validateName(frontmatter.name || ''));
    errors.push(...AgentSkillValidator.validateDescription(frontmatter.description || ''));

    // Validate optional fields
    errors.push(...AgentSkillValidator.validateCompatibility(frontmatter.compatibility));
    errors.push(...AgentSkillValidator.validateMetadata(frontmatter.metadata));

    // Check for good description
    const desc = frontmatter.description;
    if (desc && desc.length < 50) {
      warnings.push({
        field: 'description',
        message: 'Description is quite short',
        suggestion:
          'Consider adding more details about what the skill does and when to use it. Include specific keywords to help agents identify relevant tasks.',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Auto-fix name to comply with specification
   *
   * This method normalizes a name to match the specification:
   * - Converts to lowercase
   * - Replaces invalid characters with hyphens
   * - Removes consecutive hyphens
   * - Removes leading/trailing hyphens
   * - Truncates to 64 characters
   */
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
      .replace(/--+/g, '-') // Replace consecutive hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 64); // Truncate to 64 chars
  }

  /**
   * Check if directory name matches skill name
   *
   * Per specification, the skill name must match the directory name
   */
  static validateDirectoryMatch(directoryName: string, skillName: string): ValidationError[] {
    if (directoryName !== skillName) {
      return [
        {
          field: 'name',
          message: `Skill name "${skillName}" must match directory name "${directoryName}"`,
          rule: 'name-directory-match',
        },
      ];
    }
    return [];
  }

  /**
   * Validate SKILL.md content length
   *
   * The specification recommends keeping SKILL.md under 5000 tokens (~500 lines)
   */
  static validateContentLength(content: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const lines = content.split('\n').length;

    if (lines > 500) {
      warnings.push({
        field: 'content',
        message: `SKILL.md is quite long (${lines} lines)`,
        suggestion:
          'Consider moving detailed reference material to separate files in the references/ directory. The specification recommends keeping SKILL.md under 500 lines.',
      });
    }

    return warnings;
  }
}
