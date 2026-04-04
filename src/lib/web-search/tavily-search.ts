import { logger } from '@/lib/logger';
import { fetchWithTimeout } from '@/lib/utils';
import { settingsManager } from '@/stores/settings-store';
import type { SearchOptions, WebSearchResult, WebSearchSource } from './types';

const TAVILY_URL = 'https://api.tavily.com/search';

export class TavilySearch implements WebSearchSource {
  private options: SearchOptions;

  constructor(params?: SearchOptions) {
    this.options = params || {};
  }

  async search(query: string): Promise<WebSearchResult[]> {
    logger.info('TavilySearch: options', this.options);

    // Get Tavily API key from settings
    const apiKeys = await settingsManager.getApiKeys();
    const tavilyApiKey = apiKeys.tavily;

    if (!tavilyApiKey) {
      logger.error('Tavily API key not configured');
      throw new Error('Tavily API key is not configured. Please set it in Settings > API Keys.');
    }

    // Apply domain filtering if specified
    if (this.options.domains && this.options.domains.length > 0) {
      const siteQuery = this.options.domains.map((domain) => `site:${domain}`).join(' OR ');
      query = `${siteQuery} ${query}`;
    }

    logger.info('TavilySearch:', TAVILY_URL, query);

    const results: WebSearchResult[] = [];

    try {
      const requestBody: Record<string, unknown> = {
        query: query.slice(0, 1000),
        search_depth: 'basic',
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: 10,
      };

      const response = await fetchWithTimeout(TAVILY_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tavilyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Fetch failed with status code: ${response.status} and Details: ${errorDetails}`
        );
      }

      const jsonResponse = await response.json();

      // Process answer if available
      if (jsonResponse.answer) {
        results.push({
          title: 'AI Answer',
          url: '',
          content: jsonResponse.answer,
        });
      }

      // Process search results
      if (jsonResponse.results && Array.isArray(jsonResponse.results)) {
        for (const result of jsonResponse.results) {
          results.push({
            title: result.title || '',
            url: result.url || '',
            content: result.content || '',
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('TavilySearch error', error);
      return results;
    }
  }
}
