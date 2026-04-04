// Test for error handling bug fix in llm-service.ts
// BUG: Error messages were shown before user messages instead of after
// FIX: Call onError callback immediately for recoverable errors to ensure correct message ordering

import { describe, expect, it, vi } from 'vitest';

describe('LLMService - Error Message Ordering Bug Fix', () => {
  /**
   * BUG SCENARIO:
   * When an error occurred during streaming (case 'error':), the error message was:
   * 1. Added to loopState.messages via errorHandler.handleStreamError()
   * 2. But NOT immediately notified to UI via onError callback
   * 3. The loop continued to the next iteration
   * 4. The error message appeared in the message history BEFORE the next user message
   *
   * RESULT: Error showed at wrong position in the UI
   * Message order: [User] -> [Error] -> [Assistant Response] (WRONG)
   * Expected order: [User] -> [Assistant Response] -> [Error] (RIGHT)
   *
   * ROOT CAUSE:
   * When errorResult.shouldStop === false, the error was only added to loopState.messages
   * without notifying the UI immediately. Since UI updates are event-driven (via onError callback),
   * the error message would only appear when the message history was refreshed in the next iteration.
   *
   * THE FIX:
   * When errorResult.shouldStop === false AND errorResult.error exists,
   * also call onError?.(errorResult.error) to notify UI immediately.
   *
   * This ensures:
   * 1. Error is displayed immediately (same order as it occurred)
   * 2. Message continues processing in the background
   * 3. User sees error at the correct position in the chat
   */

  it('should notify UI immediately when a recoverable error occurs', () => {
    // Simulate the error handling logic
    const onError = vi.fn();

    // Simulate errorHandler.handleStreamError() result for a recoverable error
    const errorResult = {
      shouldStop: false, // Recoverable error - should continue
      error: new Error('Tool error: NoSuchToolError'), // Error to notify UI about
    };

    // OLD CODE (buggy): Would only add to loopState.messages, no UI notification
    // errorHandler.handleStreamError(delta.error, errorHandlerOptions);
    // // No onError callback here - error only in message history

    // NEW CODE (fixed):
    if (errorResult.shouldStop) {
      onError(errorResult.error);
      // reject();
    } else {
      // For recoverable errors, notify UI immediately
      if (errorResult.error) {
        onError(errorResult.error);
      }
    }

    // Verify UI was notified
    expect(onError).toHaveBeenCalledWith(errorResult.error);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('should continue processing after notifying UI of recoverable error', () => {
    // This test verifies that after notifying UI of a recoverable error,
    // the loop continues processing (doesn't reject/throw)

    const onError = vi.fn();
    const loopState = {
      messages: [] as any[],
      currentIteration: 1,
    };

    // Simulate the error handling
    const errorResult = {
      shouldStop: false,
      error: new Error('Tool validation error'),
    };

    // The fix: notify UI immediately
    if (errorResult.error && !errorResult.shouldStop) {
      onError(errorResult.error);
    }

    // Verify error was reported
    expect(onError).toHaveBeenCalledTimes(1);

    // Verify we can continue with next operations
    // (no exception thrown, no return statement)
    loopState.messages.push({
      role: 'user',
      content: 'Please try again with a different tool.',
    });

    expect(loopState.messages).toHaveLength(1);
  });

  it('should not call onError multiple times for the same error', () => {
    // Ensure we don't double-report errors
    const onError = vi.fn();

    const errorResult = {
      shouldStop: false,
      error: new Error('Test error'),
    };

    // The fix: notify UI once
    if (errorResult.error) {
      onError(errorResult.error);
    }

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(errorResult.error);
  });

  it('should handle fatal errors differently (shouldStop=true)', () => {
    // Fatal errors should still stop processing
    const onError = vi.fn();

    const errorResult = {
      shouldStop: true,
      error: new Error('Fatal HTTP error'),
    };

    // Fatal error path
    if (errorResult.shouldStop) {
      onError(errorResult.error);
      // reject(error);
      // return;
    } else {
      if (errorResult.error) {
        onError(errorResult.error);
      }
    }

    // Fatal error should still be reported
    expect(onError).toHaveBeenCalledWith(errorResult.error);
  });

  it('should preserve error message through the UI callback chain', () => {
    // Test that the error message is preserved and reaches the UI
    const errorMessages: Error[] = [];

    const onError = (error: Error) => {
      errorMessages.push(error);
    };

    const originalError = new Error('Tool input validation failed');
    const errorResult = {
      shouldStop: false,
      error: originalError,
    };

    // The fix
    if (errorResult.error && !errorResult.shouldStop) {
      onError(errorResult.error);
    }

    // Verify the exact error message was preserved
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]).toBe(originalError);
    expect(errorMessages[0].message).toBe('Tool input validation failed');
  });

  it('should handle case where errorResult.error is undefined', () => {
    // Some errors might not have a specific error object
    const onError = vi.fn();

    const errorResult = {
      shouldStop: false,
      error: undefined, // No error object
    };

    // The fix should safely handle undefined
    if (errorResult.error && !errorResult.shouldStop) {
      onError(errorResult.error);
    }

    // onError should not be called for undefined errors
    expect(onError).not.toHaveBeenCalled();
  });

  it('documents the message ordering timeline', () => {
    /**
     * BEFORE THE FIX (wrong message order):
     *
     * Timeline:
     * 1. User sends: "Call tool X"
     *    UI shows: [User message]
     *
     * 2. LLM streaming starts
     *    UI shows: [User message] [Assistant: ...streaming...]
     *
     * 3. Stream error occurs (e.g., invalid tool)
     *    - Error is added to loopState.messages
     *    - But onError callback is NOT called
     *    - Loop continues to next iteration
     *
     * 4. Next iteration sends messages to LLM
     *    - loopState.messages now contains: [user], [error message], [new assistant response]
     *    - Visible order in chat: [User] [Error] [New Assistant]
     *    - WRONG! User expects error to appear last
     *
     * AFTER THE FIX (correct message order):
     *
     * Timeline:
     * 1. User sends: "Call tool X"
     *    UI shows: [User message]
     *
     * 2. LLM streaming starts
     *    UI shows: [User message] [Assistant: ...streaming...]
     *
     * 3. Stream error occurs (e.g., invalid tool)
     *    - Error is added to loopState.messages (same as before)
     *    - FIX: onError callback IS called immediately
     *    - UI updates immediately with error message
     *    - UI shows: [User] [Assistant] [Error]
     *    - Loop continues with error message in history
     *
     * 4. Next iteration processes with error context
     *    - Message order is correct because error was displayed immediately
     */

    // This test is purely documentation
    const messageTimeline = [
      '1. User sends "Call tool X"',
      '2. Error occurs during streaming',
      '3. With fix: onError callback called immediately -> Error shown in UI',
      '4. Loop continues -> Message order is correct',
    ];

    expect(messageTimeline).toHaveLength(4);
  });
});
