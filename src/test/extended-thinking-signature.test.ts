// src/test/extended-thinking-signature.test.ts
// Tests for Claude API extended thinking signature handling
// This ensures thinking blocks with signatures are properly captured and passed back to the API

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger FIRST before any imports that may use it

import { StreamProcessor } from '@/services/agents/stream-processor';

// Mock the settings store
vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: () => ({ language: 'en', getReasoningEffort: vi.fn(() => 'medium') }),
  },
}));

// Mock model-config to avoid circular dependency
vi.mock('@/providers/config/model-config', () => ({
  GPT5_MINI: 'gpt-5-mini',
  MINIMAX_M21: 'minimax-m21',
  GEMINI_25_FLASH_LITE: 'gemini-2.5-flash-lite',
  CODE_STARL: 'codestral',
  CLAUDE_HAIKU: 'claude-haiku-4.5',
  GROK_CODE_FAST: 'grok-code-fast-1',
  NANO_BANANA_PRO: 'gemini-3-pro-image',
  SCRIBE_V2_REALTIME: 'scribe-v2-realtime',
  MODEL_CONFIGS: {},
  ensureModelsInitialized: vi.fn().mockResolvedValue(undefined),
  refreshModelConfigs: vi.fn().mockResolvedValue(undefined),
  getProvidersForModel: vi.fn().mockReturnValue([]),
  getContextLength: vi.fn().mockReturnValue(200000),
}));

// Mock the logger

