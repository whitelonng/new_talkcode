-- ============================================
-- FTS5 Full-Text Search Implementation
-- Migration: 0002_add_fts5_search
-- ============================================
-- This migration adds FTS5 (Full-Text Search) support to the marketplace
-- for fast, relevance-ranked search across agents and skills.
--
-- FTS5 provides:
-- - Fast indexed search (10-50x faster than LIKE)
-- - Relevance ranking using BM25 algorithm
-- - Advanced search syntax (phrases, boolean operators, prefix matching)
-- - International character support
-- ============================================

-- ============================================
-- 1. Create FTS5 Virtual Tables
-- ============================================

-- FTS5 virtual table for marketplace agents
CREATE VIRTUAL TABLE IF NOT EXISTS marketplace_agents_fts USING fts5(
  id UNINDEXED,              -- Store ID but don't index it (used for joining)
  name,                      -- Agent name (highest weight in ranking)
  description,               -- Short description (medium weight)
  long_description,          -- Detailed description (lower weight)
  tokenize='porter unicode61 remove_diacritics 1'  -- Stemming + international chars + diacritic removal
);

-- FTS5 virtual table for marketplace skills
CREATE VIRTUAL TABLE IF NOT EXISTS marketplace_skills_fts USING fts5(
  id UNINDEXED,
  name,
  description,
  long_description,
  tokenize='porter unicode61 remove_diacritics 1'
);

-- ============================================
-- 2. Populate FTS5 Tables with Existing Data
-- ============================================

-- Populate agents FTS table
-- Note: COALESCE ensures NULL values don't break the index
INSERT INTO marketplace_agents_fts(id, name, description, long_description)
SELECT
  id,
  name,
  description,
  COALESCE(long_description, '')
FROM marketplace_agents
WHERE is_published = 1;  -- Only index published agents

-- Populate skills FTS table
INSERT INTO marketplace_skills_fts(id, name, description, long_description)
SELECT
  id,
  name,
  description,
  COALESCE(long_description, '')
FROM marketplace_skills
WHERE is_published = 1;  -- Only index published skills

-- ============================================
-- 3. Create Triggers for Automatic Sync
-- ============================================
-- These triggers keep the FTS5 tables in sync with the source tables
-- without requiring application-level code.

-- ----------------
-- Agents Triggers
-- ----------------

-- Insert: Add new published agents to FTS
CREATE TRIGGER IF NOT EXISTS marketplace_agents_fts_insert
AFTER INSERT ON marketplace_agents
WHEN new.is_published = 1
BEGIN
  INSERT INTO marketplace_agents_fts(id, name, description, long_description)
  VALUES (
    new.id,
    new.name,
    new.description,
    COALESCE(new.long_description, '')
  );
END;

-- Update: Sync changes to FTS when relevant fields change
CREATE TRIGGER IF NOT EXISTS marketplace_agents_fts_update
AFTER UPDATE OF name, description, long_description, is_published ON marketplace_agents
BEGIN
  -- Delete from FTS if unpublished
  DELETE FROM marketplace_agents_fts WHERE id = old.id AND new.is_published = 0;

  -- Update FTS if published and was already in FTS
  UPDATE marketplace_agents_fts
  SET
    name = new.name,
    description = new.description,
    long_description = COALESCE(new.long_description, '')
  WHERE id = new.id AND new.is_published = 1;

  -- Insert to FTS if newly published
  INSERT INTO marketplace_agents_fts(id, name, description, long_description)
  SELECT new.id, new.name, new.description, COALESCE(new.long_description, '')
  WHERE new.is_published = 1 AND old.is_published = 0;
END;

-- Delete: Remove from FTS when agent is deleted
CREATE TRIGGER IF NOT EXISTS marketplace_agents_fts_delete
AFTER DELETE ON marketplace_agents
BEGIN
  DELETE FROM marketplace_agents_fts WHERE id = old.id;
END;

-- ----------------
-- Skills Triggers
-- ----------------

-- Insert: Add new published skills to FTS
CREATE TRIGGER IF NOT EXISTS marketplace_skills_fts_insert
AFTER INSERT ON marketplace_skills
WHEN new.is_published = 1
BEGIN
  INSERT INTO marketplace_skills_fts(id, name, description, long_description)
  VALUES (
    new.id,
    new.name,
    new.description,
    COALESCE(new.long_description, '')
  );
END;

-- Update: Sync changes to FTS when relevant fields change
CREATE TRIGGER IF NOT EXISTS marketplace_skills_fts_update
AFTER UPDATE OF name, description, long_description, is_published ON marketplace_skills
BEGIN
  -- Delete from FTS if unpublished
  DELETE FROM marketplace_skills_fts WHERE id = old.id AND new.is_published = 0;

  -- Update FTS if published and was already in FTS
  UPDATE marketplace_skills_fts
  SET
    name = new.name,
    description = new.description,
    long_description = COALESCE(new.long_description, '')
  WHERE id = new.id AND new.is_published = 1;

  -- Insert to FTS if newly published
  INSERT INTO marketplace_skills_fts(id, name, description, long_description)
  SELECT new.id, new.name, new.description, COALESCE(new.long_description, '')
  WHERE new.is_published = 1 AND old.is_published = 0;
END;

-- Delete: Remove from FTS when skill is deleted
CREATE TRIGGER IF NOT EXISTS marketplace_skills_fts_delete
AFTER DELETE ON marketplace_skills
BEGIN
  DELETE FROM marketplace_skills_fts WHERE id = old.id;
END;

-- ============================================
-- 4. Create Maintenance Procedures
-- ============================================
-- Note: These can be run manually or via cron job for optimization

-- To rebuild FTS5 index (run periodically for optimal performance):
-- INSERT INTO marketplace_agents_fts(marketplace_agents_fts) VALUES('rebuild');
-- INSERT INTO marketplace_skills_fts(marketplace_skills_fts) VALUES('rebuild');

-- To optimize FTS5 index (merge segments):
-- INSERT INTO marketplace_agents_fts(marketplace_agents_fts) VALUES('optimize');
-- INSERT INTO marketplace_skills_fts(marketplace_skills_fts) VALUES('optimize');

-- To check FTS5 integrity:
-- INSERT INTO marketplace_agents_fts(marketplace_agents_fts) VALUES('integrity-check');
-- INSERT INTO marketplace_skills_fts(marketplace_skills_fts) VALUES('integrity-check');

-- ============================================
-- Migration Complete
-- ============================================
-- FTS5 full-text search is now enabled for:
-- - marketplace_agents (name, description, long_description)
-- - marketplace_skills (name, description, long_description)
--
-- Search syntax examples:
-- - Simple: "python"
-- - Phrase: "code review"
-- - Boolean: "python AND testing"
-- - Prefix: "java*"
-- - Proximity: "code NEAR testing"
--
-- Performance: ~10-50x faster than LIKE queries
-- Ranking: BM25 relevance algorithm
-- ============================================
