/**
 * TraceService Tests
 *
 * Uses real database operations with in-memory SQLite.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceService } from './trace-service';
import { TestDatabaseAdapter } from '@/test/infrastructure/adapters/test-database-adapter';
import { mockLogger } from '@/test/mocks';

vi.mock('@/lib/logger', () => mockLogger);

describe('TraceService', () => {
  let db: TestDatabaseAdapter;
  let service: TraceService;

  beforeEach(() => {
    db = new TestDatabaseAdapter();
    service = new TraceService(db.getTursoClientAdapter());
  });

  afterEach(() => {
    db.close();
  });

  it('uses span timing for trace summary when spans exist', async () => {
    const traceId = 'trace-1';
    const spanId = 'span-1';

    db.rawExecute(
      'INSERT INTO traces (id, started_at, ended_at, metadata) VALUES (?, ?, ?, ?)',
      [traceId, 1111, 2222, null]
    );
    db.rawExecute(
      'INSERT INTO spans (id, trace_id, parent_span_id, name, started_at, ended_at, attributes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [spanId, traceId, null, 'llm.stream_completion', 5000, 8000, '{}']
    );

    const traces = await service.getTraces();
    const trace = traces.find((item) => item.id === traceId);

    expect(trace).toBeDefined();
    expect(trace?.startedAt).toBe(5000);
    expect(trace?.endedAt).toBe(8000);
    expect(trace?.spanCount).toBe(1);
  });

  it('falls back to trace timing when no spans exist', async () => {
    const traceId = 'trace-2';

    db.rawExecute(
      'INSERT INTO traces (id, started_at, ended_at, metadata) VALUES (?, ?, ?, ?)',
      [traceId, 3000, 4000, null]
    );

    const traces = await service.getTraces();
    const trace = traces.find((item) => item.id === traceId);

    expect(trace).toBeDefined();
    expect(trace?.startedAt).toBe(3000);
    expect(trace?.endedAt).toBe(4000);
    expect(trace?.spanCount).toBe(0);
  });

  it('uses span timing for trace detail when spans exist', async () => {
    const traceId = 'trace-3';
    const spanId = 'span-3';

    db.rawExecute(
      'INSERT INTO traces (id, started_at, ended_at, metadata) VALUES (?, ?, ?, ?)',
      [traceId, 1000, 2000, null]
    );
    db.rawExecute(
      'INSERT INTO spans (id, trace_id, parent_span_id, name, started_at, ended_at, attributes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [spanId, traceId, null, 'llm.stream_completion', 7000, 9000, '{}']
    );

    const detail = await service.getTraceDetails(traceId);

    expect(detail).not.toBeNull();
    expect(detail?.trace.startedAt).toBe(7000);
    expect(detail?.trace.endedAt).toBe(9000);
    expect(detail?.trace.spanCount).toBe(1);
  });

  it('creates and closes tool spans with ensureTrace', async () => {
    const traceId = 'trace-tool-1';
    const spanId = 'span-tool-1';

    await service.startSpan({
      spanId,
      traceId,
      name: 'Step1-tool-bash',
      startedAt: 1234,
      attributes: { toolName: 'bash' },
    });

    await service.endSpan(spanId, 2345);

    const detail = await service.getTraceDetails(traceId);

    expect(detail).not.toBeNull();
    expect(detail?.trace.spanCount).toBe(1);
    expect(detail?.spans[0]?.name).toBe('Step1-tool-bash');
    expect(detail?.spans[0]?.startedAt).toBe(1234);
    expect(detail?.spans[0]?.endedAt).toBe(2345);
  });
});
