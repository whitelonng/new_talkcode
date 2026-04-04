/**
 * Tests for tool correctness evaluation
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateToolCorrectness,
  evaluateToolCorrectnessBatch,
  type ToolCall,
} from './tool-correctness';

describe('tool-correctness', () => {
  describe('evaluateToolCorrectness', () => {
    it('should return score 1.0 when all expected tools are called', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: { path: '/test.ts' } },
        { toolCallId: 'tc-2', toolName: 'grep', args: { pattern: 'TODO' } },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile', 'grep']);

      expect(result.score).toBe(1);
      expect(result.missingTools).toHaveLength(0);
      expect(result.extraTools).toHaveLength(0);
    });

    it('should return score 0.5 when half of expected tools are called', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile', 'grep']);

      expect(result.score).toBe(0.5);
      expect(result.missingTools).toEqual(['grep']);
    });

    it('should return score 0 when no expected tools are called', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'bash', args: {} },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile', 'grep']);

      expect(result.score).toBe(0);
      expect(result.missingTools).toEqual(['readFile', 'grep']);
      expect(result.extraTools).toEqual(['bash']);
    });

    it('should handle empty expected tools', () => {
      const actualToolCalls: ToolCall[] = [];

      const result = evaluateToolCorrectness(actualToolCalls, []);

      expect(result.score).toBe(1);
    });

    it('should penalize extra tools when exactMatch is true', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
        { toolCallId: 'tc-2', toolName: 'bash', args: {} }, // extra tool
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile'], {
        exactMatch: true,
      });

      expect(result.score).toBeLessThan(1);
      expect(result.extraTools).toEqual(['bash']);
    });

    it('should not penalize allowed extra tools', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
        { toolCallId: 'tc-2', toolName: 'bash', args: {} },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile'], {
        exactMatch: true,
        allowedExtraTools: ['bash'],
      });

      expect(result.score).toBe(1);
      expect(result.extraTools).toHaveLength(0);
    });

    it('should check ordering when considerOrdering is true', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'grep', args: {} },
        { toolCallId: 'tc-2', toolName: 'readFile', args: {} },
      ];

      // Wrong order: should be readFile then grep
      const result = evaluateToolCorrectness(actualToolCalls, ['readFile', 'grep'], {
        considerOrdering: true,
      });

      // Score should be reduced by 20% due to wrong order
      expect(result.score).toBe(0.8);
    });

    it('should not penalize ordering when tools are in correct order', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
        { toolCallId: 'tc-2', toolName: 'grep', args: {} },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile', 'grep'], {
        considerOrdering: true,
      });

      expect(result.score).toBe(1);
    });

    it('should generate detailed report', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile', 'grep']);

      expect(result.details).toContain('Score: 50%');
      expect(result.details).toContain('Expected: [readFile, grep]');
      expect(result.details).toContain('Actual: [readFile]');
      expect(result.details).toContain('Missing: [grep]');
    });

    it('should handle duplicate tool calls', () => {
      const actualToolCalls: ToolCall[] = [
        { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
        { toolCallId: 'tc-2', toolName: 'readFile', args: {} },
      ];

      const result = evaluateToolCorrectness(actualToolCalls, ['readFile']);

      // Duplicate calls should still count as correct
      expect(result.score).toBe(1);
    });
  });

  describe('evaluateToolCorrectnessBatch', () => {
    it('should evaluate multiple cases', () => {
      const cases = [
        {
          id: 'case-1',
          actualToolCalls: [{ toolCallId: 'tc-1', toolName: 'readFile', args: {} }],
          expectedTools: ['readFile'],
        },
        {
          id: 'case-2',
          actualToolCalls: [{ toolCallId: 'tc-1', toolName: 'grep', args: {} }],
          expectedTools: ['readFile'],
        },
      ];

      const result = evaluateToolCorrectnessBatch(cases);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].result.score).toBe(1);
      expect(result.results[1].result.score).toBe(0);
      expect(result.averageScore).toBe(0.5);
      expect(result.passRate).toBe(0.5); // Only case-1 passes (>=0.7)
    });

    it('should calculate pass rate based on threshold', () => {
      const cases = [
        {
          id: 'case-1',
          actualToolCalls: [
            { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
            { toolCallId: 'tc-2', toolName: 'grep', args: {} },
          ],
          expectedTools: ['readFile', 'grep', 'writeFile'],
        },
      ];

      const result = evaluateToolCorrectnessBatch(cases);

      // Score is 2/3 = 0.67, which is below 0.7 threshold
      expect(result.results[0].result.score).toBeCloseTo(0.67, 1);
      expect(result.passRate).toBe(0); // Below 0.7 threshold
    });
  });
});
