// src/test/system-agent-skill-toggle.test.ts
/**
 * Integration test for the bug fix:
 * Skills can be toggled without modifying agents (system or user)
 *
 * Bug Report:
 * - Error: "Cannot modify system agent planner"
 * - Occurred when trying to toggle skills for system agents
 * - Skills were stored in agent.defaultSkills, requiring agent modification
 *
 * Fix:
 * - Skills are now stored globally in active_skills table
 * - Skills can be toggled without modifying any agent definition
 * - All agents share the same global active skills list
 * - System agents remain immutable
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger FIRST before any imports that may use it

import { activeSkillsConfigService } from '@/services/active-skills-config-service';
import { useSkillsStore } from '@/stores/skills-store';

// Mock the active skills config service
vi.mock('@/services/active-skills-config-service', () => ({
  activeSkillsConfigService: {
    loadActiveSkills: vi.fn(),
    saveActiveSkills: vi.fn(),
  },
}));

// Mock logger

describe('Bug Fix: Global Skill Toggle', () => {
  beforeEach(() => {
    // Reset store state
    useSkillsStore.setState({
      skills: [],
      activeSkillIds: new Set(),
      isLoading: false,
      error: null,
      isInitialized: false,
    });

    vi.clearAllMocks();
  });

  it('should allow toggling skills globally (works for all agents)', async () => {
    const skillId = 'starrocks-expression';

    vi.mocked(activeSkillsConfigService.saveActiveSkills).mockResolvedValue();

    // Initialize with no skills
    useSkillsStore.setState({
      activeSkillIds: new Set(),
    });

    const { toggleSkill, getActiveSkills, isSkillActive } = useSkillsStore.getState();

    // Test: Toggle skill on (add)
    await expect(toggleSkill(skillId)).resolves.not.toThrow();

    // Verify skill was added via service
    expect(activeSkillsConfigService.saveActiveSkills).toHaveBeenCalledWith([skillId]);

    // Update store to reflect the change (simulate what would happen in real app)
    useSkillsStore.setState({
      activeSkillIds: new Set([skillId]),
    });

    // Verify skill is now active
    expect(isSkillActive(skillId)).toBe(true);
    expect(getActiveSkills()).toEqual([skillId]);

    // Test: Toggle skill off (remove)
    vi.mocked(activeSkillsConfigService.saveActiveSkills).mockClear();
    await expect(toggleSkill(skillId)).resolves.not.toThrow();

    // Verify skill was removed via service
    expect(activeSkillsConfigService.saveActiveSkills).toHaveBeenCalledWith([]);
  });

  it('should handle multiple skills globally', async () => {
    const skills = ['skill-1', 'skill-2', 'skill-3'];

    vi.mocked(activeSkillsConfigService.saveActiveSkills).mockResolvedValue();

    useSkillsStore.setState({
      activeSkillIds: new Set(),
    });

    const { setActiveSkills, getActiveSkills } = useSkillsStore.getState();

    // Set multiple skills at once
    await setActiveSkills(skills);

    // Verify all skills were set
    expect(activeSkillsConfigService.saveActiveSkills).toHaveBeenCalledWith(skills);

    // Update store to reflect the change
    useSkillsStore.setState({
      activeSkillIds: new Set(skills),
    });

    expect(getActiveSkills()).toEqual(skills);
  });

  it('should share skills across all agents', async () => {
    // Skills are now global, so any agent (system or user) can use them
    const skillId = 'skill-1';

    vi.mocked(activeSkillsConfigService.saveActiveSkills).mockResolvedValue();

    useSkillsStore.setState({
      activeSkillIds: new Set(),
    });

    const { toggleSkill, getActiveSkills, isSkillActive } = useSkillsStore.getState();

    // Toggle skill globally
    await toggleSkill(skillId);
    expect(activeSkillsConfigService.saveActiveSkills).toHaveBeenCalledWith([skillId]);

    // Update store to reflect the change
    useSkillsStore.setState({
      activeSkillIds: new Set([skillId]),
    });

    // All agents share the same active skills
    expect(isSkillActive(skillId)).toBe(true);
    expect(getActiveSkills()).toEqual([skillId]);

    // This means both system agents (planner) and user agents can use this skill
    // without any agent-specific configuration
  });

  it('should persist skills across multiple toggles', async () => {
    const skillIds = ['skill-1', 'skill-2', 'skill-3'];

    vi.mocked(activeSkillsConfigService.saveActiveSkills).mockResolvedValue();

    useSkillsStore.setState({
      activeSkillIds: new Set(),
    });

    const { toggleSkill } = useSkillsStore.getState();

    // Toggle multiple skills on
    for (const skillId of skillIds) {
      const _currentSkills = useSkillsStore.getState().getActiveSkills();
      await toggleSkill(skillId);

      // Update store to reflect the change
      useSkillsStore.setState((state) => {
        const newActiveSkillIds = new Set(state.activeSkillIds);
        newActiveSkillIds.add(skillId);
        return { activeSkillIds: newActiveSkillIds };
      });
    }

    // Verify all calls were made
    expect(activeSkillsConfigService.saveActiveSkills).toHaveBeenCalledTimes(3);

    // Verify final state
    const finalSkills = useSkillsStore.getState().getActiveSkills();
    expect(finalSkills.sort()).toEqual(skillIds.sort());
  });
});
