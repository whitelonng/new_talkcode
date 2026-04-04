// src/test/chat-service-tool-ui-rendering.test.ts

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Mock logger FIRST before any imports that may use it

import { createLLMService, type LLMService } from '@/services/agents/llm-service';
import type { UIMessage } from '@/types/agent';

// Mock dependencies


// Mock provider store
const mockProviderStore = {
  getProviderModel: vi.fn(() => ({
    languageModel: {
      provider: 'test',
      modelId: 'test-model',
    },
    modelConfig: {
      name: 'Test Model',
      context_length: 128000,
    },
    providerId: 'test-provider',
    modelKey: 'test-model',
  })),
  isModelAvailable: vi.fn(() => true),
  availableModels: [],
  apiKeys: {},
  providers: new Map(),
  customProviders: {},
};

vi.mock('@/providers/stores/provider-store', () => ({
  useProviderStore: {
    getState: vi.fn(() => mockProviderStore),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getCurrentRootPath: vi.fn(() => '/test/path'),
    getCurrentConversationId: vi.fn(() => 'test-conversation-id'),
    getSync: vi.fn().mockReturnValue(undefined),
    getBatchSync: vi.fn().mockReturnValue({}),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    getAutoCodeReviewGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
    setAutoCodeReviewGlobal: vi.fn(),
  },
  useSettingsStore: {
    getState: vi.fn(() => ({
      language: 'en',
      getReasoningEffort: vi.fn(() => 'medium'),
      getAutoApproveEditsGlobal: vi.fn(() => false),
      getAutoCodeReviewGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
      setAutoCodeReviewGlobal: vi.fn(),
    })),
  },
}));

vi.mock('@/services/workspace-root-service', () => ({
  getValidatedWorkspaceRoot: vi.fn().mockResolvedValue('/test/path'),
  getEffectiveWorkspaceRoot: vi.fn().mockResolvedValue('/test/path'),
}));

vi.mock('@/services/ai-pricing-service', () => ({
  aiPricingService: { calculateCost: vi.fn(() => Promise.resolve(0.01)) },
}));

vi.mock('@/services/conversation-manager', () => ({
  ConversationManager: { updateConversationUsage: vi.fn(() => Promise.resolve()) },
}));

vi.mock('@/lib/llm-utils', () => ({
  convertMessages: vi.fn(async (messages) =>
    messages.map((msg: UIMessage) => ({ role: msg.role, content: msg.content }))
  ),
  formatReasoningText: vi.fn((text, isFirst) => (isFirst ? `\n<thinking>\n${text}` : text)),
}));

// Mock tool UI renderers
const mockToolDoingComponent = React.createElement('div', null, 'Tool is running...');
const mockToolResultComponent = React.createElement('div', null, 'Tool completed!');

vi.mock('@/lib/tool-adapter', () => ({
  getToolUIRenderers: vi.fn((toolName) => {
    if (toolName === 'testTool') {
      return {
        renderToolDoing: vi.fn(() => mockToolDoingComponent),
        renderToolResult: vi.fn(() => mockToolResultComponent),
      };
    }
    return null;
  }),
}));

vi.mock('@/services/llm/llm-client', () => ({
  llmClient: {
    streamText: vi.fn(),
    generateImage: vi.fn(),
  },
}));

vi.mock('@/services/database-service', () => ({
  databaseService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    insertApiUsageEvent: vi.fn().mockResolvedValue(undefined),
    startSpan: vi.fn().mockResolvedValue(undefined),
    endSpan: vi.fn().mockResolvedValue(undefined),
    db: {
      select: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    },
  },
}));

