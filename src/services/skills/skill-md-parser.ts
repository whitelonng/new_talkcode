/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files according to Agent Skills Specification
 * https://agentskills.io/specification
 */

import { logger } from '@/lib/logger';
import type { AgentSkillFrontmatter } from '@/types/agent-skills-spec';
import { AgentSkillValidator } from './agent-skill-validator';

/**
 * Parsed SKILL.md structure
 */
export interface ParsedSkillMd {
  frontmatter: AgentSkillFrontmatter;
  content: string;
}

/**
 * Parse options
 */
export interface ParseOptions {
  validate?: boolean; // Run validation and throw on errors
  logWarnings?: boolean; // Log validation warnings
}

/**
 * SkillMdParser
 *
 * Parses and generates SKILL.md files per Agent Skills Specification
 */
export class SkillMdParser {
  /**
   * Parse SKILL.md file content
   *
   * Expected format:
   * ---
   * name: skill-name
   * description: Description here
   * license: MIT
   * metadata:
   *   author: name
   *   version: "1.0"
   * ---
   * # Markdown content here
   */
  static parse(content: string, options: ParseOptions = {}): ParsedSkillMd {
    const trimmed = content.trim();

    if (!trimmed.startsWith('---')) {
      throw new Error('Invalid SKILL.md: Missing YAML frontmatter (must start with ---)');
    }

    const lines = trimmed.split('\n');
    let frontmatterEndIndex = -1;

    // Find closing delimiter
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        frontmatterEndIndex = i;
        break;
      }
    }

    if (frontmatterEndIndex === -1) {
      throw new Error('Invalid SKILL.md: Missing closing --- for YAML frontmatter');
    }

    // Extract frontmatter YAML
    const frontmatterLines = lines.slice(1, frontmatterEndIndex);
    const frontmatterYaml = frontmatterLines.join('\n');

    // Extract markdown content
    const markdownLines = lines.slice(frontmatterEndIndex + 1);
    const markdownContent = markdownLines.join('\n').trim();

    // Parse YAML frontmatter
    const frontmatter = SkillMdParser.parseYaml(frontmatterYaml);

    // Validate if requested
    if (options.validate) {
      const validation = AgentSkillValidator.validate(frontmatter);

      if (!validation.valid) {
        const errorMsg = validation.errors.map((e) => `${e.field}: ${e.message}`).join('\n');
        throw new Error(`Invalid SKILL.md frontmatter:\n${errorMsg}`);
      }

      if (options.logWarnings && validation.warnings.length > 0) {
        for (const warning of validation.warnings) {
          logger.warn(`SKILL.md warning - ${warning.field}: ${warning.message}`);
        }
      }
    }

    return {
      frontmatter: frontmatter as AgentSkillFrontmatter,
      content: markdownContent,
    };
  }

  /**
   * Parse YAML frontmatter
   *
   * This is a simple YAML parser that supports:
   * - Top-level key-value pairs
   * - Nested objects (for metadata field)
   * - String, boolean, number values
   * - Comments (lines starting with #)
   */
  private static parseYaml(yaml: string): Partial<AgentSkillFrontmatter> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let currentObject: Record<string, string> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check for nested object start (e.g., "metadata:")
      if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
        currentKey = trimmed.slice(0, -1);
        currentObject = {};
        result[currentKey] = currentObject;
        continue;
      }

      // Nested property (indented with spaces)
      if (line.startsWith('  ') && currentObject) {
        const match = trimmed.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const key = match[1]?.trim() || '';
          const value = match[2]?.trim().replace(/^["']|["']$/g, '') || '';
          currentObject[key] = value;
        }
        continue;
      }

      // Top-level property - reset nested context
      currentKey = null;
      currentObject = null;

      const match = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1]?.trim() || '';
        let value: unknown = match[2]?.trim() || '';

        // Parse value types
        if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (typeof value === 'string') {
          // Remove surrounding quotes
          value = value.replace(/^["']|["']$/g, '');
        }

        result[key] = value;
      }
    }

    // Validate required fields
    if (!result.name || typeof result.name !== 'string') {
      throw new Error('Invalid SKILL.md: Missing required field "name" in frontmatter');
    }

    if (!result.description || typeof result.description !== 'string') {
      throw new Error('Invalid SKILL.md: Missing required field "description" in frontmatter');
    }

    return result;
  }

  /**
   * Generate SKILL.md content from frontmatter and content
   */
  static generate(frontmatter: AgentSkillFrontmatter, content: string): string {
    const yaml = SkillMdParser.generateYaml(frontmatter);
    return `---\n${yaml}\n---\n\n${content}`;
  }

  /**
   * Generate YAML frontmatter from object
   */
  private static generateYaml(frontmatter: AgentSkillFrontmatter): string {
    const lines: string[] = [];

    // Required fields first
    lines.push(`name: ${frontmatter.name}`);
    lines.push(`description: ${frontmatter.description}`);

    // Optional fields
    if (frontmatter.license) {
      lines.push(`license: ${frontmatter.license}`);
    }

    if (frontmatter.compatibility) {
      lines.push(`compatibility: ${frontmatter.compatibility}`);
    }

    if (frontmatter['allowed-tools']) {
      lines.push(`allowed-tools: ${frontmatter['allowed-tools']}`);
    }

    // Metadata (nested object)
    if (frontmatter.metadata && Object.keys(frontmatter.metadata).length > 0) {
      lines.push('metadata:');
      for (const [key, value] of Object.entries(frontmatter.metadata)) {
        // Escape quotes in value
        const escapedValue = value.replace(/"/g, '\\"');
        lines.push(`  ${key}: "${escapedValue}"`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Create a default SKILL.md template
   */
  static createTemplate(name: string, description: string): string {
    const frontmatter: AgentSkillFrontmatter = {
      name,
      description,
    };

    const content = `# ${name}

${description}

## Usage

This skill provides domain-specific knowledge and best practices.

## Instructions

Add your instructions here for how the AI should use this skill.
`;

    return SkillMdParser.generate(frontmatter, content);
  }

  /**
   * Create SKILL.md with custom frontmatter and content
   */
  static create(params: {
    name: string;
    description: string;
    content: string;
    license?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
  }): string {
    const frontmatter: AgentSkillFrontmatter = {
      name: params.name,
      description: params.description,
      license: params.license,
      compatibility: params.compatibility,
      metadata: params.metadata,
    };

    return SkillMdParser.generate(frontmatter, params.content);
  }
}
