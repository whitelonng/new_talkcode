// src/test/conversation-isolation.test.ts
/**
 * Critical tests for conversation isolation bug
 *
 * Bug Description:
 * When creating a new conversation, messages from the previous conversation
 * were showing up in the UI because StreamProcessor is a singleton that
 * preserves fullText across resetState() calls.
 *
 * Root Cause:
 * - LLMService is a singleton with a StreamProcessor instance
 * - resetState() preserves fullText for multi-iteration within same conversation
 * - When switching conversations, fullText was not being cleared
 *
 * Fix:
 * - Added fullReset() method that completely clears all state
 * - llmService.runAgentLoop() now calls fullReset() at the start
 * - resetState() continues to preserve fullText for iterations within same loop
 *
 * Test Strategy:
 * - Unit tests for StreamProcessor.fullReset() and resetState() behavior
 * - These tests verify the core fix at the processor level
 * - Integration tests with LLMService are handled via manual testing due to
 *   complex dependency chains (ConversationLogger, Tauri APIs, etc.)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamProcessor } from '@/services/agents/stream-processor';

describe('Conversation Isolation - Critical Bug Tests', () => {
  describe('StreamProcessor: fullReset() vs resetState()', () => {
    let processor: StreamProcessor;

    beforeEach(() => {
      processor = new StreamProcessor();
    });

    it('should completely clear all state including fullText when calling fullReset()', () => {
      const callbacks = {
        onChunk: vi.fn(),
        onStatus: vi.fn(),
        onAssistantMessageStart: vi.fn(),
      };
      const context = { suppressReasoning: false };

      // Simulate some content from first conversation
      processor.processTextDelta('Hello from conversation A', callbacks);
      processor.processReasoningDelta('test-id', 'Some reasoning', undefined, context, callbacks);

      // Verify content was accumulated
      expect(processor.getFullText()).toContain('Hello from conversation A');
      expect(processor.getFullText()).toContain('Some reasoning');
      expect(processor.getFullText().length).toBeGreaterThan(0);

      // Call fullReset (should clear everything)
      processor.fullReset();

      // Verify everything is cleared
      expect(processor.getFullText()).toBe('');
      expect(processor.getCurrentStepText()).toBe('');
      expect(processor.getToolCalls()).toHaveLength(0);
      expect(processor.hasError()).toBe(false);
      expect(processor.getConsecutiveToolErrors()).toBe(0);
      expect(processor.getState().isFirstReasoning).toBe(true);
    });

    it('should preserve fullText when calling resetState()', () => {
      const callbacks = {
        onChunk: vi.fn(),
        onStatus: vi.fn(),
        onAssistantMessageStart: vi.fn(),
      };

      // Simulate first iteration
      processor.processTextDelta('First iteration text', callbacks);
      const fullTextBeforeReset = processor.getFullText();

      expect(fullTextBeforeReset).toBe('First iteration text');

      // Call resetState (should preserve fullText)
      processor.resetState();

      // fullText should be preserved
      expect(processor.getFullText()).toBe('First iteration text');

      // But currentStepText should be cleared
      expect(processor.getCurrentStepText()).toBe('');

      // Tool calls should be cleared
      expect(processor.getToolCalls()).toHaveLength(0);

      // Can continue accumulating in next iteration
      processor.processTextDelta(' Second iteration text', callbacks);
      expect(processor.getFullText()).toBe('First iteration text Second iteration text');
    });

    it('should demonstrate the difference: resetState preserves, fullReset clears', () => {
      const callbacks = {
        onChunk: vi.fn(),
      };

      // Add content
      processor.processTextDelta('Original content', callbacks);
      const originalFullText = processor.getFullText();

      // Test resetState
      processor.resetState();
      expect(processor.getFullText()).toBe(originalFullText); // Preserved

      // Test fullReset
      processor.fullReset();
      expect(processor.getFullText()).toBe(''); // Cleared
    });

    it('should preserve isFirstReasoning with resetState, reset it with fullReset', () => {
      const callbacks = { onChunk: vi.fn() };
      const context = { suppressReasoning: false };

      // First reasoning
      processor.processReasoningDelta('test-id', 'reasoning', undefined, context, callbacks);
      expect(processor.getState().isFirstReasoning).toBe(false);

      // resetState preserves isFirstReasoning
      processor.resetState();
      expect(processor.getState().isFirstReasoning).toBe(false);

      // fullReset resets isFirstReasoning
      processor.fullReset();
      expect(processor.getState().isFirstReasoning).toBe(true);
    });

    it('should preserve consecutiveToolErrors with resetState, reset it with fullReset', () => {
      // Simulate errors
      processor.markError();
      processor.markError();
      expect(processor.getConsecutiveToolErrors()).toBe(2);

      // resetState preserves consecutiveToolErrors
      processor.resetState();
      expect(processor.getConsecutiveToolErrors()).toBe(2);

      // fullReset clears consecutiveToolErrors
      processor.fullReset();
      expect(processor.getConsecutiveToolErrors()).toBe(0);
    });

    it('should simulate the bug scenario: old conversation content leaking into new conversation', () => {
      const callbacks = { onChunk: vi.fn() };

      // Simulate Conversation A
      processor.processTextDelta('Response from Conversation A', callbacks);
      const convAText = processor.getFullText();
      expect(convAText).toBe('Response from Conversation A');

      // Bug scenario: only calling resetState() between conversations
      processor.resetState();

      // Start Conversation B
      processor.processTextDelta('Response from Conversation B', callbacks);
      const convBText = processor.getFullText();

      // BUG: Conversation B contains Conversation A's content!
      expect(convBText).toContain('Response from Conversation A');
      expect(convBText).toBe('Response from Conversation A' + 'Response from Conversation B');
    });

    it('should verify the fix: fullReset() prevents conversation leakage', () => {
      const callbacks = { onChunk: vi.fn() };

      // Simulate Conversation A
      processor.processTextDelta('Response from Conversation A', callbacks);
      const convAText = processor.getFullText();
      expect(convAText).toBe('Response from Conversation A');

      // Fixed scenario: calling fullReset() between conversations
      processor.fullReset();

      // Start Conversation B
      processor.processTextDelta('Response from Conversation B', callbacks);
      const convBText = processor.getFullText();

      // FIXED: Conversation B does NOT contain Conversation A's content
      expect(convBText).not.toContain('Response from Conversation A');
      expect(convBText).toBe('Response from Conversation B');
    });

    it('should handle multi-iteration within same conversation correctly', () => {
      const callbacks = { onChunk: vi.fn() };

      // First iteration
      processor.processTextDelta('Iteration 1 text. ', callbacks);

      // Tool call happens (end of iteration 1)
      processor.resetState(); // Preserve fullText

      // Second iteration
      processor.processTextDelta('Iteration 2 text.', callbacks);

      // Content should be accumulated
      expect(processor.getFullText()).toBe('Iteration 1 text. Iteration 2 text.');
    });

    it('should handle complex scenario: multiple conversations with multi-iteration', () => {
      const callbacks = { onChunk: vi.fn() };

      // === Conversation A (multi-iteration) ===
      processor.processTextDelta('Conv A - Iter 1. ', callbacks);
      processor.resetState(); // Preserve for next iteration
      processor.processTextDelta('Conv A - Iter 2.', callbacks);

      const convAFinal = processor.getFullText();
      expect(convAFinal).toBe('Conv A - Iter 1. Conv A - Iter 2.');

      // === Switch to Conversation B ===
      processor.fullReset(); // Full reset between conversations

      // === Conversation B (multi-iteration) ===
      processor.processTextDelta('Conv B - Iter 1. ', callbacks);
      processor.resetState(); // Preserve for next iteration
      processor.processTextDelta('Conv B - Iter 2.', callbacks);

      const convBFinal = processor.getFullText();

      // Verify isolation
      expect(convBFinal).toBe('Conv B - Iter 1. Conv B - Iter 2.');
      expect(convBFinal).not.toContain('Conv A');
    });
  });
});
