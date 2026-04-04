// src/services/minimax-usage-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCurlCommand, fetchMinimaxUsage, testMinimaxCookie } from './minimax-usage-service';
import { settingsManager } from '@/stores/settings-store';
import { simpleFetch } from '@/lib/tauri-fetch';

// Mock dependencies
vi.mock('@/lib/tauri-fetch');
vi.mock('@/lib/logger');
vi.mock('@/stores/settings-store');

describe('MiniMax Usage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCurlCommand', () => {
    it('should parse full cURL command with -b flag', () => {
      const curlString = `curl 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains?GroupId=123' -H 'accept: application/json' -b 'cookie1=value1; cookie2=value2'`;
      
      const result = parseCurlCommand(curlString);
      
      expect(result.cookie).toBe('cookie1=value1; cookie2=value2');
      expect(result.groupId).toBe('123');
    });

    it('should parse cURL command with Authorization header', () => {
      const curlString = `curl 'https://www.minimaxi.com/api' -H 'Authorization: Bearer token123' -b 'cookie=value'`;
      
      const result = parseCurlCommand(curlString);
      
      expect(result.cookie).toBe('cookie=value');
      expect(result.authorization).toBe('Bearer token123');
    });

    it('should handle simple cookie string', () => {
      const cookieString = 'session=abc123; user=john';
      
      const result = parseCurlCommand(cookieString);
      
      expect(result.cookie).toBe('session=abc123; user=john');
    });

    it('should extract GroupId from URL', () => {
      const curlString = `curl 'https://www.minimaxi.com/remains?GroupId=999&other=param' -b 'cookie=val'`;
      
      const result = parseCurlCommand(curlString);
      
      expect(result.groupId).toBe('999');
    });

    it('should handle cURL with --cookie flag', () => {
      const curlString = `curl 'https://api.com' --cookie 'test=value'`;
      
      const result = parseCurlCommand(curlString);
      
      expect(result.cookie).toBe('test=value');
    });
  });

  describe('fetchMinimaxUsage', () => {
    it('should throw error when cookie not configured', async () => {
      vi.mocked(settingsManager.getMinimaxCookie).mockReturnValue('');

      await expect(fetchMinimaxUsage()).rejects.toThrow('cookie not configured');
    });

    it('should throw error when cookie format is invalid', async () => {
      vi.mocked(settingsManager.getMinimaxCookie).mockReturnValue('curl invalid-url');

      await expect(fetchMinimaxUsage()).rejects.toThrow('Invalid cookie format');
    });

    it('should map API 1004/cookie missing to SESSION_EXPIRED for UI recovery', async () => {
      vi.mocked(settingsManager.getMinimaxCookie).mockReturnValue('cookie=value');

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          base_resp: { status_code: 1004, status_msg: 'cookie is missing, log in again' },
        }),
      } as unknown as Response;

      vi.mocked(simpleFetch).mockResolvedValue(mockResponse);

      await expect(fetchMinimaxUsage()).rejects.toThrow('SESSION_EXPIRED');
    });
  });

  describe('testMinimaxCookie', () => {
    it('should throw error for invalid cookie format', async () => {
      await expect(testMinimaxCookie('')).rejects.toThrow('Invalid cookie format');
    });

    it('should parse cookie from cURL command', async () => {
      const curlString = `curl 'https://www.minimaxi.com/api' -b 'test=cookie'`;
      
      const result = parseCurlCommand(curlString);
      
      expect(result.cookie).toBe('test=cookie');
    });
  });
});
