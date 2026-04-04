// src/stores/minimax-usage-store.ts
// Zustand store for managing MiniMax Coding Plan usage data

import { create } from 'zustand';
import { logger } from '@/lib/logger';
import type { MinimaxUsageData } from '@/services/minimax-usage-service';
import { fetchMinimaxUsage } from '@/services/minimax-usage-service';

interface MinimaxUsageStore {
  // State
  usageData: MinimaxUsageData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number | null;

  // Actions
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useMinimaxUsageStore = create<MinimaxUsageStore>((set, get) => ({
  // Initial State
  usageData: null,
  isLoading: false,
  error: null,
  lastFetchTime: null,

  // Initialize - fetch usage data on first load
  initialize: async () => {
    const { lastFetchTime } = get();

    // Skip if already fetched recently (within 5 minutes)
    if (lastFetchTime && Date.now() - lastFetchTime < 5 * 60 * 1000) {
      logger.info('[MinimaxUsageStore] Skipping fetch - recently fetched');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await fetchMinimaxUsage();
      set({
        usageData: data,
        isLoading: false,
        error: null,
        lastFetchTime: Date.now(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[MinimaxUsageStore] Failed to initialize:', error);
      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  // Refresh - manually refresh usage data
  refresh: async () => {
    set({ isLoading: true, error: null });

    try {
      const data = await fetchMinimaxUsage();
      set({
        usageData: data,
        isLoading: false,
        error: null,
        lastFetchTime: Date.now(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[MinimaxUsageStore] Failed to refresh:', error);
      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  // Reset - clear all data
  reset: () => {
    set({
      usageData: null,
      isLoading: false,
      error: null,
      lastFetchTime: null,
    });
  },
}));
