-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260923b — TEAMS, PIECE 2: ONE SAVED ROUTE PER TEAM PER DAY, AND THE OPTIMISER'S OWN
--             MILES AND MINUTES KEPT AT SAVE TIME
--             ledger #362 · [[R-169]] (David, 2026-09-22) · tech-debt #345
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ⏳ NOT APPLIED. Apply 20260923a FIRST (the rename), then this. V-block at the foot.
--
-- ── WHY — AND IT IS ONE CLAUSE OF ONE FUNCTION ──────────────────────────────────────────────
-- Saturday 2026-09-19, LAWNS. Lauren routed Team 1's four stops and Team 2's saved order vanished;
-- she did it again at 13:41 and it vanished again. The cause is not subtle and it is not a race —
-- it is these four lines of `save_route_order` (20260917e), which are CORRECT for a day with one
-- route and catastrophic for a day with two:
--
--     UPDATE public.deliveries d SET route_position = NULL, routed_at = NULL, routed_by = NULL
--      WHERE d.business_id = p_business_id AND d.delivery_date = p_service_date
--        AND NOT (d.id = ANY(p_stop_ids)) AND d.route_position IS NOT NULL;
--
-- "Every stop on this DAY that is not in this list loses its place." Team 2's stops were on that
-- day and not in that list. The clear is now scoped to the TEAM being routed.
--
-- ── DAVID'S RULING, BUILT HERE ([[R-169]], 2026-09-22) ──────────────────────────────────────
--   ① Routing a set in which ANY stop has no team is REFUSED, and the refusal NAMES the stop:
--     *"assign it to a team first"*. 🔴 NEVER assign silently — guessing a team writes an
--     attribution nobody made, onto the one artefact the crew actually follows.
--   ② A set spanning two teams is REFUSED BY NAME. The route page carries the team it is routing.
--
-- ── WHAT IT ADDS ────────────────────────────────────────────────────────────────────────────
--   delivery_route_plans   one row per (business, day, team): when it was routed, by whom, how
--                          many stops, and 🔴 THE OPTIMISER'S OWN miles and minutes AS AT THE
--                          SAVE. They are a SNAPSHOT and are never recomputed — the estimate that
--                          was on screen when Lauren pressed the button is the one kept, which is
--                          the same rule piece 2.5's learning loop runs on.
--   save_route_order(6)    the writer, now team-aware.
--   save_route_order(3)    KEPT as a compatibility wrapper — see below.
--
-- 🔴 THE OLD THREE-ARGUMENT FUNCTION IS NOT DROPPED, AND THAT IS DELIBERATE. The deployed client
--    calls it. Dropping it would break routing for the window between this apply and the code
--    merge — [[R-161]]'s lesson in reverse. Instead it RESOLVES THE TEAM FROM THE STOPS: all one
--    team → route that team; none of them on a team → route the day exactly as today (the
--    single-crew business is unchanged); mixed → refused by name, which is ① and ② for free.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. THE PLAN ROW ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_route_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_date date        NOT NULL,
  -- NULL = the whole day, unsplit. That is a real plan, not a missing value: it is what a
  -- single-crew business has and what every day had before teams existed.
  team_id       uuid        REFERENCES public.delivery_teams(id) ON DELETE CASCADE,
  routed_at     timestamptz NOT NULL,
  routed_by     uuid,
  stops         integer     NOT NULL,
  -- 🔴 THE OPTIMISER'S ANSWER, KEPT. Nullable because the optimiser does not always report them,
  -- and an honest NULL beats a computed number nobody measured (D-9).
  miles         numeric(10,2),
  minutes       integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- One live plan per team per day — and a separate one for the unsplit day, because a NULL team_id
