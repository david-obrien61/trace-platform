-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260923a — RENAME: teams → delivery_teams, so the name cannot collide with Ignition's own
--             ledger #362 · [[R-168]] (David, 2026-09-21)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ⏳ NOT APPLIED. Apply this FIRST, then 20260923b. Run the V-block at the foot and paste it back.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- Ignition has its OWN `teams` table — keyed `shop_id`, on the old project ufsgqckbxdtwviqjjtos,
-- frozen donor code and off limits (CLAUDE.md §7). The two databases cannot reach each other, so
-- NOTHING IS BROKEN TODAY. What breaks is every check that matches a BARE table name: the writer
-- registry had to carry a declaration for an Ignition file it will never write, and the next such
-- check will need one too. David, 2026-09-21: *"RENAME — but tomorrow, not today. Choose the name
-- yourself; it is bookkeeping."*
--
-- ⚠️ SAID AND LIFTED THE SAME DAY. The quote above was said on the MORNING of 2026-09-21, when
--    HISTORY's import held David's time. He lifted the hold that AFTERNOON, once the import
--    finished, and applied this migration the same day. So "tomorrow, not today" sitting beside
--    an APPLIED date of 2026-09-21 is the real sequence, not a stale date — recorded here so the
--    next reader does not "correct" it. The FILENAME keeps its 20260923a stamp deliberately.
--
-- 🔴 IT IS CHEAP EXACTLY NOW AND NOT LATER. Measured before writing: zero rows on every tenant,
--    one client file, one editor, one picker. A rename after Lauren has built her crew list is a
--    data migration; today it is four ALTERs.
--
-- ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────
--   · `deliveries.team_id` KEEPS ITS NAME. On a table called `deliveries` it is unambiguous, and
--     renaming a column means touching every read — cost with no benefit.
--   · No behaviour changes. Same rules, same permissions, same refusal codes.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. THE TABLES ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.teams        RENAME TO delivery_teams;
ALTER TABLE public.team_members RENAME TO delivery_team_members;

-- ── 2. THE INDEXES AND CONSTRAINTS ──────────────────────────────────────────────────────────
-- A rename carries indexes and foreign keys with the table but KEEPS THEIR OLD NAMES, so without
-- this the catalogue would read `teams_one_live_name_per_business` on a table called
-- `delivery_teams` — the same confusion one layer down.
ALTER INDEX  public.teams_one_live_name_per_business RENAME TO delivery_teams_one_live_name_per_business;
ALTER INDEX  public.team_members_by_team             RENAME TO delivery_team_members_by_team;

-- ── 3. THE POLICIES ─────────────────────────────────────────────────────────────────────────
ALTER POLICY teams_member_select        ON public.delivery_teams        RENAME TO delivery_teams_member_select;
ALTER POLICY team_members_member_select ON public.delivery_team_members RENAME TO delivery_team_members_member_select;

-- ── 4. THE TWO WRITERS ──────────────────────────────────────────────────────────────────────
-- A SECURITY DEFINER function stores its body as TEXT, so the old names inside it do NOT follow
-- the rename: `save_team` would still say `public.teams` and would fail at run time. Both are
-- recreated here with the new names and NO other change — same rules, same codes, same messages.
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

  IF p_vendor_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND business_id = p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'vendor_not_found', 'message', 'That contractor is not on this business.');
  END IF;

  IF p_team_id IS NULL THEN
    BEGIN
      INSERT INTO public.delivery_teams (business_id, name, active, vendor_id, sort_order)
      VALUES (p_business_id, v_name, v_active, p_vendor_id,
              coalesce((SELECT max(sort_order) + 1 FROM public.delivery_teams WHERE business_id = p_business_id), 0))
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'name_taken', 'message', 'There is already a team with that name.');
    END;
  ELSE
    SELECT id INTO v_id FROM public.delivery_teams WHERE id = p_team_id AND business_id = p_business_id;
    IF v_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'team_not_found', 'message', 'That team cannot be changed from here.');
    END IF;
    BEGIN
      UPDATE public.delivery_teams SET name = v_name, active = v_active, vendor_id = p_vendor_id, updated_at = now()
       WHERE id = v_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'name_taken', 'message', 'There is already a team with that name.');
    END;
  END IF;

  DELETE FROM public.delivery_team_members WHERE team_id = v_id;
  INSERT INTO public.delivery_team_members (team_id, business_id, name, sort_order)
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
    SELECT name INTO v_name FROM public.delivery_teams
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

COMMENT ON COLUMN public.deliveries.team_id IS
  'Which team takes this stop. NULL = not assigned, which is a real state and what every stop is before Lauren splits a day. Written only by assign_stops_team. Points at delivery_teams (renamed from teams, 20260923a, [[R-168]]).';

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run this AFTER the migration and paste the four results back.
-- It reads the CATALOGUE, never a label: the whole point is that a rename is invisible in code.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- V1 · the new names exist and the OLD ones are gone. Both directions, because a rename that
--      left a copy behind would read as success on the first half alone.
--      EXPECT one row, all four columns TRUE.
SELECT 'V1' v,
       to_regclass('public.delivery_teams')        IS NOT NULL AS delivery_teams_exists,
       to_regclass('public.delivery_team_members') IS NOT NULL AS delivery_team_members_exists,
       to_regclass('public.teams')                 IS NULL     AS old_teams_gone,
       to_regclass('public.team_members')          IS NULL     AS old_team_members_gone;

-- V2 · RLS is still on, still ONE policy each, and the policies carry the new names.
SELECT 'V2' v, c.relname AS table_name, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
       (SELECT string_agg(p.polname, ', ') FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_names
  FROM pg_class c
 WHERE c.oid IN ('public.delivery_teams'::regclass, 'public.delivery_team_members'::regclass)
 ORDER BY 2;

-- V3 · both writers still refuse anon and admit a logged-in member, and — the part that matters —
--      they RUN against the new tables. A function body is stored as TEXT, so a rename does not
--      follow it; this proves the recreate landed rather than assuming it.
SELECT 'V3' v, p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logged_in,
       pg_get_functiondef(p.oid) LIKE '%public.delivery_teams%'  AS body_uses_new_name,
       pg_get_functiondef(p.oid) LIKE '%public.teams %'          AS body_still_uses_old_name
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('save_team', 'assign_stops_team')
 ORDER BY 2;

-- V4 · the foreign key on deliveries.team_id followed the rename and now points at delivery_teams,
--      and no stop lost its team.
--      EXPECT: team_id_points_at = delivery_teams · teams = 0 · members = 0 · stops_with_a_team = 0.
--      (Zeros are the CORRECT answer today — nobody has built a crew list yet.)
SELECT 'V4' v,
       (SELECT confrelid::regclass::text FROM pg_constraint
         WHERE conrelid = 'public.deliveries'::regclass AND contype = 'f'
           AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                                WHERE attrelid = 'public.deliveries'::regclass AND attname = 'team_id')]
       ) AS team_id_points_at,
       (SELECT count(*) FROM public.delivery_teams)          AS teams,
       (SELECT count(*) FROM public.delivery_team_members)   AS members,
       (SELECT count(*) FROM public.deliveries WHERE team_id IS NOT NULL) AS stops_with_a_team;
