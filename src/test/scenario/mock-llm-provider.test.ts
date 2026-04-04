import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockLLMProvider,
  createMockLLMProvider,
  createMockAgentConfig,
  mockResponses,
} from './mock-llm-provider';

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;

  beforeEach(() => {
    provider = new MockLLMProvider();
  });

  describe('Basic Response', () => {
    it('should return default response', async () => {
      const response = await provider.getResponse([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.text).toBe('Mock response');
      expect(response.finishReason).toBe('stop');
    });

    it('should allow setting default response', async () => {
      provider.setDefaultResponse({
        text: 'Custom default',
        finishReason: 'stop',
      });

      const response = await provider.getResponse([
        { role: 'user', content: 'Test' },
      ]);

      expect(response.text).toBe('Custom default');
    });
  });

  describe('Response Queue', () => {
    it('should return queued responses in order', async () => {
      provider
        .queueResponse({ text: 'First' })
        .queueResponse({ text: 'Second' })
        .queueResponse({ text: 'Third' });

      const r1 = await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      const r2 = await provider.getResponse([{ role: 'user', content: 'Q2' }]);
      const r3 = await provider.getResponse([{ role: 'user', content: 'Q3' }]);

      expect(r1.text).toBe('First');
      expect(r2.text).toBe('Second');
      expect(r3.text).toBe('Third');
    });

    it('should fall back to default when queue empty', async () => {
      provider.queueResponse({ text: 'Queued' });

      await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      const r2 = await provider.getResponse([{ role: 'user', content: 'Q2' }]);

      expect(r2.text).toBe('Mock response'); // default
    });

    it('should queue multiple responses at once', async () => {
      provider.queueResponses(
        { text: 'A' },
        { text: 'B' },
        { text: 'C' }
      );

      const r1 = await provider.getResponse([{ role: 'user', content: '1' }]);
      const r2 = await provider.getResponse([{ role: 'user', content: '2' }]);

      expect(r1.text).toBe('A');
      expect(r2.text).toBe('B');
    });
  });

  describe('Response Rules', () => {
    it('should match by keyword', async () => {
      provider.whenContains('TODO', {
        text: 'Found TODOs',
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'grep', args: { pattern: 'TODO' } }],
      });

      const response = await provider.getResponse([
        { role: 'user', content: 'Search all TODO comments' },
      ]);

      expect(response.text).toBe('Found TODOs');
      expect(response.toolCalls).toHaveLength(1);
    });

    it('should be case insensitive for whenContains', async () => {
      provider.whenContains('error', { text: 'Error handling' });

      const response = await provider.getResponse([
        { role: 'user', content: 'Fix the ERROR please' },
      ]);

      expect(response.text).toBe('Error handling');
    });

    it('should match by regex', async () => {
      provider.whenMatches(/\d+\s*\+\s*\d+/, { text: 'Calculation' });

      const response = await provider.getResponse([
        { role: 'user', content: 'Calculate 10 + 20' },
      ]);

      expect(response.text).toBe('Calculation');
    });

    it('should use custom match function', async () => {
      provider.setResponseRule(
        (input) => input.length > 50,
        { text: 'Long input detected' }
      );

      const response = await provider.getResponse([
        { role: 'user', content: 'A'.repeat(60) },
      ]);

      expect(response.text).toBe('Long input detected');
    });

    it('should respect rule priority', async () => {
      provider.setResponseRule(
        () => true,
        { text: 'Low priority' },
        { priority: 1 }
      );

      provider.setResponseRule(
        () => true,
        { text: 'High priority' },
        { priority: 10 }
      );

      const response = await provider.getResponse([
        { role: 'user', content: 'Test' },
      ]);

      expect(response.text).toBe('High priority');
    });

    it('should support once option', async () => {
      provider.setResponseRule(
        () => true,
        { text: 'Once only' },
        { once: true }
      );

      const r1 = await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      const r2 = await provider.getResponse([{ role: 'user', content: 'Q2' }]);

      expect(r1.text).toBe('Once only');
      expect(r2.text).toBe('Mock response'); // default
    });

    it('should support function responses', async () => {
      provider.setResponseRule(
        () => true,
        (input) => ({ text: `Received: ${input.substring(0, 10)}` })
      );

      const response = await provider.getResponse([
        { role: 'user', content: 'Hello World' },
      ]);

      expect(response.text).toBe('Received: Hello Worl');
    });

    it('should prioritize queue over rules', async () => {
      provider.whenContains('test', { text: 'Rule matched' });
      provider.queueResponse({ text: 'Queue first' });

      const response = await provider.getResponse([
        { role: 'user', content: 'test message' },
      ]);

      expect(response.text).toBe('Queue first');
    });
  });

  describe('Call Records', () => {
    it('should record all calls', async () => {
      await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      await provider.getResponse([{ role: 'user', content: 'Q2' }]);

      const calls = provider.getCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0].inputText).toBe('Q1');
      expect(calls[1].inputText).toBe('Q2');
    });

    it('should record timestamp', async () => {
      const before = Date.now();
      await provider.getResponse([{ role: 'user', content: 'Test' }]);
      const after = Date.now();

      const call = provider.getLastCall();
      expect(call?.timestamp).toBeGreaterThanOrEqual(before);
      expect(call?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should return last call', async () => {
      await provider.getResponse([{ role: 'user', content: 'First' }]);
      await provider.getResponse([{ role: 'user', content: 'Last' }]);

      const lastCall = provider.getLastCall();
      expect(lastCall?.inputText).toBe('Last');
    });

    it('should return undefined for last call when empty', () => {
      expect(provider.getLastCall()).toBeUndefined();
    });

    it('should track call count', async () => {
      expect(provider.getCallCount()).toBe(0);

      await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      expect(provider.getCallCount()).toBe(1);

      await provider.getResponse([{ role: 'user', content: 'Q2' }]);
      expect(provider.getCallCount()).toBe(2);
    });

    it('should check wasCalled', async () => {
      expect(provider.wasCalled()).toBe(false);

      await provider.getResponse([{ role: 'user', content: 'Test' }]);

      expect(provider.wasCalled()).toBe(true);
    });

    it('should check wasCalledTimes', async () => {
      await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      await provider.getResponse([{ role: 'user', content: 'Q2' }]);

      expect(provider.wasCalledTimes(2)).toBe(true);
      expect(provider.wasCalledTimes(1)).toBe(false);
    });

    it('should extract input from nested messages', async () => {
      await provider.getResponse([
        { role: 'system', content: 'You are an assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'Final question' },
      ]);

      const call = provider.getLastCall();
      expect(call?.inputText).toBe('Final question'); // Last user message
    });

    it('should record tools', async () => {
      const tools = [{ name: 'grep' }, { name: 'readFile' }];
      await provider.getResponse(
        [{ role: 'user', content: 'Test' }],
        tools
      );

      const call = provider.getLastCall();
      expect(call?.tools).toEqual(tools);
    });
  });

  describe('State Management', () => {
    it('should reset calls and queue', async () => {
      provider.queueResponse({ text: 'Queued' });
      await provider.getResponse([{ role: 'user', content: 'Test' }]);

      provider.reset();

      expect(provider.getCalls()).toHaveLength(0);
      // Queue is also cleared
      const response = await provider.getResponse([{ role: 'user', content: 'Test' }]);
      expect(response.text).toBe('Mock response');
    });

    it('should reset once rules match count', async () => {
      provider.setResponseRule(
        () => true,
        { text: 'Once' },
        { once: true }
      );

      await provider.getResponse([{ role: 'user', content: 'Q1' }]);
      provider.reset();

      // Once rule should work again
      const response = await provider.getResponse([{ role: 'user', content: 'Q2' }]);
      expect(response.text).toBe('Once');
    });

    it('should clear everything', async () => {
      provider.whenContains('test', { text: 'Rule' });
      provider.queueResponse({ text: 'Queue' });
      await provider.getResponse([{ role: 'user', content: 'test' }]);

      provider.clear();

      expect(provider.getCalls()).toHaveLength(0);
      const response = await provider.getResponse([{ role: 'user', content: 'test' }]);
      expect(response.text).toBe('Mock response'); // Rules also cleared
    });
  });

  describe('Tool Call ID Generation', () => {
    it('should generate unique tool call IDs', () => {
      const id1 = provider.generateToolCallId();
      const id2 = provider.generateToolCallId();
      const id3 = provider.generateToolCallId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).toMatch(/^tc-mock-\d+$/);
    });
  });
});

