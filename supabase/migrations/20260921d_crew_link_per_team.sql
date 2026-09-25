-- ############################################################################################
-- 🛑 PARKED — DO NOT APPLY THIS MIGRATION. David's instruction, 2026-09-21.
--
-- It is NOT broken as far as anything has measured — its own V-blocks pass in PGlite against the
-- real chain — but the crew PATH TESTS go red with it in the chain, and the cause is NOT FOUND.
-- Applying it while that is unexplained would put a change on the live database whose effect on
-- the crew endpoint nobody can account for, on the one surface a driver uses alone in a yard.
--
-- ⚠️ THE RED IS NOT LIMITED TO THE NEW TESTS. Four pre-existing, previously green guards —
--    `crew.expired`, `crew.revoked`, `crew.other-day`, `crew.other-business` — fail the same way
--    once this file is in the chain. That is why this is parked rather than shipped with a known
--    gap: the blast radius is the whole crew door, not the new feature.
--
-- The full record of what was ruled out, and how, is in:
--     docs/recon/2026-09-21-crew-link-per-team-parked.md
-- Read that BEFORE resuming — it exists so the next session does not repeat four dead ends.
-- ############################################################################################

-- ============================================================================================
-- 20260921d — A CREW LINK BELONGS TO A TEAM, AND SHOWS ONLY THAT TEAM'S STOPS
--             ledger #374 · teams piece 3 · tech-debt #345
--
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
-- ⚠️ HELD: nothing merges or applies until David reviews on Test Dave's after Lauren's 08:00 start.
--
-- WHY. Saturday 2026-09-19 (tech-debt #345): ONE crew link showed ALL EIGHT stops to whoever opened
-- it. Team 1's driver saw Team 2's work and vice versa. Piece 1 gave a stop its team; this makes the
-- LINK carry a team too, so each crew's phone shows its own day and nothing else.
--
-- 🔴 THE SECURITY HALF IS THE POINT, NOT THE DISPLAY HALF. Filtering `crew_day_read` alone would
--    hide another team's stops while leaving `crew_stop_act` willing to START or FINISH one for
--    anybody holding any of the day's tokens — the stop id is in the request, not the token. A
--    filter that only hides is a UI preference; this migration REFUSES the write as well (V6).
--
-- ⚠️ A WHOLE-DAY LINK IS STILL LEGITIMATE and is what every existing link is: `team_id IS NULL`
--    means "the whole day", exactly as before. A nursery that never splits a day is untouched — it
--    keeps issuing one link and seeing every stop (V7).
-- ============================================================================================

-- ── 1. the column ───────────────────────────────────────────────────────────────────────────
-- ON DELETE CASCADE, deliberately, and NOT `SET NULL`. `SET NULL` would silently promote a deleted
-- team's link into a WHOLE-DAY link — a token handed to one crew quietly gaining the whole day is
-- the opposite of what this migration is for. Teams are RETIRED, never deleted ([[R-133]]), so this
-- path should never run; if it ever does, the link disappearing is the safe direction.
ALTER TABLE public.crew_day_links
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.delivery_teams(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.crew_day_links.team_id IS
  'Which team this link is for. NULL = the whole day, which is what every link was before 20260921d.';

-- ── 2. one live link per team per day ───────────────────────────────────────────────────────
-- The old index was (business_id, service_date) WHERE revoked_at IS NULL — one live link per day,
-- which is exactly what has to change. 🔴 `COALESCE` IS REQUIRED AND IS NOT DECORATION: in Postgres
-- two NULLs are not equal for uniqueness, so an index on (business_id, service_date, team_id) would
-- let a business hold UNLIMITED live whole-day links, silently losing the one-live-link rule for the
-- exact case that is most common today. The sentinel uuid gives NULL a single slot of its own.
DROP INDEX IF EXISTS crew_day_links_one_live_per_day;
DROP INDEX IF EXISTS public.crew_day_links_live_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS crew_day_links_one_live_per_day_team
  ON public.crew_day_links (business_id, service_date, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL;

-- ── 3. the read: a link's stops are its team's stops ────────────────────────────────────────
-- 🔴 REBUILT FROM THE LIVE BODY, NOT RE-TYPED (2026-09-24, ledger #405's successor).
-- The first version of this statement was typed from memory and SILENTLY REVERTED ledger #351:
-- it dropped `ORDER BY s.route_position NULLS LAST` and the `'route_position'` key, so every crew
-- link would have stopped showing the SAVED route order and started showing creation order, with
-- the page reading "Not the planned route — follow the order in Lauren's text."
-- That is this branch's own recorded defect B at a second address — the recon wrote the lesson
-- about `create_crew_day_link` and the same defect was sitting here, masked by a harness artifact.
-- This body is `pg_get_functiondef`'s output from the LIVE database, with exactly two edits:
-- the new defaulted `p_team_id`, and the one `AND (p_team_id IS NULL OR d.team_id = p_team_id)`.
CREATE OR REPLACE FUNCTION public.crew_day_stops(p_business_id uuid, p_service_date date, p_team_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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
      -- ── THE ONLY BEHAVIOURAL ADDITION TO THIS FUNCTION ──
      -- NULL = the whole day, byte-for-byte the behaviour that is deployed today. A TEAM link sees
      -- ONLY that team's stops; a stop with NO team is NOT swept into a team's link, because nobody
      -- has said it is that team's work. It shows on no crew link and is flagged to Lauren instead.
      AND (p_team_id IS NULL OR d.team_id = p_team_id)
  ) s;
$$;

-- 🔴 ALSO REBUILT FROM THE LIVE BODY — AND IT HAD LOST `routed_at`, ONE FIELD OVER FROM THE ONE
-- THIS FILE'S OWN COMMENT WARNED ABOUT. The first draft's note said `expires_at` must not be
-- dropped because a re-type had silently lost it; that same re-type ALSO lost `routed_at`, which is
-- what tells the crew's phone the day was planned. Caught by the path test, not by review.
CREATE OR REPLACE FUNCTION public.crew_day_read(p_token text, p_client_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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
                     AND d.route_position IS NOT NULL
                     -- 🔴 SCOPED TO THIS TEAM. Without this a CREW 2 link would report the day as
                     -- planned because CREW 1's stops were routed — `save_route_order` is per team
                     -- ([[R-169]]), so "is this day planned" is per team too, or the phone lies.
                     AND (r.link).team_id IS NOT DISTINCT FROM d.team_id),
    -- The crew's phone says WHOSE day it is showing, so a driver who opens the wrong link can tell.
    -- A whole-day link reports no team, which is what it is — never a guess at one.
    'team_id', (r.link).team_id,
    'team_name', (SELECT t.name FROM public.delivery_teams t WHERE t.id = (r.link).team_id),
    'stops', public.crew_day_stops((r.link).business_id, (r.link).service_date, (r.link).team_id));
END;
$$;

-- ── 4. making a link for a team ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_crew_day_link(
  p_business_id uuid, p_service_date date, p_time_zone text, p_team_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
-- 🔴 THIS IS 20260917c's BODY WITH THE TEAM ADDED — NOT A REWRITE. A first draft of this file
--    re-typed the function from memory and silently lost SIX things: the `is_active_member` check,
--    the time-zone validation, `revoked_by`, the actor's role on every audit row, the audit row
--    written per REVOKED link, and the real refusal codes (`not_permitted` / `bad_date` /
--    `bad_time_zone` / `past_day`, which the client and its tests match on). It also invented
--    `audit_log(user_id, entity, entity_id, changes, result)`; the real columns are
--    `actor_user_id, actor_role, target_type, target_id, detail, outcome`. Caught by RUNNING the
--    path tests, which failed with `column "user_id" of relation "audit_log" does not exist`.
--    ⚠️ The lesson is the one HISTORY sent about `undo_import_run` on the same day: when you
--    CREATE OR REPLACE a function, start from the body that is live, or you revert what is in it.
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_token    text;
  v_expires  timestamptz;
  v_id       uuid;
  v_prev     uuid;
  v_revoked  int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)
     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',
      'message', 'You need permission to change deliveries to make a crew link.');
  END IF;
  IF p_service_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_date', 'message', 'A day is required.');
  END IF;
  IF p_time_zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_time_zone', 'message', 'This device did not give a time zone we recognise.');
  END IF;
  IF p_service_date < (now() AT TIME ZONE p_time_zone)::date THEN
    RETURN jsonb_build_object('ok', false, 'code', 'past_day', 'message', 'That day has already passed.');
  END IF;
  -- 🔴 NEW, AND THE ONLY NEW REFUSAL: a link may only name a team of THIS business. Without it a
  -- caller could mint a link against another tenant's team id; the read would then filter on a team
  -- this business does not own and hand back an EMPTY day, which reads as "nothing to do" rather
  -- than as a refusal (AC-3).
  IF p_team_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.delivery_teams t WHERE t.id = p_team_id AND t.business_id = p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'team_not_available',
      'message', 'That team is not one of this business''s teams.');
  END IF;

  v_expires := ((p_service_date + 1)::timestamp + time '06:00') AT TIME ZONE p_time_zone;
  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;

  -- Reissue: THIS TEAM's live link stops working the moment the new one exists. 🔴 `IS NOT DISTINCT
  -- FROM` is required rather than `=`, because the whole-day link has team_id NULL and `NULL = NULL`
  -- is NULL, not true — with `=` a reissued whole-day link would revoke nothing and the old token
  -- would keep working beside the new one. Another team's link is untouched either way.
  FOR v_prev IN
    UPDATE public.crew_day_links SET revoked_at = now(), revoked_by = v_uid
     WHERE business_id = p_business_id AND service_date = p_service_date AND revoked_at IS NULL
       AND team_id IS NOT DISTINCT FROM p_team_id
    RETURNING id
  LOOP
    v_revoked := v_revoked + 1;
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, v_uid, v_role, 'crew_link.revoked', 'crew_day_link', v_prev::text,
            jsonb_build_object('service_date', p_service_date, 'team_id', p_team_id, 'reason', 'reissued'), 'success');
  END LOOP;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.crew_day_links (business_id, service_date, token_hash, time_zone, expires_at, created_by, team_id)
  VALUES (p_business_id, p_service_date, encode(digest(v_token, 'sha256'), 'hex'), p_time_zone, v_expires, v_uid, p_team_id)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, v_uid, v_role, 'crew_link.created', 'crew_day_link', v_id::text,
          jsonb_build_object('service_date', p_service_date, 'expires_at', v_expires,
                             'time_zone', p_time_zone, 'team_id', p_team_id, 'replaced', v_revoked), 'success');

  RETURN jsonb_build_object('ok', true, 'link_id', v_id, 'token', v_token,
                            'service_date', p_service_date, 'expires_at', v_expires,
                            'team_id', p_team_id, 'replaced', v_revoked);
END;
$$;

-- ── 5. 🔴 THE REFUSAL — a team's token cannot act on another team's stop ────────────────────
CREATE OR REPLACE FUNCTION public.crew_stop_act(
  p_token text, p_client_key text, p_stop_id uuid, p_action text,
  p_actor_name text, p_device_id text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  r      record;
  v_link public.crew_day_links;
  v_out  jsonb;
BEGIN
  IF NOT public.crew_link_hit(p_client_key) THEN RETURN jsonb_build_object('ok', false, 'code', 'rate_limited'); END IF;
  SELECT * INTO r FROM public.crew_link_resolve(p_token);
  IF r.code IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', r.code); END IF;
  v_link := r.link;

  -- 🔴 THE STOP MUST BE ON THIS LINK'S TEAM. The stop id travels in the REQUEST, so hiding a stop
  -- from the read does not stop anyone posting its id back with this token. Refused by NAME rather
  -- than ignored, so a crew who opened the wrong link is told which link they need.
  IF v_link.team_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.deliveries d
       WHERE d.id = p_stop_id AND d.business_id = v_link.business_id AND d.team_id = v_link.team_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_this_teams_stop',
                              'message', 'That stop is not on this team''s list. Open your own team''s link.');
  END IF;

  v_out := public.stop_progress_apply(v_link.business_id, p_stop_id, p_action, p_actor_name, p_device_id,
                                      v_link.id, p_note, NULL, 'crew_link', v_link.service_date);
  UPDATE public.crew_day_links SET last_used_at = now() WHERE id = v_link.id;
  RETURN v_out;
END;
$$;

-- ── 6. 🔴 DROP THE OLD ARITIES — THEY ARE OVERLOADS, NOT REPLACEMENTS ───────────────────────
-- 🔴 FOUND BY RUNNING V3, NOT BY READING THIS FILE. `CREATE OR REPLACE FUNCTION` with a NEW
--    DEFAULTED PARAMETER does not replace anything — it creates a SECOND function beside the first.
--    Measured in PGlite with the real chain applied: after sections 3 and 4 above, the catalog held
--    FOUR functions, not two —
--        crew_day_stops(uuid, date)              ← the old one, NO team filter
--        crew_day_stops(uuid, date, uuid)        ← the new one
--        create_crew_day_link(uuid, date, text)  ← the old one, ignores teams entirely
--        create_crew_day_link(uuid, date, text, uuid)
--    and Postgres resolves an exact-arity call to the OLD one. A client still passing three
--    arguments would have gone on minting whole-day links, and `crew_day_stops(business, date)`
--    would have remained callable and UNFILTERED — a team-scoped read sitting next to an
--    unscoped twin of the same name. That is tech-debt #241's shape exactly: a superseded
--    definition that is still reachable, while everything reads as though it were replaced.
-- ⚠️ ORDER MATTERS AND IS DELIBERATE: `crew_day_read` is replaced in section 3 ABOVE to call the
--    three-argument form, so by the time the two-argument one is dropped here nothing calls it.
DROP FUNCTION IF EXISTS public.crew_day_stops(uuid, date);
DROP FUNCTION IF EXISTS public.create_crew_day_link(uuid, date, text);

GRANT EXECUTE ON FUNCTION public.create_crew_day_link(uuid, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_day_stops(uuid, date, uuid) TO anon, authenticated;

-- ============================================================================================
-- V-BLOCKS — ONE SELF-CONTAINED DO BLOCK, RUNS AS-IS (§6 r26). Paste it; it RAISES its verdict.
--
-- 🔴 REWRITTEN 2026-09-24. The previous version was seven COMMENTED-OUT `SELECT`s. Pasting it did
--    NOTHING — it is a file of comments — and a V-block that cannot run is [[R-26]]: a written
--    declaration nobody checked. Every assertion below now fails LOUDLY or prints PASSED.
-- 🔴 NO LIVE COUNT IS PINNED (§6 r26's second clause). V6 compares live links to whole-day links
--    RELATIVE TO EACH OTHER and reports the number rather than asserting a figure that drifts the
--    moment Lauren makes a link — the defect that made an earlier V-block fail about nothing.
-- ⚠️ READ-ONLY: it inspects the catalog and counts rows. It writes nothing and needs no rollback.
-- ============================================================================================
DO $v$
DECLARE
  v_nullable text; v_idx_count int; v_idx_def text; v_fns text; v_refuses boolean;
  v_scoped boolean; v_live int; v_whole int; v_total int; v_fail text := '';
BEGIN
  -- V1 · the column exists and is NULLABLE (a NOT NULL column would have refused every old link)
  SELECT is_nullable INTO v_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='crew_day_links' AND column_name='team_id';
  IF v_nullable IS NULL THEN v_fail := v_fail || ' V1: crew_day_links.team_id DOES NOT EXIST.';
  ELSIF v_nullable <> 'YES' THEN v_fail := v_fail || ' V1: team_id is NOT NULL, it must be nullable.';
  END IF;

  -- V2 · exactly ONE live-link index, and it CARRIES COALESCE. Without the coalesce, NULL team ids
  --      never collide and unlimited whole-day links can be live at once.
  SELECT count(*), max(indexdef) INTO v_idx_count, v_idx_def FROM pg_indexes
   WHERE schemaname='public' AND tablename='crew_day_links' AND indexdef ILIKE '%revoked_at IS NULL%';
  IF v_idx_count <> 1 THEN v_fail := v_fail || format(' V2: expected 1 live-link index, found %s.', v_idx_count);
  ELSIF v_idx_def NOT ILIKE '%coalesce%' THEN v_fail := v_fail || ' V2: the live-link index has NO COALESCE — whole-day links would not collide.';
  END IF;

  -- V3 · 🔴 EXACTLY ONE OF EACH, AT THE NEW ARITY. Four rows means the DROPs did not run and an
  --      UNFILTERED twin is still callable — Postgres resolves an exact-arity call to the OLD one.
  SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' | ' ORDER BY p.proname)
    INTO v_fns FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('crew_day_stops','create_crew_day_link');
  IF v_fns <> 'create_crew_day_link(p_business_id uuid, p_service_date date, p_time_zone text, p_team_id uuid) | crew_day_stops(p_business_id uuid, p_service_date date, p_team_id uuid)'
    THEN v_fail := v_fail || format(' V3: the catalog holds >>%s<< — expected exactly the two NEW arities.', v_fns);
  END IF;

  -- V4 · the refusal is IN the shipped body, not only in the plan
  SELECT pg_get_functiondef(p.oid) LIKE '%not_this_teams_stop%' INTO v_refuses
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='crew_stop_act';
  IF v_refuses IS NOT TRUE THEN v_fail := v_fail || ' V4: crew_stop_act does not refuse another team''s stop.'; END IF;

  -- V5 · the read passes the link's team through, AND still carries what 20260917e added.
  --      🔴 route_position / routed_at are checked HERE because losing them is what this file
  --      actually did in its first draft: the crew page silently stopped showing the SAVED order.
  SELECT pg_get_functiondef(ps.oid) LIKE '%route_position%'
     AND pg_get_functiondef(pr.oid) LIKE '%routed_at%'
     AND pg_get_functiondef(pr.oid) LIKE '%expires_at%'
     AND pg_get_functiondef(pr.oid) LIKE '%(r.link).team_id%'
    INTO v_scoped
    FROM pg_proc ps, pg_proc pr, pg_namespace n
   WHERE ps.pronamespace=n.oid AND pr.pronamespace=n.oid AND n.nspname='public'
     AND ps.proname='crew_day_stops' AND pr.proname='crew_day_read';
  IF v_scoped IS NOT TRUE THEN
    v_fail := v_fail || ' V5: the read/stops pair lost route_position, routed_at, expires_at or the team — ledger #351 would be silently reverted.';
  END IF;

  -- V6 · EVERY EXISTING LINK IS STILL A WHOLE-DAY LINK. Relative, never a pinned figure.
  -- ⚠️ GUARDED ON V1, and the reason is legibility rather than correctness: run on a database where
  --    the column is absent, an unguarded `FILTER (WHERE team_id IS NULL)` throws the bare Postgres
  --    error `column "team_id" does not exist`, which buries V1's own sentence. A verdict that does
  --    not name the check that failed is a worse verdict.
  IF v_nullable IS NULL THEN
    RAISE EXCEPTION 'V-BLOCKS FAILED —% (V6 skipped: without the column there is nothing to count)', v_fail;
  END IF;
  SELECT count(*), count(*) FILTER (WHERE team_id IS NULL) INTO v_live, v_whole
    FROM public.crew_day_links WHERE revoked_at IS NULL;
  IF v_live <> v_whole THEN
    v_fail := v_fail || format(' V6: %s live links but only %s are whole-day — this migration must not have created a team link.', v_live, v_whole);
  END IF;
  SELECT count(*) INTO v_total FROM public.crew_day_links;

  IF v_fail <> '' THEN RAISE EXCEPTION 'V-BLOCKS FAILED —%', v_fail; END IF;
  RAISE NOTICE 'V1-V6 PASSED — team_id nullable · 1 live-link index WITH coalesce · exactly the 2 new arities · crew_stop_act refuses another team''s stop · route_position + routed_at + expires_at + team all still carried · % live links, all % whole-day · % links total (no figure pinned)',
    v_live, v_whole, v_total;
END $v$;
