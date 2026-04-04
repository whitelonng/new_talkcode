/**
 * Tests for SkillPackageValidator
 */

import { describe, expect, it } from 'vitest';
import { SkillPackageValidator } from './skill-package-validator';

describe('SkillPackageValidator', () => {
	describe('Cross-platform path handling', () => {
		it('should split path with both forward and backward slashes', () => {
			// Test the regex pattern used in getDirectoryName
			const windowsPath = 'C:\\Users\\test\\skills\\test-skill';
			const unixPath = '/home/user/skills/test-skill';
			const mixedPath = 'C:/Users/test\\skills/test-skill';

			// Windows path
			const windowsParts = windowsPath.split(/[\\/]/);
			expect(windowsParts[windowsParts.length - 1]).toBe('test-skill');

			// Unix path
			const unixParts = unixPath.split(/[\\/]/);
			expect(unixParts[unixParts.length - 1]).toBe('test-skill');

			// Mixed path
			const mixedParts = mixedPath.split(/[\\/]/);
			expect(mixedParts[mixedParts.length - 1]).toBe('test-skill');
		});
	});

	describe('isPrivateFile', () => {
		it('should identify .git as private', () => {
			expect(SkillPackageValidator.isPrivateFile('.git')).toBe(true);
		});

		it('should identify .DS_Store as private', () => {
			expect(SkillPackageValidator.isPrivateFile('.DS_Store')).toBe(true);
		});

		it('should not identify regular files as private', () => {
			expect(SkillPackageValidator.isPrivateFile('script.py')).toBe(false);
		});
	});

	describe('getPrivateFileNames', () => {
		it('should return list of private file names', () => {
			const privateFiles = SkillPackageValidator.getPrivateFileNames();

			expect(privateFiles).toContain('.git');
			expect(privateFiles).toContain('.DS_Store');
			expect(privateFiles).toContain('node_modules');
		});
	});
});
