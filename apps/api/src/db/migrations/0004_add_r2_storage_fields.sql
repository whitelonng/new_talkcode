-- Migration: Add R2 storage fields to skills tables
-- Description: Add fields to support file-based skills with R2 storage

-- Add R2 storage fields to marketplace_skills
ALTER TABLE marketplace_skills ADD COLUMN storage_url TEXT;
ALTER TABLE marketplace_skills ADD COLUMN package_size INTEGER;
ALTER TABLE marketplace_skills ADD COLUMN checksum TEXT;
ALTER TABLE marketplace_skills ADD COLUMN required_permission TEXT DEFAULT 'read-only';
ALTER TABLE marketplace_skills ADD COLUMN has_scripts INTEGER DEFAULT 0 NOT NULL;

-- statement-breakpoint

-- Add index for storage_url
CREATE INDEX skills_storage_idx ON marketplace_skills(storage_url);

-- statement-breakpoint

-- Add R2 storage fields to skill_versions
ALTER TABLE skill_versions ADD COLUMN storage_url TEXT;
ALTER TABLE skill_versions ADD COLUMN package_size INTEGER;
ALTER TABLE skill_versions ADD COLUMN checksum TEXT;

-- statement-breakpoint

-- Add index for storage_url
CREATE INDEX skill_versions_storage_idx ON skill_versions(storage_url);
