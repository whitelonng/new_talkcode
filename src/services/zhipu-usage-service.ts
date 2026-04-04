// src/services/zhipu-usage-service.ts
// Service for fetching Zhipu AI Coding Plan usage data via API

import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import { settingsManager } from '@/stores/settings-store';

/**
 * Zhipu AI Usage API endpoint
 * Based on Z.AI API structure (https://api.z.ai/api/monitor/usage/quota/limit)
 * Zhipu uses the same API structure as Z.AI
 */
const ZHIPU_USAGE_API_URL = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';

/**
 * API response structure for usage limit
 */
interface ZhipuApiLimit {
  type: string; // 'TOKENS_LIMIT' or 'TIME_LIMIT'
  usage: number; // This is the limit/quota
  currentValue: number; // This is the used amount
  remaining: number;
  percentage: number; // Usage percentage
  unit: number; // Unit code: 3=hours, 5=minutes
  number: number; // Duration number
  nextResetTime?: number; // Epoch timestamp in milliseconds
  usageDetails?: ZhipuApiUsageDetail[];
}

/**
 * API response structure for usage details per model (from API)
 */
interface ZhipuApiUsageDetail {
  modelCode: string;
  usage: number;
}

/**
 * Internal usage detail structure (after mapping)
 */
export interface ZhipuUsageDetail {
  model: string;
  used: number;
  limit: number;
}

/**
 * API response from Zhipu usage endpoint
 */
interface ZhipuApiResponse {
  data: {
    planName?: string;
    plan?: string;
    plan_type?: string;
    packageName?: string;
    limits: ZhipuApiLimit[];
    usageDetails?: ZhipuApiUsageDetail[];
  };
}

/**
 * Usage window data structure (internal)
 */
export interface ZhipuUsageWindow {
  utilization_pct: number; // 0-100
  used: number;
  limit: number;
  remaining: number;
  reset_at?: string; // ISO 8601 timestamp
}

/**
 * Complete Zhipu AI Coding Plan usage data (internal)
 */
export interface ZhipuUsageData {
  five_hour: ZhipuUsageWindow;
  plan_name?: string;
  usage_details?: ZhipuUsageDetail[];
}

/**
 * Fetch Zhipu AI Coding Plan usage data from API
 *
 * @returns Zhipu usage data including session limits
 * @throws Error if API key not set or API call fails
 */
export async function fetchZhipuUsage(): Promise<ZhipuUsageData> {
  try {
    // Get API key from settings
    const apiKeys = await settingsManager.getApiKeys();
    const apiKey = apiKeys.zhipu;

    if (!apiKey) {
      throw new Error('Zhipu API key not configured. Please add your API key in settings.');
    }

    logger.info('[ZhipuUsage] Fetching usage data');

    // Call Zhipu Usage API
    const response = await simpleFetch(ZHIPU_USAGE_API_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[ZhipuUsage] API error:', response.status, errorText);
      throw new Error(`Zhipu Usage API error: ${response.status} - ${errorText}`);
    }

    const apiData = (await response.json()) as ZhipuApiResponse;

    // Log full response for debugging
    logger.info('[ZhipuUsage] Raw API response:', JSON.stringify(apiData, null, 2));

    // Find the primary token limit (5-hour window for Coding Plan)
    const tokensLimit = apiData.data.limits.find((limit) => limit.type === 'TOKENS_LIMIT');

    if (!tokensLimit) {
      throw new Error('No token limit found in API response');
    }

    // Calculate utilization percentage
    // API returns percentage directly, but we can also calculate from currentValue/usage
    const utilizationPct =
      tokensLimit.percentage ||
      (tokensLimit.usage > 0 ? (tokensLimit.currentValue / tokensLimit.usage) * 100 : 0);

    // Convert nextResetTime to ISO 8601 string if present
    const resetAt = tokensLimit.nextResetTime
      ? new Date(tokensLimit.nextResetTime).toISOString()
      : undefined;

    const data: ZhipuUsageData = {
      five_hour: {
        utilization_pct: utilizationPct,
        used: tokensLimit.currentValue, // Map currentValue to used
        limit: tokensLimit.usage, // Map usage to limit
        remaining: tokensLimit.remaining,
        reset_at: resetAt,
      },
      plan_name:
        apiData.data.planName ||
        apiData.data.plan ||
        apiData.data.plan_type ||
        apiData.data.packageName,
      usage_details: tokensLimit.usageDetails?.map((detail) => ({
        model: detail.modelCode || '',
        used: detail.usage || 0,
        limit: 0, // Not provided in this response structure
      })),
    };

    logger.info('[ZhipuUsage] Usage data fetched successfully', {
      fiveHour: data.five_hour?.utilization_pct,
      planName: data.plan_name,
    });

    return data;
  } catch (error) {
    logger.error('[ZhipuUsage] Failed to fetch usage:', error);
    throw error;
  }
}

/**
 * Calculate time remaining until reset
 *
 * @param resetAt ISO 8601 timestamp
 * @returns Human-readable time remaining string
 */
export function getTimeUntilReset(resetAt: string): string {
  const resetTime = new Date(resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;

  if (diffMs <= 0) {
    return 'Resetting soon...';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get usage level indicator
 *
 * @param utilizationPct Usage percentage (0-100)
 * @returns 'low' | 'medium' | 'high' | 'critical'
 */
export function getUsageLevel(utilizationPct: number): 'low' | 'medium' | 'high' | 'critical' {
  if (utilizationPct < 50) return 'low';
  if (utilizationPct < 75) return 'medium';
  if (utilizationPct < 90) return 'high';
  return 'critical';
}

/**
 * Get remaining percentage
 *
 * @param utilizationPct Usage percentage (0-100)
 * @returns Remaining percentage (0-100)
 */
export function getRemainingPercentage(utilizationPct: number): number {
  return Math.max(0, 100 - utilizationPct);
}
