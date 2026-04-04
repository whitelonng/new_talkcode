#!/usr/bin/env bun
// Initialize test database schema
// This script creates all tables including FTS5 tables

import { createClient } from '@libsql/client';

const testDatabaseUrl = process.env.TURSO_DATABASE_URL_TEST || Bun.env?.TURSO_DATABASE_URL_TEST;
const testAuthToken = process.env.TURSO_AUTH_TOKEN_TEST || Bun.env?.TURSO_AUTH_TOKEN_TEST;

if (!testDatabaseUrl || !testAuthToken) {
  console.error('❌ ERROR: TURSO_DATABASE_URL_TEST and TURSO_AUTH_TOKEN_TEST are required');
  process.exit(1);
}

console.log('🚀 Initializing test database schema...');
console.log(`📊 Database: ${testDatabaseUrl.split('@')[1]?.split('/')[1] || 'test'}`);

const client = createClient({
  url: testDatabaseUrl,
  authToken: testAuthToken,
});

try {
  // Drop all existing schema objects
  console.log('🗑️  Cleaning database...');

  // Drop FTS5 tables first (they may have dependencies)
  try {
    await client.execute('DROP TABLE IF EXISTS marketplace_agents_fts');
    await client.execute('DROP TABLE IF EXISTS marketplace_skills_fts');
  } catch (_e) {
    // Ignore
  }

  // Get all schema objects
  const allObjects = await client.execute(`
    SELECT type, name FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY
      CASE type
        WHEN 'trigger' THEN 1
        WHEN 'index' THEN 2
        WHEN 'table' THEN 3
        ELSE 4
      END
  `);

  // Drop all objects
  for (const row of allObjects.rows) {
    const objType = (row as unknown as { type: string; name: string }).type;
    const objName = (row as unknown as { type: string; name: string }).name;
    try {
      if (objType === 'table') {
        await client.execute(`DROP TABLE IF EXISTS "${objName}"`);
      } else if (objType === 'index') {
        await client.execute(`DROP INDEX IF EXISTS "${objName}"`);
      } else if (objType === 'trigger') {
        await client.execute(`DROP TRIGGER IF EXISTS "${objName}"`);
      }
    } catch (_e) {
      // Ignore errors
    }
  }
  console.log('✅ Database cleaned');

  // Read the base schema migration
  const baseSchemaSql = await Bun.file('./src/db/migrations/0000_wakeful_tana_nile.sql').text();

  // Read the simplified FTS5 schema (just tables and triggers, no initial data)
  const fts5Sql = await Bun.file('./src/test/init-fts5.sql').text();

  // Execute base schema
  console.log('📝 Creating base tables...');
  const baseStatements = baseSchemaSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const statement of baseStatements) {
    try {
      await client.execute(statement);
    } catch (error: unknown) {
      // Skip if already exists
      if (error instanceof Error && error.message?.includes('already exists')) {
        continue;
      }
      throw error;
    }
  }
  console.log('✅ Base tables created');

  // Add missing columns to tables
  console.log('📝 Adding missing columns...');

  const alterStatements = [
    // users table
    { table: 'users', column: 'display_name', type: 'TEXT' },
    // marketplace_skills table
    { table: 'marketplace_skills', column: 'storage_url', type: 'TEXT' },
    { table: 'marketplace_skills', column: 'package_size', type: 'INTEGER' },
    { table: 'marketplace_skills', column: 'checksum', type: 'TEXT' },
    {
      table: 'marketplace_skills',
      column: 'required_permission',
      type: "TEXT DEFAULT 'read-only'",
    },
    { table: 'marketplace_skills', column: 'has_scripts', type: 'INTEGER DEFAULT 0 NOT NULL' },
    // Agent Skills Specification fields
    { table: 'marketplace_skills', column: 'compatibility', type: 'TEXT' },
    { table: 'marketplace_skills', column: 'metadata', type: 'TEXT' },
    // skill_versions table
    { table: 'skill_versions', column: 'storage_url', type: 'TEXT' },
    { table: 'skill_versions', column: 'package_size', type: 'INTEGER' },
    { table: 'skill_versions', column: 'checksum', type: 'TEXT' },
    // Agent Skills Specification fields for versions
    { table: 'skill_versions', column: 'compatibility', type: 'TEXT' },
    { table: 'skill_versions', column: 'metadata', type: 'TEXT' },
  ];

  for (const { table, column, type } of alterStatements) {
    try {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`  ✅ ${table}.${column} added`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('duplicate column name')) {
        console.log(`  ${table}.${column} already exists`);
      } else {
        throw error;
      }
    }
  }
  console.log('✅ Missing columns added');

  // Execute FTS5 schema
  console.log('📝 Creating FTS5 tables and triggers...');

  // Parse SQL: split on END; for triggers, regular ; for everything else
  const statements = [];
  let current = '';
  let inTrigger = false;

  for (const line of fts5Sql.split('\n')) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('--')) continue;

    // Track if we're in a CREATE TRIGGER block
    if (trimmed.toUpperCase().startsWith('CREATE TRIGGER')) {
      inTrigger = true;
    }

    current += `${line}\n`;

    // End of statement detection
    if (trimmed.endsWith(';')) {
      // If in trigger, only end when we see END;
      if (inTrigger) {
        if (trimmed.toUpperCase() === 'END;') {
          statements.push(current.trim());
          current = '';
          inTrigger = false;
        }
      } else {
        statements.push(current.trim());
        current = '';
      }
    }
  }

  // Execute each statement
  console.log(`  Found ${statements.length} FTS5 statements`);
  for (const stmt of statements) {
    if (!stmt) continue;

    try {
      await client.execute(stmt);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('already exists')) {
        continue;
      }
      console.error(`Failed to execute:`, stmt.substring(0, 100));
      throw e;
    }
  }
  console.log('✅ FTS5 tables and triggers created');

  // Verify tables exist
  const result = await client.execute(`
    SELECT name, type FROM sqlite_master
    WHERE type IN ('table', 'view')
    ORDER BY name
  `);

  console.log(`\n✅ Schema initialized successfully!`);
  console.log(`📊 Total objects created: ${result.rows.length}`);
  console.log('\nTables:');
  for (const row of result.rows) {
    console.log(
      `  - ${(row as unknown as { name: string; type: string }).name} (${(row as unknown as { name: string; type: string }).type})`
    );
  }

  // Verify FTS5 tables specifically
  console.log('\n🔍 Verifying FTS5 tables...');
  try {
    const agentsFts = await client.execute('SELECT COUNT(*) as count FROM marketplace_agents_fts');
    console.log(`  ✅ marketplace_agents_fts exists (${agentsFts.rows[0].count} rows)`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ marketplace_agents_fts: ${message}`);
  }

  try {
    const skillsFts = await client.execute('SELECT COUNT(*) as count FROM marketplace_skills_fts');
    console.log(`  ✅ marketplace_skills_fts exists (${skillsFts.rows[0].count} rows)`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ marketplace_skills_fts: ${message}`);
  }
} catch (error) {
  console.error('❌ Failed to initialize schema:', error);
  process.exit(1);
}
