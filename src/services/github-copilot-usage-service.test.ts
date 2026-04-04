// src/services/github-copilot-usage-service.test.ts
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { GitHubCopilotUsageData } from './github-copilot-usage-service';
import {
  fetchGitHubCopilotUsage,
  getRemainingPercentage,
  getUsageLevel,
} from './github-copilot-usage-service';

vi.mock('@/providers/oauth/github-copilot-oauth-store', () => ({
  getGitHubCopilotOAuthTokens: vi.fn(),
}));

vi.mock('@/lib/tauri-fetch', () => ({
  simpleFetch: vi.fn(),
}));

const { getGitHubCopilotOAuthTokens } = await import('@/providers/oauth/github-copilot-oauth-store');
const { simpleFetch } = await import('@/lib/tauri-fetch');

const mockGetGitHubCopilotOAuthTokens = getGitHubCopilotOAuthTokens as Mock;
const mockSimpleFetch = simpleFetch as Mock;

describe('github-copilot-usage-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchGitHubCopilotUsage', () => {
    it('should fetch usage data with premium_interactions snapshot', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        copilotToken: 'copilot-token',
        enterpriseUrl: null,
      });

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          copilot_plan: 'pro',
          quota_snapshots: {
            premium_interactions: { percent_remaining: 72 },
            chat: { percent_remaining: 40 },
          },
        }),
      });

      const result = await fetchGitHubCopilotUsage();

      expect(result).toEqual<GitHubCopilotUsageData>({
        utilization_pct: 28,
        plan: 'pro',
        source: 'premiumInteractions',
      });

      expect(mockSimpleFetch).toHaveBeenCalledWith(
        'https://api.github.com/copilot_internal/user',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'token test-access-token',
            Accept: 'application/json',
            'X-Github-Api-Version': '2025-04-01',
            'User-Agent': 'GitHubCopilotChat/0.35.0',
            'Editor-Version': 'vscode/1.105.1',
            'Editor-Plugin-Version': 'copilot-chat/0.35.0',
            'Copilot-Integration-Id': 'vscode-chat',
          }),
        })
      );
    });

    it('should fallback to chat snapshot when premium_interactions missing', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        copilotToken: 'copilot-token',
        enterpriseUrl: null,
      });

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          copilot_plan: 'free',
          quota_snapshots: {
            chat: { percent_remaining: 20 },
          },
        }),
      });

      const result = await fetchGitHubCopilotUsage();

      expect(result).toEqual<GitHubCopilotUsageData>({
        utilization_pct: 80,
        plan: 'free',
        source: 'chat',
      });
    });

    it('should return 100% remaining when unlimited is true', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        copilotToken: 'copilot-token',
        enterpriseUrl: null,
      });

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          copilot_plan: 'individual',
          quota_snapshots: {
            premium_interactions: { percent_remaining: 95.16, unlimited: false },
            chat: { percent_remaining: 100, unlimited: true },
          },
        }),
      });

      const result = await fetchGitHubCopilotUsage();

      expect(result.plan).toBe('individual');
      expect(result.source).toBe('premiumInteractions');
      expect(result.utilization_pct).toBeCloseTo(4.84, 2);
    });

    it('should use enterprise URL when provided', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        copilotToken: 'copilot-token',
        enterpriseUrl: 'https://enterprise.github.com',
      });

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          copilot_plan: 'team',
          quota_snapshots: {
            premium_interactions: { percent_remaining: 50 },
          },
        }),
      });

      const result = await fetchGitHubCopilotUsage();

      expect(result.utilization_pct).toBe(50);
      expect(mockSimpleFetch).toHaveBeenCalledWith(
        'https://api.enterprise.github.com/copilot_internal/user',
        expect.any(Object)
      );
    });

    it('should throw when not connected', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue(null);

      await expect(fetchGitHubCopilotUsage()).rejects.toThrow(
        'GitHub Copilot OAuth not connected. Please connect your GitHub account in settings.'
      );
    });

    it('should throw when API request fails', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        copilotToken: 'copilot-token',
        enterpriseUrl: null,
      });

      mockSimpleFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(fetchGitHubCopilotUsage()).rejects.toThrow(
        'GitHub Copilot Usage API error: 401 - Unauthorized'
      );
    });

    it('should throw when usage data missing snapshots', async () => {
      mockGetGitHubCopilotOAuthTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        copilotToken: 'copilot-token',
        enterpriseUrl: null,
      });

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ copilot_plan: 'pro' }),
      });

      await expect(fetchGitHubCopilotUsage()).rejects.toThrow(
        'GitHub Copilot usage data missing quota snapshots'
      );
    });
  });

  describe('getUsageLevel', () => {
    it('should return correct usage level', () => {
      expect(getUsageLevel(10)).toBe('low');
      expect(getUsageLevel(60)).toBe('medium');
      expect(getUsageLevel(80)).toBe('high');
      expect(getUsageLevel(95)).toBe('critical');
    });
  });

  describe('getRemainingPercentage', () => {
    it('should return remaining percentage', () => {
      expect(getRemainingPercentage(0)).toBe(100);
      expect(getRemainingPercentage(40)).toBe(60);
      expect(getRemainingPercentage(100)).toBe(0);
    });
  });
});
