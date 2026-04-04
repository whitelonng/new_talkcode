import type { Message as ModelMessage } from '@/services/llm/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextFilter } from './context-filter';

// Helper to create a tool-call message
function createToolCallMessage(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
): ModelMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId,
        toolName,
        input,
      },
    ],
  };
}

// Helper to create a tool-result message
function createToolResultMessage(
  toolCallId: string,
  toolName: string,
  output: string
): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName,
        output: { type: 'text', value: output },
      },
    ],
  };
}

// Helper to create a readFile tool-call/result pair
function createReadFilePair(
  callId: string,
  filePath: string,
  options?: { start_line?: number; line_count?: number }
): [ModelMessage, ModelMessage] {
  return [
    createToolCallMessage(callId, 'readFile', { file_path: filePath, ...options }),
    createToolResultMessage(callId, 'readFile', `Content of ${filePath}`),
  ];
}

describe('MessageFilter', () => {
  let messageFilter: ContextFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    messageFilter = new ContextFilter();
  });

  describe('filterMessages', () => {
    it('should return empty array for empty input', () => {
      const result = messageFilter.filterMessages([]);
      expect(result).toEqual([]);
    });

    it('should return messages unchanged when nothing to filter', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        createToolCallMessage('call-1', 'readFile', { file_path: '/file1.ts' }),
        createToolResultMessage('call-1', 'readFile', 'content'),
        { role: 'assistant', content: 'Done' },
      ];

      const result = messageFilter.filterMessages(messages);
      expect(result).toEqual(messages);
    });

    it('should filter duplicate file reads and their corresponding tool-results', () => {
      const [call1, result1] = createReadFilePair('call-1', '/file.ts');
      const [call2, result2] = createReadFilePair('call-2', '/file.ts');

      const messages: ModelMessage[] = [call1, result1, call2, result2];

      const result = messageFilter.filterMessages(messages);

      // Should keep only the second pair (most recent)
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(call2);
      expect(result[1]).toEqual(result2);
    });

    it('should filter tool-call and tool-result together for exploratory tools', () => {
      // Create 25 messages to exceed protection window (20)
      const messages: ModelMessage[] = [];

      // Add an exploratory tool at the beginning (outside protection window)
      messages.push(createToolCallMessage('call-glob', 'glob', { pattern: '*.ts' }));
      messages.push(createToolResultMessage('call-glob', 'glob', 'file1.ts\nfile2.ts'));

      // Add filler messages to push glob outside protection window
      for (let i = 0; i < 23; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      const result = messageFilter.filterMessages(messages);

      // The glob tool-call and tool-result should be filtered
      expect(result.length).toBe(23);
      expect(result.every((m) => m.role === 'user')).toBe(true);
    });

    it('should preserve exploratory tools within protection window', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        createToolCallMessage('call-glob', 'glob', { pattern: '*.ts' }),
        createToolResultMessage('call-glob', 'glob', 'file1.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // All messages should be preserved (within protection window)
      expect(result.length).toBe(3);
    });
  });

  describe('filterDuplicateFileReads', () => {
    it('should not filter file reads with different line ranges', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts', { start_line: 100, line_count: 50 }),
        ...createReadFilePair('call-2', '/file.ts', { start_line: 150, line_count: 100 }),
      ];

      const filtered = messageFilter.filterDuplicateFileReads(messages);

      // Both reads should be preserved since they have different line ranges
      expect(filtered.length).toBe(4);
      expect(filtered).toEqual(messages);
    });

    it('should filter truly duplicate file reads (same file, same line range)', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts', { start_line: 100, line_count: 50 }),
        ...createReadFilePair('call-2', '/file.ts', { start_line: 100, line_count: 50 }),
      ];

      const filtered = messageFilter.filterDuplicateFileReads(messages);

      // Only the second read should be kept (first read is removed)
      expect(filtered.length).toBe(2);
      // Verify it's the second pair
      const toolCall = filtered[0];
      expect(toolCall.role).toBe('assistant');
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-2');
        }
      }
    });

    it('should filter duplicate full file reads (no line range specified)', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts'),
        ...createReadFilePair('call-2', '/file.ts'),
      ];

      const filtered = messageFilter.filterDuplicateFileReads(messages);

      // Only the second read should be kept
      expect(filtered.length).toBe(2);
    });

    it('should not filter full file read vs partial file read as duplicates', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts'),
        ...createReadFilePair('call-2', '/file.ts', { start_line: 100, line_count: 50 }),
      ];

      const filtered = messageFilter.filterDuplicateFileReads(messages);

      // Both reads should be preserved
      expect(filtered.length).toBe(4);
      expect(filtered).toEqual(messages);
    });
  });

  describe('tool-call and tool-result pairing', () => {
    it('should filter both tool-call and tool-result when filtering duplicates', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts'),
        { role: 'user', content: 'What is in the file?' },
        ...createReadFilePair('call-2', '/file.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should have: user message + second pair
      expect(result.length).toBe(3);

      // Verify no orphaned tool-results
      const toolCallIds = new Set<string>();
      const toolResultIds = new Set<string>();

      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              toolCallIds.add(part.toolCallId);
            }
          }
        }
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result') {
              toolResultIds.add(part.toolCallId);
            }
          }
        }
      }

      // Every tool-call should have a matching tool-result and vice versa
      expect(toolCallIds).toEqual(toolResultIds);
    });

    it('should handle assistant message with multiple tool-calls', () => {
      const messages: ModelMessage[] = [
        // First read of file1 and file2
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'readFile',
              input: { file_path: '/file1.ts' },
            },
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'readFile',
              input: { file_path: '/file2.ts' },
            },
          ],
        },
        createToolResultMessage('call-1', 'readFile', 'content1'),
        createToolResultMessage('call-2', 'readFile', 'content2'),
        // Second read of file1 only
        ...createReadFilePair('call-3', '/file1.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // call-1 should be filtered (duplicate of call-3)
      // call-2 should remain (file2 is unique)
      // call-3 should remain (most recent file1)
      expect(result.length).toBe(4);

      // Verify call-1 is removed but call-2 remains in first assistant message
      const firstAssistant = result[0];
      expect(firstAssistant.role).toBe('assistant');
      if (firstAssistant.role === 'assistant' && Array.isArray(firstAssistant.content)) {
        expect(firstAssistant.content.length).toBe(1);
        const part = firstAssistant.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-2');
        }
      }
    });

    it('should remove empty messages after filtering all parts', () => {
      const messages: ModelMessage[] = [
        // Single tool-call that will be filtered
        createToolCallMessage('call-1', 'readFile', { file_path: '/file.ts' }),
        createToolResultMessage('call-1', 'readFile', 'content'),
        // Duplicate that keeps
        createToolCallMessage('call-2', 'readFile', { file_path: '/file.ts' }),
        createToolResultMessage('call-2', 'readFile', 'content'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Only the second pair should remain
      expect(result.length).toBe(2);
      // No empty messages
      for (const msg of result) {
        if (Array.isArray(msg.content)) {
          expect(msg.content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('mixed content handling', () => {
    it('should discard assistant message when only text parts remain after filtering', () => {
      const messages: ModelMessage[] = [
        // Assistant message with text + tool-call
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read the file for you.' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'readFile',
              input: { file_path: '/file.ts' },
            },
          ],
        },
        createToolResultMessage('call-1', 'readFile', 'content'),
        // Duplicate read
        ...createReadFilePair('call-2', '/file.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // After filtering:
      // - First assistant message loses tool-call (duplicate), only text remains -> DISCARDED
      // - First tool-result is removed (orphaned - no matching tool-call)
      // - Second assistant message with tool-call remains
      // - Second tool-result remains
      expect(result.length).toBe(2);

      // First message should be the second assistant with tool-call
      const firstMsg = result[0];
      expect(firstMsg?.role).toBe('assistant');
      if (firstMsg?.role === 'assistant' && Array.isArray(firstMsg.content)) {
        expect(firstMsg.content[0]?.type).toBe('tool-call');
        const contentPart = firstMsg.content[0];
        if (contentPart?.type === 'tool-call') {
          expect(contentPart.toolCallId).toBe('call-2');
        }
      }

      // Second message should be the tool-result
      const secondMsg = result[1];
      expect(secondMsg?.role).toBe('tool');
    });

    it('should keep assistant message with mixed content when tool-calls remain after filtering', () => {
      const messages: ModelMessage[] = [
        // Assistant message with text + two tool-calls
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read both files.' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'readFile',
              input: { file_path: '/file1.ts' },
            },
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'readFile',
              input: { file_path: '/file2.ts' },
            },
          ],
        },
        createToolResultMessage('call-1', 'readFile', 'content1'),
        createToolResultMessage('call-2', 'readFile', 'content2'),
        // Duplicate read of file1 only
        ...createReadFilePair('call-3', '/file1.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // After filtering:
      // - First assistant message loses call-1 (duplicate), keeps text + call-2
      // - First tool-result (call-1) is removed
      // - Second tool-result (call-2) remains
      // - Third assistant (call-3) remains
      // - Third tool-result (call-3) remains
      expect(result.length).toBe(4);

      // First assistant should have text + call-2
      const firstAssistant = result[0];
      expect(firstAssistant?.role).toBe('assistant');
      if (firstAssistant?.role === 'assistant' && Array.isArray(firstAssistant.content)) {
        expect(firstAssistant.content.length).toBe(2);
        expect(firstAssistant.content[0]?.type).toBe('text');
        expect(firstAssistant.content[1]?.type).toBe('tool-call');
        const contentPart = firstAssistant.content[1];
        if (contentPart?.type === 'tool-call') {
          expect(contentPart.toolCallId).toBe('call-2');
        }
      }
    });

    it('should discard text-only assistant message when all tool-calls are filtered', () => {
      // Create 25+ messages to ensure glob is outside protection window
      const messages: ModelMessage[] = [];

      // Assistant message with text + exploratory tool
      messages.push({
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search for files.' },
          {
            type: 'tool-call',
            toolCallId: 'call-glob',
            toolName: 'glob',
            input: { pattern: '*.ts' },
          },
        ],
      });
      messages.push(createToolResultMessage('call-glob', 'glob', 'file1.ts\nfile2.ts'));

      // Add filler messages to push glob outside protection window
      for (let i = 0; i < 25; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      const result = messageFilter.filterMessages(messages);

      // The glob tool-call should be filtered, leaving only text in first assistant
      // Since only text remains, the entire assistant message should be discarded
      expect(result.length).toBe(25);
      expect(result.every((m) => m.role === 'user')).toBe(true);
    });
  });

  describe('schema validation', () => {
    it('should return valid messages that pass schema validation', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        createToolCallMessage('call-1', 'readFile', { file_path: '/file.ts' }),
        createToolResultMessage('call-1', 'readFile', 'content'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should pass validation
      expect(result).toEqual(messages);
    });

    it('should ensure no orphaned tool-calls after filtering', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts'),
        ...createReadFilePair('call-2', '/file.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Collect tool-call and tool-result IDs
      const toolCallIds = new Set<string>();
      const toolResultIds = new Set<string>();

      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              toolCallIds.add(part.toolCallId);
            }
          }
        }
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result') {
              toolResultIds.add(part.toolCallId);
            }
          }
        }
      }

      // No orphans
      expect(toolCallIds).toEqual(toolResultIds);
    });

    it('should ensure no orphaned tool-results after filtering', () => {
      // Same test as above but explicitly checking tool-results
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts'),
        { role: 'user', content: 'Middle message' },
        ...createReadFilePair('call-2', '/file.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      const toolCallIds = new Set<string>();
      const toolResultIds = new Set<string>();

      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              toolCallIds.add(part.toolCallId);
            }
          }
        }
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result') {
              if (part.type === 'tool-result') {
                toolResultIds.add(part.toolCallId);
              }
            }
          }
        }
      }

      // All tool-results should have matching tool-calls
      for (const resultId of toolResultIds) {
        expect(toolCallIds.has(resultId)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle messages with no tool-calls', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = messageFilter.filterMessages(messages);
      expect(result).toEqual(messages);
    });

    it('should handle system messages', () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        ...createReadFilePair('call-1', '/file.ts'),
      ];

      const result = messageFilter.filterMessages(messages);
      expect(result).toEqual(messages);
    });

    it('should handle multiple different files without filtering', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file1.ts'),
        ...createReadFilePair('call-2', '/file2.ts'),
        ...createReadFilePair('call-3', '/file3.ts'),
      ];

      const result = messageFilter.filterMessages(messages);
      expect(result).toEqual(messages);
    });

    it('should handle three reads of same file, keeping only the last', () => {
      const messages: ModelMessage[] = [
        ...createReadFilePair('call-1', '/file.ts'),
        ...createReadFilePair('call-2', '/file.ts'),
        ...createReadFilePair('call-3', '/file.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Only the last pair should remain
      expect(result.length).toBe(2);

      const toolCall = result[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-3');
        }
      }
    });
  });

  describe('deduplicate tools (todoWrite, exitPlanMode)', () => {
    it('should keep only the last todoWrite call when there are multiple', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-todo-1', 'todoWrite', { todos: [{ content: 'Task 1' }] }),
        createToolResultMessage('call-todo-1', 'todoWrite', 'ok'),
        { role: 'user', content: 'Continue' },
        createToolCallMessage('call-todo-2', 'todoWrite', { todos: [{ content: 'Task 2' }] }),
        createToolResultMessage('call-todo-2', 'todoWrite', 'ok'),
        { role: 'user', content: 'More work' },
        createToolCallMessage('call-todo-3', 'todoWrite', { todos: [{ content: 'Task 3' }] }),
        createToolResultMessage('call-todo-3', 'todoWrite', 'ok'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep: 2 user messages + last todoWrite pair (2 messages) = 4 messages
      expect(result.length).toBe(4);

      // Verify only the last todoWrite remains
      const toolCalls = result.filter(
        (m) => m.role === 'assistant' && Array.isArray(m.content)
      );
      expect(toolCalls.length).toBe(1);
      const toolCall = toolCalls[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-todo-3');
        }
      }
    });

    it('should keep only the last exitPlanMode call when there are multiple', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-exit-1', 'exitPlanMode', {}),
        createToolResultMessage('call-exit-1', 'exitPlanMode', 'exited'),
        { role: 'user', content: 'Re-enter plan mode' },
        createToolCallMessage('call-exit-2', 'exitPlanMode', {}),
        createToolResultMessage('call-exit-2', 'exitPlanMode', 'exited'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep: 1 user message + last exitPlanMode pair (2 messages) = 3 messages
      expect(result.length).toBe(3);

      // Verify only the last exitPlanMode remains
      const toolCalls = result.filter(
        (m) => m.role === 'assistant' && Array.isArray(m.content)
      );
      expect(toolCalls.length).toBe(1);
      const toolCall = toolCalls[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-exit-2');
        }
      }
    });

    it('should deduplicate todoWrite and exitPlanMode independently', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-todo-1', 'todoWrite', { todos: [] }),
        createToolResultMessage('call-todo-1', 'todoWrite', 'ok'),
        createToolCallMessage('call-exit-1', 'exitPlanMode', {}),
        createToolResultMessage('call-exit-1', 'exitPlanMode', 'exited'),
        { role: 'user', content: 'Continue' },
        createToolCallMessage('call-todo-2', 'todoWrite', { todos: [] }),
        createToolResultMessage('call-todo-2', 'todoWrite', 'ok'),
        createToolCallMessage('call-exit-2', 'exitPlanMode', {}),
        createToolResultMessage('call-exit-2', 'exitPlanMode', 'exited'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep: 1 user + last todoWrite pair + last exitPlanMode pair = 5 messages
      expect(result.length).toBe(5);

      // Verify correct tool calls remain
      const toolCallIds = new Set<string>();
      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              toolCallIds.add(part.toolCallId);
            }
          }
        }
      }

      expect(toolCallIds.has('call-todo-2')).toBe(true);
      expect(toolCallIds.has('call-exit-2')).toBe(true);
      expect(toolCallIds.has('call-todo-1')).toBe(false);
      expect(toolCallIds.has('call-exit-1')).toBe(false);
    });

    it('should not filter single todoWrite or exitPlanMode call', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        createToolCallMessage('call-todo', 'todoWrite', { todos: [] }),
        createToolResultMessage('call-todo', 'todoWrite', 'ok'),
        createToolCallMessage('call-exit', 'exitPlanMode', {}),
        createToolResultMessage('call-exit', 'exitPlanMode', 'exited'),
      ];

      const result = messageFilter.filterMessages(messages);

      // All messages should remain
      expect(result.length).toBe(5);
    });
  });

  describe('filterExploratoryTools', () => {
    it('should filter glob tool outside protection window', () => {
      const messages: ModelMessage[] = [];

      // Add glob at the beginning
      messages.push(createToolCallMessage('call-glob', 'glob', { pattern: '*.ts' }));
      messages.push(createToolResultMessage('call-glob', 'glob', 'files'));

      // Add enough messages to push glob outside protection window
      for (let i = 0; i < 25; i++) {
        messages.push({ role: 'user', content: `msg ${i}` });
      }

      const result = messageFilter.filterExploratoryTools(messages);

      // Glob should be filtered
      expect(result.length).toBe(25);
    });

    it('should filter listFiles tool outside protection window', () => {
      const messages: ModelMessage[] = [];

      messages.push(createToolCallMessage('call-list', 'listFiles', { path: '/src' }));
      messages.push(createToolResultMessage('call-list', 'listFiles', 'files'));

      for (let i = 0; i < 25; i++) {
        messages.push({ role: 'user', content: `msg ${i}` });
      }

      const result = messageFilter.filterExploratoryTools(messages);
      expect(result.length).toBe(25);
    });

    it('should filter codeSearch tool outside protection window', () => {
      const messages: ModelMessage[] = [];

      messages.push(createToolCallMessage('call-search', 'codeSearch', { query: 'function' }));
      messages.push(createToolResultMessage('call-search', 'codeSearch', 'results'));

      for (let i = 0; i < 25; i++) {
        messages.push({ role: 'user', content: `msg ${i}` });
      }

      const result = messageFilter.filterExploratoryTools(messages);
      expect(result.length).toBe(25);
    });

    it('should not filter non-exploratory tools', () => {
      const messages: ModelMessage[] = [];

      messages.push(createToolCallMessage('call-edit', 'editFile', { file_path: '/file.ts' }));
      messages.push(createToolResultMessage('call-edit', 'editFile', 'edited'));

      for (let i = 0; i < 25; i++) {
        messages.push({ role: 'user', content: `msg ${i}` });
      }

      const result = messageFilter.filterExploratoryTools(messages);

      // editFile should NOT be filtered (not exploratory)
      expect(result.length).toBe(27);
    });
  });

  describe('exact duplicate tool calls (same name and parameters)', () => {
    it('should filter duplicate bash commands with identical parameters', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-bash-1', 'bash', {
          command: 'ls -la',
          runInBackground: false,
        }),
        createToolResultMessage('call-bash-1', 'bash', 'file1.ts\nfile2.ts'),
        { role: 'user', content: 'What files are there?' },
        createToolCallMessage('call-bash-2', 'bash', {
          command: 'ls -la',
          runInBackground: false,
        }),
        createToolResultMessage('call-bash-2', 'bash', 'file1.ts\nfile2.ts'),
        { role: 'user', content: 'Check again' },
        createToolCallMessage('call-bash-3', 'bash', {
          command: 'ls -la',
          runInBackground: false,
        }),
        createToolResultMessage('call-bash-3', 'bash', 'file1.ts\nfile2.ts'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep: 2 user messages + last bash pair (2 messages) = 4 messages
      expect(result.length).toBe(4);

      // Verify only the last bash call remains
      const toolCalls = result.filter(
        (m) => m.role === 'assistant' && Array.isArray(m.content)
      );
      expect(toolCalls.length).toBe(1);

      const toolCall = toolCalls[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-bash-3');
          expect(part.toolName).toBe('bash');
        }
      }
    });

    it('should NOT filter bash commands with different parameters', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-bash-1', 'bash', {
          command: 'ls -la',
          runInBackground: false,
        }),
        createToolResultMessage('call-bash-1', 'bash', 'output1'),
        createToolCallMessage('call-bash-2', 'bash', {
          command: 'pwd',
          runInBackground: false,
        }),
        createToolResultMessage('call-bash-2', 'bash', 'output2'),
        createToolCallMessage('call-bash-3', 'bash', {
          command: 'ls -la',
          runInBackground: true, // Different parameter
        }),
        createToolResultMessage('call-bash-3', 'bash', 'output3'),
      ];

      const result = messageFilter.filterMessages(messages);

      // All commands should remain (different parameters)
      expect(result.length).toBe(6);

      const toolCallIds = new Set<string>();
      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              toolCallIds.add(part.toolCallId);
            }
          }
        }
      }

      expect(toolCallIds.has('call-bash-1')).toBe(true);
      expect(toolCallIds.has('call-bash-2')).toBe(true);
      expect(toolCallIds.has('call-bash-3')).toBe(true);
    });

    it('should handle parameter order differences (should still be considered duplicates)', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-1', 'bash', {
          command: 'ls',
          runInBackground: false,
        }),
        createToolResultMessage('call-1', 'bash', 'output1'),
        createToolCallMessage('call-2', 'bash', {
          runInBackground: false, // Different order, same values
          command: 'ls',
        }),
        createToolResultMessage('call-2', 'bash', 'output2'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should filter duplicate (parameter order shouldn't matter)
      expect(result.length).toBe(2);

      const toolCall = result[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-2');
        }
      }
    });

    it('should filter exact duplicate editFile calls', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-edit-1', 'editFile', {
          file_path: '/file.ts',
          edits: [{ old_string: 'old', new_string: 'new' }],
        }),
        createToolResultMessage('call-edit-1', 'editFile', 'edited'),
        createToolCallMessage('call-edit-2', 'editFile', {
          file_path: '/file.ts',
          edits: [{ old_string: 'old', new_string: 'new' }],
        }),
        createToolResultMessage('call-edit-2', 'editFile', 'edited'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep only the last editFile
      expect(result.length).toBe(2);

      const toolCall = result[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-edit-2');
        }
      }
    });

    it('should NOT filter editFile calls with different edits', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-edit-1', 'editFile', {
          file_path: '/file.ts',
          edits: [{ old_string: 'old1', new_string: 'new1' }],
        }),
        createToolResultMessage('call-edit-1', 'editFile', 'edited'),
        createToolCallMessage('call-edit-2', 'editFile', {
          file_path: '/file.ts',
          edits: [{ old_string: 'old2', new_string: 'new2' }], // Different edits
        }),
        createToolResultMessage('call-edit-2', 'editFile', 'edited'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Both edits should remain (different parameters)
      expect(result.length).toBe(4);
    });

    it('should filter exact duplicates across different tool types independently', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-bash-1', 'bash', { command: 'ls' }),
        createToolResultMessage('call-bash-1', 'bash', 'output'),
        createToolCallMessage('call-edit-1', 'editFile', { file_path: '/file.ts' }),
        createToolResultMessage('call-edit-1', 'editFile', 'edited'),
        createToolCallMessage('call-bash-2', 'bash', { command: 'ls' }), // Duplicate bash
        createToolResultMessage('call-bash-2', 'bash', 'output'),
        createToolCallMessage('call-edit-2', 'editFile', { file_path: '/file.ts' }), // Duplicate edit
        createToolResultMessage('call-edit-2', 'editFile', 'edited'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep only the last of each type
      expect(result.length).toBe(4);

      const toolCallIds = new Set<string>();
      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              if (part.type === 'tool-call') {
                toolCallIds.add(part.toolCallId);
              }
            }
          }
        }
      }

      expect(toolCallIds.has('call-bash-2')).toBe(true);
      expect(toolCallIds.has('call-edit-2')).toBe(true);
      expect(toolCallIds.has('call-bash-1')).toBe(false);
      expect(toolCallIds.has('call-edit-1')).toBe(false);
    });

    it('should handle complex nested parameters when detecting duplicates', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-1', 'customTool', {
          config: {
            nested: { value: 123, array: [1, 2, 3] },
            flag: true,
          },
        }),
        createToolResultMessage('call-1', 'customTool', 'result1'),
        createToolCallMessage('call-2', 'customTool', {
          config: {
            nested: { value: 123, array: [1, 2, 3] },
            flag: true,
          },
        }),
        createToolResultMessage('call-2', 'customTool', 'result2'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should filter duplicate with nested parameters
      expect(result.length).toBe(2);

      const toolCall = result[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-2');
        }
      }
    });

    it('should work in combination with other filtering rules', () => {
      const messages: ModelMessage[] = [
        // Duplicate readFile (handled by getDuplicateFileReadIds)
        ...createReadFilePair('call-read-1', '/file.ts'),
        ...createReadFilePair('call-read-2', '/file.ts'),
        // Duplicate bash (handled by getExactDuplicateToolIds)
        createToolCallMessage('call-bash-1', 'bash', { command: 'ls' }),
        createToolResultMessage('call-bash-1', 'bash', 'output'),
        createToolCallMessage('call-bash-2', 'bash', { command: 'ls' }),
        createToolResultMessage('call-bash-2', 'bash', 'output'),
        // Multiple todoWrite (handled by getDeduplicateToolIds)
        createToolCallMessage('call-todo-1', 'todoWrite', { todos: [] }),
        createToolResultMessage('call-todo-1', 'todoWrite', 'ok'),
        createToolCallMessage('call-todo-2', 'todoWrite', { todos: [{ task: 'new' }] }),
        createToolResultMessage('call-todo-2', 'todoWrite', 'ok'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Should keep:
      // - Last readFile pair (2 messages)
      // - Last bash pair (2 messages)
      // - Last todoWrite pair (2 messages)
      // Total: 6 messages
      expect(result.length).toBe(6);

      const toolCallIds = new Set<string>();
      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              if (part.type === 'tool-call') {
                toolCallIds.add(part.toolCallId);
              }
            }
          }
        }
      }

      // Verify only the latest of each type remains
      expect(toolCallIds.has('call-read-2')).toBe(true);
      expect(toolCallIds.has('call-bash-2')).toBe(true);
      expect(toolCallIds.has('call-todo-2')).toBe(true);

      expect(toolCallIds.has('call-read-1')).toBe(false);
      expect(toolCallIds.has('call-bash-1')).toBe(false);
      expect(toolCallIds.has('call-todo-1')).toBe(false);
    });

    it('should not filter when parameters are null or undefined', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-1', 'bash', { command: 'ls', flag: null }),
        createToolResultMessage('call-1', 'bash', 'output1'),
        createToolCallMessage('call-2', 'bash', { command: 'ls', flag: undefined }),
        createToolResultMessage('call-2', 'bash', 'output2'),
      ];

      const result = messageFilter.filterMessages(messages);

      // null and undefined are different, so both should remain
      expect(result.length).toBe(4);
    });

    it('should handle empty parameters correctly', () => {
      const messages: ModelMessage[] = [
        createToolCallMessage('call-1', 'customTool', {}),
        createToolResultMessage('call-1', 'customTool', 'result1'),
        createToolCallMessage('call-2', 'customTool', {}),
        createToolResultMessage('call-2', 'customTool', 'result2'),
      ];

      const result = messageFilter.filterMessages(messages);

      // Empty parameters should still be considered duplicates
      expect(result.length).toBe(2);

      const toolCall = result[0];
      if (toolCall.role === 'assistant' && Array.isArray(toolCall.content)) {
        const part = toolCall.content[0];
        if (part?.type === 'tool-call') {
          expect(part.toolCallId).toBe('call-2');
        }
      }
    });
  });
});
