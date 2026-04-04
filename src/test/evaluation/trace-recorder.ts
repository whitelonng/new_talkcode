/**
 * Agent Execution Trace Recorder
 * Records the complete execution process of an Agent for evaluation and debugging
 *
 * @example
 * ```typescript
 * const recorder = new AgentTraceRecorder();
 *
 * recorder.startTrace('Read package.json for me');
 * recorder.recordToolCall('readFile', { path: 'package.json' }, 'tc-1');
 * recorder.recordToolResult('tc-1', { content: '...' });
 * recorder.recordText('The file content is...');
 * const trace = recorder.endTrace('Done', { prompt: 100, completion: 50 });
 * ```
 */

export interface TraceStep {
  /** Step type */
  type: 'text' | 'tool-call' | 'tool-result' | 'reasoning' | 'error' | 'status';
  /** Timestamp */
  timestamp: number;
  /** Step data */
  data: unknown;
}

export interface AgentTrace {
  /** Trace ID */
  id: string;
  /** User input */
  input: string;
  /** Execution steps */
  steps: TraceStep[];
  /** Final output */
  output: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Metrics */
  metrics: {
    totalSteps: number;
    toolCallCount: number;
    durationMs: number;
    tokenUsage?: { prompt: number; completion: number };
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface ToolCallData {
  toolName: string;
  args: Record<string, unknown>;
  toolCallId?: string;
}

export interface ToolResultData {
  toolCallId: string;
  result: unknown;
  isError: boolean;
}

/**
 * Agent Execution Trace Recorder
 */
export class AgentTraceRecorder {
  private currentTrace: Partial<AgentTrace> | null = null;
  private traceIdCounter = 0;
  private traces: AgentTrace[] = [];

  /**
   * Start recording a new trace
   * @param input - User input
   * @param metadata - Optional metadata
   * @returns Trace ID
   */
  startTrace(input: string, metadata?: Record<string, unknown>): string {
    const id = `trace-${++this.traceIdCounter}-${Date.now()}`;
    this.currentTrace = {
      id,
      input,
      steps: [],
      startTime: Date.now(),
      metadata,
    };
    return id;
  }

  /**
   * Record a step
   */
  recordStep(step: Omit<TraceStep, 'timestamp'>): void {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTrace() first.');
    }
    this.currentTrace.steps?.push({
      ...step,
      timestamp: Date.now(),
    });
  }

  /**
   * Record text output
   */
  recordText(text: string): void {
    this.recordStep({ type: 'text', data: { text } });
  }

  /**
   * Record tool call
   */
  recordToolCall(toolName: string, args: Record<string, unknown>, toolCallId?: string): void {
    this.recordStep({
      type: 'tool-call',
      data: { toolName, args, toolCallId } as ToolCallData,
    });
  }

  /**
   * Record tool result
   */
  recordToolResult(toolCallId: string, result: unknown, isError = false): void {
    this.recordStep({
      type: 'tool-result',
      data: { toolCallId, result, isError } as ToolResultData,
    });
  }

  /**
   * Record reasoning process (chain of thought)
   */
  recordReasoning(text: string): void {
    this.recordStep({ type: 'reasoning', data: { text } });
  }

  /**
   * Record status change
   */
  recordStatus(status: string, details?: Record<string, unknown>): void {
    this.recordStep({ type: 'status', data: { status, ...details } });
  }

  /**
   * Record error
   */
  recordError(error: Error | string): void {
    const errorData =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : { message: error };

    this.recordStep({ type: 'error', data: errorData });
  }

  /**
   * End trace and return complete record
   */
  endTrace(output: string, tokenUsage?: { prompt: number; completion: number }): AgentTrace {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTrace() first.');
    }

    const endTime = Date.now();
    const steps = this.currentTrace.steps || [];
    const toolCallCount = steps.filter((s) => s.type === 'tool-call').length;

    const trace: AgentTrace = {
      id: this.currentTrace.id!,
      input: this.currentTrace.input!,
      steps,
      output,
      startTime: this.currentTrace.startTime!,
      endTime,
      metrics: {
        totalSteps: steps.length,
        toolCallCount,
        durationMs: endTime - (this.currentTrace.startTime || 0),
        tokenUsage,
      },
      metadata: this.currentTrace.metadata,
    };

    this.traces.push(trace);
    this.currentTrace = null;
    return trace;
  }

  /**
   * Cancel current trace
   */
  cancelTrace(): void {
    this.currentTrace = null;
  }

  /**
   * Get current trace state (for debugging)
   */
  getCurrentTrace(): Partial<AgentTrace> | null {
    return this.currentTrace
      ? { ...this.currentTrace, steps: [...(this.currentTrace.steps || [])] }
      : null;
  }

  /**
   * Check if there is an active trace
   */
  isTracing(): boolean {
    return this.currentTrace !== null;
  }

  /**
   * Get all completed traces
   */
  getAllTraces(): AgentTrace[] {
    return [...this.traces];
  }

  /**
   * Get trace by ID
   */
  getTraceById(id: string): AgentTrace | undefined {
    return this.traces.find((t) => t.id === id);
  }

  /**
   * Clear all trace history
   */
  clearHistory(): void {
    this.traces = [];
  }

  /**
   * Get trace statistics
   */
  getStats(): {
    totalTraces: number;
    averageDuration: number;
    averageToolCalls: number;
    averageSteps: number;
  } {
    if (this.traces.length === 0) {
      return {
        totalTraces: 0,
        averageDuration: 0,
        averageToolCalls: 0,
        averageSteps: 0,
      };
    }

    const totalDuration = this.traces.reduce((sum, t) => sum + t.metrics.durationMs, 0);
    const totalToolCalls = this.traces.reduce((sum, t) => sum + t.metrics.toolCallCount, 0);
    const totalSteps = this.traces.reduce((sum, t) => sum + t.metrics.totalSteps, 0);

    return {
      totalTraces: this.traces.length,
      averageDuration: Math.round(totalDuration / this.traces.length),
      averageToolCalls: Math.round((totalToolCalls / this.traces.length) * 100) / 100,
      averageSteps: Math.round((totalSteps / this.traces.length) * 100) / 100,
    };
  }
}

/**
 * Extract tool call list from AgentTrace
 */
export function extractToolCalls(trace: AgentTrace): Array<{
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}> {
  return trace.steps
    .filter((s) => s.type === 'tool-call')
    .map((s) => {
      const data = s.data as ToolCallData;
      return {
        toolCallId: data.toolCallId ?? `tc-${trace.steps.indexOf(s)}`,
        toolName: data.toolName,
        args: data.args,
      };
    });
}

/**
 * Extract tool result list from AgentTrace
 */
export function extractToolResults(trace: AgentTrace): Array<{
  toolCallId: string;
  result: unknown;
  isError: boolean;
}> {
  return trace.steps.filter((s) => s.type === 'tool-result').map((s) => s.data as ToolResultData);
}

/**
 * Serialize trace to JSON string
 */
export function serializeTrace(trace: AgentTrace): string {
  return JSON.stringify(trace, null, 2);
}

/**
 * Deserialize trace from JSON string
 */
export function deserializeTrace(json: string): AgentTrace {
  return JSON.parse(json) as AgentTrace;
}

/**
 * Convenience factory function to create a trace recorder
 */
export function createTraceRecorder(): AgentTraceRecorder {
  return new AgentTraceRecorder();
}

// Export singleton for convenience in tests
export const traceRecorder = new AgentTraceRecorder();
