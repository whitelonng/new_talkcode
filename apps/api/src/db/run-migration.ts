// Run manual migration

import { sql } from 'drizzle-orm';
import { db } from './client';

async function runMigration() {
  try {
    console.log('Running migration: Adding missing columns...');

    // Add missing columns to marketplace_agents
    await db.run(sql`
      ALTER TABLE marketplace_agents
      ADD COLUMN IF NOT EXISTS model varchar(100) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS system_prompt text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS tools_config jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS rules text,
      ADD COLUMN IF NOT EXISTS output_format text,
      ADD COLUMN IF NOT EXISTS dynamic_prompt_config jsonb,
      ADD COLUMN IF NOT EXISTS rating integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS published_at timestamp,
      ADD COLUMN IF NOT EXISTS search_vector text
    `);

    console.log('✅ Added columns to marketplace_agents');

    // Update latest_version column
    await db.run(sql`
      ALTER TABLE marketplace_agents
      ALTER COLUMN latest_version SET DEFAULT '1.0.0'
    `);

    // Update description column
    await db.run(sql`
      ALTER TABLE marketplace_agents
      ALTER COLUMN description SET DEFAULT ''
    `);

    console.log('✅ Updated marketplace_agents constraints');

    // Drop old columns from users table
    await db.run(sql`
      ALTER TABLE users
      DROP COLUMN IF EXISTS oauth_provider,
      DROP COLUMN IF EXISTS oauth_id,
      DROP COLUMN IF EXISTS username,
      DROP COLUMN IF EXISTS display_name
    `);

    console.log('✅ Dropped old columns from users table');

    // Update users table
    await db.run(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name varchar(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS website text,
      ADD COLUMN IF NOT EXISTS github_id varchar(255),
      ADD COLUMN IF NOT EXISTS google_id varchar(255),
      ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_login_at timestamp
    `);

    console.log('✅ Updated users table');

    // Add indexes
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS users_email_idx ON users USING btree (email)
    `);
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS users_github_idx ON users USING btree (github_id)
    `);
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS users_google_idx ON users USING btree (google_id)
    `);

    console.log('✅ Added indexes');

    // Update agent_versions table
    await db.run(sql`
      ALTER TABLE agent_versions
      DROP COLUMN IF EXISTS model,
      ADD COLUMN IF NOT EXISTS dynamic_prompt_config jsonb,
      ADD COLUMN IF NOT EXISTS change_log text
    `);

    console.log('✅ Updated agent_versions table');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
