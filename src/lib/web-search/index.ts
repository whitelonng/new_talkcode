import { logger } from '@/lib/logger';
import { settingsManager } from '@/stores/settings-store';
import { ExaSearch, isExaMCPAvailable } from './exa-search';
import { GLMSearch, isGLMMCPAvailable } from './glm-search';
import { isMiniMaxMCPAvailable, MiniMaxSearch } from './minimax-search';
import { SerperSearch } from './serper-search';
import { isTalkCodySearchAvailable, TalkCodySearch } from './talkcody-search';
import { TavilySearch } from './tavily-search';
import type { WebSearchResult } from './types';

export { ExaSearch } from './exa-search';
export { GLMSearch } from './glm-search';
export { MiniMaxSearch } from './minimax-search';
export { SerperSearch } from './serper-search';
export { TalkCodySearch } from './talkcody-search';
export { TavilySearch } from './tavily-search';
// Re-export types and classes
export type { SearchOptions, WebSearchResult, WebSearchSource } from './types';

/**
 * Unified web search function with fallback providers
 * Priority: TalkCody Internal (free) → Tavily → Serper → MiniMax Coding Plan → GLM Coding Plan → Exa (free)
 */
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  // Check TalkCody internal search availability (always true, API handles rate limiting)
  const talkCodyAvailable = isTalkCodySearchAvailable();

  const apiKeys = await settingsManager.getApiKeys();
  const hasTavilyKey = !!apiKeys.tavily;
  const hasSerperKey = !!apiKeys.serper;

  // Check Exa MCP availability
  const exaAvailable = isExaMCPAvailable();

  // Check MiniMax Coding Plan availability
  const hasMiniMaxKey = !!apiKeys.MiniMax;
  const miniMaxCodingPlanEnabled = await settingsManager.getProviderUseCodingPlan('MiniMax');
  const miniMaxAvailable = isMiniMaxMCPAvailable();

  // Check GLM Coding Plan availability
  const hasZhipuKey = !!apiKeys.zhipu;
  const zhipuCodingPlanEnabled = await settingsManager.getProviderUseCodingPlan('zhipu');
  const glmAvailable = isGLMMCPAvailable();

  logger.info('Web Search - Available Providers', {
    talkCodyAvailable,
    exaAvailable,
    hasTavilyKey,
    hasSerperKey,
    hasMiniMaxKey,
    miniMaxCodingPlanEnabled,
    miniMaxAvailable,
    hasZhipuKey,
    zhipuCodingPlanEnabled,
    glmAvailable,
  });

  // Priority 0: TalkCody Internal Search (free with rate limits)
  if (talkCodyAvailable) {
    try {
      logger.info('Using TalkCody Internal Search (free with rate limits)');
      const talkCodySearch = new TalkCodySearch();
      const results = await talkCodySearch.search(query);

      if (results.length > 0) {
        logger.info('TalkCody search results count:', results.length);
        return results;
      }
      logger.warn('TalkCody search returned empty results, trying next provider');
    } catch (error) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        logger.warn('TalkCody search rate limit exceeded, trying next provider');
      } else {
        logger.warn('TalkCody search failed, trying next provider:', error);
      }
    }
  }

  // Priority 1: Tavily Search (if API key configured)
  if (hasTavilyKey) {
    logger.info('Using Tavily Search');
    const tavilySearch = new TavilySearch();
    const results = await tavilySearch.search(query);

    logger.info('Tavily results count:', results.length);
    return results;
  }

  // Priority 2: Serper Search (if API key configured)
  if (hasSerperKey) {
    try {
      logger.info('Using Serper Search');
      const serperSearch = new SerperSearch();
      const results = await serperSearch.search(query);

      if (results.length > 0) {
        logger.info('Serper results count:', results.length);
        return results;
      }
      logger.warn('Serper returned empty results, trying next provider');
    } catch (error) {
      logger.warn('Serper search failed, trying next provider:', error);
    }
  }

  // Priority 3: MiniMax Coding Plan web_search (if API key + Coding Plan enabled + MCP connected)
  if (hasMiniMaxKey && miniMaxCodingPlanEnabled && miniMaxAvailable) {
    try {
      logger.info('Using MiniMax Coding Plan web_search');
      const miniMaxSearch = new MiniMaxSearch();
      const results = await miniMaxSearch.search(query);

      if (results.length > 0) {
        logger.info('MiniMax web_search results count:', results.length);
        return results;
      }
      logger.warn('MiniMax web_search returned empty results, trying next provider');
    } catch (error) {
      logger.warn('MiniMax web_search failed, trying next provider:', error);
    }
  }

  // Priority 4: GLM Coding Plan webSearchPrime (if API key + Coding Plan enabled + MCP connected)
  if (hasZhipuKey && zhipuCodingPlanEnabled && glmAvailable) {
    try {
      logger.info('Using GLM Coding Plan webSearchPrime');
      const glmSearch = new GLMSearch();
      const results = await glmSearch.search(query);

      if (results.length > 0) {
        logger.info('GLM webSearchPrime results count:', results.length);
        return results;
      }
      logger.warn('GLM webSearchPrime returned empty results, trying next provider');
    } catch (error) {
      logger.warn('GLM webSearchPrime failed, trying next provider:', error);
    }
  }

  // Priority 5: Exa Search (free, as last fallback)
  if (exaAvailable) {
    try {
      logger.info('Using Exa Search (free fallback)');
      const exaSearch = new ExaSearch();
      const results = await exaSearch.search(query);

      if (results.length > 0) {
        logger.info('Exa results count:', results.length);
        return results;
      }
      logger.warn('Exa returned empty results');
    } catch (error) {
      logger.warn('Exa search failed:', error);
    }
  }

  // No provider available - return error object
  logger.warn('All web search providers failed');

  // Build helpful message about available options
  const suggestions: string[] = [];
  suggestions.push('• Configure Tavily API key in Settings > API Keys');
  suggestions.push('• Configure Serper API key in Settings > API Keys');
  if (hasMiniMaxKey && !miniMaxCodingPlanEnabled) {
    suggestions.push('• Enable "Use Coding Plan" for MiniMax in Settings > API Keys');
  }
  if (hasZhipuKey && !zhipuCodingPlanEnabled) {
    suggestions.push('• Enable "Use Coding Plan" for Zhipu AI in Settings > API Keys');
  }
  if (!hasMiniMaxKey) {
    suggestions.push('• Configure MiniMax API key and enable Coding Plan');
  }
  if (!hasZhipuKey) {
    suggestions.push('• Configure Zhipu AI API key and enable Coding Plan');
  }

  // Return as array with error info (will be handled by tool result renderer)
  return [
    {
      title: 'Error',
      url: '',
      content: `No web search provider configured. You can:\n${suggestions.join('\n')}\n\nFor Tavily setup, visit: https://docs.tavily.com/documentation/quickstart`,
    },
  ];
}
