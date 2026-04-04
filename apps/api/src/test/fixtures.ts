// Test fixtures and seed data for test database
// Use the test database client to ensure we're always using the test database

import {
  agentCategories,
  agentTags,
  agentVersions,
  categories,
  marketplaceAgents,
  marketplaceSkills,
  skillCategories,
  skillTags,
  skillVersions,
  tags,
  users,
} from '../db/schema';
import { testDb as db, testClient } from './db-client';

/**
 * Verify test environment is properly configured
 * This should be called at the very beginning of test execution
 */
export function verifyTestEnvironment() {
  // SAFETY CHECK 1: Verify TEST_MODE is enabled
  if (process.env.TEST_MODE !== 'true') {
    throw new Error(
      '🚨 SAFETY CHECK FAILED: TEST_MODE is not enabled!\n\n' +
        'This prevents accidentally clearing production data.\n' +
        'Tests must be run with: bun run test (not bun test directly)\n\n' +
        'The test runner (run-tests.ts) sets TEST_MODE=true and switches to DATABASE_URL_TEST.'
    );
  }

  // SAFETY CHECK 2: Verify TURSO_DATABASE_URL matches TURSO_DATABASE_URL_TEST
  const currentDbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
  const testDbUrl = process.env.TURSO_DATABASE_URL_TEST || process.env.DATABASE_URL_TEST || '';

  if (!testDbUrl) {
    throw new Error(
      '🚨 SAFETY CHECK FAILED: TURSO_DATABASE_URL_TEST is not set!\n\n' +
        'Please configure TURSO_DATABASE_URL_TEST in your .env file.'
    );
  }

  if (currentDbUrl !== testDbUrl) {
    throw new Error(
      `🚨 SAFETY CHECK FAILED: TURSO_DATABASE_URL does not match TURSO_DATABASE_URL_TEST!\n\n` +
        'This indicates tests are not running through the proper test runner.\n' +
        'Tests must be run with: bun run test (not bun test directly)\n\n' +
        `Current TURSO_DATABASE_URL: ${currentDbUrl.split('@')[1]?.split('?')[0] || currentDbUrl}\n` +
        `Expected TEST URL:          ${testDbUrl.split('@')[1]?.split('?')[0] || testDbUrl}`
    );
  }

  console.log('✅ Test environment safety checks passed');
}

/**
 * Clear all test data from database
 */
export async function clearDatabase() {
  // For Turso/SQLite, we don't need the PostgreSQL safety checks
  console.log('🧹 Clearing test database...');

  // Clear FTS5 tables first
  try {
    await testClient.execute('DELETE FROM marketplace_agents_fts');
    await testClient.execute('DELETE FROM marketplace_skills_fts');
  } catch (_error: any) {
    // FTS5 tables might not exist in all environments, ignore errors
    console.log('  (Skipping FTS5 tables)');
  }

  // Delete in order to respect foreign key constraints
  await db.delete(skillTags);
  await db.delete(skillCategories);
  await db.delete(skillVersions);
  await db.delete(marketplaceSkills);
  await db.delete(agentTags);
  await db.delete(agentCategories);
  await db.delete(agentVersions);
  await db.delete(marketplaceAgents);
  await db.delete(categories);
  await db.delete(tags);
  await db.delete(users);

  console.log('✅ Test database cleared');
}

/**
 * Seed test users
 */
export async function seedTestUsers() {
  const testUsers = await db
    .insert(users)
    .values([
      {
        email: 'alice@example.com',
        name: 'Alice Smith',
        role: 'user',
        avatarUrl: 'https://example.com/alice.jpg',
        bio: 'AI enthusiast and developer',
        website: 'https://alice.dev',
        isVerified: true,
      },
      {
        email: 'bob@example.com',
        name: 'Bob Johnson',
        role: 'user',
        avatarUrl: 'https://example.com/bob.jpg',
        bio: 'Developer and agent creator',
        website: 'https://bob.dev',
        isVerified: true,
      },
    ])
    .returning();

  console.log(`✅ Seeded ${testUsers.length} test users`);
  return testUsers;
}

