/**
 * LLM Test Helper Functions
 *
 * Utilities for building mock LLM stream events without AI SDK.
 */

import type { StreamEvent } from '@/services/llm/types';

// ============================================
// Type Definitions
// ============================================

export interface StreamChunk {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error';
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  finishReason?: 'stop' | 'tool-calls' | 'error';
  usage?: { promptTokens: number; completionTokens: number };
}

export interface MockLLMOptions {
  /** Streaming response chunk sequence */
  chunks?: StreamChunk[];
  /** Simplified text response */
  text?: string;
  /** Whether to throw an error */
  shouldError?: boolean;
  errorMessage?: string;
  /** Token usage */
  inputTokens?: number;
  outputTokens?: number;
}

export interface ToolCallInput {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

// ============================================
// Core Factory Functions
// ============================================

/**
 * Create a mock LLM stream result for llmClient.streamText.
 */
export function createStreamTextMock(options: {
  textChunks?: string[];
  toolCalls?: ToolCallInput[];
  finishReason?: 'stop' | 'tool-calls' | 'error';
  inputTokens?: number;
  outputTokens?: number;
}): { requestId: number; events: AsyncGenerator<StreamEvent, void, unknown> } {
  const {
    textChunks = ['Hello, world!'],
    toolCalls = [],
    finishReason = toolCalls.length > 0 ? 'tool-calls' : 'stop',
    inputTokens = 10,
    outputTokens = 20,
  } = options;

  const events = (async function* () {
    yield { type: 'text-start' } as StreamEvent;

    for (const text of textChunks) {
      yield { type: 'text-delta', text } as StreamEvent;
    }

    for (const tc of toolCalls) {
      yield {
        type: 'tool-call',
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: tc.input,
      } as StreamEvent;
    }

    yield {
      type: 'usage',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    } as StreamEvent;

    yield { type: 'done', finish_reason: finishReason } as StreamEvent;
  })();

  return {
    requestId: 1,
    events,
  };
}

/**
 * Preset test scenarios
 */
export const streamScenarios = {
  /** Simple text response */
  simpleText: (text = 'Hello, world!') => createStreamTextMock({ textChunks: [text] }),

  /** With tool call */
  withToolCall: (toolName: string, input: Record<string, unknown>) =>
    createStreamTextMock({
      textChunks: ['Let me help...'],
      toolCalls: [{ toolCallId: 'tc-1', toolName, input }],
    }),

  /** Multiple tool calls */
  multipleToolCalls: (calls: Array<{ name: string; input: Record<string, unknown> }>) =>
    createStreamTextMock({
      textChunks: ['Processing...'],
      toolCalls: calls.map((c, i) => ({
        toolCallId: `tc-${i}`,
        toolName: c.name,
        input: c.input,
      })),
    }),

  /** Parallel tool calls (no text) */
  parallelToolCalls: (calls: Array<{ name: string; input: Record<string, unknown> }>) =>
    createStreamTextMock({
      textChunks: [],
      toolCalls: calls.map((c, i) => ({
        toolCallId: `tc-${i}`,
        toolName: c.name,
        input: c.input,
      })),
    }),

  /**
   * Empty tool calls Bug scenario
   * finishReason='tool-calls' but no actual tool calls
   */
  emptyToolCallsBug: () =>
    createStreamTextMock({
      textChunks: ['Task completed.'],
      finishReason: 'tool-calls',
    }),

  /** Stream interruption error */
  streamError: () => ({
    requestId: 1,
    events: (async function* () {
      yield { type: 'text-start' } as StreamEvent;
      yield { type: 'text-delta', text: 'Partial ' } as StreamEvent;
      yield { type: 'error', message: 'Stream interrupted' } as StreamEvent;
      yield { type: 'done', finish_reason: 'error' } as StreamEvent;
    })(),
  }),

  /** Empty response */
  emptyResponse: () =>
    createStreamTextMock({
      textChunks: [],
      inputTokens: 10,
      outputTokens: 0,
    }),
};

// ============================================
// Helper Functions
// ============================================

/**
 * Create compression summary response (LLM stream events).
 */
export function createCompressionSummaryResponse(summary?: string) {
  const defaultSummary = `<analysis>
This is an analysis of the conversation history.
</analysis>

1. Primary Request and Intent: User wants to test message compression.
2. Key Technical Concepts: MessageCompactor, streaming, Rust LLM integration.
3. Files and Code Sections: src/services/message-compactor.ts was examined.
4. Errors and fixes: No errors encountered.
5. Problem Solving: Testing compression flow.
6. All user messages: User asked to implement compression tests.
7. Pending Tasks: Complete integration tests.
8. Current Work: Running compression integration tests.`;

  const text = summary || defaultSummary;
  const words = text.split(' ');
  const chunks: string[] = [];

  // Split into ~5 word chunks for streaming simulation
  for (let i = 0; i < words.length; i += 5) {
    chunks.push(`${words.slice(i, i + 5).join(' ')} `);
  }

  return createStreamTextMock({
    textChunks: chunks,
    finishReason: 'stop',
    inputTokens: 500,
    outputTokens: 200,
  });
}
