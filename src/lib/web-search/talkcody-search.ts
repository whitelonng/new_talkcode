import { invoke } from '@tauri-apps/api/core';
import { getApiUrl } from '@/lib/config';
import { logger } from '@/lib/logger';
import { fetchWithTimeout } from '@/lib/utils';
import { secureStorage } from '@/services/secure-storage';
import type { WebSearchResult, WebSearchSource } from './types';

// Response from TalkCody search API
interface TalkCodySearchResponse {
  results: WebSearchResult[];
  usage: {
    remaining: number;
    limit: number;
    used: number;
  };
}

// Error response
interface TalkCodySearchError {
  error: string;
  usage?: {
    remaining: number;
    limit: number;
    used: number;
  };
}

/**
 * Get device ID from Tauri backend
 * Device ID is securely stored in app data directory
 */
async function getDeviceId(): Promise<string> {
  try {
    return await invoke<string>('get_device_id');
  } catch (error) {
    logger.error('[TalkCody Search] Failed to get device ID:', error);
    throw new Error('Failed to get device ID');
  }
}

/**
 * TalkCody internal search - calls TalkCody API with rate limiting
 * Free for all users with rate limits (100/day anonymous, 1000/day authenticated)
 */
export class TalkCodySearch implements WebSearchSource {
  async search(query: string): Promise<WebSearchResult[]> {
    const t0 = performance.now();

    try {
      const deviceId = await getDeviceId();
      const authToken = await secureStorage.getAuthToken();

      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId,
      };

      // Add auth token if available (for higher rate limits)
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      // Call TalkCody search API
      const response = await fetchWithTimeout(getApiUrl('/api/search'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          numResults: 10,
          type: 'auto',
        }),
        timeout: 30000, // 30 second timeout for search requests
      });

      const t1 = performance.now();

      // Handle rate limit error (429)
      if (response.status === 429) {
        const errorData = (await response.json()) as TalkCodySearchError;
        const isAuthenticated = !!authToken;
        const limit = isAuthenticated ? 1000 : 100;

        logger.warn(
          `[TalkCody Search] Rate limit exceeded (${errorData.usage?.used || 0}/${limit} searches used). ${
            isAuthenticated ? '' : 'Sign in for higher limits.'
          }`
        );

        throw new Error('rate limit exceeded');
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = (await response.json()) as TalkCodySearchError;
        throw new Error(`TalkCody search failed: ${errorData.error}`);
      }

      // Parse successful response
      const data = (await response.json()) as TalkCodySearchResponse;
      logger.info(
        `[TalkCody Search] Search completed in ${(t1 - t0).toFixed(0)}ms. ` +
          `Results: ${data.results.length}. ` +
          `Usage: ${data.usage.used}/${data.usage.limit} (${data.usage.remaining} remaining)`
      );

      return data.results;
    } catch (error) {
      const t1 = performance.now();

      // Re-throw rate limit errors for graceful fallback
      if (error instanceof Error && error.message.includes('rate limit')) {
        logger.warn(`[TalkCody Search] Rate limit error after ${(t1 - t0).toFixed(0)}ms`);
        throw error;
      }

      // Log and re-throw other errors
      logger.error(`[TalkCody Search] Search failed after ${(t1 - t0).toFixed(0)}ms:`, error);
      throw error;
    }
  }
}

/**
 * Check if TalkCody search is available (always true for now)
 */
export function isTalkCodySearchAvailable(): boolean {
  // Always available - API will handle rate limiting
  return true;
}
