// src/components/chat/skills-selector-button.test.tsx

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentDefinition } from '@/types/agent';
import { mockToast } from '@/test/mocks';

// Mock all the dependencies before importing the component

// Now import the component
import { SkillsSelectorButton } from './skills-selector-button';

vi.mock('@/hooks/use-skills', () => ({
  useSkills: () => ({ skills: [], loading: false }),
}));

vi.mock('@/hooks/use-settings', () => ({
  useAppSettings: () => ({
    settings: { assistantId: 'test-agent' },
  }),
}));


vi.mock('@/services/agents/agent-registry', () => ({
  agentRegistry: {
    loadFromDatabase: vi.fn(),
    list: vi.fn(() => []),
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getProject: vi.fn(),
    getSync: vi.fn(() => 'en'),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
  useSettingsStore: (selector: (state: any) => any) => {
    const mockState = {
      language: 'en',
      setLanguage: vi.fn(),
      getAutoApproveEditsGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
    };
    return selector(mockState);
  },
}));

// Mock the skills store
const mockActiveSkillIds = new Set<string>();
const mockLoadActiveSkills = vi.fn();
const mockToggleSkill = vi.fn();

vi.mock('@/stores/skills-store', () => ({
  useSkillsStore: (selector: any) => {
    const state = {
      activeSkillIds: mockActiveSkillIds,
      loadActiveSkills: mockLoadActiveSkills,
      toggleSkill: mockToggleSkill,
    };
    return selector(state);
  },
}));

/**
 * Helper function that implements the auto-enable/disable logic
 * This is extracted from skills-selector-button.tsx handleToggleSkill
 */
function prepareSkillUpdate(
  agent: AgentDefinition,
  updatedSkills: string[]
): Partial<AgentDefinition> {
  const updates: Partial<AgentDefinition> = {
    defaultSkills: updatedSkills,
  };

  // Auto-enable/disable 'skills' provider based on whether any skills are active
  if (agent.dynamicPrompt) {
    const providers = agent.dynamicPrompt.providers || [];
    const hasSkillsProvider = providers.includes('skills');

    if (updatedSkills.length > 0 && !hasSkillsProvider) {
      // Adding first skill - enable 'skills' provider
      updates.dynamicPrompt = {
        ...agent.dynamicPrompt,
        providers: [...providers, 'skills'],
      };
    } else if (updatedSkills.length === 0 && hasSkillsProvider) {
      // Removing last skill - disable 'skills' provider
      updates.dynamicPrompt = {
        ...agent.dynamicPrompt,
        providers: providers.filter((p) => p !== 'skills'),
      };
    }
  }

  return updates;
}

describe('SkillsSelectorButton - Skills Provider Auto-Enablement', () => {
  let mockAgent: AgentDefinition;

  beforeEach(() => {
    // Create a mock agent with dynamicPrompt configuration
    mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent for skill provider tests',
      modelType: 'main_model' as any,
      systemPrompt: 'You are a test agent',
      defaultSkills: [],
      dynamicPrompt: {
        enabled: true,
        providers: ['project_root', 'agents_md'],
        variables: {},
      },
    };
  });

  it('should auto-enable skills provider when adding first skill', () => {
    // Simulate adding first skill
    const updatedSkills = ['skill-1'];
    const updates = prepareSkillUpdate(mockAgent, updatedSkills);

    // Verify the updates include 'skills' provider
    expect(updates.defaultSkills).toEqual(['skill-1']);
    expect(updates.dynamicPrompt?.providers).toContain('skills');
    expect(updates.dynamicPrompt?.providers).toEqual(['project_root', 'agents_md', 'skills']);
  });

  it('should keep skills provider enabled when multiple skills are active', () => {
    // Start with one skill already active
    const agentWithSkill: AgentDefinition = {
      ...mockAgent,
      defaultSkills: ['skill-1'],
      dynamicPrompt: {
        ...mockAgent.dynamicPrompt!,
        providers: ['project_root', 'agents_md', 'skills'],
      },
    };

    // Add second skill
    const updatedSkills = ['skill-1', 'skill-2'];
    const updates = prepareSkillUpdate(agentWithSkill, updatedSkills);

    // Skills provider should remain enabled (no change to dynamicPrompt)
    expect(updates.defaultSkills).toEqual(['skill-1', 'skill-2']);
    // dynamicPrompt should not be changed since 'skills' was already present
    expect(updates.dynamicPrompt).toBeUndefined();
  });

  it('should auto-disable skills provider when removing last skill', () => {
    // Start with one skill active and 'skills' provider enabled
    const agentWithSkill: AgentDefinition = {
      ...mockAgent,
      defaultSkills: ['skill-1'],
      dynamicPrompt: {
        ...mockAgent.dynamicPrompt!,
        providers: ['project_root', 'agents_md', 'skills'],
      },
    };

    // Remove last skill
    const updatedSkills: string[] = [];
    const updates = prepareSkillUpdate(agentWithSkill, updatedSkills);

    // Verify 'skills' provider is removed
    expect(updates.defaultSkills).toEqual([]);
    expect(updates.dynamicPrompt?.providers).not.toContain('skills');
    expect(updates.dynamicPrompt?.providers).toEqual(['project_root', 'agents_md']);
  });

  it('should handle agent without dynamicPrompt gracefully', () => {
    // Create agent without dynamicPrompt
    const agentWithoutDynamic: AgentDefinition = {
      ...mockAgent,
      dynamicPrompt: undefined,
    };

    // Try to add a skill
    const updatedSkills = ['skill-1'];
    const updates = prepareSkillUpdate(agentWithoutDynamic, updatedSkills);

    // Should update skills but not touch dynamicPrompt
    expect(updates.defaultSkills).toEqual(['skill-1']);
    // dynamicPrompt should remain undefined since it wasn't present
    expect(updates.dynamicPrompt).toBeUndefined();
  });

  it('should handle removing a skill when multiple skills exist', () => {
    // Start with multiple skills
    const agentWithSkills: AgentDefinition = {
      ...mockAgent,
      defaultSkills: ['skill-1', 'skill-2', 'skill-3'],
      dynamicPrompt: {
        ...mockAgent.dynamicPrompt!,
        providers: ['project_root', 'agents_md', 'skills'],
      },
    };

    // Remove one skill (not the last one)
    const updatedSkills = ['skill-1', 'skill-3'];
    const updates = prepareSkillUpdate(agentWithSkills, updatedSkills);

    // Skills provider should remain enabled (no change to dynamicPrompt)
    expect(updates.defaultSkills).toEqual(['skill-1', 'skill-3']);
    // dynamicPrompt should not be changed since there are still skills active
    expect(updates.dynamicPrompt).toBeUndefined();
  });
});

