// Web Fetch API route - Proxies Jina Reader requests with rate limiting

import { Hono } from 'hono';
import { getOptionalAuth, optionalAuthMiddleware } from '../middlewares/auth';
import { searchUsageService } from '../services/search-usage-service';
import type { HonoContext } from '../types/context';

const webFetch = new Hono<HonoContext>();

// Request body schema
interface WebFetchRequest {
  url: string;
}

// Response schema
interface WebFetchResponse {
  content: string;
  url: string;
  usage: {
    remaining: number;
    limit: number;
    used: number;
  };
}

/**
 * Get JINA_API_KEY from environment
 */
function getJinaApiKey(env?: HonoContext['Bindings']): string | undefined {
  if (typeof Bun !== 'undefined') {
    return Bun.env.JINA_API_KEY;
  }
  return env?.JINA_API_KEY;
}

/**
 * Build Jina Reader URL
 */
function buildJinaReaderUrl(url: string): string {
  const JINA_READER_PREFIX = 'https://r.jina.ai/';
  const JINA_READER_PREFIX_HTTP = 'http://r.jina.ai/';

  if (url.startsWith(JINA_READER_PREFIX) || url.startsWith(JINA_READER_PREFIX_HTTP)) {
    return url;
  }
  return `${JINA_READER_PREFIX}${url}`;
}

/**
 * Call Jina Reader API
 */
const JINA_FETCH_TIMEOUT_MS = 20000;

async function callJinaReader(url: string, apiKey: string): Promise<string> {
  const jinaUrl = buildJinaReaderUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JINA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Retain-Images': 'none',
        'X-Timeout': '20',
        Accept: 'text/markdown,text/plain,*/*',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jina Reader API error: ${response.status} - ${errorText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Jina Reader API error: timeout');
    }
    if (error instanceof Error && error.message.startsWith('Jina Reader API error')) {
      throw error;
    }
    throw new Error(
      `Jina Reader API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST /api/web-fetch
 * Fetch web page content using Jina Reader API
 */
webFetch.post('/', optionalAuthMiddleware, async (c) => {
  // Get device ID from header (required)
  const deviceId = c.req.header('X-Device-ID');
  if (!deviceId) {
    return c.json(
      {
        error: 'Missing X-Device-ID header',
      },
      400
    );
  }

  // Get optional user ID from auth
  const auth = getOptionalAuth(c);
  const userId = auth?.userId;

  // Parse request body
  let requestBody: WebFetchRequest;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(
      {
        error: 'Invalid JSON body',
      },
      400
    );
  }

  // Validate request
  if (!requestBody.url || typeof requestBody.url !== 'string') {
    return c.json(
      {
        error: 'Missing or invalid url parameter',
      },
      400
    );
  }

  // Validate URL format (must be http or https)
  try {
    const parsedUrl = new URL(requestBody.url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return c.json(
        {
          error: 'URL must use http or https protocol',
        },
        400
      );
    }
  } catch {
    return c.json(
      {
        error: 'Invalid URL format',
      },
      400
    );
  }

  // Check rate limits
  try {
    const usageCheck = await searchUsageService.checkSearchLimits(deviceId, userId);

    if (!usageCheck.allowed) {
      return c.json(
        {
          error: usageCheck.reason || 'Rate limit exceeded',
          usage: {
            remaining: usageCheck.remaining,
            limit: usageCheck.limit,
            used: usageCheck.used,
          },
        },
        429
      );
    }

    // Get Jina API key
    const jinaApiKey = getJinaApiKey(c.env);
    if (!jinaApiKey) {
      console.error('JINA_API_KEY is not configured');
      return c.json(
        {
          error: 'Web fetch service not configured',
        },
        500
      );
    }

    // Call Jina Reader API
    const content = await callJinaReader(requestBody.url, jinaApiKey);

    // Record usage
    await searchUsageService.recordSearch(deviceId, userId);

    // Get updated usage stats
    const stats = await searchUsageService.getSearchStats(deviceId, userId);

    // Return results with usage info
    const response: WebFetchResponse = {
      content: content.trim(),
      url: requestBody.url,
      usage: {
        remaining: stats.remaining,
        limit: stats.limit,
        used: stats.used,
      },
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Web fetch API error:', error);

    // Handle Jina Reader API errors
    if (error instanceof Error && error.message.includes('Jina Reader API error')) {
      return c.json(
        {
          error: 'Content extraction failed',
          details: error.message,
        },
        500
      );
    }

    return c.json(
      {
        error: 'Internal server error',
      },
      500
    );
  }
});

export default webFetch;
