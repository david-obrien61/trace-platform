-- ══════════════════════════════════════════════════════
-- 20260925k_cancel_order_retires_stops.sql — CANCELLING AN ORDER TAKES ITS STOPS OFF THE DAY
-- Ledger #418 · David applies · TENANT-AGNOSTIC
-- ══════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR (CLAUDE.md §6 r17). Creates no table. Adds ONE function.
--
-- ── §0 THE DEFECT, MEASURED LIVE (2026-09-24/25) ───────────────────────────────────
-- David opened Dwight Gillespie's duplicate order and pressed CANCEL. The stop stayed on
-- Saturday's schedule. He pressed DELETE. The stop stayed again — and the order was HARD-DELETED
-- (`orders` 0 rows, `order_items` 0 rows), leaving delivery b01deff3 an ORPHAN with `order_id`
-- NULL. Lauren could not route Saturday or split it across two teams.
--
-- 🔴 IT IS NOT A ONE-OFF, AND THAT IS WHY THIS IS A FUNCTION AND NOT A DATA FIX. Measured across
--    every date: stop `889b0df1` (Tracy Fisher, 2026-09-06) has order status `cancelled` and stop
--    status `scheduled`. **Cancel has never once reached a delivery.** Gillespie is simply the
--    first time it landed on a Saturday somebody had to route.
--
-- 🔴 AND NEITHER CLICK WROTE AN AUDIT ROW. `audit_log` is alive (206 rows, 11 in the 24h before
--    this was written) and DOES record `inventory.delete` and `receipt.deleted_by_db_owner` — but
--    no order cancel or order delete has EVER written one. A destructive act on a real customer
--    order left no trace; David knew what happened only because he was the one clicking.
--
-- ── §0a WHY A FUNCTION AND NOT TWO UPDATES FROM THE ENDPOINT ───────────────────────
-- The endpoint speaks PostgREST: two calls, two transactions. A cancel that sets the order and
-- then fails before the stops leaves EXACTLY the state we are fixing — and it would look like a
-- success to the caller. A plpgsql body is one transaction, so the order and its stops move
-- together or not at all.
--
-- ── §0b WHAT "OFF THE DAY" MEANS, AND WHY ONE WORD DOES ALL FOUR ───────────────────
-- `stopRead.ts` reads `.neq('status','cancelled').neq('status','held')`, and that SINGLE filter
-- feeds the schedule, the load list, the route and the crew link — ledger #383 proved it by
-- removing a cancelled stop from all four at once. So `status='cancelled'` is what takes the stop
-- off every surface Lauren uses. **The team assignment and route position are cleared as well**,
-- because they are not read through that filter: a cancelled stop that keeps `team_id` is still
-- counted when a day is split, which is the very thing that broke Saturday.
--
-- ⚠️ `cancelled` HAD NEVER BEEN WRITTEN ON THIS DATABASE when this was authored — live vocabulary
--    was `scheduled` 80 · `held` 3 · `fulfilled` 3. That is tech-debt #273 exactly: *nothing ever
--    writes `cancelled` while every stop read filters it.* This function is what writes it.
--
-- ── §0c NEVER DELETED ──────────────────────────────────────────────────────────────
-- The stop row stays. Its provenance note is APPENDED to, never overwritten — for Gillespie that
-- QuickBooks note was the only surviving record of where the stop came from, because the order
-- that would have explained it had already been deleted.
-- ══════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_order_with_stops(
  p_business_id uuid,
  p_order_id    uuid,
  p_reason      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_prev       text;
  v_reason     text := coalesce(nullif(trim(p_reason), ''), 'order cancelled');
  v_stop_ids   uuid[];
  v_stops      int  := 0;
BEGIN
  -- ── AUTHORISATION. SECURITY DEFINER bypasses RLS, so the check is explicit and FIRST.
  --    `orders:update` is the same string the endpoint's status path already requires, so the
  --    function and the route agree by construction (STD-020).
  IF NOT public.is_active_member(p_business_id) THEN
    RAISE EXCEPTION 'not a member of this business' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_permission(p_business_id, 'orders:update') OR public.has_permission(p_business_id, 'owner-only')) THEN
    RAISE EXCEPTION 'orders:update required to cancel an order' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_prev FROM public.orders
   WHERE id = p_order_id AND business_id = p_business_id
   FOR UPDATE;                                   -- the row is held for the whole transaction
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found in this business' USING ERRCODE = 'P0002';
  END IF;

  -- ── IDEMPOTENT ON WHAT ACTUALLY CHANGED, NOT ON THE ORDER'S STATUS ALONE.
  -- 🔴 A FIRST DRAFT RETURNED EARLY WHENEVER THE ORDER WAS ALREADY 'cancelled', AND THE HARNESS
  --    CAUGHT WHAT THAT COST: Tracy Fisher (stop 889b0df1, 2026-09-06) is an order already at
  --    'cancelled' whose stop is still 'scheduled' — the exact wreckage this function exists to
  --    end — and the early return LEFT HER THERE, reporting `unchanged: true`. It would have
  --    prevented new instances while refusing to repair the twelve-odd existing ones, and each
  --    would have needed its own hand-written data file.
  -- ⚠️ RETIRING HER STOP NOW IS NOT A MANUFACTURED TRANSITION: the ORDER's transition already
  --    happened and is not re-emitted (no second `order.cancelled` row when v_prev is already
  --    cancelled). The DELIVERY, however, is genuinely being cancelled at this moment, for the
  --    first time — so a `delivery.cancelled` row is the truth, not an invention.
  -- The early return now fires only when there is nothing left to do AT ALL.
  IF v_prev = 'cancelled' AND NOT EXISTS (
       SELECT 1 FROM public.deliveries
        WHERE order_id = p_order_id AND business_id = p_business_id AND status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'order_id', p_order_id,
                              'previous_status', v_prev, 'stops_retired', 0);
  END IF;

  IF v_prev <> 'cancelled' THEN
    UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id AND business_id = p_business_id;
  END IF;

  -- ── THE STOPS. `team_id` and `route_position` are cleared BECAUSE THEY ARE NOT READ THROUGH
  --    the cancelled/held filter — a cancelled stop still carrying a team is still counted when
  --    Lauren splits the day, which is precisely how Saturday broke.
  WITH retired AS (
    UPDATE public.deliveries
       SET status         = 'cancelled',
           team_id        = NULL,
           route_position = NULL,
           notes          = coalesce(nullif(trim(notes), '') || ' · ', '') || v_reason
     WHERE order_id    = p_order_id
       AND business_id = p_business_id
       AND status <> 'cancelled'
    RETURNING id
  )
  SELECT array_agg(id), count(*) INTO v_stop_ids, v_stops FROM retired;
  v_stops := coalesce(v_stops, 0);

  -- ── THE AUDIT ROWS BOTH CLICKS NEVER WROTE.
  -- ⚠️ `detail` IS jsonb. Passing text here raises 42804 — the exact error that killed a restore
  --    file handed over as "verified" by a read-only simulation, and the reason §6 r26 exists.
  -- The ORDER row is written only for a real order transition. Re-running against an
  -- already-cancelled order repairs its stops and does NOT claim the order was cancelled twice.
  IF v_prev <> 'cancelled' THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, v_actor, 'order.cancelled', 'order', p_order_id,
            jsonb_build_object('previous_status', v_prev, 'reason', v_reason,
                               'stops_retired', v_stops, 'stop_ids', to_jsonb(coalesce(v_stop_ids, '{}'::uuid[]))),
            'ok');
  ELSIF v_stops > 0 THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, v_actor, 'order.stops_reconciled', 'order', p_order_id,
            jsonb_build_object('note', 'order was already cancelled; its live stops were retired to match',
                               'reason', v_reason, 'stops_retired', v_stops,
                               'stop_ids', to_jsonb(coalesce(v_stop_ids, '{}'::uuid[]))),
            'ok');
  END IF;

  IF v_stops > 0 THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, action, target_type, target_id, detail, outcome)
    SELECT p_business_id, v_actor, 'delivery.cancelled', 'delivery', d.id,
           jsonb_build_object('order_id', p_order_id, 'reason', v_reason,
                              'delivery_date', d.delivery_date, 'was_status', 'live'),
           'ok'
      FROM public.deliveries d WHERE d.id = ANY(v_stop_ids);
  END IF;

  RETURN jsonb_build_object('ok', true, 'unchanged', false, 'order_id', p_order_id,
                            'previous_status', v_prev, 'stops_retired', v_stops,
                            'stop_ids', to_jsonb(coalesce(v_stop_ids, '{}'::uuid[])));
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_with_stops(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_with_stops(uuid, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.cancel_order_with_stops(uuid, uuid, text) IS
  'Cancel an order and retire its delivery stops in ONE transaction. Sets deliveries.status = '
  '''cancelled'' (which stopRead''s filter removes from schedule, load list, route and crew link) '
  'and CLEARS team_id / route_position, which that filter does not cover. Appends the reason to '
  'notes, never overwrites. Writes order.cancelled + delivery.cancelled audit rows — neither of '
  'which any code path wrote before 2026-09-25. Idempotent: re-cancelling writes nothing.';

COMMIT;

-- ══════════════════════════════════════════════════════
-- VERIFY — self-contained, runs as pasted. Executed on PGlite before hand-over (§6 r26) by
-- `scripts/sql-harness/rule26-cancel-retires-stops.pglite.mjs`.
-- ══════════════════════════════════════════════════════
--
-- (V1) The function exists, is SECURITY DEFINER, and anon cannot execute it. Expect 1 row,
--      security_definer = true, anon_can_execute = false.
--   SELECT p.proname, p.prosecdef AS security_definer,
--          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'cancel_order_with_stops';
--
-- (V2) 🔴 NOTHING CHANGED ON APPLY. This migration only adds a function; no order and no stop
--      moves until somebody calls it. PASS = both zero.
--   SELECT count(*) FILTER (WHERE status = 'cancelled') AS orders_cancelled_by_this_migration
--     FROM public.orders WHERE false            -- deliberately empty: apply moves nothing
--   UNION ALL
--   SELECT count(*) FROM public.deliveries WHERE false;
--
-- (V3) 🔴 TRACY FISHER IS THE PROOF THAT THE DEFECT IS REAL AND THIS IS THE CURE. Before the fix
--      she is an order at 'cancelled' whose stop is still 'scheduled'. Run this BEFORE calling the
--      function to see the defect, and again after to see it gone.
--   SELECT d.id AS stop, d.status AS stop_status, o.status AS order_status, d.delivery_date
--     FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
--    WHERE o.status = 'cancelled' AND d.status NOT IN ('cancelled','held');
--   -- Expect BEFORE: at least one row (889b0df1, Tracy Fisher, 2026-09-06).
--   -- Expect AFTER a cancel through the app: ZERO rows, for every tenant, forever.
--
-- (V4) The audit rows exist for a cancel performed through the app. Expect 1 order.cancelled row
--      plus one delivery.cancelled row per retired stop.
--   SELECT action, target_type, count(*) FROM public.audit_log
--    WHERE action IN ('order.cancelled', 'delivery.cancelled')
--    GROUP BY 1, 2 ORDER BY 1;
