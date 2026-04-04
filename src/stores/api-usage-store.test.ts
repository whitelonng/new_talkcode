// src/stores/api-usage-store.test.ts
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useApiUsageStore } from './api-usage-store';
import { fetchApiUsageRange } from '@/services/api-usage-service';
import type { ApiUsageRangeResult } from '@/types/api-usage';

vi.mock('@/services/api-usage-service', () => ({
  fetchApiUsageRange: vi.fn(),
}));

describe('ApiUsageStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useApiUsageStore.setState({
      range: 'week',
      tokenView: 'total',
      data: null,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      autoRefreshEnabled: false,
    });
  });

  afterEach(() => {
    useApiUsageStore.getState().setAutoRefresh(false);
    vi.useRealTimers();
  });

  it('defaults range to week', () => {
    expect(useApiUsageStore.getState().range).toBe('week');
  });

  it('auto-refresh triggers fetch and can be disabled', async () => {
    const payload: ApiUsageRangeResult = {
      summary: {
        totalCost: 0.12,
        totalTokens: 1200,
        inputTokens: 600,
        outputTokens: 600,
        requestCount: 6,
      },
      daily: [],
      models: [],
    };

    (fetchApiUsageRange as Mock).mockResolvedValue(payload);

    const store = useApiUsageStore.getState();
    store.setAutoRefresh(true);

    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(fetchApiUsageRange).toHaveBeenCalledTimes(1);

    store.setAutoRefresh(false);

    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(fetchApiUsageRange).toHaveBeenCalledTimes(1);
  });

  it('initialize refreshes even when data exists', async () => {
    const payload: ApiUsageRangeResult = {
      summary: {
        totalCost: 1.2,
        totalTokens: 2400,
        inputTokens: 1200,
        outputTokens: 1200,
        requestCount: 12,
      },
      daily: [],
      models: [],
    };

    useApiUsageStore.setState({
      data: payload,
      lastFetchedAt: null,
    });

    (fetchApiUsageRange as Mock).mockResolvedValue(payload);

    await useApiUsageStore.getState().initialize();

    expect(fetchApiUsageRange).toHaveBeenCalledTimes(1);
  });
});
