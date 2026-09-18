-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260917e — THE ROUTE ORDER IS SAVED, AND EVERY SURFACE READS THE SAME ONE · ledger #351
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ APPLIED 2026-09-18 BY DAVID, V-block clean — and re-read live by Thunder before the merge:
--      V1  route_position · routed_at · routed_by + index deliveries_route_order
--      V2  save_route_order → anon false · logged_in true
--      V3  stops with a saved position: 0 (nothing claims a plan before anyone routes)
--      V4  crew_day_read with a bad token → {"ok": false, "code": "invalid"}
--      live: crew_day_stops orders by route_position NULLS LAST; crew_day_read returns routed_at.
-- (was) CLEARED TO PASTE 2026-09-18 09:21 — `npm run verify` exit 0, zero net-new, 125/125 files ·
--    7,079 assertions; path `route.save` + guards `route.only-this-day-and-business` ·
--    `route.no-unplanned-claim` all driven against THIS file; mutants 30/30. The SQL statements are
--    unchanged since the 09:0x copy — only this banner changed.
--    Every statement is re-runnable (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE / IF NOT EXISTS).
-- ⏳ Apply on its own, then run the V-block at the foot and paste the output back.
--    It depends on `20260917c` (applied 2026-09-17) and on nothing unmerged.
--    ⚠️ NAMED `e`, NOT `d`: `20260917d_staff_may_add_a_phone_or_email.sql` is taken by the contacts
--    window and is already in David's folder. Checked across every remote branch before naming.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- David, 2026-09-17, on seeing the crew page say *"scheduled order, not a planned route"*:
--   *"Lauren's ROUTE THIS DAY optimisation is a feature she values and uses every delivery day. If
--   the driver follows the phone, he works against the order she planned and sent by text."*
-- The optimiser has always run in the browser and its result has never been written down: the list
-- on screen and the driver's text were derived from it and then discarded. So the phone could only
-- ever show the order the stops were CREATED in.
--
-- ── WHAT IT ADDS ────────────────────────────────────────────────────────────────────────────
--   deliveries.route_position   1..N within a day — the saved sequence. NULL = not in the plan.
--   deliveries.routed_at        when the day was routed (stamped on every stop in the plan).
--   deliveries.routed_by        who routed it.
--   save_route_order()          the ONE writer: checks `deliveries:update` server-side, refuses any
--                               id that is not that day's stop of that business, writes 1..N in the
--                               order given, stamps who and when, CLEARS the position of that day's
--                               stops left out of the plan, and writes one audit row.
--                               Re-routing REPLACES: same function, new order, new stamp.
--   crew_day_stops()            REPLACED — same projection, ordered by the saved sequence first.
--   crew_day_read()             REPLACED — returns `routed_at` for the day so the crew page can say
--                               "route order · planned 7:12 AM" or, when nothing is saved,
--                               "Not routed yet — follow the order in Lauren's text."
--
-- ── WHAT IT DOES NOT DO (and why) ───────────────────────────────────────────────────────────
--   · It does not save an UN-OPTIMISED list. David's ruling: never claim a plan that was not made.
--     The caller only saves an order the optimiser produced; a day where Directions could not run
--     stays "not routed" and says so.
--   · It does not touch the order, stock, or anything a customer sees.
--   · It does not decide the sequence. The sequence is Google's, as it is today on Lauren's screen;
--     this only writes down the answer she already gets.
-- ════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS route_position integer;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS routed_at      timestamptz;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS routed_by      uuid;

COMMENT ON COLUMN public.deliveries.route_position IS
  'The stop''s place in the saved route for its day, 1..N. NULL means it is not in the current plan — either the day was never routed, or this stop was not selected when it was. Written only by save_route_order (20260917e).';
COMMENT ON COLUMN public.deliveries.routed_at IS
  'When the day this stop belongs to was last routed. Every stop IN the plan carries the same stamp, so any one of them answers "when was this day planned?". Written only by save_route_order.';