-- is not equal to itself in a unique index and the two cases need different predicates.
CREATE UNIQUE INDEX IF NOT EXISTS delivery_route_plans_one_per_team_day
  ON public.delivery_route_plans (business_id, delivery_date, team_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_route_plans_one_per_unsplit_day
  ON public.delivery_route_plans (business_id, delivery_date) WHERE team_id IS NULL;

ALTER TABLE public.delivery_route_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_route_plans_member_select ON public.delivery_route_plans;
CREATE POLICY delivery_route_plans_member_select ON public.delivery_route_plans FOR SELECT
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:read'));

REVOKE ALL ON public.delivery_route_plans FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.delivery_route_plans FROM authenticated;
GRANT SELECT ON public.delivery_route_plans TO authenticated;
GRANT ALL ON public.delivery_route_plans TO service_role;

-- ── 2. THE WRITER, TEAM-AWARE ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_route_order(
  p_business_id uuid, p_service_date date, p_stop_ids uuid[],
  p_team_id uuid, p_miles numeric, p_minutes integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_now       timestamptz := now();
  v_n         int;
  v_valid     int;
  v_clear     int;
  v_teamless  text;
  v_teams     text;
  v_team_name text;
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
  IF v_n <> (SELECT count(DISTINCT x) FROM unnest(p_stop_ids) x) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'duplicate_stop',
      'message', 'The same stop appears twice in that route.');
  END IF;

  SELECT count(*) INTO v_valid
    FROM public.deliveries d
   WHERE d.id = ANY(p_stop_ids) AND d.business_id = p_business_id
     AND d.delivery_date = p_service_date AND coalesce(d.status, '') <> 'cancelled';
  IF v_valid <> v_n THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_on_this_day',
      'message', 'That route names ' || (v_n - v_valid)::text || ' stop(s) that are not on this day.');
  END IF;

  -- ── [[R-169]] ⓪ A SPLIT DAY MUST BE ROUTED BY TEAM ────────────────────────────────────────
  -- 🔴 FOUND BY THE MUTATION RUN, NOT BY REVIEW (ledger #362). The first draft let a NULL team
  -- route the "unsplit day" unconditionally — so a set whose stops DO belong to teams was written
  -- across both crews, with the clear scoped to `team_id IS NULL` and therefore touching nothing.
  -- That is Saturday's shape through a different door. A day that has been split is routed BY TEAM
  -- or not at all; the unsplit day stays available for the business that has never split one.
  IF p_team_id IS NULL THEN
    SELECT string_agg(DISTINCT t.name, ', ' ORDER BY t.name) INTO v_teams
      FROM public.deliveries d
      JOIN public.delivery_teams t ON t.id = d.team_id
     WHERE d.id = ANY(p_stop_ids) AND d.team_id IS NOT NULL;
    IF v_teams IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'team_required', 'teams', v_teams,
        'message', 'These stops belong to ' || v_teams || '. Route one team at a time.');
    END IF;
  END IF;

  -- ── [[R-169]] ① A STOP WITH NO TEAM STOPS THE ROUTE, AND IT IS NAMED ──────────────────────
  IF p_team_id IS NOT NULL THEN
    SELECT string_agg(label, ', ' ORDER BY label) INTO v_teamless FROM (
      SELECT coalesce(nullif(btrim(c.first_name || ' ' || c.last_name), ''), d.address_line1, 'a stop') AS label
        FROM public.deliveries d
        LEFT JOIN public.customers c ON c.id = d.customer_id
       WHERE d.id = ANY(p_stop_ids) AND d.team_id IS NULL) q;
    IF v_teamless IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'stop_without_team', 'stops', v_teamless,
        'message', v_teamless || ' has no team — assign it to a team first.');
    END IF;

    -- ── ② A SET SPANNING TWO TEAMS IS REFUSED BY NAME ───────────────────────────────────────
    SELECT string_agg(DISTINCT t.name, ', ' ORDER BY t.name) INTO v_teams
      FROM public.deliveries d
      JOIN public.delivery_teams t ON t.id = d.team_id
     WHERE d.id = ANY(p_stop_ids) AND d.team_id <> p_team_id;
    IF v_teams IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'mixed_teams', 'teams', v_teams,
        'message', 'That set also contains stops for ' || v_teams || '. Route one team at a time.');
    END IF;

    SELECT name INTO v_team_name FROM public.delivery_teams
     WHERE id = p_team_id AND business_id = p_business_id;
    IF v_team_name IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'team_not_available',
        'message', 'That team is not on this business.');
    END IF;
  END IF;

  -- Write the sequence. WITH ORDINALITY is the order given — the optimiser's answer, unchanged.
  UPDATE public.deliveries d
     SET route_position = o.ord, routed_at = v_now, routed_by = v_uid
    FROM unnest(p_stop_ids) WITH ORDINALITY AS o(stop_id, ord)
   WHERE d.id = o.stop_id AND d.business_id = p_business_id AND d.delivery_date = p_service_date;

  -- 🔴 THE SATURDAY FIX. Re-routing still REPLACES — a dropped stop must lose its number or the
  -- phone shows a sequence with a hole — but only WITHIN THE TEAM BEING ROUTED. Routing Team 1
  -- no longer touches a single stop of Team 2's.
  UPDATE public.deliveries d
     SET route_position = NULL, routed_at = NULL, routed_by = NULL
   WHERE d.business_id = p_business_id AND d.delivery_date = p_service_date
     AND NOT (d.id = ANY(p_stop_ids)) AND d.route_position IS NOT NULL
     AND d.team_id IS NOT DISTINCT FROM p_team_id;
  GET DIAGNOSTICS v_clear = ROW_COUNT;

  -- The plan row: one per team per day, replaced on a re-route.
  DELETE FROM public.delivery_route_plans
   WHERE business_id = p_business_id AND delivery_date = p_service_date
     AND team_id IS NOT DISTINCT FROM p_team_id;
  INSERT INTO public.delivery_route_plans
         (business_id, delivery_date, team_id, routed_at, routed_by, stops, miles, minutes)
  VALUES (p_business_id, p_service_date, p_team_id, v_now, v_uid, v_n, p_miles, p_minutes);

  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, v_uid, v_role, 'route.saved', 'delivery_day', p_service_date::text,
          jsonb_build_object('stops', v_n, 'dropped_from_plan', v_clear, 'stop_ids', to_jsonb(p_stop_ids),
                             'team_id', p_team_id, 'team_name', v_team_name,
                             'miles', p_miles, 'minutes', p_minutes), 'success');

  RETURN jsonb_build_object('ok', true, 'saved', v_n, 'dropped_from_plan', v_clear, 'routed_at', v_now,
                            'team_id', p_team_id, 'team_name', v_team_name,
                            'miles', p_miles, 'minutes', p_minutes);
