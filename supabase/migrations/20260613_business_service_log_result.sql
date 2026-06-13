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

-- Verify column present:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'business_service_log' AND column_name = 'result';
-- Expected: 1 row, data_type = text.

-- Verify CHECK constraint present (check_constraints does NOT exist in information_schema.columns —
-- CHECK defs live in pg_constraint):
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE contype = 'c' AND conrelid = 'business_service_log'::regclass
--   AND conname LIKE '%result%';
-- Expected: 1 row with CHECK (result = ANY (ARRAY['PASS', 'NEEDS_ATTENTION', 'FAIL'])).