describe('ChatService Tool UI Rendering', () => {
  const testMessages: UIMessage[] = [
    {
      id: '1',
      role: 'user',
      content: 'Please run a test tool',
      timestamp: new Date(),
    },
  ];

  let mockStreamText: any;
  let _mockGetToolUIRenderers: any;
  let llmService: LLMService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const llmModule = await import('@/services/llm/llm-client');
    mockStreamText = vi.mocked(llmModule.llmClient.streamText);

    const toolAdapterModule = await import('@/lib/tool-adapter');
    _mockGetToolUIRenderers = vi.mocked(toolAdapterModule.getToolUIRenderers);

    // Create a new LLMService instance for each test
    llmService = createLLMService('test-task-id');
  });

  it('should send tool-call message when tool call starts', async () => {
    // Setup mock tool
    const mockTool = {
      inputSchema: z.object({}),
      execute: vi.fn(() => Promise.resolve({ success: true, result: 'test result' })),
    };

    mockStreamText
      .mockResolvedValueOnce({
        requestId: 1,
        events: (async function* () {
          yield {
            type: 'tool-call',
            toolCallId: 'call_testTool_abc123',
            toolName: 'testTool',
            input: { input: 'test input' },
          };
          yield { type: 'done', finish_reason: 'tool-calls' };
        })(),
      })
      .mockResolvedValueOnce({
        requestId: 2,
        events: (async function* () {
          yield { type: 'text-start' };
          yield { type: 'text-delta', text: 'Tool completed' };
          yield {
            type: 'usage',
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          };
          yield { type: 'done', finish_reason: 'stop' };
        })(),
      });

    const toolMessages: UIMessage[] = [];

    await llmService.runAgentLoop(
      {
        messages: testMessages,
        model: 'test-model',
        tools: { testTool: mockTool },
      },
      {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        onStatus: vi.fn(),
        onToolMessage: (message: UIMessage) => {
          // Collect tool messages for testing
          toolMessages.push(message);
        },
      }
    );

    // Verify tool-call message was sent (UI rendering happens in message-item.tsx)
    const toolCallMessage = toolMessages.find(
      (m) =>
        m.role === 'tool' &&
        Array.isArray(m.content) &&
        m.content.some((c) => c.type === 'tool-call')
    );
    expect(toolCallMessage).toBeDefined();
    expect(toolCallMessage?.toolName).toBe('testTool');
    // Tool call ID now has format: call_{toolName}_{6-char-random-id}
    expect(toolCallMessage?.toolCallId).toMatch(/^call_testTool_[A-Za-z0-9]{6}$/);
    expect(toolCallMessage?.nestedTools).toEqual([]);
  });

  it('should send tool-result message when tool execution completes', async () => {
    // Setup mock tool
    const mockToolResult = { success: true, result: 'test result' };
    const mockTool = {
      inputSchema: z.object({}),
      execute: vi.fn(() => Promise.resolve(mockToolResult)),
    };

    mockStreamText
      .mockResolvedValueOnce({
        requestId: 1,
        events: (async function* () {
          yield {
            type: 'tool-call',
            toolCallId: 'call_testTool_abc123',
            toolName: 'testTool',
            input: { input: 'test input' },
          };
          yield { type: 'done', finish_reason: 'tool-calls' };
        })(),
      })
      .mockResolvedValueOnce({
        requestId: 2,
        events: (async function* () {
          yield { type: 'text-start' };
          yield { type: 'text-delta', text: 'Tool completed' };
          yield {
            type: 'usage',
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          };
          yield { type: 'done', finish_reason: 'stop' };
        })(),
      });

    const toolMessages: UIMessage[] = [];

    await llmService.runAgentLoop(
      {
        messages: testMessages,
        model: 'test-model',
        tools: { testTool: mockTool },
      },
      {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        onStatus: vi.fn(),
        onToolMessage: (message: UIMessage) => {
          // Collect tool messages for testing
          toolMessages.push(message);
        },
      }
    );

    // Verify tool-result message was sent (UI rendering happens in message-item.tsx)
    const toolResultMessage = toolMessages.find(
      (m) =>
        m.role === 'tool' &&
        Array.isArray(m.content) &&
        m.content.some((c) => c.type === 'tool-result')
    );
    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage?.toolName).toBe('testTool');
    // Tool call ID now has format: call_{toolName}_{6-char-random-id}
    expect(toolResultMessage?.toolCallId).toMatch(/^call_testTool_[A-Za-z0-9]{6}$/);

    // Verify the tool result has the correct output
    const toolResultContent = Array.isArray(toolResultMessage?.content)
      ? toolResultMessage.content.find((c: any) => c.type === 'tool-result')
      : undefined;
    expect(toolResultContent?.output).toEqual(mockToolResult);
  });

  it('should include renderDoingUI flag in tool-call message', async () => {
    // Setup mock tool
    const mockTool = {
      inputSchema: z.object({}),
      execute: vi.fn(() => Promise.resolve({ success: true })),
    };

    mockStreamText
      .mockResolvedValueOnce({
        requestId: 1,
        events: (async function* () {
          yield {
            type: 'tool-call',
            toolCallId: 'call_testTool_render123',
            toolName: 'testTool',
            input: {},
          };
          yield { type: 'done', finish_reason: 'tool-calls' };
        })(),
      })
      .mockResolvedValueOnce({
        requestId: 2,
        events: (async function* () {
          yield { type: 'text-start' };
          yield { type: 'text-delta', text: 'Done' };
          yield {
            type: 'usage',
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          };
          yield { type: 'done', finish_reason: 'stop' };
        })(),
      });

    const toolMessages: UIMessage[] = [];

    await llmService.runAgentLoop(
      {
        messages: testMessages,
        model: 'test-model',
        tools: { testTool: mockTool },
      },
      {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        onStatus: vi.fn(),
        onToolMessage: (message: UIMessage) => {
          toolMessages.push(message);
        },
      }
    );

    // Find the tool-call message
    const toolCallMessage = toolMessages.find(
      (m) =>
        m.role === 'tool' &&
        Array.isArray(m.content) &&
        m.content.some((c) => c.type === 'tool-call')
    );

    expect(toolCallMessage).toBeDefined();
    // renderDoingUI should be defined (based on tool metadata)
    // The actual value depends on TOOL_DEFINITIONS in tools/index.ts
    expect(toolCallMessage?.renderDoingUI).toBeDefined();
  });
});
