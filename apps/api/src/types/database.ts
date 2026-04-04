// Type definitions for database tables
import type { SQL } from 'drizzle-orm';
import type {
  categories,
  marketplaceAgents,
  marketplaceSkills,
  skillCategories,
  skillTags,
  tags,
  users,
} from '../db/schema';

// Types for database records
export type CategoryRecord = typeof categories.$inferSelect;
export type SkillCategoryRecord = typeof skillCategories.$inferSelect & {
  category: CategoryRecord;
};
export type TagRecord = typeof tags.$inferSelect;
export type SkillTagRecord = typeof skillTags.$inferSelect & {
  tag: TagRecord;
};
export type MarketplaceSkillRecord = typeof marketplaceSkills.$inferSelect;

// User types
export type DbUser = typeof users.$inferSelect;

// Category types (alias for backward compatibility)
export type DbCategory = CategoryRecord;

// Marketplace types
export type DbMarketplaceAgent = typeof marketplaceAgents.$inferSelect;

// Tag types (alias for backward compatibility)
export type DbTag = TagRecord;

// Config types
export type ToolsConfig = Record<string, boolean | string | number | null | undefined>;

export type DynamicPromptConfig = {
  enabled?: boolean;
  variables?: Record<string, string | number | boolean>;
  templates?: string[];
  providers?: string[];
} | null;

// SQL condition type
export type SQLCondition = SQL<unknown>;
