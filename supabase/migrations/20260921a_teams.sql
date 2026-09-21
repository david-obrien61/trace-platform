-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260921a — TEAMS, PIECE 1: A TEAM LIST PER BUSINESS, AND A STOP THAT CARRIES ITS TEAM
--             ledger #362 · tech-debt #345
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ⏳ NOT APPLIED. Apply on its own, then run the V-block at the foot and paste the output back.
--    It depends on `20260917c` and `20260917e` (both applied) and on nothing unmerged.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- LAWNS runs Team 1, Team 2 and Team 3, and nothing in the platform can see them. Saturday
-- 2026-09-19 is the measured cost (tech-debt #345): one crew link showed all eight stops to
-- whoever opened it, one saved route was one path through the whole day, and the sheet totalled
-- the day rather than the truck. Lauren split the day by hand — and, because a route save replaces
-- the day's plan, routing Team 1's four stops wiped Team 2's order (Fri 13:18, and again 13:41).
--
-- ── DAVID'S RULINGS, BUILT HERE ─────────────────────────────────────────────────────────────
--   · A team list per business, editable by Lauren: name, members, active.
--   · 🔴 MEMBERS ARE NAMES, NOT LOGINS. `team_members` has no `user_id` and no invitation. A 1099
--     crew comes and goes; needing a login for each is exactly why the crew link has none.
--   · An OPTIONAL vendor link, because a team can be a contractor (Mauro). **The pay side is not
--     built**: `vendor_id` points at the vendor record and nothing here reads money.
--   · RETIRE, NEVER DELETE ([[R-133]]). `active = false` takes a team out of the pickers; a stop
--     that already carries it keeps reading it, and history stays true.
--
-- ── WHAT IT ADDS ────────────────────────────────────────────────────────────────────────────
--   teams              one row per team: name, active, sort_order, optional vendor_id.
--   team_members       the people on it, by NAME, with their own active flag.
--   deliveries.team_id which team takes this stop (nullable — "unassigned" is a real state and is
--                      what every stop is today).
--   save_team()        the ONE writer for a team and its member list (§6 r21 / [[R-159]]).
--   assign_stops_team() the ONE writer for a stop's team — all-or-nothing over a set of stops.
--
-- ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────
--   · It does not touch the route order. Piece 2 makes `route_position` per team; until then the
--     day still has ONE saved route and routing a subset still replaces it (#345, #348).
--   · It does not change the crew link, the load list or the schedule's grouping (pieces 3–5).
--   · It reads no money and writes no pay.
--   · It does not decide capacity. David's rule of 2026-09-22 (drive + planting time, a per-business
--     threshold, a per-business minutes-per-tree) is piece 2.5; the ground truth it will be tested
--     against is `docs/fixtures/2026-09-19-lawns-saturday-capacity.md`.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. TABLES ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  -- A team that IS a contractor points at its vendor record. NULL for an in-house crew.
  -- ON DELETE SET NULL: losing the vendor must never delete the team or orphan its stops.
  vendor_id   uuid        REFERENCES public.vendors(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Two LIVE teams cannot share a name (case- and space-insensitively); a RETIRED one may keep its
-- name, because the stops that carry it still read it.
CREATE UNIQUE INDEX IF NOT EXISTS teams_one_live_name_per_business
  ON public.teams (business_id, lower(btrim(name))) WHERE active;

CREATE TABLE IF NOT EXISTS public.team_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,          -- 🔴 a NAME. No user_id, no login, by David's ruling.
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_members_by_team ON public.team_members (team_id, sort_order);

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS deliveries_by_team_day ON public.deliveries (business_id, delivery_date, team_id);
COMMENT ON COLUMN public.deliveries.team_id IS
  'Which team takes this stop. NULL = not assigned, which is a real state and what every stop is before Lauren splits a day. Written only by assign_stops_team (20260921a).';

-- ── 2. RLS — read for the business, every write through the two functions ────────────────────
ALTER TABLE public.teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_member_select ON public.teams;
CREATE POLICY teams_member_select ON public.teams FOR SELECT
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:read'));
DROP POLICY IF EXISTS team_members_member_select ON public.team_members;
CREATE POLICY team_members_member_select ON public.team_members FOR SELECT
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:read'));

REVOKE ALL ON public.teams, public.team_members FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teams, public.team_members FROM authenticated;
GRANT SELECT ON public.teams, public.team_members TO authenticated;
GRANT ALL ON public.teams, public.team_members TO service_role;

-- ── 3. THE ONE WRITER FOR A TEAM AND ITS PEOPLE ─────────────────────────────────────────────
-- Creates or updates a team and REPLACES its member list in one call, so a half-saved team is not
-- a state that can exist. `p_team_id` NULL creates. Members arrive as an ordered array of names;
-- blanks are dropped, duplicates (same name, ignoring case and spaces) are refused rather than
-- silently merged — two people called "Mauro" on one team is a data question, not ours to settle.
CREATE OR REPLACE FUNCTION public.save_team(
  p_business_id uuid, p_team_id uuid, p_name text, p_active boolean,
  p_vendor_id uuid, p_member_names text[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_role   text;
  v_name   text := nullif(btrim(coalesce(p_name, '')), '');
  v_id     uuid;
  v_names  text[];
  v_n      int;
  v_active boolean := coalesce(p_active, true);
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)
     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',
      'message', 'You need permission to change deliveries to edit teams.');
  END IF;
  IF v_name IS NULL OR length(v_name) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_required', 'message', 'A team needs a name (up to 60 characters).');
  END IF;

  SELECT array_agg(x ORDER BY ord) INTO v_names
    FROM (SELECT btrim(n) x, ord FROM unnest(coalesce(p_member_names, '{}'::text[])) WITH ORDINALITY AS t(n, ord)
           WHERE nullif(btrim(n), '') IS NOT NULL) q;
  v_names := coalesce(v_names, '{}'::text[]);
  v_n := coalesce(array_length(v_names, 1), 0);
  IF v_n > 0 AND v_n <> (SELECT count(DISTINCT lower(x)) FROM unnest(v_names) x) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'duplicate_member',
      'message', 'That team lists the same person twice.');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_names) x WHERE length(x) > 60) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'member_name_too_long', 'message', 'A name is longer than 60 characters.');
  END IF;

  -- A vendor from another business is not this team's contractor.
  IF p_vendor_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND business_id = p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'vendor_not_found', 'message', 'That contractor is not on this business.');
  END IF;

  IF p_team_id IS NULL THEN
    BEGIN
      INSERT INTO public.teams (business_id, name, active, vendor_id,
                                sort_order)
      VALUES (p_business_id, v_name, v_active, p_vendor_id,
              coalesce((SELECT max(sort_order) + 1 FROM public.teams WHERE business_id = p_business_id), 0))
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'name_taken', 'message', 'There is already a team with that name.');
    END;
  ELSE
    SELECT id INTO v_id FROM public.teams WHERE id = p_team_id AND business_id = p_business_id;
    IF v_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'team_not_found', 'message', 'That team cannot be changed from here.');
    END IF;
    BEGIN
      UPDATE public.teams SET name = v_name, active = v_active, vendor_id = p_vendor_id, updated_at = now()
       WHERE id = v_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'name_taken', 'message', 'There is already a team with that name.');
    END;
  END IF;

  -- The member list is REPLACED. It is a list of names, not people with logins, so there is no
  -- identity to preserve across an edit and nothing to orphan.
  DELETE FROM public.team_members WHERE team_id = v_id;
  INSERT INTO public.team_members (team_id, business_id, name, sort_order)
  SELECT v_id, p_business_id, x, ord FROM unnest(v_names) WITH ORDINALITY AS t(x, ord);

  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, v_uid, v_role, CASE WHEN p_team_id IS NULL THEN 'team.created' ELSE 'team.updated' END,
          'team', v_id::text,
          jsonb_build_object('name', v_name, 'active', v_active, 'vendor_id', p_vendor_id,
                             'members', to_jsonb(v_names), 'member_count', v_n), 'success');

  RETURN jsonb_build_object('ok', true, 'team_id', v_id, 'name', v_name, 'active', v_active, 'members', v_n);
