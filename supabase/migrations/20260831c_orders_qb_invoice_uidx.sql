-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: UNIQUE (business_id, qb_invoice_id) on public.orders
-- Date:      2026-08-31
-- Purpose:   make "an invoice that already has an order gets nothing" a GUARANTEE rather
--            than a convention, so the QuickBooks order ingest is idempotent by the
--            database and not by the code's memory of what it did last time.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 🔴 NO COLUMN IS ADDED. `orders.qb_invoice_id` ALREADY EXISTS — it is written on every
--    successful push (`api/qbo/invoice/cultivar.ts`, the `qbWriteBack` object) and has been
--    since long before this migration. It is one of the live-only columns tech-debt #39
--    names: real in the database, absent from the migration corpus. This migration does not
--    fix that (the column's own DDL still is not in version control); it adds the constraint
--    the ingest needs and says out loud that the column is older than the file.
--
-- 🔴 THE INDEX IS NOT PARTIAL, AND THAT IS THE WHOLE POINT — THE LESSON IS ONE DAY OLD.
--    `20260831_deliveries_qb_invoice_id.sql` created its unique index WITH a predicate:
--        ... ON deliveries (business_id, qb_invoice_id) WHERE (qb_invoice_id IS NOT NULL)
--    Postgres infers a PARTIAL index for `ON CONFLICT` only when the clause REPEATS the
--    predicate, and PostgREST's `onConflict` is a bare column list that cannot express one.
--    The delivery ingest therefore failed on ALL 19 rows live with "there is no unique or
--    exclusion constraint matching the ON CONFLICT specification", and had to be corrected by
--    `20260831b`. This index is created the corrected way from the start.
--
-- ⚠️ NULLS ARE DISTINCT, WHICH IS WHY THE PREDICATE IS NOT NEEDED FOR CORRECTNESS EITHER.
--    A btree unique index treats NULLs as distinct by default (`NULLS DISTINCT` — the
--    Postgres default, and `NULLS NOT DISTINCT` is NOT used here). Every ordinary checkout
--    order that was never pushed carries `qb_invoice_id IS NULL`, so all of them coexist
--    under this index exactly as all the hand-entered deliveries do under theirs.
--
-- AC-1: no vertical noun — `qb_invoice_id` names the external system, not a nursery.
-- AC-2: this is an INDEX. It adds no policy and changes no RLS; `orders` keeps the policies
--       it already has, and nothing here widens who can read or write a row.
-- AC-3: the index is keyed on `business_id` FIRST, so uniqueness is per tenant. Two tenants
--       that each connect their own QuickBooks company can hold the same Intuit invoice id
--       without colliding — Intuit ids are unique within a realm, not across realms.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEFORE — run these two FIRST and read the answers. This migration will FAIL LOUDLY if the
-- data already violates uniqueness, which is the correct outcome: two orders against one
-- invoice is a defect to look at, not a state to index around.
--
--   (a) does the column exist, and is it text?
--       SELECT column_name, data_type, is_nullable FROM information_schema.columns
--        WHERE table_schema='public' AND table_name='orders' AND column_name='qb_invoice_id';
--       Expected: one row — qb_invoice_id, text, YES.
--       🔴 NO ROWS = STOP. The column is not there and this migration is not the fix.
--
--   (b) are there ALREADY duplicates? This must return ZERO rows.
--       SELECT business_id, qb_invoice_id, count(*)
--         FROM public.orders WHERE qb_invoice_id IS NOT NULL
--        GROUP BY business_id, qb_invoice_id HAVING count(*) > 1;
--       Expected: (0 rows). If it returns anything, do NOT run this — surface it first.
--
--   (c) the current index list, so the AFTER check has something to compare against:
--       SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='orders';
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Same shape as `20260831b`'s corrected delivery index: UNIQUE, two columns, NO predicate —
-- so `ON CONFLICT (business_id, qb_invoice_id)` can name it from PostgREST.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_orders_business_qb_invoice
  ON public.orders (business_id, qb_invoice_id);

COMMENT ON INDEX public.uidx_orders_business_qb_invoice IS
  'Idempotency key for the QuickBooks order ingest: one order per (business, Intuit invoice id). Created WITHOUT a predicate deliberately — a partial unique index is UNINFERABLE from PostgREST''s column-list onConflict, which is what broke the delivery ingest on 2026-08-31 (see 20260831b). NULLs are distinct, so every un-pushed checkout order coexists under it.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- AFTER — catalog-backed verification. Run all three; paste the output back.
--
--   (I) the index exists and has NO predicate:
--       SELECT indexdef FROM pg_indexes
--        WHERE schemaname='public' AND indexname='uidx_orders_business_qb_invoice';
--       Expected EXACTLY: "CREATE UNIQUE INDEX uidx_orders_business_qb_invoice ON
--         public.orders USING btree (business_id, qb_invoice_id)"
--       🔴 If the line ENDS IN "WHERE ..." the predicate came back and the ingest will fail
--          on every row — that is the 20260831 defect, reproduced.
--
--  (II) it is genuinely UNIQUE, read from the catalog rather than from the DDL text:
--       SELECT i.indisunique, i.indpred IS NULL AS no_predicate
--         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--        WHERE c.relname = 'uidx_orders_business_qb_invoice';
--       Expected: t | t
--
-- (III) nothing was lost — the pre-existing orders are all still there:
--       SELECT count(*) AS total,
--              count(*) FILTER (WHERE qb_invoice_id IS NOT NULL) AS with_invoice_id,
--              count(*) FILTER (WHERE order_kind = 'history')     AS history
--         FROM public.orders;
--       Expected before the ingest runs: history = 9 at LAWNS, with_invoice_id = 0 on them.
-- ═══════════════════════════════════════════════════════════════════════════════
