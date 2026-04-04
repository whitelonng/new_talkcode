// Analytics service for tracking app usage

import { count, countDistinct, gte } from 'drizzle-orm';
import { db, getDb } from '../db/client';
import { analyticsEvents, users } from '../db/schema';

export interface TrackEventInput {
  deviceId: string;
  eventType: 'session_start' | 'session_end';
  sessionId: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
  country?: string;
}

export interface DashboardStats {
  dau: number;
  mau: number;
  totalUsers: number;
  avgSessionDurationMinutes: number;
  topCountries: Array<{ country: string; count: number }>;
  topVersions: Array<{ version: string; count: number }>;
  topOS: Array<{ os: string; count: number }>;
  dailyActiveHistory: Array<{ date: string; count: number }>;
}

export class AnalyticsService {
  async trackEvent(input: TrackEventInput): Promise<void> {
    await db.insert(analyticsEvents).values({
      deviceId: input.deviceId,
      eventType: input.eventType,
      sessionId: input.sessionId,
      osName: input.osName || null,
      osVersion: input.osVersion || null,
      appVersion: input.appVersion || null,
      country: input.country || null,
    });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = Date.now();
    const todayStart = this.getStartOfDay(now);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Run queries with individual error handling to prevent one failure from breaking all
    const [
      dau,
      mau,
      totalUsers,
      avgSessionDurationMinutes,
      topCountries,
      topVersions,
      topOS,
      dailyActiveHistory,
    ] = await Promise.all([
      this.getDAU(todayStart).catch((e) => {
        console.error('getDAU error:', e);
        return 0;
      }),
      this.getMAU(thirtyDaysAgo).catch((e) => {
        console.error('getMAU error:', e);
        return 0;
      }),
      this.getTotalUsers().catch((e) => {
        console.error('getTotalUsers error:', e);
        return 0;
      }),
      this.getAvgSessionDuration(thirtyDaysAgo),
      this.getTopCountries(thirtyDaysAgo).catch((e) => {
        console.error('getTopCountries error:', e);
        return [];
      }),
      this.getTopVersions(thirtyDaysAgo).catch((e) => {
        console.error('getTopVersions error:', e);
        return [];
      }),
      this.getTopOS(thirtyDaysAgo).catch((e) => {
        console.error('getTopOS error:', e);
        return [];
      }),
      this.getDailyActiveHistory(thirtyDaysAgo),
    ]);

    return {
      dau,
      mau,
      totalUsers,
      avgSessionDurationMinutes,
      topCountries,
      topVersions,
      topOS,
      dailyActiveHistory,
    };
  }

  private getStartOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private async getDAU(todayStart: number): Promise<number> {
    const result = await db
      .select({ count: countDistinct(analyticsEvents.deviceId) })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, todayStart));
    return result[0]?.count || 0;
  }

  private async getMAU(thirtyDaysAgo: number): Promise<number> {
    const result = await db
      .select({ count: countDistinct(analyticsEvents.deviceId) })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, thirtyDaysAgo));
    return result[0]?.count || 0;
  }

  private async getTotalUsers(): Promise<number> {
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count || 0;
  }

  private async getAvgSessionDuration(since: number): Promise<number> {
    // Calculate average session duration by matching session_start with session_end
    // Returns 0 if no complete sessions exist
    try {
      const { client } = getDb();
      const result = await client.execute({
        sql: `SELECT COALESCE(AVG(duration_minutes), 0) as avg_duration FROM (
          SELECT
            s.session_id,
            (e.created_at - s.created_at) / 60000.0 as duration_minutes
          FROM analytics_events s
          INNER JOIN analytics_events e ON s.session_id = e.session_id AND e.event_type = 'session_end'
          WHERE s.event_type = 'session_start' AND s.created_at >= ?
        )
        WHERE duration_minutes > 0`,
        args: [since],
      });
      const avgDuration = (result.rows[0] as { avg_duration: number | null })?.avg_duration;
      return avgDuration || 0;
    } catch (error) {
      console.error('getAvgSessionDuration error:', error);
      return 0;
    }
  }

  private async getTopCountries(since: number): Promise<Array<{ country: string; count: number }>> {
    try {
      const { client } = getDb();
      const result = await client.execute({
        sql: `SELECT country, COUNT(DISTINCT device_id) as count
          FROM analytics_events
          WHERE created_at >= ? AND country IS NOT NULL
          GROUP BY country
          ORDER BY count DESC
          LIMIT 10`,
        args: [since],
      });
      return result.rows as Array<{ country: string; count: number }>;
    } catch (error) {
      console.error('getTopCountries error:', error);
      return [];
    }
  }

  private async getTopVersions(since: number): Promise<Array<{ version: string; count: number }>> {
    try {
      const { client } = getDb();
      const result = await client.execute({
        sql: `SELECT app_version as version, COUNT(DISTINCT device_id) as count
          FROM analytics_events
          WHERE created_at >= ? AND event_type = 'session_start' AND app_version IS NOT NULL
          GROUP BY app_version
          ORDER BY count DESC
          LIMIT 10`,
        args: [since],
      });
      return result.rows as Array<{ version: string; count: number }>;
    } catch (error) {
      console.error('getTopVersions error:', error);
      return [];
    }
  }

  private async getTopOS(since: number): Promise<Array<{ os: string; count: number }>> {
    try {
      const { client } = getDb();
      const result = await client.execute({
        sql: `SELECT os_name as os, COUNT(DISTINCT device_id) as count
          FROM analytics_events
          WHERE created_at >= ? AND os_name IS NOT NULL
          GROUP BY os_name
          ORDER BY count DESC`,
        args: [since],
      });
      return result.rows as Array<{ os: string; count: number }>;
    } catch (error) {
      console.error('getTopOS error:', error);
      return [];
    }
  }

  private async getDailyActiveHistory(
    since: number
  ): Promise<Array<{ date: string; count: number }>> {
    try {
      const { client } = getDb();
      const result = await client.execute({
        sql: `SELECT
          date(created_at / 1000, 'unixepoch') as date,
          COUNT(DISTINCT device_id) as count
        FROM analytics_events
        WHERE created_at >= ?
        GROUP BY date(created_at / 1000, 'unixepoch')
        ORDER BY date ASC`,
        args: [since],
      });
      return result.rows as Array<{ date: string; count: number }>;
    } catch (error) {
      console.error('getDailyActiveHistory error:', error);
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();
