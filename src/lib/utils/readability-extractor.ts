import { Readability } from '@mozilla/readability';
import { invoke } from '@tauri-apps/api/core';
import TurndownService from 'turndown';
import { API_BASE_URL } from '@/lib/config';
import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import { fetchWithTimeout } from '@/lib/utils';
import { secureStorage } from '@/services/secure-storage';

export interface ContentExtractResult {
  title?: string;
  content: string; // Markdown formatted content
  textContent?: string; // Plain text version
  url: string;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
});

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function buildHeaders(accept: string): HeadersInit {
  return {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: accept,
  };
}

const WEB_FETCH_API_URL = `${API_BASE_URL}/api/web-fetch`;

/**
 * Get device ID from Tauri backend
 * Device ID is securely stored in app data directory
 */
async function getDeviceId(): Promise<string> {
  try {
    return await invoke<string>('get_device_id');
  } catch (error) {
    logger.error('[ReadabilityExtractor] Failed to get device ID:', error);
    throw new Error('Failed to get device ID');
  }
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true; // Assume HTML if not specified
  const lower = contentType.toLowerCase();
  return lower.includes('text/html') || lower.includes('application/xhtml+xml');
}

function isMarkdownContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return lower.includes('markdown') || lower.includes('text/plain');
}

/**
 * Parse HTML string to Document using DOMParser
 */
function parseHTML(html: string, url: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Set the document URL for Readability
  const baseEl = doc.createElement('base');
  baseEl.href = url;
  doc.head.prepend(baseEl);

  return doc;
}

/**
 * Convert HTML to Markdown directly using Turndown (fallback method)
 * Similar to OpenCode's approach
 */
function convertHTMLToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  // Remove script, style, meta, link tags like OpenCode does
  turndownService.remove(['script', 'style', 'meta', 'link', 'noscript', 'iframe']);

  return turndownService.turndown(html);
}

/**
 * Check if content appears to be a loading state or empty
 */
function isLoadingContent(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  return (
    trimmed === 'loading' ||
    trimmed === '' ||
    trimmed === 'please wait' ||
    trimmed === 'loading...' ||
    trimmed === 'please wait...' ||
    trimmed.includes('spinner') ||
    (trimmed.length < 50 && trimmed.includes('loading'))
  );
}

function getMeaningfulTextFromElement(element: Element | null): string {
  if (!element) return '';
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script,style,noscript,iframe,svg,canvas,template').forEach((node) => {
    node.remove();
  });
  return clone.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function hasScriptSignals(doc: Document): boolean {
  const scripts = Array.from(doc.querySelectorAll('script'));
  const externalScripts = scripts
    .map((script) => script.getAttribute('src'))
    .filter((src): src is string => Boolean(src));

  if (scripts.length >= 5 || externalScripts.length >= 3) {
    return true;
  }

  return externalScripts.some((src) =>
    /chunk|bundle|runtime|vendors|app|main|static|webpack|vite|rollup/i.test(src)
  );
}

/**
 * Check if the page appears to be client-side rendered (CSR) with only loading state
 */
function isCSRPage(doc: Document): boolean {
  const body = doc.body;
  const bodyText = getMeaningfulTextFromElement(body);
  const html = doc.documentElement?.innerHTML || '';

  // Check if main content area only contains loading indicators
  const main = doc.querySelector('main');
  if (main) {
    const text = getMeaningfulTextFromElement(main);
    // If main content is mostly "Loading..." or very short, it's likely CSR
    if (isLoadingContent(text) || text.length < 100) {
      return true;
    }
  }

  // Check for skeleton/loading screens in article
  const article = doc.querySelector('article');
  if (article) {
    const text = getMeaningfulTextFromElement(article);
    if (isLoadingContent(text) || text.length < 100) {
      return true;
    }
  }

  // Check for loading class names - be conservative, need many elements
  const loadingElements = doc.querySelectorAll('[class*="loading"], [class*="skeleton"]');
  if (loadingElements.length > 5) {
    return true;
  }

  // Strong CSR indicators - apps that typically render everything client-side
  const strongCSRElements = [
    'id="__next"', // Next.js - almost always CSR for initial load
    'data-server-rendered="false"', // Explicit Vue CSR marker
  ];

  for (const indicator of strongCSRElements) {
    if (html.includes(indicator) && bodyText.length < 500) {
      return true;
    }
  }

  // Weaker CSR indicators - need more evidence
  const weakCSRElements = ['id="root"', 'id="app"'];
  const hasWeakIndicator = weakCSRElements.some((indicator) => html.includes(indicator));

  // For weak indicators, require very minimal content to be considered CSR
  if (hasWeakIndicator && bodyText.length < 300) {
    return true;
  }

  // App shell detection: root/app container with minimal meaningful text and script signals
  if (hasWeakIndicator && bodyText.length < 800 && hasScriptSignals(doc)) {
    return true;
  }

  // Very short body text alone is not enough; avoid false positives on short static pages
  return false;
}

