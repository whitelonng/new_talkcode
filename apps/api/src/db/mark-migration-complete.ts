// Utility script to mark migrations as completed without running them
// Useful when migrations have already been applied manually

import { createClient } from '@libsql/client';

const migrationToMark = process.argv[2];

if (!migrationToMark) {
  console.error('Usage: bun run src/db/mark-migration-complete.ts <migration-tag>');
  console.error('Example: bun run src/db/mark-migration-complete.ts 0000_wakeful_tana_nile');
  process.exit(1);
}

async function markComplete() {
  const databaseUrl = process.env.TURSO_DATABASE_URL || Bun.env?.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || Bun.env?.TURSO_AUTH_TOKEN;

  if (!databaseUrl || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  }

  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  });

  // Create migrations table if it doesn't exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Parse migration tag to get index
  const match = migrationToMark.match(/^(\d+)_(.+)$/);
  if (!match) {
    throw new Error('Invalid migration tag format. Expected: 0000_migration_name');
  }

  const idx = parseInt(match[1], 10);
  const migrationHash = `${idx}:${migrationToMark}`;

  // Check if already marked
  const existing = await client.execute({
    sql: 'SELECT hash FROM __drizzle_migrations WHERE hash = ?',
    args: [migrationHash],
  });

  if (existing.rows.length > 0) {
    console.log(`⏭️  Migration ${migrationToMark} is already marked as complete`);
    return;
  }

  // Mark as complete
  await client.execute({
    sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    args: [migrationHash, Date.now()],
  });

  console.log(`✅ Marked migration ${migrationToMark} as complete`);
}

try {
  await markComplete();
  process.exit(0);
} catch (error) {
  console.error('❌ Failed:', error);
  process.exit(1);
}
