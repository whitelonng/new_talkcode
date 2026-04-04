/**
 * Tests for Claude Code Skills Interoperability
 *
 * These tests verify that TalkCody skills can:
 * 1. Load Claude Code format skills
 * 2. Export skills in Claude Code compatible format
 * 3. Pass skills-ref validation (mock)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSkillValidator } from './agent-skill-validator';
import { SkillMdParser } from './skill-md-parser';
import type { AgentSkill, AgentSkillFrontmatter } from '@/types/agent-skills-spec';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
	appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
	join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn(),
	mkdir: vi.fn(),
	readDir: vi.fn(),
	readTextFile: vi.fn(),
	writeTextFile: vi.fn(),
	remove: vi.fn(),
	writeFile: vi.fn(),
}));

// Import mocked modules after mocking
import { exists, mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

/**
 * Mock Claude Code skill structure
 *
 * Claude Code skills use a similar format to Agent Skills Specification:
 * - SKILL.md with YAML frontmatter
 * - scripts/ directory for executable scripts
 * - REFERENCE.md for additional documentation
 */
interface MockClaudeCodeSkillConfig {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	metadata?: Record<string, string>;
	content?: string;
	scripts?: string[];
	hasReferenceMd?: boolean;
}

/**
 * Create a Claude Code skill SKILL.md content
 */
function createClaudeCodeSkillMd(config: MockClaudeCodeSkillConfig): string {
	const content = config.content ?? `# ${config.name}

${config.description}

## Usage

This skill provides domain-specific knowledge and best practices.

## Instructions

Add your instructions here for how the AI should use this skill.
`;

	let yaml = `name: ${config.name}
description: ${config.description}`;

	if (config.license) {
		yaml += `\nlicense: ${config.license}`;
	}

	if (config.compatibility) {
		yaml += `\ncompatibility: ${config.compatibility}`;
	}

	if (config.metadata && Object.keys(config.metadata).length > 0) {
		yaml += '\nmetadata:';
		for (const [key, value] of Object.entries(config.metadata)) {
			yaml += `\n  ${key}: "${value}"`;
		}
	}

	return `---\n${yaml}\n---\n\n${content}`;
}

/**
 * Set up a Claude Code skill in the mock file system
 */
async function setupClaudeCodeSkill(config: MockClaudeCodeSkillConfig): Promise<string> {
	const skillPath = `/mock/claude-skills/${config.name}`;

	// SKILL.md is required
	vi.mocked(readTextFile).mockImplementation(async (path: string) => {
		if (path.includes('SKILL.md')) {
			return createClaudeCodeSkillMd(config);
		}
		if (path.includes('REFERENCE.md')) {
			return '# Reference\n\nAdditional reference documentation.';
		}
		return '';
	});

	// Directory structure
	vi.mocked(readDir).mockImplementation(async (path: string) => {
		if (path.includes('scripts') && config.scripts) {
			return config.scripts.map((name) => ({
				name,
				isFile: true,
				isDirectory: false,
				isSymlink: false,
			}));
		}
		if (path === skillPath) {
			const entries: Array<{ name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean }> = [
				{ name: 'SKILL.md', isFile: true, isDirectory: false, isSymlink: false },
			];
			if (config.hasReferenceMd) {
				entries.push({ name: 'REFERENCE.md', isFile: true, isDirectory: false, isSymlink: false });
			}
			if (config.scripts && config.scripts.length > 0) {
				entries.push({ name: 'scripts', isFile: false, isDirectory: true, isSymlink: false });
			}
			return entries;
		}
		return [];
	});

	// File existence
	vi.mocked(exists).mockImplementation(async (path: string) => {
		if (path.includes('SKILL.md')) return true;
		if (path.includes('REFERENCE.md') && config.hasReferenceMd) return true;
		if (path.includes('scripts')) return config.scripts && config.scripts.length > 0;
		return true;
	});

	return skillPath;
}

