/**
 * Tests for mock helpers
 */

import { describe, expect, it, vi } from 'vitest';
import {
  mockId,
  mockValues,
  mockCycle,
  createTestMessages,
  createConversation,
  createMockTool,
  createMockTools,
  waitForState,
  waitFor,
  delay,
  withTimeout,
  createMockStreamTextResponse,
  assertCalledWithPartial,
  getLastCallArgs,
} from './mock-helpers';

describe('mock-helpers', () => {
  describe('mockId', () => {
    it('should generate sequential IDs with prefix', () => {
      const getId = mockId('tool-call');

      expect(getId()).toBe('tool-call-0');
      expect(getId()).toBe('tool-call-1');
      expect(getId()).toBe('tool-call-2');
    });

    it('should use default prefix when not provided', () => {
      const getId = mockId();

      expect(getId()).toBe('id-0');
      expect(getId()).toBe('id-1');
    });
  });

  describe('mockValues', () => {
    it('should return values in order', () => {
      const getValue = mockValues('first', 'second', 'third');

      expect(getValue()).toBe('first');
      expect(getValue()).toBe('second');
      expect(getValue()).toBe('third');
    });

    it('should throw when values are exhausted', () => {
      const getValue = mockValues('only');

      expect(getValue()).toBe('only');
      expect(() => getValue()).toThrow('mockValues exhausted');
    });
  });

  describe('mockCycle', () => {
    it('should cycle through values', () => {
      const getValue = mockCycle('a', 'b');

      expect(getValue()).toBe('a');
      expect(getValue()).toBe('b');
      expect(getValue()).toBe('a');
      expect(getValue()).toBe('b');
    });
  });

  describe('createTestMessages', () => {
    it('should create messages with IDs and timestamps', () => {
      const messages = createTestMessages([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        id: 'msg-0',
        role: 'user',
        content: 'Hello',
        timestamp: expect.any(Date),
      });
      expect(messages[1]).toEqual({
        id: 'msg-1',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('createConversation', () => {
    it('should create alternating user/assistant messages', () => {
      const messages = createConversation(4);

      expect(messages).toHaveLength(4);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
      expect(messages[3].role).toBe('assistant');
    });

    it('should create messages with sequential content', () => {
      const messages = createConversation(2);

      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Message 2');
    });
  });

  describe('createMockTool', () => {
    it('should create a mock tool with default execute', async () => {
      const tool = createMockTool('testTool');

      expect(tool.name).toBe('testTool');
      expect(tool.description).toBe('Mock tool: testTool');

      const result = await tool.execute({});
      expect(result).toEqual({ success: true });
    });

    it('should create a mock tool with custom execute', async () => {
      const tool = createMockTool('readFile', {
        execute: (input: { path: string }) => ({ content: `Content of ${input.path}` }),
      });

      const result = await tool.execute({ path: '/test.ts' });
      expect(result).toEqual({ content: 'Content of /test.ts' });
    });

    it('should track calls with vi.fn wrapper', async () => {
      const tool = createMockTool('testTool');

      await tool.execute({ arg: 1 });
      await tool.execute({ arg: 2 });

      expect(tool.execute).toHaveBeenCalledTimes(2);
      expect(tool.execute).toHaveBeenCalledWith({ arg: 1 });
      expect(tool.execute).toHaveBeenCalledWith({ arg: 2 });
    });
  });

  describe('createMockTools', () => {
    it('should create a set of common mock tools', async () => {
      const tools = createMockTools();

      expect(tools.readFile).toBeDefined();
      expect(tools.writeFile).toBeDefined();
      expect(tools.grep).toBeDefined();
      expect(tools.glob).toBeDefined();
      expect(tools.bash).toBeDefined();

      // Test readFile
      const readResult = await tools.readFile.execute({ path: '/test.ts' });
      expect(readResult).toEqual({ content: 'Content of /test.ts' });

      // Test bash
      const bashResult = await tools.bash.execute({ command: 'ls -la' });
      expect(bashResult).toEqual({
        stdout: 'Output of: ls -la',
        stderr: '',
        exitCode: 0,
      });
    });
  });

  describe('waitForState', () => {
    it('should resolve when predicate is true', async () => {
      let value = 0;

      // Simulate async state change
      setTimeout(() => {
        value = 42;
      }, 50);

      const result = await waitForState(
        () => value,
        (v) => v === 42,
        { timeout: 1000 }
      );

      expect(result).toBe(42);
    });

    it('should throw on timeout', async () => {
      await expect(
        waitForState(
          () => false,
          (v) => v === true,
          { timeout: 100 }
        )
      ).rejects.toThrow('waitForState timed out after 100ms');
    });
  });

  describe('waitFor', () => {
    it('should resolve when condition is true', async () => {
      let ready = false;

      setTimeout(() => {
        ready = true;
      }, 50);

      await waitFor(() => ready, { timeout: 1000 });

      expect(ready).toBe(true);
    });

    it('should support async conditions', async () => {
      let ready = false;

      setTimeout(() => {
        ready = true;
      }, 50);

      await waitFor(async () => ready, { timeout: 1000 });

      expect(ready).toBe(true);
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();

      await delay(100);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = delay(50).then(() => 'done');

      const result = await withTimeout(promise, 1000);

      expect(result).toBe('done');
    });

    it('should reject if promise times out', async () => {
      const promise = delay(1000).then(() => 'done');

      await expect(withTimeout(promise, 50, 'Custom timeout')).rejects.toThrow(
        'Custom timeout'
      );
    });
  });

  describe('createMockStreamTextResponse', () => {
    it('should create a mock streamText response', async () => {
      const response = createMockStreamTextResponse({
        text: 'Hello world',
        toolCalls: [],
      });

      expect(response.textStream).toBeDefined();
      expect(response.fullStream).toBeDefined();

      const text = await response.text;
      expect(text).toBe('Hello world');

      const finishReason = await response.finishReason;
      expect(finishReason).toBe('stop');
    });

    it('should set finishReason to tool-calls when toolCalls present', async () => {
      const response = createMockStreamTextResponse({
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'test', args: {} }],
      });

      const finishReason = await response.finishReason;
      expect(finishReason).toBe('tool-calls');
    });
  });

  describe('assertCalledWithPartial', () => {
    it('should pass when mock was called with partial args', () => {
      const mockFn = vi.fn();
      mockFn({ path: '/test', mode: 'read' });

      expect(() => assertCalledWithPartial(mockFn, { path: '/test' })).not.toThrow();
    });

    it('should fail when mock was not called with partial args', () => {
      const mockFn = vi.fn();
      mockFn({ path: '/other' });

      expect(() => assertCalledWithPartial(mockFn, { path: '/test' })).toThrow();
    });
  });

  describe('getLastCallArgs', () => {
    it('should return the last call arguments', () => {
      const mockFn = vi.fn();
      mockFn({ arg: 1 });
      mockFn({ arg: 2 });
      mockFn({ arg: 3 });

      const lastArgs = getLastCallArgs<{ arg: number }>(mockFn);
      expect(lastArgs).toEqual({ arg: 3 });
    });

    it('should return undefined if not called', () => {
      const mockFn = vi.fn();

      const lastArgs = getLastCallArgs(mockFn);
      expect(lastArgs).toBeUndefined();
    });
  });
});
