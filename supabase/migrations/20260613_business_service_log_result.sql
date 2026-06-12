-- ============================================================
-- Migration: business_service_log — add result column
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-06-13
-- ⚠️  APPLY MANUALLY in Supabase SQL editor BEFORE using
--     the PMI log service form. The result field in the
--     INSERT payload will error if this column is missing.
-- ============================================================

ALTER TABLE business_service_log
  ADD COLUMN IF NOT EXISTS result text
  CHECK (result IN ('PASS', 'NEEDS_ATTENTION', 'FAIL'));

-- Verify:
-- SELECT column_name, data_type, check_constraints
-- FROM information_schema.columns
-- WHERE table_name = 'business_service_log' AND column_name = 'result';
-- Expected: 1 row returned with text data type.
