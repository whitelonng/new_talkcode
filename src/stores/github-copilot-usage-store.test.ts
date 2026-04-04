// src/stores/github-copilot-usage-store.test.ts
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useGitHubCopilotUsageStore } from './github-copilot-usage-store';
import { fetchGitHubCopilotUsage } from '@/services/github-copilot-usage-service';
import { isGitHubCopilotOAuthConnected } from '@/providers/oauth/github-copilot-oauth-store';

vi.mock('@/services/github-copilot-usage-service', () => ({
  fetchGitHubCopilotUsage: vi.fn(),
}));

vi.mock('@/providers/oauth/github-copilot-oauth-store', () => ({
  isGitHubCopilotOAuthConnected: vi.fn(),
}));

describe('GitHubCopilotUsageStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGitHubCopilotUsageStore.setState({
      usageData: null,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      autoRefreshEnabled: false,
      isInitialized: true,
      lastAuthConnected: null,
    });
  });

  it('skips fetch and clears usage when OAuth is disconnected', async () => {
    useGitHubCopilotUsageStore.setState({
      usageData: { utilization_pct: 42, used: 10, remaining: 10 },
      lastFetchedAt: Date.now(),
      lastAuthConnected: true,
    });

    (isGitHubCopilotOAuthConnected as Mock).mockResolvedValue(false);

    await useGitHubCopilotUsageStore.getState().fetchUsage();

    expect(fetchGitHubCopilotUsage).not.toHaveBeenCalled();
    expect(useGitHubCopilotUsageStore.getState().usageData).toBeNull();
    expect(useGitHubCopilotUsageStore.getState().lastFetchedAt).toBeNull();
    expect(useGitHubCopilotUsageStore.getState().lastAuthConnected).toBe(false);
  });

  it('forces refresh when connection flips to connected', async () => {
    const usagePayload = { utilization_pct: 12, used: 5, remaining: 35 };

    useGitHubCopilotUsageStore.setState({
      lastFetchedAt: Date.now(),
      lastAuthConnected: false,
    });

    (isGitHubCopilotOAuthConnected as Mock).mockResolvedValue(true);
    (fetchGitHubCopilotUsage as Mock).mockResolvedValue(usagePayload);

    await useGitHubCopilotUsageStore.getState().fetchUsage();

    expect(fetchGitHubCopilotUsage).toHaveBeenCalledTimes(1);
    expect(useGitHubCopilotUsageStore.getState().usageData).toEqual(usagePayload);
    expect(useGitHubCopilotUsageStore.getState().error).toBeNull();
    expect(useGitHubCopilotUsageStore.getState().lastAuthConnected).toBe(true);
  });
});
