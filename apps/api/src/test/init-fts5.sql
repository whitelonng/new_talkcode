-- ============================================
-- FTS5 Tables and Triggers
-- ============================================

-- Create FTS5 virtual tables
CREATE VIRTUAL TABLE IF NOT EXISTS marketplace_agents_fts USING fts5(
  id UNINDEXED,
  name,
  description,
  long_description,
  tokenize='porter unicode61 remove_diacritics 1'
);

CREATE VIRTUAL TABLE IF NOT EXISTS marketplace_skills_fts USING fts5(
  id UNINDEXED,
  name,
  description,
  long_description,
  tokenize='porter unicode61 remove_diacritics 1'
);

-- Agents INSERT trigger
CREATE TRIGGER IF NOT EXISTS marketplace_agents_fts_insert
AFTER INSERT ON marketplace_agents
WHEN new.is_published = 1
BEGIN
  INSERT INTO marketplace_agents_fts(id, name, description, long_description)
  VALUES (new.id, new.name, new.description, COALESCE(new.long_description, ''));
END;

-- Agents UPDATE trigger
CREATE TRIGGER IF NOT EXISTS marketplace_agents_fts_update
AFTER UPDATE OF name, description, long_description, is_published ON marketplace_agents
BEGIN
  DELETE FROM marketplace_agents_fts WHERE id = old.id AND new.is_published = 0;
  UPDATE marketplace_agents_fts
  SET name = new.name, description = new.description, long_description = COALESCE(new.long_description, '')
  WHERE id = new.id AND new.is_published = 1;
  INSERT INTO marketplace_agents_fts(id, name, description, long_description)
  SELECT new.id, new.name, new.description, COALESCE(new.long_description, '')
  WHERE new.is_published = 1 AND old.is_published = 0;
END;

-- Agents DELETE trigger
CREATE TRIGGER IF NOT EXISTS marketplace_agents_fts_delete
AFTER DELETE ON marketplace_agents
BEGIN
  DELETE FROM marketplace_agents_fts WHERE id = old.id;
END;

-- Skills INSERT trigger
CREATE TRIGGER IF NOT EXISTS marketplace_skills_fts_insert
AFTER INSERT ON marketplace_skills
WHEN new.is_published = 1
BEGIN
  INSERT INTO marketplace_skills_fts(id, name, description, long_description)
  VALUES (new.id, new.name, new.description, COALESCE(new.long_description, ''));
END;

-- Skills UPDATE trigger
CREATE TRIGGER IF NOT EXISTS marketplace_skills_fts_update
AFTER UPDATE OF name, description, long_description, is_published ON marketplace_skills
BEGIN
  DELETE FROM marketplace_skills_fts WHERE id = old.id AND new.is_published = 0;
  UPDATE marketplace_skills_fts
  SET name = new.name, description = new.description, long_description = COALESCE(new.long_description, '')
  WHERE id = new.id AND new.is_published = 1;
  INSERT INTO marketplace_skills_fts(id, name, description, long_description)
  SELECT new.id, new.name, new.description, COALESCE(new.long_description, '')
  WHERE new.is_published = 1 AND old.is_published = 0;
END;

-- Skills DELETE trigger
CREATE TRIGGER IF NOT EXISTS marketplace_skills_fts_delete
AFTER DELETE ON marketplace_skills
BEGIN
  DELETE FROM marketplace_skills_fts WHERE id = old.id;
END;
