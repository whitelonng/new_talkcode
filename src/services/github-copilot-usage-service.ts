// src/services/github-copilot-usage-service.ts
// Service for fetching GitHub Copilot usage data via OAuth API

import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import { COPILOT_HEADERS } from '@/providers/oauth/github-copilot-oauth-service';
import { getGitHubCopilotOAuthTokens } from '@/providers/oauth/github-copilot-oauth-store';

const GITHUB_API_VERSION = '2025-04-01';

interface GitHubCopilotQuotaSnapshot {
  percent_remaining?: number;
  unlimited?: boolean;
  entitlement?: number;
  remaining?: number;
}

interface GitHubCopilotUsageApiResponse {
  copilot_plan?: string | null;
  quota_reset_date?: string | null;
  quota_snapshots?: {
    premium_interactions?: GitHubCopilotQuotaSnapshot | null;
    chat?: GitHubCopilotQuotaSnapshot | null;
  };
}

export interface GitHubCopilotUsageData {
  utilization_pct: number;
  plan?: string;
  source?: 'premiumInteractions' | 'chat';
  entitlement?: number;
  remaining?: number;
  used?: number;
  reset_date?: string;
}

function normalizeDomain(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function getCopilotUsageUrl(enterpriseUrl?: string): string {
  const domain = enterpriseUrl ? normalizeDomain(enterpriseUrl) : 'github.com';
  return `https://api.${domain}/copilot_internal/user`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function getPercentRemaining(
  snapshot: GitHubCopilotQuotaSnapshot | null | undefined
): number | null {
  if (!snapshot) return null;

  // If unlimited, return 100% remaining
  if (snapshot.unlimited) {
    return 100;
  }

  if (typeof snapshot.percent_remaining !== 'number') return null;
  if (Number.isNaN(snapshot.percent_remaining)) return null;
  return snapshot.percent_remaining;
}

/**
 * Fetch GitHub Copilot usage data from OAuth API
 */
export async function fetchGitHubCopilotUsage(): Promise<GitHubCopilotUsageData> {
  try {
    const tokens = await getGitHubCopilotOAuthTokens();
    const accessToken = tokens?.accessToken;

    if (!accessToken) {
      throw new Error(
        'GitHub Copilot OAuth not connected. Please connect your GitHub account in settings.'
      );
    }

    const url = getCopilotUsageUrl(tokens?.enterpriseUrl || undefined);

    logger.info('[GitHubCopilotUsage] Fetching usage data');

    const response = await simpleFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/json',
        'X-Github-Api-Version': GITHUB_API_VERSION,
        ...COPILOT_HEADERS,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[GitHubCopilotUsage] API error:', response.status, errorText);
      throw new Error(`GitHub Copilot Usage API error: ${response.status} - ${errorText}`);
    }

    const apiData = (await response.json()) as GitHubCopilotUsageApiResponse;

    logger.info('[GitHubCopilotUsage] Raw API response:', JSON.stringify(apiData, null, 2));

    const premiumSnapshot = apiData.quota_snapshots?.premium_interactions;
    const chatSnapshot = apiData.quota_snapshots?.chat;

    const premiumRemaining = getPercentRemaining(premiumSnapshot);
    const chatRemaining = getPercentRemaining(chatSnapshot);

    let remainingPct: number | null = premiumRemaining;
    let source: GitHubCopilotUsageData['source'] = 'premiumInteractions';
    let activeSnapshot = premiumSnapshot;

    if (remainingPct === null) {
      remainingPct = chatRemaining;
      source = 'chat';
      activeSnapshot = chatSnapshot;
    }

    if (remainingPct === null) {
      throw new Error('GitHub Copilot usage data missing quota snapshots');
    }

    const utilizationPct = clampPercent(100 - remainingPct);

    const entitlement = activeSnapshot?.entitlement;
    const remainingCount = activeSnapshot?.remaining;
    const usedCount =
      entitlement !== undefined && remainingCount !== undefined
        ? entitlement - remainingCount
        : undefined;

    const data: GitHubCopilotUsageData = {
      utilization_pct: utilizationPct,
      plan: typeof apiData.copilot_plan === 'string' ? apiData.copilot_plan : undefined,
      source,
      entitlement,
      remaining: remainingCount,
      used: usedCount,
      reset_date: apiData.quota_reset_date || undefined,
    };

    logger.info('[GitHubCopilotUsage] Usage data fetched successfully', {
      utilization_pct: data.utilization_pct,
      plan: data.plan,
      source: data.source,
    });

    return data;
  } catch (error) {
    logger.error('[GitHubCopilotUsage] Failed to fetch usage:', error);
    throw error;
  }
}

/**
 * Get usage level indicator
 */
export function getUsageLevel(utilizationPct: number): 'low' | 'medium' | 'high' | 'critical' {
  if (utilizationPct < 50) return 'low';
  if (utilizationPct < 75) return 'medium';
  if (utilizationPct < 90) return 'high';
  return 'critical';
}

/**
 * Get remaining percentage
 */
export function getRemainingPercentage(utilizationPct: number): number {
  return Math.max(0, 100 - utilizationPct);
}
