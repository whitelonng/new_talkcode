// src/services/minimax-usage-service.ts
// Service for fetching MiniMax Coding Plan usage data via manual cookie configuration

import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import { settingsManager } from '@/stores/settings-store';

/**
 * MiniMax Coding Plan Usage API endpoint
 */
const MINIMAX_USAGE_API_URL = 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains';

/**
 * Parsed credentials from cURL or manual input
 */
interface MinimaxCredentials {
  cookie: string;
  authorization?: string;
  groupId?: string;
}

/**
 * API response from MiniMax coding plan remains endpoint
 */
interface MinimaxApiResponse {
  model_remains?: Array<{
    model_name?: string;
    start_time?: number;
    end_time?: number;
    current_interval_usage_count?: number;
    current_interval_total_count?: number;
    remains_time?: number;
  }>;
  plan?: string;
  plan_name?: string;
  base_resp?: {
    status_code: number;
    status_msg?: string;
  };
}

/**
 * Usage window data structure (internal)
 */
export interface MinimaxUsageWindow {
  utilization_pct: number; // 0-100
  used: number;
  total: number;
  remaining: number;
  reset_at?: string; // ISO 8601 timestamp
}

/**
 * Complete MiniMax Coding Plan usage data (internal)
 */
export interface MinimaxUsageData {
  five_hour: MinimaxUsageWindow;
  plan?: string;
  last_validated_at: string; // When the cookie was last successfully validated
}

/**
 * Parse cURL command to extract credentials
 *
 * Supports two formats:
 * 1. Full cURL command (from "Copy as cURL")
 * 2. Cookie header only
 *
 * @param curlString cURL command or cookie header
 * @returns Parsed credentials
 */
