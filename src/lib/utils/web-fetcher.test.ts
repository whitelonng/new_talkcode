import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { taskFileService } from '@/services/task-file-service';
import * as aliasedUtils from '@/lib/utils';
import * as tauriFetch from '@/lib/tauri-fetch';
import * as utils from '../utils';
import { fetchWebContent, fetchWithTavily } from './web-fetcher';
import * as readabilityExtractorModule from './readability-extractor';

// Mock the fetchWithTimeout function
vi.mock('../utils', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('@/lib/tauri-fetch', () => ({
  simpleFetch: vi.fn(),
}));

const mockFetchWithTimeout = utils.fetchWithTimeout as Mock;
const mockAliasedFetchWithTimeout = aliasedUtils.fetchWithTimeout as Mock;
const mockSimpleFetch = tauriFetch.simpleFetch as Mock;

// Mock readability extractor (keep class export for direct tests)
vi.mock('./readability-extractor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./readability-extractor')>();
  return {
    ...actual,
    readabilityExtractor: {
      extract: vi.fn(),
    },
  };
});

vi.mock('@/services/task-file-service', () => ({
  taskFileService: {
    writeFile: vi.fn(),
  },
}));

const mockReadabilityExtract = readabilityExtractorModule.readabilityExtractor.extract as Mock;

const originalEnv = import.meta.env;

