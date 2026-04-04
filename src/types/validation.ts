/**
 * Validation types
 */

/**
 * Issue severity type
 */
export type IssueType = 'error' | 'warning' | 'info';

/**
 * Issue category
 */
export type IssueCategory = 'validation' | 'security' | 'performance' | 'compatibility';

/**
 * Validation issue details
 */
export interface ValidationIssue {
  /** Issue severity type */
  type: IssueType;

  /** Issue category */
  category: IssueCategory;

  /** Issue message */
  message: string;

  /** Related file path */
  file?: string;

  /** Line number in file */
  line?: number;

  /** Column number in file */
  column?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** List of validation issues */
  issues: ValidationIssue[];
}
