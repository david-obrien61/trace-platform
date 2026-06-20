-- ============================================================
-- Migration: deliveries.service_type
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-06-20 (verified via `date` command — clock not drifted)
-- Purpose: classify a scheduled delivery as a PLANTING/installation job
--          vs a DELIVERY-ONLY drop, inferred from invoice line items
--          (INSTALL/WARRANTY → planting; else delivery_only) and
--          correctable by the owner on the confirm screen.
-- AC-4: free text, NO CHECK — the value-set grows without a migration.
-- Append-only: ALTER ADD COLUMN, nullable, no default → existing rows
--              keep service_type NULL, nothing else changes (byte-safe).
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without
--     David's explicit "run it" approval.  GATED / UNAPPLIED until then.
-- ============================================================
-- Pre-write verify (run before applying — expected in comments):
--   deliveries → 200 (PRESENT ✅, created by 20260620_deliveries.sql, applied + verified 14/14)
--   deliveries.service_type → ABSENT ✅ (this migration adds it)
-- NO other table altered. Apply AFTER 20260620_deliveries.sql.
-- ============================================================

ALTER TABLE deliveries
  ADD COLUMN service_type text;   -- 'planting' | 'delivery_only' (AC-4: no CHECK)

-- ============================================================
-- END OF MIGRATION
-- Verify after applying (catalog gate):
--   SUPABASE_PAT=sbp_xxx node scripts/verify-deliveries.mjs   -- check (G)
-- Quick check:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='deliveries' AND column_name='service_type';
-- Expected: service_type | text | YES
-- ============================================================
