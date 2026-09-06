-- ════════════════════════════════════════════════════════════════════════════════
-- 20260903 — RETIREMENT IS ITS OWN FIELD, BECAUSE `status` ALREADY HAS TWO AUTHORS
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17:
-- the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and
-- RLS cannot filter TRUNCATE). Nothing here creates a table, so this is belt-and-braces; the
-- rule is stated where the actor stands.
--
-- ADDITIVE ONLY. Two NULLABLE columns, no default, no backfill, no CHECK that any existing row
-- could fail — every row today has both as NULL, which is exactly "not retired". NO policy change:
-- the new columns inherit business_inventory's existing owner/member RLS unchanged, on the
-- 20260628 / 20260707 / 20260723 / 20260830 precedent. NOTHING IS DROPPED.
--
-- ── 🔴 WHY NOT `status` ──────────────────────────────────────────────────────────
-- Because `status` has TWO WRITERS and they overwrite each other. Tech-debt #71, open since
-- 2026-07-22: D-42's quantity-derive recomputes `status` from qty (`depleted` when it hits zero)
-- and D-52's tombstone writes a lifecycle value into the same column — so a manually `archived`
-- row is REVERTED by the next quantity change, and a deleted lot reads `depleted`.
--
-- Writing `retired` into that column would put a THIRD author on it, and the failure would be the
-- worst-shaped one available: the 443 retired rows all have qty 0, so the qty-derive would
-- overwrite `retired` with `depleted` and they would silently come back. #71's own recorded
-- durable fix is *"lifecycle state in its own field — a MIGRATION"*. This is that migration,
-- for the one lifecycle event this build needs. **It does not close #71**, which is about the
-- existing collision between the derive and the tombstone; it declines to add to it.
--
-- ── 🔴 WHY A TIMESTAMP AND NOT A BOOLEAN ─────────────────────────────────────────
-- `retired_at IS NOT NULL` answers "is it retired" exactly as well as a boolean, and also answers
-- "when" and "in which batch" — which is what makes the act reversible by a human looking at the
-- data rather than only by someone who still remembers running it. A boolean records that
-- something happened and destroys when.
--
-- ── 🔴 RETIRE, NEVER DELETE ──────────────────────────────────────────────────────
-- David's ruling on the 447 rows from the 2026-08-25 price-list import (source never identified,
-- 443 at quantity zero, no SKUs, six duplicate name+size pairs): they are RETIRED AND REPLACED by
-- the 685 QuickBooks items. Retired means hidden and recoverable. There is no DELETE anywhere in
-- this build, and `planRetireAndReplace` has no `delete` disposition for a caller to reach for.
--
-- ⚠️ CORRECTED 2026-09-06 — TWO STATEMENTS ON THIS LINE WERE WRONG AND BOTH ARE FIXED HERE.
-- It said: "ANY ROW CARRYING A REAL COUNT IS NEVER RETIRED. Four of the 447 do."
--   ① IT IS TWO, NOT FOUR. Measured live 2026-09-06: `qty > 0` returns exactly 2 rows — Brodie
--      Juniper 30 gallon (qty 1) and Arizona Cypress, Blue Ice 30 gallon (qty 1). The other two
--      rows that look special are `status='archived'` at qty 0 — "tree" and
--      `__harness_replay_lot` — which is a different fact entirely.
--   ② THEY ARE RETIRED NOW. David's ruling, 2026-09-06: *"ALL 447 RETIRE. NO EXCEPTIONS. The two
--      rows carrying a count are MY test data — I put them there to see whether the inventory
--      widget worked."* One tree each, against a smallest real variety of seventy. The
--      keep-the-counted-rows clause of R-58/R-70 was written to protect a physical count nobody
--      could recreate; there is no such count here, and the clause is superseded by R-94.
-- The retire is scoped `business_id` + `retired_at IS NULL` — NOT a snapshot id list, because
-- Lauren is uploading all weekend and a snapshot can go stale between the plan and the apply.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.business_inventory
  ADD COLUMN IF NOT EXISTS retired_at     timestamptz,
  ADD COLUMN IF NOT EXISTS retired_reason text;

COMMENT ON COLUMN public.business_inventory.retired_at IS
  'When this row was retired. NULL = live. Retirement is HIDING, never deletion — the row and its '
  'history stay. Deliberately NOT `status`: that column has two writers already (the D-42 '
  'quantity-derive and the D-52 tombstone, tech-debt #71) and a third would be overwritten by the '
  'derive, since every retired row has qty 0 and would be recomputed to ''depleted''. A timestamp '
  'rather than a boolean so the batch is recoverable from the data itself.';

COMMENT ON COLUMN public.business_inventory.retired_reason IS
  'Why, in the owner''s words, as shown on the replacement report. Written by the retire-and-replace '
  'pass; NULL for any row retired by a future path that does not set one.';

-- Partial: only retired rows are indexed, so it costs nothing on the live catalogue and makes
-- "show me what the replacement hid" a cheap query when somebody asks for it back.
CREATE INDEX IF NOT EXISTS business_inventory_retired_idx
  ON public.business_inventory (business_id, retired_at DESC)
  WHERE retired_at IS NOT NULL;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run these AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the two columns exist, are NULLABLE, and carry no default.
--      EXPECT exactly 2 rows, both is_nullable='YES', both column_default NULL.
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='business_inventory'
--    AND column_name IN ('retired_at','retired_reason')
--  ORDER BY column_name;
--
-- V2 — 🔴 NOTHING WAS RETIRED BY APPLYING THIS. EXPECT 0.
--      A migration that quietly retired rows would be indistinguishable from the build working.
-- SELECT count(*) AS already_retired FROM public.business_inventory WHERE retired_at IS NOT NULL;
--
-- V3 — the index exists and is PARTIAL (the WHERE clause must appear in indexdef).
--      EXPECT 1 row whose indexdef contains 'WHERE (retired_at IS NOT NULL)'.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public' AND indexname='business_inventory_retired_idx';
--
-- V4 — 🔴 NO POLICY WAS ADDED, ALTERED OR DROPPED. EXPECT the same set as before this migration
--      (business_inventory_owner_all + business_inventory_member_all, from 20260612).
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_inventory' ORDER BY policyname;
--
-- V5 — the baseline the replacement pass is about to act on, so the report can be checked
--      against something measured rather than against the number in a prompt.
--      EXPECT (as of 2026-08-25's import): ~447 total, ~4 with a real count.
-- SELECT count(*) AS live_rows,
--        count(*) FILTER (WHERE qty > 0) AS rows_with_a_real_count,
--        count(*) FILTER (WHERE sku IS NULL OR btrim(sku) = '') AS rows_with_no_sku
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'   -- LAWNS
--    AND retired_at IS NULL;
