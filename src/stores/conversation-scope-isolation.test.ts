import { beforeEach, describe, expect, it } from 'vitest';
import { useConversationAgentStore } from '@/stores/conversation-agent-store';
import { useConversationSkillsStore } from '@/stores/conversation-skills-store';

describe('conversation scoped agent and skills isolation', () => {
  beforeEach(() => {
    useConversationAgentStore.setState({ agentByTaskId: {} });
    useConversationSkillsStore.setState({
      addedSkillIdsByScope: {},
      removedSkillIdsByScope: {},
    });
  });

  it('should isolate selected agent per task', () => {
    const agentStore = useConversationAgentStore.getState();

    agentStore.setAgentForTask('task-1', 'planner');
    agentStore.setAgentForTask('task-2', 'reviewer');

    expect(agentStore.getAgentForTask('task-1', 'coding')).toBe('planner');
    expect(agentStore.getAgentForTask('task-2', 'coding')).toBe('reviewer');
    expect(agentStore.getAgentForTask('task-3', 'coding')).toBe('coding');
  });

  it('should resolve defaults plus per-conversation additions', () => {
    const skillsStore = useConversationSkillsStore.getState();

    skillsStore.toggleSkillForScope('task-1', 'planner', 'skill-c', ['skill-a']);

    expect(skillsStore.resolveSkillIds('task-1', 'planner', ['skill-a'])).toEqual([
      'skill-a',
      'skill-c',
    ]);
    expect(skillsStore.resolveSkillIds('task-2', 'planner', ['skill-a'])).toEqual(['skill-a']);
  });

  it('should allow removing a default skill only for current scope', () => {
    const skillsStore = useConversationSkillsStore.getState();

    skillsStore.toggleSkillForScope('task-1', 'planner', 'skill-a', ['skill-a', 'skill-b']);

    expect(skillsStore.resolveSkillIds('task-1', 'planner', ['skill-a', 'skill-b'])).toEqual([
      'skill-b',
    ]);
    expect(skillsStore.resolveSkillIds('task-2', 'planner', ['skill-a', 'skill-b'])).toEqual([
      'skill-a',
      'skill-b',
    ]);
  });
});
