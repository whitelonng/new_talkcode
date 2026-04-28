// src/components/chat/skills-selector-button.test.tsx

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillsSelectorButton } from './skills-selector-button';

vi.mock('@/hooks/use-skills', () => ({
  useSkills: () => ({ skills: [], loading: false }),
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getSync: vi.fn(() => 'en'),
  },
  useSettingsStore: (selector: (state: { language: string; setLanguage: (language: string) => Promise<void> }) => unknown) =>
    selector({
      language: 'en',
      setLanguage: vi.fn(async () => {}),
    }),
}));

vi.mock('@/stores/agent-store', () => ({
  useAgentStore: (selector: (state: { agents: Map<string, { id: string; defaultSkills: string[] }> }) => unknown) =>
    selector({
      agents: new Map([
        ['planner', { id: 'planner', defaultSkills: ['skill-1'] }],
        ['reviewer', { id: 'reviewer', defaultSkills: ['skill-3'] }],
      ]),
    }),
}));

const mockAddedByScope: Record<string, string[]> = {};
const mockRemovedByScope: Record<string, string[]> = {};

function scopeKey(taskId?: string | null, agentId?: string | null) {
  return `${taskId || '__global__'}::${agentId || '__default__'}`;
}

function resolveSkillIds(taskId?: string | null, agentId?: string | null, defaultSkillIds: string[] = []) {
  const key = scopeKey(taskId, agentId);
  const added = mockAddedByScope[key] || [];
  const removed = new Set(mockRemovedByScope[key] || []);
  return [...defaultSkillIds.filter((id) => !removed.has(id)), ...added].filter(
    (id, index, arr) => arr.indexOf(id) === index
  );
}

const mockToggleSkillForScope = vi.fn(
  (taskId?: string | null, agentId?: string | null, skillId?: string, defaultSkillIds: string[] = []) => {
    const key = scopeKey(taskId, agentId);
    const added = new Set(mockAddedByScope[key] || []);
    const removed = new Set(mockRemovedByScope[key] || []);
    const defaults = new Set(defaultSkillIds);
    const active = new Set(resolveSkillIds(taskId, agentId, defaultSkillIds));

    if (active.has(skillId as string)) {
      if (defaults.has(skillId as string)) {
        removed.add(skillId as string);
      } else {
        added.delete(skillId as string);
      }
    } else if (defaults.has(skillId as string)) {
      removed.delete(skillId as string);
    } else {
      added.add(skillId as string);
    }

    mockAddedByScope[key] = Array.from(added);
    mockRemovedByScope[key] = Array.from(removed);
    return resolveSkillIds(taskId, agentId, defaultSkillIds);
  }
);

vi.mock('@/stores/conversation-agent-store', () => ({
  useConversationAgentStore: (selector: (state: unknown) => unknown) =>
    selector({
      getAgentForTask: (taskId?: string | null) => (taskId === 'task-2' ? 'reviewer' : 'planner'),
    }),
}));

vi.mock('@/stores/conversation-skills-store', () => ({
  useConversationSkillsStore: (selector: (state: unknown) => unknown) =>
    selector({
      resolveSkillIds,
      toggleSkillForScope: mockToggleSkillForScope,
    }),
}));

describe('SkillsSelectorButton - Scoped skills', () => {
  beforeEach(() => {
    Object.keys(mockAddedByScope).forEach((key) => delete mockAddedByScope[key]);
    Object.keys(mockRemovedByScope).forEach((key) => delete mockRemovedByScope[key]);
    mockToggleSkillForScope.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render without causing infinite re-renders', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<SkillsSelectorButton taskId="task-1" />);

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should include agent default skills in active count', () => {
    const { unmount } = render(<SkillsSelectorButton taskId="task-1" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    unmount();
  });

  it('should isolate default skill sets between agents and tasks', () => {
    const first = render(<SkillsSelectorButton taskId="task-1" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    first.unmount();

    const second = render(<SkillsSelectorButton taskId="task-2" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    second.unmount();
  });
});
