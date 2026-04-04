// JWT utilities using jose library

import { jwtVerify, SignJWT } from 'jose';
import type { Env } from '../types/env';

export interface JWTPayload {
  userId: string;
  username: string;
  email?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Get JWT secret from environment
 */
function getJWTSecret(env?: Env): Uint8Array {
  let secret: string | undefined;

  if (typeof Bun !== 'undefined' && Bun.env.JWT_SECRET) {
    // Bun runtime (local development)
    secret = Bun.env.JWT_SECRET;
  } else if (env?.JWT_SECRET) {
    // Cloudflare Workers (from context.env)
    secret = env.JWT_SECRET;
  }

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT token
 */
export async function signToken(payload: JWTPayload, expiresIn = '7d', env?: Env): Promise<string> {
  const secret = getJWTSecret(env);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, env?: Env): Promise<JWTPayload | null> {
  try {
    const secret = getJWTSecret(env);
    const { payload } = await jwtVerify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authorization?: string): string | null {
  if (!authorization) return null;

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}
