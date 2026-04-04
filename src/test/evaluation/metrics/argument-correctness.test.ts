/**
 * Tests for argument correctness evaluation
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateArgumentCorrectness,
  evaluateMultipleArgumentCorrectness,
  argMatchers,
} from './argument-correctness';

describe('argument-correctness', () => {
  describe('evaluateArgumentCorrectness', () => {
    it('should return score 1.0 when all args match', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { path: '/test.ts', encoding: 'utf-8' },
      };

      const result = evaluateArgumentCorrectness(toolCall, { path: '/test.ts' });

      expect(result.score).toBe(1);
      expect(result.matchedKeys).toEqual(['path']);
      expect(result.missingKeys).toHaveLength(0);
      expect(result.incorrectKeys).toHaveLength(0);
    });

    it('should return score 0 when expected arg is missing', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { encoding: 'utf-8' },
      };

      const result = evaluateArgumentCorrectness(toolCall, { path: '/test.ts' });

      expect(result.score).toBe(0);
      expect(result.missingKeys).toEqual(['path']);
    });

    it('should return partial score when some args are incorrect', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { path: '/wrong.ts', mode: 'read' },
      };

      const result = evaluateArgumentCorrectness(toolCall, {
        path: '/test.ts',
        mode: 'read',
      });

      expect(result.score).toBe(0.5);
      expect(result.matchedKeys).toEqual(['mode']);
      expect(result.incorrectKeys).toEqual(['path']);
    });

    it('should handle deep object comparison', () => {
      const toolCall = {
        toolName: 'search',
        args: {
          options: { caseSensitive: true, recursive: false },
        },
      };

      const result = evaluateArgumentCorrectness(toolCall, {
        options: { caseSensitive: true, recursive: false },
      });

      expect(result.score).toBe(1);
    });

    it('should handle array comparison', () => {
      const toolCall = {
        toolName: 'glob',
        args: { patterns: ['*.ts', '*.tsx'] },
      };

      const result = evaluateArgumentCorrectness(toolCall, {
        patterns: ['*.ts', '*.tsx'],
      });

      expect(result.score).toBe(1);
    });

    it('should fail on array order mismatch in deep compare', () => {
      const toolCall = {
        toolName: 'glob',
        args: { patterns: ['*.tsx', '*.ts'] },
      };

      const result = evaluateArgumentCorrectness(toolCall, {
        patterns: ['*.ts', '*.tsx'],
      });

      expect(result.score).toBe(0);
      expect(result.incorrectKeys).toEqual(['patterns']);
    });

    it('should ignore specified keys', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { path: '/test.ts', timestamp: Date.now() },
      };

      const result = evaluateArgumentCorrectness(
        toolCall,
        { path: '/test.ts', timestamp: 12345 },
        { ignoreKeys: ['timestamp'] }
      );

      expect(result.score).toBe(1);
    });

    it('should accept value aliases', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { path: './test.ts' },
      };

      const result = evaluateArgumentCorrectness(
        toolCall,
        { path: '/test.ts' },
        { valueAliases: { path: ['./test.ts', 'test.ts'] } }
      );

      expect(result.score).toBe(1);
    });

    it('should use custom comparator when provided', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { path: '/Users/test/project/file.ts' },
      };

      const result = evaluateArgumentCorrectness(
        toolCall,
        { path: 'file.ts' },
        {
          customComparator: (key, actual, expected) => {
            if (key === 'path' && typeof actual === 'string' && typeof expected === 'string') {
              return actual.endsWith(expected);
            }
            return actual === expected;
          },
        }
      );

      expect(result.score).toBe(1);
    });

    it('should generate detailed report with incorrect values', () => {
      const toolCall = {
        toolName: 'readFile',
        args: { path: '/wrong.ts' },
      };

      const result = evaluateArgumentCorrectness(toolCall, { path: '/test.ts' });

      expect(result.details).toContain('Tool: readFile');
      expect(result.details).toContain('Score: 0%');
      expect(result.details).toContain('Incorrect: [path]');
      expect(result.details).toContain('expected "/test.ts"');
      expect(result.details).toContain('got "/wrong.ts"');
    });

    it('should return score 1.0 for empty expected args', () => {
      const toolCall = {
        toolName: 'list',
        args: { verbose: true },
      };

      const result = evaluateArgumentCorrectness(toolCall, {});

      expect(result.score).toBe(1);
    });
  });

  describe('evaluateMultipleArgumentCorrectness', () => {
    it('should evaluate multiple tool calls', () => {
      const toolCalls = [
        { toolName: 'readFile', args: { path: '/test.ts' } },
        { toolName: 'grep', args: { pattern: 'TODO', path: '/src' } },
      ];

      const expectedArgsMap = {
        readFile: { path: '/test.ts' },
        grep: { pattern: 'TODO' },
      };

      const result = evaluateMultipleArgumentCorrectness(toolCalls, expectedArgsMap);

      expect(result.results).toHaveLength(2);
      expect(result.averageScore).toBe(1);
      expect(result.allMatched).toBe(true);
    });

    it('should handle partial matches', () => {
      const toolCalls = [
        { toolName: 'readFile', args: { path: '/wrong.ts' } },
        { toolName: 'grep', args: { pattern: 'TODO' } },
      ];

      const expectedArgsMap = {
        readFile: { path: '/test.ts' },
        grep: { pattern: 'TODO' },
      };

      const result = evaluateMultipleArgumentCorrectness(toolCalls, expectedArgsMap);

      expect(result.averageScore).toBe(0.5);
      expect(result.allMatched).toBe(false);
    });

    it('should skip tools not in expected map', () => {
      const toolCalls = [
        { toolName: 'readFile', args: { path: '/test.ts' } },
        { toolName: 'unknownTool', args: {} },
      ];

      const expectedArgsMap = {
        readFile: { path: '/test.ts' },
      };

      const result = evaluateMultipleArgumentCorrectness(toolCalls, expectedArgsMap);

      expect(result.results).toHaveLength(1);
    });
  });

  describe('argMatchers', () => {
    it('pathEquals should ignore leading slashes', () => {
      expect(argMatchers.pathEquals('/test.ts', 'test.ts')).toBe(true);
      expect(argMatchers.pathEquals('test.ts', '/test.ts')).toBe(true);
      expect(argMatchers.pathEquals('///test.ts', 'test.ts')).toBe(true);
    });

    it('contains should check substring', () => {
      expect(argMatchers.contains('hello world', 'world')).toBe(true);
      expect(argMatchers.contains('hello', 'world')).toBe(false);
    });

    it('matchesPattern should test regex', () => {
      const matcher = argMatchers.matchesPattern(/\.tsx?$/);
      expect(matcher('file.ts')).toBe(true);
      expect(matcher('file.tsx')).toBe(true);
      expect(matcher('file.js')).toBe(false);
    });

    it('arrayContainsAll should check all elements', () => {
      expect(argMatchers.arrayContainsAll(['a', 'b', 'c'], ['a', 'b'])).toBe(true);
      expect(argMatchers.arrayContainsAll(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    });
  });
});
