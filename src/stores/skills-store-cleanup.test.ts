/**
 * Skills Store Cleanup Tests
 *
 * Tests for the cleanup logic that removes invalid active skill IDs
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkillsStore } from './skills-store';
import type { Skill } from '@/services/skills';

// Mock dependencies

// Mock dependencies
vi.mock('@/services/database-service', () => ({
	databaseService: {
		getActiveSkills: vi.fn().mockResolvedValue([]),
		setActiveSkills: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/services/skills', () => ({
	getSkillService: vi.fn().mockResolvedValue({
		listSkills: vi.fn().mockResolvedValue([]),
	}),
}));

vi.mock('@/services/skills/file-based-skill-service', () => ({
	getFileBasedSkillService: vi.fn().mockResolvedValue({
		listSkills: vi.fn().mockResolvedValue([]),
	}),
}));

vi.mock('@/services/active-skills-config-service', () => ({
	activeSkillsConfigService: {
		loadActiveSkills: vi.fn().mockResolvedValue([]),
		saveActiveSkills: vi.fn().mockResolvedValue(undefined),
		removeActiveSkill: vi.fn().mockResolvedValue(undefined),
	},
}));

// Mock logger

describe('Skills Store - Cleanup Logic', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store state
		useSkillsStore.setState({
			skills: [],
			activeSkillIds: new Set(),
			isLoading: false,
			error: null,
			isInitialized: false,
		});
	});

	describe('cleanupActiveSkills', () => {
		it('should remove active skill IDs that no longer exist', async () => {
			const { activeSkillsConfigService } = await import(
				'@/services/active-skills-config-service'
			);
			const mockSave = vi.mocked(activeSkillsConfigService.saveActiveSkills);

			// Setup: 3 active skills, but only 2 exist
			const existingSkills: Skill[] = [
				{
					id: 'skill-1',
					name: 'Skill 1',
					description: 'Test',
					category: 'test',
					content: { systemPromptFragment: '', documentation: [] },
					metadata: { isBuiltIn: false, sourceType: 'local', tags: [], createdAt: 0, updatedAt: 0 },
				},
				{
					id: 'skill-2',
					name: 'Skill 2',
					description: 'Test',
					category: 'test',
					content: { systemPromptFragment: '', documentation: [] },
					metadata: { isBuiltIn: false, sourceType: 'local', tags: [], createdAt: 0, updatedAt: 0 },
				},
			];

			useSkillsStore.setState({
				skills: existingSkills,
				activeSkillIds: new Set(['skill-1', 'skill-2', 'skill-3']), // skill-3 doesn't exist
			});

			await useSkillsStore.getState().cleanupActiveSkills();

			// Should save only valid skills
			expect(mockSave).toHaveBeenCalledWith(['skill-1', 'skill-2']);

			// Store should be updated
			const state = useSkillsStore.getState();
			expect(state.activeSkillIds.size).toBe(2);
			expect(state.activeSkillIds.has('skill-1')).toBe(true);
			expect(state.activeSkillIds.has('skill-2')).toBe(true);
			expect(state.activeSkillIds.has('skill-3')).toBe(false);
		});

		it('should not save if all active skills exist', async () => {
			const { activeSkillsConfigService } = await import(
				'@/services/active-skills-config-service'
			);
			const mockSave = vi.mocked(activeSkillsConfigService.saveActiveSkills);

			const existingSkills: Skill[] = [
				{
					id: 'skill-1',
					name: 'Skill 1',
					description: 'Test',
					category: 'test',
					content: { systemPromptFragment: '', documentation: [] },
					metadata: { isBuiltIn: false, sourceType: 'local', tags: [], createdAt: 0, updatedAt: 0 },
				},
			];

			useSkillsStore.setState({
				skills: existingSkills,
				activeSkillIds: new Set(['skill-1']),
			});

			await useSkillsStore.getState().cleanupActiveSkills();

			// Should not save since all active skills exist
			expect(mockSave).not.toHaveBeenCalled();
		});

		it('should handle empty active skills', async () => {
			const { activeSkillsConfigService } = await import(
				'@/services/active-skills-config-service'
			);
			const mockSave = vi.mocked(activeSkillsConfigService.saveActiveSkills);

			useSkillsStore.setState({
				skills: [],
				activeSkillIds: new Set(),
			});

			await useSkillsStore.getState().cleanupActiveSkills();

			expect(mockSave).not.toHaveBeenCalled();
		});

		it('should clear all active skills if no skills exist', async () => {
			const { activeSkillsConfigService } = await import(
				'@/services/active-skills-config-service'
			);
			const mockSave = vi.mocked(activeSkillsConfigService.saveActiveSkills);

			useSkillsStore.setState({
				skills: [], // No skills
				activeSkillIds: new Set(['skill-1', 'skill-2', 'skill-3']), // But has active IDs
			});

			await useSkillsStore.getState().cleanupActiveSkills();

			// Should clear all active skills
			expect(mockSave).toHaveBeenCalledWith([]);

			const state = useSkillsStore.getState();
			expect(state.activeSkillIds.size).toBe(0);
		});

		it('should handle config save errors gracefully', async () => {
			const { activeSkillsConfigService } = await import(
				'@/services/active-skills-config-service'
			);
			const mockSave = vi.mocked(activeSkillsConfigService.saveActiveSkills);
			mockSave.mockRejectedValue(new Error('Save failed'));

			const existingSkills: Skill[] = [
				{
					id: 'skill-1',
					name: 'Skill 1',
					description: 'Test',
					category: 'test',
					content: { systemPromptFragment: '', documentation: [] },
					metadata: { isBuiltIn: false, sourceType: 'local', tags: [], createdAt: 0, updatedAt: 0 },
				},
			];

			useSkillsStore.setState({
				skills: existingSkills,
				activeSkillIds: new Set(['skill-1', 'skill-2']),
			});

			// Should not throw
			await expect(useSkillsStore.getState().cleanupActiveSkills()).resolves.not.toThrow();
		});
	});
});
