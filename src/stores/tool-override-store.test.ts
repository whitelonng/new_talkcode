import { beforeEach, describe, expect, it } from 'vitest';
import { useToolOverrideStore } from './tool-override-store';

describe('useToolOverrideStore', () => {
  beforeEach(() => {
    // Clear all overrides before each test
    useToolOverrideStore.getState().clearAll();
  });

  describe('addTool', () => {
    it('should add a tool to an agent', () => {
      const { addTool, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');

      const override = getOverride('agent-1');
      expect(override).toBeDefined();
      expect(override?.addedTools.has('tool-1')).toBe(true);
      expect(override?.removedTools.size).toBe(0);
    });

    it('should add multiple tools to an agent', () => {
      const { addTool, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      addTool('agent-1', 'tool-2');
      addTool('agent-1', 'tool-3');

      const override = getOverride('agent-1');
      expect(override?.addedTools.size).toBe(3);
      expect(override?.addedTools.has('tool-1')).toBe(true);
      expect(override?.addedTools.has('tool-2')).toBe(true);
      expect(override?.addedTools.has('tool-3')).toBe(true);
    });

    it('should handle adding tool that was previously removed', () => {
      const { addTool, removeTool, getOverride } = useToolOverrideStore.getState();

      // First remove the tool
      removeTool('agent-1', 'tool-1');
      let override = getOverride('agent-1');
      expect(override?.removedTools.has('tool-1')).toBe(true);

      // Then add it back (should cancel out the removal)
      addTool('agent-1', 'tool-1');
      override = getOverride('agent-1');
      expect(override?.removedTools.has('tool-1')).toBe(false);
      expect(override?.addedTools.has('tool-1')).toBe(false);
    });

    it('should handle multiple agents independently', () => {
      const { addTool, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      addTool('agent-2', 'tool-2');

      const override1 = getOverride('agent-1');
      const override2 = getOverride('agent-2');

      expect(override1?.addedTools.has('tool-1')).toBe(true);
      expect(override1?.addedTools.has('tool-2')).toBe(false);

      expect(override2?.addedTools.has('tool-2')).toBe(true);
      expect(override2?.addedTools.has('tool-1')).toBe(false);
    });
  });

  describe('removeTool', () => {
    it('should remove a tool from an agent', () => {
      const { removeTool, getOverride } = useToolOverrideStore.getState();

      removeTool('agent-1', 'tool-1');

      const override = getOverride('agent-1');
      expect(override).toBeDefined();
      expect(override?.removedTools.has('tool-1')).toBe(true);
      expect(override?.addedTools.size).toBe(0);
    });

    it('should remove multiple tools from an agent', () => {
      const { removeTool, getOverride } = useToolOverrideStore.getState();

      removeTool('agent-1', 'tool-1');
      removeTool('agent-1', 'tool-2');
      removeTool('agent-1', 'tool-3');

      const override = getOverride('agent-1');
      expect(override?.removedTools.size).toBe(3);
      expect(override?.removedTools.has('tool-1')).toBe(true);
      expect(override?.removedTools.has('tool-2')).toBe(true);
      expect(override?.removedTools.has('tool-3')).toBe(true);
    });

    it('should handle removing tool that was previously added', () => {
      const { addTool, removeTool, getOverride } = useToolOverrideStore.getState();

      // First add the tool
      addTool('agent-1', 'tool-1');
      let override = getOverride('agent-1');
      expect(override?.addedTools.has('tool-1')).toBe(true);

      // Then remove it (should cancel out the addition)
      removeTool('agent-1', 'tool-1');
      override = getOverride('agent-1');
      expect(override?.addedTools.has('tool-1')).toBe(false);
      expect(override?.removedTools.has('tool-1')).toBe(false);
    });
  });

  describe('clearOverride', () => {
    it('should clear all overrides for a specific agent', () => {
      const { addTool, removeTool, clearOverride, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      addTool('agent-1', 'tool-2');
      removeTool('agent-1', 'tool-3');

      let override = getOverride('agent-1');
      expect(override).toBeDefined();

      clearOverride('agent-1');

      override = getOverride('agent-1');
      expect(override).toBeUndefined();
    });

    it('should not affect other agents', () => {
      const { addTool, clearOverride, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      addTool('agent-2', 'tool-2');

      clearOverride('agent-1');

      expect(getOverride('agent-1')).toBeUndefined();
      expect(getOverride('agent-2')).toBeDefined();
      expect(getOverride('agent-2')?.addedTools.has('tool-2')).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all overrides for all agents', () => {
      const { addTool, removeTool, clearAll, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      addTool('agent-2', 'tool-2');
      removeTool('agent-3', 'tool-3');

      clearAll();

      expect(getOverride('agent-1')).toBeUndefined();
      expect(getOverride('agent-2')).toBeUndefined();
      expect(getOverride('agent-3')).toBeUndefined();
    });
  });

  describe('getOverride', () => {
    it('should return undefined for agent without overrides', () => {
      const { getOverride } = useToolOverrideStore.getState();
      expect(getOverride('non-existent-agent')).toBeUndefined();
    });

    it('should return override data for agent with overrides', () => {
      const { addTool, removeTool, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      removeTool('agent-1', 'tool-2');

      const override = getOverride('agent-1');
      expect(override).toBeDefined();
      expect(override?.addedTools.has('tool-1')).toBe(true);
      expect(override?.removedTools.has('tool-2')).toBe(true);
    });
  });

  describe('hasOverride', () => {
    it('should return false for agent without overrides', () => {
      const { hasOverride } = useToolOverrideStore.getState();
      expect(hasOverride('non-existent-agent')).toBe(false);
    });

    it('should return true for agent with added tools', () => {
      const { addTool, hasOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');

      expect(hasOverride('agent-1')).toBe(true);
    });

    it('should return true for agent with removed tools', () => {
      const { removeTool, hasOverride } = useToolOverrideStore.getState();

      removeTool('agent-1', 'tool-1');

      expect(hasOverride('agent-1')).toBe(true);
    });

    it('should return false after all overrides cancel out', () => {
      const { addTool, removeTool, hasOverride } = useToolOverrideStore.getState();

      // Add then remove the same tool - should cancel out
      addTool('agent-1', 'tool-1');
      removeTool('agent-1', 'tool-1');

      expect(hasOverride('agent-1')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle adding the same tool multiple times', () => {
      const { addTool, getOverride } = useToolOverrideStore.getState();

      addTool('agent-1', 'tool-1');
      addTool('agent-1', 'tool-1');
      addTool('agent-1', 'tool-1');

      const override = getOverride('agent-1');
      expect(override?.addedTools.size).toBe(1);
      expect(override?.addedTools.has('tool-1')).toBe(true);
    });

    it('should handle removing the same tool multiple times', () => {
      const { removeTool, getOverride } = useToolOverrideStore.getState();

      removeTool('agent-1', 'tool-1');
      removeTool('agent-1', 'tool-1');
      removeTool('agent-1', 'tool-1');

      const override = getOverride('agent-1');
      expect(override?.removedTools.size).toBe(1);
      expect(override?.removedTools.has('tool-1')).toBe(true);
    });

    it('should handle complex add/remove sequences', () => {
      const { addTool, removeTool, getOverride } = useToolOverrideStore.getState();

      // Complex sequence
      addTool('agent-1', 'tool-1'); // add tool-1
      addTool('agent-1', 'tool-2'); // add tool-2
      removeTool('agent-1', 'tool-1'); // remove tool-1 (cancels add)
      removeTool('agent-1', 'tool-3'); // remove tool-3
      addTool('agent-1', 'tool-3'); // add tool-3 (cancels remove)
      addTool('agent-1', 'tool-4'); // add tool-4

      const override = getOverride('agent-1');
      expect(override?.addedTools.size).toBe(2);
      expect(override?.addedTools.has('tool-2')).toBe(true);
      expect(override?.addedTools.has('tool-4')).toBe(true);
      expect(override?.removedTools.size).toBe(0);
    });
  });
});
