/**
 * Tests for golden evaluator
 */

import { describe, expect, it, vi } from 'vitest';
import {
  runGoldenEvaluation,
  generateReportSummary,
  type GoldenCase,
  type EvaluationReport,
} from './golden-evaluator';
import type { AgentTrace } from './trace-recorder';

// Helper to create mock traces
function createMockTrace(overrides: Partial<AgentTrace> = {}): AgentTrace {
  return {
    id: 'trace-1',
    input: 'test input',
    output: 'test output',
    steps: [],
    startTime: Date.now(),
    endTime: Date.now() + 100,
    metrics: {
      totalSteps: 0,
      toolCallCount: 0,
      durationMs: 100,
    },
    ...overrides,
  };
}

describe('golden-evaluator', () => {
  describe('runGoldenEvaluation', () => {
    it('should evaluate a simple case with all tools called', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          output: 'Found TODO comments',
          steps: [
            { type: 'tool-call', timestamp: 1, data: { toolName: 'grep', args: { pattern: 'TODO' } } },
          ],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'Find TODO comments',
          expectedTools: ['grep'],
          expectedOutputContains: ['TODO'],
        },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.totalCases).toBe(1);
      expect(report.passedCases).toBe(1);
      expect(report.passRate).toBe(1);
      expect(report.results[0].passed).toBe(true);
    });

    it('should fail when expected tools are not called', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          steps: [
            { type: 'tool-call', timestamp: 1, data: { toolName: 'bash', args: {} } },
          ],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'Find TODO comments',
          expectedTools: ['grep'],
        },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.passedCases).toBe(0);
      expect(report.results[0].scores.toolCorrectness).toBe(0);
    });

    it('should evaluate output contains', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          output: 'Hello world, how are you?',
          steps: [],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'Say hello',
          expectedOutputContains: ['Hello', 'world'],
        },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.results[0].scores.outputMatch).toBe(1);
    });

    it('should evaluate output not contains', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          output: 'Hello world',
          steps: [],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'Say hello without error',
          expectedOutputNotContains: ['error', 'Error'],
        },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.results[0].scores.outputMatch).toBe(1);
    });

    it('should evaluate output regex match', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          output: 'Found 42 matches in 3 files',
          steps: [],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'Count matches',
          expectedOutputMatches: [/Found \d+ matches/],
        },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.results[0].scores.outputMatch).toBe(1);
    });

    it('should evaluate step efficiency', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          steps: [
            { type: 'tool-call', timestamp: 1, data: { toolName: 'readFile', args: {} } },
            { type: 'tool-call', timestamp: 2, data: { toolName: 'grep', args: {} } },
          ],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'Read and search',
          expectedMinSteps: 2,
        },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.results[0].scores.stepEfficiency).toBe(1);
    });

    it('should handle timeout', async () => {
      const runAgent = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'slow operation' },
      ];

      const report = await runGoldenEvaluation(runAgent, cases, { timeout: 50 });

      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].error).toContain('timed out');
    });

    it('should stop on failure when configured', async () => {
      const runAgent = vi.fn()
        .mockResolvedValueOnce(createMockTrace({ output: 'wrong' }))
        .mockResolvedValueOnce(createMockTrace({ output: 'correct' }));

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'first', expectedOutputContains: ['specific'] },
        { id: 'case-2', input: 'second', expectedOutputContains: ['correct'] },
      ];

      const report = await runGoldenEvaluation(runAgent, cases, { stopOnFailure: true });

      // Should stop after first failure
      expect(runAgent).toHaveBeenCalledTimes(1);
      expect(report.results).toHaveLength(1);
    });

    it('should filter by tags', async () => {
      const runAgent = vi.fn().mockResolvedValue(createMockTrace());

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'first', tags: ['search'] },
        { id: 'case-2', input: 'second', tags: ['edit'] },
        { id: 'case-3', input: 'third', tags: ['search', 'edit'] },
      ];

      const report = await runGoldenEvaluation(runAgent, cases, {
        filterTags: ['search'],
      });

      expect(report.totalCases).toBe(2); // case-1 and case-3
    });

    it('should skip tags', async () => {
      const runAgent = vi.fn().mockResolvedValue(createMockTrace());

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'first', tags: ['search'] },
        { id: 'case-2', input: 'second', tags: ['slow'] },
      ];

      const report = await runGoldenEvaluation(runAgent, cases, {
        skipTags: ['slow'],
      });

      expect(report.totalCases).toBe(1);
    });

    it('should skip cases marked as skip', async () => {
      const runAgent = vi.fn().mockResolvedValue(createMockTrace());

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'first', skip: true },
        { id: 'case-2', input: 'second' },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(runAgent).toHaveBeenCalledTimes(1);
    });

    it('should call progress callback', async () => {
      const runAgent = vi.fn().mockResolvedValue(createMockTrace());
      const onProgress = vi.fn();

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'first' },
        { id: 'case-2', input: 'second' },
      ];

      await runGoldenEvaluation(runAgent, cases, { onProgress });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(1, 2, expect.any(Object));
      expect(onProgress).toHaveBeenCalledWith(2, 2, expect.any(Object));
    });

    it('should include trace when configured', async () => {
      const runAgent = vi.fn().mockResolvedValue(createMockTrace());

      const cases: GoldenCase[] = [{ id: 'case-1', input: 'test' }];

      const report = await runGoldenEvaluation(runAgent, cases, { includeTrace: true });

      expect(report.results[0].trace).toBeDefined();
    });

    it('should calculate tag stats', async () => {
      const runAgent = vi.fn()
        .mockResolvedValueOnce(createMockTrace({ output: 'pass' }))
        .mockResolvedValueOnce(createMockTrace({ output: 'fail' }));

      const cases: GoldenCase[] = [
        { id: 'case-1', input: 'first', tags: ['search'], expectedOutputContains: ['pass'] },
        { id: 'case-2', input: 'second', tags: ['search'], expectedOutputContains: ['pass'] },
      ];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.byTag?.search).toEqual({
        passed: 1,
        total: 2,
        passRate: 0.5,
      });
    });

    it('should handle agent errors', async () => {
      const runAgent = vi.fn().mockRejectedValue(new Error('Agent crashed'));

      const cases: GoldenCase[] = [{ id: 'case-1', input: 'test' }];

      const report = await runGoldenEvaluation(runAgent, cases);

      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].error).toBe('Agent crashed');
    });

    it('should use custom pass threshold', async () => {
      const runAgent = vi.fn().mockResolvedValue(
        createMockTrace({
          steps: [
            { type: 'tool-call', timestamp: 1, data: { toolName: 'readFile', args: {} } },
          ],
        })
      );

      const cases: GoldenCase[] = [
        {
          id: 'case-1',
          input: 'test',
          expectedTools: ['readFile', 'grep'], // Only 50% match
        },
      ];

      const strictReport = await runGoldenEvaluation(runAgent, cases, { passThreshold: 0.7 });
      const lenientReport = await runGoldenEvaluation(runAgent, cases, { passThreshold: 0.4 });

      expect(strictReport.results[0].passed).toBe(false);
      expect(lenientReport.results[0].passed).toBe(true);
    });
  });

  describe('generateReportSummary', () => {
    it('should generate a readable summary', () => {
      const report: EvaluationReport = {
        totalCases: 10,
        passedCases: 8,
        passRate: 0.8,
        averageScores: {
          toolCorrectness: 0.9,
          stepEfficiency: 0.85,
          outputMatch: 0.95,
          overall: 0.9,
        },
        results: [
          {
            caseId: 'case-1',
            input: 'test',
            passed: false,
            scores: {},
            details: [],
            error: 'Timeout',
          },
        ],
        byTag: {
          search: { passed: 4, total: 5, passRate: 0.8 },
        },
        timestamp: new Date().toISOString(),
        totalDuration: 5000,
      };

      const summary = generateReportSummary(report);

      expect(summary).toContain('Golden Dataset Evaluation Report');
      expect(summary).toContain('Total Cases: 10');
      expect(summary).toContain('Passed: 8');
      expect(summary).toContain('Pass Rate: 80.0%');
      expect(summary).toContain('Tool Correctness: 90.0%');
      expect(summary).toContain('search: 4/5 (80.0%)');
      expect(summary).toContain('Failed Cases');
      expect(summary).toContain('case-1');
    });
  });
});