describe('web-fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (import.meta as any).env = {
      ...originalEnv,
      VITE_TAVILY_API_KEY: 'test-api-key',
    };
  });

  describe('fetchWithTavily', () => {
    it('should successfully fetch web content using Tavily', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              url: 'https://example.com',
              raw_content: 'Test content from Tavily',
            },
          ],
        }),
        text: vi.fn(),
      };

      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      const result = await fetchWithTavily('https://example.com');

      expect(result).toEqual({
        url: 'https://example.com',
        content: 'Test content from Tavily',
        title: undefined,
        publishedDate: null,
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://api.tavily.com/extract',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            urls: ['https://example.com'],
            include_images: false,
          }),
        })
      );
    });

    it('should handle empty raw_content', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              url: 'https://example.com',
              raw_content: '',
            },
          ],
        }),
        text: vi.fn(),
      };

      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      const result = await fetchWithTavily('https://example.com');

      expect(result.content).toBe('');
    });

    it('should throw error when no results returned', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [],
        }),
        text: vi.fn(),
      };

      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      await expect(fetchWithTavily('https://example.com')).rejects.toThrow(
        'No results returned from Tavily API'
      );
    });

    it('should throw error when response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      };

      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      await expect(fetchWithTavily('https://example.com')).rejects.toThrow(
        'Tavily fetch failed with status code: 401'
      );
    });
  });

  describe('fetchWebContent', () => {
    it('should successfully fetch with Readability (primary method)', async () => {
      mockReadabilityExtract.mockResolvedValueOnce({
        title: 'Test Page',
        url: 'https://example.com',
        content: 'Test content',
      });

      const result = await fetchWebContent('https://example.com');

      expect(result.title).toBe('Test Page');
      expect(result.content).toBe('Test content');
      expect(mockReadabilityExtract).toHaveBeenCalledTimes(1);
      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
      expect(mockAliasedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('should save content to task file when content exceeds limit', async () => {
      const longContent = 'a'.repeat(40001);

      mockReadabilityExtract.mockResolvedValueOnce({
        title: 'Test Page',
        url: 'https://example.com',
        content: longContent,
      });

      (taskFileService.writeFile as Mock).mockResolvedValue('/test/root/.talkcody/tool/task-1/tool_web-fetch.txt');

      const result = await fetchWebContent('https://example.com', {
        taskId: 'task-1',
        toolId: 'tool',
      });

      expect(taskFileService.writeFile).toHaveBeenCalledWith(
        'tool',
        'task-1',
        'tool_web-fetch.txt',
        longContent
      );
      expect(result.filePath).toBe('/test/root/.talkcody/tool/task-1/tool_web-fetch.txt');
      expect(result.content).toContain('saved to');
      expect(result.content).toContain('grep');
      expect(result.truncated).toBe(true);
      expect(result.contentLength).toBe(40001);
    });

    it('should truncate content when task context is missing', async () => {
      const longContent = 'b'.repeat(40001);

      mockReadabilityExtract.mockResolvedValueOnce({
        title: 'Test Page',
        url: 'https://example.com',
        content: longContent,
      });

      const result = await fetchWebContent('https://example.com');

      expect(result.truncated).toBe(true);
      expect(result.contentLength).toBe(40001);
      expect(result.content).toContain('Returning first 40000 characters');
      expect(result.content).toContain(longContent.slice(0, 40000));
    });

    it('should fallback to Tavily when Readability returns null', async () => {
      const tavilySuccessResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              url: 'https://example.com',
              raw_content: 'Content from Tavily fallback',
            },
          ],
        }),
        text: vi.fn(),
      };

      mockReadabilityExtract.mockResolvedValueOnce(null);
      mockFetchWithTimeout.mockResolvedValueOnce(tavilySuccessResponse as any);

      const result = await fetchWebContent('https://example.com');

      expect(result.content).toBe('Content from Tavily fallback');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(mockReadabilityExtract).toHaveBeenCalledTimes(1);
    });

    it('should fallback to Tavily when Readability throws', async () => {
      const tavilySuccessResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              url: 'https://example.com',
              raw_content: 'Content from Tavily fallback',
            },
          ],
        }),
        text: vi.fn(),
      };

      mockReadabilityExtract.mockRejectedValueOnce(new Error('Readability error'));
      mockFetchWithTimeout.mockResolvedValueOnce(tavilySuccessResponse as any);

      const result = await fetchWebContent('https://example.com');

      expect(result.content).toBe('Content from Tavily fallback');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(mockReadabilityExtract).toHaveBeenCalledTimes(1);
    });

    it('should throw error when Readability and Tavily both fail', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server error'),
      };

      mockReadabilityExtract.mockResolvedValueOnce(null);
      mockFetchWithTimeout.mockResolvedValueOnce(mockErrorResponse as any);

      await expect(fetchWebContent('https://example.com')).rejects.toThrow(
        'Failed to fetch web content. Readability error:'
      );

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(mockReadabilityExtract).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid URL (no http)', async () => {
      await expect(fetchWebContent('example.com')).rejects.toThrow('Invalid URL provided');

      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('should throw error for empty URL', async () => {
      await expect(fetchWebContent('')).rejects.toThrow('Invalid URL provided');

      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('should accept https URLs', async () => {
      mockReadabilityExtract.mockResolvedValueOnce({
        title: 'Test',
        url: 'https://example.com',
        content: 'Content',
      });

      await expect(fetchWebContent('https://example.com')).resolves.toBeDefined();
    });

    it('should accept http URLs', async () => {
      mockReadabilityExtract.mockResolvedValueOnce({
        title: 'Test',
        url: 'http://example.com',
        content: 'Content',
      });

      await expect(fetchWebContent('http://example.com')).resolves.toBeDefined();
    });
  });

  describe('readability extractor (dynamic detection)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      mockSimpleFetch.mockReset();
      mockAliasedFetchWithTimeout.mockReset();
    });

    it('should use TalkCody API when markdown and HTML fetches fail', async () => {
      mockAliasedFetchWithTimeout.mockImplementation(async (input: RequestInfo) => {
        if (typeof input === 'string' && input.endsWith('.md')) {
          return {
            ok: false,
            status: 404,
            headers: {
              get: () => 'text/plain',
            },
            text: vi.fn().mockResolvedValue(''),
          } as unknown as Response;
        }

        return {
          ok: false,
          status: 404,
          headers: {
            get: () => 'text/html; charset=utf-8',
          },
          text: vi.fn().mockResolvedValue(''),
        } as unknown as Response;
      });

      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('device-123');

      const { secureStorage } = await import('@/services/secure-storage');
      vi.spyOn(secureStorage, 'getAuthToken').mockResolvedValue(null);

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: '# API Fallback\n\n' + 'y'.repeat(150),
          url: 'https://docs.turso.tech/llms.txt',
        }),
      } as unknown as Response);

      const { ReadabilityExtractor } = await import('./readability-extractor');
      const extractor = new ReadabilityExtractor(10);
      const result = await extractor.extract('https://docs.turso.tech/llms.txt');

      expect(result?.content).toContain('API Fallback');
      expect(mockSimpleFetch).toHaveBeenCalled();
    });

    it('should use TalkCody API for CSR app shell pages', async () => {
      mockAliasedFetchWithTimeout.mockImplementation(async (input: RequestInfo) => {
        if (typeof input === 'string' && input.endsWith('.md')) {
          return {
            ok: false,
            status: 404,
            headers: {
              get: () => 'text/plain',
            },
            text: vi.fn().mockResolvedValue(''),
          } as unknown as Response;
        }

        return {
          ok: true,
          headers: {
            get: () => 'text/html; charset=utf-8',
          },
          text: vi.fn().mockResolvedValue(
            '<!doctype html><html><head><title>Feishu Doc</title>' +
              '<script src="/static/runtime~app-123.js"></script>' +
              '<script src="/static/vendors-456.js"></script>' +
              '</head><body><div id="root"></div></body></html>'
          ),
        } as unknown as Response;
      });

      mockSimpleFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: '# Rendered Content\n\n' + 'x'.repeat(150),
          url: 'https://open.feishu.cn/document/example',
        }),
      } as unknown as Response);

      const { ReadabilityExtractor } = await import('./readability-extractor');
      const extractor = new ReadabilityExtractor(10);
      const result = await extractor.extract('https://open.feishu.cn/document/example');

      expect(result?.content).toContain('Rendered Content');
      expect(mockSimpleFetch).toHaveBeenCalled();
    });

    it('should prefer static HTML extraction for non-CSR pages', async () => {
      mockAliasedFetchWithTimeout.mockImplementation(async (input: RequestInfo) => {
        if (typeof input === 'string' && input.endsWith('.md')) {
          return {
            ok: false,
            status: 404,
            headers: {
              get: () => 'text/plain',
            },
            text: vi.fn().mockResolvedValue(''),
          } as unknown as Response;
        }

        return {
          ok: true,
          headers: {
            get: () => 'text/html; charset=utf-8',
          },
          text: vi.fn().mockResolvedValue(
            '<!doctype html><html><head><title>Static</title></head>' +
              '<body><main><h1>Static Title</h1>' +
              '<p>' +
              'This static content is intentionally long to avoid dynamic detection.' +
              ' It should exceed the minimal text thresholds used by the extractor.' +
              '</p></main></body></html>'
          ),
        } as unknown as Response;
      });

      const { ReadabilityExtractor } = await import('./readability-extractor');
      const extractor = new ReadabilityExtractor(10);
      const result = await extractor.extract('https://example.com/static');

      expect(result?.content).toContain('Static Title');
      expect(mockSimpleFetch).not.toHaveBeenCalled();
    });
  });
});
