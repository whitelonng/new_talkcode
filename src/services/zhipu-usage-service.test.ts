// src/services/zhipu-usage-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { fetchZhipuUsage, getTimeUntilReset, getUsageLevel, getRemainingPercentage } from './zhipu-usage-service';
import * as tauriFetch from '@/lib/tauri-fetch';

// Mock dependencies
vi.mock('@/lib/tauri-fetch');
vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getApiKeys: vi.fn(),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
}));

import { settingsManager } from '@/stores/settings-store';

describe('Zhipu Usage Service', () => {
  const mockApiKey = 'test-zhipu-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock settings manager
    (settingsManager.getApiKeys as Mock).mockResolvedValue({
      zhipu: mockApiKey,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchZhipuUsage', () => {
    it('should fetch and parse usage data successfully', async () => {
      const mockApiResponse = {
        code: 200,
        msg: 'Success',
        success: true,
        data: {
          planName: 'Coding Plan Pro',
          limits: [
            {
              type: 'TOKENS_LIMIT',
              usage: 1000, // This is the limit
              currentValue: 400, // This is the used amount
              remaining: 600,
              percentage: 40,
              unit: 3, // 3 = hours
              number: 5,
              nextResetTime: Date.now() + 3600000, // 1 hour from now
              usageDetails: [
                {
                  modelCode: 'glm-4',
                  usage: 300,
                },
                {
                  modelCode: 'search-prime',
                  usage: 100,
                },
              ],
            },
          ],
        },
      };

      (tauriFetch.simpleFetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const result = await fetchZhipuUsage();

      expect(result).toBeDefined();
      expect(result.five_hour).toBeDefined();
      expect(result.five_hour.utilization_pct).toBe(40); // From API percentage field
      expect(result.five_hour.used).toBe(400); // From currentValue
      expect(result.five_hour.limit).toBe(1000); // From usage field
      expect(result.five_hour.remaining).toBe(600);
      expect(result.five_hour.reset_at).toBeDefined();
      expect(result.plan_name).toBe('Coding Plan Pro');
      expect(result.usage_details).toHaveLength(2);
      expect(result.usage_details?.[0].model).toBe('glm-4');
      expect(result.usage_details?.[0].used).toBe(300);
    });

    it('should throw error when API key is not configured', async () => {
      (settingsManager.getApiKeys as Mock).mockResolvedValue({
        zhipu: '',
      });

      await expect(fetchZhipuUsage()).rejects.toThrow('API key not configured');
    });

    it('should throw error when API request fails', async () => {
      (tauriFetch.simpleFetch as Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(fetchZhipuUsage()).rejects.toThrow('Zhipu Usage API error: 401');
    });

    it('should throw error when no token limit found', async () => {
      const mockApiResponse = {
        code: 200,
        success: true,
        data: {
          limits: [
            {
              type: 'TIME_LIMIT', // Wrong type
              usage: 1000,
              currentValue: 400,
              remaining: 600,
              percentage: 40,
            },
          ],
        },
      };

      (tauriFetch.simpleFetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      await expect(fetchZhipuUsage()).rejects.toThrow('No token limit found');
    });

    it('should handle zero limit gracefully', async () => {
      const mockApiResponse = {
        code: 200,
        success: true,
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              usage: 0,
              currentValue: 0,
              remaining: 0,
              percentage: 0,
            },
          ],
        },
      };

      (tauriFetch.simpleFetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const result = await fetchZhipuUsage();

      expect(result.five_hour.utilization_pct).toBe(0);
    });
  });

  describe('getTimeUntilReset', () => {
    it('should format time correctly for hours and minutes', () => {
      const futureTime = new Date(Date.now() + 3665000).toISOString(); // 1h 1m 5s from now
      const result = getTimeUntilReset(futureTime);
      expect(result).toMatch(/1h \d+m/);
    });

    it('should format time correctly for minutes only', () => {
      const futureTime = new Date(Date.now() + 125000).toISOString(); // 2m 5s from now
      const result = getTimeUntilReset(futureTime);
      expect(result).toMatch(/\d+m/);
    });

    it('should return "Resetting soon..." for past times', () => {
      const pastTime = new Date(Date.now() - 1000).toISOString(); // 1s ago
      const result = getTimeUntilReset(pastTime);
      expect(result).toBe('Resetting soon...');
    });
  });

  describe('getUsageLevel', () => {
    it('should return "low" for usage below 50%', () => {
      expect(getUsageLevel(0)).toBe('low');
      expect(getUsageLevel(25)).toBe('low');
      expect(getUsageLevel(49)).toBe('low');
    });

    it('should return "medium" for usage between 50% and 75%', () => {
      expect(getUsageLevel(50)).toBe('medium');
      expect(getUsageLevel(60)).toBe('medium');
      expect(getUsageLevel(74)).toBe('medium');
    });

    it('should return "high" for usage between 75% and 90%', () => {
      expect(getUsageLevel(75)).toBe('high');
      expect(getUsageLevel(85)).toBe('high');
      expect(getUsageLevel(89)).toBe('high');
    });

    it('should return "critical" for usage 90% and above', () => {
      expect(getUsageLevel(90)).toBe('critical');
      expect(getUsageLevel(95)).toBe('critical');
      expect(getUsageLevel(100)).toBe('critical');
    });
  });

  describe('getRemainingPercentage', () => {
    it('should calculate remaining percentage correctly', () => {
      expect(getRemainingPercentage(0)).toBe(100);
      expect(getRemainingPercentage(25)).toBe(75);
      expect(getRemainingPercentage(50)).toBe(50);
      expect(getRemainingPercentage(75)).toBe(25);
      expect(getRemainingPercentage(100)).toBe(0);
    });

    it('should never return negative values', () => {
      expect(getRemainingPercentage(110)).toBe(0);
    });
  });
});
