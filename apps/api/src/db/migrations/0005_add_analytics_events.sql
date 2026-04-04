-- Migration: Add analytics_events table for tracking app usage
-- This table stores anonymous usage events for product analytics

CREATE TABLE IF NOT EXISTS `analytics_events` (
  `id` text PRIMARY KEY NOT NULL,
  `device_id` text(255) NOT NULL,
  `event_type` text(50) NOT NULL,
  `session_id` text(255) NOT NULL,
  `os_name` text(50),
  `os_version` text(50),
  `app_version` text(50),
  `country` text(10),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `analytics_device_idx` ON `analytics_events` (`device_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `analytics_event_type_idx` ON `analytics_events` (`event_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `analytics_session_idx` ON `analytics_events` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `analytics_date_idx` ON `analytics_events` (`created_at`);