async function tryFetchMarkdownVersion(
  url: string,
  timeout: number
): Promise<ContentExtractResult | null> {
  try {
    const mdUrl = url + '.md';
    logger.info('ReadabilityExtractor: trying markdown version:', mdUrl);

    const response = await fetchWithTimeout(mdUrl, {
      timeout,
      headers: buildHeaders('text/markdown,text/plain,*/*'),
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!isMarkdownContentType(contentType)) {
      return null;
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().length < 100) {
      return null;
    }

    // Extract title from first h1
    const content = responseText.trim();
    const titleMatch = /^#\s+(.+)$/m.exec(content);
    const title = titleMatch?.[1]?.trim();

    logger.info('ReadabilityExtractor: successfully fetched markdown version');
    return {
      title,
      content,
      url: mdUrl,
    };
  } catch (error) {
    logger.debug('ReadabilityExtractor: markdown version fetch failed:', error);
    return null;
  }
}

async function fetchHtmlContent(url: string, timeout: number): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url, {
      timeout,
      headers: buildHeaders('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
    });

    if (!response.ok) {
      logger.warn('ReadabilityExtractor: fetch failed with status', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!isHtmlContentType(contentType)) {
      logger.warn('ReadabilityExtractor: non-HTML content type', contentType, 'from', url);
      return null;
    }

    return await response.text();
  } catch (error) {
    logger.warn('ReadabilityExtractor: fetch failed for', url, error);
    return null;
  }
}

async function tryFetchViaTalkCodyApi(
  url: string,
  timeout: number
): Promise<ContentExtractResult | null> {
  try {
    logger.info('ReadabilityExtractor: trying TalkCody Web Fetch API:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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

    const response = await simpleFetch(WEB_FETCH_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('ReadabilityExtractor: TalkCody Web Fetch API returned error:', response.status);
      return null;
    }

    const data = (await response.json()) as { content: string; url: string };
    if (!data.content || data.content.trim().length < 100) {
      return null;
    }

    logger.info('ReadabilityExtractor: successfully fetched with TalkCody Web Fetch API');
    return {
      title: undefined,
      content: data.content.trim(),
      url: data.url || url,
    };
  } catch (error) {
    logger.debug('ReadabilityExtractor: TalkCody Web Fetch API failed:', error);
    return null;
  }
}

export class ReadabilityExtractor {
  private timeout: number;

  constructor(timeout = 20000) {
    this.timeout = timeout;
  }

  async extract(url: string): Promise<ContentExtractResult | null> {
    try {
      logger.info('ReadabilityExtractor: fetching URL:', url);
      // Start markdown and HTML fetch in parallel (markdown is fastest for static docs)
      const markdownPromise = tryFetchMarkdownVersion(url, this.timeout);
      const htmlPromise = fetchHtmlContent(url, this.timeout);

      const markdownResult = await markdownPromise;
      if (markdownResult) {
        logger.info('ReadabilityExtractor: successfully fetched markdown version');
        return markdownResult;
      }

      const html = await htmlPromise;
      if (!html) {
        logger.warn('ReadabilityExtractor: failed to fetch HTML content');
        logger.info(
          'ReadabilityExtractor: markdown and HTML fetch failed, trying TalkCody API fallback'
        );
        const apiFallback = await tryFetchViaTalkCodyApi(url, this.timeout);
        if (apiFallback) {
          return apiFallback;
        }
        logger.warn('ReadabilityExtractor: TalkCody API fallback failed after fetch failure');
        return null;
      }

      logger.info('ReadabilityExtractor: fetched HTML length:', html.length);

      // Parse HTML once for all methods
      const doc = parseHTML(html, url);
      const csrDetected = isCSRPage(doc);

      // Check if the fetched content appears to be empty or loading state
      const bodyText = getMeaningfulTextFromElement(doc.body);
      const hasMinimalContent = isLoadingContent(bodyText) || bodyText.length < 200;

      // Use TalkCody API for:
      // 1. Detected CSR pages (Next.js, Vue CSR, app shells)
      // 2. Pages with minimal content and strong script signals
      const shouldUseApi = csrDetected || (hasMinimalContent && hasScriptSignals(doc));

      if (shouldUseApi) {
        logger.info(
          'ReadabilityExtractor: detected dynamic content (csrDetected:',
          csrDetected,
          ', hasMinimalContent:',
          hasMinimalContent,
          '), using TalkCody API'
        );
        // For dynamic pages, try TalkCody API first (which can render JavaScript)
        const apiResult = await tryFetchViaTalkCodyApi(url, this.timeout);
        if (apiResult) {
          return apiResult;
        }
        logger.info('ReadabilityExtractor: TalkCody API failed, falling back to static extraction');
      }

      // Method 1: Try Readability extraction (for static pages)
      try {
        const reader = new Readability(doc);
        const article = reader.parse();

        if (article?.content?.trim()) {
          const textContent = article.textContent?.trim() || '';
          // Check if Readability extracted meaningful content (not just "loading")
          if (!isLoadingContent(textContent)) {
            const markdownContent = turndownService.turndown(article.content);
            logger.info('ReadabilityExtractor: Readability extraction successful');
            return {
              title: article.title || undefined,
              content: markdownContent.trim(),
              textContent: textContent,
              url,
            };
          }
          logger.info(
            'ReadabilityExtractor: Readability returned loading content, trying fallback'
          );
        }
      } catch (readabilityError) {
        logger.warn('ReadabilityExtractor: Readability failed:', readabilityError);
      }

      logger.info('ReadabilityExtractor: trying direct HTML to Markdown conversion');
      const directMarkdown = convertHTMLToMarkdown(html);
      if (directMarkdown.trim() && !isLoadingContent(directMarkdown)) {
        logger.info('ReadabilityExtractor: direct conversion successful');
        return {
          content: directMarkdown.trim(),
          url,
        };
      }

      logger.warn('ReadabilityExtractor: no content extracted from', url);
      return null;
    } catch (error) {
      logger.warn('ReadabilityExtractor: extraction failed for', url, error);
      return null;
    }
  }
}

// Default singleton instance
export const readabilityExtractor = new ReadabilityExtractor();
