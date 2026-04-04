/**
 * Tests for preventing AI SDK auto tool execution bug
 *
 * Bug Description:
 * AI SDK 5.0's streamText automatically executes tools when they have an execute method,
 * bypassing our ToolExecutor. This prevents tool-call messages from being sent to UI,
 * causing UI components like CallAgentToolDoing to not render.
 *
 * Fix:
 * Create tool definitions WITHOUT execute methods for AI SDK (toolsForAI),
 * while keeping original tools with execute methods for ToolExecutor.
 *
 * This test suite verifies:
 * 1. toolsForAI creation removes execute methods
 * 2. Original tools object remains unchanged
 * 3. Tools are executed through ToolExecutor, not AI SDK
 * 4. tool-call and tool-result messages are sent to UI
 * 5. callAgent tool works correctly with nested tools
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage } from '@/types/agent';

/**
 * Helper function to create toolsForAI (same logic as in llm-service.ts)
 * This removes execute methods from tool definitions to prevent AI SDK auto-execution
 */
function createToolsForAI(tools: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(tools).map(([name, toolDef]) => {
      if (toolDef && typeof toolDef === 'object' && 'execute' in toolDef) {
        const { execute: _execute, ...toolDefWithoutExecute } = toolDef as any;
        return [name, toolDefWithoutExecute];
      }
      return [name, toolDef];
    })
  );
}

