import { logger } from '@/lib/logger';
import { fetchWithTimeout } from '@/lib/utils';
import { readabilityExtractor } from '@/lib/utils/readability-extractor';
import { settingsManager } from '@/stores/settings-store';
import type { WebSearchResult, WebSearchSource } from './types';

const SERPER_SEARCH_ENDPOINT = 'https://google.serper.dev/search';

interface SerperSearchResult {
  title: string;
  link: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperSearchResult[];
}

export class SerperSearch implements WebSearchSource {
  async search(query: string): Promise<WebSearchResult[]> {
    logger.info('SerperSearch: searching for', query);

    // Get Serper API key from settings
    const apiKeys = await settingsManager.getApiKeys();
    const serperApiKey = apiKeys.serper;

    if (!serperApiKey) {
      logger.error('Serper API key not configured');
      throw new Error('Serper API key is not configured. Please set it in Settings > API Keys.');
    }

    try {
      // 1. Call Serper API to get search results
      const response = await fetchWithTimeout(SERPER_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 10 }),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Serper API returned status ${response.status}: ${errorDetails}`);
      }

      const data: SerperResponse = await response.json();
      const organic = data.organic || [];

      if (organic.length === 0) {
        logger.info('SerperSearch: no results found');
        return [];
      }

      logger.info('SerperSearch: found', organic.length, 'results, fetching content...');

      // 2. Fetch all URLs concurrently and extract content
      const contentPromises = organic.map((item) => readabilityExtractor.extract(item.link));
      const extractResults = await Promise.all(contentPromises);

      // 3. Assemble results (use extracted content, fallback to snippet)
      const results: WebSearchResult[] = organic.map((item, index) => ({
        title: item.title,
        url: item.link,
        content: extractResults[index]?.content || item.snippet || '',
      }));

      const successCount = extractResults.filter((r) => r !== null).length;
      logger.info(
        'SerperSearch: extracted content from',
        successCount,
        '/',
        organic.length,
        'pages'
      );

      return results;
    } catch (error) {
      logger.error('SerperSearch error:', error);
      throw error;
    }
  }
}
