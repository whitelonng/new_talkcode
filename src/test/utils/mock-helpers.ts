/**
 * General Mock Helper Functions
 * Provides commonly used mock tools and helper functions for testing
 */

import { vi } from 'vitest';

// ============================================
// ID and Value Generators
// ============================================

/**
 * Factory function for generating incremental IDs
 *
 * @example
 * ```typescript
 * const getId = mockId('tool-call');
 * getId(); // 'tool-call-0'
 * getId(); // 'tool-call-1'
 * ```
 */
export function mockId(prefix = 'id') {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

/**
 * Factory function that returns preset values in order
 * Throws error when values are exhausted
 *
 * @example
 * ```typescript
 * const getValue = mockValues('first', 'second', 'third');
 * getValue(); // 'first'
 * getValue(); // 'second'
 * getValue(); // 'third'
 * getValue(); // throws Error
 * ```
 */
export function mockValues<T>(...values: T[]): () => T {
  let index = 0;
  return () => {
    if (index >= values.length) {
      throw new Error(`mockValues exhausted: only ${values.length} values provided`);
    }
    return values[index++];
  };
}

/**
 * Factory function that cycles through preset values
 * Starts over when values are exhausted
 *
 * @example
 * ```typescript
 * const getValue = mockCycle('a', 'b');
 * getValue(); // 'a'
 * getValue(); // 'b'
 * getValue(); // 'a'
 * ```
 */
export function mockCycle<T>(...values: T[]): () => T {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index++;
    return value;
  };
}

// ============================================
// Message and Test Data Creation
// ============================================

export interface TestMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Create message list for testing
 *
 * @example
 * ```typescript
 * const messages = createTestMessages([
 *   { role: 'user', content: 'Hello' },
 *   { role: 'assistant', content: 'Hi there!' },
 * ]);
 * ```
 */
export function createTestMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): TestMessage[] {
  return messages.map((msg, i) => ({
    id: `msg-${i}`,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(),
  }));
}

/**
 * Create simple conversation message sequence
 *
 * @example
 * ```typescript
 * const messages = createConversation(4);
 * // Creates: user, assistant, user, assistant
 * ```
 */
export function createConversation(count: number): TestMessage[] {
  const messages: TestMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
      timestamp: new Date(Date.now() + i * 1000),
    });
  }
  return messages;
}

// ============================================
// Tool Mock Utilities
// ============================================

export interface MockToolConfig<TInput = unknown, TOutput = unknown> {
  execute?: (input: TInput) => Promise<TOutput> | TOutput;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Helper function to create Mock Tool
 *
 * @example
 * ```typescript
 * const mockReadFile = createMockTool('readFile', {
 *   execute: (input) => ({ content: 'file content' }),
 * });
 * ```
 */
export function createMockTool<TInput = unknown, TOutput = unknown>(
  name: string,
  config: MockToolConfig<TInput, TOutput> = {}
) {
  const executeFn = config.execute ?? vi.fn().mockResolvedValue({ success: true });

  return {
    name,
    description: config.description ?? `Mock tool: ${name}`,
    parameters: config.parameters ?? { type: 'object', properties: {} },
    execute: vi.fn(executeFn),
  };
}

/**
 * Create a set of commonly used Mock Tools
 */
export function createMockTools() {
  return {
    readFile: createMockTool('readFile', {
      execute: (input: { path: string }) => ({ content: `Content of ${input.path}` }),
    }),
    writeFile: createMockTool('writeFile', {
      execute: () => ({ success: true }),
    }),
    grep: createMockTool('grep', {
      execute: (_input: { pattern: string }) => ({
        matches: [`Match for ${input.pattern}`],
      }),
    }),
    glob: createMockTool('glob', {
      execute: (input: { pattern: string }) => ({
        files: [`file1.ts`, `file2.ts`],
      }),
    }),
    bash: createMockTool('bash', {
      execute: (input: { command: string }) => ({
        stdout: `Output of: ${input.command}`,
        stderr: '',
        exitCode: 0,
      }),
    }),
  };
}

// ============================================
// State Waiting Utilities
// ============================================

/**
 * Helper function to wait for state change
 * For waiting on async state updates
 *
 * @example
 * ```typescript
 * await waitForState(
 *   () => store.getState().status,
 *   (status) => status === 'completed',
 *   { timeout: 5000 }
 * );
 * ```
 */
export async function waitForState<T>(
  getter: () => T,
  predicate: (value: T) => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const value = getter();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitForState timed out after ${timeout}ms`);
}

/**
 * Wait for condition to be met or timeout
 *
 * @example
 * ```typescript
 * await waitFor(() => element.isVisible(), { timeout: 3000 });
 * ```
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// ============================================
// Delay and Timing Utilities
// ============================================

/**
 * Create controllable delay Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create Promise with timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(fetchData(), 5000, 'Fetch timed out');
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]);
}

// ============================================
// Mock Response Factory
// ============================================

/**
 * Create Mock AI SDK streamText response
 * Compatible with pattern in message-compactor-integration.test.ts
 */
export function createMockStreamTextResponse(options: {
  text?: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; args: Record<string, unknown> }>;
  finishReason?: 'stop' | 'tool-calls' | 'length' | 'error';
  usage?: { promptTokens: number; completionTokens: number };
}) {
  const {
    text = '',
    toolCalls = [],
    finishReason = toolCalls.length > 0 ? 'tool-calls' : 'stop',
    usage = { promptTokens: 100, completionTokens: 50 },
  } = options;

  return {
    textStream: (async function* () {
      for (const char of text) {
        yield char;
      }
    })(),
    fullStream: (async function* () {
      if (text) {
        yield { type: 'text-delta', textDelta: text };
      }
      for (const tc of toolCalls) {
        yield { type: 'tool-call', ...tc };
      }
      yield { type: 'finish', finishReason, usage };
    })(),
    text: Promise.resolve(text),
    toolCalls: Promise.resolve(toolCalls),
    finishReason: Promise.resolve(finishReason),
    usage: Promise.resolve(usage),
  };
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert function was called with specific partial arguments
 *
 * @example
 * ```typescript
 * assertCalledWithPartial(mockFn, { path: '/test' });
 * ```
 */
export function assertCalledWithPartial(
  mockFn: ReturnType<typeof vi.fn>,
  partialArgs: Record<string, unknown>
) {
  const calls = mockFn.mock.calls;
  const found = calls.some((call) => {
    const arg = call[0];
    if (typeof arg !== 'object' || arg === null) return false;
    return Object.entries(partialArgs).every(
      ([key, value]) => (arg as Record<string, unknown>)[key] === value
    );
  });

  if (!found) {
    throw new Error(
      `Expected mock to be called with partial args ${JSON.stringify(partialArgs)}, ` +
        `but was called with: ${JSON.stringify(calls)}`
    );
  }
}

/**
 * Get the last call arguments of a mock function
 */
export function getLastCallArgs<T = unknown>(mockFn: ReturnType<typeof vi.fn>): T | undefined {
  const calls = mockFn.mock.calls;
  return calls.length > 0 ? (calls[calls.length - 1][0] as T) : undefined;
}