COMMENT ON COLUMN public.deliveries.routed_by IS
  'Who pressed Route this day. Written only by save_route_order.';

-- One index for the one read: a day's stops in plan order.
CREATE INDEX IF NOT EXISTS deliveries_route_order
  ON public.deliveries (business_id, delivery_date, route_position);

-- ── THE WRITER ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_route_order(p_business_id uuid, p_service_date date, p_stop_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_role  text;
  v_now   timestamptz := now();
  v_n     int;
  v_valid int;
  v_clear int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)
     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',
      'message', 'You need permission to change deliveries to save a route.');
  END IF;
  IF p_service_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_date', 'message', 'A day is required.');
  END IF;

  v_n := coalesce(array_length(p_stop_ids, 1), 0);
  IF v_n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_save',
      'message', 'No stops were routed, so there is no order to save.');
  END IF;

  -- A list that names the same stop twice cannot be a sequence. Refuse rather than pick one.
  IF v_n <> (SELECT count(DISTINCT x) FROM unnest(p_stop_ids) x) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'duplicate_stop',
      'message', 'The same stop appears twice in that route.');
  END IF;

  -- EVERY id must be one of THIS business's stops on THIS day, and not cancelled. An id from
  -- another day, another tenant, or the legacy cart mode (an ORDER id) fails here, not silently.
  SELECT count(*) INTO v_valid
    FROM public.deliveries d
   WHERE d.id = ANY(p_stop_ids) AND d.business_id = p_business_id
     AND d.delivery_date = p_service_date AND coalesce(d.status, '') <> 'cancelled';
  IF v_valid <> v_n THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_on_this_day',
      'message', 'That route names ' || (v_n - v_valid)::text || ' stop(s) that are not on this day.');
  END IF;

  -- Write the sequence. `WITH ORDINALITY` is the order given — the optimiser's answer, unchanged.
  UPDATE public.deliveries d
     SET route_position = o.ord, routed_at = v_now, routed_by = v_uid
    FROM unnest(p_stop_ids) WITH ORDINALITY AS o(stop_id, ord)
   WHERE d.id = o.stop_id AND d.business_id = p_business_id AND d.delivery_date = p_service_date;

  -- RE-ROUTING REPLACES. A stop that was in the old plan and is not in this one loses its place —
  -- otherwise a dropped stop would keep a number and the phone would show a sequence with a hole.
  UPDATE public.deliveries d
     SET route_position = NULL, routed_at = NULL, routed_by = NULL
   WHERE d.business_id = p_business_id AND d.delivery_date = p_service_date
     AND NOT (d.id = ANY(p_stop_ids)) AND d.route_position IS NOT NULL;
  GET DIAGNOSTICS v_clear = ROW_COUNT;

  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, v_uid, v_role, 'route.saved', 'delivery_day', p_service_date::text,
          jsonb_build_object('stops', v_n, 'dropped_from_plan', v_clear, 'stop_ids', to_jsonb(p_stop_ids)), 'success');

  RETURN jsonb_build_object('ok', true, 'saved', v_n, 'dropped_from_plan', v_clear, 'routed_at', v_now);
END;
$$;

