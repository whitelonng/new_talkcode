// Database schema using Drizzle ORM for SQLite (Turso)

import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// Helper function for generating UUIDs in SQLite
const _uuid = () =>
  sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;

// Helper for current timestamp
const _now = () => sql`(unixepoch() * 1000)`;

// ==================== Users Table ====================
export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email', { length: 255 }).notNull(),
    name: text('name', { length: 255 }).notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    role: text('role', { length: 20 }).default('user').notNull(), // 'user' | 'admin'
    bio: text('bio'),
    website: text('website'),

    // OAuth provider IDs
    githubId: text('github_id', { length: 255 }),
    googleId: text('google_id', { length: 255 }),

    isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
    lastLoginAt: integer('last_login_at'), // Unix timestamp in milliseconds

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    githubIdx: index('users_github_idx').on(table.githubId),
    googleIdx: index('users_google_idx').on(table.googleId),
    emailUnique: unique('users_email_unique').on(table.email),
  })
);

// ==================== Marketplace Agents Table ====================
export const marketplaceAgents = sqliteTable(
  'marketplace_agents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug', { length: 100 }).notNull().unique(),
    name: text('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    longDescription: text('long_description'),
    authorId: text('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Agent configuration (latest version)
    model: text('model', { length: 100 }).notNull(),
    systemPrompt: text('system_prompt').notNull(),
    toolsConfig: text('tools_config', { mode: 'json' })
      .$type<Record<string, boolean | string | number | null | undefined>>()
      .notNull(),
    rules: text('rules'),
    outputFormat: text('output_format'),
    dynamicPromptConfig: text('dynamic_prompt_config', { mode: 'json' }).$type<{
      enabled?: boolean;
      variables?: Record<string, string | number | boolean>;
      templates?: string[];
      providers?: string[];
    } | null>(),

    iconUrl: text('icon_url'),
    bannerUrl: text('banner_url'),

    // Statistics
    downloadCount: integer('download_count').default(0).notNull(),
    installCount: integer('install_count').default(0).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    rating: integer('rating').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),

    // Status
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false).notNull(),
    isPublished: integer('is_published', { mode: 'boolean' }).default(false).notNull(),
    publishedAt: integer('published_at'),

    latestVersion: text('latest_version', { length: 50 }).notNull(),

    // Full-text search (stored as JSON-serialized search terms)
    searchVector: text('search_vector'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    slugIdx: index('agents_slug_idx').on(table.slug),
    authorIdx: index('agents_author_idx').on(table.authorId),
    featuredIdx: index('agents_featured_idx').on(table.isFeatured),
    downloadsIdx: index('agents_downloads_idx').on(table.downloadCount),
    createdIdx: index('agents_created_idx').on(table.createdAt),
    publishedIdx: index('agents_published_idx').on(table.isPublished),
  })
);

// ==================== Agent Versions Table ====================
export const agentVersions = sqliteTable(
  'agent_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id')
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version', { length: 50 }).notNull(),

    // Agent definition
    systemPrompt: text('system_prompt').notNull(),
    toolsConfig: text('tools_config', { mode: 'json' })
      .$type<Record<string, boolean | string | number | null | undefined>>()
      .notNull(),
    rules: text('rules'),
    outputFormat: text('output_format'),
    dynamicPromptConfig: text('dynamic_prompt_config', { mode: 'json' }).$type<{
      enabled?: boolean;
      variables?: Record<string, string | number | boolean>;
      templates?: string[];
      providers?: string[];
    } | null>(),

    changeLog: text('change_log'),
    isPrerelease: integer('is_prerelease', { mode: 'boolean' }).default(false).notNull(),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    agentIdx: index('versions_agent_idx').on(table.agentId),
    versionUnique: unique('versions_unique').on(table.agentId, table.version),
    createdIdx: index('versions_created_idx').on(table.createdAt),
  })
);

// ==================== Categories Table ====================
export const categories = sqliteTable(
  'categories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name', { length: 100 }).notNull().unique(),
    slug: text('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    icon: text('icon', { length: 50 }),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    slugIdx: index('categories_slug_idx').on(table.slug),
    orderIdx: index('categories_order_idx').on(table.displayOrder),
  })
);

// ==================== Agent-Categories Junction Table ====================
export const agentCategories = sqliteTable(
  'agent_categories',
  {
    agentId: text('agent_id')
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: text('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: unique('agent_categories_pk').on(table.agentId, table.categoryId),
    agentIdx: index('agent_categories_agent_idx').on(table.agentId),
    categoryIdx: index('agent_categories_category_idx').on(table.categoryId),
  })
);

