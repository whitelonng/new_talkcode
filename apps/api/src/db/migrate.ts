// Database migration script for Turso
// Custom implementation to handle multi-statement SQL files with Turso

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

console.log('🚀 Running database migrations...');

async function runMigrations() {
  // Get database URL and auth token
  const databaseUrl = process.env.TURSO_DATABASE_URL || Bun.env?.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || Bun.env?.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    throw new Error('TURSO_DATABASE_URL environment variable is required');
  }

  if (!authToken) {
    throw new Error('TURSO_AUTH_TOKEN environment variable is required');
  }

  // Create Turso client
  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  });

  const _db = drizzle(client, { schema });

  // Create migrations tracking table if it doesn't exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Read migration journal
  const migrationsFolder = './src/db/migrations';
  const journalPath = join(migrationsFolder, 'meta/_journal.json');
  const journalContent = await readFile(journalPath, 'utf-8');
  const journal = JSON.parse(journalContent);

  // Get already applied migrations
  const appliedMigrations = await client.execute('SELECT hash FROM __drizzle_migrations');
  const appliedHashes = new Set(
    appliedMigrations.rows.map((row) => (row as unknown as { hash: string }).hash)
  );

  // Process each migration in order
  for (const entry of journal.entries) {
    const migrationHash = `${entry.idx}:${entry.tag}`;

    if (appliedHashes.has(migrationHash)) {
      console.log(`⏭️  Skipping already applied migration: ${entry.tag}`);
      continue;
    }

    console.log(`📦 Applying migration: ${entry.tag}`);

    // Read migration SQL file
    const sqlFilePath = join(migrationsFolder, `${entry.tag}.sql`);
    const sqlContent = await readFile(sqlFilePath, 'utf-8');

    // Split SQL into individual statements
    let statements: string[];

    if (sqlContent.includes('--> statement-breakpoint')) {
      // Drizzle-generated SQL uses statement-breakpoint
      statements = sqlContent
        .split('--> statement-breakpoint')
        .map((stmt) => {
          // Remove SQL comments (lines starting with --)
          return stmt
            .split('\n')
            .filter((line) => !line.trim().startsWith('--'))
            .join('\n')
            .trim();
        })
        .filter((stmt) => stmt.length > 0)
        .map((stmt) => stmt.replace(/;$/, ''));
    } else {
      // Hand-written SQL - need to parse carefully
      // Remove comment lines but preserve block structure for triggers
      const cleanedSql = sqlContent
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('--');
        })
        .join('\n');

      // Split by semicolons, but be careful with BEGIN...END blocks
      statements = [];
      let current = '';
      let inBlock = 0;

      for (const char of cleanedSql) {
        current += char;

        // Track BEGIN...END blocks
        const upperCurrent = current.toUpperCase();
        if (upperCurrent.endsWith('BEGIN')) {
          inBlock++;
        } else if (upperCurrent.endsWith('END')) {
          inBlock--;
        }

        // Split on semicolon only if not in a block
        if (char === ';' && inBlock === 0) {
          const stmt = current.slice(0, -1).trim();
          if (stmt) {
            statements.push(stmt);
          }
          current = '';
        }
      }

      // Add any remaining statement
      const lastStmt = current.trim();
      if (lastStmt) {
        statements.push(lastStmt);
      }
    }

    // Execute each statement individually
    // Turso requires each statement to be executed separately
    if (statements.length > 0) {
      try {
        console.log(`   Executing ${statements.length} statements...`);

        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          if (stmt.trim()) {
            try {
              await client.execute(stmt);
              console.log(`   ✓ Statement ${i + 1}/${statements.length}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`   ✗ Statement ${i + 1}/${statements.length} failed:`, errorMessage);
              throw error;
            }
          }
        }

        // Record successful migration
        await client.execute({
          sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          args: [migrationHash, Date.now()],
        });

        console.log(`✅ Applied migration: ${entry.tag}`);
      } catch (error) {
        console.error(`❌ Failed to apply migration ${entry.tag}:`, error);
        throw error;
      }
    }
  }

  console.log('✅ All migrations completed successfully!');
}

try {
  await runMigrations();
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
