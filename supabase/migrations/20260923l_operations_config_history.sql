-- ══════════════════════════════════════════════════════
-- 20260923l_operations_config_history.sql — EVERY CHANGE TO AN OPERATIONS SETTING, DATED
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
-- (V2) 🔴 THE TRIGGER ACTUALLY FIRES, AND RECORDS ONLY WHAT MOVED.
--      Expect ONE row: config_key 'windowStart', old NULL → new "2026-11-04".
--   BEGIN;
--     UPDATE public.business_operations_config
--        SET config = config || '{"windowStart":"2026-11-04"}'::jsonb
--      WHERE business_id = :bid;
--     SELECT config_key, old_value, new_value FROM public.business_operations_config_history
--     WHERE business_id = :bid ORDER BY changed_at DESC LIMIT 5;
--   ROLLBACK;
--
-- (V3) 🔴 A SAVE THAT CHANGES NOTHING WRITES NOTHING (§0b). The two counts must be EQUAL.
--   BEGIN;
--     SELECT count(*) AS before_ FROM public.business_operations_config_history WHERE business_id = :bid;
--     UPDATE public.business_operations_config SET config = config WHERE business_id = :bid;
--     SELECT count(*) AS after_ FROM public.business_operations_config_history WHERE business_id = :bid;
--   ROLLBACK;
--
-- (V4) 🔴 AC-3 CROSS-TENANT PROBE — impersonated, not as postgres. Expect ZERO rows.
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<a user_id who is a member of ONE business>"}';
--   SELECT count(*) FROM public.business_operations_config_history WHERE business_id <> ':bid_of_that_user';
--   RESET ROLE;