/**
 * Seed test categories
 */
export async function seedTestCategories() {
  const testCategories = await db
    .insert(categories)
    .values([
      {
        name: 'Coding',
        slug: 'coding',
        description: 'Agents for coding and development tasks',
        icon: 'code',
        displayOrder: 1,
      },
      {
        name: 'Data Analysis',
        slug: 'data-analysis',
        description: 'Agents for data analysis and visualization',
        icon: 'chart',
        displayOrder: 2,
      },
      {
        name: 'Writing',
        slug: 'writing',
        description: 'Agents for writing and content creation',
        icon: 'pen',
        displayOrder: 3,
      },
    ])
    .returning();

  console.log(`✅ Seeded ${testCategories.length} test categories`);
  return testCategories;
}

/**
 * Seed test tags
 */
export async function seedTestTags() {
  const testTags = await db
    .insert(tags)
    .values([
      {
        name: 'Python',
        slug: 'python',
        usageCount: 5,
      },
      {
        name: 'TypeScript',
        slug: 'typescript',
        usageCount: 8,
      },
      {
        name: 'Machine Learning',
        slug: 'machine-learning',
        usageCount: 3,
      },
    ])
    .returning();

  console.log(`✅ Seeded ${testTags.length} test tags`);
  return testTags;
}

/**
 * Seed test agents
 */
export async function seedTestAgents(testUsers: any[], testCategories: any[], testTags: any[]) {
  const testAgents = await db
    .insert(marketplaceAgents)
    .values([
      {
        slug: 'python-expert',
        name: 'Python Expert',
        description: 'Expert Python programming developer agent',
        longDescription:
          'This agent helps with Python development tasks including debugging, code review, and best practices.',
        authorId: testUsers[0].id,
        model: 'deepseek-reasoner',
        systemPrompt:
          'You are an expert Python developer with deep knowledge of Python best practices.',
        toolsConfig: { bash: true, read: true, write: true },
        rules: 'Always write clean, readable code following PEP 8',
        latestVersion: '1.0.0',
        installCount: 50,
        rating: 4,
        ratingCount: 10,
        isFeatured: true,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        slug: 'typescript-helper',
        name: 'TypeScript Helper',
        description: 'TypeScript development assistant',
        longDescription:
          'Helps with TypeScript projects, type definitions, and modern JavaScript development.',
        authorId: testUsers[1].id,
        model: 'deepseek-reasoner',
        systemPrompt: 'You are a TypeScript expert helping developers write type-safe code.',
        toolsConfig: { bash: true, read: true },
        latestVersion: '2.1.0',
        installCount: 120,
        rating: 5,
        ratingCount: 25,
        isFeatured: true,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        slug: 'data-analyzer',
        name: 'Data Analyzer',
        description: 'Analyze data with AI',
        longDescription: 'Advanced data analysis agent for statistical analysis and insights.',
        authorId: testUsers[0].id,
        model: 'deepseek-reasoner',
        systemPrompt: 'You are a data analysis expert specializing in statistical analysis.',
        toolsConfig: { bash: true },
        latestVersion: '1.5.0',
        installCount: 40,
        rating: 4,
        ratingCount: 8,
        isFeatured: false,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        slug: 'draft-agent',
        name: 'Draft Agent',
        description: 'This is an unpublished draft agent',
        authorId: testUsers[1].id,
        model: 'deepseek-reasoner',
        systemPrompt: 'Draft agent for testing purposes',
        toolsConfig: {},
        latestVersion: '0.1.0',
        installCount: 0,
        isFeatured: false,
        isPublished: false, // Not published - should not appear in marketplace
      },
    ])
    .returning();

  console.log(`✅ Seeded ${testAgents.length} test agents`);

  // Add agent-category relationships
  await db.insert(agentCategories).values([
    { agentId: testAgents[0].id, categoryId: testCategories[0].id }, // Python Expert -> Coding
    { agentId: testAgents[1].id, categoryId: testCategories[0].id }, // TypeScript Helper -> Coding
    { agentId: testAgents[2].id, categoryId: testCategories[1].id }, // Data Analyzer -> Data Analysis
  ]);
  console.log('✅ Seeded agent-category relationships');

  // Add agent-tag relationships
  await db.insert(agentTags).values([
    { agentId: testAgents[0].id, tagId: testTags[0].id }, // Python Expert -> Python
    { agentId: testAgents[1].id, tagId: testTags[1].id }, // TypeScript Helper -> TypeScript
    { agentId: testAgents[2].id, tagId: testTags[2].id }, // Data Analyzer -> ML
  ]);
  console.log('✅ Seeded agent-tag relationships');

  // Add versions
  await db.insert(agentVersions).values([
    {
      agentId: testAgents[0].id,
      version: '1.0.0',
      systemPrompt: 'You are an expert Python developer.',
      toolsConfig: { bash: true, read: true, write: true },
      changeLog: 'Initial release',
    },
    {
      agentId: testAgents[1].id,
      version: '2.1.0',
      systemPrompt: 'You are a TypeScript expert.',
      toolsConfig: { bash: true, read: true },
      changeLog: 'Added new features and improvements',
    },
    {
      agentId: testAgents[1].id,
      version: '2.0.0',
      systemPrompt: 'You are a TypeScript expert.',
      toolsConfig: { bash: true },
      changeLog: 'Major update with breaking changes',
    },
  ]);
  console.log('✅ Seeded agent versions');

  return testAgents;
}