describe('Extended Thinking Signature Handling', () => {
  let processor: StreamProcessor;
  const callbacks = {
    onChunk: vi.fn(),
    onStatus: vi.fn(),
    onAssistantMessageStart: vi.fn(),
  };
  const context = { suppressReasoning: false };

  beforeEach(() => {
    processor = new StreamProcessor();
    vi.clearAllMocks();
  });

  describe('providerMetadata capture', () => {
    it('should store providerMetadata from reasoning-start event', () => {
      const providerMetadata = {
        anthropic: {
          redactedData: 'some-redacted-data',
        },
      };

      processor.processReasoningStart('test-id', providerMetadata, callbacks);

      const state = processor.getState();
      expect(state.reasoningBlocks).toHaveLength(1);
      expect(state.reasoningBlocks[0].providerMetadata).toEqual(providerMetadata);
    });

    it('should update providerMetadata from reasoning-delta events (signature)', () => {
      // First, start reasoning
      processor.processReasoningStart('test-id', undefined, callbacks);

      // Then process text delta
      processor.processReasoningDelta(
        'test-id',
        'Thinking about the problem...',
        undefined,
        context,
        callbacks
      );

      // Then receive signature via providerMetadata (this happens with empty text)
      const signatureMetadata = {
        anthropic: {
          signature: 'eyJhbGciOiJFZERTQSJ9.test-signature-data',
        },
      };
      processor.processReasoningDelta('test-id', '', signatureMetadata, context, callbacks);

      const state = processor.getState();
      expect(state.reasoningBlocks).toHaveLength(1);
      expect(state.reasoningBlocks[0].providerMetadata).toEqual(signatureMetadata);
      expect(state.reasoningBlocks[0].text).toBe('Thinking about the problem...');
    });

    it('should merge providerMetadata from multiple delta events', () => {
      processor.processReasoningStart('test-id', undefined, callbacks);

      // First delta with some metadata
      const metadata1 = { anthropic: { key1: 'value1' } };
      processor.processReasoningDelta('test-id', 'Part 1', metadata1, context, callbacks);

      // Second delta with signature
      const metadata2 = { anthropic: { signature: 'test-signature' } };
      processor.processReasoningDelta('test-id', '', metadata2, context, callbacks);

      const state = processor.getState();
      expect(state.reasoningBlocks[0].providerMetadata).toEqual({
        anthropic: {
          key1: 'value1',
          signature: 'test-signature',
        },
      });
    });

    it('should handle reasoning without reasoning-start (backward compatibility)', () => {
      // Process reasoning delta without prior reasoning-start
      const signatureMetadata = {
        anthropic: { signature: 'test-signature' },
      };
      processor.processReasoningDelta(
        'test-id',
        'Direct reasoning',
        signatureMetadata,
        context,
        callbacks
      );

      const state = processor.getState();
      expect(state.reasoningBlocks).toHaveLength(1);
      expect(state.reasoningBlocks[0].text).toBe('Direct reasoning');
      expect(state.reasoningBlocks[0].providerMetadata).toEqual(signatureMetadata);
    });
  });

  describe('getAssistantContent with providerOptions', () => {
    it('should include providerOptions in reasoning parts when signature is present', () => {
      const signatureMetadata = {
        anthropic: { signature: 'test-signature-123' },
      };

      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta('test-id', 'My reasoning', undefined, context, callbacks);
      processor.processReasoningDelta('test-id', '', signatureMetadata, context, callbacks);

      const content = processor.getAssistantContent();

      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('reasoning');
      expect(content[0].text).toBe('My reasoning');
      // Check that providerOptions is set (using any due to type extension)
      expect((content[0] as any).providerOptions).toEqual(signatureMetadata);
    });

    it('should allow non-anthropic provider metadata on reasoning parts', () => {
      const signatureMetadata = {
        google: { thought_signature: 'test-google-signature' },
      };

      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta('test-id', 'Reasoning with metadata', undefined, context, callbacks);
      processor.processReasoningDelta('test-id', '', signatureMetadata, context, callbacks);

      const content = processor.getAssistantContent();

      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('reasoning');
      expect((content[0] as any).providerOptions).toEqual(signatureMetadata);
    });

    it('should not include providerOptions when no metadata is present', () => {
      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta(
        'test-id',
        'Reasoning without signature',
        undefined,
        context,
        callbacks
      );

      const content = processor.getAssistantContent();

      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('reasoning');
      expect((content[0] as any).providerOptions).toBeUndefined();
    });

    it('should preserve text and reasoning order with providerOptions', () => {
      const signatureMetadata = { anthropic: { signature: 'sig' } };

      // Reasoning first
      processor.processReasoningStart('reason-1', undefined, callbacks);
      processor.processReasoningDelta('reason-1', 'First, I think...', undefined, context, callbacks);
      processor.processReasoningDelta('reason-1', '', signatureMetadata, context, callbacks);

      // Then text
      processor.processTextDelta('Here is my answer.', callbacks);

      const content = processor.getAssistantContent();

      expect(content).toHaveLength(2);
      expect(content[0].type).toBe('reasoning');
      expect(content[0].text).toBe('First, I think...');
      expect((content[0] as any).providerOptions).toEqual(signatureMetadata);
      expect(content[1].type).toBe('text');
      expect(content[1].text).toBe('Here is my answer.');
    });
  });

  describe('signature handling across iterations', () => {
    it('should preserve providerMetadata in reasoning blocks after resetState()', () => {
      const signatureMetadata = { anthropic: { signature: 'persistent-sig' } };

      // Iteration 1: Add reasoning with signature
      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta('test-id', 'Iteration 1 reasoning', undefined, context, callbacks);
      processor.processReasoningDelta('test-id', '', signatureMetadata, context, callbacks);

      // Get content before reset
      const contentBefore = processor.getAssistantContent();
      expect((contentBefore[0] as any).providerOptions).toEqual(signatureMetadata);

      // Reset for iteration 2
      processor.resetState();

      // Note: After resetState, reasoningBlocks are cleared for the new iteration
      // But the content from getAssistantContent should have been used before reset
    });

    it('should clear providerMetadata on fullReset()', () => {
      const signatureMetadata = { anthropic: { signature: 'will-be-cleared' } };

      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta('test-id', 'Some reasoning', undefined, context, callbacks);
      processor.processReasoningDelta('test-id', '', signatureMetadata, context, callbacks);

      processor.fullReset();

      const state = processor.getState();
      expect(state.reasoningBlocks).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty text delta that only contains providerMetadata', () => {
      const signatureMetadata = { anthropic: { signature: 'sig-only' } };

      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta('test-id', 'Some text', undefined, context, callbacks);

      // Empty text delta with only metadata (this is how signature is delivered)
      processor.processReasoningDelta('test-id', '', signatureMetadata, context, callbacks);

      const state = processor.getState();
      expect(state.reasoningBlocks[0].text).toBe('Some text');
      expect(state.reasoningBlocks[0].providerMetadata).toEqual(signatureMetadata);

      // Should still be able to get content
      const content = processor.getAssistantContent();
      expect(content).toHaveLength(1);
      expect((content[0] as any).providerOptions).toEqual(signatureMetadata);
    });

    it('should handle whitespace-only text delta with providerMetadata', () => {
      const signatureMetadata = { anthropic: { signature: 'sig' } };

      processor.processReasoningStart('test-id', undefined, callbacks);
      processor.processReasoningDelta('test-id', 'Real content', undefined, context, callbacks);
      processor.processReasoningDelta('test-id', '   ', signatureMetadata, context, callbacks);

      const state = processor.getState();
      // providerMetadata should still be captured
      expect(state.reasoningBlocks[0].providerMetadata).toEqual(signatureMetadata);
    });

    it('should handle multiple reasoning blocks with different signatures', () => {
      const sig1 = { anthropic: { signature: 'sig-1' } };
      const sig2 = { anthropic: { signature: 'sig-2' } };

      // First reasoning block
      processor.processReasoningStart('block-1', undefined, callbacks);
      processor.processReasoningDelta('block-1', 'First thinking', undefined, context, callbacks);
      processor.processReasoningDelta('block-1', '', sig1, context, callbacks);

      // Text in between
      processor.processTextDelta('Some text', callbacks);

      // Second reasoning block
      processor.processReasoningStart('block-2', undefined, callbacks);
      processor.processReasoningDelta('block-2', 'Second thinking', undefined, context, callbacks);
      processor.processReasoningDelta('block-2', '', sig2, context, callbacks);

      const content = processor.getAssistantContent();

      expect(content).toHaveLength(3);
      expect(content[0].type).toBe('reasoning');
      expect((content[0] as any).providerOptions).toEqual(sig1);
      expect(content[1].type).toBe('reasoning');
      expect((content[1] as any).providerOptions).toEqual(sig2);
      expect(content[2].type).toBe('text');
    });

    it('should handle redactedData in providerMetadata', () => {
      const redactedMetadata = {
        anthropic: {
          redactedData: 'base64-encoded-redacted-thinking',
        },
      };

      processor.processReasoningStart('test-id', redactedMetadata, callbacks);
      processor.processReasoningDelta('test-id', 'Visible reasoning', undefined, context, callbacks);

      const content = processor.getAssistantContent();
      expect((content[0] as any).providerOptions).toEqual(redactedMetadata);
    });
  });
});
