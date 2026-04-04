-- Migration: Add provider_usage table for TalkCody provider
-- Tracks usage by user ID for rate limiting

-- Provider Usage Table - tracks usage for TalkCody provider rate limiting
CREATE TABLE IF NOT EXISTS `provider_usage` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text(255) NOT NULL,
  `provider` text(50) NOT NULL,
  `model` text(100) NOT NULL,
  `input_tokens` integer DEFAULT 0 NOT NULL,
  `output_tokens` integer DEFAULT 0 NOT NULL,
  `total_tokens` integer DEFAULT 0 NOT NULL,
  `usage_date` text(10) NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `provider_usage_user_date_idx` ON `provider_usage` (`user_id`, `usage_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `provider_usage_provider_idx` ON `provider_usage` (`provider`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `provider_usage_date_idx` ON `provider_usage` (`usage_date`);