describe('mockResponses', () => {
  describe('text', () => {
    it('should create text response', () => {
      const response = mockResponses.text('Hello');

      expect(response.text).toBe('Hello');
      expect(response.finishReason).toBe('stop');
      expect(response.usage).toBeDefined();
    });

    it('should accept custom usage', () => {
      const response = mockResponses.text('Hi', { promptTokens: 50, completionTokens: 10 });

      expect(response.usage).toEqual({ promptTokens: 50, completionTokens: 10 });
    });
  });

  describe('toolCall', () => {
    it('should create tool call response', () => {
      const response = mockResponses.toolCall('grep', { pattern: 'TODO' });

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].toolName).toBe('grep');
      expect(response.toolCalls![0].args).toEqual({ pattern: 'TODO' });
      expect(response.finishReason).toBe('tool-calls');
    });

    it('should accept custom tool call ID', () => {
      const response = mockResponses.toolCall('readFile', {}, 'custom-id');

      expect(response.toolCalls![0].toolCallId).toBe('custom-id');
    });
  });

  describe('multipleToolCalls', () => {
    it('should create multiple tool calls', () => {
      const response = mockResponses.multipleToolCalls([
        { toolName: 'grep', args: { pattern: 'TODO' } },
        { toolName: 'readFile', args: { path: '/test.ts' } },
      ]);

      expect(response.toolCalls).toHaveLength(2);
      expect(response.toolCalls![0].toolName).toBe('grep');
      expect(response.toolCalls![1].toolName).toBe('readFile');
    });
  });

  describe('textWithToolCall', () => {
    it('should create text with tool call', () => {
      const response = mockResponses.textWithToolCall(
        'Let me search for that',
        'grep',
        { pattern: 'error' }
      );

      expect(response.text).toBe('Let me search for that');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].toolName).toBe('grep');
    });
  });

  describe('empty', () => {
    it('should create empty response', () => {
      const response = mockResponses.empty();

      expect(response.text).toBe('');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('error', () => {
    it('should create error response', () => {
      const response = mockResponses.error('Something went wrong');

      expect(response.text).toBe('Something went wrong');
      expect(response.finishReason).toBe('error');
    });

    it('should use default error text', () => {
      const response = mockResponses.error();

      expect(response.text).toBe('An error occurred');
    });
  });

  describe('truncated', () => {
    it('should create truncated response', () => {
      const response = mockResponses.truncated('Partial content...');

      expect(response.text).toBe('Partial content...');
      expect(response.finishReason).toBe('length');
    });
  });
});

describe('createMockLLMProvider', () => {
  it('should create new provider instance', () => {
    const provider = createMockLLMProvider();

    expect(provider).toBeInstanceOf(MockLLMProvider);
    expect(provider.getCalls()).toHaveLength(0);
  });
});

describe('createMockAgentConfig', () => {
  it('should create agent config with provider', async () => {
    const provider = createMockLLMProvider();
    provider.queueResponse(mockResponses.text('Hello'));

    const config = createMockAgentConfig(provider);
    const result = await config.runAgent('Test input');

    expect(result.output).toBe('Hello');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('should execute tool calls with executor', async () => {
    const provider = createMockLLMProvider();
    provider.queueResponse(mockResponses.toolCall('grep', { pattern: 'TODO' }));

    const toolExecutor = async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'grep') {
        return { files: ['file1.ts', 'file2.ts'] };
      }
      return null;
    };

    const config = createMockAgentConfig(provider, toolExecutor);
    const result = await config.runAgent('Search TODO');

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolName).toBe('grep');
    expect(result.toolCalls[0].result).toEqual({ files: ['file1.ts', 'file2.ts'] });
  });

  it('should handle tool executor errors', async () => {
    const provider = createMockLLMProvider();
    provider.queueResponse(mockResponses.toolCall('badTool', {}));

    const toolExecutor = async () => {
      throw new Error('Tool failed');
    };

    const config = createMockAgentConfig(provider, toolExecutor);
    const result = await config.runAgent('Test');

    expect(result.toolCalls[0].result).toEqual({ error: 'Tool failed' });
  });

  it('should work without tool executor', async () => {
    const provider = createMockLLMProvider();
    provider.queueResponse(mockResponses.toolCall('grep', { pattern: 'test' }));

    const config = createMockAgentConfig(provider);
    const result = await config.runAgent('Search');

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result).toBeUndefined();
  });
});
