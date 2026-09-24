-- ══════════════════════════════════════════════════════
-- 20260924c_operations_config_history.sql — EVERY CHANGE TO AN OPERATIONS SETTING, DATED
-- Ledger #391 · David applies · TENANT-AGNOSTIC
-- ══════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- CREATES A TABLE, so that rule is load-bearing. ADDITIVE ONLY: `business_operations_config` keeps
-- its shape and its policies, and every existing read and write of it is untouched.
--
-- ── §0 THE RULING ──────────────────────────────────────────────────────────────────
-- David, 2026-09-23: *"LAWNS SETS AND ADJUSTS ITS OWN DATES… neither may be settable only by SQL"*,
-- with a dated history on each change.
--
-- ⚠️ THE EDITOR HALF ALREADY EXISTED AND THIS IS RECORDED RATHER THAN RE-BUILT:
-- `OperationsSettings.tsx:219` has rendered `windowStart` / `windowEnd` as date inputs, saved
-- through an `upsert` under `settings:update` (MANAGER holds it), since ledger #276. The window has
-- never been SQL-only. What did not exist is the HISTORY — so that is all this migration adds.
--
-- ── §0a 🔴 WHY A TRIGGER AND NOT A SECOND WRITE FROM THE CLIENT ────────────────────
-- A history the client has to remember to write is a history that will disagree with the config the
-- first time any other caller upserts — and `business_operations_config` already has FOUR readers
-- and two writers. R-116 is the rule: *derive it so the link is structurally incapable of drifting*,
-- and the contact record (#335) deleted THREE hand-maintained mirrors to obey it. So the history is
-- written BY THE DATABASE, inside the same statement that changes the value. No client can skip it,
-- and a future writer gets it for free without knowing this table exists.
--
-- ── §0b WHAT IT RECORDS: CHANGED KEYS ONLY, ONE ROW EACH ───────────────────────────
-- The config is a 24-key jsonb blob saved whole, so a naive trigger would write 24 rows every time
-- somebody changed one number. This one diffs old against new and writes a row per key that
-- ACTUALLY MOVED. ⚠️ A SAVE THAT CHANGES NOTHING THEREFORE WRITES NOTHING, and that is a departure
-- from STD-023 (*a Save that changed nothing keeps its audit row as `no_change`*) made deliberately
-- rather than by oversight: STD-023 records ONE row per save, where "nothing changed" is itself the
-- fact worth keeping; here the row is PER KEY, and 24 rows of "unchanged" on every save would bury
-- the changes this table exists to surface. The two rules disagree because they count different
-- things. Said, not hidden.
--
-- ── §0c AC-1 ───────────────────────────────────────────────────────────────────────
-- Generic throughout: a business, a key, two values, who and when. Nothing about nurseries, windows
-- or uppotting appears in any identifier — the window is simply one key this happens to record.
-- ══════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.business_operations_config_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  config_key  text        NOT NULL,
  -- jsonb, not text: the values ARE jsonb, and rendering them to text here would lose the
  -- difference between the STRING "null" and an actual null — which is the whole of "is the window
  -- set?".
  old_value   jsonb,
  new_value   jsonb,
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_operations_config_history IS
  'APPEND-ONLY. One row per operations-config KEY that actually changed value, written by a trigger '
  'inside the same statement that changed it — so it cannot be skipped by a caller and cannot drift '
  'from the row it describes (R-116). A save that changes nothing writes nothing. The CURRENT value '
  'lives in business_operations_config; this is the record of how it got there, not a second copy '
  'of it.';

ALTER TABLE public.business_operations_config_history ENABLE ROW LEVEL SECURITY;

-- Reading the history needs the same string as reading the config it describes. NO NEW PERMISSION
-- STRING IS MINTED.
-- 🔴 EVERY POLICY IS DROPPED-IF-EXISTS BEFORE IT IS CREATED, SO THIS FILE IS RE-RUNNABLE.
-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so a plain CREATE makes a migration fail on its
-- second run with `policy ... already exists` — and the failure ABORTS THE TRANSACTION, so every
-- statement after it is silently skipped too. ⚠️ FOUND BY RUNNING THIS FILE TWICE UNDER §6 r26,
-- not by reading it: the first pass executed cleanly and the second died on the first policy.
DROP POLICY IF EXISTS business_operations_config_history_owner_select ON public.business_operations_config_history;
DROP POLICY IF EXISTS business_operations_config_history_member_select ON public.business_operations_config_history;

CREATE POLICY business_operations_config_history_owner_select ON public.business_operations_config_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_operations_config_history.business_id AND b.owner_id = auth.uid()));

