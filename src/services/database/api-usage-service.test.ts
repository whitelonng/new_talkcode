import { beforeEach, describe, expect, it } from 'vitest';
import { ApiUsageService } from './api-usage-service';

interface ResultSet {
  rows: unknown[];
  rowsAffected?: number;
}

type UsageEvent = {
  id: string;
  conversationId?: string | null;
  model: string;
  providerId?: string | null;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: number;
};

type MemoryTursoClientOptions = {
  supportProviderId?: boolean;
};

class MemoryTursoClient {
  private events: UsageEvent[] = [];
  private supportProviderId: boolean;

  constructor(options: MemoryTursoClientOptions = {}) {
    this.supportProviderId = options.supportProviderId ?? true;
  }

  async execute(sql: string, params?: unknown[]): Promise<ResultSet> {
    if (!sql.trim().startsWith('INSERT INTO api_usage_events')) {
      throw new Error('Unexpected SQL execute statement.');
    }

    const [
      id,
      conversationId,
      model,
      providerId,
      inputTokens,
      outputTokens,
      cost,
      createdAt,
    ] = params ?? [];

    this.events.push({
      id: id as string,
      conversationId: conversationId as string | null | undefined,
      model: model as string,
      providerId: providerId as string | null | undefined,
      inputTokens: Number(inputTokens ?? 0),
      outputTokens: Number(outputTokens ?? 0),
      cost: Number(cost ?? 0),
      createdAt: Number(createdAt ?? 0),
    });

    return { rows: [], rowsAffected: 1 };
  }

  async select<T = unknown[]>(sql: string, params?: unknown[]): Promise<T> {
    const [startAt, endAt] = (params ?? []) as [number, number];
    const eventsInRange = this.events.filter(
      (event) => event.createdAt >= startAt && event.createdAt <= endAt
    );

    if (sql.includes('GROUP BY model, provider_id')) {
      if (!this.supportProviderId) {
        return [] as T;
      }

      const breakdown = new Map<string, UsageEvent[]>();

      for (const event of eventsInRange) {
        const key = `${event.model}::${event.providerId ?? ''}`;
        const existing = breakdown.get(key) ?? [];
        existing.push(event);
        breakdown.set(key, existing);
      }

      const rows = Array.from(breakdown.entries()).map(([key, events]) => {
        const [model, providerId] = key.split('::');
        const totals = events.map((event) => event.inputTokens + event.outputTokens);
        const sumCost = events.reduce((sum, event) => sum + event.cost, 0);
        const sumInput = events.reduce((sum, event) => sum + event.inputTokens, 0);
        const sumOutput = events.reduce((sum, event) => sum + event.outputTokens, 0);
        const count = events.length;
        const minInput = Math.min(...events.map((event) => event.inputTokens));
        const maxInput = Math.max(...events.map((event) => event.inputTokens));
        const minOutput = Math.min(...events.map((event) => event.outputTokens));
        const maxOutput = Math.max(...events.map((event) => event.outputTokens));

        return {
          model,
          provider_id: providerId || null,
          total_cost: sumCost,
          input_tokens: sumInput,
          output_tokens: sumOutput,
          request_count: count,
          min_total_tokens: Math.min(...totals),
          max_total_tokens: Math.max(...totals),
          avg_total_tokens: count ? (sumInput + sumOutput) / count : 0,
          min_input_tokens: minInput,
          max_input_tokens: maxInput,
          avg_input_tokens: count ? sumInput / count : 0,
          min_output_tokens: minOutput,
          max_output_tokens: maxOutput,
          avg_output_tokens: count ? sumOutput / count : 0,
        };
      });

      rows.sort((a, b) => {
        if (b.total_cost !== a.total_cost) {
          return b.total_cost - a.total_cost;
        }
        return b.request_count - a.request_count;
      });

      return rows as T;
    }

    if (sql.includes('GROUP BY model')) {
      const breakdown = new Map<string, UsageEvent[]>();

      for (const event of eventsInRange) {
        const existing = breakdown.get(event.model) ?? [];
        existing.push(event);
        breakdown.set(event.model, existing);
      }

      const rows = Array.from(breakdown.entries()).map(([model, events]) => {
        const totals = events.map((event) => event.inputTokens + event.outputTokens);
        const sumCost = events.reduce((sum, event) => sum + event.cost, 0);
        const sumInput = events.reduce((sum, event) => sum + event.inputTokens, 0);
        const sumOutput = events.reduce((sum, event) => sum + event.outputTokens, 0);
        const count = events.length;
        const minInput = Math.min(...events.map((event) => event.inputTokens));
        const maxInput = Math.max(...events.map((event) => event.inputTokens));
        const minOutput = Math.min(...events.map((event) => event.outputTokens));
        const maxOutput = Math.max(...events.map((event) => event.outputTokens));

        return {
          model,
          total_cost: sumCost,
          input_tokens: sumInput,
          output_tokens: sumOutput,
          request_count: count,
          min_total_tokens: Math.min(...totals),
          max_total_tokens: Math.max(...totals),
          avg_total_tokens: count ? (sumInput + sumOutput) / count : 0,
          min_input_tokens: minInput,
          max_input_tokens: maxInput,
          avg_input_tokens: count ? sumInput / count : 0,
          min_output_tokens: minOutput,
          max_output_tokens: maxOutput,
          avg_output_tokens: count ? sumOutput / count : 0,
        };
      });

      rows.sort((a, b) => {
        if (b.total_cost !== a.total_cost) {
          return b.total_cost - a.total_cost;
        }
        return b.request_count - a.request_count;
      });

      return rows as T;
    }

    if (sql.includes('GROUP BY day')) {
      const dailyMap = new Map<string, UsageEvent[]>();

      for (const event of eventsInRange) {
        const day = new Date(event.createdAt).toISOString().slice(0, 10);
        const existing = dailyMap.get(day) ?? [];
        existing.push(event);
        dailyMap.set(day, existing);
      }

      const rows = Array.from(dailyMap.entries())
        .map(([day, events]) => {
          const sumCost = events.reduce((sum, event) => sum + event.cost, 0);
          const sumInput = events.reduce((sum, event) => sum + event.inputTokens, 0);
          const sumOutput = events.reduce((sum, event) => sum + event.outputTokens, 0);
          return {
            day,
            total_cost: sumCost,
            input_tokens: sumInput,
            output_tokens: sumOutput,
            request_count: events.length,
          };
        })
        .sort((a, b) => a.day.localeCompare(b.day));

      return rows as T;
    }

    const totalCost = eventsInRange.reduce((sum, event) => sum + event.cost, 0);
    const totalInput = eventsInRange.reduce((sum, event) => sum + event.inputTokens, 0);
    const totalOutput = eventsInRange.reduce((sum, event) => sum + event.outputTokens, 0);

    return [
      {
        total_cost: totalCost,
        input_tokens: totalInput,
        output_tokens: totalOutput,
        request_count: eventsInRange.length,
      },
    ] as T;
  }
}

