/**
 * Tests for AgentSkillValidator
 */

import { describe, expect, it } from 'vitest';
import { AgentSkillValidator } from './agent-skill-validator';

describe('AgentSkillValidator', () => {
	describe('validateName', () => {
		it('should accept valid names', () => {
			expect(AgentSkillValidator.validateName('my-skill')).toEqual([]);
			expect(AgentSkillValidator.validateName('skill123')).toEqual([]);
			expect(AgentSkillValidator.validateName('a')).toEqual([]);
			expect(AgentSkillValidator.validateName('my-very-long-skill-name-with-many-parts')).toEqual([]);
		});

		it('should reject empty name', () => {
			const errors = AgentSkillValidator.validateName('');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('name-required');
		});

		it('should reject names longer than 64 characters', () => {
			const longName = 'a'.repeat(65);
			const errors = AgentSkillValidator.validateName(longName);
			expect(errors.some((e) => e.rule === 'name-max-length')).toBe(true);
		});

		it('should reject names with uppercase letters', () => {
			const errors = AgentSkillValidator.validateName('My-Skill');
			expect(errors.some((e) => e.rule === 'name-charset')).toBe(true);
		});

		it('should reject names with invalid characters', () => {
			expect(
				AgentSkillValidator.validateName('my_skill').some((e) => e.rule === 'name-charset'),
			).toBe(true);
			expect(
				AgentSkillValidator.validateName('my skill').some((e) => e.rule === 'name-charset'),
			).toBe(true);
			expect(
				AgentSkillValidator.validateName('my.skill').some((e) => e.rule === 'name-charset'),
			).toBe(true);
		});

		it('should reject names starting with hyphen', () => {
			const errors = AgentSkillValidator.validateName('-skill');
			expect(errors.some((e) => e.rule === 'name-hyphen-position')).toBe(true);
		});

		it('should reject names ending with hyphen', () => {
			const errors = AgentSkillValidator.validateName('skill-');
			expect(errors.some((e) => e.rule === 'name-hyphen-position')).toBe(true);
		});

		it('should reject names with consecutive hyphens', () => {
			const errors = AgentSkillValidator.validateName('my--skill');
			expect(errors.some((e) => e.rule === 'name-consecutive-hyphens')).toBe(true);
		});
	});

	describe('validateDescription', () => {
		it('should accept valid descriptions', () => {
			expect(AgentSkillValidator.validateDescription('A valid description')).toEqual([]);
			expect(
				AgentSkillValidator.validateDescription(
					'A longer description that provides details about the skill',
				),
			).toEqual([]);
		});

		it('should reject empty description', () => {
			const errors = AgentSkillValidator.validateDescription('');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('description-required');
		});

		it('should reject whitespace-only description', () => {
			const errors = AgentSkillValidator.validateDescription('   ');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('description-required');
		});

		it('should reject descriptions longer than 1024 characters', () => {
			const longDesc = 'a'.repeat(1025);
			const errors = AgentSkillValidator.validateDescription(longDesc);
			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('description-max-length');
		});
	});

	describe('validateCompatibility', () => {
		it('should accept undefined compatibility', () => {
			expect(AgentSkillValidator.validateCompatibility(undefined)).toEqual([]);
		});

		it('should accept valid compatibility', () => {
			expect(AgentSkillValidator.validateCompatibility('Requires Node.js 18+')).toEqual([]);
		});

		it('should reject compatibility longer than 500 characters', () => {
			const longCompat = 'a'.repeat(501);
			const errors = AgentSkillValidator.validateCompatibility(longCompat);
			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('compatibility-max-length');
		});
	});

	describe('validateMetadata', () => {
		it('should accept undefined metadata', () => {
			expect(AgentSkillValidator.validateMetadata(undefined)).toEqual([]);
		});

		it('should accept valid metadata', () => {
			expect(
				AgentSkillValidator.validateMetadata({
					author: 'John Doe',
					version: '1.0.0',
				}),
			).toEqual([]);
		});

		it('should reject non-string values in metadata', () => {
			const errors = AgentSkillValidator.validateMetadata({
				author: 'John Doe',
				version: 123 as unknown as string, // Invalid
			});
			expect(errors.some((e) => e.rule === 'metadata-type')).toBe(true);
		});
	});

	describe('validate', () => {
		it('should validate complete frontmatter successfully', () => {
			const result = AgentSkillValidator.validate({
				name: 'my-skill',
				description: 'A comprehensive description of my skill and when to use it',
				license: 'MIT',
			});

			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should return errors for invalid frontmatter', () => {
			const result = AgentSkillValidator.validate({
				name: 'My-Invalid-Name',
				description: '',
			});

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should warn about short descriptions', () => {
			const result = AgentSkillValidator.validate({
				name: 'my-skill',
				description: 'Short desc',
			});

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings.some((w) => w.field === 'description')).toBe(true);
		});
	});

	describe('normalizeName', () => {
		it('should convert to lowercase', () => {
			expect(AgentSkillValidator.normalizeName('My-Skill')).toBe('my-skill');
		});

		it('should replace spaces with hyphens', () => {
			expect(AgentSkillValidator.normalizeName('my skill')).toBe('my-skill');
		});

		it('should replace underscores with hyphens', () => {
			expect(AgentSkillValidator.normalizeName('my_skill')).toBe('my-skill');
		});

		it('should remove consecutive hyphens', () => {
			expect(AgentSkillValidator.normalizeName('my--skill')).toBe('my-skill');
		});

		it('should remove leading hyphens', () => {
			expect(AgentSkillValidator.normalizeName('-my-skill')).toBe('my-skill');
		});

		it('should remove trailing hyphens', () => {
			expect(AgentSkillValidator.normalizeName('my-skill-')).toBe('my-skill');
		});

		it('should truncate to 64 characters', () => {
			const longName = 'a'.repeat(100);
			const normalized = AgentSkillValidator.normalizeName(longName);
			expect(normalized.length).toBe(64);
		});

		it('should handle complex names', () => {
			expect(AgentSkillValidator.normalizeName('My_Awesome Skill!!')).toBe('my-awesome-skill');
		});
	});

	describe('validateDirectoryMatch', () => {
		it('should accept matching names', () => {
			expect(AgentSkillValidator.validateDirectoryMatch('my-skill', 'my-skill')).toEqual([]);
		});

		it('should reject non-matching names', () => {
			const errors = AgentSkillValidator.validateDirectoryMatch('my-skill', 'other-skill');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.rule).toBe('name-directory-match');
		});
	});

	describe('validateContentLength', () => {
		it('should not warn for short content', () => {
			const content = 'Line 1\nLine 2\nLine 3';
			expect(AgentSkillValidator.validateContentLength(content)).toEqual([]);
		});

		it('should warn for very long content', () => {
			const content = Array(501)
				.fill('line')
				.join('\n');
			const warnings = AgentSkillValidator.validateContentLength(content);
			expect(warnings.length).toBeGreaterThan(0);
			expect(warnings[0]?.field).toBe('content');
		});
	});
});