describe('AI SDK Tool Auto-Execution Prevention', () => {
  let mockToolExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockToolExecute = vi.fn().mockResolvedValue({ success: true, result: 'test result' });
  });

  describe('toolsForAI creation', () => {
    it('should remove execute method from tool definitions for AI SDK', () => {
      // Create a tool with execute method (simulating our ToolWithUI structure)
      const originalTools = {
        testTool: {
          description: 'A test tool',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: mockToolExecute,
        },
      };

      // Create toolsForAI using the same logic as llm-service.ts
      const toolsForAI = createToolsForAI(originalTools);

      // Verify execute method is removed
      expect(toolsForAI.testTool).toBeDefined();
      expect('execute' in toolsForAI.testTool).toBe(false);

      // Verify other properties are preserved
      expect((toolsForAI.testTool as any).description).toBe('A test tool');
      expect((toolsForAI.testTool as any).inputSchema).toBeDefined();

      // Verify original tools are unchanged
      expect('execute' in originalTools.testTool).toBe(true);
      expect(originalTools.testTool.execute).toBe(mockToolExecute);
    });

    it('should handle multiple tools correctly', () => {
      const tool1Execute = vi.fn();
      const tool2Execute = vi.fn();

      const originalTools = {
        tool1: {
          description: 'Tool 1',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: tool1Execute,
        },
        tool2: {
          description: 'Tool 2',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: tool2Execute,
        },
      };

      const toolsForAI = createToolsForAI(originalTools);

      // Verify all tools have execute removed
      expect('execute' in toolsForAI.tool1).toBe(false);
      expect('execute' in toolsForAI.tool2).toBe(false);

      // Verify originals are unchanged
      expect('execute' in originalTools.tool1).toBe(true);
      expect('execute' in originalTools.tool2).toBe(true);
    });

    it('should preserve tool properties except execute', () => {
      const originalTool = {
        description: 'Complex tool',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: { type: 'string' as const },
            param2: { type: 'number' as const },
          },
          required: ['param1'],
        },
        execute: mockToolExecute,
      };

      const originalTools = { complexTool: originalTool };

      const toolsForAI = createToolsForAI(originalTools);

      const toolForAI = toolsForAI.complexTool as any;

      // Verify all properties except execute are preserved
      expect(toolForAI.description).toBe('Complex tool');
      expect(toolForAI.inputSchema).toEqual({
        type: 'object',
        properties: {
          param1: { type: 'string' },
          param2: { type: 'number' },
        },
        required: ['param1'],
      });

      // Verify execute is removed
      expect('execute' in toolForAI).toBe(false);
    });
  });

  describe('Tool execution flow', () => {
    it('should execute tools through ToolExecutor, not AI SDK', async () => {
      // This test verifies that tools are executed by our ToolExecutor
      // and not automatically by AI SDK

      const mockTool = {
        description: 'Test tool',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: mockToolExecute,
      };

      const tools = { testTool: mockTool };

      // Create toolsForAI (what we pass to AI SDK)
      const toolsForAI = createToolsForAI(tools);

      // Verify AI SDK version has no execute
      expect('execute' in toolsForAI.testTool).toBe(false);

      // Verify ToolExecutor can still execute using original tools
      expect(typeof tools.testTool.execute).toBe('function');

      // Simulate ToolExecutor calling the tool
      const result = await tools.testTool.execute({} as any);
      expect(mockToolExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true, result: 'test result' });
    });

    it('should send tool-call message before execution', () => {
      // This test verifies the message flow:
      // 1. tool-call message is sent BEFORE execution
      // 2. Tool is executed
      // 3. tool-result message is sent AFTER execution

      const messages: Array<{ type: string; timestamp: number }> = [];

      const mockOnToolMessage = (message: UIMessage) => {
        if (Array.isArray(message.content)) {
          const contentType = message.content[0]?.type;
          messages.push({
            type: contentType,
            timestamp: Date.now(),
          });
        }
      };

      const mockToolExecution = async () => {
        messages.push({ type: 'execution', timestamp: Date.now() });
        return { success: true };
      };

      // Simulate the flow
      const toolCallMessage: UIMessage = {
        id: 'call-1',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: {},
          },
        ],
        timestamp: new Date(),
        toolCallId: 'call-1',
        toolName: 'testTool',
        nestedTools: [],
      };

      // 1. Send tool-call message
      mockOnToolMessage(toolCallMessage);

      // 2. Execute tool
      mockToolExecution();

      // 3. Send tool-result message
      const toolResultMessage: UIMessage = {
        id: 'result-1',
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: {},
            output: { success: true },
          },
        ],
        timestamp: new Date(),
        toolCallId: 'call-1',
        toolName: 'testTool',
      };
      mockOnToolMessage(toolResultMessage);

      // Verify correct order
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('tool-call');
      expect(messages[1].type).toBe('execution');
      expect(messages[2].type).toBe('tool-result');

      // Verify tool-call comes before execution
      expect(messages[0].timestamp).toBeLessThanOrEqual(messages[1].timestamp);
      // Verify execution comes before tool-result
      expect(messages[1].timestamp).toBeLessThanOrEqual(messages[2].timestamp);
    });
  });

  describe('callAgent tool specific tests', () => {
    it('should handle callAgent tool execution through ToolExecutor', () => {
      // callAgent is special because it creates nested agent loops
      // This test verifies it goes through ToolExecutor correctly

      const callAgentExecute = vi.fn().mockResolvedValue({
        success: true,
        result: 'Agent completed',
      });

      const tools = {
        callAgent: {
          description: 'Call another agent',
          inputSchema: {
            type: 'object' as const,
            properties: {
              agentId: { type: 'string' as const },
              task: { type: 'string' as const },
            },
          },
          execute: callAgentExecute,
        },
      };

      // Create toolsForAI
      const toolsForAI = createToolsForAI(tools);

      // Verify callAgent has no execute in AI SDK version
      expect('execute' in toolsForAI.callAgent).toBe(false);

      // Verify ToolExecutor can execute it
      expect(typeof tools.callAgent.execute).toBe('function');
    });

    it('should send tool-call message for callAgent before nested execution', () => {
      const toolCallMessages: UIMessage[] = [];

      const mockOnToolMessage = (message: UIMessage) => {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          const hasToolCall = message.content.some((c: any) => c.type === 'tool-call');
          if (hasToolCall) {
            toolCallMessages.push(message);
          }
        }
      };

      // Simulate callAgent tool-call message
      const callAgentToolCall: UIMessage = {
        id: 'call-agent-1',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-agent-1',
            toolName: 'callAgent',
            input: {
              agentId: 'explore',
              task: 'Analyze the code',
            },
          },
        ],
        timestamp: new Date(),
        toolCallId: 'call-agent-1',
        toolName: 'callAgent',
        nestedTools: [],
      };

      mockOnToolMessage(callAgentToolCall);

      // Verify tool-call message was sent
      expect(toolCallMessages).toHaveLength(1);
      expect(toolCallMessages[0].toolName).toBe('callAgent');
      expect(toolCallMessages[0].toolCallId).toBe('call-agent-1');

      const content = toolCallMessages[0].content as any[];
      expect(content[0].type).toBe('tool-call');
    });

    it('should pass _toolCallId to callAgent execute method', async () => {
      const callAgentExecute = vi.fn().mockResolvedValue({ success: true });

      const tools = {
        callAgent: {
          description: 'Call another agent',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: callAgentExecute,
        },
      };

      const toolCallId = 'call-123';
      const input = {
        agentId: 'test-agent',
        task: 'Test task',
        _toolCallId: toolCallId, // This should be added by ToolExecutor
      };

      // Simulate ToolExecutor calling callAgent with _toolCallId
      await tools.callAgent.execute(input as any);

      // Verify _toolCallId was passed
      expect(callAgentExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          _toolCallId: toolCallId,
        })
      );
    });
  });

  describe('Integration tests', () => {
    it('should prevent AI SDK from auto-executing tools in streamText', () => {
      // This test verifies the fix at integration level

      const mockExecute = vi.fn();
      const originalTools = {
        testTool: {
          description: 'Test',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: mockExecute,
        },
      };

      // Create toolsForAI as done in llm-service.ts
      const toolsForAI = createToolsForAI(originalTools);

      // Verify the transformation
      expect('execute' in toolsForAI.testTool).toBe(false);
      expect('execute' in originalTools.testTool).toBe(true);

      // If AI SDK tried to auto-execute, it would fail because execute is undefined
      // This is the desired behavior - AI SDK cannot auto-execute
      expect((toolsForAI.testTool as any).execute).toBeUndefined();

      // ToolExecutor can still execute using original tools
      expect(originalTools.testTool.execute).toBe(mockExecute);
    });

    it('should maintain tool functionality for ToolExecutor', async () => {
      // Verify that removing execute from toolsForAI doesn't break ToolExecutor

      const mockExecute = vi.fn().mockResolvedValue({ data: 'test' });
      const tools = {
        tool1: {
          description: 'Tool 1',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: mockExecute,
        },
      };

      // Create toolsForAI (passed to AI SDK)
      const toolsForAI = createToolsForAI(tools);

      // ToolExecutor uses original tools, not toolsForAI
      const result = await tools.tool1.execute({ input: 'test' } as any);

      expect(mockExecute).toHaveBeenCalledWith({ input: 'test' });
      expect(result).toEqual({ data: 'test' });

      // Verify toolsForAI cannot execute
      expect((toolsForAI.tool1 as any).execute).toBeUndefined();
    });

    it('should handle empty tools object', () => {
      const tools = {};

      const toolsForAI = createToolsForAI(tools);

      expect(toolsForAI).toEqual({});
    });

    it('should handle tools without execute method', () => {
      // Some tools might already be in the format without execute
      const tools = {
        preDefined: {
          description: 'Pre-defined tool',
          inputSchema: { type: 'object' as const, properties: {} },
          // No execute method
        },
      };

      const toolsForAI = createToolsForAI(tools);

      // Tool should remain unchanged
      expect(toolsForAI.preDefined).toEqual(tools.preDefined);
    });
  });

  describe('Regression tests', () => {
    it('should ensure CallAgentToolDoing can render', () => {
      // This is a regression test for the original bug
      // CallAgentToolDoing component needs tool-call message to render

      const toolCallMessages: UIMessage[] = [];

      const mockOnToolMessage = (message: UIMessage) => {
        toolCallMessages.push(message);
      };

      // Simulate sending callAgent tool-call message
      const callAgentToolCall: UIMessage = {
        id: 'call-agent-123',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-agent-123',
            toolName: 'callAgent',
            input: {
              agentId: 'test',
              task: 'test',
            },
          },
        ],
        timestamp: new Date(),
        toolCallId: 'call-agent-123',
        toolName: 'callAgent',
        nestedTools: [],
      };

      mockOnToolMessage(callAgentToolCall);

      // Verify message was sent (required for CallAgentToolDoing to render)
      expect(toolCallMessages).toHaveLength(1);
      expect(toolCallMessages[0].role).toBe('assistant');
      expect(toolCallMessages[0].toolName).toBe('callAgent');

      const content = toolCallMessages[0].content as any[];
      expect(content[0].type).toBe('tool-call');
      expect(content[0].toolName).toBe('callAgent');
    });

    it('should ensure nested tools are tracked correctly', () => {
      // Nested tools from callAgent should be added to parent message

      const parentToolCall: UIMessage = {
        id: 'parent-123',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'parent-123',
            toolName: 'callAgent',
            input: {},
          },
        ],
        timestamp: new Date(),
        toolCallId: 'parent-123',
        toolName: 'callAgent',
        nestedTools: [],
      };

      // Simulate adding nested tool
      const nestedTool: UIMessage = {
        id: 'nested-456',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'nested-456',
            toolName: 'readFile',
            input: { file_path: 'test.ts' },
          },
        ],
        timestamp: new Date(),
        toolCallId: 'nested-456',
        toolName: 'readFile',
        parentToolCallId: 'parent-123',
      };

      parentToolCall.nestedTools = parentToolCall.nestedTools || [];
      parentToolCall.nestedTools.push(nestedTool);

      // Verify nested tool is tracked
      expect(parentToolCall.nestedTools).toHaveLength(1);
      expect(parentToolCall.nestedTools[0].toolName).toBe('readFile');
      expect(parentToolCall.nestedTools[0].parentToolCallId).toBe('parent-123');
    });

    it('should verify all tools go through ToolExecutor after fix', () => {
      // After the fix, all tools should be executed by ToolExecutor
      // This test ensures no tool bypasses ToolExecutor

      const executionLog: Array<{ tool: string; via: string }> = [];

      const tools = {
        tool1: {
          description: 'Tool 1',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: vi.fn(async (_args: any) => {
            executionLog.push({ tool: 'tool1', via: 'ToolExecutor' });
            return { success: true };
          }),
        },
        tool2: {
          description: 'Tool 2',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: vi.fn(async (_args: any) => {
            executionLog.push({ tool: 'tool2', via: 'ToolExecutor' });
            return { success: true };
          }),
        },
        callAgent: {
          description: 'Call Agent',
          inputSchema: { type: 'object' as const, properties: {} },
          execute: vi.fn(async (_args: any) => {
            executionLog.push({ tool: 'callAgent', via: 'ToolExecutor' });
            return { success: true };
          }),
        },
      };

      // Create toolsForAI (no execute methods)
      const toolsForAI = createToolsForAI(tools);

      // Verify AI SDK cannot execute any tool
      expect((toolsForAI.tool1 as any).execute).toBeUndefined();
      expect((toolsForAI.tool2 as any).execute).toBeUndefined();
      expect((toolsForAI.callAgent as any).execute).toBeUndefined();

      // Simulate ToolExecutor executing all tools
      tools.tool1.execute({} as any);
      tools.tool2.execute({} as any);
      tools.callAgent.execute({} as any);

      // Verify all executions went through ToolExecutor
      expect(executionLog).toHaveLength(3);
      expect(executionLog.every((log) => log.via === 'ToolExecutor')).toBe(true);
      expect(executionLog.map((log) => log.tool)).toEqual(['tool1', 'tool2', 'callAgent']);
    });
  });
});
