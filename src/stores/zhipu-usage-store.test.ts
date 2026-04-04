// src/stores/zhipu-usage-store.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useZhipuUsageStore } from './zhipu-usage-store';
import * as zhipuUsageService from '@/services/zhipu-usage-service';

// Mock dependencies
vi.mock('@/services/zhipu-usage-service');

describe('Zhipu Usage Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useZhipuUsageStore.setState({
      usageData: null,
      isLoading: false,
      error: null,
      lastFetchTime: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should fetch usage data on first initialization', async () => {
      const mockUsageData = {
        five_hour: {
          utilization_pct: 50,
          used: 500,
          limit: 1000,
          remaining: 500,
        },
        plan_name: 'Test Plan',
      };

      (zhipuUsageService.fetchZhipuUsage as Mock).mockResolvedValue(mockUsageData);

      const { initialize } = useZhipuUsageStore.getState();
      await initialize();

      const state = useZhipuUsageStore.getState();
      expect(state.usageData).toEqual(mockUsageData);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastFetchTime).toBeDefined();
    });

    it('should skip fetch if recently fetched (within 5 minutes)', async () => {
      const mockUsageData = {
        five_hour: {
          utilization_pct: 50,
          used: 500,
          limit: 1000,
          remaining: 500,
        },
      };

      (zhipuUsageService.fetchZhipuUsage as Mock).mockResolvedValue(mockUsageData);

      // First fetch
      const { initialize } = useZhipuUsageStore.getState();
      await initialize();

      expect(zhipuUsageService.fetchZhipuUsage).toHaveBeenCalledTimes(1);

      // Second fetch immediately - should skip
      await initialize();

      expect(zhipuUsageService.fetchZhipuUsage).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should set error state on fetch failure', async () => {
      const errorMessage = 'API key not configured';
      (zhipuUsageService.fetchZhipuUsage as Mock).mockRejectedValue(new Error(errorMessage));

      const { initialize } = useZhipuUsageStore.getState();
      await initialize();

      const state = useZhipuUsageStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
      expect(state.usageData).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      const mockUsageData = {
        five_hour: {
          utilization_pct: 50,
          used: 500,
          limit: 1000,
          remaining: 500,
        },
      };

      let resolvePromise: (value: typeof mockUsageData) => void;
      const promise = new Promise<typeof mockUsageData>((resolve) => {
        resolvePromise = resolve;
      });

      (zhipuUsageService.fetchZhipuUsage as Mock).mockReturnValue(promise);

      const { initialize } = useZhipuUsageStore.getState();
      const initPromise = initialize();

      // Check loading state
      expect(useZhipuUsageStore.getState().isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!(mockUsageData);
      await initPromise;

      // Check final state
      expect(useZhipuUsageStore.getState().isLoading).toBe(false);
      expect(useZhipuUsageStore.getState().usageData).toEqual(mockUsageData);
    });
  });

  describe('refresh', () => {
    it('should always fetch data regardless of last fetch time', async () => {
      const mockUsageData1 = {
        five_hour: {
          utilization_pct: 50,
          used: 500,
          limit: 1000,
          remaining: 500,
        },
      };

      const mockUsageData2 = {
        five_hour: {
          utilization_pct: 60,
          used: 600,
          limit: 1000,
          remaining: 400,
        },
      };

      (zhipuUsageService.fetchZhipuUsage as Mock)
        .mockResolvedValueOnce(mockUsageData1)
        .mockResolvedValueOnce(mockUsageData2);

      // First fetch
      const { initialize, refresh } = useZhipuUsageStore.getState();
      await initialize();

      expect(useZhipuUsageStore.getState().usageData).toEqual(mockUsageData1);

      // Refresh should fetch again
      await refresh();

      expect(zhipuUsageService.fetchZhipuUsage).toHaveBeenCalledTimes(2);
      expect(useZhipuUsageStore.getState().usageData).toEqual(mockUsageData2);
    });

    it('should handle errors during refresh', async () => {
      const errorMessage = 'Network error';
      (zhipuUsageService.fetchZhipuUsage as Mock).mockRejectedValue(new Error(errorMessage));

      const { refresh } = useZhipuUsageStore.getState();
      await refresh();

      const state = useZhipuUsageStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      const mockUsageData = {
        five_hour: {
          utilization_pct: 50,
          used: 500,
          limit: 1000,
          remaining: 500,
        },
      };

      (zhipuUsageService.fetchZhipuUsage as Mock).mockResolvedValue(mockUsageData);

      // Fetch some data first
      const { initialize, reset } = useZhipuUsageStore.getState();
      await initialize();

      expect(useZhipuUsageStore.getState().usageData).not.toBeNull();

      // Reset
      reset();

      const state = useZhipuUsageStore.getState();
      expect(state.usageData).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastFetchTime).toBeNull();
    });
  });
});
