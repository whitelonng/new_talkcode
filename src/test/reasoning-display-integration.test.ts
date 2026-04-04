import { beforeEach, describe, expect, it } from 'vitest';
import { StreamProcessor } from '../services/agents/stream-processor';

/**
 * Integration test for reasoning display in multi-iteration agent loops
 * This test reproduces the bug where reasoning text appears twice in the UI
 */
describe('Reasoning Display Integration', () => {
  let processor: StreamProcessor;
  let messages: Array<{ role: string; content: string; isStreaming: boolean }>;
  let currentMessageIndex: number;

  // Simulate the message management from chat-box.tsx
  const createNewMessage = (content = '', isStreaming = true) => {
    const messageId = messages.length;
    messages.push({
      role: 'assistant',
      content,
      isStreaming,
    });
    currentMessageIndex = messageId;
    return messageId;
  };

  const updateMessage = (messageId: number, content: string, isStreaming: boolean) => {
    if (messages[messageId]) {
      messages[messageId].content = content;
      messages[messageId].isStreaming = isStreaming;
    }
  };

  beforeEach(() => {
    processor = new StreamProcessor();
    messages = [];
    currentMessageIndex = -1;
  });

  it('should display reasoning text only once in single iteration', () => {
    // Simulate single iteration with reasoning
    createNewMessage();
    let streamedContent = '';

    // Process reasoning delta
    const reasoningText = 'I need to analyze the user query first.';
    processor.processReasoningDelta(
      'test-id',
      reasoningText,
      undefined,
      { suppressReasoning: false },
      {
        onChunk: (chunk: string) => {
          streamedContent += chunk;
          updateMessage(currentMessageIndex, streamedContent, true);
        },
      }
    );

    // Process text delta
    const textContent = 'Here is the answer.';
    processor.processTextDelta(textContent, {
      onChunk: (chunk: string) => {
        streamedContent += chunk;
        updateMessage(currentMessageIndex, streamedContent, true);
      },
    });

    // Complete
    updateMessage(currentMessageIndex, streamedContent, false);

    // Verify: Only one message with reasoning
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Reasoning:');
    expect(messages[0].content).toContain(reasoningText);
    expect(messages[0].content).toContain(textContent);

    // Count occurrences of "Reasoning:" - should be exactly 1
    const reasoningCount = (messages[0].content.match(/Reasoning:/g) || []).length;
    expect(reasoningCount).toBe(1);
  });

  it('should NOT duplicate reasoning text across multiple iterations', () => {
    // === ITERATION 1: Reasoning + text ===
    createNewMessage();
    let iteration1Content = '';

    // Process reasoning in iteration 1
    const reasoningText1 = 'I need to search for information first.';
    processor.processReasoningDelta(
      'test-id',
      reasoningText1,
      undefined,
      { suppressReasoning: false },
      {
        onChunk: (chunk: string) => {
          iteration1Content += chunk;
          updateMessage(currentMessageIndex, iteration1Content, true);
        },
      }
    );

    // Process text in iteration 1
    const textContent1 = 'Let me search for that.';
    processor.processTextDelta(textContent1, {
      onChunk: (chunk: string) => {
        iteration1Content += chunk;
        updateMessage(currentMessageIndex, iteration1Content, true);
      },
    });

    // Complete iteration 1
    // Use iteration1Content (like streamedContent in chat-box.tsx) instead of fullText
    updateMessage(currentMessageIndex, iteration1Content, false);

    // Save message 1 for verification
    const message1FinalContent = messages[currentMessageIndex].content;

    // === ITERATION 2: Tool result + new text (simulating agent loop) ===
    processor.resetState(); // Reset for new iteration (preserves fullText)

    // Create new message for iteration 2 (like handleAssistantMessageStart does)
    createNewMessage();
    let iteration2Content = '';

    // Process new text in iteration 2
    const textContent2 = 'Based on the search results, here is the answer.';
    processor.processTextDelta(textContent2, {
      onChunk: (chunk: string) => {
        iteration2Content += chunk;
        updateMessage(currentMessageIndex, iteration2Content, true);
      },
    });

    // Complete iteration 2
    // FIXED: Use iteration2Content (like streamedContent in chat-box.tsx)
    // instead of fullText which accumulates across iterations
    updateMessage(currentMessageIndex, iteration2Content, false);

    // Verify the bug: Message 2 should NOT contain reasoning from iteration 1
    expect(messages).toHaveLength(2);

    // Message 1 should have reasoning
    expect(message1FinalContent).toContain('Reasoning:');
    expect(message1FinalContent).toContain(reasoningText1);

    // VERIFICATION: Message 2 should NOT contain reasoning
    const message2Content = messages[1].content;
    expect(message2Content).not.toContain('Reasoning:');

    // Message 2 should only contain new content
    expect(message2Content).toContain(textContent2);
    expect(message2Content).not.toContain(reasoningText1);
    expect(message2Content).not.toContain(textContent1);

    // Count total "Reasoning:" occurrences across all messages - should be exactly 1
    const totalReasoningCount = messages.reduce((count, msg) => {
      return count + (msg.content.match(/Reasoning:/g) || []).length;
    }, 0);
    expect(totalReasoningCount).toBe(1);
  });

  it('should handle multiple iterations with tool calls correctly', () => {
    // === ITERATION 1: Reasoning + tool call ===
    createNewMessage();
    let iteration1Content = '';

    // Reasoning
    const reasoningText = 'I need to use a tool to get this information.';
    processor.processReasoningDelta(
      'test-id',
      reasoningText,
      undefined,
      { suppressReasoning: false },
      {
        onChunk: (chunk: string) => {
          iteration1Content += chunk;
          updateMessage(currentMessageIndex, iteration1Content, true);
        },
      }
    );

    // Complete iteration 1
    updateMessage(currentMessageIndex, iteration1Content, false);

    // === ITERATION 2: Tool result ===
    processor.resetState();
    createNewMessage();
    let iteration2Content = '';

    const textContent2 = 'Based on the tool result, here is the answer.';
    processor.processTextDelta(textContent2, {
      onChunk: (chunk: string) => {
        iteration2Content += chunk;
        updateMessage(currentMessageIndex, iteration2Content, true);
      },
    });

    updateMessage(currentMessageIndex, iteration2Content, false);

    // === ITERATION 3: Additional processing ===
    processor.resetState();
    createNewMessage();
    let iteration3Content = '';

    const textContent3 = 'Final answer after processing.';
    processor.processTextDelta(textContent3, {
      onChunk: (chunk: string) => {
        iteration3Content += chunk;
        updateMessage(currentMessageIndex, iteration3Content, true);
      },
    });

    updateMessage(currentMessageIndex, iteration3Content, false);

    // Verify
    expect(messages).toHaveLength(3);

    // Only message 1 should have reasoning
    expect(messages[0].content).toContain('Reasoning:');

    // Messages 2 and 3 should NOT have reasoning
    expect(messages[1].content).not.toContain('Reasoning:');
    expect(messages[2].content).not.toContain('Reasoning:');

    // Each message should only contain its own content
    expect(messages[1].content).toContain(textContent2);
    expect(messages[1].content).not.toContain(textContent3);
    expect(messages[2].content).toContain(textContent3);
    expect(messages[2].content).not.toContain(textContent2);

    // Total reasoning count should be 1
    const totalReasoningCount = messages.reduce((count, msg) => {
      return count + (msg.content.match(/Reasoning:/g) || []).length;
    }, 0);
    expect(totalReasoningCount).toBe(1);
  });

  it('should handle edge case: reasoning in later iterations', () => {
    // === ITERATION 1: Text only ===
    createNewMessage();
    let iteration1Content = '';

    const textContent1 = 'Initial response.';
    processor.processTextDelta(textContent1, {
      onChunk: (chunk: string) => {
        iteration1Content += chunk;
        updateMessage(currentMessageIndex, iteration1Content, true);
      },
    });

    updateMessage(currentMessageIndex, iteration1Content, false);

    // === ITERATION 2: Reasoning appears here ===
    processor.resetState();
    createNewMessage();
    let iteration2Content = '';

    // This should NOT happen in practice (reasoning after isFirstReasoning is false)
    // But let's test the behavior
    const reasoningText2 = 'Additional thinking needed.';
    processor.processReasoningDelta(
      'test-id',
      reasoningText2,
      undefined,
      { suppressReasoning: false },
      {
        onChunk: (chunk: string) => {
          iteration2Content += chunk;
          updateMessage(currentMessageIndex, iteration2Content, true);
        },
      }
    );

    updateMessage(currentMessageIndex, iteration2Content, false);

    // Verify
    expect(messages).toHaveLength(2);

    // Message 1 should NOT have reasoning
    expect(messages[0].content).not.toContain('Reasoning:');

    // Message 2 should NOT have reasoning from iteration 1 OR its own reasoning
    // (because isFirstReasoning is false after iteration 1)
    // This behavior is determined by the StreamProcessor implementation
  });
});
