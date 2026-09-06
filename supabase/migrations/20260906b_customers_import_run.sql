-- ════════════════════════════════════════════════════════════════════════════════
-- 20260906b — IMPORT PROVENANCE ON customers
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
--
-- ADDITIVE ONLY. ONE NULLABLE column, no default, no backfill, no CHECK any existing row could
-- fail — all 30 of LAWNS's customers have it NULL, which is exactly "not made by an import run".
-- NO policy change; the column inherits `customers`'s existing RLS unchanged. NOTHING IS DROPPED.
--
-- ── ⚠️ NOTHING WRITES THIS COLUMN TODAY, AND THAT IS STATED RATHER THAN IMPLIED ──
-- The customer MERGE is deliberately OUT of this build (David, §5: it stays off in test mode and
-- stays off after writes go on until a `customer_qb_links` join table exists, because one local
-- customer can map to TWO QuickBooks ids and `customers.qb_customer_id` is single-valued, so a
-- merge destroys the id the next import arrives on). The column lands now because the UNDO is
-- written now, and an undo that knows about only one of the two tables it will eventually have to
-- clean is an undo somebody will trust past the point where it is complete. The undo's customer
-- delete therefore matches ZERO rows today, by construction, and reports that it did.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS import_run_id uuid;

COMMENT ON COLUMN public.customers.import_run_id IS
  'The QuickBooks import run that CREATED this customer row. NULL = not created by one — which is '
  'every row today, because the customer import is not built (the merge waits on a '
  'customer_qb_links join table: one local customer can map to two QuickBooks ids and '
  'qb_customer_id is single-valued). Paired with business_inventory.import_run_id so one run id '
  'names everything a run made across both tables.';

CREATE INDEX IF NOT EXISTS customers_import_run_idx
  ON public.customers (business_id, import_run_id)
  WHERE import_run_id IS NOT NULL;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER applying. TENANT: LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the column exists, is NULLABLE, no default. EXPECT 1 row, is_nullable='YES', default NULL.
-- SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customers' AND column_name='import_run_id';
--
-- V2 — 🔴 NO CUSTOMER WAS STAMPED. EXPECT 30 / 0 for LAWNS.
-- SELECT count(*) AS rows_total, count(import_run_id) AS with_import_run
--   FROM public.customers WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 — the index exists and is PARTIAL. EXPECT 1 row whose indexdef contains 'WHERE'.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public' AND tablename='customers' AND indexname='customers_import_run_idx';
--
-- V4 — 🔴 NO POLICY CHANGED. Compare against the set from before this migration.
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='customers' ORDER BY policyname;