END;
$$;

-- ── 4. THE ONE WRITER FOR A STOP'S TEAM ─────────────────────────────────────────────────────
-- All-or-nothing over a set of stops: every id must be this business's stop, and the team must be
-- this business's and LIVE. `p_team_id` NULL unassigns (a real, reversible state).
CREATE OR REPLACE FUNCTION public.assign_stops_team(p_business_id uuid, p_stop_ids uuid[], p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_role  text;
  v_name  text;
  v_n     int;
  v_valid int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)
     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',
      'message', 'You need permission to change deliveries to set a team.');
  END IF;

  v_n := coalesce(array_length(p_stop_ids, 1), 0);
  IF v_n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_assign', 'message', 'No stops were chosen.');
  END IF;

  IF p_team_id IS NOT NULL THEN
    SELECT name INTO v_name FROM public.teams
     WHERE id = p_team_id AND business_id = p_business_id AND active;
    IF v_name IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'team_not_available',
        'message', 'That team is not on this business, or it has been retired.');
    END IF;
  END IF;

  SELECT count(*) INTO v_valid FROM public.deliveries
   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id AND coalesce(status, '') <> 'cancelled';
  IF v_valid <> v_n THEN
    RETURN jsonb_build_object('ok', false, 'code', 'stop_not_found',
      'message', 'That set names ' || (v_n - v_valid)::text || ' stop(s) that are not this business''s.');
  END IF;

  UPDATE public.deliveries SET team_id = p_team_id
   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id;

  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, v_uid, v_role, 'stop.team_assigned', 'team', coalesce(p_team_id::text, 'unassigned'),
          jsonb_build_object('stops', v_n, 'stop_ids', to_jsonb(p_stop_ids), 'team_name', v_name), 'success');

  RETURN jsonb_build_object('ok', true, 'assigned', v_n, 'team_id', p_team_id, 'team_name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.save_team(uuid, uuid, text, boolean, uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_stops_team(uuid, uuid[], uuid)              FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_team(uuid, uuid, text, boolean, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_stops_team(uuid, uuid[], uuid)              TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run after applying, paste the output back.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 tables, RLS and policies:
-- SELECT c.relname, c.relrowsecurity AS rls,
--        (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
--   FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
--    AND c.relname IN ('teams','team_members') ORDER BY 1;
--   expect: team_members t 1 · teams t 1
-- V2 the stop's column and the two indexes:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='deliveries' AND column_name='team_id';
-- SELECT indexname FROM pg_indexes WHERE schemaname='public'
--    AND indexname IN ('teams_one_live_name_per_business','deliveries_by_team_day','team_members_by_team') ORDER BY 1;
--   expect: 1 row, then 3 rows
-- V3 who may call the writers (anon must be false):
-- SELECT p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logged_in
--   FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
--    AND p.proname IN ('save_team','assign_stops_team') ORDER BY 1;
--   expect: both rows false · true
-- V4 nothing is assigned yet, and no team exists yet (this migration creates no data):
-- SELECT (SELECT count(*) FROM teams) AS teams,
--        (SELECT count(*) FROM team_members) AS members,
--        (SELECT count(*) FROM deliveries WHERE team_id IS NOT NULL) AS stops_with_a_team;
--   expect: 0 · 0 · 0
