// Search usage service - tracks search usage by device ID and optional user ID for rate limiting

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { analyticsEvents, searchUsage } from '../db/schema';

// Rate limits
const ANONYMOUS_DAILY_LIMIT = 100; // 100 searches/day for anonymous users
const AUTHENTICATED_DAILY_LIMIT = 1000; // 1000 searches/day for authenticated users

export interface SearchUsageCheckResult {
  allowed: boolean;
  reason?: string;
  remaining: number;
  used: number;
  limit: number;
}

export class SearchUsageService {
  /**
   * Verify device ID exists in analytics_events table
   * This ensures the request comes from a real TalkCody application
   */
  async verifyDeviceId(deviceId: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.deviceId, deviceId))
      .limit(1);

    return (result[0]?.count || 0) > 0;
  }

  /**
   * Check search limits for a device/user
   * @param deviceId - Required device ID
   * @param userId - Optional user ID (if authenticated, gets higher limit)
   */
  async checkSearchLimits(deviceId: string, userId?: string): Promise<SearchUsageCheckResult> {
    // Verify device ID for anonymous users
    // Authenticated users are already verified through auth system
    if (!userId) {
      const isValidDevice = await this.verifyDeviceId(deviceId);
      if (!isValidDevice) {
        return {
          allowed: false,
          reason:
            'Invalid device ID. Please ensure you are using the official TalkCody application.',
          remaining: 0,
          used: 0,
          limit: ANONYMOUS_DAILY_LIMIT,
        };
      }
    }
    const today = new Date().toISOString().split('T')[0];
    const limit = userId ? AUTHENTICATED_DAILY_LIMIT : ANONYMOUS_DAILY_LIMIT;

    // Get today's search usage
    // If userId is provided, check user usage; otherwise check device usage
    const usageResult = await db
      .select({
        searchCount: sql<number>`COALESCE(SUM(${searchUsage.searchCount}), 0)`,
      })
      .from(searchUsage)
      .where(
        and(
          userId ? eq(searchUsage.userId, userId) : eq(searchUsage.deviceId, deviceId),
          eq(searchUsage.usageDate, today)
        )
      );

    const used = usageResult[0]?.searchCount || 0;

    if (used >= limit) {
      return {
        allowed: false,
        reason: userId
          ? `Daily search limit exceeded (${limit} searches/day for authenticated users)`
          : `Daily search limit exceeded (${limit} searches/day). Sign in for higher limits.`,
        remaining: 0,
        used,
        limit,
      };
    }

    return {
      allowed: true,
      remaining: limit - used,
      used,
      limit,
    };
  }

  /**
   * Record a search request
   * @param deviceId - Required device ID
   * @param userId - Optional user ID (if authenticated)
   */
  async recordSearch(deviceId: string, userId?: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Check if record exists for today
    const existing = await db
      .select()
      .from(searchUsage)
      .where(
        and(
          userId ? eq(searchUsage.userId, userId) : eq(searchUsage.deviceId, deviceId),
          eq(searchUsage.usageDate, today)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record - increment search count
      await db
        .update(searchUsage)
        .set({
          searchCount: sql`${searchUsage.searchCount} + 1`,
          updatedAt: Date.now(),
        })
        .where(eq(searchUsage.id, existing[0].id));
    } else {
      // Insert new record
      await db.insert(searchUsage).values({
        deviceId,
        userId: userId || null,
        searchCount: 1,
        usageDate: today,
      });
    }
  }

  /**
   * Get search usage statistics
   * @param deviceId - Required device ID
   * @param userId - Optional user ID
   */
  async getSearchStats(deviceId: string, userId?: string) {
    const today = new Date().toISOString().split('T')[0];
    const limit = userId ? AUTHENTICATED_DAILY_LIMIT : ANONYMOUS_DAILY_LIMIT;

    const [usageResult] = await db
      .select({
        searchCount: sql<number>`COALESCE(SUM(${searchUsage.searchCount}), 0)`,
      })
      .from(searchUsage)
      .where(
        and(
          userId ? eq(searchUsage.userId, userId) : eq(searchUsage.deviceId, deviceId),
          eq(searchUsage.usageDate, today)
        )
      );

    const used = usageResult?.searchCount || 0;

    return {
      date: today,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      isAuthenticated: !!userId,
    };
  }
}

export const searchUsageService = new SearchUsageService();
