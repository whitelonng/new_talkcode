import { create } from 'zustand';
import { logger } from '@/lib/logger';

interface ConversationAgentState {
  agentByTaskId: Record<string, string>;
  pendingAgentId: string | null;
  getAgentForTask: (taskId?: string | null, fallbackAgentId?: string) => string;
  setAgentForTask: (taskId: string | null | undefined, agentId: string) => void;
  applyPendingToTask: (taskId: string) => void;
  clearAgentForTask: (taskId: string) => void;
}

export const useConversationAgentStore = create<ConversationAgentState>((set, get) => ({
  agentByTaskId: {},
  pendingAgentId: null,

  getAgentForTask: (taskId, fallbackAgentId = 'planner') => {
    if (!taskId) {
      return get().pendingAgentId || fallbackAgentId;
    }
    return get().agentByTaskId[taskId] || fallbackAgentId;
  },

  setAgentForTask: (taskId, agentId) => {
    if (!taskId) {
      set({ pendingAgentId: agentId });
      logger.info('[ConversationAgentStore] Set pending agent (no task yet)', { agentId });
      return;
    }
    set((state) => ({
      agentByTaskId: {
        ...state.agentByTaskId,
        [taskId]: agentId,
      },
    }));
    logger.info('[ConversationAgentStore] Set agent for task', { taskId, agentId });
  },

  applyPendingToTask: (taskId) => {
    const pending = get().pendingAgentId;
    if (!pending) return;
    set((state) => ({
      agentByTaskId: {
        ...state.agentByTaskId,
        [taskId]: pending,
      },
      pendingAgentId: null,
    }));
    logger.info('[ConversationAgentStore] Applied pending agent to task', { taskId, agentId: pending });
  },

  clearAgentForTask: (taskId) => {
    set((state) => {
      if (!(taskId in state.agentByTaskId)) {
        return state;
      }
      const next = { ...state.agentByTaskId };
      delete next[taskId];
      return { agentByTaskId: next };
    });
    logger.info('[ConversationAgentStore] Cleared agent for task', { taskId });
  },
}));