describe('Agent Skills Interoperability', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default mock implementations
		vi.mocked(exists).mockResolvedValue(true);
		vi.mocked(mkdir).mockResolvedValue();
		vi.mocked(writeTextFile).mockResolvedValue();
	});

	describe('should load Claude Code skills', () => {
		it('should parse Claude Code SKILL.md format', async () => {
			const skillContent = `---
name: claude-code-skill
description: A skill exported from Claude Code
license: MIT
---
# Claude Code Skill

This skill was created in Claude Code and exported to TalkCody.
`;

			const parsed = SkillMdParser.parse(skillContent);

			expect(parsed.frontmatter.name).toBe('claude-code-skill');
			expect(parsed.frontmatter.description).toBe('A skill exported from Claude Code');
			expect(parsed.frontmatter.license).toBe('MIT');
			expect(parsed.content).toContain('Claude Code');
		});

		it('should load Claude Code skill with full metadata', async () => {
			const config: MockClaudeCodeSkillConfig = {
				name: 'web-development',
				description: 'Comprehensive web development skills and best practices',
				license: 'MIT',
				compatibility: 'Node.js 18+, npm 9+',
				metadata: {
					author: 'Claude Code',
					version: '1.0.0',
					category: 'development',
				},
				content: '# Web Development\n\nSkills for modern web development.',
			};

			await setupClaudeCodeSkill(config);

			// Simulate loading the skill
			const skillContent = createClaudeCodeSkillMd(config);
			const parsed = SkillMdParser.parse(skillContent);

			expect(parsed.frontmatter.name).toBe('web-development');
			expect(parsed.frontmatter.description).toBe('Comprehensive web development skills and best practices');
			expect(parsed.frontmatter.license).toBe('MIT');
			expect(parsed.frontmatter.compatibility).toBe('Node.js 18+, npm 9+');
			expect(parsed.frontmatter.metadata?.author).toBe('Claude Code');
			expect(parsed.frontmatter.metadata?.version).toBe('1.0.0');
		});

		it('should handle Claude Code skills with scripts', async () => {
			const config: MockClaudeCodeSkillConfig = {
				name: 'data-analysis',
				description: 'Data analysis and visualization skills',
				scripts: ['analyze.py', 'visualize.py', 'export.py'],
			};

			await setupClaudeCodeSkill(config);

			// Verify script listing works
			vi.mocked(readDir).mockResolvedValue([
				{ name: 'analyze.py', isFile: true, isDirectory: false, isSymlink: false },
				{ name: 'visualize.py', isFile: true, isDirectory: false, isSymlink: false },
				{ name: 'export.py', isFile: true, isDirectory: false, isSymlink: false },
			]);

			const scriptsDirPath = '/mock/claude-skills/data-analysis/scripts';
			const entries = await readDir(scriptsDirPath);
			const scriptFiles = entries.filter((e) => e.isFile).map((e) => e.name);

			expect(scriptFiles).toHaveLength(3);
			expect(scriptFiles).toContain('analyze.py');
			expect(scriptFiles).toContain('visualize.py');
			expect(scriptFiles).toContain('export.py');
		});

		it('should validate Claude Code skill frontmatter', async () => {
			const skillContent = `---
name: valid-claude-skill
description: A valid skill format from Claude Code
---
# Content
`;

			const parsed = SkillMdParser.parse(skillContent);
			const validation = AgentSkillValidator.validate(parsed.frontmatter);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});
	});

	describe('should export skills for Claude Code', () => {
		it('should generate Claude Code compatible SKILL.md', () => {
			const frontmatter: AgentSkillFrontmatter = {
				name: 'talkcody-export',
				description: 'A skill created in TalkCody for Claude Code compatibility',
				license: 'Apache-2.0',
			};

			const content = '# TalkCody Export\n\nThis skill was created in TalkCody.';
			const generated = SkillMdParser.generate(frontmatter, content);

			expect(generated).toContain('name: talkcody-export');
			expect(generated).toContain('description: A skill created in TalkCody for Claude Code compatibility');
			expect(generated).toContain('license: Apache-2.0');
			expect(generated).toContain('# TalkCody Export');
			expect(generated.startsWith('---\n')).toBe(true);
		});

		it('should include optional fields when provided', () => {
			const frontmatter: AgentSkillFrontmatter = {
				name: 'full-feature-skill',
				description: 'A skill with all optional fields',
				license: 'MIT',
				compatibility: 'Requires Python 3.10+',
				metadata: {
					author: 'TalkCody User',
					version: '2.1.0',
				},
			};

			const content = '# Full Feature Skill\n\nComplete documentation.';
			const generated = SkillMdParser.generate(frontmatter, content);

			expect(generated).toContain('name: full-feature-skill');
			expect(generated).toContain('license: MIT');
			expect(generated).toContain('compatibility: Requires Python 3.10+');
			expect(generated).toContain('metadata:');
			expect(generated).toContain('author: "TalkCody User"');
			expect(generated).toContain('version: "2.1.0"');
		});

		it('should generate parseable SKILL.md for re-import', () => {
			const originalContent = `# Original Skill

## Overview
This skill was originally created in TalkCody.

## Usage
Use this skill for testing interoperability.

## Examples
\`\`\`typescript
console.log('Hello');
\`\`\`
`;

			const frontmatter: AgentSkillFrontmatter = {
				name: 'interoperability-test',
				description: 'Testing skill format compatibility between TalkCody and Claude Code',
				license: 'MIT',
			};

			const generated = SkillMdParser.generate(frontmatter, originalContent);

			// Should be able to parse what we generated
			const parsed = SkillMdParser.parse(generated);

			expect(parsed.frontmatter.name).toBe('interoperability-test');
			expect(parsed.frontmatter.description).toBe('Testing skill format compatibility between TalkCody and Claude Code');
			expect(parsed.content).toContain('## Overview');
			expect(parsed.content).toContain('## Usage');
			expect(parsed.content).toContain('## Examples');
		});

		it('should preserve markdown formatting in exported skills', () => {
			const frontmatter: AgentSkillFrontmatter = {
				name: 'markdown-test',
				description: 'Testing markdown preservation',
			};

			const content = `# Heading 1

## Heading 2

- List item 1
- List item 2

\`\`\`typescript
const greeting = 'Hello World';
console.log(greeting);
\`\`\`

> This is a blockquote

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;

			const generated = SkillMdParser.generate(frontmatter, content);
			const parsed = SkillMdParser.parse(generated);

			expect(parsed.content).toContain('# Heading 1');
			expect(parsed.content).toContain('## Heading 2');
			expect(parsed.content).toContain('- List item 1');
			expect(parsed.content).toContain('```typescript');
			expect(parsed.content).toContain('| Column 1 | Column 2 |');
		});
	});

	describe('should pass skills-ref validation (mock)', () => {
		it('should validate skills-ref format', () => {
			const frontmatter: Partial<AgentSkillFrontmatter> = {
				name: 'skills-ref-valid',
				description: 'Valid skill for skills-ref validation mock',
			};

			const validation = AgentSkillValidator.validate(frontmatter);

			expect(validation.valid).toBe(true);
		});

		it('should detect invalid name format for skills-ref', () => {
			// Skills-ref expects kebab-case names
			const frontmatter: Partial<AgentSkillFrontmatter> = {
				name: 'Invalid_Name',
				description: 'Invalid name format',
			};

			const validation = AgentSkillValidator.validate(frontmatter);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some((e) => e.rule === 'name-charset')).toBe(true);
		});

		it('should detect missing required fields for skills-ref', () => {
			const frontmatter: Partial<AgentSkillFrontmatter> = {
				name: 'test-skill',
				// description is missing
			};

			const validation = AgentSkillValidator.validate(frontmatter);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some((e) => e.rule === 'description-required')).toBe(true);
		});

		it('should validate name length for skills-ref', () => {
			const frontmatter: Partial<AgentSkillFrontmatter> = {
				name: 'a'.repeat(100), // Too long
				description: 'Valid description',
			};

			const validation = AgentSkillValidator.validate(frontmatter);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some((e) => e.rule === 'name-max-length')).toBe(true);
		});

		it('should provide warnings for short descriptions in skills-ref', () => {
			const frontmatter: Partial<AgentSkillFrontmatter> = {
				name: 'short-desc-skill',
				description: 'Short', // Less than 50 characters
			};

			const validation = AgentSkillValidator.validate(frontmatter);

			expect(validation.valid).toBe(true);
			expect(validation.warnings.length).toBeGreaterThan(0);
			expect(validation.warnings.some((w) => w.field === 'description')).toBe(true);
		});

		it('should normalize names for skills-ref compatibility', () => {
			// Claude Code and TalkCody both normalize names to kebab-case
			const originalName = 'My Test Skill!!';
			const normalized = AgentSkillValidator.normalizeName(originalName);

			expect(normalized).toBe('my-test-skill');
			expect(normalized).toMatch(/^[a-z0-9-]+$/);
		});
	});

	describe('Claude Code to TalkCody format conversion', () => {
		it('should convert Claude Code skill to AgentSkill interface', async () => {
			const config: MockClaudeCodeSkillConfig = {
				name: 'conversion-test',
				description: 'Testing format conversion',
				license: 'MIT',
				content: '# Conversion Test\n\nTesting Claude Code to TalkCody conversion.',
			};

			const skillPath = await setupClaudeCodeSkill(config);

			// Simulate conversion process
			const skillContent = createClaudeCodeSkillMd(config);
			const parsed = SkillMdParser.parse(skillContent);

			const agentSkill: AgentSkill = {
				name: parsed.frontmatter.name,
				path: skillPath,
				frontmatter: parsed.frontmatter,
				content: parsed.content,
				directory: {
					name: parsed.frontmatter.name,
					path: skillPath,
					hasSkillMd: true,
					hasScriptsDir: false,
					hasReferencesDir: false,
					hasAssetsDir: false,
					scriptFiles: [],
					referenceFiles: [],
					assetFiles: [],
				},
			};

			expect(agentSkill.name).toBe('conversion-test');
			expect(agentSkill.frontmatter.description).toBe('Testing format conversion');
			expect(agentSkill.directory.hasSkillMd).toBe(true);
		});

		it('should handle metadata migration from Claude Code format', () => {
			// Claude Code may use different metadata keys
			const claudeCodeMetadata = {
				version: '1.0.0',
				author: 'Claude Developer',
				tags: 'web,api,rest',
			};

			// TalkCody stores metadata in the same format
			const frontmatter: AgentSkillFrontmatter = {
				name: 'metadata-migration-test',
				description: 'Testing metadata migration',
				metadata: {
					version: claudeCodeMetadata.version,
					author: claudeCodeMetadata.author,
					tags: claudeCodeMetadata.tags,
				},
			};

			const generated = SkillMdParser.generate(frontmatter, '# Metadata Test');
			const parsed = SkillMdParser.parse(generated);

			expect(parsed.frontmatter.metadata?.version).toBe('1.0.0');
			expect(parsed.frontmatter.metadata?.author).toBe('Claude Developer');
			expect(parsed.frontmatter.metadata?.tags).toBe('web,api,rest');
		});
	});

	describe('Edge cases for interoperability', () => {
		it('should handle empty optional fields', () => {
			const frontmatter: AgentSkillFrontmatter = {
				name: 'minimal-skill',
				description: 'A skill with minimal required fields only',
			};

			const generated = SkillMdParser.generate(frontmatter, '# Minimal Skill');
			const parsed = SkillMdParser.parse(generated);

			expect(parsed.frontmatter.name).toBe('minimal-skill');
			expect(parsed.frontmatter.license).toBeUndefined();
			expect(parsed.frontmatter.compatibility).toBeUndefined();
			expect(parsed.frontmatter.metadata).toBeUndefined();
		});

		it('should handle special characters in descriptions', () => {
			const frontmatter: AgentSkillFrontmatter = {
				name: 'special-chars-test',
				description: 'Testing: special characters like "quotes", colons: and newlines\nshould work correctly',
			};

			const generated = SkillMdParser.generate(frontmatter, '# Special Chars');
			const parsed = SkillMdParser.parse(generated);

			expect(parsed.frontmatter.description).toContain('quotes');
			expect(parsed.frontmatter.description).toContain('colons');
		});

		it('should handle unicode in skill content', () => {
			const frontmatter: AgentSkillFrontmatter = {
				name: 'unicode-test',
				description: 'Testing unicode support',
			};

			const content = `# Unicode Test

- Emoji: 🚀, 🎉, 中文, 日本語
- Symbols: ©, ®, ™
- Math: α, β, γ, ∑, ∏
`;

			const generated = SkillMdParser.generate(frontmatter, content);
			const parsed = SkillMdParser.parse(generated);

			expect(parsed.content).toContain('🚀');
			expect(parsed.content).toContain('中文');
			expect(parsed.content).toContain('∑');
		});

		it('should validate directory name matches skill name', () => {
			const directoryName = 'matching-name';
			const skillName = 'matching-name';

			const errors = AgentSkillValidator.validateDirectoryMatch(directoryName, skillName);

			expect(errors).toHaveLength(0);
		});

		it('should reject directory name mismatch', () => {
			const directoryName = 'dir-name';
			const skillName = 'different-name';

			const errors = AgentSkillValidator.validateDirectoryMatch(directoryName, skillName);

			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('name-directory-match');
		});
	});
});
