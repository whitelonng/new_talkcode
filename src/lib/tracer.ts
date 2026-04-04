// src/lib/tracer.ts

import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { logger } from './logger';

/**
 * Chrome Trace Event Format
 * See: https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU
 */
interface TraceEvent {
  /** Event name */
  name: string;
  /** Category */
  cat: string;
  /** Phase: "B" (begin), "E" (end), "X" (complete) */
  ph: 'B' | 'E' | 'X';
  /** Timestamp in microseconds */
  ts: number;
  /** Process ID */
  pid: number;
  /** Thread ID */
  tid: number;
  /** Duration in microseconds (only for "X" phase) */
  dur?: number;
  /** Additional arguments */
  args?: Record<string, any>;
}

interface TraceData {
  traceEvents: TraceEvent[];
  displayTimeUnit: 'ms';
  metadata?: Record<string, any>;
}

interface SpanContext {
  name: string;
  startTime: number;
  metadata?: Record<string, any>;
}

/**
 * Tracer for tracking performance using Chrome Trace Event Format
 *
 * Usage:
 * ```ts
 * const tracer = new Tracer('my-operation');
 * tracer.startSpan('step1', { detail: 'value' });
 * // ... do work ...
 * tracer.endSpan('step1');
 * await tracer.save();
 * ```
 *
 * Visualize the trace:
 * 1. Open Chrome browser
 * 2. Navigate to chrome://tracing
 * 3. Click "Load" and select the generated trace file
 */
export class Tracer {
  private events: TraceEvent[] = [];
  private spanStack: SpanContext[] = [];
  private readonly processId: number = 1;
  private readonly threadId: number = 1;
  private readonly sessionName: string;
  private readonly sessionStartTime: number;
  private metadata: Record<string, any> = {};

  constructor(sessionName: string, metadata?: Record<string, any>) {
    this.sessionName = sessionName;
    this.sessionStartTime = this.getMicroseconds();
    this.metadata = metadata || {};

    logger.info(`[Tracer] Session started: ${sessionName}`);
  }

  /**
   * Start a new span
   * @param name Span name
   * @param metadata Optional metadata to attach to the span
   */
  startSpan(name: string, metadata?: Record<string, any>): void {
    const now = this.getMicroseconds();

    // Record begin event
    this.events.push({
      name,
      cat: this.getCategoryFromName(name),
      ph: 'B',
      ts: now,
      pid: this.processId,
      tid: this.threadId,
      args: metadata,
    });

    // Push to stack for tracking
    this.spanStack.push({
      name,
      startTime: now,
      metadata,
    });

    logger.debug(`[Tracer] Span started: ${name}`);
  }

  /**
   * End the current span
   * @param name Span name (must match the most recent startSpan)
   * @returns Duration in milliseconds
   */
  endSpan(name: string): number {
    const now = this.getMicroseconds();

    // Pop from stack and validate
    const span = this.spanStack.pop();
    if (!span) {
      logger.warn(`[Tracer] No active span to end: ${name}`);
      return 0;
    }

    if (span.name !== name) {
      logger.warn(`[Tracer] Span mismatch: expected "${span.name}", got "${name}"`);
      // Push it back
      this.spanStack.push(span);
      return 0;
    }

    // Record end event
    this.events.push({
      name,
      cat: this.getCategoryFromName(name),
      ph: 'E',
      ts: now,
      pid: this.processId,
      tid: this.threadId,
    });

    const durationMicros = now - span.startTime;
    const durationMs = durationMicros / 1000;

    logger.debug(`[Tracer] Span ended: ${name} (${durationMs.toFixed(2)}ms)`);

    return durationMs;
  }

  /**
   * Record a complete event (begin + end in one)
   * @param name Event name
   * @param durationMs Duration in milliseconds
   * @param metadata Optional metadata
   */
  recordCompleteEvent(name: string, durationMs: number, metadata?: Record<string, any>): void {
    const now = this.getMicroseconds();
    const durationMicros = durationMs * 1000;

    this.events.push({
      name,
      cat: this.getCategoryFromName(name),
      ph: 'X',
      ts: now - durationMicros,
      dur: durationMicros,
      pid: this.processId,
      tid: this.threadId,
      args: metadata,
    });
  }

