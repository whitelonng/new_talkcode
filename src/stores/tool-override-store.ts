import { create } from 'zustand';
import { logger } from '@/lib/logger';

/**
 * Tool override data for a single agent
 */
export interface ToolOverride {
  addedTools: Set<string>; // Tools added to agent temporarily
  removedTools: Set<string>; // Tools removed from agent temporarily
}

interface ToolOverrideState {
  overrides: Map<string, ToolOverride>; // agentId -> override data
}

interface ToolOverrideStore extends ToolOverrideState {
  // Add a tool to an agent (temporary override)
  addTool: (agentId: string, toolId: string) => void;

  // Remove a tool from an agent (temporary override)
  removeTool: (agentId: string, toolId: string) => void;

  // Clear all overrides for a specific agent
  clearOverride: (agentId: string) => void;

  // Clear all overrides for all agents
  clearAll: () => void;

  // Get override data for a specific agent
  getOverride: (agentId: string) => ToolOverride | undefined;

  // Check if an agent has any overrides
  hasOverride: (agentId: string) => boolean;
}

/**
 * Global store for temporary tool overrides
 *
 * This store allows users to temporarily add/remove tools from any agent
 * (including system agents) without modifying the agent definition.
 *
 * All overrides are in-memory only and will be cleared on app restart.
 */
export const useToolOverrideStore = create<ToolOverrideStore>((set, get) => ({
  // Initial state
  overrides: new Map(),

  /**
   * Add a tool to an agent temporarily
   */
  addTool: (agentId: string, toolId: string) => {
    set((state) => {
      const newOverrides = new Map(state.overrides);
      const override = newOverrides.get(agentId) || {
        addedTools: new Set<string>(),
        removedTools: new Set<string>(),
      };

      // If tool was previously removed, just un-remove it
      if (override.removedTools.has(toolId)) {
        override.removedTools.delete(toolId);
      } else {
        // Otherwise, mark it as added
        override.addedTools.add(toolId);
      }

      newOverrides.set(agentId, override);
      logger.info(`Added tool ${toolId} to agent ${agentId} (temporary)`);

      return { overrides: newOverrides };
    });
  },

  /**
   * Remove a tool from an agent temporarily
   */
  removeTool: (agentId: string, toolId: string) => {
    set((state) => {
      const newOverrides = new Map(state.overrides);
      const override = newOverrides.get(agentId) || {
        addedTools: new Set<string>(),
        removedTools: new Set<string>(),
      };

      // If tool was previously added, just un-add it
      if (override.addedTools.has(toolId)) {
        override.addedTools.delete(toolId);
      } else {
        // Otherwise, mark it as removed
        override.removedTools.add(toolId);
      }

      newOverrides.set(agentId, override);
      logger.info(`Removed tool ${toolId} from agent ${agentId} (temporary)`);

      return { overrides: newOverrides };
    });
  },

  /**
   * Clear all overrides for a specific agent
   */
  clearOverride: (agentId: string) => {
    set((state) => {
      const newOverrides = new Map(state.overrides);
      newOverrides.delete(agentId);
      logger.info(`Cleared tool overrides for agent ${agentId}`);

      return { overrides: newOverrides };
    });
  },

  /**
   * Clear all overrides for all agents
   */
  clearAll: () => {
    set({ overrides: new Map() });
    logger.info('Cleared all tool overrides');
  },

  /**
   * Get override data for a specific agent
   */
  getOverride: (agentId: string) => {
    return get().overrides.get(agentId);
  },

  /**
   * Check if an agent has any overrides
   */
  hasOverride: (agentId: string) => {
    const override = get().overrides.get(agentId);
    if (!override) return false;
    return override.addedTools.size > 0 || override.removedTools.size > 0;
  },
}));
