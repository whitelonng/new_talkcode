-- Migration: Add Search Usage Table
-- Adds search_usage table for tracking search API rate limiting
-- Created: 2026-01-05

-- =====================================================
-- STEP 1: Create search_usage table
-- =====================================================

CREATE TABLE IF NOT EXISTS `search_usage` (
  `id` text PRIMARY KEY NOT NULL,
  `device_id` text(255) NOT NULL,
  `user_id` text(255),
  `search_count` integer DEFAULT 1 NOT NULL,
  `usage_date` text(10) NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

-- =====================================================
-- STEP 2: Create indexes for search_usage table
-- =====================================================

CREATE INDEX IF NOT EXISTS `search_usage_device_date_idx` ON `search_usage` (`device_id`, `usage_date`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `search_usage_user_date_idx` ON `search_usage` (`user_id`, `usage_date`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `search_usage_date_idx` ON `search_usage` (`usage_date`);
--> statement-breakpoint
