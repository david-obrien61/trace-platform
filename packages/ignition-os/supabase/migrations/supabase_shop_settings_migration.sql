-- MIGRATION: Shop Settings Extensions
-- Adds DOT compliance toggle and margin config to shops table
-- Re-runnable: ADD COLUMN IF NOT EXISTS statements are idempotent

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS is_dot_mandated boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS margin_config    jsonb   NOT NULL DEFAULT '{"labor_rate":125,"parts_markup":0.40}';
