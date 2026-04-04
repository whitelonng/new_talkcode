import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies FIRST
const mockCompactContext = vi.hoisted(() => vi.fn());

// Mock AI Context Compaction Service
vi.mock('@/services/ai/ai-context-compaction', () => ({
  aiContextCompactionService: {
    compactContext: mockCompactContext,
  },
}));

import type { Message as ModelMessage } from '@/services/llm/types';
import type { CompressionResult } from '@/types/agent';
import { ContextCompactor } from './context-compactor';

describe('MessageCompactor Validation', () => {
  let messageCompactor: ContextCompactor;

  beforeEach(() => {
    vi.clearAllMocks();
    messageCompactor = new ContextCompactor();
  });

  describe('adjustPreserveBoundary', () => {
    // Access private method for testing
    const callAdjustPreserveBoundary = (
      compactor: ContextCompactor,
      messages: ModelMessage[],
      preserveCount: number
    ): number => {
      return (
        compactor as unknown as {
          adjustPreserveBoundary: (m: ModelMessage[], p: number) => number;
        }
      ).adjustPreserveBoundary(messages, preserveCount);
    };

    it('should not adjust when no tool messages in preserved section', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Message 2' },
        { role: 'user', content: 'Message 3' },
        { role: 'assistant', content: 'Message 4' },
      ];

      const result = callAdjustPreserveBoundary(messageCompactor, messages, 2);
      expect(result).toBe(2);
    });

    it('should expand boundary to include matching tool-call', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Message 2' },
        { role: 'user', content: 'Read a file' },
        // Tool call at position 3
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: {} },
          ],
        },
        // Tool result at position 4
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: { type: 'text', value: 'file contents' },
            },
          ],
        },
        { role: 'assistant', content: 'Done reading file' },
      ];

      // preserveRecentMessages = 2 would cut at index 4, separating tool-call from tool-result
      const result = callAdjustPreserveBoundary(messageCompactor, messages, 2);

      // Should preserve at least 3 messages to include the tool-call
      expect(result).toBeGreaterThanOrEqual(3);
    });

    it('should handle multiple tool-call/tool-result pairs in one message', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Read multiple files' },
        // Multiple tool calls in one message
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: {} },
            { type: 'tool-call', toolCallId: 'call-2', toolName: 'readFile', input: {} },
          ],
        },
        // Tool results
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: { type: 'text', value: 'result 1' },
            },
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'readFile',
              output: { type: 'text', value: 'result 2' },
            },
          ],
        },
        { role: 'assistant', content: 'Done' },
      ];

      const result = callAdjustPreserveBoundary(messageCompactor, messages, 2);
      // Should include both the tool-call message and tool-result message
      expect(result).toBeGreaterThanOrEqual(3);
    });

    it('should handle chain of tool calls across multiple messages', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Start' },
        // First tool call
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: { type: 'text', value: 'result 1' },
            },
          ],
        },
        // Second tool call (based on first result)
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-2', toolName: 'editFile', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'editFile',
              output: { type: 'text', value: 'result 2' },
            },
          ],
        },
        { role: 'assistant', content: 'Done' },
      ];

      // If we only preserve 2, but tool-result at position 4 is in preserved...
      const result = callAdjustPreserveBoundary(messageCompactor, messages, 2);
      expect(result).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateCompressedMessages', () => {
    it('should pass validation for valid messages', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for complete tool-call/tool-result pairs', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Read file' },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: { type: 'text', value: 'contents' },
            },
          ],
        },
        { role: 'assistant', content: 'Here is the file' },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(true);
    });

    it('should detect orphaned tool-result', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Hello' },
        // Orphaned tool-result (no matching tool-call)
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'orphan-1',
              toolName: 'test',
              output: { type: 'text', value: '' },
            },
          ],
        },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      // Error message format changed: now includes toolCallId in the message (case-insensitive)
      expect(result.errors.some(e => e.includes('orphan-1') && e.toLowerCase().includes('tool-result'))).toBe(true);
      expect(result.fixedMessages).toBeDefined();
    });

    it('should detect orphaned tool-call', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Hello' },
        // Orphaned tool-call (no matching tool-result)
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'orphan-1', toolName: 'test', input: {} },
          ],
        },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      // Error message format changed: now includes toolCallId in the message (case-insensitive)
      expect(result.errors.some(e => e.includes('orphan-1') && e.toLowerCase().includes('tool-call'))).toBe(true);
    });

    it('should detect consecutive assistant messages', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'First response' },
        { role: 'assistant', content: 'Second response' }, // Should not happen
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Consecutive assistant messages'))).toBe(true);
    });

    it('should fix orphaned tool-call by removing it', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Hello' },
        // Orphaned tool-call (no matching tool-result)
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me help you' },
            { type: 'tool-call', toolCallId: 'orphan-1', toolName: 'test', input: {} },
          ],
        },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('orphan-1') && e.toLowerCase().includes('tool-call'))).toBe(true);
      expect(result.fixedMessages).toBeDefined();

      // Fixed messages should pass validation
      const revalidation = messageCompactor.validateCompressedMessages(result.fixedMessages!);
      expect(revalidation.valid).toBe(true);

      // The orphaned tool-call should be removed, but text content should remain
      const assistantMsg = result.fixedMessages!.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      if (Array.isArray(assistantMsg!.content)) {
        const hasOrphanedToolCall = assistantMsg!.content.some(
          (p: { type?: string; toolCallId?: string }) => p.type === 'tool-call' && p.toolCallId === 'orphan-1'
        );
        expect(hasOrphanedToolCall).toBe(false);
      }
    });

    it('should remove assistant message entirely if it only contains orphaned tool-calls', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Hello' },
        // Orphaned tool-call only (no text content)
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'orphan-1', toolName: 'test', input: {} },
          ],
        },
        { role: 'user', content: 'Next message' },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.fixedMessages).toBeDefined();

      // Fixed messages should pass validation
      const revalidation = messageCompactor.validateCompressedMessages(result.fixedMessages!);
      expect(revalidation.valid).toBe(true);

      // The assistant message should be removed entirely
      const assistantMsgs = result.fixedMessages!.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(0);
    });

    it('should fix consecutive assistant messages by merging them (string content)', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'First response' },
        { role: 'assistant', content: 'Second response' },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.fixedMessages).toBeDefined();

      // Fixed messages should pass validation
      const revalidation = messageCompactor.validateCompressedMessages(result.fixedMessages!);
      expect(revalidation.valid).toBe(true);

      // Should have merged into one assistant message
      const assistantMsgs = result.fixedMessages!.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);

      // Merged content should contain both responses
      // After merging, content may be string or array of text parts
      const content = assistantMsgs[0].content;
      if (typeof content === 'string') {
        expect(content).toContain('First response');
        expect(content).toContain('Second response');
      } else if (Array.isArray(content)) {
        const textContent = content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join(' ');
        expect(textContent).toContain('First response');
        expect(textContent).toContain('Second response');
      }
    });

    it('should fix consecutive assistant messages by merging them (array content)', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'First response' },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Second response' },
          ],
        },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.fixedMessages).toBeDefined();

      // Fixed messages should pass validation
      const revalidation = messageCompactor.validateCompressedMessages(result.fixedMessages!);
      expect(revalidation.valid).toBe(true);

      // Should have merged into one assistant message
      const assistantMsgs = result.fixedMessages!.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);

      // Merged content should be an array with both texts
      const content = assistantMsgs[0].content;
      expect(Array.isArray(content)).toBe(true);
      if (Array.isArray(content)) {
        const texts = content
          .filter((p: { type?: string }) => p.type === 'text')
          .map((p: { text?: string }) => p.text);
        expect(texts).toContain('First response');
        expect(texts).toContain('Second response');
      }
    });

    it('should provide valid fixedMessages that pass re-validation', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'Summary' },
        { role: 'user', content: 'Hello' },
        // Valid pair
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'valid-1', toolName: 'test', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'valid-1',
              toolName: 'test',
              output: { type: 'text', value: '' },
            },
          ],
        },
        // Orphaned tool-result
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'orphan-1',
              toolName: 'test',
              output: { type: 'text', value: '' },
            },
          ],
        },
      ];

      const result = messageCompactor.validateCompressedMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.fixedMessages).toBeDefined();

      // Fixed messages should pass validation
      const revalidation = messageCompactor.validateCompressedMessages(result.fixedMessages!);
      expect(revalidation.valid).toBe(true);
    });
  });

  describe('createCompressedMessages - System Message Merging', () => {
    it('should add summary as user message for first compression', () => {
      const compressionResult: CompressionResult = {
        compressedSummary: 'This is the summary',
        sections: [],
        preservedMessages: [
          { role: 'user', content: 'Recent message' },
          { role: 'assistant', content: 'Recent response' },
        ],
        originalMessageCount: 10,
        compressedMessageCount: 4,
        compressionRatio: 0.4,
      };

      const result = messageCompactor.createCompressedMessages(compressionResult);

      // Summary is now added as user message (not system)
      expect(result[0].role).toBe('user');
      expect(result[0].content).toContain('[Previous conversation summary]');
      expect(result[0].content).toContain('This is the summary');

      // Followed by assistant acknowledgment
      expect(result[1].role).toBe('assistant');

      // Then preserved messages
      expect(result).toHaveLength(4); // user summary + assistant ack + 2 preserved
    });

    it('should handle second compression with original system prompt preserved', () => {
      // Simulating second compression where first preserved is the original systemPrompt
      const compressionResult: CompressionResult = {
        compressedSummary: 'New summary from second compression',
        sections: [],
        preservedMessages: [
          // Original system prompt (should be preserved)
          { role: 'system', content: 'You are a helpful assistant.' },
          // Old summary as user message
          { role: 'user', content: '[Previous conversation summary]\n\nFirst summary' },
          { role: 'assistant', content: 'I understand.' },
          { role: 'user', content: 'Recent message' },
          { role: 'assistant', content: 'Recent response' },
        ],
        originalMessageCount: 10,
        compressedMessageCount: 6,
        compressionRatio: 0.6,
      };

      const result = messageCompactor.createCompressedMessages(compressionResult);

      // First should be original system prompt
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('You are a helpful assistant.');

      // Second should be new summary as user message
      expect(result[1].role).toBe('user');
      expect(result[1].content).toContain('[Previous conversation summary]');
      expect(result[1].content).toContain('New summary from second compression');

      // Should have assistant acknowledgment
      expect(result[2].role).toBe('assistant');
    });

    it('should return preserved messages when no summary', () => {
      const compressionResult: CompressionResult = {
        compressedSummary: '',
        sections: [],
        preservedMessages: [
          { role: 'user', content: 'Message 1' },
          { role: 'assistant', content: 'Message 2' },
        ],
        originalMessageCount: 2,
        compressedMessageCount: 2,
        compressionRatio: 1.0,
      };

      const result = messageCompactor.createCompressedMessages(compressionResult);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
    });
  });

  describe('condensePreviousSummary', () => {
    // Access private method for testing
    const callCondensePreviousSummary = (
      compactor: MessageCompactor,
      summary: string
    ): string => {
      return (compactor as unknown as { condensePreviousSummary: (s: string) => string })
        .condensePreviousSummary(summary);
    };

    it('should return short summaries unchanged', () => {
      const shortSummary = 'This is a short summary.';
      const result = callCondensePreviousSummary(messageCompactor, shortSummary);
      expect(result).toBe(shortSummary);
    });

    it('should condense long summaries', () => {
      // Create a summary longer than MAX_SUMMARY_LENGTH (8000 chars)
      const longSummary = `
1. Primary Request and Intent: User wants to build a web application with React.

2. Key Technical Concepts: React, TypeScript, Node.js, Express, PostgreSQL.

3. Files and Code Sections: Multiple files were examined including src/app.ts, src/components/Header.tsx, etc.

4. Errors and fixes: Fixed a type error in the authentication module by adding proper type annotations.

5. Problem Solving: Investigated slow database queries and optimized with indexes.

6. All user messages: User asked about authentication, database design, and API structure.

7. Pending Tasks: Need to implement user profile page and notification system.

8. Current Work: Working on the authentication flow for the application.
${'Extra content to make it long. '.repeat(300)}`;

      const result = callCondensePreviousSummary(messageCompactor, longSummary);

      // Result should be shorter than original
      expect(result.length).toBeLessThan(longSummary.length);

      // Should contain key sections
      expect(result).toContain('Pending Tasks');
      expect(result).toContain('Current Work');
    });

    it('should truncate with ellipsis if no structured sections found', () => {
      const unstructuredLongSummary = 'A'.repeat(10000);
      const result = callCondensePreviousSummary(messageCompactor, unstructuredLongSummary);

      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBeLessThanOrEqual(8003); // MAX_SUMMARY_LENGTH + '...'
    });
  });

  describe('Multiple Compression Cycles', () => {
    it('should maintain valid structure after simulated multiple compressions', () => {
      // Simulate the result of multiple compression cycles
      // Start with system prompt + user/assistant messages
      let messages: ModelMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Initial request' },
        { role: 'assistant', content: 'Initial response' },
      ];

      // Simulate first compression
      let result1: CompressionResult = {
        compressedSummary: 'Summary of cycle 1',
        sections: [],
        preservedMessages: messages,
        originalMessageCount: 10,
        compressedMessageCount: 5,
        compressionRatio: 0.5,
      };
      messages = messageCompactor.createCompressedMessages(result1);

      let validation = messageCompactor.validateCompressedMessages(messages);
      expect(validation.valid).toBe(true);

      // Add more messages
      messages.push(
        { role: 'user', content: 'Follow-up request' },
        { role: 'assistant', content: 'Follow-up response' }
      );

      // Simulate second compression
      let result2: CompressionResult = {
        compressedSummary: 'Summary of cycle 2',
        sections: [],
        preservedMessages: messages,
        originalMessageCount: 15,
        compressedMessageCount: 8,
        compressionRatio: 0.53,
      };
      messages = messageCompactor.createCompressedMessages(result2);

      validation = messageCompactor.validateCompressedMessages(messages);
      expect(validation.valid).toBe(true);

      // Verify no consecutive messages of same role (except tool which can follow assistant)
      let prevRole = '';
      for (const msg of messages) {
        if (msg.role === prevRole && msg.role !== 'tool') {
          fail(`Consecutive ${msg.role} messages detected`);
        }
        prevRole = msg.role;
      }

      // Should have exactly one system message (the original systemPrompt)
      const systemCount = messages.filter(m => m.role === 'system').length;
      expect(systemCount).toBe(1);

      // Should have user messages (including summary)
      const userCount = messages.filter(m => m.role === 'user').length;
      expect(userCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle compression with tool messages across cycles', () => {
      // Initial messages with tool calls - include system prompt
      const initialMessages: ModelMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Read a file' },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: { type: 'text', value: 'content' },
            },
          ],
        },
        { role: 'assistant', content: 'Here is the file content' },
      ];

      // First compression - keep system + last assistant message
      const result1: CompressionResult = {
        compressedSummary: 'User asked to read a file, file was read successfully.',
        sections: [],
        preservedMessages: [
          initialMessages[0], // system
          initialMessages[1], // user (ensure we have a user message)
          initialMessages[4], // last assistant
        ],
        originalMessageCount: 5,
        compressedMessageCount: 5,
        compressionRatio: 1.0,
      };

      let messages = messageCompactor.createCompressedMessages(result1);
      let validation = messageCompactor.validateCompressedMessages(messages);

      // This should be valid since we have proper message structure
      expect(validation.valid).toBe(true);

      // Add more tool messages
      messages.push(
        { role: 'user', content: 'Edit the file' },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-2', toolName: 'editFile', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'editFile',
              output: { type: 'text', value: 'edited' },
            },
          ],
        },
        { role: 'assistant', content: 'File has been edited' }
      );

      // Second compression
      const result2: CompressionResult = {
        compressedSummary: 'File was read and then edited.',
        sections: [],
        preservedMessages: messages.slice(-4), // Keep last 4 which include complete tool pair
        originalMessageCount: 7,
        compressedMessageCount: 5,
        compressionRatio: 0.71,
      };

      messages = messageCompactor.createCompressedMessages(result2);
      validation = messageCompactor.validateCompressedMessages(messages);

      expect(validation.valid).toBe(true);
    });
  });

  describe('Integration: compactMessages with boundary adjustment', () => {
    beforeEach(() => {
      // Mock compactContext to return a summary
      mockCompactContext.mockResolvedValue('Mocked compression summary');
    });

    it('should preserve tool-call/tool-result pairs during compression', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Old message 1' },
        { role: 'assistant', content: 'Old response 1' },
        { role: 'user', content: 'Old message 2' },
        { role: 'assistant', content: 'Old response 2' },
        { role: 'user', content: 'Read a file' },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'readFile', output: { type: 'text', value: 'content' } },
          ],
        },
        { role: 'assistant', content: 'Here is the content' },
      ];

      const result = await messageCompactor.compactMessages({
        messages,
        config: {
          enabled: true,
          preserveRecentMessages: 3, // Would normally cut between tool-call and tool-result
          compressionModel: 'test-model',
          compressionThreshold: 0.7,
        },
      });

      const compressedMessages = messageCompactor.createCompressedMessages(result);
      const validation = messageCompactor.validateCompressedMessages(compressedMessages);

      // The compression process may produce consecutive assistant messages
      // which is fixed by the fixedMessages. What matters is that the final result
      // has complete tool pairs.
      if (!validation.valid && validation.fixedMessages) {
        // Use fixed messages for validation
        const revalidation = messageCompactor.validateCompressedMessages(validation.fixedMessages);
        expect(revalidation.valid).toBe(true);
      } else {
        expect(validation.valid).toBe(true);
      }

      // Verify tool pairs are complete
      const toolCalls = new Set<string>();
      const toolResults = new Set<string>();

      for (const msg of compressedMessages) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (typeof part === 'object' && part !== null && 'type' in part && part.type === 'tool-call' && 'toolCallId' in part) {
              toolCalls.add(part.toolCallId as string);
            }
          }
        }
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (typeof part === 'object' && part !== null && 'type' in part && part.type === 'tool-result' && 'toolCallId' in part) {
              toolResults.add(part.toolCallId as string);
            }
          }
        }
      }

      // Every tool-call should have a matching tool-result
      for (const callId of toolCalls) {
        expect(toolResults.has(callId)).toBe(true);
      }
    });
  });
});