  /**
   * Add metadata to the trace
   */
  addMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Get current trace statistics
   */
  getStats(): {
    eventCount: number;
    spanCount: number;
    durationMs: number;
  } {
    const now = this.getMicroseconds();
    const durationMicros = now - this.sessionStartTime;

    return {
      eventCount: this.events.length,
      spanCount: this.events.filter((e) => e.ph === 'B').length,
      durationMs: durationMicros / 1000,
    };
  }

  /**
   * Save trace data to file in appData/traces directory
   * @returns Path to the saved trace file
   */
  async save(): Promise<string> {
    try {
      // Get app data directory
      const appData = await appDataDir();
      const tracesDir = await join(appData, 'traces');

      // Ensure traces directory exists
      const dirExists = await exists(tracesDir);
      if (!dirExists) {
        await mkdir(tracesDir, { recursive: true });
        logger.info(`[Tracer] Created traces directory: ${tracesDir}`);
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `trace-${this.sessionName}-${timestamp}.json`;
      const filePath = await join(tracesDir, filename);

      // Build trace data
      const traceData: TraceData = {
        traceEvents: this.events,
        displayTimeUnit: 'ms',
        metadata: {
          ...this.metadata,
          sessionName: this.sessionName,
          sessionStartTime: new Date(this.sessionStartTime / 1000).toISOString(),
          totalDurationMs: this.getStats().durationMs,
        },
      };

      // Write to file
      const jsonContent = JSON.stringify(traceData, null, 2);
      const encoder = new TextEncoder();
      await writeFile(filePath, encoder.encode(jsonContent));

      const stats = this.getStats();
      logger.info(
        `[Tracer] Trace saved: ${filePath} (${stats.eventCount} events, ${stats.spanCount} spans, ${stats.durationMs.toFixed(2)}ms)`
      );

      return filePath;
    } catch (error) {
      logger.error('[Tracer] Failed to save trace:', error);
      throw error;
    }
  }

  /**
   * Get current timestamp in microseconds
   */
  private getMicroseconds(): number {
    // Use performance.now() for high-resolution timing
    // Convert to microseconds (performance.now() returns milliseconds)
    return Math.floor(performance.now() * 1000);
  }

  /**
   * Determine category from span name
   */
  private getCategoryFromName(name: string): string {
    // Simple heuristic based on common patterns
    if (name.includes('iteration') || name.includes('loop')) {
      return 'loop';
    }
    if (name.includes('tool') || name.includes('execute')) {
      return 'tool';
    }
    if (name.includes('stream') || name.includes('llm') || name.includes('model')) {
      return 'llm';
    }
    if (name.includes('compress') || name.includes('filter') || name.includes('process')) {
      return 'processing';
    }
    return 'function';
  }
}

/**
 * Utility function to measure and trace async operations
 * @param tracer Tracer instance
 * @param name Span name
 * @param fn Async function to execute
 * @param metadata Optional metadata
 * @returns Result of the async function
 */
export async function traceAsync<T>(
  tracer: Tracer,
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  tracer.startSpan(name, metadata);
  try {
    const result = await fn();
    tracer.endSpan(name);
    return result;
  } catch (error) {
    tracer.endSpan(name);
    throw error;
  }
}

/**
 * Utility function to measure and trace sync operations
 * @param tracer Tracer instance
 * @param name Span name
 * @param fn Function to execute
 * @param metadata Optional metadata
 * @returns Result of the function
 */
export function traceSync<T>(
  tracer: Tracer,
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  tracer.startSpan(name, metadata);
  try {
    const result = fn();
    tracer.endSpan(name);
    return result;
  } catch (error) {
    tracer.endSpan(name);
    throw error;
  }
}
