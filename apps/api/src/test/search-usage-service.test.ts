// Search usage service tests

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { analyticsEvents, searchUsage } from '../db/schema';
import { searchUsageService } from '../services/search-usage-service';

// Test device and user IDs
const TEST_DEVICE_ID = 'test-device-123';
const TEST_USER_ID = 'test-user-456';

// Clean up search usage data before and after tests
beforeAll(async () => {
  console.log('\n🔧 Setting up search usage service test environment...\n');
  
  // Create tables if they don't exist
  try {
    // Create analytics_events table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY NOT NULL,
        device_id TEXT(255) NOT NULL,
        event_type TEXT(50) NOT NULL,
        session_id TEXT(255) NOT NULL,
        os_name TEXT(50),
        os_version TEXT(50),
        app_version TEXT(50),
        country TEXT(10),
        created_at INTEGER NOT NULL
      )
    `);

    // Create search_usage table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS search_usage (
        id TEXT PRIMARY KEY NOT NULL,
        device_id TEXT(255) NOT NULL,
        user_id TEXT(255),
        search_count INTEGER DEFAULT 1 NOT NULL,
        usage_date TEXT(10) NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS search_usage_device_date_idx 
      ON search_usage (device_id, usage_date)
    `);
    
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS search_usage_user_date_idx 
      ON search_usage (user_id, usage_date)
    `);
    
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS search_usage_date_idx 
      ON search_usage (usage_date)
    `);
  } catch (error) {
    // Tables may already exist, continue
  }

  // Insert test analytics event to verify device
  try {
    await db.insert(analyticsEvents).values({
      deviceId: TEST_DEVICE_ID,
      eventType: 'session_start',
      sessionId: 'test-session-123',
      osName: 'macOS',
      appVersion: '1.0.0',
    });
  } catch (error) {
    // Event may already exist, continue
  }
  
  await db.delete(searchUsage).where(eq(searchUsage.deviceId, TEST_DEVICE_ID));
  console.log('✅ Test environment ready\n');
});

afterAll(async () => {
  console.log('\n🧹 Cleaning up search usage service test environment...\n');
  await db.delete(searchUsage).where(eq(searchUsage.deviceId, TEST_DEVICE_ID));
  await db.delete(analyticsEvents).where(eq(analyticsEvents.deviceId, TEST_DEVICE_ID));
  console.log('✅ Cleanup complete\n');
});

// Clean up before each test
beforeEach(async () => {
  await db.delete(searchUsage).where(eq(searchUsage.deviceId, TEST_DEVICE_ID));
});

