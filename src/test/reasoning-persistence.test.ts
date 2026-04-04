// Test for StreamProcessor reasoning persistence across iterations
// This test verifies that reasoning content is preserved when resetState() is called
import { beforeEach, describe, expect, it } from 'vitest';
import { StreamProcessor } from '@/services/agents/stream-processor';

describe('StreamProcessor reasoning persistence', () => {
  let processor: StreamProcessor;
  let chunks: string[];

  beforeEach(() => {
    processor = new StreamProcessor();
    chunks = [];
  });

  const createCallbacks = () => ({
    onChunk: (chunk: string) => {
      chunks.push(chunk);
    },
    onStatus: () => {},
    onAssistantMessageStart: () => {},
  });

  const createContext = (suppressReasoning = false) => ({
    suppressReasoning,
  });

  it('should preserve reasoning content in fullText after resetState()', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // Iteration 1: Reasoning appears
    processor.processReasoningDelta('test-id', 'I need to think about this', undefined, context, callbacks);
    processor.processReasoningDelta('test-id', ' carefully.', undefined, context, callbacks);

    // Check that reasoning was added to fullText
    const fullTextBeforeReset = processor.getFullText();
    expect(fullTextBeforeReset).toContain('Reasoning:');
    expect(fullTextBeforeReset).toContain('I need to think about this');
    expect(fullTextBeforeReset).toContain('carefully.');

    // Reset state for next iteration (simulating tool call)
    processor.resetState();

    // Iteration 2: Regular text appears
    processor.processTextDelta('Based on my analysis, ', callbacks);
    processor.processTextDelta('here is the answer.', callbacks);

    // CRITICAL: fullText should contain BOTH reasoning and new text
    const fullTextAfterReset = processor.getFullText();
    expect(fullTextAfterReset).toContain('Reasoning:');
    expect(fullTextAfterReset).toContain('I need to think about this');
    expect(fullTextAfterReset).toContain('carefully.');
    expect(fullTextAfterReset).toContain('Based on my analysis');
    expect(fullTextAfterReset).toContain('here is the answer');
  });

  it('should accumulate reasoning and text across multiple iterations', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // Iteration 1: Reasoning
    processor.processReasoningDelta('test-id', 'First, I need to analyze', undefined, context, callbacks);
    const fullText1 = processor.getFullText();
    expect(fullText1).toContain('Reasoning:');
    expect(fullText1).toContain('First, I need to analyze');

    // Iteration 2: More text after tool call
    processor.resetState();
    processor.processTextDelta('After using the tool, ', callbacks);
    const fullText2 = processor.getFullText();
    expect(fullText2).toContain('Reasoning:');
    expect(fullText2).toContain('First, I need to analyze');
    expect(fullText2).toContain('After using the tool');

    // Iteration 3: Even more text after another tool call
    processor.resetState();
    processor.processTextDelta('Finally, the answer is 42.', callbacks);
    const fullText3 = processor.getFullText();
    expect(fullText3).toContain('Reasoning:');
    expect(fullText3).toContain('First, I need to analyze');
    expect(fullText3).toContain('After using the tool');
    expect(fullText3).toContain('Finally, the answer is 42.');
  });

  it('should only show "Reasoning:" header once even across iterations', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // Iteration 1: First reasoning
    processor.processReasoningDelta('test-id', 'First thought', undefined, context, callbacks);
    expect(processor.getFullText()).toContain('Reasoning:');

    // Reset for iteration 2
    processor.resetState();

    // Iteration 2: Try to add more reasoning (should not add header again)
    processor.processReasoningDelta('test-id', 'Second thought', undefined, context, callbacks);
    const fullText = processor.getFullText();

    // Count occurrences of "Reasoning:"
    const reasoningHeaderCount = (fullText.match(/Reasoning:/g) || []).length;
    expect(reasoningHeaderCount).toBe(1); // Should only appear once!

    // But should contain both thoughts
    expect(fullText).toContain('First thought');
    expect(fullText).toContain('Second thought');
  });

  it('should preserve isFirstReasoning state across resetState()', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // First reasoning delta sets isFirstReasoning to false
    processor.processReasoningDelta('test-id', 'Initial reasoning', undefined, context, callbacks);

    // Reset state
    processor.resetState();

    // Second reasoning delta should NOT add the header again
    processor.processReasoningDelta('test-id', 'More reasoning', undefined, context, callbacks);

    const fullText = processor.getFullText();
    const reasoningHeaderCount = (fullText.match(/Reasoning:/g) || []).length;
    expect(reasoningHeaderCount).toBe(1);
  });

  it('should handle complex multi-iteration scenario with reasoning and text', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // Iteration 1: Reasoning + Text
    processor.processReasoningDelta('test-id', 'I should search for the file', undefined, context, callbacks);
    processor.processTextDelta('Let me search the codebase.', callbacks);
    const _iteration1Text = processor.getFullText();

    // Iteration 2: Tool call, then more reasoning
    processor.resetState();
    processor.processReasoningDelta('test-id', ' Now I found it,', undefined, context, callbacks);
    processor.processReasoningDelta('test-id', ' let me read it.', undefined, context, callbacks);
    const _iteration2Text = processor.getFullText();

    // Iteration 3: Tool call, then final answer
    processor.resetState();
    processor.processTextDelta('Based on the file contents, the answer is X.', callbacks);
    const finalText = processor.getFullText();

    // Verify all content is preserved
    expect(finalText).toContain('Reasoning:');
    expect(finalText).toContain('I should search for the file');
    expect(finalText).toContain('Let me search the codebase');
    expect(finalText).toContain('Now I found it');
    expect(finalText).toContain('let me read it');
    expect(finalText).toContain('Based on the file contents, the answer is X');

    // Verify only one "Reasoning:" header
    const reasoningHeaderCount = (finalText.match(/Reasoning:/g) || []).length;
    expect(reasoningHeaderCount).toBe(1);
  });

  it('should preserve currentStepText only for current iteration', () => {
    const callbacks = createCallbacks();
    const _context = createContext();

    // Iteration 1
    processor.processTextDelta('First iteration text', callbacks);
    expect(processor.getCurrentStepText()).toBe('First iteration text');

    // Reset for iteration 2
    processor.resetState();

    // currentStepText should be cleared
    expect(processor.getCurrentStepText()).toBe('');

    // But fullText should still contain iteration 1 text
    expect(processor.getFullText()).toContain('First iteration text');

    // Iteration 2
    processor.processTextDelta('Second iteration text', callbacks);
    expect(processor.getCurrentStepText()).toBe('Second iteration text');

    // fullText should contain both
    expect(processor.getFullText()).toContain('First iteration text');
    expect(processor.getFullText()).toContain('Second iteration text');
  });

  it('should handle suppressReasoning flag correctly', () => {
    const callbacks = createCallbacks();
    const contextSuppressed = createContext(true);

    // Try to add reasoning with suppression enabled
    processor.processReasoningDelta('test-id', 'This should not appear', undefined, contextSuppressed, callbacks);

    // fullText should be empty
    expect(processor.getFullText()).toBe('');

    // Now disable suppression
    const contextNotSuppressed = createContext(false);
    processor.processReasoningDelta('test-id', 'This should appear', undefined, contextNotSuppressed, callbacks);

    // fullText should now contain the reasoning
    expect(processor.getFullText()).toContain('Reasoning:');
    expect(processor.getFullText()).toContain('This should appear');
    expect(processor.getFullText()).not.toContain('This should not appear');
  });

  it('should preserve fullText across resets even with tool calls', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // Add reasoning and text before "tool call"
    processor.processReasoningDelta('test-id', 'Analyzing the problem', undefined, context, callbacks);
    processor.processTextDelta('Some text before tool call', callbacks);

    expect(processor.getFullText()).toContain('Reasoning:');
    expect(processor.getFullText()).toContain('Analyzing the problem');
    expect(processor.getFullText()).toContain('Some text before tool call');

    // Simulate tool call by resetting state (without actually calling processToolCall to avoid logger)
    processor.resetState();

    // Add text after "tool call"
    processor.processTextDelta('Text after tool call', callbacks);

    // fullText should contain content from both before and after the reset
    const fullText = processor.getFullText();
    expect(fullText).toContain('Reasoning:');
    expect(fullText).toContain('Analyzing the problem');
    expect(fullText).toContain('Some text before tool call');
    expect(fullText).toContain('Text after tool call');
  });

  it('should reset hasError flag but preserve fullText', () => {
    const callbacks = createCallbacks();

    // Add some content and mark error
    processor.processTextDelta('Some content', callbacks);
    processor.markError();

    expect(processor.hasError()).toBe(true);
    expect(processor.getFullText()).toContain('Some content');

    // Reset state
    processor.resetState();

    // Error flag should be cleared
    expect(processor.hasError()).toBe(false);

    // But fullText should be preserved
    expect(processor.getFullText()).toContain('Some content');
  });

  it('should format reasoning text correctly with markdown blockquote', () => {
    const callbacks = createCallbacks();
    const context = createContext();

    // Process reasoning
    processor.processReasoningDelta('test-id', 'Line 1\nLine 2', undefined, context, callbacks);

    const fullText = processor.getFullText();

    // Should have markdown blockquote format with '> ' prefix
    expect(fullText).toContain('> Reasoning:');
    expect(fullText).toContain('> Line 1');
    expect(fullText).toContain('> Line 2');
  });
});
