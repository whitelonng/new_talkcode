import { create } from 'zustand';
import { logger } from '@/lib/logger';

function buildScopeKey(taskId?: string | null, agentId?: string | null): string {
  return `${taskId || '__global__'}::${agentId || '__default__'}`;
}

interface ConversationSkillsState {
  addedSkillIdsByScope: Record<string, string[]>;
  removedSkillIdsByScope: Record<string, string[]>;
  getScopeKey: (taskId?: string | null, agentId?: string | null) => string;
  getSkillOverridesForScope: (taskId?: string | null, agentId?: string | null) => {
    addedSkillIds: string[];
    removedSkillIds: string[];
  };
  resolveSkillIds: (
    taskId: string | null | undefined,
    agentId: string | null | undefined,
    defaultSkillIds?: string[]
  ) => string[];
  toggleSkillForScope: (
    taskId: string | null | undefined,
    agentId: string | null | undefined,
    skillId: string,
    defaultSkillIds?: string[]
  ) => string[];
  clearScope: (taskId?: string | null, agentId?: string | null) => void;
}

export const useConversationSkillsStore = create<ConversationSkillsState>((set, get) => ({
  addedSkillIdsByScope: {},
  removedSkillIdsByScope: {},

  getScopeKey: (taskId, agentId) => buildScopeKey(taskId, agentId),

  getSkillOverridesForScope: (taskId, agentId) => {
    const key = buildScopeKey(taskId, agentId);
    return {
      addedSkillIds: get().addedSkillIdsByScope[key] || [],
      removedSkillIds: get().removedSkillIdsByScope[key] || [],
    };
  },

  resolveSkillIds: (taskId, agentId, defaultSkillIds = []) => {
    const key = buildScopeKey(taskId, agentId);
    const added = get().addedSkillIdsByScope[key] || [];
    const removed = new Set(get().removedSkillIdsByScope[key] || []);

    const resolved = [...defaultSkillIds.filter((id) => !removed.has(id)), ...added];
    return Array.from(new Set(resolved));
  },

  toggleSkillForScope: (taskId, agentId, skillId, defaultSkillIds = []) => {
    const key = buildScopeKey(taskId, agentId);
    const defaultSet = new Set(defaultSkillIds);
    const added = new Set(get().addedSkillIdsByScope[key] || []);
    const removed = new Set(get().removedSkillIdsByScope[key] || []);
    const currentResolved = new Set(get().resolveSkillIds(taskId, agentId, defaultSkillIds));
    const isActive = currentResolved.has(skillId);

    if (isActive) {
      if (defaultSet.has(skillId)) {
        removed.add(skillId);
      } else {
        added.delete(skillId);
      }
    } else {
      if (defaultSet.has(skillId)) {
        removed.delete(skillId);
      } else {
        added.add(skillId);
      }
    }

    const nextAdded = Array.from(added);
    const nextRemoved = Array.from(removed);

    set((state) => ({
      addedSkillIdsByScope: {
        ...state.addedSkillIdsByScope,
        [key]: nextAdded,
      },
      removedSkillIdsByScope: {
        ...state.removedSkillIdsByScope,
        [key]: nextRemoved,
      },
    }));

    const nextResolved = get().resolveSkillIds(taskId, agentId, defaultSkillIds);

    logger.info('[ConversationSkillsStore] Toggled skill override for scope', {
      taskId,
      agentId,
      skillId,
      count: nextResolved.length,
    });

    return nextResolved;
  },

  clearScope: (taskId, agentId) => {
    const key = buildScopeKey(taskId, agentId);
    set((state) => {
      const nextAdded = { ...state.addedSkillIdsByScope };
      const nextRemoved = { ...state.removedSkillIdsByScope };
      delete nextAdded[key];
      delete nextRemoved[key];
      return {
        addedSkillIdsByScope: nextAdded,
        removedSkillIdsByScope: nextRemoved,
      };
    });

    logger.info('[ConversationSkillsStore] Cleared scope', { taskId, agentId });
  },
}));
