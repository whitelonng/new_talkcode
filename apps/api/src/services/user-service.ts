// User service

import type { PublicUser } from '@talkcody/shared';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { marketplaceAgents, users } from '../db/schema';

export interface UserStats {
  totalAgents: number;
  totalInstalls: number;
  featuredAgents: number;
}

export class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<PublicUser | null> {
    const results = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (results.length === 0) {
      return null;
    }

    // Get published agent count for this user
    const agentCountResult = await db
      .select({ count: count() })
      .from(marketplaceAgents)
      .where(and(eq(marketplaceAgents.authorId, userId), eq(marketplaceAgents.isPublished, true)));

    const agentCount = agentCountResult[0]?.count || 0;

    return this.mapToPublicUser(results[0], agentCount);
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    // Get total agents count
    const agentCountResult = await db
      .select({ count: count() })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.authorId, userId));

    // Get total installs
    const installStats = await db
      .select({
        totalInstalls: sql<number>`COALESCE(SUM(${marketplaceAgents.installCount}), 0)`,
        featuredCount: sql<number>`COUNT(CASE WHEN ${marketplaceAgents.isFeatured} = true THEN 1 END)`,
      })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.authorId, userId));

    return {
      totalAgents: agentCountResult[0]?.count || 0,
      totalInstalls: Number(installStats[0]?.totalInstalls) || 0,
      featuredAgents: Number(installStats[0]?.featuredCount) || 0,
    };
  }

  /**
   * Get user's published agents
   */
  async getUserAgents(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const agents = await db
      .select()
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.authorId, userId))
      .orderBy(desc(marketplaceAgents.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.authorId, userId));

    return {
      agents,
      total: totalResult[0]?.count || 0,
      limit,
      offset,
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    data: {
      name?: string;
      displayName?: string;
      bio?: string;
      website?: string;
      avatarUrl?: string;
    }
  ) {
    const updates: Partial<{
      name: string;
      displayName: string;
      bio: string;
      website: string;
      avatarUrl: string;
    }> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.website !== undefined) updates.website = data.website;
    if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;

    if (Object.keys(updates).length === 0) {
      return this.getUserProfile(userId);
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    return this.getUserProfile(userId);
  }

  /**
   * Map database user to public user format
   */
  private mapToPublicUser(
    dbUser: {
      id: string;
      name: string;
      displayName?: string | null;
      avatarUrl: string | null;
      bio: string | null;
      website: string | null;
    },
    agentCount: number = 0
  ): PublicUser {
    return {
      id: dbUser.id,
      name: dbUser.name,
      displayName: dbUser.displayName || undefined,
      avatarUrl: dbUser.avatarUrl,
      bio: dbUser.bio,
      website: dbUser.website,
      agentCount,
    };
  }
}

export const userService = new UserService();
