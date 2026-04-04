/**
 * Tests for LLM test helpers
 */

import { describe, expect, it } from 'vitest';
import {
  createStreamTextMock,
  createCompressionSummaryResponse,
  streamScenarios,
} from './llm-test-helpers';

describe('llm-test-helpers', () => {
  describe('createStreamTextMock', () => {
    it('should create a stream with text chunks', async () => {
      const mock = createStreamTextMock({
        textChunks: ['Hello', ' world'],
      });

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'text-start' });
      expect(chunks).toContainEqual({ type: 'text-delta', text: 'Hello' });
      expect(chunks).toContainEqual({ type: 'text-delta', text: ' world' });
      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'stop' })
      );
    });

    it('should create a stream with tool calls', async () => {
      const mock = createStreamTextMock({
        textChunks: ['Processing...'],
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'readFile', input: { path: '/test.ts' } },
        ],
      });

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({
          type: 'tool-call',
          toolName: 'readFile',
          input: { path: '/test.ts' },
        })
      );
      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'tool-calls' })
      );
    });

    it('should auto-set finishReason to tool-calls when toolCalls are present', async () => {
      const mock = createStreamTextMock({
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'test', input: {} }],
      });

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'tool-calls' })
      );
    });

    it('should default finishReason to stop when no toolCalls', async () => {
      const mock = createStreamTextMock({
        textChunks: ['Hello'],
      });

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'stop' })
      );
    });
  });

  describe('streamScenarios', () => {
    it('simpleText should create a simple text response', async () => {
      const mock = streamScenarios.simpleText('Hello!');

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'text-delta', text: 'Hello!' });
    });

    it('withToolCall should create a response with tool call', async () => {
      const mock = streamScenarios.withToolCall('readFile', { path: '/test.ts' });

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({
          type: 'tool-call',
          toolName: 'readFile',
        })
      );
    });

    it('multipleToolCalls should create multiple tool calls', async () => {
      const mock = streamScenarios.multipleToolCalls([
        { name: 'readFile', input: { path: '/a.ts' } },
        { name: 'readFile', input: { path: '/b.ts' } },
      ]);

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      const toolCalls = chunks.filter(
        (c: unknown) =>
          typeof c === 'object' &&
          c !== null &&
          (c as { type: string }).type === 'tool-call'
      );
      expect(toolCalls).toHaveLength(2);
    });

    it('emptyToolCallsBug should reproduce the empty tool-calls bug', async () => {
      const mock = streamScenarios.emptyToolCallsBug();

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      // Should have text but finishReason is tool-calls (the bug)
      expect(chunks).toContainEqual({ type: 'text-delta', text: 'Task completed.' });
      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'tool-calls' })
      );

      // Should NOT have any tool-call events
      const toolCalls = chunks.filter(
        (c: unknown) =>
          typeof c === 'object' &&
          c !== null &&
          (c as { type: string }).type === 'tool-call'
      );
      expect(toolCalls).toHaveLength(0);
    });

    it('streamError should produce an error event', async () => {
      const mock = streamScenarios.streamError();

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('emptyResponse should create an empty response', async () => {
      const mock = streamScenarios.emptyResponse();

      const chunks: unknown[] = [];
      for await (const chunk of mock.events) {
        chunks.push(chunk);
      }

      const textDeltas = chunks.filter(
        (c: unknown) =>
          typeof c === 'object' &&
          c !== null &&
          (c as { type: string }).type === 'text-delta' &&
          (c as { text?: string }).text
      );
      expect(textDeltas).toHaveLength(0);
    });
  });

  describe('createCompressionSummaryResponse', () => {
    it('should create a compression summary response with default summary', async () => {
      const response = createCompressionSummaryResponse();

      const chunks: unknown[] = [];
      for await (const chunk of response.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'stop' })
      );
    });

    it('should create a compression summary response with custom summary', async () => {
      const customSummary = 'Custom compression summary for testing';
      const response = createCompressionSummaryResponse(customSummary);

      const chunks: unknown[] = [];
      for await (const chunk of response.events) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'done', finish_reason: 'stop' })
      );
    });
  });
});