export function parseCurlCommand(curlString: string): MinimaxCredentials {
  const credentials: MinimaxCredentials = {
    cookie: '',
  };

  // If it's a simple cookie string (not a cURL command)
  if (!curlString.trim().startsWith('curl')) {
    credentials.cookie = curlString.trim();
    return credentials;
  }

  // Extract Cookie header from -b or --cookie flag
  const cookieMatch =
    curlString.match(/-b\s+'([^']+)'/) ||
    curlString.match(/-b\s+"([^"]+)"/) ||
    curlString.match(/--cookie\s+'([^']+)'/) ||
    curlString.match(/--cookie\s+"([^"]+)"/);

  if (cookieMatch?.[1]) {
    credentials.cookie = cookieMatch[1];
  }

  // Extract Authorization header if present
  const authMatch =
    curlString.match(/-H\s+'[Aa]uthorization:\s*Bearer\s+([^']+)'/) ||
    curlString.match(/-H\s+"[Aa]uthorization:\s*Bearer\s+([^"]+)"/);

  if (authMatch) {
    credentials.authorization = `Bearer ${authMatch[1]}`;
  }

  // Extract GroupId from URL query parameter
  const groupIdMatch = curlString.match(/[?&]GroupId=([^&\s'"\n]+)/);
  if (groupIdMatch) {
    credentials.groupId = groupIdMatch[1];
  }

  return credentials;
}

/**
 * Fetch MiniMax Coding Plan usage data from API
 *
 * @returns MiniMax usage data
 * @throws Error if cookie not configured or API call fails
 */
export async function fetchMinimaxUsage(): Promise<MinimaxUsageData> {
  try {
    // Get stored credentials from settings
    const curlString = settingsManager.getMinimaxCookie();

    if (!curlString) {
      throw new Error('MiniMax cookie not configured. Please add your cookie in settings.');
    }

    logger.info('[MinimaxUsage] Parsing credentials');

    // Parse credentials from stored cURL/cookie string
    const credentials = parseCurlCommand(curlString);

    if (!credentials.cookie) {
      throw new Error('Invalid cookie format. Please check your cookie configuration.');
    }

    // Build API URL with GroupId if available
    let apiUrl = MINIMAX_USAGE_API_URL;
    if (credentials.groupId) {
      apiUrl += `?GroupId=${credentials.groupId}`;
    }

    logger.info('[MinimaxUsage] Fetching usage data', { hasGroupId: !!credentials.groupId });

    // Prepare headers
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en',
      Cookie: credentials.cookie,
      Referer: 'https://platform.minimaxi.com/',
      Origin: 'https://platform.minimaxi.com',
    };

    // Add Authorization header if present
    if (credentials.authorization) {
      headers.Authorization = credentials.authorization;
    }

    // Call MiniMax Usage API
    const response = await simpleFetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[MinimaxUsage] API error:', response.status, errorText);

      // Check for common error codes
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'SESSION_EXPIRED: Your MiniMax session has expired. Please update your cookie in settings.'
        );
      }

      // MiniMax sometimes returns 4xx with body indicating cookie missing
      if (response.status === 400 || response.status === 404) {
        const lower = errorText.toLowerCase();
        if (lower.includes('cookie is missing')) {
          throw new Error(
            'SESSION_EXPIRED: Your MiniMax session cookie is missing or expired. Please update your cookie.'
          );
        }
      }

      throw new Error(`MiniMax Usage API error: ${response.status} - ${errorText}`);
    }

    const apiData = (await response.json()) as MinimaxApiResponse;

    // Log full response for debugging
    logger.info('[MinimaxUsage] Raw API response:', JSON.stringify(apiData, null, 2));

    // Check API response status
    if (apiData.base_resp?.status_code !== 0) {
      const statusCode = apiData.base_resp?.status_code;
      const errorMsg = apiData.base_resp?.status_msg || 'Unknown error';
      const normalizedMsg = errorMsg.toLowerCase();
      logger.error('[MinimaxUsage] API error:', {
        status_code: statusCode,
        status_msg: errorMsg,
        fullResponse: apiData,
      });

      // Treat MiniMax cookie missing/expired as session expired so UI can prompt re-entry
      if (statusCode === 1004 || normalizedMsg.includes('cookie is missing')) {
        throw new Error(
          'SESSION_EXPIRED: Your MiniMax session cookie is missing or expired. Please update your cookie.'
        );
      }

      throw new Error(`API returned error (status ${statusCode}): ${errorMsg}`);
    }

    if (!apiData.model_remains || apiData.model_remains.length === 0) {
      throw new Error('No usage data found in API response');
    }

    const modelData = apiData.model_remains[0];

    if (!modelData) {
      throw new Error('No usage data found in API response');
    }

    // Note: current_interval_usage_count is the REMAINING count, not used count
    const total = modelData.current_interval_total_count || 0;
    const remaining = modelData.current_interval_usage_count || 0;

    // Calculate used count with special handling
    // If remaining > total (edge case), use min(remaining, total)
    // Otherwise, use max(0, total - remaining)
    const used = remaining > total ? Math.min(remaining, total) : Math.max(0, total - remaining);

    // Calculate utilization percentage
    const utilizationPct = total > 0 ? (used / total) * 100 : 0;

    // Convert end_time or remains_time to ISO 8601 timestamp
    // Prefer end_time as it's more accurate
    let resetAt: string | undefined;
    if (modelData.end_time) {
      // end_time is an epoch timestamp in milliseconds
      resetAt = new Date(modelData.end_time).toISOString();
    } else if (modelData.remains_time) {
      // Fallback to remains_time (seconds from now)
      resetAt = new Date(Date.now() + modelData.remains_time * 1000).toISOString();
    }

    const data: MinimaxUsageData = {
      five_hour: {
        utilization_pct: utilizationPct,
        used,
        total,
        remaining,
        reset_at: resetAt,
      },
      plan: apiData.plan_name || apiData.plan || modelData.model_name,
      last_validated_at: new Date().toISOString(),
    };

    logger.info('[MinimaxUsage] Usage data fetched successfully', {
      utilizationPct: data.five_hour.utilization_pct,
      used,
      total,
      plan: data.plan,
    });

    return data;
  } catch (error) {
    logger.error('[MinimaxUsage] Failed to fetch usage:', error);
    throw error;
  }
}

/**
 * Test cookie validity by making a test API call
 *
 * @param curlString cURL command or cookie header to test
 * @returns true if valid, throws error if invalid
 */
export async function testMinimaxCookie(curlString: string): Promise<boolean> {
  try {
    const credentials = parseCurlCommand(curlString);

    if (!credentials.cookie) {
      throw new Error('Invalid cookie format');
    }

    // Build API URL
    let apiUrl = MINIMAX_USAGE_API_URL;
    if (credentials.groupId) {
      apiUrl += `?GroupId=${credentials.groupId}`;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en',
      Cookie: credentials.cookie,
      Referer: 'https://platform.minimaxi.com/',
      Origin: 'https://platform.minimaxi.com',
    };

    if (credentials.authorization) {
      headers.Authorization = credentials.authorization;
    }

    // Make test API call
    const response = await simpleFetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or expired cookie');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const apiData = (await response.json()) as MinimaxApiResponse;

    // Log response for debugging
    logger.info('[MinimaxUsage] Test API response:', JSON.stringify(apiData, null, 2));

    if (apiData.base_resp?.status_code !== 0) {
      const errorMsg = apiData.base_resp?.status_msg || 'Unknown error';
      logger.error('[MinimaxUsage] Cookie test API error:', {
        status_code: apiData.base_resp?.status_code,
        status_msg: errorMsg,
        fullResponse: apiData,
      });
      throw new Error(`API returned error (status ${apiData.base_resp?.status_code}): ${errorMsg}`);
    }

    logger.info('[MinimaxUsage] Cookie test successful');
    return true;
  } catch (error) {
    logger.error('[MinimaxUsage] Cookie test failed:', error);
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
