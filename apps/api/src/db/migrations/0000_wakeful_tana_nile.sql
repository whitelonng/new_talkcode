CREATE TABLE `agent_categories` (
	`agent_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `marketplace_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_categories_agent_idx` ON `agent_categories` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_categories_category_idx` ON `agent_categories` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_categories_pk` ON `agent_categories` (`agent_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `agent_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version` text(50),
	`event_type` text(20) NOT NULL,
	`user_id` text,
	`device_id` text(255),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `marketplace_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `stats_agent_idx` ON `agent_stats` (`agent_id`);--> statement-breakpoint
CREATE INDEX `stats_date_idx` ON `agent_stats` (`created_at`);--> statement-breakpoint
CREATE INDEX `stats_event_idx` ON `agent_stats` (`event_type`);--> statement-breakpoint
CREATE INDEX `stats_user_idx` ON `agent_stats` (`user_id`);--> statement-breakpoint
CREATE TABLE `agent_tags` (
	`agent_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `marketplace_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_tags_agent_idx` ON `agent_tags` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_tags_tag_idx` ON `agent_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_tags_pk` ON `agent_tags` (`agent_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `agent_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version` text(50) NOT NULL,
	`system_prompt` text NOT NULL,
	`tools_config` text NOT NULL,
	`rules` text,
	`output_format` text,
	`dynamic_prompt_config` text,
	`change_log` text,
	`is_prerelease` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `marketplace_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `versions_agent_idx` ON `agent_versions` (`agent_id`);--> statement-breakpoint
CREATE INDEX `versions_created_idx` ON `agent_versions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `versions_unique` ON `agent_versions` (`agent_id`,`version`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text(100) NOT NULL,
	`slug` text(100) NOT NULL,
	`description` text,
	`icon` text(50),
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_order_idx` ON `categories` (`display_order`);--> statement-breakpoint
CREATE TABLE `collection_agents` (
	`collection_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `marketplace_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_agents_collection_idx` ON `collection_agents` (`collection_id`);--> statement-breakpoint
CREATE INDEX `collection_agents_agent_idx` ON `collection_agents` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_agents_pk` ON `collection_agents` (`collection_id`,`agent_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`slug` text(100) NOT NULL,
	`description` text,
	`icon` text(50),
	`is_featured` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_slug_idx` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_featured_idx` ON `collections` (`is_featured`);--> statement-breakpoint
CREATE INDEX `collections_order_idx` ON `collections` (`display_order`);--> statement-breakpoint
CREATE TABLE `marketplace_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text(100) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text NOT NULL,
	`long_description` text,
	`author_id` text NOT NULL,
	`model` text(100) NOT NULL,
	`system_prompt` text NOT NULL,
	`tools_config` text NOT NULL,
	`rules` text,
	`output_format` text,
	`dynamic_prompt_config` text,
	`icon_url` text,
	`banner_url` text,
	`download_count` integer DEFAULT 0 NOT NULL,
	`install_count` integer DEFAULT 0 NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`latest_version` text(50) NOT NULL,
	`search_vector` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_agents_slug_unique` ON `marketplace_agents` (`slug`);--> statement-breakpoint
CREATE INDEX `agents_slug_idx` ON `marketplace_agents` (`slug`);--> statement-breakpoint
CREATE INDEX `agents_author_idx` ON `marketplace_agents` (`author_id`);--> statement-breakpoint
CREATE INDEX `agents_featured_idx` ON `marketplace_agents` (`is_featured`);--> statement-breakpoint
CREATE INDEX `agents_downloads_idx` ON `marketplace_agents` (`download_count`);--> statement-breakpoint
CREATE INDEX `agents_created_idx` ON `marketplace_agents` (`created_at`);--> statement-breakpoint
CREATE INDEX `agents_published_idx` ON `marketplace_agents` (`is_published`);--> statement-breakpoint
CREATE TABLE `marketplace_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text(100) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text NOT NULL,
	`long_description` text,
	`author_id` text NOT NULL,
	`system_prompt_fragment` text,
	`workflow_rules` text,
	`documentation` text NOT NULL,
	`icon_url` text,
	`banner_url` text,
	`download_count` integer DEFAULT 0 NOT NULL,
	`install_count` integer DEFAULT 0 NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`latest_version` text(50) NOT NULL,
	`search_vector` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_skills_slug_unique` ON `marketplace_skills` (`slug`);--> statement-breakpoint
CREATE INDEX `skills_slug_idx` ON `marketplace_skills` (`slug`);--> statement-breakpoint
CREATE INDEX `skills_author_idx` ON `marketplace_skills` (`author_id`);--> statement-breakpoint
CREATE INDEX `skills_featured_idx` ON `marketplace_skills` (`is_featured`);--> statement-breakpoint
CREATE INDEX `skills_downloads_idx` ON `marketplace_skills` (`download_count`);--> statement-breakpoint
CREATE INDEX `skills_created_idx` ON `marketplace_skills` (`created_at`);--> statement-breakpoint
CREATE INDEX `skills_published_idx` ON `marketplace_skills` (`is_published`);--> statement-breakpoint
CREATE TABLE `skill_categories` (
	`skill_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `marketplace_skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_categories_skill_idx` ON `skill_categories` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_categories_category_idx` ON `skill_categories` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_categories_pk` ON `skill_categories` (`skill_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `skill_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` text(50),
	`event_type` text(20) NOT NULL,
	`user_id` text,
	`device_id` text(255),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `marketplace_skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `skill_stats_skill_idx` ON `skill_stats` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_stats_date_idx` ON `skill_stats` (`created_at`);--> statement-breakpoint
CREATE INDEX `skill_stats_event_idx` ON `skill_stats` (`event_type`);--> statement-breakpoint
CREATE INDEX `skill_stats_user_idx` ON `skill_stats` (`user_id`);--> statement-breakpoint
CREATE TABLE `skill_tags` (
	`skill_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `marketplace_skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_tags_skill_idx` ON `skill_tags` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_tags_tag_idx` ON `skill_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_tags_pk` ON `skill_tags` (`skill_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `skill_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` text(50) NOT NULL,
	`system_prompt_fragment` text,
	`workflow_rules` text,
	`documentation` text NOT NULL,
	`change_log` text,
	`is_prerelease` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `marketplace_skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_versions_skill_idx` ON `skill_versions` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_versions_created_idx` ON `skill_versions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_versions_unique` ON `skill_versions` (`skill_id`,`version`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text(50) NOT NULL,
	`slug` text(50) NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE INDEX `tags_slug_idx` ON `tags` (`slug`);--> statement-breakpoint
CREATE INDEX `tags_usage_idx` ON `tags` (`usage_count`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`avatar_url` text,
	`role` text(20) DEFAULT 'user' NOT NULL,
	`bio` text,
	`website` text,
	`github_id` text(255),
	`google_id` text(255),
	`is_verified` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_github_idx` ON `users` (`github_id`);--> statement-breakpoint
CREATE INDEX `users_google_idx` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);