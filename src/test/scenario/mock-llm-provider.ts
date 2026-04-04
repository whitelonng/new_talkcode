/**
 * Mock LLM Provider
 * Control LLM responses in Scenario tests
 *
 * @example
 * ```typescript
 * const provider = new MockLLMProvider();
 *
 * // Queue responses
 * provider.queueResponse(mockResponses.text('Hello!'));
 * provider.queueResponse(mockResponses.toolCall('readFile', { path: '/test.ts' }));
 *
 * // Or use rules
 * provider.setResponseRule(
 *   (input) => input.includes('TODO'),
 *   mockResponses.toolCall('grep', { pattern: 'TODO' })
 * );
 * ```
 */

// ============================================
// Type Definitions
// ============================================

export interface MockLLMResponse {
  /** Text response */
  text?: string;
  /** Tool calls */
  toolCalls?: MockToolCall[];
  /** Finish reason */
  finishReason?: 'stop' | 'tool-calls' | 'length' | 'error';
  /** Token usage */
  usage?: { promptTokens: number; completionTokens: number };
}

export interface MockToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface LLMCall {
  /** Input messages */
  messages: unknown[];
  /** Available tools */
  tools?: unknown[];
  /** Call timestamp */
  timestamp: number;
  /** Input text for matching (usually the last user message) */
  inputText?: string;
}

export interface ResponseRule {
  /** Match function */
  match: (input: string, messages: unknown[]) => boolean;
  /** Response (can be value or function) */
  response: MockLLMResponse | ((input: string) => MockLLMResponse);
  /** Rule priority (higher = higher priority) */
  priority?: number;
  /** Whether to match only once */
  once?: boolean;
  /** Match count */
  matchCount?: number;
}

// ============================================
// Mock LLM Provider
// ============================================

/**
 * Mock LLM Provider
 * Provides controllable LLM responses for testing
 */
export class MockLLMProvider {
  private responseQueue: MockLLMResponse[] = [];
  private responseRules: ResponseRule[] = [];
  private calls: LLMCall[] = [];
  private defaultResponse: MockLLMResponse = {
    text: 'Mock response',
    finishReason: 'stop',
  };
  private toolCallIdCounter = 0;

  /**
   * Queue a response
   * Responses are consumed in order of addition
   */
  queueResponse(response: MockLLMResponse): this {
    this.responseQueue.push(response);
    return this;
  }

  /**
   * Queue multiple responses
   */
  queueResponses(...responses: MockLLMResponse[]): this {
    this.responseQueue.push(...responses);
    return this;
  }

  /**
   * Set rule-based response
   */
  setResponseRule(
    match: (input: string, messages?: unknown[]) => boolean,
    response: MockLLMResponse | ((input: string) => MockLLMResponse),
    options: { priority?: number; once?: boolean } = {}
  ): this {
    this.responseRules.push({
      match,
      response,
      priority: options.priority ?? 0,
      once: options.once ?? false,
      matchCount: 0,
    });

    // Sort by priority
    this.responseRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  /**
   * Set response when input contains specific keyword
   */
  whenContains(keyword: string, response: MockLLMResponse): this {
    return this.setResponseRule(
      (input) => input.toLowerCase().includes(keyword.toLowerCase()),
      response
    );
  }

  /**
   * Set response when input matches regex
   */
  whenMatches(pattern: RegExp, response: MockLLMResponse): this {
    return this.setResponseRule((input) => pattern.test(input), response);
  }

  /**
   * Set default response
   */
  setDefaultResponse(response: MockLLMResponse): this {
    this.defaultResponse = response;
    return this;
  }

  /**
   * Get response
   */
  async getResponse(messages: unknown[], tools?: unknown[]): Promise<MockLLMResponse> {
    // Extract input text (last user message)
    const inputText = this.extractInputText(messages);

    // Record call
    this.calls.push({
      messages,
      tools,
      timestamp: Date.now(),
      inputText,
    });

    // 1. Check queue first
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift() as T;
    }

    // 2. Check rules
    for (const rule of this.responseRules) {
      if (rule.once && (rule.matchCount ?? 0) > 0) {
        continue;
      }

      if (rule.match(inputText, messages)) {
        rule.matchCount = (rule.matchCount ?? 0) + 1;

        if (typeof rule.response === 'function') {
          return rule.response(inputText);
        }
        return rule.response;
      }
    }

    // 3. Return default response
    return this.defaultResponse;
  }

