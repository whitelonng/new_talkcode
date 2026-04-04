import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApiUsageRange, getRangeWindow, getTokenValue } from './api-usage-service';
import type { ApiUsageRangeResult } from '@/types/api-usage';

const mockDatabaseService = vi.hoisted(() => ({
  getApiUsageRangeResult: vi.fn(),
}));

vi.mock('@/services/database-service', () => ({
  databaseService: mockDatabaseService,
}));

describe('api-usage-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes today range with start of day and now', () => {
    const now = new Date('2026-01-20T12:34:56Z').getTime();
    const { startAt, endAt } = getRangeWindow('today', now);

    const expectedStart = new Date(now);
    expectedStart.setHours(0, 0, 0, 0);

    expect(startAt).toBe(expectedStart.getTime());
    expect(endAt).toBe(now);
  });

  it('computes week range as 7 days including today', () => {
    const now = new Date('2026-01-20T12:00:00Z').getTime();
    const { startAt } = getRangeWindow('week', now);

    const expectedStart = new Date(now);
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 6);

    expect(startAt).toBe(expectedStart.getTime());
  });

  it('computes month range as 30 days including today', () => {
    const now = new Date('2026-01-20T12:00:00Z').getTime();
    const { startAt } = getRangeWindow('month', now);

    const expectedStart = new Date(now);
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 29);

    expect(startAt).toBe(expectedStart.getTime());
  });

  it('returns token value by view', () => {
    expect(
      getTokenValue('total', { totalTokens: 30, inputTokens: 10, outputTokens: 20 })
    ).toBe(30);
    expect(
      getTokenValue('input', { totalTokens: 30, inputTokens: 10, outputTokens: 20 })
    ).toBe(10);
    expect(
      getTokenValue('output', { totalTokens: 30, inputTokens: 10, outputTokens: 20 })
    ).toBe(20);
  });

  it('fetches range result from database service', async () => {
    const payload: ApiUsageRangeResult = {
      summary: {
        totalCost: 0.25,
        totalTokens: 300,
        inputTokens: 100,
        outputTokens: 200,
        requestCount: 3,
      },
      daily: [],
      models: [],
    };

    mockDatabaseService.getApiUsageRangeResult.mockResolvedValue(payload);

    const result = await fetchApiUsageRange('today');

    expect(result).toEqual(payload);
    expect(mockDatabaseService.getApiUsageRangeResult).toHaveBeenCalledTimes(1);
  });
});
