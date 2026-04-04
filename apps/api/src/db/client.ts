// Database client using Drizzle ORM and Turso (libsql)

import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { Env } from '../types/env';
import * as schema from './schema';

// Cache for database instances
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let clientInstance: Client | null = null;

/**
 * Reset database cache (useful for tests)
 */
export function resetDbCache() {
  dbInstance = null;
  clientInstance = null;
}

/**
 * Get database instance (works in both Bun and Cloudflare Workers)
 */
export function getDb(env?: Env) {
  if (dbInstance && clientInstance) {
    return { db: dbInstance, client: clientInstance };
  }

  // Get database URL and auth token from environment
  let databaseUrl: string | undefined;
  let authToken: string | undefined;

  if (typeof Bun !== 'undefined') {
    // Check if we're running in test mode
    // The test runner (run-tests.ts) overrides TURSO_DATABASE_URL with the test database
    // so we can just use the regular environment variables
    databaseUrl = Bun.env.TURSO_DATABASE_URL;
    authToken = Bun.env.TURSO_AUTH_TOKEN;
  } else if (env) {
    // Cloudflare Workers (from context.env)
    databaseUrl = env.TURSO_DATABASE_URL;
    authToken = env.TURSO_AUTH_TOKEN;
  }

  if (!databaseUrl) {
    throw new Error('TURSO_DATABASE_URL environment variable is required');
  }

  if (!authToken) {
    throw new Error('TURSO_AUTH_TOKEN environment variable is required');
  }

  // Create Turso client
  clientInstance = createClient({
    url: databaseUrl,
    authToken: authToken,
  });

  dbInstance = drizzle(clientInstance, { schema });

  return { db: dbInstance, client: clientInstance };
}

// For backward compatibility in local development
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    const { db } = getDb();
    return db[prop as keyof typeof db];
  },
});

export const client = new Proxy({} as Client, {
  get(_, prop) {
    const { client } = getDb();
    return client[prop as keyof Client];
  },
});

// Health check function
export async function checkDatabaseConnection(env?: Env): Promise<boolean> {
  try {
    const { client } = getDb(env);
    await client.execute('SELECT 1');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}