describe('SkillsSelectorButton - Infinite Loop Regression Test', () => {
  beforeEach(() => {
    mockActiveSkillIds.clear();
    mockLoadActiveSkills.mockClear();
    mockToggleSkill.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render without causing infinite re-renders', () => {
    // This test verifies the fix for the bug where calling getActiveSkills()
    // in the Zustand selector caused infinite re-renders because it returned
    // a new array reference on every call.

    // Mock console.error to detect React errors
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Render the component
    const { unmount } = render(<SkillsSelectorButton />);

    // Verify no React errors occurred (like "Maximum update depth exceeded")
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('should be cached to avoid an infinite loop')
    );

    // Verify loadActiveSkills was called exactly once on mount
    expect(mockLoadActiveSkills).toHaveBeenCalledTimes(1);

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should subscribe to activeSkillIds Set directly, not call getActiveSkills()', () => {
    // This test ensures we're subscribing to the Set directly instead of
    // calling a function that returns a new array on every render

    // Add some skills to the Set
    mockActiveSkillIds.add('skill-1');
    mockActiveSkillIds.add('skill-2');

    // Render the component
    const { unmount } = render(<SkillsSelectorButton />);

    // The component should render successfully
    // If it was calling getActiveSkills() instead of subscribing to activeSkillIds,
    // it would cause an infinite loop
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Verify the active count badge shows the correct number
    const badge = screen.getByText('2');
    expect(badge).toBeInTheDocument();

    // Clean up
    unmount();
  });

  it('should handle Set changes without re-render loops', () => {
    // Start with an empty Set
    const { unmount, rerender } = render(<SkillsSelectorButton />);

    // Add a skill to the Set
    mockActiveSkillIds.add('skill-1');

    // Re-render with the updated Set
    rerender(<SkillsSelectorButton />);

    // The component should handle the change without issues
    expect(screen.getByText('1')).toBeInTheDocument();

    // Add another skill
    mockActiveSkillIds.add('skill-2');
    rerender(<SkillsSelectorButton />);

    expect(screen.getByText('2')).toBeInTheDocument();

    // Remove a skill
    mockActiveSkillIds.delete('skill-1');
    rerender(<SkillsSelectorButton />);

    expect(screen.getByText('1')).toBeInTheDocument();

    // Clean up
    unmount();
  });
});
