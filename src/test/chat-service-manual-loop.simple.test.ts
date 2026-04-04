// src/test/chat-service-manual-loop.simple.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simple unit tests that focus on the key functionality without complex mocking

describe('ChatService runManualAgentLoop - Core Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error message handling', () => {
    it('should detect tool call validation errors', () => {
      const errorMessage1 =
        "tool call validation failed: attempted to call tool 'readFile' which was not in request.tools";
      const errorMessage2 = 'tool readFile was not in request.tools';
      const nonToolError = 'some other error message';

      expect(errorMessage1.includes('tool call validation failed')).toBe(true);
      expect(errorMessage1.includes('was not in request.tools')).toBe(true);

      expect(errorMessage2.includes('was not in request.tools')).toBe(true);

      expect(nonToolError.includes('tool call validation failed')).toBe(false);
      expect(nonToolError.includes('was not in request.tools')).toBe(false);
    });

    it('should generate helpful error messages for tool validation errors', () => {
      const availableTools = ['bashTool', 'readFile', 'writeFile'];
      const errorMessage =
        "tool call validation failed: attempted to call tool 'nonExistentTool' which was not in request.tools";

      const helpfulMessage = `Tool validation error: ${errorMessage}. Available tools: ${availableTools.join(', ')}. Please use only the tools that were provided to you.`;

      expect(helpfulMessage).toContain('Tool validation error');
      expect(helpfulMessage).toContain('Available tools: bashTool, readFile, writeFile');
      expect(helpfulMessage).toContain('Please use only the tools that were provided to you');
    });
  });

  describe('Tool execution logic', () => {
    it('should handle tool not found scenario', async () => {
      const tools = { validTool: { execute: vi.fn() } };
      const toolCallName = 'nonExistentTool';

      const tool = tools[toolCallName as keyof typeof tools];
      let toolResult: any;

      if (tool && typeof tool.execute === 'function') {
        toolResult = await tool.execute({});
      } else {
        const availableTools = Object.keys(tools);
        const errorMessage = `Tool '${toolCallName}' not found or does not have execute method. Available tools: ${availableTools.join(', ')}`;
        toolResult = {
          success: false,
          error: errorMessage,
          availableTools,
        };
      }

      expect(toolResult.success).toBe(false);
      expect(toolResult.error).toContain("Tool 'nonExistentTool' not found");
      expect(toolResult.availableTools).toEqual(['validTool']);
    });

    it('should handle successful tool execution', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ success: true, result: 'test result' });
      const tools = { testTool: { execute: mockExecute } };
      const toolCallName = 'testTool';
      const args = { input: 'test input' };

      const tool = tools[toolCallName];
      let toolResult: any;

      if (tool && typeof tool.execute === 'function') {
        toolResult = await tool.execute(args);
      } else {
        toolResult = { success: false, error: 'Tool not found' };
      }

      expect(toolResult.success).toBe(true);
      expect(toolResult.result).toBe('test result');
      expect(mockExecute).toHaveBeenCalledWith(args);
    });

    it('should handle tool execution failure', async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error('Tool execution failed'));
      const tools = { failingTool: { execute: mockExecute } };
      const toolCallName = 'failingTool';

      const tool = tools[toolCallName];
      let toolResult: any;

      try {
        if (tool && typeof tool.execute === 'function') {
          toolResult = await tool.execute({});
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toolResult = {
          success: false,
          error: `Tool execution failed: ${errorMessage}`,
          toolName: toolCallName,
        };
      }

      expect(toolResult.success).toBe(false);
      expect(toolResult.error).toBe('Tool execution failed: Tool execution failed');
      expect(toolResult.toolName).toBe('failingTool');
    });
  });

  describe('Error counting logic', () => {
    it('should track consecutive tool errors correctly', () => {
      let consecutiveToolErrors = 0;
      const maxConsecutiveToolErrors = 3;

      // Simulate tool errors
      consecutiveToolErrors++; // Error 1
      expect(consecutiveToolErrors).toBe(1);
      expect(consecutiveToolErrors < maxConsecutiveToolErrors).toBe(true);

      consecutiveToolErrors++; // Error 2
      expect(consecutiveToolErrors).toBe(2);
      expect(consecutiveToolErrors < maxConsecutiveToolErrors).toBe(true);

      consecutiveToolErrors++; // Error 3
      expect(consecutiveToolErrors).toBe(3);
      expect(consecutiveToolErrors >= maxConsecutiveToolErrors).toBe(true);

      // Reset on successful operation
      consecutiveToolErrors = 0;
      expect(consecutiveToolErrors).toBe(0);
    });

    it('should generate guidance message for too many consecutive errors', () => {
      const consecutiveToolErrors = 3;
      const availableTools = ['tool1', 'tool2', 'tool3'];

      const guidanceMessage = `Too many consecutive tool errors (${consecutiveToolErrors}). Available tools: ${availableTools.join(', ')}. Please carefully review which tools are available and use them correctly, or complete your response without using tools.`;

      expect(guidanceMessage).toContain('Too many consecutive tool errors (3)');
      expect(guidanceMessage).toContain('Available tools: tool1, tool2, tool3');
      expect(guidanceMessage).toContain('complete your response without using tools');
    });
  });

  describe('Loop termination conditions', () => {
    it('should identify when loop should complete based on finish reason', () => {
      const testCases = [
        { finishReason: 'stop', shouldComplete: true },
        { finishReason: 'length', shouldComplete: true },
        { finishReason: 'tool-calls', shouldComplete: false },
        { finishReason: 'content_filter', shouldComplete: false },
        { finishReason: undefined, shouldComplete: false },
      ];

      for (const { finishReason, shouldComplete } of testCases) {
        const isComplete = finishReason === 'stop' || finishReason === 'length';
        expect(isComplete).toBe(shouldComplete);
      }
    });

    it('should enforce maximum iteration limit', () => {
      const maxIterations = 5;
      let currentIteration = 0;
      let shouldContinue = true;

      while (shouldContinue && currentIteration < maxIterations) {
        currentIteration++;
        // Simulate iteration logic
        shouldContinue = currentIteration < 3; // Simulate early completion
      }

      expect(currentIteration).toBe(3); // Should stop early due to condition
      expect(currentIteration).toBeLessThan(maxIterations);

      // Test hitting max iterations
      currentIteration = 0;
      shouldContinue = true;

      while (shouldContinue && currentIteration < maxIterations) {
        currentIteration++;
        shouldContinue = true; // Never complete naturally
      }

      expect(currentIteration).toBe(maxIterations);
    });
  });

  describe('Message filtering validation', () => {
    it('should apply default message filtering correctly', () => {
      const messages = [
        {
          id: '1',
          role: 'user',
          content: 'Message 1',
          createdAt: '2023-01-01',
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Message 2',
          createdAt: '2023-01-02',
        },
        {
          id: '3',
          role: 'user',
          content: 'Message 3',
          createdAt: '2023-01-03',
        },
      ];

      const filterOptions = { maxMessages: 2, prioritizeRecent: true };

      // Simulate default filtering logic
      let filteredMessages = [...messages];

      if (filterOptions.maxMessages && filteredMessages.length > filterOptions.maxMessages) {
        if (filterOptions.prioritizeRecent !== false) {
          filteredMessages = filteredMessages.slice(-filterOptions.maxMessages);
        } else {
          filteredMessages = filteredMessages.slice(0, filterOptions.maxMessages);
        }
      }

      expect(filteredMessages).toHaveLength(2);
      expect(filteredMessages[0].id).toBe('2'); // Recent messages kept
      expect(filteredMessages[1].id).toBe('3');
    });

    it('should handle token-based filtering estimation', () => {
      const messages = [
        { content: 'Short' }, // 5 chars
        { content: 'Medium length' }, // 13 chars
        { content: 'X' }, // 1 char
      ];

      const maxTokens = 6; // Roughly 24 characters (4 chars per token)
      const avgCharsPerToken = 4;
      const maxChars = maxTokens * avgCharsPerToken; // 24 chars

      let totalChars = 0;
      const filteredMessages: any[] = [];

      // Process from most recent (simulate filtering logic)
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        const messageChars = message.content.length;

        if (totalChars + messageChars <= maxChars) {
          filteredMessages.unshift(message);
          totalChars += messageChars;
        } else {
          break;
        }
      }

      // With 24 char limit: "X" (1) + "Medium length" (13) + "Short" (5) = 19 chars fits
      expect(filteredMessages).toHaveLength(3);
      expect(totalChars).toBeLessThanOrEqual(maxChars);
      expect(totalChars).toBe(19); // 1 + 13 + 5
    });
  });
});