describe('SearchUsageService', () => {
  describe('verifyDeviceId', () => {
    it('should return true for valid device ID', async () => {
      const isValid = await searchUsageService.verifyDeviceId(TEST_DEVICE_ID);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid device ID', async () => {
      const isValid = await searchUsageService.verifyDeviceId('invalid-device-id');
      expect(isValid).toBe(false);
    });
  });

  describe('checkSearchLimits', () => {
    it('should reject invalid device ID for anonymous users', async () => {
      const result = await searchUsageService.checkSearchLimits('invalid-device-id');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid device ID');
      expect(result.remaining).toBe(0);
      expect(result.used).toBe(0);
    });

    it('should allow anonymous user with no usage', async () => {
      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100); // Anonymous limit
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(100);
    });

    it('should allow authenticated user with no usage', async () => {
      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID, TEST_USER_ID);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000); // Authenticated limit
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(1000);
    });

    it('should track usage for anonymous user', async () => {
      // Record 50 searches
      const today = new Date().toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        searchCount: 50,
        usageDate: today,
      });

      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(50);
      expect(result.remaining).toBe(50);
    });

    it('should deny anonymous user when limit exceeded', async () => {
      // Record 100 searches (at limit)
      const today = new Date().toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        searchCount: 100,
        usageDate: today,
      });

      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily search limit exceeded');
      expect(result.reason).toContain('Sign in for higher limits');
      expect(result.used).toBe(100);
      expect(result.remaining).toBe(0);
    });

    it('should track usage for authenticated user', async () => {
      // Record 500 searches
      const today = new Date().toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        userId: TEST_USER_ID,
        searchCount: 500,
        usageDate: today,
      });

      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID, TEST_USER_ID);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(500);
      expect(result.remaining).toBe(500);
    });

    it('should deny authenticated user when limit exceeded', async () => {
      // Record 1000 searches (at limit)
      const today = new Date().toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        userId: TEST_USER_ID,
        searchCount: 1000,
        usageDate: today,
      });

      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID, TEST_USER_ID);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily search limit exceeded');
      expect(result.used).toBe(1000);
      expect(result.remaining).toBe(0);
    });

    it('should not check old usage from previous days', async () => {
      // Record usage from yesterday
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        searchCount: 100,
        usageDate: yesterday,
      });

      const result = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);

      // Should start fresh today
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(100);
    });
  });

  describe('recordSearch', () => {
    it('should create new record for first search', async () => {
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      const today = new Date().toISOString().split('T')[0];
      const records = await db
        .select()
        .from(searchUsage)
        .where(eq(searchUsage.deviceId, TEST_DEVICE_ID));

      expect(records.length).toBe(1);
      expect(records[0].searchCount).toBe(1);
      expect(records[0].usageDate).toBe(today);
      expect(records[0].userId).toBeNull();
    });

    it('should create new record with user ID for authenticated user', async () => {
      await searchUsageService.recordSearch(TEST_DEVICE_ID, TEST_USER_ID);

      const records = await db
        .select()
        .from(searchUsage)
        .where(eq(searchUsage.deviceId, TEST_DEVICE_ID));

      expect(records.length).toBe(1);
      expect(records[0].searchCount).toBe(1);
      expect(records[0].userId).toBe(TEST_USER_ID);
    });

    it('should increment count for subsequent searches', async () => {
      // First search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      // Second search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      // Third search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      const records = await db
        .select()
        .from(searchUsage)
        .where(eq(searchUsage.deviceId, TEST_DEVICE_ID));

      expect(records.length).toBe(1);
      expect(records[0].searchCount).toBe(3);
    });

    it('should update timestamp on increment', async () => {
      // First search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      const firstRecord = await db
        .select()
        .from(searchUsage)
        .where(eq(searchUsage.deviceId, TEST_DEVICE_ID))
        .limit(1);

      const firstUpdatedAt = firstRecord[0].updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      const secondRecord = await db
        .select()
        .from(searchUsage)
        .where(eq(searchUsage.deviceId, TEST_DEVICE_ID))
        .limit(1);

      expect(secondRecord[0].updatedAt).toBeGreaterThan(firstUpdatedAt);
    });
  });

  describe('getSearchStats', () => {
    it('should return stats for anonymous user with no usage', async () => {
      const stats = await searchUsageService.getSearchStats(TEST_DEVICE_ID);

      const today = new Date().toISOString().split('T')[0];
      expect(stats.date).toBe(today);
      expect(stats.used).toBe(0);
      expect(stats.limit).toBe(100);
      expect(stats.remaining).toBe(100);
      expect(stats.isAuthenticated).toBe(false);
    });

    it('should return stats for authenticated user', async () => {
      const stats = await searchUsageService.getSearchStats(TEST_DEVICE_ID, TEST_USER_ID);

      expect(stats.limit).toBe(1000);
      expect(stats.isAuthenticated).toBe(true);
    });

    it('should return correct usage stats after searches', async () => {
      // Record 25 searches
      const today = new Date().toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        searchCount: 25,
        usageDate: today,
      });

      const stats = await searchUsageService.getSearchStats(TEST_DEVICE_ID);

      expect(stats.used).toBe(25);
      expect(stats.remaining).toBe(75);
    });
  });

  describe('Integration: Full search flow', () => {
    it('should handle complete search flow for anonymous user', async () => {
      // Check initial limits
      const initialCheck = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);
      expect(initialCheck.allowed).toBe(true);
      expect(initialCheck.used).toBe(0);

      // Record search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      // Check updated limits
      const afterSearch = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);
      expect(afterSearch.used).toBe(1);
      expect(afterSearch.remaining).toBe(99);

      // Get stats
      const stats = await searchUsageService.getSearchStats(TEST_DEVICE_ID);
      expect(stats.used).toBe(1);
      expect(stats.remaining).toBe(99);
    });

    it('should handle complete search flow for authenticated user', async () => {
      // Check initial limits
      const initialCheck = await searchUsageService.checkSearchLimits(
        TEST_DEVICE_ID,
        TEST_USER_ID
      );
      expect(initialCheck.allowed).toBe(true);
      expect(initialCheck.limit).toBe(1000);

      // Record search
      await searchUsageService.recordSearch(TEST_DEVICE_ID, TEST_USER_ID);

      // Check updated limits
      const afterSearch = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID, TEST_USER_ID);
      expect(afterSearch.used).toBe(1);
      expect(afterSearch.remaining).toBe(999);
    });

    it('should prevent search when limit reached', async () => {
      // Simulate 100 searches
      const today = new Date().toISOString().split('T')[0];
      await db.insert(searchUsage).values({
        deviceId: TEST_DEVICE_ID,
        searchCount: 99,
        usageDate: today,
      });

      // 100th search - should still be allowed
      const beforeLimit = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);
      expect(beforeLimit.allowed).toBe(true);
      expect(beforeLimit.remaining).toBe(1);

      // Record the 100th search
      await searchUsageService.recordSearch(TEST_DEVICE_ID);

      // 101st search - should be denied
      const atLimit = await searchUsageService.checkSearchLimits(TEST_DEVICE_ID);
      expect(atLimit.allowed).toBe(false);
      expect(atLimit.remaining).toBe(0);
    });
  });
});