-- ── THE READS ───────────────────────────────────────────────────────────────────────────────
-- REPLACED, not edited in place: 20260917c is APPLIED and is never touched again (§6 r1). The only
-- change is the ORDER BY and the new `route_position` field; the projection is otherwise identical,
-- and it still carries no price, total or discount.
CREATE OR REPLACE FUNCTION public.crew_day_stops(p_business_id uuid, p_service_date date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public, extensions
AS $$
  SELECT coalesce(jsonb_agg(s.j ORDER BY s.route_position NULLS LAST, s.created_at, s.id), '[]'::jsonb)
  FROM (
    SELECT d.created_at, d.id, d.route_position, jsonb_build_object(
      'id', d.id,
      'route_position', d.route_position,
      'address_line1', d.address_line1, 'city', d.city, 'state', d.state, 'zip', d.zip,
      'customer_name', nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
      'customer_phone', c.phone,
      'instructions', d.notes,
      'service_type', d.service_type,
      'status', d.status,
      'started_at', d.started_at,
      'completed_at', d.completed_at,
      'completed_by_name', d.completed_by_name,
      'has_order', d.order_id IS NOT NULL,
      'lines', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'item', coalesce(nullif(bi.name, ''), nullif(oi.description, ''), nullif(oi.sku, ''), 'Item'),
                 'size', bi.size,
                 'quantity', oi.quantity) ORDER BY oi.id)
          FROM public.order_items oi
          LEFT JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id AND bi.business_id = d.business_id
         WHERE d.order_id IS NOT NULL AND oi.order_id = d.order_id), '[]'::jsonb),
      'notes', coalesce((
        SELECT jsonb_agg(jsonb_build_object('note', e.note, 'by', e.actor_name, 'at', e.occurred_at) ORDER BY e.occurred_at)
          FROM public.delivery_stop_events e
         WHERE e.delivery_id = d.id AND e.action = 'note'), '[]'::jsonb)
    ) AS j
    FROM public.deliveries d
    LEFT JOIN public.customers c ON c.id = d.customer_id AND c.business_id = d.business_id
    WHERE d.business_id = p_business_id
      AND d.delivery_date = p_service_date
      AND coalesce(d.status, '') <> 'cancelled'
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.crew_day_read(p_token text, p_client_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  r record;
BEGIN
  IF NOT public.crew_link_hit(p_client_key) THEN RETURN jsonb_build_object('ok', false, 'code', 'rate_limited'); END IF;
  SELECT * INTO r FROM public.crew_link_resolve(p_token);
  IF r.code IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', r.code); END IF;
  UPDATE public.crew_day_links SET last_used_at = now() WHERE id = (r.link).id;
  RETURN jsonb_build_object('ok', true,
    'business_name', (SELECT name FROM public.businesses WHERE id = (r.link).business_id),
    'service_date', (r.link).service_date,
    'expires_at', (r.link).expires_at,
    -- When the day was planned. NULL = never routed, and the page says so in plain words rather
    -- than presenting the creation order as if it were a plan.
    'routed_at', (SELECT max(d.routed_at) FROM public.deliveries d
                   WHERE d.business_id = (r.link).business_id AND d.delivery_date = (r.link).service_date
                     AND d.route_position IS NOT NULL),
    'stops', public.crew_day_stops((r.link).business_id, (r.link).service_date));
END;
$$;

REVOKE ALL ON FUNCTION public.save_route_order(uuid, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_route_order(uuid, date, uuid[]) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run after applying, paste the output back.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 the three columns and the index:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='deliveries'
--    AND column_name IN ('route_position','routed_at','routed_by') ORDER BY 1;
-- SELECT indexname FROM pg_indexes WHERE tablename='deliveries' AND indexname='deliveries_route_order';
--   expect: 3 rows, then 1 row
-- V2 who may call the writer (anon must be false):
-- SELECT has_function_privilege('anon','public.save_route_order(uuid,date,uuid[])','EXECUTE') AS anon,
--        has_function_privilege('authenticated','public.save_route_order(uuid,date,uuid[])','EXECUTE') AS logged_in;
--   expect: false · true
-- V3 nothing is routed yet, so nothing claims a plan (this must be 0 before Saturday):
-- SELECT count(*) AS stops_with_a_saved_position FROM public.deliveries WHERE route_position IS NOT NULL;
--   expect: 0
-- V4 the crew read still refuses a bad token, and now carries the day's routed_at key:
-- SELECT public.crew_day_read(repeat('0',64), 'v-block');
--   expect: {"ok": false, "code": "invalid"}
