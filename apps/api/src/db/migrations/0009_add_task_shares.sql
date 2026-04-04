-- Migration: Add task_shares table for sharing task conversations
-- Created at: 2026-01-05

-- Create task_shares table
CREATE TABLE IF NOT EXISTS task_shares (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT,
  task_title TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  storage_url TEXT,
  model TEXT,
  password_hash TEXT,
  expires_at INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS shares_task_id_idx ON task_shares(task_id);
CREATE INDEX IF NOT EXISTS shares_user_id_idx ON task_shares(user_id);
CREATE INDEX IF NOT EXISTS shares_expires_at_idx ON task_shares(expires_at);
CREATE INDEX IF NOT EXISTS shares_created_at_idx ON task_shares(created_at);
CREATE INDEX IF NOT EXISTS shares_is_public_idx ON task_shares(is_public);
