-- Migration: Agent Skills Standardization
-- Adds compatibility and metadata fields, removes deprecated fields from skill tables
-- Created: 2026-01-01

-- =====================================================
-- STEP 1: Add new fields to marketplace_skills table
-- =====================================================

-- Add compatibility field for Agent Skills Specification
ALTER TABLE `marketplace_skills` ADD COLUMN `compatibility` text(500);
--> statement-breakpoint

-- Add metadata JSON field for Agent Skills Specification
ALTER TABLE `marketplace_skills` ADD COLUMN `metadata` text;
--> statement-breakpoint

-- =====================================================
-- STEP 2: Add new fields to skill_versions table
-- =====================================================

-- Add compatibility field to versions
ALTER TABLE `skill_versions` ADD COLUMN `compatibility` text(500);
--> statement-breakpoint

-- Add metadata JSON field to versions
ALTER TABLE `skill_versions` ADD COLUMN `metadata` text;
--> statement-breakpoint

-- =====================================================
-- STEP 3: Create indexes for new fields
-- =====================================================

-- Index for compatibility field (used in filtering)
CREATE INDEX IF NOT EXISTS `skills_compatibility_idx` ON `marketplace_skills` (`compatibility`);
--> statement-breakpoint

-- Index for metadata field (for JSON queries if needed)
CREATE INDEX IF NOT EXISTS `skills_metadata_idx` ON `marketplace_skills` (`metadata`);
--> statement-breakpoint

-- Indexes for version fields
CREATE INDEX IF NOT EXISTS `skill_versions_compatibility_idx` ON `skill_versions` (`compatibility`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `skill_versions_metadata_idx` ON `skill_versions` (`metadata`);
--> statement-breakpoint

-- =====================================================
-- STEP 4: Create index for skill stats table (if not exists)
-- =====================================================

CREATE INDEX IF NOT EXISTS `skill_stats_version_idx` ON `skill_stats` (`version`);
--> statement-breakpoint

-- =====================================================
-- STEP 5: Update existing skills with default compatibility value
-- =====================================================

-- Set default compatibility for existing skills
UPDATE `marketplace_skills` SET `compatibility` = 'General purpose' WHERE `compatibility` IS NULL;
--> statement-breakpoint
