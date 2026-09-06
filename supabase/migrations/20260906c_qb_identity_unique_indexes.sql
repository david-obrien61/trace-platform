-- ════════════════════════════════════════════════════════════════════════════════
-- 20260906c — TWO NON-PARTIAL UNIQUE INDEXES ON THE QUICKBOOKS IDENTITIES
--             (business_id, qb_customer_id) on customers
--             (business_id, qb_item_id)     on business_inventory
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- DEPENDS ON: 20260906 (which adds business_inventory.qb_item_id). Apply that one FIRST.
--
-- 🔴 SEPARATE FILE ON PURPOSE. These are the only statements in this build that can FAIL LOUDLY
--    on data that already violates them, and that failure is the CORRECT outcome — two rows
--    against one QuickBooks id is a defect to look at, not a state to index around. Keeping them
--    out of the column migrations means a failure here does not take three harmless ALTER TABLEs
--    down with it, and the retry is this one file.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 NON-PARTIAL. THE PREDICATE IS THE BUG, AND THE LESSON IS ALREADY PAID FOR.
-- ════════════════════════════════════════════════════════════════════════════════
-- `20260831_deliveries_qb_invoice_id.sql` created its unique index WITH a predicate:
--     ... ON deliveries (business_id, qb_invoice_id) WHERE (qb_invoice_id IS NOT NULL)
-- Postgres infers a PARTIAL index for `ON CONFLICT` only when the clause REPEATS the predicate,
-- and PostgREST's `onConflict` is a bare column list that CANNOT express one. The delivery ingest
-- therefore failed on ALL 19 ROWS LIVE with *"there is no unique or exclusion constraint matching
-- the ON CONFLICT specification"*, and had to be corrected by `20260831b`. `20260831c` was then
-- written the corrected way from the start. These two are written the corrected way as well.
--
-- ⚠️ NULLS ARE DISTINCT, SO THE PREDICATE IS NOT NEEDED FOR CORRECTNESS EITHER. A btree unique
-- index treats NULLs as distinct by default (`NULLS DISTINCT`; `NULLS NOT DISTINCT` is NOT used
-- here). LAWNS's 11 customers with no QuickBooks id and its 447 inventory rows with no
-- `qb_item_id` all coexist under these indexes, exactly as the un-pushed orders do under
-- 20260831c's.
--
-- ⚠️ TECH-DEBT #54 PROPOSES THE PARTIAL FORM — `(business_id, qb_customer_id) WHERE NOT NULL`.
--    DO NOT BUILD IT THAT WAY. #54 was written 2026-07-16, six weeks before the 20260831 →
--    20260831b failure, and building its literal text would reproduce that failure exactly. This
--    migration CLOSES #54 in substance and departs from its stated shape for a measured reason.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE CUSTOMER INDEX LANDS CLEAN TODAY AND WILL NOT LATER. MEASURED 2026-09-06, LIVE, LAWNS:
--    30 customers · 19 carrying a qb_customer_id · 19 DISTINCT · ZERO duplicates.
--    That window closes the moment any import runs without the index in place. Unlike tech-debt
--    #58 and #183 — both blocked because their tables already hold the rows the index would
--    reject — this one can land on the first attempt, and today is the cheapest day it will ever
--    be. `business_inventory.qb_item_id` is NULL on all 447 rows, so that one is free by
--    construction.
--
-- AC-1: no vertical noun — `qb_item_id` / `qb_customer_id` name the external system.
-- AC-2: these are INDEXES. No policy is added, altered or dropped; no RLS is widened.
-- AC-3: business_id FIRST, so uniqueness is PER TENANT. Two tenants that each connect their own
--       QuickBooks company can hold the same Intuit id — Intuit ids are unique within a realm,
--       not across realms — and this index lets them, while forbidding a duplicate inside one.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- BEFORE — RUN THESE THREE FIRST AND READ THE ANSWERS. Do not run the migration until (b) and
-- (c) both return ZERO ROWS.
--
--   (a) does business_inventory.qb_item_id exist yet? (20260906 must be applied first)
--       SELECT column_name FROM information_schema.columns
--        WHERE table_schema='public' AND table_name='business_inventory' AND column_name='qb_item_id';
--       EXPECT: 1 row. 🔴 NO ROWS = STOP, apply 20260906 first.
--
--   (b) are there ALREADY duplicate customer ids? MUST RETURN ZERO ROWS.
--       SELECT business_id, qb_customer_id, count(*) FROM public.customers
--        WHERE qb_customer_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
--       EXPECT: (0 rows). Measured 0 on 2026-09-06. Anything here = surface it, do not run.
--
--   (c) are there ALREADY duplicate item ids? MUST RETURN ZERO ROWS.
--       SELECT business_id, qb_item_id, count(*) FROM public.business_inventory
--        WHERE qb_item_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
--       EXPECT: (0 rows) — the column is brand new and NULL everywhere.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS customers_business_qb_customer_uidx
  ON public.customers (business_id, qb_customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS business_inventory_business_qb_item_uidx
  ON public.business_inventory (business_id, qb_item_id);

COMMIT;

COMMENT ON INDEX public.customers_business_qb_customer_uidx IS
  'One local customer per QuickBooks customer id, per tenant. NON-PARTIAL deliberately: PostgREST '
  'onConflict is a bare column list and cannot repeat a predicate, so a partial index is invisible '
  'to ON CONFLICT (20260831 failed on all 19 live rows that way). NULLS are DISTINCT, so every '
  'customer with no QuickBooks id coexists here. Closes tech-debt #54 in substance and departs '
  'from its proposed partial shape for that measured reason.';

COMMENT ON INDEX public.business_inventory_business_qb_item_uidx IS
  'One inventory row per Intuit Item.Id, per tenant — the guard that makes the catalogue import '
  're-runnable rather than duplicating on the second run. NON-PARTIAL for the ON CONFLICT reason '
  'above. NULLS DISTINCT, so the 447 hand-made rows and every future non-QuickBooks row coexist.';

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER applying. TENANT: LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — 🔴 BOTH EXIST, BOTH UNIQUE, AND NEITHER indexdef CONTAINS 'WHERE'.
--      A 'WHERE' in either line means a partial index got in and ON CONFLICT will fail live.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public'
--    AND indexname IN ('customers_business_qb_customer_uidx','business_inventory_business_qb_item_uidx')
--  ORDER BY indexname;
--      EXPECT 2 rows, each starting 'CREATE UNIQUE INDEX', NEITHER containing 'WHERE'.
--
-- V2 — 🔴 THE NULLS-ARE-DISTINCT PROOF, WHICH IS THE ONE THAT WOULD BITE IF IT WERE WRONG.
--      LAWNS has 11 customers with a NULL qb_customer_id and 447 inventory rows with a NULL
--      qb_item_id. If NULLS were not distinct the migration above would already have FAILED.
--      That it committed IS the proof; this query states the numbers it survived.
-- SELECT (SELECT count(*) FROM public.customers
--          WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_customer_id IS NULL)
--            AS customers_with_null_qb_id,
--        (SELECT count(*) FROM public.business_inventory
--          WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_item_id IS NULL)
--            AS inventory_with_null_qb_id;
--      EXPECT: 11 and 447. Both > 1 under a unique index = NULLS DISTINCT is working.
--
-- V3 — 🔴 THE INDEX ACTUALLY REFUSES A DUPLICATE. Run it, read the error, ROLL BACK.
--      A unique index nobody has watched refuse is a claim (§6 r19b).
-- BEGIN;
--   INSERT INTO public.business_inventory (business_id, name, qty, qb_item_id)
--   SELECT business_id, 'DUP PROBE — ROLL THIS BACK', 0, qb_item_id
--     FROM public.business_inventory
--    WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_item_id IS NOT NULL LIMIT 1;
-- ROLLBACK;
--      EXPECT: ERROR duplicate key value violates unique constraint
--              "business_inventory_business_qb_item_uidx".
--      ⚠️ Run this only AFTER an import has put at least one qb_item_id in the table; before
--      that the SELECT returns no rows and the INSERT is a silent no-op that proves nothing.