/**
 * Seed test skills
 */
export async function seedTestSkills(testUsers: any[], testCategories: any[], testTags: any[]) {
  const testSkills = await db
    .insert(marketplaceSkills)
    .values([
      {
        slug: 'clickhouse-expert',
        name: 'ClickHouse Expert',
        description: 'Domain knowledge for ClickHouse database development',
        longDescription:
          'Comprehensive knowledge about ClickHouse database, including SQL syntax, table engines, and optimization techniques.',
        authorId: testUsers[0].id,
        systemPromptFragment:
          'You are an expert in ClickHouse database. You understand columnar storage, distributed queries, and performance optimization.',
        workflowRules:
          'Always consider data compression, partition keys, and query optimization when working with ClickHouse.',
        documentation: JSON.stringify([
          {
            type: 'url',
            title: 'ClickHouse Official Documentation',
            url: 'https://clickhouse.com/docs',
          },
        ]),
        latestVersion: '1.0.0',
        installCount: 75,
        rating: 5,
        ratingCount: 15,
        isFeatured: true,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        slug: 'starrocks-expert',
        name: 'StarRocks Expert',
        description: 'Domain knowledge for StarRocks database development',
        longDescription:
          'Expert knowledge about StarRocks MPP database, including query optimization and data modeling.',
        authorId: testUsers[1].id,
        systemPromptFragment:
          'You are an expert in StarRocks database. You understand MPP architecture, materialized views, and SQL optimization.',
        workflowRules:
          'Focus on query performance, proper indexing, and efficient data loading strategies.',
        documentation: JSON.stringify([
          {
            type: 'url',
            title: 'StarRocks Documentation',
            url: 'https://docs.starrocks.io',
          },
        ]),
        latestVersion: '2.0.0',
        installCount: 60,
        rating: 4,
        ratingCount: 12,
        isFeatured: true,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        slug: 'duckdb-expert',
        name: 'DuckDB Expert',
        description: 'Domain knowledge for DuckDB in-process database',
        longDescription: 'Specialized knowledge for DuckDB, the in-process analytical database.',
        authorId: testUsers[0].id,
        systemPromptFragment:
          'You are an expert in DuckDB. You understand its in-process architecture, Parquet integration, and analytical query optimization.',
        workflowRules:
          "Leverage DuckDB's columnar storage and efficient query execution for analytical workloads.",
        documentation: JSON.stringify([]),
        latestVersion: '1.5.0',
        installCount: 45,
        rating: 5,
        ratingCount: 9,
        isFeatured: false,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        slug: 'draft-skill',
        name: 'Draft Skill',
        description: 'This is an unpublished draft skill',
        authorId: testUsers[1].id,
        systemPromptFragment: 'Draft skill for testing purposes',
        documentation: JSON.stringify([]),
        latestVersion: '0.1.0',
        installCount: 0,
        isFeatured: false,
        isPublished: false, // Not published - should not appear in marketplace
      },
    ])
    .returning();

  console.log(`✅ Seeded ${testSkills.length} test skills`);

  // Add skill-category relationships
  await db.insert(skillCategories).values([
    { skillId: testSkills[0].id, categoryId: testCategories[1].id }, // ClickHouse -> Data Analysis
    { skillId: testSkills[1].id, categoryId: testCategories[1].id }, // StarRocks -> Data Analysis
    { skillId: testSkills[2].id, categoryId: testCategories[1].id }, // DuckDB -> Data Analysis
  ]);
  console.log('✅ Seeded skill-category relationships');

  // Add skill-tag relationships
  await db.insert(skillTags).values([
    { skillId: testSkills[0].id, tagId: testTags[0].id }, // ClickHouse -> Python (for testing)
    { skillId: testSkills[1].id, tagId: testTags[1].id }, // StarRocks -> TypeScript (for testing)
    { skillId: testSkills[2].id, tagId: testTags[2].id }, // DuckDB -> ML (for testing)
  ]);
  console.log('✅ Seeded skill-tag relationships');

  // Add skill versions
  await db.insert(skillVersions).values([
    {
      skillId: testSkills[0].id,
      version: '1.0.0',
      systemPromptFragment: 'You are an expert in ClickHouse database.',
      workflowRules: 'Always consider query optimization.',
      documentation: JSON.stringify([
        {
          type: 'url',
          title: 'ClickHouse Documentation',
          url: 'https://clickhouse.com/docs',
        },
      ]),
      changeLog: 'Initial release',
    },
    {
      skillId: testSkills[1].id,
      version: '2.0.0',
      systemPromptFragment: 'You are an expert in StarRocks database.',
      workflowRules: 'Focus on query performance.',
      documentation: JSON.stringify([]),
      changeLog: 'Major update with new features',
    },
    {
      skillId: testSkills[1].id,
      version: '1.0.0',
      systemPromptFragment: 'You are knowledgeable about StarRocks.',
      documentation: JSON.stringify([]),
      changeLog: 'Initial release',
    },
  ]);
  console.log('✅ Seeded skill versions');

  return testSkills;
}

