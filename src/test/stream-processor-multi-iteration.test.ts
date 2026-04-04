// Test for StreamProcessor behavior in multi-iteration scenarios
// This test verifies that onAssistantMessageStart is called correctly for each iteration
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamProcessor } from '@/services/agents/stream-processor';

describe('StreamProcessor multi-iteration behavior', () => {
  let processor: StreamProcessor;
  let onAssistantMessageStartCalls: number;
  let onChunkCalls: string[];

  beforeEach(() => {
    processor = new StreamProcessor();
    onAssistantMessageStartCalls = 0;
    onChunkCalls = [];
  });

  it('should call onAssistantMessageStart for each text iteration', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    // First iteration - text-start event
    processor.processTextStart(callbacks);
    expect(onAssistantMessageStartCalls).toBe(1);

    // First iteration - text-delta events
    processor.processTextDelta('A', callbacks);
    processor.processTextDelta('A', callbacks);
    processor.processTextDelta('A', callbacks);
    processor.processTextDelta('A', callbacks);

    // Verify first iteration produced text
    expect(onChunkCalls).toEqual(['A', 'A', 'A', 'A']);
    expect(processor.getCurrentStepText()).toBe('AAAA');

    // Simulate tool call (processor gets reset between iterations in real code)
    // This is the KEY test - without resetState(), isAnswering remains true
    processor.resetState();

    // Second iteration - text-start event
    processor.processTextStart(callbacks);

    // BUG: If resetState() is not called, onAssistantMessageStart won't be called again
    // because isAnswering is still true from the first iteration
    expect(onAssistantMessageStartCalls).toBe(2); // Should be 2, not 1

    // Second iteration - text-delta events
    processor.processTextDelta('B', callbacks);
    processor.processTextDelta('B', callbacks);
    processor.processTextDelta('B', callbacks);
    processor.processTextDelta('B', callbacks);

    // Verify second iteration produced new text
    expect(onChunkCalls).toEqual(['A', 'A', 'A', 'A', 'B', 'B', 'B', 'B']);
    expect(processor.getCurrentStepText()).toBe('BBBB');
  });

  it('should demonstrate bug when only text-delta is received without resetState', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    // First iteration - using text-delta (some models don't send text-start)
    processor.processTextDelta('A', callbacks);
    processor.processTextDelta('A', callbacks);

    // Should have called onAssistantMessageStart once
    expect(onAssistantMessageStartCalls).toBe(1);
    expect(processor.getCurrentStepText()).toBe('AA');

    // DO NOT reset state (this simulates the bug before fix)
    // processor.resetState(); // <-- commented out to demonstrate bug

    // Second iteration - text-delta without text-start
    processor.processTextDelta('B', callbacks);
    processor.processTextDelta('B', callbacks);

    // BUG DEMONSTRATED: onAssistantMessageStart is NOT called again
    // because isAnswering is still true from first iteration
    expect(onAssistantMessageStartCalls).toBe(1); // Still 1, not 2!

    // All text gets accumulated together in currentStepText
    expect(onChunkCalls).toEqual(['A', 'A', 'B', 'B']);
    expect(processor.getCurrentStepText()).toBe('AABB'); // Concatenated!
  });

  it('should NOT call onAssistantMessageStart again when text-start arrives but already answering', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    // First iteration
    processor.processTextStart(callbacks);
    expect(onAssistantMessageStartCalls).toBe(1);

    processor.processTextDelta('A', callbacks);
    processor.processTextDelta('A', callbacks);

    // DO NOT reset state
    // processor.resetState(); // <-- commented out

    // Second text-start event without resetState
    processor.processTextStart(callbacks);

    // text-start should NOT call onAssistantMessageStart again when already answering
    // This prevents duplicate message creation (e.g., when reasoning comes before text-start)
    expect(onAssistantMessageStartCalls).toBe(1); // NOT called again!

    // Text continues to accumulate
    processor.processTextDelta('B', callbacks);
    processor.processTextDelta('B', callbacks);

    // Text still gets concatenated in currentStepText
    expect(onChunkCalls).toEqual(['A', 'A', 'B', 'B']);
    expect(processor.getCurrentStepText()).toBe('AABB'); // Still concatenated!
  });

  it('should handle text-delta without text-start by calling onAssistantMessageStart', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    // Some models might not send text-start, only text-delta
    processor.processTextDelta('Hello', callbacks);

    // Should still call onAssistantMessageStart
    expect(onAssistantMessageStartCalls).toBe(1);
    expect(onChunkCalls).toEqual(['Hello']);
  });

  it('should reset isAnswering flag after resetState', () => {
    const callbacks = {
      onChunk: vi.fn(),
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    // First iteration
    processor.processTextStart(callbacks);
    expect(onAssistantMessageStartCalls).toBe(1);

    // Reset state
    processor.resetState();

    // Check that isAnswering was reset by trying text-delta
    processor.processTextDelta('Test', callbacks);

    // If isAnswering was properly reset, onAssistantMessageStart should be called again
    expect(onAssistantMessageStartCalls).toBe(2);
  });

  it('should handle three iterations correctly with proper resets', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    // Iteration 1
    processor.processTextStart(callbacks);
    processor.processTextDelta('First', callbacks);
    expect(onAssistantMessageStartCalls).toBe(1);
    expect(processor.getCurrentStepText()).toBe('First');

    // Reset for iteration 2
    processor.resetState();

    // Iteration 2
    processor.processTextStart(callbacks);
    processor.processTextDelta('Second', callbacks);
    expect(onAssistantMessageStartCalls).toBe(2);
    expect(processor.getCurrentStepText()).toBe('Second');

    // Reset for iteration 3
    processor.resetState();

    // Iteration 3
    processor.processTextStart(callbacks);
    processor.processTextDelta('Third', callbacks);
    expect(onAssistantMessageStartCalls).toBe(3);
    expect(processor.getCurrentStepText()).toBe('Third');

    // Verify all chunks were received
    expect(onChunkCalls).toEqual(['First', 'Second', 'Third']);
  });

  it('should call onAssistantMessageStart when only reasoning-delta is received', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    const context = {
      suppressReasoning: false,
    };

    // AI returns only reasoning content without text-start or text-delta
    processor.processReasoningDelta('test-id', 'Thinking about the problem...', undefined, context, callbacks);

    // Should call onAssistantMessageStart even for reasoning-only content
    expect(onAssistantMessageStartCalls).toBe(1);
    expect(onChunkCalls.length).toBeGreaterThan(0); // Should have chunks from formatted reasoning
  });

  it('should not call onAssistantMessageStart when reasoning is suppressed', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    const context = {
      suppressReasoning: true,
    };

    // AI returns reasoning but it's suppressed
    processor.processReasoningDelta('test-id', 'Thinking about the problem...', undefined, context, callbacks);

    // Should NOT call onAssistantMessageStart when reasoning is suppressed
    expect(onAssistantMessageStartCalls).toBe(0);
    expect(onChunkCalls.length).toBe(0); // No chunks when suppressed
  });

  it('should handle mixed reasoning and text content correctly', () => {
    const callbacks = {
      onChunk: (chunk: string) => {
        onChunkCalls.push(chunk);
      },
      onStatus: vi.fn(),
      onAssistantMessageStart: () => {
        onAssistantMessageStartCalls++;
      },
    };

    const context = {
      suppressReasoning: false,
    };

    // First reasoning
    processor.processReasoningDelta('test-id', 'Analyzing...', undefined, context, callbacks);
    expect(onAssistantMessageStartCalls).toBe(1);

    // More reasoning
    processor.processReasoningDelta('test-id', 'Considering options...', undefined, context, callbacks);
    expect(onAssistantMessageStartCalls).toBe(1); // Should not be called again

    // Then text
    processor.processTextDelta('Here is my answer', callbacks);
    expect(onAssistantMessageStartCalls).toBe(1); // Still 1, already answering

    // Verify we got both reasoning and text chunks
    expect(onChunkCalls.length).toBeGreaterThan(2);
  });
});
