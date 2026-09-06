-- ════════════════════════════════════════════════════════════════════════════════
-- 20260906 — IMPORT PROVENANCE ON business_inventory: WHICH RUN MADE IT, WHICH RUN HID IT
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17:
-- the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and
-- RLS cannot filter TRUNCATE). Nothing here creates a table, so this is belt-and-braces; the
-- rule is stated where the actor stands.
--
-- ADDITIVE ONLY. Three NULLABLE columns, no default, no backfill, no CHECK any existing row
-- could fail — every one of LAWNS's 447 rows has all three NULL, which is exactly "made by
-- hand, hidden by nobody, not from QuickBooks". NO policy change: the new columns inherit
-- business_inventory's existing owner/member RLS unchanged, on the 20260628 / 20260707 /
-- 20260723 / 20260830 / 20260903 precedent. NOTHING IS DROPPED.
--
-- 🔴 THIS FILE ADDS COLUMNS ONLY. The two UNIQUE indexes this build needs live in
--    `20260906c_qb_identity_unique_indexes.sql`, deliberately separated: a unique index is the
--    one thing here that CAN FAIL LOUDLY on data that already violates it, and a failure that
--    takes three harmless columns down with it makes the retry harder than it needs to be.
--
-- ── 🔴 WHY `retired_by_run_id` IS NOT OPTIONAL ──────────────────────────────────
-- `retired_at` alone says a row is hidden and WHEN. It cannot say WHICH PASS hid it. Lauren is
-- expected to import, look, wipe, and import again — so by the second run there are rows retired
-- by run 1 and rows retired by run 2 sitting side by side with `retired_at` timestamps minutes
-- apart. Undoing run 2 by timestamp would un-retire run 1's rows as well, silently restoring a
-- catalogue she had already replaced. The run id is what makes the undo exact instead of
-- approximately right.
--
-- ── 🔴 WHY `qb_item_id` AND NOT `sku` ───────────────────────────────────────────
-- MEASURED against LAWNS's live QuickBooks capture (2026-09-04, 685 items, complete):
-- **`Sku` is present on 2 of 685.** It cannot be an identity. `Item.Id` is on all 685, is
-- Intuit's own stable key, and is what an invoice line's `ItemRef.value` points at — so it is
-- both the identity we can rely on and the one the invoice push will eventually need.
--
-- ⚠️ AND IT CORRECTS TWO WRITTEN CLAIMS THAT WERE FALSE. `docs/RULINGS.md` R-70 says the 685
-- QuickBooks items *"carry SKUs"*, and `retireAndReplace.ts:100-104` says *"The 685 QuickBooks
-- items ALL have SKUs."* Both are wrong against the capture file; both are corrected in this
-- pass. (R-26's shape, inside the file R-70 built.)
--
-- ── ⚠️ A NOTE ON `import_run_id` AND THE CSV IMPORTER ───────────────────────────
-- `importWrites.ts` (the CSV import) does NOT set this column and is not changed by this build.
-- A row it creates carries `import_run_id IS NULL`, which reads correctly as "not from a
-- QuickBooks import run" rather than as a lie. The column is not a general import marker; it
-- names a QuickBooks catalogue run so the run can be undone.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.business_inventory
  ADD COLUMN IF NOT EXISTS import_run_id     uuid,
  ADD COLUMN IF NOT EXISTS retired_by_run_id uuid,
  ADD COLUMN IF NOT EXISTS qb_item_id        text;

COMMENT ON COLUMN public.business_inventory.import_run_id IS
  'The QuickBooks catalogue import run that CREATED this row. NULL = not created by one (hand '
  'entry, the CSV importer, discovery seed). It is what makes a run undoable: while QuickBooks '
  'writes are held, every row carrying a given run id can be deleted and the tenant is back where '
  'it started. NOT a general import marker — the CSV importer does not set it.';

COMMENT ON COLUMN public.business_inventory.retired_by_run_id IS
  'The import run that RETIRED this row, paired with retired_at. NULL = not retired by a run. '
  'retired_at alone cannot say WHICH pass hid a row, so undoing the second run would un-retire '
  'the first run''s rows too. This column is what makes the undo exact.';

COMMENT ON COLUMN public.business_inventory.qb_item_id IS
  'Intuit''s Item.Id for this product — the identity an invoice line''s ItemRef.value points at. '
  'Measured on LAWNS''s 685-item capture 2026-09-04: Id is present on 685 of 685, Sku on 2 of 685, '
  'which is why the identity is the id and not the SKU. NULL = this row did not come from '
  'QuickBooks. Unique per business — see 20260906c.';

-- Provenance lookups. Both are the undo''s working set, so both are indexed; both are PARTIAL so
-- they cost nothing on a catalogue where the overwhelming majority of rows carry neither.
CREATE INDEX IF NOT EXISTS business_inventory_import_run_idx
  ON public.business_inventory (business_id, import_run_id)
  WHERE import_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_inventory_retired_by_run_idx
  ON public.business_inventory (business_id, retired_by_run_id)
  WHERE retired_by_run_id IS NOT NULL;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run these AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- TENANT: LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the three columns exist, are NULLABLE, carry no default.
--      EXPECT exactly 3 rows, all is_nullable='YES', all column_default NULL.
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='business_inventory'
--    AND column_name IN ('import_run_id','retired_by_run_id','qb_item_id')
--  ORDER BY column_name;
--
-- V2 — 🔴 APPLYING THIS CHANGED NO ROW'S MEANING. EXPECT 447 / 0 / 0 / 0 for LAWNS.
--      A migration that quietly stamped rows would be indistinguishable from the import working.
-- SELECT count(*) AS rows_total,
--        count(import_run_id)     AS with_import_run,
--        count(retired_by_run_id) AS with_retired_by_run,
--        count(qb_item_id)        AS with_qb_item_id
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 — the two provenance indexes exist and are PARTIAL.
--      EXPECT 2 rows, each indexdef containing 'WHERE'.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public' AND tablename='business_inventory'
--    AND indexname IN ('business_inventory_import_run_idx','business_inventory_retired_by_run_idx')
--  ORDER BY indexname;
--
-- V4 — 🔴 NO POLICY WAS ADDED, ALTERED OR DROPPED. EXPECT the same set as before
--      (business_inventory_owner_all + business_inventory_member_all, from 20260612).
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_inventory' ORDER BY policyname;
--
-- V5 — 🔴 NO TRIGGER WAS ADDED. EXPECT exactly the two that were already there:
--      business_inventory_updated_at and business_inventory_unit_projection.
--      This matters because the import writes rows with a PLAIN INSERT and must emit NO
--      LEDGER ROW while writes are held (R-93). A third trigger here would break that.
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.business_inventory'::regclass AND NOT tgisinternal ORDER BY tgname;
