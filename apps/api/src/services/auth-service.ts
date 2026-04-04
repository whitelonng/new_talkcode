// Authentication service

import type { User } from '@talkcody/shared';
import { eq } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { DbUser } from '../types/database';
import type { Env } from '../types/env';

const _JWT_EXPIRATION = '7d'; // 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  exp?: number;
}

/**
 * Get JWT secret from environment
 */
function getJWTSecret(env?: Env): string {
  if (typeof Bun !== 'undefined' && Bun.env.JWT_SECRET) {
    return Bun.env.JWT_SECRET;
  } else if (env?.JWT_SECRET) {
    return env.JWT_SECRET;
  }
  throw new Error('JWT_SECRET environment variable is required');
}

export class AuthService {
  /**
   * Generate JWT token for user
   */
  async generateToken(userId: string, email: string, env?: Env): Promise<string> {
    const payload: JWTPayload = {
      userId,
      email,
    };
    return await sign(payload, getJWTSecret(env));
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string, env?: Env): Promise<JWTPayload | null> {
    try {
      const payload = await verify(token, getJWTSecret(env));
      return payload as JWTPayload;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Find or create user from OAuth profile
   */
  async findOrCreateUser(profile: {
    provider: 'github' | 'google';
    providerId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
    // Check if user exists by provider ID
    const providerIdColumn = profile.provider === 'github' ? users.githubId : users.googleId;
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(providerIdColumn, profile.providerId))
      .limit(1);

    if (existingUsers.length > 0) {
      // Update last login and avatar (only if user has no avatar)
      const updatedAvatarUrl = existingUsers[0].avatarUrl || profile.avatarUrl;
      await db
        .update(users)
        .set({
          lastLoginAt: Date.now(),
          avatarUrl: updatedAvatarUrl,
        })
        .where(eq(users.id, existingUsers[0].id));

      // Return updated user data
      return this.mapToPublicUser({
        ...existingUsers[0],
        avatarUrl: updatedAvatarUrl,
      });
    }

    // Check if user exists by email
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);

    if (existingByEmail.length > 0) {
      // Link provider to existing account and update avatar (only if user has no avatar)
      const updatedAvatarUrl = existingByEmail[0].avatarUrl || profile.avatarUrl;
      await db
        .update(users)
        .set({
          githubId:
            profile.provider === 'github' ? profile.providerId : existingByEmail[0].githubId,
          googleId:
            profile.provider === 'google' ? profile.providerId : existingByEmail[0].googleId,
          lastLoginAt: Date.now(),
          avatarUrl: updatedAvatarUrl,
        })
        .where(eq(users.id, existingByEmail[0].id));

      // Return updated user data
      return this.mapToPublicUser({
        ...existingByEmail[0],
        avatarUrl: updatedAvatarUrl,
        githubId: profile.provider === 'github' ? profile.providerId : existingByEmail[0].githubId,
        googleId: profile.provider === 'google' ? profile.providerId : existingByEmail[0].googleId,
      });
    }

    // Create new user
    const newUser = await db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        githubId: profile.provider === 'github' ? profile.providerId : null,
        googleId: profile.provider === 'google' ? profile.providerId : null,
        role: 'user',
        bio: null,
        website: null,
        isVerified: true, // OAuth users are pre-verified
        lastLoginAt: new Date(),
      })
      .returning();

    return this.mapToPublicUser(newUser[0]);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const results = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.mapToPublicUser(results[0]);
  }

  /**
   * Map database user to public user format
   */
  private mapToPublicUser(dbUser: DbUser): User {
    // Determine OAuth provider and ID
    const oauthProvider = dbUser.githubId ? 'github' : 'google';
    const oauthId = dbUser.githubId || dbUser.googleId || '';

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      displayName: dbUser.displayName || undefined,
      avatarUrl: dbUser.avatarUrl,
      oauthProvider,
      oauthId,
      createdAt: new Date(dbUser.createdAt).toISOString(),
      updatedAt: new Date(dbUser.updatedAt).toISOString(),
    };
  }
}

export const authService = new AuthService();
