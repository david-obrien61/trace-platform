-- supabase_price_override_migration.sql
-- Adds price override tracking columns to estimate_line_items.
-- Run after supabase_job_lifecycle_migration.sql.

ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS is_manual_override        boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_calculated_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_leakage             numeric(10,2);
