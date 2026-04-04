/**
 * Tests for step efficiency evaluation
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateStepEfficiency,
  analyzeStepSequence,
  createRedundantPattern,
  defaultRedundantPatterns,
  type TraceStep,
} from './step-efficiency';

describe('step-efficiency', () => {
  describe('evaluateStepEfficiency', () => {
    it('should return score 1.0 when actual steps equal expected', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile' },
        { type: 'tool-call', toolName: 'grep' },
      ];

      const result = evaluateStepEfficiency(steps, { expectedMinSteps: 2 });

      expect(result.score).toBe(1);
      expect(result.actualSteps).toBe(2);
    });

    it('should return score < 1 when actual steps exceed expected', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile' },
        { type: 'tool-call', toolName: 'grep' },
        { type: 'tool-call', toolName: 'writeFile' },
        { type: 'tool-call', toolName: 'bash' },
      ];

      const result = evaluateStepEfficiency(steps, { expectedMinSteps: 2 });

      expect(result.score).toBe(0.5); // 2/4
      expect(result.actualSteps).toBe(4);
    });

    it('should detect duplicate-read pattern', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile', args: { path: '/test.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/test.ts' } },
      ];

      const result = evaluateStepEfficiency(steps);

      expect(result.redundantPatterns).toContain('duplicate-read');
      expect(result.score).toBeLessThan(1);
    });

    it('should detect unnecessary-glob-before-grep pattern', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'glob', args: { pattern: '*.ts' } },
        { type: 'tool-call', toolName: 'grep', args: { pattern: 'TODO' } },
      ];

      const result = evaluateStepEfficiency(steps);

      expect(result.redundantPatterns).toContain('unnecessary-glob-before-grep');
    });

    it('should detect repeated-tool-call pattern', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile', args: { path: '/a.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/b.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/c.ts' } },
      ];

      const result = evaluateStepEfficiency(steps);

      expect(result.redundantPatterns).toContain('repeated-tool-call');
    });

    it('should detect write-then-read-same-file pattern', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'writeFile', args: { path: '/test.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/test.ts' } },
      ];

      const result = evaluateStepEfficiency(steps);

      expect(result.redundantPatterns).toContain('write-then-read-same-file');
    });

    it('should detect excessive-tool-calls pattern', () => {
      const steps: TraceStep[] = Array(12)
        .fill(null)
        .map((_, i) => ({
          type: 'tool-call',
          toolName: `tool${i}`,
        }));

      const result = evaluateStepEfficiency(steps);

      expect(result.redundantPatterns).toContain('excessive-tool-calls');
    });

    it('should not detect patterns when not present', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile', args: { path: '/a.ts' } },
        { type: 'tool-call', toolName: 'writeFile', args: { path: '/b.ts' } },
      ];

      const result = evaluateStepEfficiency(steps);

      expect(result.redundantPatterns).toHaveLength(0);
      expect(result.score).toBe(1);
    });

    it('should allow disabling default patterns', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile', args: { path: '/test.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/test.ts' } },
      ];

      const result = evaluateStepEfficiency(steps, { useDefaultPatterns: false });

      expect(result.redundantPatterns).toHaveLength(0);
      expect(result.score).toBe(1);
    });

    it('should support custom redundant patterns', () => {
      const customPattern = createRedundantPattern(
        'custom-pattern',
        (steps) => steps.some((s) => s.toolName === 'dangerousTool'),
        { severity: 'high' }
      );

      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'dangerousTool' },
      ];

      const result = evaluateStepEfficiency(steps, {
        useDefaultPatterns: false,
        redundantPatterns: [customPattern],
      });

      expect(result.redundantPatterns).toContain('custom-pattern');
    });

    it('should apply severity multipliers to penalties', () => {
      // High severity pattern
      const highSteps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile', args: { path: '/a.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/b.ts' } },
        { type: 'tool-call', toolName: 'readFile', args: { path: '/c.ts' } },
      ];

      // Low severity pattern
      const lowSteps: TraceStep[] = [
        { type: 'tool-call', toolName: 'glob', args: {} },
        { type: 'tool-call', toolName: 'grep', args: {} },
      ];

      const highResult = evaluateStepEfficiency(highSteps);
      const lowResult = evaluateStepEfficiency(lowSteps);

      // High severity should have lower score
      expect(highResult.score).toBeLessThan(lowResult.score);
    });

    it('should only count tool-call steps', () => {
      const steps: TraceStep[] = [
        { type: 'text', data: 'some text' },
        { type: 'tool-call', toolName: 'readFile' },
        { type: 'tool-result', data: {} },
        { type: 'tool-call', toolName: 'grep' },
      ];

      const result = evaluateStepEfficiency(steps, { expectedMinSteps: 2 });

      expect(result.actualSteps).toBe(2);
      expect(result.score).toBe(1);
    });
  });

  describe('analyzeStepSequence', () => {
    it('should analyze step sequence', () => {
      const steps: TraceStep[] = [
        { type: 'tool-call', toolName: 'readFile' },
        { type: 'tool-call', toolName: 'grep' },
        { type: 'tool-call', toolName: 'readFile' },
        { type: 'text', data: 'response' },
      ];

      const analysis = analyzeStepSequence(steps);

      expect(analysis.totalSteps).toBe(4);
      expect(analysis.toolCallCount).toBe(3);
      expect(analysis.uniqueTools).toEqual(['readFile', 'grep']);
      expect(analysis.toolCallFrequency).toEqual({
        readFile: 2,
        grep: 1,
      });
    });

    it('should handle empty steps', () => {
      const analysis = analyzeStepSequence([]);

      expect(analysis.totalSteps).toBe(0);
      expect(analysis.toolCallCount).toBe(0);
      expect(analysis.uniqueTools).toHaveLength(0);
    });
  });

  describe('createRedundantPattern', () => {
    it('should create a custom pattern', () => {
      const pattern = createRedundantPattern(
        'test-pattern',
        () => true,
        { description: 'Test description', severity: 'low' }
      );

      expect(pattern.name).toBe('test-pattern');
      expect(pattern.description).toBe('Test description');
      expect(pattern.severity).toBe('low');
      expect(pattern.detect([])).toBe(true);
    });

    it('should use defaults when options not provided', () => {
      const pattern = createRedundantPattern('test', () => false);

      expect(pattern.description).toBe('test');
      expect(pattern.severity).toBe('medium');
    });
  });

  describe('defaultRedundantPatterns', () => {
    it('should have expected patterns', () => {
      const patternNames = defaultRedundantPatterns.map((p) => p.name);

      expect(patternNames).toContain('duplicate-read');
      expect(patternNames).toContain('unnecessary-glob-before-grep');
      expect(patternNames).toContain('repeated-tool-call');
      expect(patternNames).toContain('write-then-read-same-file');
      expect(patternNames).toContain('excessive-tool-calls');
    });
  });
});