// ==================== Tags Table ====================
export const tags = sqliteTable(
  'tags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name', { length: 50 }).notNull().unique(),
    slug: text('slug', { length: 50 }).notNull().unique(),
    usageCount: integer('usage_count').default(0).notNull(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    slugIdx: index('tags_slug_idx').on(table.slug),
    usageIdx: index('tags_usage_idx').on(table.usageCount),
  })
);

// ==================== Agent-Tags Junction Table ====================
export const agentTags = sqliteTable(
  'agent_tags',
  {
    agentId: text('agent_id')
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: text('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: unique('agent_tags_pk').on(table.agentId, table.tagId),
    agentIdx: index('agent_tags_agent_idx').on(table.agentId),
    tagIdx: index('agent_tags_tag_idx').on(table.tagId),
  })
);

// ==================== Collections Table ====================
export const collections = sqliteTable(
  'collections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name', { length: 255 }).notNull(),
    slug: text('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    icon: text('icon', { length: 50 }),
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    slugIdx: index('collections_slug_idx').on(table.slug),
    featuredIdx: index('collections_featured_idx').on(table.isFeatured),
    orderIdx: index('collections_order_idx').on(table.displayOrder),
  })
);

// ==================== Collection-Agents Junction Table ====================
export const collectionAgents = sqliteTable(
  'collection_agents',
  {
    collectionId: text('collection_id')
      .references(() => collections.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: text('agent_id')
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' })
      .notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
  },
  (table) => ({
    pk: unique('collection_agents_pk').on(table.collectionId, table.agentId),
    collectionIdx: index('collection_agents_collection_idx').on(table.collectionId),
    agentIdx: index('collection_agents_agent_idx').on(table.agentId),
  })
);

// ==================== Agent Stats Table ====================
export const agentStats = sqliteTable(
  'agent_stats',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id')
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version', { length: 50 }),
    eventType: text('event_type', { length: 20 }).notNull(), // 'download' | 'install' | 'usage'
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    deviceId: text('device_id', { length: 255 }),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    agentIdx: index('stats_agent_idx').on(table.agentId),
    dateIdx: index('stats_date_idx').on(table.createdAt),
    eventIdx: index('stats_event_idx').on(table.eventType),
    userIdx: index('stats_user_idx').on(table.userId),
  })
);

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(marketplaceAgents),
  stats: many(agentStats),
}));

