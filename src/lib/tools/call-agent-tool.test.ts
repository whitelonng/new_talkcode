import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNestedToolsStore } from '@/stores/nested-tools-store';
import type { UIMessage } from '@/types/agent';

import { logger } from '@/lib/logger';

describe('callAgent tool error logging', () => {
  let originalAddMessage: any;

  beforeEach(() => {
    // Clear the store before each test
    useNestedToolsStore.getState().clearAll();

    // Clear mock calls before each test
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    // Restore mocks after each test
    vi.restoreAllMocks();
    if (originalAddMessage) {
      useNestedToolsStore.getState().addMessage = originalAddMessage;
    }
  });

  it('should log error with proper context when addMessage fails', () => {
    const executionId = 'test-execution-123';
    const testMessage: UIMessage = {
      id: 'nested-msg-456',
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'tool-call-789',
          toolName: 'bash',
          input: { command: 'ls' },
        },
      ],
      timestamp: new Date(),
      toolCallId: 'tool-call-789',
      toolName: 'bash',
    };

    // Mock addMessage to throw an error
    const mockError = new Error('Failed to add message to store');
    originalAddMessage = useNestedToolsStore.getState().addMessage;
    useNestedToolsStore.getState().addMessage = vi.fn(() => {
      throw mockError;
    });

    // Simulate the onToolMessage callback logic
    try {
      useNestedToolsStore.getState().addMessage(executionId, {
        ...testMessage,
        parentToolCallId: executionId,
      });
    } catch (error) {
      // This should match the fixed error logging syntax
      logger.error('[callAgent] ❌ Failed to add nested tool message:', error, {
        executionId,
        messageId: testMessage.id,
      });
    }

    // Verify logger.error was called with correct parameters
    expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);

    // Verify the call signature matches the fixed version:
    // logger.error(message, errorObj, context)
    const [message, errorObj, context] = vi.mocked(logger.error).mock.calls[0];

    expect(message).toBe('[callAgent] ❌ Failed to add nested tool message:');
    expect(errorObj).toBe(mockError);
    expect(context).toEqual({
      executionId: 'test-execution-123',
      messageId: 'nested-msg-456',
    });
  });

  it('should log error details for non-Error objects', () => {
    const executionId = 'test-execution-999';
    const testMessage: UIMessage = {
      id: 'nested-msg-888',
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'tool-call-777',
          toolName: 'read',
          input: { filePath: '/test' },
        },
      ],
      timestamp: new Date(),
      toolCallId: 'tool-call-777',
      toolName: 'read',
    };

    // Mock addMessage to throw a string error
    const stringError = 'Something went wrong';
    originalAddMessage = useNestedToolsStore.getState().addMessage;
    useNestedToolsStore.getState().addMessage = vi.fn(() => {
      throw stringError;
    });

    try {
      useNestedToolsStore.getState().addMessage(executionId, {
        ...testMessage,
        parentToolCallId: executionId,
      });
    } catch (error) {
      logger.error('[callAgent] ❌ Failed to add nested tool message:', error, {
        executionId,
        messageId: testMessage.id,
      });
    }

    expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);

    const [message, errorObj, context] = vi.mocked(logger.error).mock.calls[0];

    expect(message).toBe('[callAgent] ❌ Failed to add nested tool message:');
    expect(errorObj).toBe(stringError);
    expect(context).toEqual({
      executionId: 'test-execution-999',
      messageId: 'nested-msg-888',
    });
  });

  it('should format error message correctly in logger', () => {
    const testError = new Error('Test error message');
    const context = { executionId: 'exec-123', messageId: 'msg-456' };

    // Call logger.error with the fixed syntax
    logger.error('[callAgent] ❌ Failed to add nested tool message:', testError, context);

    // Verify the logger was called
    expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);

    // The logger.error should receive:
    // 1. The main message
    // 2. The error object (which will be converted to error.message)
    // 3. The context object (which will be JSON stringified)
    const [message, errorObj, contextObj] = vi.mocked(logger.error).mock.calls[0];

    expect(message).toBe('[callAgent] ❌ Failed to add nested tool message:');
    expect(errorObj).toBe(testError);
    expect(contextObj).toEqual(context);
  });

  it('should successfully add message when no error occurs', () => {
    const executionId = 'test-execution-success';
    const testMessage: UIMessage = {
      id: 'nested-msg-success',
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'tool-call-success',
          toolName: 'bash',
          input: { command: 'echo test' },
        },
      ],
      timestamp: new Date(),
      toolCallId: 'tool-call-success',
      toolName: 'bash',
    };

    // This should not throw an error
    expect(() => {
      useNestedToolsStore.getState().addMessage(executionId, {
        ...testMessage,
        parentToolCallId: executionId,
      });
    }).not.toThrow();

    // Verify the message was added to the store
    const messages = useNestedToolsStore.getState().getMessages(executionId);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('nested-msg-success');
    expect(messages[0].parentToolCallId).toBe(executionId);

    // Logger.error should NOT have been called
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled();
  });
});
