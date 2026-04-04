-- ============================================
-- Add display_name column to users table
-- Migration: 0002_add_display_name
-- ============================================
-- This migration adds the display_name field to the users table
-- to allow users to set a custom display name separate from
-- their OAuth provider name.
-- ============================================

-- Add display_name column to users table
ALTER TABLE users ADD COLUMN display_name TEXT;

-- ============================================
-- Migration Complete
-- ============================================
-- Users can now set a custom display name that will be shown
-- in the marketplace and other public-facing areas.
-- If display_name is NULL, the system will fallback to the name field.
-- ============================================
