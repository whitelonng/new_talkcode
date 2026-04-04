// src/stores/nested-tools-store.ts
/**
 * COMPATIBILITY SHIM - Nested tools store
 * This file maintains backward compatibility with existing code.
 * New code should use nestedMessages in ToolMessage directly.
 */

import { create } from 'zustand';
import type { UIMessage } from '@/types/agent';

interface NestedToolsState {
  // Map of parentToolCallId -> nested messages
  messagesByParent: Record<string, UIMessage[]>;

  // Actions
  addMessage: (parentToolCallId: string, message: UIMessage) => void;
  clearMessages: (parentToolCallId: string) => void;
  clearAll: () => void;
  getMessages: (parentToolCallId: string) => UIMessage[];
}

export const useNestedToolsStore = create<NestedToolsState>()((set, get) => ({
  messagesByParent: {},

  addMessage: (parentToolCallId, message) => {
    set((state) => ({
      messagesByParent: {
        ...state.messagesByParent,
        [parentToolCallId]: [...(state.messagesByParent[parentToolCallId] || []), message],
      },
    }));
  },

  clearMessages: (parentToolCallId) => {
    set((state) => {
      const { [parentToolCallId]: _, ...rest } = state.messagesByParent;
      return { messagesByParent: rest };
    });
  },

  clearAll: () => {
    set({ messagesByParent: {} });
  },

  getMessages: (parentToolCallId) => {
    return get().messagesByParent[parentToolCallId] || [];
  },
}));