  /**
   * Extract input text from messages
   */
  private extractInputText(messages: unknown[]): string {
    if (!Array.isArray(messages) || messages.length === 0) {
      return '';
    }

    // Find last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as { role?: string; content?: string };
      if (msg.role === 'user' && typeof msg.content === 'string') {
        return msg.content;
      }
    }

    return '';
  }

  /**
   * Get all call records
   */
  getCalls(): LLMCall[] {
    return [...this.calls];
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Get last call
   */
  getLastCall(): LLMCall | undefined {
    return this.calls.length > 0 ? this.calls[this.calls.length - 1] : undefined;
  }

  /**
   * Check if it was called
   */
  wasCalled(): boolean {
    return this.calls.length > 0;
  }

  /**
   * Check if it was called specified number of times
   */
  wasCalledTimes(count: number): boolean {
    return this.calls.length === count;
  }

  /**
   * Reset state
   */
  reset(): this {
    this.responseQueue = [];
    this.calls = [];
    for (const rule of this.responseRules) {
      rule.matchCount = 0;
    }
    return this;
  }

  /**
   * Clear completely (including rules)
   */
  clear(): this {
    this.responseQueue = [];
    this.responseRules = [];
    this.calls = [];
    return this;
  }

  /**
   * Generate unique tool call ID
   */
  generateToolCallId(): string {
    return `tc-mock-${++this.toolCallIdCounter}`;
  }
}

// ============================================
// Response Factory Functions
// ============================================

/**
 * Common Mock response factory
 */
export const mockResponses = {
  /**
   * Plain text response
   */
  text: (
    content: string,
    usage?: { promptTokens: number; completionTokens: number }
  ): MockLLMResponse => ({
    text: content,
    finishReason: 'stop',
    usage: usage ?? { promptTokens: 100, completionTokens: content.length },
  }),

  /**
   * Tool call response
   */
  toolCall: (
    toolName: string,
    args: Record<string, unknown>,
    toolCallId?: string
  ): MockLLMResponse => ({
    toolCalls: [
      {
        toolCallId: toolCallId ?? `tc-${Date.now()}`,
        toolName,
        args,
      },
    ],
    finishReason: 'tool-calls',
  }),

  /**
   * Multiple tool calls
   */
  multipleToolCalls: (
    calls: Array<{ toolName: string; args: Record<string, unknown> }>
  ): MockLLMResponse => ({
    toolCalls: calls.map((call, i) => ({
      toolCallId: `tc-${Date.now()}-${i}`,
      toolName: call.toolName,
      args: call.args,
    })),
    finishReason: 'tool-calls',
  }),

  /**
   * Tool call with text
   */
  textWithToolCall: (
    text: string,
    toolName: string,
    args: Record<string, unknown>
  ): MockLLMResponse => ({
    text,
    toolCalls: [
      {
        toolCallId: `tc-${Date.now()}`,
        toolName,
        args,
      },
    ],
    finishReason: 'tool-calls',
  }),

  /**
   * Empty response
   */
  empty: (): MockLLMResponse => ({
    text: '',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 0 },
  }),

  /**
   * Error response
   */
  error: (errorText?: string): MockLLMResponse => ({
    text: errorText ?? 'An error occurred',
    finishReason: 'error',
  }),

  /**
   * Length truncated response
   */
  truncated: (text: string): MockLLMResponse => ({
    text,
    finishReason: 'length',
  }),
};

// ============================================
// Agent Adapter
// ============================================

/**
 * Create an Agent config using MockLLMProvider
 */
export function createMockAgentConfig(
  provider: MockLLMProvider,
  toolExecutor?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
): {
  runAgent: (input: string) => Promise<{
    output: string;
    toolCalls: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      result?: unknown;
    }>;
  }>;
} {
  return {
    runAgent: async (input: string) => {
      const response = await provider.getResponse([{ role: 'user', content: input }]);

      const toolCalls = [];

      // Execute tool calls
      if (response.toolCalls && toolExecutor) {
        for (const tc of response.toolCalls) {
          try {
            const result = await toolExecutor(tc.toolName, tc.args);
            toolCalls.push({ ...tc, result });
          } catch (error) {
            toolCalls.push({
              ...tc,
              result: { error: error instanceof Error ? error.message : String(error) },
            });
          }
        }
      } else if (response.toolCalls) {
        toolCalls.push(...response.toolCalls.map((tc) => ({ ...tc, result: undefined })));
      }

      return {
        output: response.text ?? '',
        toolCalls,
      };
    },
  };
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Create a new MockLLMProvider
 */
export function createMockLLMProvider(): MockLLMProvider {
  return new MockLLMProvider();
}