END;
$$;

-- ── 3. THE COMPATIBILITY WRAPPER — the deployed client still calls this ─────────────────────
-- It resolves the team FROM THE STOPS rather than guessing one, so the ruling holds even for a
-- caller that knows nothing about teams.
CREATE OR REPLACE FUNCTION public.save_route_order(
  p_business_id uuid, p_service_date date, p_stop_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_team uuid;
BEGIN
  -- ✏️ TWICE SIMPLIFIED, BOTH TIMES BY THE MUTATION RUN RATHER THAN BY REVIEW (ledger #362).
  -- Draft 1 had a branch for "all on ONE team" that did what the fallback already did. Draft 2
  -- kept a branch for "nothing on a team", and that was redundant too: with no teamed stop the
  -- SELECT below simply returns NULL, which is exactly the unsplit-day call. Both mutants
  -- SURVIVED by being EQUIVALENT — the code had two ways to say one thing, so breaking one said
  -- nothing. What is left is the whole rule: find a team among these stops, and hand the set to
  -- the six-argument function, which owns every refusal.
  SELECT team_id INTO v_team FROM public.deliveries
   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id AND team_id IS NOT NULL
   ORDER BY team_id LIMIT 1;   -- deterministic: "whichever row comes first" is not a rule
  RETURN public.save_route_order(p_business_id, p_service_date, p_stop_ids, v_team, NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.save_route_order(uuid, date, uuid[], uuid, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_route_order(uuid, date, uuid[], uuid, numeric, integer) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run AFTER the migration and paste the four results back. Reads the catalogue.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- V1 · the plan table exists, RLS is on with one policy, and both unique indexes are there.
--      ⚠️ EXPECT `unique_indexes = 3`, not 2 — the count includes the PRIMARY KEY. The two that
--      matter are the partial ones: a NULL team_id is not equal to itself, so the unsplit day
--      needs its own predicate or a day could quietly collect two "whole day" plans.
--      EXPECT: rls = true · policies = 1 · unique_indexes = 3.
SELECT 'V1' v, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
       (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid AND i.indisunique) AS unique_indexes
  FROM pg_class c WHERE c.oid = 'public.delivery_route_plans'::regclass;

-- V2 · BOTH signatures are present. The three-argument one must still exist: the deployed page
--      calls it, and dropping it would break routing between this apply and the code merge.
SELECT 'V2' v, p.oid::regprocedure::text AS signature,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logged_in
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'save_route_order'
 ORDER BY 2;

-- V3 · 🔴 THE SATURDAY CLAUSE IS SCOPED TO THE TEAM. This is the whole point of the migration:
--      the clear must carry `team_id IS NOT DISTINCT FROM`. If this reads false, routing one team
--      still wipes the other and nothing else in this file matters.
SELECT 'V3' v,
       pg_get_functiondef(p.oid) LIKE '%d.team_id IS NOT DISTINCT FROM p_team_id%' AS clear_is_team_scoped,
       pg_get_functiondef(p.oid) LIKE '%stop_without_team%'                        AS refuses_teamless_stop,
       pg_get_functiondef(p.oid) LIKE '%mixed_teams%'                              AS refuses_mixed_teams
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'save_route_order'
   AND pg_get_function_identity_arguments(p.oid) LIKE '%numeric%';

-- V4 · nothing was created by this file (it writes no data), and no existing plan was invented.
SELECT 'V4' v,
       (SELECT count(*) FROM public.delivery_route_plans)                     AS plans,
       (SELECT count(*) FROM public.deliveries WHERE route_position IS NOT NULL) AS stops_in_a_saved_route,
       (SELECT count(*) FROM public.deliveries WHERE route_position IS NOT NULL AND team_id IS NULL) AS routed_but_teamless;