CREATE POLICY business_operations_config_history_member_select ON public.business_operations_config_history
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:read'));

-- 🔴 NO INSERT POLICY FOR ANYBODY, AND THAT IS DELIBERATE, NOT AN OMISSION. Nothing may write this
-- table directly; the only writer is the SECURITY DEFINER trigger below, which runs as its owner
-- and is therefore not subject to these policies. A history a client could write by hand is a
-- history a client could write a lie into. There is no UPDATE and no DELETE policy either — this is
-- a record of what happened.

CREATE OR REPLACE FUNCTION public.record_operations_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k    text;
  oldv jsonb;
  newv jsonb;
BEGIN
  -- Union of the keys on BOTH sides, so a key ADDED or REMOVED is recorded, not only one edited.
  FOR k IN
    SELECT jsonb_object_keys(NEW.config)
    UNION
    SELECT jsonb_object_keys(COALESCE(OLD.config, '{}'::jsonb))
  LOOP
    oldv := CASE WHEN OLD IS NULL THEN NULL ELSE OLD.config -> k END;
    newv := NEW.config -> k;
    -- `IS DISTINCT FROM`, never `<>`: a key that appears or disappears has a NULL on one side, and
    -- `<>` returns NULL there — so the IF would not fire and the change would go unrecorded. That
    -- is a guard that cannot fire, on the exact rows most worth recording (R-33).
    IF oldv IS DISTINCT FROM newv THEN
      INSERT INTO public.business_operations_config_history
        (business_id, config_key, old_value, new_value, changed_by)
      VALUES (NEW.business_id, k, oldv, newv, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operations_config_history ON public.business_operations_config;
CREATE TRIGGER trg_operations_config_history
  AFTER INSERT OR UPDATE ON public.business_operations_config
  FOR EACH ROW EXECUTE FUNCTION public.record_operations_config_change();

CREATE INDEX IF NOT EXISTS business_operations_config_history_key_idx
  ON public.business_operations_config_history (business_id, config_key, changed_at DESC);

COMMIT;

-- ══════════════════════════════════════════════════════
-- VERIFY — executed on PGlite before hand-over by `scripts/sql-harness/rung-dates-391.pglite.mjs`.
-- ══════════════════════════════════════════════════════
--
-- (V1) The table exists with RLS enabled, and has SELECT policies but NO write policy of any kind.
--      Expect: rowsecurity t · 2 SELECT policies · ZERO rows from the second query.
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'business_operations_config_history';
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'business_operations_config_history' AND cmd <> 'SELECT';
--
-- 🔴 V2–V4 ARE SELF-CONTAINED `DO` BLOCKS AND EACH ENDS IN A RED ERROR ON PURPOSE (§6 r26,
--    sharpened 2026-09-24). They look their own ids up, probe, and RAISE their verdict — the RAISE
--    is what ROLLS THE WRITE BACK. **Read the message text**: it begins `V2 PASS ✅` or `V2 FAIL 🔴`.
--    An earlier draft used psql placeholders (`:bid`) which the Supabase SQL editor cannot fill, so
--    the equivalent checks on `20260924a` never ran at all — that is the defect this shape removes.
--    Paste each block whole; they are independent.
--
-- (V2 + V3) THE TRIGGER FIRES, RECORDS ONLY WHAT MOVED, AND WRITES NOTHING FOR A NO-OP SAVE.
--   DO $v2$
--   DECLARE
--     v_bid uuid; v_before int; v_after_change int; v_after_noop int; v_keys text;
--   BEGIN
--     SELECT business_id INTO v_bid FROM public.business_operations_config ORDER BY business_id LIMIT 1;
--     IF v_bid IS NULL THEN
--       RAISE EXCEPTION 'V2 CANNOT RUN ⚠️ — no row in business_operations_config. NOT a pass.';
--     END IF;
--
--     SELECT count(*) INTO v_before FROM public.business_operations_config_history WHERE business_id = v_bid;
--
--     -- ONE key changes. A 24-key blob is saved whole, so "only what moved" is the whole claim.
--     UPDATE public.business_operations_config
--        SET config = config || jsonb_build_object('windowStart', '2026-11-04')
--      WHERE business_id = v_bid;
--     SELECT count(*) INTO v_after_change FROM public.business_operations_config_history WHERE business_id = v_bid;
--
--     -- Now a save that changes NOTHING.
--     UPDATE public.business_operations_config SET config = config WHERE business_id = v_bid;
--     SELECT count(*) INTO v_after_noop FROM public.business_operations_config_history WHERE business_id = v_bid;
--
--     SELECT string_agg(config_key, ',' ORDER BY config_key) INTO v_keys
--     FROM public.business_operations_config_history
--     WHERE business_id = v_bid AND changed_at >= now() - interval '1 minute';
--
--     IF v_after_change = v_before + 1 AND v_after_noop = v_after_change AND v_keys LIKE '%windowStart%' THEN
--       RAISE EXCEPTION 'V2 PASS ✅ / V3 PASS ✅ — one changed key wrote exactly ONE row (%), and a save that changed nothing wrote NOTHING (% -> % -> %). (rolled back)', v_keys, v_before, v_after_change, v_after_noop;
--     ELSE
--       RAISE EXCEPTION 'V2/V3 FAIL 🔴 — before=% after_change=% after_noop=% keys=%. Expected +1 then +0.', v_before, v_after_change, v_after_noop, v_keys;
--     END IF;
--   END
--   $v2$;
--
-- (V4) TENANT SCOPING — the predicate the member policy rests on.
--      ⚠️ Same honest limit as `20260924a`'s V6: this runs as `postgres`, for whom RLS is not
--      enforced, so it cannot demonstrate a refused SELECT. It calls `is_active_member` — the
--      SECURITY DEFINER function the member policy delegates to — under a real member's claims.
--   DO $v4$
--   DECLARE v_user uuid; v_own uuid; v_other uuid; v_a boolean; v_b boolean; v_pol int;
--   BEGIN
--     SELECT bm.user_id, bm.business_id INTO v_user, v_own
--     FROM public.business_members bm
--     WHERE bm.active
--       AND (SELECT count(DISTINCT b2.business_id) FROM public.business_members b2
--             WHERE b2.user_id = bm.user_id AND b2.active) = 1
--     ORDER BY bm.user_id LIMIT 1;
--     SELECT b.id INTO v_other FROM public.businesses b WHERE b.id <> v_own ORDER BY b.id LIMIT 1;
--     IF v_user IS NULL OR v_other IS NULL THEN
--       RAISE EXCEPTION 'V4 CANNOT RUN ⚠️ — needs an active member of exactly ONE business and a second business. NOT a pass.';
--     END IF;
--     PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
--     v_a := public.is_active_member(v_own);
--     v_b := public.is_active_member(v_other);
--     SELECT count(*) INTO v_pol FROM pg_policies
--     WHERE tablename = 'business_operations_config_history' AND qual LIKE '%is_active_member%';
--     IF v_a AND NOT v_b AND v_pol >= 1 THEN
--       RAISE EXCEPTION 'V4 PASS ✅ — is_active_member is TRUE for the member''s own business and FALSE for another, and % member policy/policies delegate to it.', v_pol;
--     ELSE
--       RAISE EXCEPTION 'V4 FAIL 🔴 — own=% other=% policies=%.', v_a, v_b, v_pol;
--     END IF;
--   END
--   $v4$;
