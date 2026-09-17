-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260917c — THE CREW DAY LINK · ledger #347
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ APPLIED 2026-09-17 BY DAVID, and the V-block came back clean (his paste, plus an independent
--    live catalog read by Thunder before the merge — because his paste listed seven functions and the
--    two that the office door needs, `stop_act` and `stop_progress_apply`, were not among them):
--      V1  crew_day_links rls=true 1 policy · crew_link_rate rls=true 0 policies · delivery_stop_events rls=true 1 policy
--      V2  completed_by_name + review_ask_held_at present on deliveries (both nullable)
--      V3  create_crew_day_link · revoke_crew_day_link · stop_act → anon f · authed t · service t
--          crew_day_read · crew_stop_act · crew_day_stops · crew_link_hit · crew_link_resolve ·
--          stop_progress_apply → anon f · authed f · service t
--      V4  crew_day_read with a bad token → {"ok": false, "code": "invalid"} — and the refusal WAS
--          counted: crew_link_rate held exactly 1 row afterwards, which is the rate limiter working.
--    STANDALONE: it depended on no unmerged branch. ONE FILE, ONE PASTE.
-- ✏️ AMENDED 2026-09-17, BEFORE ANY APPLY, on David's ruling that both completion doors behave the
--    same (§4b). Amending rather than appending keeps Friday to a single paste, and §6 r1 guards
--    APPLIED migrations — this one has never run anywhere (the #335 precedent). If you have already
--    pasted an earlier copy of this file, paste this one again: every statement is re-runnable.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- The install crew have no logins. Lauren texts the day's route to the DRIVER from her phone and
-- nothing comes back: `deliveries.completed_at` was set on 0 of 57 stops (2026-09-11). David,
-- 2026-09-17, for the Saturday 2026-09-19 pilot: a link, no login — "light, adds little, captures
-- data".
--
-- ── WHAT IT ADDS ────────────────────────────────────────────────────────────────────────────
--   crew_day_links          one row per link Lauren makes: ONE business, ONE service date.
--                           Only a SHA-256 of the token is stored. Expires 06:00 the next day in
--                           the time zone of the person who made it. Revocable. One live link per
--                           (business, date): making a new one revokes the old one.
--   delivery_stop_events    append-only: every Start / Done / Undo / Note from a link, with the
--                           typed name, the device id and the time.
--   crew_link_rate          per-client request counter (the endpoint's rate limit).
--   deliveries.completed_by_name     the typed name on the Done tap.
--   deliveries.review_ask_held_at    Done HOLDS a review ask: the flag is stored, nothing is sent.
--
--   stop_progress_apply    THE ONE COMPLETION WRITER (§4b) — both doors call it: the crew link and
--                           the office's own Mark done. Internal; no role may call it directly.
--   stop_act               the office door: a logged-in member with `deliveries:update`.
--   create_crew_day_link / revoke_crew_day_link   — called by Lauren's app session. Each checks
--       `deliveries:update` on the business INSIDE the function (§1.6 item 4: enforced server-side).
--   crew_day_read / crew_stop_act                 — called ONLY by the API endpoint with the service
--       key (EXECUTE is revoked from anon and authenticated). The token, the business and the date
--       are all checked inside, so the endpoint cannot widen what a token can see.
--
-- ── WHAT IT DOES NOT DO (and why) ───────────────────────────────────────────────────────────
--   · Done does NOT touch `orders` — it does not fulfil the order (tech-debt #319 is separate).
--   · Done HOLDS the review ask through BOTH doors and sends nothing (David, 2026-09-17).
--   · Nothing here touches business_inventory or its ledger — no stock moves, in test mode or out.
--   · Nothing here sends anything to a customer. The held review ask is a timestamp.
--   · No prices, totals or discounts are returned by crew_day_read: the line projection names
--     the item, size and quantity and nothing else.
--   · Stop order is the schedule's order (date, then when the stop was made). No route order is
--     saved anywhere today — the route screen computes it on the fly.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. TABLES ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crew_day_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_date  date        NOT NULL,
  token_hash    text        NOT NULL UNIQUE,          -- sha256(token), hex. The token is never stored.
  time_zone     text        NOT NULL,                 -- IANA name from the creator's device
  expires_at    timestamptz NOT NULL,                 -- 06:00 on service_date + 1, in time_zone
  created_by    uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  revoked_by    uuid,
  last_used_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_day_links_one_live_per_day
  ON public.crew_day_links (business_id, service_date) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.delivery_stop_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_id  uuid        NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  link_id      uuid        REFERENCES public.crew_day_links(id) ON DELETE SET NULL,
  action       text        NOT NULL CHECK (action IN ('start', 'done', 'undo_done', 'note')),
  actor_name   text        NOT NULL,
  actor_user_id uuid,                              -- the office door records WHO; a crew link has no login
  device_id    text        NOT NULL,
  note         text,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_stop_events_by_stop ON public.delivery_stop_events (delivery_id, occurred_at);

CREATE TABLE IF NOT EXISTS public.crew_link_rate (
  client_key    text        NOT NULL,
  window_start  timestamptz NOT NULL,
  hits          integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (client_key, window_start)
);

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS completed_by_name  text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS review_ask_held_at timestamptz;
COMMENT ON COLUMN public.deliveries.completed_by_name IS
  'The name typed on the crew link when this stop was marked done. Set only by crew_stop_act.';
COMMENT ON COLUMN public.deliveries.review_ask_held_at IS
  'A review ask HELD by a crew-link Done: recorded, NOT sent. Nothing sends it yet (held asks: agreed 2026-09-17, not built).';

-- delivery_stop_events is append-only for UPDATE. DELETE is left to the cascade from deliveries.
CREATE OR REPLACE FUNCTION public.reject_stop_event_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  RAISE EXCEPTION 'delivery_stop_events is append-only: UPDATE is not permitted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS trg_delivery_stop_events_immutable ON public.delivery_stop_events;
CREATE TRIGGER trg_delivery_stop_events_immutable BEFORE UPDATE ON public.delivery_stop_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_stop_event_update();

-- ── 2. RLS — read only; every write goes through the functions below ─────────────────────────
ALTER TABLE public.crew_day_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_link_rate       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crew_day_links_member_select ON public.crew_day_links;
CREATE POLICY crew_day_links_member_select ON public.crew_day_links FOR SELECT
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:update'));

DROP POLICY IF EXISTS delivery_stop_events_member_select ON public.delivery_stop_events;
CREATE POLICY delivery_stop_events_member_select ON public.delivery_stop_events FOR SELECT
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:read'));
-- crew_link_rate: no policy — server-only (declared in scripts/select-policy-declarations.json).

REVOKE ALL ON public.crew_day_links, public.delivery_stop_events, public.crew_link_rate FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.crew_day_links, public.delivery_stop_events, public.crew_link_rate FROM authenticated;
REVOKE ALL ON public.crew_link_rate FROM authenticated;
-- Explicit, not inherited: Lauren's session reads the two tables (RLS filters the rows); the
-- service key does everything else.
GRANT SELECT ON public.crew_day_links, public.delivery_stop_events TO authenticated;
GRANT ALL ON public.crew_day_links, public.delivery_stop_events, public.crew_link_rate TO service_role;

-- ── 3. LAUREN: make a link / revoke a link ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_crew_day_link(p_business_id uuid, p_service_date date, p_time_zone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
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

  v_expires := ((p_service_date + 1)::timestamp + time '06:00') AT TIME ZONE p_time_zone;
  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;

  -- Reissue: the day's live link (if any) stops working the moment the new one exists.
  FOR v_prev IN
    UPDATE public.crew_day_links SET revoked_at = now(), revoked_by = v_uid
     WHERE business_id = p_business_id AND service_date = p_service_date AND revoked_at IS NULL
    RETURNING id
  LOOP
    v_revoked := v_revoked + 1;
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, v_uid, v_role, 'crew_link.revoked', 'crew_day_link', v_prev::text,
            jsonb_build_object('service_date', p_service_date, 'reason', 'reissued'), 'success');
  END LOOP;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.crew_day_links (business_id, service_date, token_hash, time_zone, expires_at, created_by)
  VALUES (p_business_id, p_service_date, encode(digest(v_token, 'sha256'), 'hex'), p_time_zone, v_expires, v_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, v_uid, v_role, 'crew_link.created', 'crew_day_link', v_id::text,
          jsonb_build_object('service_date', p_service_date, 'expires_at', v_expires,
                             'time_zone', p_time_zone, 'replaced', v_revoked), 'success');

  RETURN jsonb_build_object('ok', true, 'link_id', v_id, 'token', v_token,
                            'service_date', p_service_date, 'expires_at', v_expires, 'replaced', v_revoked);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_crew_day_link(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_link public.crew_day_links%ROWTYPE;
  v_role text;
BEGIN
  SELECT * INTO v_link FROM public.crew_day_links WHERE id = p_link_id;
  IF NOT FOUND OR v_uid IS NULL OR NOT public.is_active_member(v_link.business_id)
     OR NOT public.has_permission(v_link.business_id, 'deliveries:update') THEN
    -- One answer for "no such link" and "not yours": a link id from another business reveals nothing.
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted', 'message', 'That link cannot be changed from here.');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  SELECT role INTO v_role FROM public.business_members
   WHERE business_id = v_link.business_id AND user_id = v_uid AND active LIMIT 1;
  UPDATE public.crew_day_links SET revoked_at = now(), revoked_by = v_uid WHERE id = p_link_id;
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (v_link.business_id, v_uid, v_role, 'crew_link.revoked', 'crew_day_link', p_link_id::text,
          jsonb_build_object('service_date', v_link.service_date, 'reason', 'revoked'), 'success');
  RETURN jsonb_build_object('ok', true, 'already', false);
END;
$$;

-- ── 4. THE LINK ITSELF (service key only) ───────────────────────────────────────────────────
-- Rate limit: 60 requests a minute per client key. Counted BEFORE the token is looked at, so a
-- guessing client is throttled too. Returns false when over the limit. Nothing here raises for a
-- bad token — a raise would roll back the count.
CREATE OR REPLACE FUNCTION public.crew_link_hit(p_client_key text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_key  text := left(coalesce(nullif(p_client_key, ''), 'unknown'), 128);
  v_win  timestamptz := date_trunc('minute', now());
  v_hits int;
BEGIN
  INSERT INTO public.crew_link_rate AS r (client_key, window_start, hits) VALUES (v_key, v_win, 1)
  ON CONFLICT (client_key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO v_hits;
  DELETE FROM public.crew_link_rate WHERE client_key = v_key AND window_start < now() - interval '1 hour';
  RETURN v_hits <= 60;
END;
$$;

-- The day's stops as the crew may see them. NO price, total, discount or cost field.
CREATE OR REPLACE FUNCTION public.crew_day_stops(p_business_id uuid, p_service_date date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public, extensions
AS $$
  SELECT coalesce(jsonb_agg(s.j ORDER BY s.created_at, s.id), '[]'::jsonb)
  FROM (
    SELECT d.created_at, d.id, jsonb_build_object(
      'id', d.id,
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

-- Resolve a token to its live link. Returns the link row, or a refusal code.
CREATE OR REPLACE FUNCTION public.crew_link_resolve(p_token text, OUT link public.crew_day_links, OUT code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
BEGIN
  code := NULL;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN code := 'invalid'; RETURN; END IF;
  SELECT * INTO link FROM public.crew_day_links WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');
  IF NOT FOUND THEN code := 'invalid'; RETURN; END IF;
  IF link.revoked_at IS NOT NULL THEN code := 'revoked'; RETURN; END IF;
  IF now() >= link.expires_at THEN code := 'expired'; RETURN; END IF;
END;
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
    'stops', public.crew_day_stops((r.link).business_id, (r.link).service_date));
END;
$$;

-- ── 4b. THE ONE COMPLETION WRITER ───────────────────────────────────────────────────────────
-- 🔴 ONE WRITER, TWO DOORS — David's ruling, 2026-09-17: *"the office's Mark done must behave like
--    the crew's Done — HOLD the review ask (never spend it) and be undoable — so both doors do the
--    same thing. One completion writer, registered with its path tests."*
--    `stop_progress_apply` is that writer. Nothing else may set these columns:
--      · `crew_stop_act`  — the crew link (token; the link's own business and DAY only)
--      · `stop_act`       — a logged-in member with `deliveries:update` (any of their own stops)
--    Both record the same event row and the same audit row, and both HOLD the review ask.
--    It is internal: no role is granted EXECUTE on it (the two doors are SECURITY DEFINER).
--
-- ⚠️ ONE UNDO RULE FOR BOTH DOORS, and it is a rule about what has been SPENT, not about who tapped:
--    a Done can be reopened while `review_asked_at IS NULL` (nothing was sent to a customer) AND
--    `completed_by_name IS NOT NULL` (it was completed through one of these two taps). So an
--    imported history stop ([[R-37]]: 19 LAWNS stops landed `fulfilled` with NULL timestamps) is NOT
--    reopenable by either door — it is a record of the past, not today's work.
CREATE OR REPLACE FUNCTION public.stop_progress_apply(
  p_business_id uuid, p_stop_id uuid, p_action text, p_actor_name text, p_device_id text,
  p_link_id uuid, p_note text, p_actor_user_id uuid, p_actor_role text, p_service_date date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_stop   public.deliveries%ROWTYPE;
  v_name   text := nullif(btrim(coalesce(p_actor_name, '')), '');
  v_device text := nullif(btrim(coalesce(p_device_id, '')), '');
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_now    timestamptz := now();
  v_change boolean := true;
BEGIN
  -- VALIDATE (§1.6 item 3): refuse, never fabricate.
  IF p_action IS NULL OR p_action NOT IN ('start', 'done', 'undo_done', 'note') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_action');
  END IF;
  IF v_name IS NULL OR length(v_name) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_required', 'message', 'Enter your name first.');
  END IF;
  IF v_device IS NULL OR length(v_device) < 8 OR length(v_device) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'device_required');
  END IF;
  IF p_action = 'note' AND (v_note IS NULL OR length(v_note) > 1000) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'note_required', 'message', 'Type a note (up to 1000 characters).');
  END IF;
  IF p_action <> 'note' THEN v_note := NULL; END IF;

  -- The stop must belong to this business, and — for a crew link — to the link's own DAY.
  SELECT * INTO v_stop FROM public.deliveries
   WHERE id = p_stop_id AND business_id = p_business_id
     AND (p_service_date IS NULL OR delivery_date = p_service_date)
     AND coalesce(status, '') <> 'cancelled'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_on_this_day'); END IF;

  IF p_action = 'start' THEN
    IF v_stop.started_at IS NOT NULL OR v_stop.status = 'fulfilled' THEN v_change := false;
    ELSE UPDATE public.deliveries SET started_at = v_now WHERE id = v_stop.id;
    END IF;

  ELSIF p_action = 'done' THEN
    -- The stop is done. The ORDER is not touched (tech-debt #319), no stock moves, and the review
    -- ask is HELD: recorded here, sent by nothing (David, 2026-09-17 — never spend it on a tap).
    IF v_stop.status = 'fulfilled' THEN v_change := false;
    ELSE
      UPDATE public.deliveries
         SET status = 'fulfilled',
             completed_at = v_now,
             started_at = coalesce(started_at, v_now),
             completed_by_name = v_name,
             review_ask_held_at = CASE WHEN review_asked_at IS NULL THEN v_now ELSE review_ask_held_at END
       WHERE id = v_stop.id;
    END IF;

  ELSIF p_action = 'undo_done' THEN
    IF v_stop.status <> 'fulfilled' THEN v_change := false;
    ELSIF v_stop.completed_by_name IS NULL OR v_stop.review_asked_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_undoable',
        'message', CASE WHEN v_stop.review_asked_at IS NOT NULL
                        THEN 'A review was already asked for this stop, so it cannot be reopened here.'
                        ELSE 'This stop was completed before the platform recorded who, so it cannot be reopened here.' END);
    ELSE
      UPDATE public.deliveries
         SET status = 'scheduled',
             started_at = CASE WHEN started_at = completed_at THEN NULL ELSE started_at END,
             completed_at = NULL,
             completed_by_name = NULL,
             review_ask_held_at = NULL
       WHERE id = v_stop.id;
    END IF;
  END IF;

  IF v_change THEN
    INSERT INTO public.delivery_stop_events (business_id, delivery_id, link_id, action, actor_name, actor_user_id, device_id, note, occurred_at)
    VALUES (p_business_id, v_stop.id, p_link_id, p_action, v_name, p_actor_user_id, v_device, v_note, v_now);
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, p_actor_role, 'crew_stop.' || p_action, 'delivery', v_stop.id::text,
          jsonb_build_object('link_id', p_link_id, 'service_date', v_stop.delivery_date,
                             'actor_name', v_name, 'device_id', v_device, 'note', v_note, 'changed', v_change),
          CASE WHEN v_change THEN 'success' ELSE 'no_change' END);

  RETURN jsonb_build_object('ok', true, 'changed', v_change,
    'stop', (SELECT x FROM jsonb_array_elements(public.crew_day_stops(p_business_id, v_stop.delivery_date)) x
              WHERE x->>'id' = v_stop.id::text));
END;
$$;

-- DOOR 1 — the crew link. The token decides the business AND the day; nothing else may widen it.
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
  v_out := public.stop_progress_apply(v_link.business_id, p_stop_id, p_action, p_actor_name, p_device_id,
                                      v_link.id, p_note, NULL, 'crew_link', v_link.service_date);
  UPDATE public.crew_day_links SET last_used_at = now() WHERE id = v_link.id;
  RETURN v_out;
END;
$$;

-- DOOR 2 — the office. A logged-in member with `deliveries:update`, on their own business's stop, any
-- day. The name recorded is the member's own name, so the schedule reads the same either way.
CREATE OR REPLACE FUNCTION public.stop_act(
  p_business_id uuid, p_stop_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text;
  v_role text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)
     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',
      'message', 'You need permission to change deliveries.');
  END IF;
  SELECT nullif(btrim(coalesce(name, '')), ''), role INTO v_name, v_role
    FROM public.business_members WHERE business_id = p_business_id AND user_id = v_uid AND active LIMIT 1;
  -- A member row with no name still gets an honest attribution rather than a blank one.
  RETURN public.stop_progress_apply(p_business_id, p_stop_id, p_action, coalesce(v_name, 'A team member'),
                                    'app-session', NULL, p_note, v_uid, v_role, NULL);
END;
$$;

-- ── 5. WHO MAY CALL WHAT ────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_crew_day_link(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_crew_day_link(uuid)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_crew_day_link(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_crew_day_link(uuid)             TO authenticated;

REVOKE ALL ON FUNCTION public.stop_progress_apply(uuid, uuid, text, text, text, uuid, text, uuid, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stop_act(uuid, uuid, text, text)                  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_act(uuid, uuid, text, text)               TO authenticated;
REVOKE ALL ON FUNCTION public.crew_link_hit(text)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crew_day_stops(uuid, date)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crew_link_resolve(text)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crew_day_read(text, text)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crew_stop_act(text, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_day_read(text, text)                         TO service_role;
GRANT EXECUTE ON FUNCTION public.crew_stop_act(text, text, uuid, text, text, text, text) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run after applying, paste the output back.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 tables + RLS:
-- SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
--   FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
--    AND c.relname IN ('crew_day_links', 'delivery_stop_events', 'crew_link_rate') ORDER BY 1;
--   expect: crew_day_links t 1 · crew_link_rate t 0 · delivery_stop_events t 1
-- V2 new columns:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name IN ('completed_by_name', 'review_ask_held_at');
--   expect: 2 rows
-- V3 who can call the crew functions (anon and authenticated must be false):
-- SELECT p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
--   FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
--    AND p.proname IN ('crew_day_read', 'crew_stop_act', 'crew_link_resolve', 'crew_day_stops', 'crew_link_hit',
--                      'create_crew_day_link', 'revoke_crew_day_link') ORDER BY 1;
--   expect: crew_day_read / crew_stop_act → anon f · authed f · service t; the three helpers and
--           stop_progress_apply → f · f; create/revoke and stop_act → anon f · authed t
-- V4 a refused token (no rows written except one rate-limit count):
-- SELECT public.crew_day_read(repeat('0', 64), 'v-block');
--   expect: {"ok": false, "code": "invalid"}
