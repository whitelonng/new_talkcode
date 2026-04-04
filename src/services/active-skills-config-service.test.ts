/**
 * Active Skills Config Service Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeSkillsConfigService } from './active-skills-config-service';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
	appDataDir: vi.fn().mockResolvedValue('/test/app-data'),
	join: vi.fn().mockImplementation(async (...paths: string[]) => paths.join('/')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn().mockResolvedValue(false),
	mkdir: vi.fn().mockResolvedValue(undefined),
	readTextFile: vi.fn().mockResolvedValue('{"activeSkills":[],"lastUpdated":0}'),
	writeTextFile: vi.fn().mockResolvedValue(undefined),
}));


describe('ActiveSkillsConfigService', () => {
	let mockExists: any;
	let mockReadTextFile: any;
	let mockWriteTextFile: any;

	beforeEach(async () => {
		const fs = await import('@tauri-apps/plugin-fs');
		mockExists = vi.mocked(fs.exists);
		mockReadTextFile = vi.mocked(fs.readTextFile);
		mockWriteTextFile = vi.mocked(fs.writeTextFile);

		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('loadActiveSkills', () => {
		it('should load active skills from config file', async () => {
			mockExists.mockResolvedValueOnce(true);
			mockReadTextFile.mockResolvedValueOnce(
				JSON.stringify({
					activeSkills: ['skill-1', 'skill-2', 'skill-3'],
					lastUpdated: Date.now(),
				})
			);

			const skills = await activeSkillsConfigService.loadActiveSkills();

			expect(skills).toEqual(['skill-1', 'skill-2', 'skill-3']);
			expect(mockReadTextFile).toHaveBeenCalledWith('/test/app-data/active-skills.json');
		});

		it('should create config file if it does not exist', async () => {
			mockExists.mockResolvedValueOnce(false);
			mockWriteTextFile.mockResolvedValueOnce(undefined);

			const skills = await activeSkillsConfigService.loadActiveSkills();

			expect(skills).toEqual([]);
			expect(mockWriteTextFile).toHaveBeenCalled();
		});

		it('should return empty array on error', async () => {
			mockExists.mockResolvedValue(true);
			mockReadTextFile.mockRejectedValue(new Error('Read failed'));

			const skills = await activeSkillsConfigService.loadActiveSkills();

			expect(skills).toEqual([]);
		});
	});

	describe('saveActiveSkills', () => {
		it('should save active skills to config file', async () => {
			const skillIds = ['skill-1', 'skill-2'];

			await activeSkillsConfigService.saveActiveSkills(skillIds);

			expect(mockWriteTextFile).toHaveBeenCalled();
			const savedData = JSON.parse(mockWriteTextFile.mock.calls[0][1]);
			expect(savedData.activeSkills).toEqual(['skill-1', 'skill-2']);
		});

		it('should save empty array', async () => {
			await activeSkillsConfigService.saveActiveSkills([]);

			expect(mockWriteTextFile).toHaveBeenCalled();
			const savedData = JSON.parse(mockWriteTextFile.mock.calls[0][1]);
			expect(savedData.activeSkills).toEqual([]);
		});

		it('should throw error on write failure', async () => {
			mockWriteTextFile.mockRejectedValue(new Error('Write failed'));

			await expect(activeSkillsConfigService.saveActiveSkills(['skill-1'])).rejects.toThrow(
				'Write failed'
			);
		});
	});

	describe('addActiveSkill', () => {
		it('should add a skill to active list', async () => {
			mockExists.mockResolvedValueOnce(true);
			mockReadTextFile.mockResolvedValueOnce(
				JSON.stringify({
					activeSkills: ['skill-1'],
					lastUpdated: Date.now(),
				})
			);
			mockWriteTextFile.mockResolvedValueOnce(undefined);

			await activeSkillsConfigService.addActiveSkill('skill-2');

			expect(mockWriteTextFile).toHaveBeenCalled();
			const savedData = JSON.parse(mockWriteTextFile.mock.calls[0][1]);
			expect(savedData.activeSkills).toContain('skill-1');
			expect(savedData.activeSkills).toContain('skill-2');
		});

		it('should not add duplicate skill', async () => {
			mockExists.mockResolvedValueOnce(true);
			mockReadTextFile.mockResolvedValueOnce(
				JSON.stringify({
					activeSkills: ['skill-1'],
					lastUpdated: Date.now(),
				})
			);

			await activeSkillsConfigService.addActiveSkill('skill-1');

			// Should not write since skill already exists
			expect(mockWriteTextFile).not.toHaveBeenCalled();
		});
	});

	describe('removeActiveSkill', () => {
		it('should remove a skill from active list', async () => {
			mockExists.mockResolvedValueOnce(true);
			mockReadTextFile.mockResolvedValueOnce(
				JSON.stringify({
					activeSkills: ['skill-1', 'skill-2', 'skill-3'],
					lastUpdated: Date.now(),
				})
			);
			mockWriteTextFile.mockResolvedValueOnce(undefined);

			await activeSkillsConfigService.removeActiveSkill('skill-2');

			expect(mockWriteTextFile).toHaveBeenCalled();
			const savedData = JSON.parse(mockWriteTextFile.mock.calls[0][1]);
			expect(savedData.activeSkills).toEqual(['skill-1', 'skill-3']);
		});

		it('should not write if skill not in list', async () => {
			mockExists.mockResolvedValueOnce(true);
			mockReadTextFile.mockResolvedValueOnce(
				JSON.stringify({
					activeSkills: ['skill-1'],
					lastUpdated: Date.now(),
				})
			);

			await activeSkillsConfigService.removeActiveSkill('skill-2');

			// Should not write since skill was not in list
			expect(mockWriteTextFile).not.toHaveBeenCalled();
		});
	});

	describe('isSkillActive', () => {
		it('should return true if skill is active', async () => {
			mockExists.mockResolvedValue(true);
			mockReadTextFile.mockResolvedValue(
				JSON.stringify({
					activeSkills: ['skill-1', 'skill-2'],
					lastUpdated: Date.now(),
				})
			);

			const isActive = await activeSkillsConfigService.isSkillActive('skill-1');

			expect(isActive).toBe(true);
		});

		it('should return false if skill is not active', async () => {
			mockExists.mockResolvedValue(true);
			mockReadTextFile.mockResolvedValue(
				JSON.stringify({
					activeSkills: ['skill-1'],
					lastUpdated: Date.now(),
				})
			);

			const isActive = await activeSkillsConfigService.isSkillActive('skill-2');

			expect(isActive).toBe(false);
		});
	});

	describe('clearActiveSkills', () => {
		it('should clear all active skills', async () => {
			mockWriteTextFile.mockResolvedValueOnce(undefined);

			await activeSkillsConfigService.clearActiveSkills();

			expect(mockWriteTextFile).toHaveBeenCalled();
			const savedData = JSON.parse(mockWriteTextFile.mock.calls[0][1]);
			expect(savedData.activeSkills).toEqual([]);
		});
	});
});
