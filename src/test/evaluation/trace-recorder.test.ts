/**
 * Tests for trace recorder
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  AgentTraceRecorder,
  createTraceRecorder,
  extractToolCalls,
  extractToolResults,
  serializeTrace,
  deserializeTrace,
} from './trace-recorder';

describe('trace-recorder', () => {
  let recorder: AgentTraceRecorder;

  beforeEach(() => {
    recorder = new AgentTraceRecorder();
  });

  describe('AgentTraceRecorder', () => {
    it('should start and end a trace', () => {
      const traceId = recorder.startTrace('Test input');

      expect(traceId).toMatch(/^trace-\d+-\d+$/);
      expect(recorder.isTracing()).toBe(true);

      const trace = recorder.endTrace('Test output');

      expect(trace.id).toBe(traceId);
      expect(trace.input).toBe('Test input');
      expect(trace.output).toBe('Test output');
      expect(recorder.isTracing()).toBe(false);
    });

    it('should record text steps', () => {
      recorder.startTrace('input');
      recorder.recordText('Hello');
      recorder.recordText('World');
      const trace = recorder.endTrace('output');

      expect(trace.steps).toHaveLength(2);
      expect(trace.steps[0].type).toBe('text');
      expect(trace.steps[0].data).toEqual({ text: 'Hello' });
    });

    it('should record tool calls and results', () => {
      recorder.startTrace('input');
      recorder.recordToolCall('readFile', { path: '/test.ts' }, 'tc-1');
      recorder.recordToolResult('tc-1', { content: 'file content' });
      const trace = recorder.endTrace('output');

      expect(trace.steps).toHaveLength(2);
      expect(trace.steps[0].type).toBe('tool-call');
      expect(trace.steps[0].data).toEqual({
        toolName: 'readFile',
        args: { path: '/test.ts' },
        toolCallId: 'tc-1',
      });
      expect(trace.steps[1].type).toBe('tool-result');
    });

    it('should record reasoning', () => {
      recorder.startTrace('input');
      recorder.recordReasoning('I need to read the file first');
      const trace = recorder.endTrace('output');

      expect(trace.steps[0].type).toBe('reasoning');
      expect(trace.steps[0].data).toEqual({ text: 'I need to read the file first' });
    });

    it('should record status changes', () => {
      recorder.startTrace('input');
      recorder.recordStatus('processing', { progress: 50 });
      const trace = recorder.endTrace('output');

      expect(trace.steps[0].type).toBe('status');
      expect(trace.steps[0].data).toEqual({ status: 'processing', progress: 50 });
    });

    it('should record errors', () => {
      recorder.startTrace('input');
      recorder.recordError(new Error('Test error'));
      const trace = recorder.endTrace('output');

      expect(trace.steps[0].type).toBe('error');
      expect((trace.steps[0].data as { message: string }).message).toBe('Test error');
    });

    it('should record string errors', () => {
      recorder.startTrace('input');
      recorder.recordError('Simple error message');
      const trace = recorder.endTrace('output');

      expect((trace.steps[0].data as { message: string }).message).toBe('Simple error message');
    });

    it('should calculate metrics', () => {
      recorder.startTrace('input');
      recorder.recordToolCall('readFile', {}, 'tc-1');
      recorder.recordToolResult('tc-1', {});
      recorder.recordToolCall('grep', {}, 'tc-2');
      recorder.recordToolResult('tc-2', {});
      recorder.recordText('Found matches');
      const trace = recorder.endTrace('output', { prompt: 100, completion: 50 });

      expect(trace.metrics.totalSteps).toBe(5);
      expect(trace.metrics.toolCallCount).toBe(2);
      expect(trace.metrics.durationMs).toBeGreaterThanOrEqual(0);
      expect(trace.metrics.tokenUsage).toEqual({ prompt: 100, completion: 50 });
    });

    it('should throw when recording without active trace', () => {
      expect(() => recorder.recordText('text')).toThrow('No active trace');
    });

    it('should throw when ending without active trace', () => {
      expect(() => recorder.endTrace('output')).toThrow('No active trace');
    });

    it('should support metadata', () => {
      recorder.startTrace('input', { model: 'gpt-4', userId: '123' });
      const trace = recorder.endTrace('output');

      expect(trace.metadata).toEqual({ model: 'gpt-4', userId: '123' });
    });

    it('should cancel trace', () => {
      recorder.startTrace('input');
      recorder.recordText('text');
      recorder.cancelTrace();

      expect(recorder.isTracing()).toBe(false);
      expect(recorder.getCurrentTrace()).toBeNull();
    });

    it('should get current trace state', () => {
      recorder.startTrace('input');
      recorder.recordText('text');

      const current = recorder.getCurrentTrace();

      expect(current?.input).toBe('input');
      expect(current?.steps).toHaveLength(1);
    });

    it('should store completed traces', () => {
      recorder.startTrace('input1');
      recorder.endTrace('output1');

      recorder.startTrace('input2');
      recorder.endTrace('output2');

      const traces = recorder.getAllTraces();
      expect(traces).toHaveLength(2);
    });

    it('should get trace by ID', () => {
      const id = recorder.startTrace('input');
      recorder.endTrace('output');

      const trace = recorder.getTraceById(id);
      expect(trace?.input).toBe('input');

      const notFound = recorder.getTraceById('non-existent');
      expect(notFound).toBeUndefined();
    });

    it('should clear history', () => {
      recorder.startTrace('input');
      recorder.endTrace('output');

      recorder.clearHistory();

      expect(recorder.getAllTraces()).toHaveLength(0);
    });

    it('should calculate stats', () => {
      recorder.startTrace('input1');
      recorder.recordToolCall('tool1', {});
      recorder.recordToolCall('tool2', {});
      recorder.endTrace('output1');

      recorder.startTrace('input2');
      recorder.recordToolCall('tool1', {});
      recorder.endTrace('output2');

      const stats = recorder.getStats();

      expect(stats.totalTraces).toBe(2);
      expect(stats.averageToolCalls).toBe(1.5);
      expect(stats.averageSteps).toBe(1.5);
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should return zeros for empty stats', () => {
      const stats = recorder.getStats();

      expect(stats.totalTraces).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.averageToolCalls).toBe(0);
      expect(stats.averageSteps).toBe(0);
    });
  });

  describe('extractToolCalls', () => {
    it('should extract tool calls from trace', () => {
      recorder.startTrace('input');
      recorder.recordToolCall('readFile', { path: '/test.ts' }, 'tc-1');
      recorder.recordToolResult('tc-1', {});
      recorder.recordToolCall('grep', { pattern: 'TODO' }, 'tc-2');
      const trace = recorder.endTrace('output');

      const toolCalls = extractToolCalls(trace);

      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0]).toEqual({
        toolCallId: 'tc-1',
        toolName: 'readFile',
        args: { path: '/test.ts' },
      });
    });

    it('should generate toolCallId if not provided', () => {
      recorder.startTrace('input');
      recorder.recordToolCall('readFile', {});
      const trace = recorder.endTrace('output');

      const toolCalls = extractToolCalls(trace);

      expect(toolCalls[0].toolCallId).toMatch(/^tc-\d+$/);
    });
  });

  describe('extractToolResults', () => {
    it('should extract tool results from trace', () => {
      recorder.startTrace('input');
      recorder.recordToolCall('readFile', {}, 'tc-1');
      recorder.recordToolResult('tc-1', { content: 'data' }, false);
      recorder.recordToolResult('tc-2', { error: 'failed' }, true);
      const trace = recorder.endTrace('output');

      const results = extractToolResults(trace);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        toolCallId: 'tc-1',
        result: { content: 'data' },
        isError: false,
      });
      expect(results[1].isError).toBe(true);
    });
  });

  describe('serializeTrace / deserializeTrace', () => {
    it('should serialize and deserialize trace', () => {
      recorder.startTrace('input');
      recorder.recordToolCall('readFile', { path: '/test.ts' }, 'tc-1');
      const trace = recorder.endTrace('output');

      const json = serializeTrace(trace);
      const restored = deserializeTrace(json);

      expect(restored.id).toBe(trace.id);
      expect(restored.input).toBe(trace.input);
      expect(restored.output).toBe(trace.output);
      expect(restored.steps).toHaveLength(trace.steps.length);
    });
  });

  describe('createTraceRecorder', () => {
    it('should create a new recorder instance', () => {
      const newRecorder = createTraceRecorder();

      expect(newRecorder).toBeInstanceOf(AgentTraceRecorder);
      expect(newRecorder.isTracing()).toBe(false);
    });
  });
});