export const marketplaceAgentsRelations = relations(marketplaceAgents, ({ one, many }) => ({
  author: one(users, {
    fields: [marketplaceAgents.authorId],
    references: [users.id],
  }),
  versions: many(agentVersions),
  agentCategories: many(agentCategories),
  agentTags: many(agentTags),
  stats: many(agentStats),
  collectionAgents: many(collectionAgents),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one }) => ({
  agent: one(marketplaceAgents, {
    fields: [agentVersions.agentId],
    references: [marketplaceAgents.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  agentCategories: many(agentCategories),
}));

export const agentCategoriesRelations = relations(agentCategories, ({ one }) => ({
  agent: one(marketplaceAgents, {
    fields: [agentCategories.agentId],
    references: [marketplaceAgents.id],
  }),
  category: one(categories, {
    fields: [agentCategories.categoryId],
    references: [categories.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  agentTags: many(agentTags),
}));

export const agentTagsRelations = relations(agentTags, ({ one }) => ({
  agent: one(marketplaceAgents, {
    fields: [agentTags.agentId],
    references: [marketplaceAgents.id],
  }),
  tag: one(tags, {
    fields: [agentTags.tagId],
    references: [tags.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  collectionAgents: many(collectionAgents),
}));

export const collectionAgentsRelations = relations(collectionAgents, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionAgents.collectionId],
    references: [collections.id],
  }),
  agent: one(marketplaceAgents, {
    fields: [collectionAgents.agentId],
    references: [marketplaceAgents.id],
  }),
}));

export const agentStatsRelations = relations(agentStats, ({ one }) => ({
  agent: one(marketplaceAgents, {
    fields: [agentStats.agentId],
    references: [marketplaceAgents.id],
  }),
  user: one(users, {
    fields: [agentStats.userId],
    references: [users.id],
  }),
}));

// ==================== Skills Marketplace Tables ====================

// ==================== Marketplace Skills Table ====================
export const marketplaceSkills = sqliteTable(
  'marketplace_skills',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug', { length: 100 }).notNull().unique(),
    name: text('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    longDescription: text('long_description'),
    authorId: text('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Deprecated: Skill content now stored in R2
    // Keep for backward compatibility with database-stored skills
    systemPromptFragment: text('system_prompt_fragment'),
    workflowRules: text('workflow_rules'),
    documentation: text('documentation', { mode: 'json' }).$type<Array<Record<string, unknown>>>(),

    // R2 Storage (for file-based skills)
    storageUrl: text('storage_url'),
    packageSize: integer('package_size'),
    checksum: text('checksum'),
    requiredPermission: text('required_permission').default('read-only'),
    hasScripts: integer('has_scripts', { mode: 'boolean' }).default(false).notNull(),

    // Agent Skills Specification fields
    compatibility: text('compatibility', { length: 500 }),
    metadata: text('metadata'), // JSON string for key-value metadata

    iconUrl: text('icon_url'),
    bannerUrl: text('banner_url'),

    // Statistics
    downloadCount: integer('download_count').default(0).notNull(),
    installCount: integer('install_count').default(0).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    rating: integer('rating').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),

    // Status
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false).notNull(),
    isPublished: integer('is_published', { mode: 'boolean' }).default(false).notNull(),
    publishedAt: integer('published_at'),

    latestVersion: text('latest_version', { length: 50 }).notNull(),

    // Full-text search
    searchVector: text('search_vector'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    slugIdx: index('skills_slug_idx').on(table.slug),
    authorIdx: index('skills_author_idx').on(table.authorId),
    featuredIdx: index('skills_featured_idx').on(table.isFeatured),
    downloadsIdx: index('skills_downloads_idx').on(table.downloadCount),
    createdIdx: index('skills_created_idx').on(table.createdAt),
    publishedIdx: index('skills_published_idx').on(table.isPublished),
    storageIdx: index('skills_storage_idx').on(table.storageUrl),
  })
);

// ==================== Skill Versions Table ====================
export const skillVersions = sqliteTable(
  'skill_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    skillId: text('skill_id')
      .references(() => marketplaceSkills.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version', { length: 50 }).notNull(),

    // Deprecated: Skill content now stored in R2
    systemPromptFragment: text('system_prompt_fragment'),
    workflowRules: text('workflow_rules'),
    documentation: text('documentation', { mode: 'json' }).$type<Array<Record<string, unknown>>>(),

    // R2 Storage (for file-based skills)
    storageUrl: text('storage_url'),
    packageSize: integer('package_size'),
    checksum: text('checksum'),

    // Agent Skills Specification fields
    compatibility: text('compatibility', { length: 500 }),
    metadata: text('metadata'), // JSON string for key-value metadata

    changeLog: text('change_log'),
    isPrerelease: integer('is_prerelease', { mode: 'boolean' }).default(false).notNull(),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    skillIdx: index('skill_versions_skill_idx').on(table.skillId),
    versionUnique: unique('skill_versions_unique').on(table.skillId, table.version),
    createdIdx: index('skill_versions_created_idx').on(table.createdAt),
    storageIdx: index('skill_versions_storage_idx').on(table.storageUrl),
  })
);

// ==================== Skill-Categories Junction Table ====================
export const skillCategories = sqliteTable(
  'skill_categories',
  {
    skillId: text('skill_id')
      .references(() => marketplaceSkills.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: text('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: unique('skill_categories_pk').on(table.skillId, table.categoryId),
    skillIdx: index('skill_categories_skill_idx').on(table.skillId),
    categoryIdx: index('skill_categories_category_idx').on(table.categoryId),
  })
);

// ==================== Skill-Tags Junction Table ====================
export const skillTags = sqliteTable(
  'skill_tags',
  {
    skillId: text('skill_id')
      .references(() => marketplaceSkills.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: text('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: unique('skill_tags_pk').on(table.skillId, table.tagId),
    skillIdx: index('skill_tags_skill_idx').on(table.skillId),
    tagIdx: index('skill_tags_tag_idx').on(table.tagId),
  })
);

// ==================== Skill Stats Table ====================
export const skillStats = sqliteTable(
  'skill_stats',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    skillId: text('skill_id')
      .references(() => marketplaceSkills.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version', { length: 50 }),
    eventType: text('event_type', { length: 20 }).notNull(), // 'download' | 'install' | 'usage'
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    deviceId: text('device_id', { length: 255 }),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    skillIdx: index('skill_stats_skill_idx').on(table.skillId),
    dateIdx: index('skill_stats_date_idx').on(table.createdAt),
    eventIdx: index('skill_stats_event_idx').on(table.eventType),
    userIdx: index('skill_stats_user_idx').on(table.userId),
  })
);

// ==================== Skills Relations ====================

export const marketplaceSkillsRelations = relations(marketplaceSkills, ({ one, many }) => ({
  author: one(users, {
    fields: [marketplaceSkills.authorId],
    references: [users.id],
  }),
  versions: many(skillVersions),
  skillCategories: many(skillCategories),
  skillTags: many(skillTags),
  stats: many(skillStats),
}));

export const skillVersionsRelations = relations(skillVersions, ({ one }) => ({
  skill: one(marketplaceSkills, {
    fields: [skillVersions.skillId],
    references: [marketplaceSkills.id],
  }),
}));

export const skillCategoriesRelations = relations(skillCategories, ({ one }) => ({
  skill: one(marketplaceSkills, {
    fields: [skillCategories.skillId],
    references: [marketplaceSkills.id],
  }),
  category: one(categories, {
    fields: [skillCategories.categoryId],
    references: [categories.id],
  }),
}));

export const skillTagsRelations = relations(skillTags, ({ one }) => ({
  skill: one(marketplaceSkills, {
    fields: [skillTags.skillId],
    references: [marketplaceSkills.id],
  }),
  tag: one(tags, {
    fields: [skillTags.tagId],
    references: [tags.id],
  }),
}));

export const skillStatsRelations = relations(skillStats, ({ one }) => ({
  skill: one(marketplaceSkills, {
    fields: [skillStats.skillId],
    references: [marketplaceSkills.id],
  }),
  user: one(users, {
    fields: [skillStats.userId],
    references: [users.id],
  }),
}));

// ==================== Analytics Events Table ====================
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text('device_id', { length: 255 }).notNull(),
    eventType: text('event_type', { length: 50 }).notNull(), // 'session_start' | 'session_end'
    sessionId: text('session_id', { length: 255 }).notNull(),
    osName: text('os_name', { length: 50 }),
    osVersion: text('os_version', { length: 50 }),
    appVersion: text('app_version', { length: 50 }),
    country: text('country', { length: 10 }),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    deviceIdx: index('analytics_device_idx').on(table.deviceId),
    eventTypeIdx: index('analytics_event_type_idx').on(table.eventType),
    sessionIdx: index('analytics_session_idx').on(table.sessionId),
    dateIdx: index('analytics_date_idx').on(table.createdAt),
  })
);

