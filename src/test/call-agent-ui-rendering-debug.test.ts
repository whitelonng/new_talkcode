import { describe, expect, it } from 'vitest';
import type { UIMessage } from '@/types/agent';

/**
 * Debug test to understand why CallAgentToolDoing doesn't render
 *
 * This test simulates the exact flow that should happen when callAgent is called:
 * 1. tool-executor creates a tool-call message for callAgent
 * 2. onToolMessage callback receives the message
 * 3. chat-box handleToolMessage processes it
 * 4. message is added to UI
 * 5. message-item renders CallAgentToolDoing
 */
describe('CallAgent UI Rendering Debug', () => {
  it('should trace the complete message flow for callAgent tool-call', () => {
    const messages: UIMessage[] = [];

    // Simulate the onToolMessage callback from chat-box.tsx
    const handleToolMessage = (message: UIMessage) => {
      console.log('[TEST] Tool message received:', {
        id: message.id,
        role: message.role,
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        parentToolCallId: message.parentToolCallId,
      });

      // This simulates chat-box.tsx line 102-113
      if (message.parentToolCallId) {
        console.log('[TEST] 🔗 Nested tool message detected - would update parent');
        return; // Don't add nested messages as separate messages
      }

      // This simulates chat-box.tsx line 119-124
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        const toolCallContent = message.content.find((item: any) => item.type === 'tool-call');
        if (toolCallContent) {
          console.log('[TEST] ✅ Adding tool-call message to UI:', message.toolName);
          messages.push(message);
        }
      }
    };

    // Simulate what tool-executor.ts line 212-227 creates for callAgent
    const callAgentToolCallMessage: UIMessage = {
      id: 'call_test_callAgent_123',
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_test_callAgent_123',
          toolName: 'callAgent',
          input: {
            agentId: 'test-agent',
            task: 'test task',
            context: 'test context',
            _toolCallId: 'call_test_callAgent_123', // Added by our fix
          },
        },
      ],
      timestamp: new Date(),
      toolCallId: 'call_test_callAgent_123',
      toolName: 'callAgent',
      nestedTools: [],
    };

    console.log('\n=== Simulating callAgent tool-call message flow ===');
    handleToolMessage(callAgentToolCallMessage);

    // Verify message was added
    expect(messages).toHaveLength(1);
    expect(messages[0].toolName).toBe('callAgent');
    expect(messages[0].toolCallId).toBe('call_test_callAgent_123');

    // Verify the message content includes _toolCallId
    const content = messages[0].content;
    const toolCallContent = Array.isArray(content)
      ? content.find((item: any) => item.type === 'tool-call')
      : undefined;
    expect(toolCallContent).toBeDefined();
    expect((toolCallContent as any).input._toolCallId).toBe('call_test_callAgent_123');

    console.log('\n=== Message successfully added to UI ===');
    console.log('Message count:', messages.length);
    console.log('Tool name:', messages[0].toolName);
    console.log('Has _toolCallId:', !!(toolCallContent as any).input._toolCallId);
  });

  it('should show the difference when parentToolCallId is present (nested tool)', () => {
    const messages: UIMessage[] = [];

    const handleToolMessage = (message: UIMessage) => {
      console.log('[TEST] Tool message received:', message.toolName, {
        hasParentToolCallId: !!message.parentToolCallId,
      });

      if (message.parentToolCallId) {
        console.log('[TEST] ❌ Skipped - nested tool message');
        return;
      }

      if (message.role === 'assistant' && Array.isArray(message.content)) {
        const toolCallContent = message.content.find((item: any) => item.type === 'tool-call');
        if (toolCallContent) {
          console.log('[TEST] ✅ Added to UI');
          messages.push(message);
        }
      }
    };

    // Message WITHOUT parentToolCallId (should be added)
    const regularMessage: UIMessage = {
      id: 'call_regular',
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: 'call_regular', toolName: 'bash', input: {} }],
      timestamp: new Date(),
      toolCallId: 'call_regular',
      toolName: 'bash',
      nestedTools: [],
    };

    // Message WITH parentToolCallId (should be skipped)
    const nestedMessage: UIMessage = {
      id: 'call_nested',
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'call_nested', toolName: 'codeSearch', input: {} },
      ],
      timestamp: new Date(),
      toolCallId: 'call_nested',
      toolName: 'codeSearch',
      nestedTools: [],
      parentToolCallId: 'call_parent_123', // This makes it nested
    };

    console.log('\n=== Testing regular vs nested message handling ===');
    handleToolMessage(regularMessage);
    handleToolMessage(nestedMessage);

    // Only regular message should be added
    expect(messages).toHaveLength(1);
    expect(messages[0].toolName).toBe('bash');

    console.log('\n=== Results ===');
    console.log('Messages added:', messages.length);
    console.log('Expected: 1 (only regular message, nested is skipped)');
  });
});
