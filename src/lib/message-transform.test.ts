import { describe, expect, it } from 'vitest';
import type { Message as ModelMessage } from '@/services/llm/types';
import { MessageTransform } from '@/lib/message-transform';

describe('MessageTransform.transform', () => {
  it('adds empty reasoning_content for DeepSeek when assistant content has no reasoning', () => {
    const msgs: ModelMessage[] = [];
    const assistantContent = [{ type: 'text', text: 'hello' }];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'deepseek-v3.2',
      'openrouter',
      assistantContent
    );

    expect(transformedContent?.content).toEqual(assistantContent);
    expect(transformedContent?.providerOptions).toEqual({
      openaiCompatible: {
        reasoning_content: '',
      },
    });
  });

  it('adds reasoning_content for DeepSeek when assistant content has reasoning', () => {
    const msgs: ModelMessage[] = [];
    const assistantContent = [
      { type: 'reasoning', text: 'think' },
      { type: 'text', text: 'answer' },
    ];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'deepseek-v3.2',
      'deepseek',
      assistantContent
    );

    expect(transformedContent?.content).toEqual([{ type: 'text', text: 'answer' }]);
    expect(transformedContent?.providerOptions).toEqual({
      openaiCompatible: {
        reasoning_content: 'think',
      },
    });
  });

  it('only includes reasoning_content for Kimi-2 when reasoning exists', () => {
    const msgs: ModelMessage[] = [];
    const assistantContent = [{ type: 'text', text: 'hello' }];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-2',
      'openrouter',
      assistantContent
    );

    expect(transformedContent?.content).toEqual(assistantContent);
    expect(transformedContent?.providerOptions).toBeUndefined();
  });

  it('adds non-empty reasoning_content for Kimi-2 when tool calls are present', () => {
    const msgs: ModelMessage[] = [];
    const assistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'webFetch',
        input: { url: 'https://example.com' },
      },
    ];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-k2.5',
      'openrouter',
      assistantContent
    );

    expect(transformedContent?.content).toEqual(assistantContent);
    expect(transformedContent?.providerOptions).toEqual({
      openaiCompatible: {
        reasoning_content: ' ',
      },
    });
  });

  it('adds non-empty reasoning_content for Kimi-2 when tool calls are in assistant content', () => {
    const msgs: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Please read the file' }],
      },
    ];
    const assistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'readFile',
        input: { file_path: '/tmp/a.txt' },
      },
    ];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-k2.5',
      'openrouter',
      assistantContent
    );

    expect(transformedContent?.providerOptions).toEqual({
      openaiCompatible: {
        reasoning_content: ' ',
      },
    });
  });

  it('does not overwrite existing reasoning_content in assistant messages', () => {
    const msgs: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Please read the file' }],
      },
    ];
    const assistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'readFile',
        input: { file_path: '/tmp/a.txt' },
      },
    ];

    // First transform to add reasoning_content
    const firstResult = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-k2.5',
      'openrouter',
      assistantContent
    );
    expect(firstResult.transformedContent?.providerOptions?.openaiCompatible?.reasoning_content).toBe(' ');

    // Second transform with same content should produce same result
    const secondResult = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-k2.5',
      'openrouter',
      assistantContent
    );
    expect(secondResult.transformedContent?.providerOptions?.openaiCompatible?.reasoning_content).toBe(' ');
  });

  it('BUG: should provide reasoning_content for Moonshot Kimi K2.5 when assistantContent has only tool calls and no reasoning', () => {
    // This test reproduces the bug where an assistant message with tool calls
    // but no reasoning content is processed for Moonshot Kimi K2.5 model.
    // The actual model ID is 'kimi-k2.5' (with 'k' before '2'), but the code
    // checks for 'kimi-2' pattern, which doesn't match 'kimi-k2.5'.
    // This causes usesMoonshot to be false, and providerOptions is not set.
    const msgs: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Please read the file' }],
      },
    ];

    // assistantContent has tool calls but NO reasoning parts
    const assistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'readFile',
        input: { file_path: '/tmp/test.txt' },
      },
    ];

    // Call transform with the ACTUAL model ID format used in production: 'moonshotai/kimi-k2.5'
    // This does NOT match the 'kimi-2' pattern in resolveReasoningProviders
    const { transformedContent } = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-k2.5',
      'openrouter',
      assistantContent
    );

    // The bug: providerOptions is undefined because 'kimi-k2.5' doesn't match 'kimi-2' pattern
    // This causes the error: "thinking is enabled but reasoning_content is missing"
    expect(transformedContent).toBeDefined();
    expect(transformedContent?.providerOptions).toBeDefined();
    expect(transformedContent?.providerOptions?.openaiCompatible?.reasoning_content).toBe(' ');
  });

  it('provides reasoning_content when model ID matches kimi-2 pattern', () => {
    // This test shows that the code works when model ID matches the expected pattern
    // 'kimi-2.5' matches 'kimi-2', so providerOptions is correctly set
    const msgs: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Please read the file' }],
      },
    ];

    const assistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'readFile',
        input: { file_path: '/tmp/test.txt' },
      },
    ];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'moonshotai/kimi-k2.5',
      'openrouter',
      assistantContent
    );

    expect(transformedContent).toBeDefined();
    expect(transformedContent?.providerOptions).toBeDefined();
    expect(transformedContent?.providerOptions?.openaiCompatible?.reasoning_content).toBe(' ');
  });

  it('provides reasoning_content when providerId is moonshot directly', () => {
    // When providerId is 'moonshot', usesMoonshot should be true regardless of model ID
    const msgs: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Please read the file' }],
      },
    ];

    const assistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'readFile',
        input: { file_path: '/tmp/test.txt' },
      },
    ];

    const { transformedContent } = MessageTransform.transform(
      msgs,
      'kimi-k2.5',
      'moonshot',
      assistantContent
    );

    expect(transformedContent).toBeDefined();
    expect(transformedContent?.providerOptions).toBeDefined();
    expect(transformedContent?.providerOptions?.openaiCompatible?.reasoning_content).toBe(' ');
  });
});
