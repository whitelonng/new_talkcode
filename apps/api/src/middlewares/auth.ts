// Authentication middleware

import type { User } from '@talkcody/shared';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { db } from '../db/client';
import { users } from '../db/schema';
import { extractTokenFromHeader, verifyToken } from '../lib/jwt';
import type { HonoContext } from '../types/context';
import type { DbUser } from '../types/database';

/**
 * Map database user to API user format
 */
function mapDbUserToUser(user: DbUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email || undefined,
    avatarUrl: user.avatarUrl || undefined,
    displayName: user.displayName || undefined,
    oauthProvider: user.githubId ? 'github' : 'google',
    oauthId: (user.githubId || user.googleId) ?? '',
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

/**
 * Authentication middleware
 * Validates JWT token and loads user from database
 */
export const authMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  const authorization = c.req.header('Authorization');
  const token = extractTokenFromHeader(authorization);

  if (!token) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401);
  }

  const payload = await verifyToken(token, c.env);
  if (!payload || !payload.userId) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }

  // Load user from database
  try {
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    if (!user) {
      return c.json({ error: 'Unauthorized: User not found' }, 401);
    }

    // Set user in context
    c.set('user', mapDbUserToUser(user));
    c.set('userId', user.id);
  } catch (error) {
    console.error('Error loading user:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }

  await next();
});

/**
 * Optional authentication middleware
 * Does not fail if no token is provided, but loads user if available
 */
export const optionalAuthMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  const authorization = c.req.header('Authorization');
  const token = extractTokenFromHeader(authorization);

  if (token) {
    const payload = await verifyToken(token, c.env);
    if (payload?.userId) {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

        if (user) {
          c.set('user', mapDbUserToUser(user));
          c.set('userId', user.id);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    }
  }

  await next();
});

/**
 * Helper function to get authenticated user and userId
 * Use this after authMiddleware
 */
export function getAuth(c: Context<HonoContext>): { userId: string; user: User } {
  const userId = c.get('userId');
  const user = c.get('user');

  if (!userId || !user) {
    throw new Error('Unauthorized');
  }

  return { userId, user };
}

/**
 * Helper function to get optional authenticated user
 * Use this after optionalAuthMiddleware
 */
export function getOptionalAuth(c: Context<HonoContext>): { userId: string; user: User } | null {
  const userId = c.get('userId');
  const user = c.get('user');

  if (!userId || !user) {
    return null;
  }

  return { userId, user };
}
