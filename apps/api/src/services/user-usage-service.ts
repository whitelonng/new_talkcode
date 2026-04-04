// User usage service for TalkCody provider - tracks usage by user ID

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { providerUsage } from '../db/schema';
import type { Env } from '../types/env';

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: {
    dailyTokens: number;
  };
  used?: {
    dailyTokens: number;
  };
}

export class UserUsageService {
  /**
   * Check usage limits for a user
   */
  async checkUsageLimits(userId: string, provider: string, env?: Env): Promise<UsageCheckResult> {
    const today = new Date().toISOString().split('T')[0];
    const dailyTokenLimit = this.getDailyTokenLimit(env);

    // Get today's usage
    const dailyUsage = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${providerUsage.totalTokens}), 0)`,
      })
      .from(providerUsage)
      .where(
        and(
          eq(providerUsage.userId, userId),
          eq(providerUsage.provider, provider),
          eq(providerUsage.usageDate, today)
        )
      );

    const usedTokens = dailyUsage[0]?.totalTokens || 0;

    if (usedTokens >= dailyTokenLimit) {
      return {
        allowed: false,
        reason: 'Daily token limit exceeded',
        remaining: { dailyTokens: 0 },
        used: { dailyTokens: usedTokens },
      };
    }

    return {
      allowed: true,
      remaining: { dailyTokens: dailyTokenLimit - usedTokens },
      used: { dailyTokens: usedTokens },
    };
  }

  /**
   * Record usage for a request and return remaining tokens
   * @param previouslyUsedTokens - Optional: tokens already used today (from checkUsageLimits)
   *                               If provided, skips the second query for remaining calculation
   */
  async recordUsage(
    userId: string,
    provider: string,
    model: string,
    tokens: { input: number; output: number },
    env?: Env,
    previouslyUsedTokens?: number
  ): Promise<{ remainingDailyTokens: number }> {
    const today = new Date().toISOString().split('T')[0];
    const totalTokensUsed = tokens.input + tokens.output;

    // Get daily token limit
    const dailyTokenLimit = this.getDailyTokenLimit(env);

    await db.insert(providerUsage).values({
      userId,
      provider,
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      totalTokens: totalTokensUsed,
      usageDate: today,
    });

    // If we already know the previously used tokens, calculate remaining directly
    if (previouslyUsedTokens !== undefined) {
      const newTotal = previouslyUsedTokens + totalTokensUsed;
      return { remainingDailyTokens: Math.max(0, dailyTokenLimit - newTotal) };
    }

    // Fallback: query for total (only if previouslyUsedTokens not provided)
    const dailyUsage = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${providerUsage.totalTokens}), 0)`,
      })
      .from(providerUsage)
      .where(
        and(
          eq(providerUsage.userId, userId),
          eq(providerUsage.provider, provider),
          eq(providerUsage.usageDate, today)
        )
      );

    const usedTokens = dailyUsage[0]?.totalTokens || 0;
    return { remainingDailyTokens: Math.max(0, dailyTokenLimit - usedTokens) };
  }

  /**
   * Get daily token limit from environment
   */
  private getDailyTokenLimit(env?: Env): number {
    if (typeof Bun !== 'undefined') {
      return parseInt(Bun.env.TALKCODY_DAILY_TOKEN_LIMIT || '100000', 10);
    }
    if (env?.TALKCODY_DAILY_TOKEN_LIMIT) {
      return parseInt(env.TALKCODY_DAILY_TOKEN_LIMIT, 10);
    }
    return 100000;
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string, provider: string, env?: Env) {
    const today = new Date().toISOString().split('T')[0];
    const dailyTokenLimit = this.getDailyTokenLimit(env);

    // Get today's usage
    const [dailyUsage] = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${providerUsage.totalTokens}), 0)`,
        inputTokens: sql<number>`COALESCE(SUM(${providerUsage.inputTokens}), 0)`,
        outputTokens: sql<number>`COALESCE(SUM(${providerUsage.outputTokens}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(providerUsage)
      .where(
        and(
          eq(providerUsage.userId, userId),
          eq(providerUsage.provider, provider),
          eq(providerUsage.usageDate, today)
        )
      );

    return {
      date: today,
      used: {
        totalTokens: dailyUsage?.totalTokens || 0,
        inputTokens: dailyUsage?.inputTokens || 0,
        outputTokens: dailyUsage?.outputTokens || 0,
        requestCount: dailyUsage?.requestCount || 0,
      },
      limit: {
        dailyTokens: dailyTokenLimit,
      },
      remaining: {
        dailyTokens: Math.max(0, dailyTokenLimit - (dailyUsage?.totalTokens || 0)),
      },
    };
  }
}

export const userUsageService = new UserUsageService();
