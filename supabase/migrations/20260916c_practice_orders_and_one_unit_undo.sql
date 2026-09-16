-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916c — PRACTICE ORDERS CARRY THEIR RUN · THE IMPORT UNDO RUNS AS ONE UNIT · ledger #342
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, as `postgres`, in the SQL EDITOR (§6 r17).
--    ✏️ 2026-09-16: the cleanup this file used to follow was NOT applied (discovery 7c found zero seed
--    rows). Order now: 20260916a (the standalone test-mode ledger guard, ledger #344) → THIS FILE →
--    20260916e (the targeted LAWNS removal of test-mode ledger rows).
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────
-- §1  orders.import_run_id — nullable uuid, no default, no FK (there is no runs table; a run is
--     the set of rows carrying its id, exactly as on business_inventory and customers).
--     Stamped ONLY on a checkout order born in test mode (`submit.ts`, the 2026-09-09 ruling:
--     *"a test order carries a run id so it is removed like imported data"*). A captured order
--     never carries one; a live order never carries one.
-- §2  undo_import_run(business, run) — the per-run undo as ONE plpgsql transaction.
--
-- ── WHY §2 IS A FUNCTION AND NOT FOUR POSTGREST CALLS ───────────────────────────────────────
-- Each PostgREST statement is its own transaction. The undo it replaces issued the customer DELETE
-- first, then the inventory DELETE, and a lot with ledger history REFUSES the second (the ledger's
-- `inventory_id … ON DELETE SET NULL` is an UPDATE, and `trg_inventory_ledger_immutable` refuses
-- every UPDATE — 20260720_inventory_movement_ledger.sql:136-151, observed live). So the tenant was
-- left half-wiped: customers gone, catalogue still there (tech-debt #304). Ledger #337 fixed the
-- ORDERING with a read before the first write. This fixes the UNIT: every write below lands, or
-- none does — including on a failure nobody predicted (an FK on the live-only `orders` table that
-- no migration records, say). A refusal and a crash now leave the same state: untouched.
--
-- ── DAVID'S RULING ④, 2026-09-16 — REMOVABILITY IS DECIDED BY ORIGIN ────────────────────────
--   · captured orders, receipts, deliveries and assets are LIVE and are never removed;
--   · checkout orders created in test mode are PRACTICE and are removed WITH THEIR RUN.
-- So the function removes exactly: the run's practice orders (order_kind='test' AND this run id)
-- and their children, then the run's products, then the run's customers, then un-retires what
-- the run hid. It never touches captured orders, receipts, cost_objects, service_offerings or
-- business_pricing_config — and it REFUSES rather than orphan anything live.
--
-- ── THE PRE-FLIGHT — every count is taken before the first write; any non-zero refuses ──────
--   held_lots          run products with ANY ledger row — undeletable (above)
--   live_orders        orders on a run customer that are not this run's practice orders —
--                      captured (history), live checkout, and untagged test orders (e.g. the
--                      pre-#342 6a60a0ca) all count; `orders_customer_id_fkey` is RESTRICT
--   live_order_lines   lines of those same orders anchored to a run product (SET NULL would
--                      silently strip a live line's anchor)
--   live_deliveries    stops on a run customer that do not belong to a practice order (SET NULL
--                      would silently blank a live stop's customer)
--   other_references   EVERY OTHER foreign key into business_inventory or customers, READ FROM
--                      pg_constraint AT RUN TIME — customer_addresses (RESTRICT, 20260911b:78),
--                      inventory_counts, a vertical's plant records, production_plan_lines
--                      (RESTRICT) and anything added later or created outside the migrations.
--                      🔴 Derived, not listed: a hardcoded list is how a new FK slips past (#73),
--                      and naming a vertical's table here would be AC-1's #272 shape again.
-- ⚠️ receipts and cost_objects are not counted because they CANNOT reference a run row: neither
--   has an FK into either table (recon for ledger #342 §1f/§1i) — and if one is ever added, the
--   derived read above counts it without an edit here.
-- ⚠️ A run row that references ANOTHER row of the same run (a self-FK) is not a live reference;
--   both go together, so it is excluded rather than refusing every undo.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 ───────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS import_run_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_import_run
  ON public.orders (business_id, import_run_id) WHERE import_run_id IS NOT NULL;

COMMENT ON COLUMN public.orders.import_run_id IS
  'The QuickBooks import run a PRACTICE order belongs to. Set only on a checkout order born in test '
  'mode (order_kind = ''test''), from the run that made the live catalogue; the run''s undo removes '
  'it. NULL on every live checkout order and every captured (history) order — those are never '
  'removed by an undo. Ledger #342.';

-- ── §2 ───────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.undo_import_run(p_business_id uuid, p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_held          int;
  v_live_orders   int;
  v_live_lines    int;
  v_live_stops    int;
  v_other         jsonb := '{}'::jsonb;
  v_other_total   int := 0;
  v_n             int;
  r               record;
  v_p_orders      int;
  v_p_lines       int;
  v_p_stops       int;
  v_inventory     int;
  v_customers     int;
  v_unretired     int;
BEGIN
  IF p_business_id IS NULL OR p_run_id IS NULL THEN
    RAISE EXCEPTION 'undo_import_run requires a business and a run id';
  END IF;

  -- Serialise two undos of the same tenant (a double press, two tabs). Released at COMMIT.
  PERFORM pg_advisory_xact_lock(hashtext('undo_import_run:' || p_business_id::text));

  -- ── PRE-FLIGHT — reads only ─────────────────────────────────────────────────────────────
  SELECT count(DISTINCT bi.id) INTO v_held
    FROM public.business_inventory bi
    JOIN public.business_inventory_ledger l ON l.inventory_id = bi.id
   WHERE bi.business_id = p_business_id AND bi.import_run_id = p_run_id;

  SELECT count(*) INTO v_live_orders
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
   WHERE o.business_id = p_business_id
     AND c.business_id = p_business_id AND c.import_run_id = p_run_id
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

  SELECT count(*) INTO v_live_lines
    FROM public.order_items oi
    JOIN public.orders o             ON o.id = oi.order_id
    JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id
   WHERE o.business_id = p_business_id
     AND bi.business_id = p_business_id AND bi.import_run_id = p_run_id
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

  SELECT count(*) INTO v_live_stops
    FROM public.deliveries d
    JOIN public.customers c ON c.id = d.customer_id
   WHERE d.business_id = p_business_id
     AND c.business_id = p_business_id AND c.import_run_id = p_run_id
     AND NOT EXISTS (
       SELECT 1 FROM public.orders o
        WHERE o.id = d.order_id AND o.business_id = p_business_id
          AND o.order_kind = 'test' AND o.import_run_id = p_run_id);

  -- Every other single-column FK into the two parents, from the catalog.
  FOR r IN
    SELECT c.conrelid::regclass AS child, a.attname AS col, c.confrelid::regclass AS parent,
           (c.conrelid = c.confrelid) AS self_ref
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND array_length(c.conkey, 1) = 1
       AND c.confrelid IN ('public.business_inventory'::regclass, 'public.customers'::regclass)
       AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass, 'public.orders'::regclass,
                              'public.order_items'::regclass,         'public.deliveries'::regclass)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN %s p ON p.id = t.%I '
      'WHERE p.business_id = $1 AND p.import_run_id = $2 %s',
      r.child, r.parent, r.col,
      CASE WHEN r.self_ref THEN 'AND t.import_run_id IS DISTINCT FROM $2' ELSE '' END)
      INTO v_n USING p_business_id, p_run_id;
    IF v_n > 0 THEN
      v_other := v_other || jsonb_build_object(r.child::text || '.' || r.col, v_n);
      v_other_total := v_other_total + v_n;
    END IF;
  END LOOP;

  IF v_held + v_live_orders + v_live_lines + v_live_stops + v_other_total > 0 THEN
    -- 🔴 NOTHING HAS BEEN WRITTEN. The caller turns these counts into one sentence.
    RETURN jsonb_build_object(
      'refused', true,
      'held_lots', v_held, 'live_orders', v_live_orders, 'live_order_lines', v_live_lines,
      'live_deliveries', v_live_stops, 'other_references', v_other);
  END IF;

  -- ── WRITES — one transaction; any failure below rolls back every one of them ─────────────
  -- ① the run's PRACTICE orders and their children (the same children handleDelete removes,
  --   plus the delivery stop checkout scheduled for a delivery order — practice too).
  -- The practice set is re-derived in each statement (no temp table inside a SECURITY DEFINER
  -- function); `orders` is deleted LAST, so the set is identical in every statement.
  DELETE FROM public.order_compliance_records WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id);
  DELETE FROM public.order_service_selections WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id);
  WITH d AS (DELETE FROM public.order_items WHERE order_id IN (
               SELECT o.id FROM public.orders o
                WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_p_lines FROM d;
  WITH d AS (DELETE FROM public.deliveries
              WHERE business_id = p_business_id AND order_id IN (
                SELECT o.id FROM public.orders o
                 WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_p_stops FROM d;
  WITH d AS (DELETE FROM public.orders
              WHERE business_id = p_business_id AND order_kind = 'test' AND import_run_id = p_run_id
             RETURNING 1)
    SELECT count(*) INTO v_p_orders FROM d;

  -- ② products, ③ customers — products first: a practice line could only have anchored to them,
  --   and those lines are already gone.
  WITH d AS (DELETE FROM public.business_inventory
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_inventory FROM d;
  WITH d AS (DELETE FROM public.customers
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_customers FROM d;

  -- ④ un-retire — scoped on retired_by_run_id, never on a time window (20260906 header).
  WITH u AS (UPDATE public.business_inventory
                SET retired_at = NULL, retired_reason = NULL, retired_by_run_id = NULL
              WHERE business_id = p_business_id AND retired_by_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_unretired FROM u;

  RETURN jsonb_build_object(
    'refused', false,
    'practice_orders_deleted', v_p_orders, 'practice_lines_deleted', v_p_lines,
    'practice_deliveries_deleted', v_p_stops,
    'inventory_deleted', v_inventory, 'customers_deleted', v_customers, 'unretired', v_unretired);
END;
$$;

-- service_role ONLY. The function trusts its p_business_id; the caller (`api/qbo/router.ts`
-- books-undo / items-undo) resolves it from a validated owner session and checks both switches
-- and inventory:create + inventory:delete first. Granting to authenticated would let any signed-in
-- member delete another tenant's catalogue by passing its id (AC-3).
REVOKE ALL ON FUNCTION public.undo_import_run(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_import_run(uuid, uuid) TO service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (§9 schema gate — run after applying; catalog-backed)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 the column exists, nullable, and nothing was back-stamped:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='orders' AND column_name='import_run_id';
--   EXPECT 1 row: uuid, YES.
--   SELECT count(*) FROM public.orders WHERE import_run_id IS NOT NULL;
--   EXPECT 0 immediately after applying.
--
-- V2 the function exists once, is SECURITY DEFINER, and only service_role may run it:
--   SELECT p.proname, p.prosecdef, p.pronargs,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service
--     FROM pg_proc p WHERE p.proname = 'undo_import_run';
--   EXPECT 1 row: prosecdef=true, pronargs=2, authed=false, anon=false, service=true.
--
-- V3 on LAWNS today the undo REFUSES and WRITES NOTHING (run in a transaction you roll back):
--   BEGIN;
--   SELECT public.undo_import_run('ed2e5933-45dc-4b9b-a331-ddfd125e7a74',
--     (SELECT import_run_id FROM public.business_inventory
--       WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND import_run_id IS NOT NULL
--       ORDER BY created_at DESC LIMIT 1));
--   ROLLBACK;
--   EXPECT {"refused": true, ...} with held_lots >= 1 (the 6a60a0ca lot) — see the discovery file.
--
-- V4 the index:
--   SELECT indexname FROM pg_indexes WHERE tablename='orders' AND indexname='idx_orders_import_run';
--   EXPECT 1 row.
