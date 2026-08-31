-- ============================================================
-- Migration: deliveries.qb_invoice_id  (+ per-business unique index)
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-08-31 (verified via `date` — clock not drifted)
-- Purpose: make the QuickBooks ShipDate → delivery ingest RE-RUNNABLE.
--          `deliveries` has no source reference of any kind, so the ingest
--          could not tell its own previous work from new work: running it
--          twice would give Lauren THIRTY-SIX stops for eighteen invoices.
--          One nullable column + one partial unique index turns that from
--          "a thing that must never be run twice" into "a thing that can be
--          run forever", which is the difference between a script and a feature.
--
-- 🔴 WHY A UNIQUE INDEX AND NOT A CODE CHECK. A read-then-insert is TOCTOU:
--    two operators pressing Ingest at the same moment both read "not there"
--    and both insert. The index is the only form of this guarantee the
--    database will keep on our behalf. Same reasoning as tech-debt #54/#58,
--    which are the same shape and are still open BECAUSE they would reject
--    live rows — this one cannot, because the column starts empty everywhere.
--
-- 🔴 PARTIAL, ON `IS NOT NULL`. Every delivery Lauren has ever entered by hand
--    has a NULL here and must keep being allowed to: in Postgres NULLs do not
--    collide, but stating the predicate makes that a DECISION rather than a
--    property of NULL semantics somebody has to remember.
--
-- AC-1: no vertical noun — `qb_invoice_id` names the external system, not a nursery.
-- AC-2/AC-3: unchanged. No policy is added, altered or dropped by this migration;
--            the existing `deliveries_owner_all` / `deliveries_member_all` continue
--            to scope every row to `business_id` membership. The index is scoped
--            per business, so one tenant's invoice id can never collide with another's.
-- AC-4: no CHECK — the column is an opaque external reference and its value-set
--       is Intuit's, not ours.
--
-- Append-only: ADD COLUMN, nullable, no default → existing rows are untouched
--              and no row is rewritten (byte-safe).
--
-- ⚠️  APPLY MANUALLY in the Supabase SQL editor — do NOT execute without David's
--     explicit "run it".  GATED / UNAPPLIED until then.
--     ⚠️ THE INGEST REFUSES TO WRITE UNTIL THIS IS APPLIED — deliberately. Without
--     the column there is no idempotency, and an ingest without idempotency is the
--     thirty-six-stop failure. It reports the migration as the blocker by name.
--
--     🔴 SQL EDITOR, NOT THE TABLE EDITOR (§6 r17). The table editor's
--     `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS
--     cannot filter TRUNCATE. This is an ALTER on an existing table, so it does not
--     re-create anything — but the habit is the rule.
-- ============================================================
-- Pre-write verify (run before applying — expected results in comments):
--   deliveries                → 200 (PRESENT ✅, created by 20260620_deliveries.sql)
--   deliveries.qb_invoice_id  → ABSENT ✅ (this migration adds it)
--     SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='deliveries' AND column_name='qb_invoice_id';
--     Expected BEFORE: 0 rows.
-- NO other table is altered. NO policy is touched. NO row is rewritten.
-- ============================================================

ALTER TABLE deliveries
  ADD COLUMN qb_invoice_id text;   -- Intuit's Invoice.Id — stabler than DocNumber, which owners renumber

COMMENT ON COLUMN deliveries.qb_invoice_id IS
  'The QuickBooks Invoice.Id this delivery was ingested from (source=''qbo-shipdate''). '
  'NULL for every hand-entered delivery. Intuit''s Id is used rather than DocNumber because '
  'DocNumber is owner-editable and is renumbered in practice, so it is not an identity.';

-- Idempotency. One QuickBooks invoice yields at most ONE delivery per business, forever.
CREATE UNIQUE INDEX deliveries_business_qb_invoice_uidx
  ON deliveries (business_id, qb_invoice_id)
  WHERE qb_invoice_id IS NOT NULL;

-- ============================================================
-- END OF MIGRATION
-- Verify after applying (catalog gate — structure AND the index, both):
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='deliveries' AND column_name='qb_invoice_id';
--   Expected: qb_invoice_id | text | YES
--
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE schemaname='public' AND tablename='deliveries'
--     AND indexname='deliveries_business_qb_invoice_uidx';
--   Expected: 1 row, indexdef containing UNIQUE and "WHERE (qb_invoice_id IS NOT NULL)".
--
--   -- and the guarantee itself, proven rather than assumed:
--   SELECT count(*) FROM deliveries WHERE qb_invoice_id IS NOT NULL;   -- Expected BEFORE ingest: 0
-- ============================================================
