// src/stores/github-copilot-usage-store.ts
// Zustand store for GitHub Copilot usage data management

import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { isGitHubCopilotOAuthConnected } from '@/providers/oauth/github-copilot-oauth-store';
import type { GitHubCopilotUsageData } from '@/services/github-copilot-usage-service';
import { fetchGitHubCopilotUsage } from '@/services/github-copilot-usage-service';

interface GitHubCopilotUsageState {
  usageData: GitHubCopilotUsageData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  autoRefreshEnabled: boolean;
  isInitialized: boolean;
  lastAuthConnected: boolean | null;
}

interface GitHubCopilotUsageActions {
  fetchUsage: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  setAutoRefresh: (enabled: boolean) => void;
  initialize: () => Promise<void>;
}

type GitHubCopilotUsageStore = GitHubCopilotUsageState & GitHubCopilotUsageActions;

const CACHE_DURATION_MS = 2 * 60 * 1000;
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let refreshInterval: ReturnType<typeof setInterval> | null = null;

export const useGitHubCopilotUsageStore = create<GitHubCopilotUsageStore>((set, get) => ({
  usageData: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  autoRefreshEnabled: false,
  isInitialized: false,
  lastAuthConnected: null,

  initialize: async () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    logger.info('[GitHubCopilotUsageStore] Initializing');
    set({ isInitialized: true });

    await get().fetchUsage();
  },

  fetchUsage: async () => {
    const { isLoading, lastFetchedAt, lastAuthConnected } = get();

    if (isLoading) {
      logger.debug('[GitHubCopilotUsageStore] Already fetching, skipping');
      return;
    }

    const isConnected = await isGitHubCopilotOAuthConnected();

    if (!isConnected) {
      if (lastAuthConnected !== false) {
        logger.info('[GitHubCopilotUsageStore] OAuth disconnected, clearing usage data');
        set({
          usageData: null,
          lastFetchedAt: null,
          error: null,
          lastAuthConnected: false,
        });
      }
      return;
    }

    const shouldForceRefresh = lastAuthConnected === false;

    if (!shouldForceRefresh && lastFetchedAt && Date.now() - lastFetchedAt < CACHE_DURATION_MS) {
      logger.debug('[GitHubCopilotUsageStore] Using cached data');
      return;
    }

    set({ isLoading: true, error: null, lastAuthConnected: true });

    try {
      logger.info('[GitHubCopilotUsageStore] Fetching usage data');
      const usageData = await fetchGitHubCopilotUsage();

      logger.info(
        '[GitHubCopilotUsageStore] Received usage data:',
        JSON.stringify(usageData, null, 2)
      );

      if (!usageData || typeof usageData.utilization_pct !== 'number') {
        logger.error('[GitHubCopilotUsageStore] Invalid data structure:', {
          hasUsageData: !!usageData,
          utilizationType: typeof usageData?.utilization_pct,
          dataKeys: usageData ? Object.keys(usageData) : [],
        });
        throw new Error('Invalid usage data structure received from API');
      }

      set({
        usageData,
        lastFetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });

      logger.info('[GitHubCopilotUsageStore] Usage data updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[GitHubCopilotUsageStore] Failed to fetch usage:', error);

      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  refresh: async () => {
    logger.info('[GitHubCopilotUsageStore] Forcing refresh');
    set({ lastFetchedAt: null });
    await get().fetchUsage();
  },

  clear: () => {
    logger.info('[GitHubCopilotUsageStore] Clearing usage data');

    set({
      usageData: null,
      lastFetchedAt: null,
      error: null,
      lastAuthConnected: null,
    });
  },

  setAutoRefresh: (enabled: boolean) => {
    logger.info('[GitHubCopilotUsageStore] Auto-refresh:', enabled);

    set({ autoRefreshEnabled: enabled });

    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }

    if (enabled) {
      refreshInterval = setInterval(() => {
        const store = get();
        if (store.autoRefreshEnabled) {
          logger.debug('[GitHubCopilotUsageStore] Auto-refresh triggered');
          store.fetchUsage();
        }
      }, AUTO_REFRESH_INTERVAL_MS);
    }
  },
}));

export const selectGitHubCopilotUsageData = (state: GitHubCopilotUsageStore) => state.usageData;
export const selectGitHubCopilotUsageLoading = (state: GitHubCopilotUsageStore) => state.isLoading;
export const selectGitHubCopilotUsageError = (state: GitHubCopilotUsageStore) => state.error;

export async function getGitHubCopilotUsageData(): Promise<GitHubCopilotUsageData | null> {
  const store = useGitHubCopilotUsageStore.getState();

  if (!store.isInitialized) {
    await store.initialize();
  }

  return store.usageData;
}