function toMs(dateString: string): number {
  return new Date(dateString).getTime();
}

describe('ApiUsageService', () => {
  let service: ApiUsageService;

  beforeEach(() => {
    service = new ApiUsageService(new MemoryTursoClient());
  });

  it('aggregates summary across range', async () => {
    await service.insertUsageEvent({
      id: 'event-1',
      conversationId: 'task-1',
      model: 'gpt-5.1',
      providerId: 'openai',
      inputTokens: 100,
      outputTokens: 200,
      cost: 0.02,
      createdAt: toMs('2026-01-20T01:00:00Z'),
    });

    await service.insertUsageEvent({
      id: 'event-2',
      conversationId: 'task-2',
      model: 'gpt-5.1',
      providerId: 'openai',
      inputTokens: 50,
      outputTokens: 50,
      cost: 0.01,
      createdAt: toMs('2026-01-20T02:00:00Z'),
    });

    const summary = await service.getRangeSummary(
      toMs('2026-01-20T00:00:00Z'),
      toMs('2026-01-20T23:59:59Z')
    );

    expect(summary.totalCost).toBeCloseTo(0.03, 5);
    expect(summary.inputTokens).toBe(150);
    expect(summary.outputTokens).toBe(250);
    expect(summary.totalTokens).toBe(400);
    expect(summary.requestCount).toBe(2);
  });

  it('returns model breakdown grouped by model', async () => {
    await service.insertUsageEvent({
      id: 'event-3',
      conversationId: 'task-1',
      model: 'gpt-5.1',
      providerId: 'openai',
      inputTokens: 100,
      outputTokens: 100,
      cost: 0.02,
      createdAt: toMs('2026-01-19T10:00:00Z'),
    });
    await service.insertUsageEvent({
      id: 'event-4',
      conversationId: 'task-1',
      model: 'gemini-2.5',
      providerId: 'google',
      inputTokens: 50,
      outputTokens: 75,
      cost: 0.01,
      createdAt: toMs('2026-01-19T11:00:00Z'),
    });

    const breakdown = await service.getModelBreakdown(
      toMs('2026-01-19T00:00:00Z'),
      toMs('2026-01-19T23:59:59Z')
    );

    const gpt = breakdown.find((row) => row.model === 'gpt-5.1');
    const gemini = breakdown.find((row) => row.model === 'gemini-2.5');

    expect(gpt?.requestCount).toBe(1);
    expect(gpt?.inputTokens).toBe(100);
    expect(gpt?.outputTokens).toBe(100);
    expect(gpt?.minTotalTokens).toBe(200);
    expect(gpt?.maxTotalTokens).toBe(200);
    expect(gpt?.avgTotalTokens).toBe(200);
    expect(gpt?.minInputTokens).toBe(100);
    expect(gpt?.maxInputTokens).toBe(100);
    expect(gpt?.avgInputTokens).toBe(100);
    expect(gpt?.minOutputTokens).toBe(100);
    expect(gpt?.maxOutputTokens).toBe(100);
    expect(gpt?.avgOutputTokens).toBe(100);

    expect(gemini?.requestCount).toBe(1);
    expect(gemini?.inputTokens).toBe(50);
    expect(gemini?.outputTokens).toBe(75);
    expect(gemini?.minTotalTokens).toBe(125);
    expect(gemini?.maxTotalTokens).toBe(125);
    expect(gemini?.avgTotalTokens).toBe(125);
    expect(gemini?.minInputTokens).toBe(50);
    expect(gemini?.maxInputTokens).toBe(50);
    expect(gemini?.avgInputTokens).toBe(50);
    expect(gemini?.minOutputTokens).toBe(75);
    expect(gemini?.maxOutputTokens).toBe(75);
    expect(gemini?.avgOutputTokens).toBe(75);
  });

  it('falls back to model-only breakdown when provider column is missing', async () => {
    const legacyService = new ApiUsageService(
      new MemoryTursoClient({ supportProviderId: false })
    );

    await legacyService.insertUsageEvent({
      id: 'event-7',
      conversationId: 'task-1',
      model: 'gpt-5.1',
      providerId: null,
      inputTokens: 10,
      outputTokens: 20,
      cost: 0.005,
      createdAt: toMs('2026-01-19T12:00:00Z'),
    });

    const breakdown = await legacyService.getModelBreakdown(
      toMs('2026-01-19T00:00:00Z'),
      toMs('2026-01-19T23:59:59Z')
    );

    const gpt = breakdown.find((row) => row.model === 'gpt-5.1');
    expect(gpt).toBeDefined();
    expect(gpt?.providerId).toBeNull();
    expect(gpt?.requestCount).toBe(1);
    expect(gpt?.totalTokens).toBe(30);
  });

  it('returns daily series ordered by day', async () => {
    await service.insertUsageEvent({
      id: 'event-5',
      conversationId: 'task-1',
      model: 'gpt-5.1',
      providerId: 'openai',
      inputTokens: 10,
      outputTokens: 20,
      cost: 0.001,
      createdAt: toMs('2026-01-18T10:00:00Z'),
    });
    await service.insertUsageEvent({
      id: 'event-6',
      conversationId: 'task-1',
      model: 'gpt-5.1',
      providerId: 'openai',
      inputTokens: 20,
      outputTokens: 40,
      cost: 0.002,
      createdAt: toMs('2026-01-19T10:00:00Z'),
    });

    const daily = await service.getDailySeries(
      toMs('2026-01-18T00:00:00Z'),
      toMs('2026-01-19T23:59:59Z')
    );

    expect(daily).toHaveLength(2);
    expect(daily[0]?.date).toBeDefined();
    expect(daily[1]?.date).toBeDefined();
    expect(daily[0]?.totalTokens).toBe(30);
    expect(daily[1]?.totalTokens).toBe(60);
  });
});
