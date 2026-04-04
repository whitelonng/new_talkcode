/**
 * Tests for SkillMdParser (Agent Skills Specification compliant)
 */

import { describe, expect, it } from 'vitest';
import { SkillMdParser } from './skill-md-parser';

describe('SkillMdParser', () => {
	describe('parse', () => {
		it('should parse minimal valid SKILL.md', () => {
			const content = `---
name: my-skill
description: A test skill
---

# My Skill

This is the content.`;

			const result = SkillMdParser.parse(content);

			expect(result.frontmatter.name).toBe('my-skill');
			expect(result.frontmatter.description).toBe('A test skill');
			expect(result.content).toContain('# My Skill');
		});

		it('should parse SKILL.md with all optional fields', () => {
			const content = `---
name: full-skill
description: A comprehensive skill example
license: MIT
compatibility: Requires Node.js 18+
allowed-tools: Bash(git:*) Read
metadata:
  author: John Doe
  version: "1.0.0"
  homepage: https://example.com
---

# Full Skill

Complete content here.`;

			const result = SkillMdParser.parse(content);

			expect(result.frontmatter.name).toBe('full-skill');
			expect(result.frontmatter.description).toBe('A comprehensive skill example');
			expect(result.frontmatter.license).toBe('MIT');
			expect(result.frontmatter.compatibility).toBe('Requires Node.js 18+');
			expect(result.frontmatter['allowed-tools']).toBe('Bash(git:*) Read');
			expect(result.frontmatter.metadata).toEqual({
				author: 'John Doe',
				version: '1.0.0',
				homepage: 'https://example.com',
			});
		});

		it('should parse SKILL.md with quoted values', () => {
			const content = `---
name: quoted-skill
description: "A description with quotes"
license: "Apache-2.0"
---

Content`;

			const result = SkillMdParser.parse(content);

			expect(result.frontmatter.description).toBe('A description with quotes');
			expect(result.frontmatter.license).toBe('Apache-2.0');
		});

		it('should skip comments in frontmatter', () => {
			const content = `---
# This is a comment
name: my-skill
# Another comment
description: Test skill
---

Content`;

			const result = SkillMdParser.parse(content);

			expect(result.frontmatter.name).toBe('my-skill');
			expect(result.frontmatter.description).toBe('Test skill');
		});

		it('should throw error for missing frontmatter', () => {
			const content = `# My Skill

No frontmatter here.`;

			expect(() => SkillMdParser.parse(content)).toThrow('Missing YAML frontmatter');
		});

		it('should throw error for missing closing delimiter', () => {
			const content = `---
name: my-skill
description: Test

No closing delimiter`;

			expect(() => SkillMdParser.parse(content)).toThrow('Missing closing ---');
		});

		it('should throw error for missing required name field', () => {
			const content = `---
description: Test skill
---

Content`;

			expect(() => SkillMdParser.parse(content)).toThrow('Missing required field "name"');
		});

		it('should throw error for missing required description field', () => {
			const content = `---
name: my-skill
---

Content`;

			expect(() => SkillMdParser.parse(content)).toThrow('Missing required field "description"');
		});

		it('should validate when validate option is true', () => {
			const content = `---
name: Invalid-Name
description: Test
---

Content`;

			expect(() => SkillMdParser.parse(content, { validate: true })).toThrow(
				'Invalid SKILL.md frontmatter',
			);
		});

		it('should not validate when validate option is false', () => {
			const content = `---
name: Invalid-Name
description: Test
---

Content`;

			const result = SkillMdParser.parse(content, { validate: false });
			expect(result.frontmatter.name).toBe('Invalid-Name');
		});
	});

	describe('generate', () => {
		it('should generate minimal SKILL.md', () => {
			const result = SkillMdParser.generate(
				{
					name: 'my-skill',
					description: 'A test skill',
				},
				'# My Skill\n\nContent here.',
			);

			expect(result).toContain('---');
			expect(result).toContain('name: my-skill');
			expect(result).toContain('description: A test skill');
			expect(result).toContain('# My Skill');
		});

		it('should generate SKILL.md with all fields', () => {
			const result = SkillMdParser.generate(
				{
					name: 'full-skill',
					description: 'Full example',
					license: 'MIT',
					compatibility: 'Node.js 18+',
					'allowed-tools': 'Read Write',
					metadata: {
						author: 'John Doe',
						version: '1.0.0',
					},
				},
				'Content',
			);

			expect(result).toContain('name: full-skill');
			expect(result).toContain('license: MIT');
			expect(result).toContain('compatibility: Node.js 18+');
			expect(result).toContain('allowed-tools: Read Write');
			expect(result).toContain('metadata:');
			expect(result).toContain('  author: "John Doe"');
			expect(result).toContain('  version: "1.0.0"');
		});

		it('should escape quotes in metadata values', () => {
			const result = SkillMdParser.generate(
				{
					name: 'test-skill',
					description: 'Test',
					metadata: {
						quote: 'He said "hello"',
					},
				},
				'Content',
			);

			expect(result).toContain('quote: "He said \\"hello\\""');
		});
	});

	describe('createTemplate', () => {
		it('should create a default template', () => {
			const result = SkillMdParser.createTemplate('my-skill', 'My skill description');

			expect(result).toContain('name: my-skill');
			expect(result).toContain('description: My skill description');
			expect(result).toContain('## Usage');
			expect(result).toContain('## Instructions');
		});
	});

	describe('create', () => {
		it('should create SKILL.md with custom parameters', () => {
			const result = SkillMdParser.create({
				name: 'custom-skill',
				description: 'Custom description',
				content: 'Custom content here',
				license: 'Apache-2.0',
				metadata: {
					author: 'Jane',
					version: '2.0',
				},
			});

			expect(result).toContain('name: custom-skill');
			expect(result).toContain('description: Custom description');
			expect(result).toContain('license: Apache-2.0');
			expect(result).toContain('metadata:');
			expect(result).toContain('Custom content here');
		});
	});

	describe('round-trip parsing', () => {
		it('should parse and generate identical content', () => {
			const original = `---
name: test-skill
description: Test skill for round-trip
license: MIT
metadata:
  author: "Test Author"
  version: "1.0"
---

# Test Skill

This is test content.`;

			const parsed = SkillMdParser.parse(original);
			const regenerated = SkillMdParser.generate(parsed.frontmatter, parsed.content);
			const reparsed = SkillMdParser.parse(regenerated);

			expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
			expect(reparsed.content).toBe(parsed.content);
		});
	});
});
