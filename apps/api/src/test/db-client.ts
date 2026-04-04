// Test database client - uses TURSO_DATABASE_URL_TEST environment variable

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';

// Get test database URL and auth token from environment
const testDatabaseUrl = Bun.env.TURSO_DATABASE_URL_TEST || process.env.TURSO_DATABASE_URL_TEST;
const testAuthToken = Bun.env.TURSO_AUTH_TOKEN_TEST || process.env.TURSO_AUTH_TOKEN_TEST;

if (!testDatabaseUrl) {
  throw new Error('TURSO_DATABASE_URL_TEST environment variable is required for running tests');
}

if (!testAuthToken) {
  throw new Error('TURSO_AUTH_TOKEN_TEST environment variable is required for running tests');
}

// Create Turso client for test database
const testClient = createClient({
  url: testDatabaseUrl,
  authToken: testAuthToken,
});

// Create Drizzle instance with schema for test database
export const testDb = drizzle(testClient, { schema });

// Export test client for raw queries
export { testClient };

// Health check function for test database
export async function checkTestDatabaseConnection(): Promise<boolean> {
  try {
    await testClient.execute('SELECT 1');
    console.log('✅ Test database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Test database connection failed:', error);
    return false;
  }
}