// ==================== Provider Usage Table ====================
// Tracks usage for TalkCody provider rate limiting (by user ID)
export const providerUsage = sqliteTable(
  'provider_usage',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id', { length: 255 }).notNull(),
    provider: text('provider', { length: 50 }).notNull(), // 'talkcody'
    model: text('model', { length: 100 }).notNull(),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    usageDate: text('usage_date', { length: 10 }).notNull(), // YYYY-MM-DD format
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userDateIdx: index('provider_usage_user_date_idx').on(table.userId, table.usageDate),
    providerIdx: index('provider_usage_provider_idx').on(table.provider),
    dateIdx: index('provider_usage_date_idx').on(table.usageDate),
  })
);

// ==================== Search Usage Table ====================
// Tracks search usage for rate limiting (by device ID and optional user ID)
export const searchUsage = sqliteTable(
  'search_usage',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text('device_id', { length: 255 }).notNull(),
    userId: text('user_id', { length: 255 }),
    searchCount: integer('search_count').default(1).notNull(),
    usageDate: text('usage_date', { length: 10 }).notNull(), // YYYY-MM-DD format
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    deviceDateIdx: index('search_usage_device_date_idx').on(table.deviceId, table.usageDate),
    userDateIdx: index('search_usage_user_date_idx').on(table.userId, table.usageDate),
    dateIdx: index('search_usage_date_idx').on(table.usageDate),
  })
);

// ==================== Task Shares Table ====================
// Stores shared task snapshots for public viewing
export const taskShares = sqliteTable(
  'task_shares',
  {
    id: text('id').primaryKey(), // nanoid generated short ID
    taskId: text('task_id', { length: 255 }).notNull(),
    userId: text('user_id', { length: 255 }), // Optional: creator's user ID
    taskTitle: text('task_title', { length: 500 }).notNull(),
    messagesJson: text('messages_json').notNull(), // JSON string of messages
    storageUrl: text('storage_url'), // R2 URL for large shares
    model: text('model', { length: 100 }),
    passwordHash: text('password_hash'), // SHA-256 hash
    expiresAt: integer('expires_at'), // Unix timestamp in milliseconds
    viewCount: integer('view_count').default(0).notNull(),
    isPublic: integer('is_public', { mode: 'boolean' }).default(true).notNull(),
    metadata: text('metadata', { mode: 'json' }).$type<{
      talkcodyVersion?: string;
      platform?: string;
      sharedAt?: number;
    }>(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    createdBy: text('created_by', { length: 255 }), // Device ID
  },
  (table) => ({
    taskIdIdx: index('shares_task_id_idx').on(table.taskId),
    userIdIdx: index('shares_user_id_idx').on(table.userId),
    expiresAtIdx: index('shares_expires_at_idx').on(table.expiresAt),
    createdAtIdx: index('shares_created_at_idx').on(table.createdAt),
    isPublicIdx: index('shares_is_public_idx').on(table.isPublic),
  })
);
