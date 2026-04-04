// Initialize test database schema
// This script creates all tables in the test database
// NOTE: Uses DATABASE_URL_TEST via environment variable override

import { sql } from 'drizzle-orm';
import { testDb } from './db-client';

async function initTestDatabase() {
  try {
    console.log('🔄 Initializing test database schema...');

    // Create users table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" varchar(255) NOT NULL,
        "name" varchar(255) NOT NULL,
        "avatar_url" text,
        "role" varchar(20) DEFAULT 'user' NOT NULL,
        "bio" text,
        "website" text,
        "github_id" varchar(255),
        "google_id" varchar(255),
        "is_verified" boolean DEFAULT false NOT NULL,
        "last_login_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
      )
    `);
    console.log('✅ Created users table');

    // Create categories table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "description" text,
        "icon" varchar(50),
        "display_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "categories_name_unique" UNIQUE("name"),
        CONSTRAINT "categories_slug_unique" UNIQUE("slug")
      )
    `);
    console.log('✅ Created categories table');

    // Create tags table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(50) NOT NULL,
        "slug" varchar(50) NOT NULL,
        "usage_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "tags_name_unique" UNIQUE("name"),
        CONSTRAINT "tags_slug_unique" UNIQUE("slug")
      )
    `);
    console.log('✅ Created tags table');

    // Create marketplace_agents table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "marketplace_agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "long_description" text,
        "author_id" uuid NOT NULL,
        "model" varchar(100) NOT NULL,
        "system_prompt" text NOT NULL,
        "tools_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "rules" text,
        "output_format" text,
        "dynamic_prompt_config" jsonb,
        "icon_url" text,
        "banner_url" text,
        "download_count" integer DEFAULT 0 NOT NULL,
        "install_count" integer DEFAULT 0 NOT NULL,
        "usage_count" integer DEFAULT 0 NOT NULL,
        "rating" integer DEFAULT 0 NOT NULL,
        "rating_count" integer DEFAULT 0 NOT NULL,
        "is_featured" boolean DEFAULT false NOT NULL,
        "is_published" boolean DEFAULT false NOT NULL,
        "published_at" timestamp,
        "latest_version" varchar(50) NOT NULL,
        "search_vector" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "marketplace_agents_slug_unique" UNIQUE("slug")
      )
    `);
    console.log('✅ Created marketplace_agents table');

    // Create agent_versions table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "agent_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" uuid NOT NULL,
        "version" varchar(50) NOT NULL,
        "system_prompt" text NOT NULL,
        "tools_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "rules" text,
        "output_format" text,
        "dynamic_prompt_config" jsonb,
        "change_log" text,
        "is_prerelease" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "versions_unique" UNIQUE("agent_id", "version")
      )
    `);
    console.log('✅ Created agent_versions table');

    // Create agent_categories junction table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "agent_categories" (
        "agent_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "agent_categories_pk" UNIQUE("agent_id", "category_id")
      )
    `);
    console.log('✅ Created agent_categories table');

    // Create agent_tags junction table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "agent_tags" (
        "agent_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        CONSTRAINT "agent_tags_pk" UNIQUE("agent_id", "tag_id")
      )
    `);
    console.log('✅ Created agent_tags table');

    // Create collections table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "collections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(255) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "description" text,
        "icon" varchar(50),
        "is_featured" boolean DEFAULT false NOT NULL,
        "display_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "collections_slug_unique" UNIQUE("slug")
      )
    `);
    console.log('✅ Created collections table');

    // Create collection_agents junction table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "collection_agents" (
        "collection_id" uuid NOT NULL,
        "agent_id" uuid NOT NULL,
        "display_order" integer DEFAULT 0 NOT NULL,
        CONSTRAINT "collection_agents_pk" UNIQUE("collection_id", "agent_id")
      )
    `);
    console.log('✅ Created collection_agents table');

    // Create agent_stats table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "agent_stats" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" uuid NOT NULL,
        "version" varchar(50),
        "event_type" varchar(20) NOT NULL,
        "user_id" uuid,
        "device_id" varchar(255),
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Created agent_stats table');

    // Create marketplace_skills table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "marketplace_skills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "long_description" text,
        "author_id" uuid NOT NULL,
        "system_prompt_fragment" text,
        "workflow_rules" text,
        "documentation" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "icon_url" text,
        "banner_url" text,
        "download_count" integer DEFAULT 0 NOT NULL,
        "install_count" integer DEFAULT 0 NOT NULL,
        "usage_count" integer DEFAULT 0 NOT NULL,
        "rating" integer DEFAULT 0 NOT NULL,
        "rating_count" integer DEFAULT 0 NOT NULL,
        "is_featured" boolean DEFAULT false NOT NULL,
        "is_published" boolean DEFAULT false NOT NULL,
        "published_at" timestamp,
        "latest_version" varchar(50) NOT NULL,
        "search_vector" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "marketplace_skills_slug_unique" UNIQUE("slug")
      )
    `);
    console.log('✅ Created marketplace_skills table');

    // Create skill_versions table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "skill_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "skill_id" uuid NOT NULL,
        "version" varchar(50) NOT NULL,
        "system_prompt_fragment" text,
        "workflow_rules" text,
        "documentation" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "change_log" text,
        "is_prerelease" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "skill_versions_unique" UNIQUE("skill_id", "version")
      )
    `);
    console.log('✅ Created skill_versions table');

    // Create skill_categories junction table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "skill_categories" (
        "skill_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "skill_categories_pk" UNIQUE("skill_id", "category_id")
      )
    `);
    console.log('✅ Created skill_categories table');

    // Create skill_tags junction table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "skill_tags" (
        "skill_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        CONSTRAINT "skill_tags_pk" UNIQUE("skill_id", "tag_id")
      )
    `);
    console.log('✅ Created skill_tags table');

    // Create skill_stats table
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS "skill_stats" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "skill_id" uuid NOT NULL,
        "version" varchar(50),
        "event_type" varchar(20) NOT NULL,
        "user_id" uuid,
        "device_id" varchar(255),
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Created skill_stats table');

    // Add foreign keys
    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_author_id_users_id_fk"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_marketplace_agents_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "marketplace_agents"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_categories" ADD CONSTRAINT "agent_categories_agent_id_marketplace_agents_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "marketplace_agents"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_categories" ADD CONSTRAINT "agent_categories_category_id_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_tags" ADD CONSTRAINT "agent_tags_agent_id_marketplace_agents_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "marketplace_agents"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_tags" ADD CONSTRAINT "agent_tags_tag_id_tags_id_fk"
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_stats" ADD CONSTRAINT "agent_stats_agent_id_marketplace_agents_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "marketplace_agents"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "agent_stats" ADD CONSTRAINT "agent_stats_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Skills foreign keys
    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "marketplace_skills" ADD CONSTRAINT "marketplace_skills_author_id_users_id_fk"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_marketplace_skills_id_fk"
        FOREIGN KEY ("skill_id") REFERENCES "marketplace_skills"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_skill_id_marketplace_skills_id_fk"
        FOREIGN KEY ("skill_id") REFERENCES "marketplace_skills"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_category_id_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_tags" ADD CONSTRAINT "skill_tags_skill_id_marketplace_skills_id_fk"
        FOREIGN KEY ("skill_id") REFERENCES "marketplace_skills"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_tags" ADD CONSTRAINT "skill_tags_tag_id_tags_id_fk"
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_stats" ADD CONSTRAINT "skill_stats_skill_id_marketplace_skills_id_fk"
        FOREIGN KEY ("skill_id") REFERENCES "marketplace_skills"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await testDb.run(sql`
      DO $$ BEGIN
        ALTER TABLE "skill_stats" ADD CONSTRAINT "skill_stats_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Added foreign key constraints');

    // Create indexes
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "users_github_idx" ON "users" ("github_id")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "users_google_idx" ON "users" ("google_id")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags" ("slug")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "agents_slug_idx" ON "marketplace_agents" ("slug")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "agents_author_idx" ON "marketplace_agents" ("author_id")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "agents_featured_idx" ON "marketplace_agents" ("is_featured")
    `);
    await testDb.run(sql`
      CREATE INDEX IF NOT EXISTS "agents_published_idx" ON "marketplace_agents" ("is_published")
    `);

    console.log('✅ Created indexes');
    console.log('🎉 Test database initialization complete!');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  initTestDatabase();
}

export { initTestDatabase };