/**
 * Populate FTS5 tables manually
 * This ensures FTS5 search works even if triggers don't fire during batch inserts
 */
export async function populateFts5Tables() {
  console.log('🔍 Populating FTS5 search tables...');

  try {
    // Populate agents FTS5 table
    await testClient.execute(`
      INSERT INTO marketplace_agents_fts(id, name, description, long_description)
      SELECT id, name, description, COALESCE(long_description, '')
      FROM marketplace_agents
      WHERE is_published = 1
    `);
    console.log(`  ✅ Populated marketplace_agents_fts`);

    // Populate skills FTS5 table
    await testClient.execute(`
      INSERT INTO marketplace_skills_fts(id, name, description, long_description)
      SELECT id, name, description, COALESCE(long_description, '')
      FROM marketplace_skills
      WHERE is_published = 1
    `);
    console.log(`  ✅ Populated marketplace_skills_fts`);
  } catch (error: any) {
    console.error('❌ Failed to populate FTS5 tables:', error.message);
    throw error;
  }
}

/**
 * Seed complete test database
 */
export async function seedTestDatabase() {
  console.log('🌱 Seeding test database...');

  await clearDatabase();

  const testUsers = await seedTestUsers();
  const testCategories = await seedTestCategories();
  const testTags = await seedTestTags();
  const testAgents = await seedTestAgents(testUsers, testCategories, testTags);
  const testSkills = await seedTestSkills(testUsers, testCategories, testTags);

  // Manually populate FTS5 tables to ensure search works
  await populateFts5Tables();

  console.log('🎉 Test database seeding complete!');

  return {
    users: testUsers,
    categories: testCategories,
    tags: testTags,
    agents: testAgents,
    skills: testSkills,
  };
}
