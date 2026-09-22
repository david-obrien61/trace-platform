-- ============================================================================================
-- 20260922c — THE DAY'S CAPACITY ESTIMATE, SNAPSHOT AND APPEND-ONLY
--             ledger #375 · teams piece 2.5 · tech-debt #345
--
-- ✅ APPLIED 2026-09-22 BY DAVID in the SQL editor (§6 r17). His results, verbatim:
--      V1 — both append-only triggers present ✓
--      V2 — RLS true, 3 policies ✓
--      V6 — count 0: nothing seeded, and nothing stranded by the failed V3 (it rolled back)
--      V7 — has_x false / has_minutes false, as expected: the two settings are CODE defaults
--           until someone saves them, so LAWNS is still on the platform's 8 h, not its own 7 h.
--   🔴 V3–V5 WERE NOT RUN AS WRITTEN AND MUST NOT BE — see the V3–V5 note further down. They are
--      replaced by `docs/probes/20260922c-v3-v5-append-only.sql`, which leaves nothing behind.
--
-- ⚠️ THIS FILE LANDS ON `main` BY ITSELF (§6 r22, ledger #379): the migration is LIVE, so it belongs
--    on the trunk the same day. **The capacity SCREENS are NOT here** — they stay held on
--    `feat/capacity-estimate` (#375) for David's review. A live migration and an unreviewed screen
--    are different risks and they travel separately.
--
-- DAVID'S RULE, 2026-09-21: suggest ONE team until the estimated day exceeds X hours, TWO above
-- that. X is a per-business setting (LAWNS = 7), manager-adjustable. Planting time per tree is a
-- per-business setting, 30 minutes by default until Start/Done taps measure it. Every estimate
-- shows its working and is OVERRIDABLE — Lauren decides, and if she says one team, that stands.
--
-- 🔴 THE SETTINGS NEED NO SCHEMA AND NONE IS ADDED HERE. `business_operations_config.config` is
--    already `jsonb`, already per-business, and already readable by a MANAGER holding
--    `settings:read` — which is exactly the person David said may adjust X. `dayHoursBeforeSecond
--    Team` and `plantingMinutesPerTree` are two new KEYS in that object (§6 r8: the same operation
--    lives in one place). A new settings table would be a second home for one fact (STD-011).
--
-- 🔴 WHAT THIS TABLE IS FOR: *"SNAPSHOT the estimate at route save AND when day inputs change:
--    append-only, never rewritten when a setting changes."* So every row stores THE VALUES IT
--    USED — the threshold, the minutes per tree, the trees, the drive minutes — and never a
--    reference to the settings row. Change X tomorrow and yesterday's snapshot still says what
--    yesterday was measured against. A snapshot that moved under you would be worse than none,
--    because it would look like a record while being a re-computation.
-- ============================================================================================

CREATE TABLE IF NOT EXISTS public.delivery_day_estimates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_date   date        NOT NULL,
  -- NULL = the whole day, unsplit. A real plan, not a missing value — the same convention
  -- `delivery_route_plans.team_id` uses (20260923b).
  team_id        uuid        REFERENCES public.delivery_teams(id) ON DELETE SET NULL,

  -- ── WHY this row exists. 'route_save' | 'inputs_changed'. Never free text from a caller.
  reason         text        NOT NULL CHECK (reason IN ('route_save', 'inputs_changed')),

  -- ── THE INPUTS AS THEY WERE, so the row can be read without the day or the settings.
  stops              integer NOT NULL CHECK (stops >= 0),
  trees              integer NOT NULL CHECK (trees >= 0),
  gallons            numeric(12,2),          -- NULL = some sizes could not be read. Not 0 (D-9/A9).
  -- 🔴 NULLABLE ON PURPOSE. NULL = the optimiser reported no drive time, so `total_hours` is a
  -- FLOOR, not an estimate. Storing 0 would make an unrouted day look SHORTER than a routed one,
  -- which is backwards and would suppress the second-team suggestion on the days that need it most.
  drive_minutes      integer CHECK (drive_minutes IS NULL OR drive_minutes >= 0),
  miles              numeric(10,2),

  -- ── THE SETTINGS AS THEY WERE. This is what makes the row a snapshot rather than a pointer.
  threshold_hours          numeric(6,2) NOT NULL CHECK (threshold_hours > 0),
  planting_minutes_per_tree integer     NOT NULL CHECK (planting_minutes_per_tree >= 0),
  settings_were_set        boolean      NOT NULL,   -- false = the platform defaults were in use

  -- ── THE ANSWER.
  total_hours       numeric(6,2) NOT NULL CHECK (total_hours >= 0),
  drive_known       boolean      NOT NULL,
  suggested_teams   integer      NOT NULL CHECK (suggested_teams IN (1, 2)),

  -- ── 🔴 WHAT THE PERSON DECIDED. NULL until someone decides; it never overwrites the suggestion.
  -- David: *"Lauren decides — if she says one team, that stands."* Both numbers are kept side by
  -- side precisely so a later reader can see where the rule and the person DISAGREED. Overwriting
  -- `suggested_teams` with her choice would erase the only evidence the rule was ever wrong, which
  -- is the evidence anyone tuning X would need.
  chosen_teams      integer      CHECK (chosen_teams IS NULL OR chosen_teams >= 1),
  chosen_by         uuid,
  chosen_at         timestamptz,

  -- The working, exactly as it was shown on screen, so the paper trail matches what she read.
  working           jsonb        NOT NULL DEFAULT '[]'::jsonb,

  created_at        timestamptz  NOT NULL DEFAULT now(),
  created_by        uuid
);

CREATE INDEX IF NOT EXISTS delivery_day_estimates_day_idx
  ON public.delivery_day_estimates (business_id, service_date, created_at DESC);

COMMENT ON TABLE public.delivery_day_estimates IS
  'Append-only snapshots of a delivery day''s capacity estimate (ledger #375). Each row carries the '
  'settings it used, so changing a setting never rewrites history. suggested_teams is the rule''s '
  'answer; chosen_teams is the person''s, kept beside it rather than over it.';

-- ── APPEND-ONLY, ENFORCED ───────────────────────────────────────────────────────────────────
-- 🔴 A COMMENT SAYING "append-only" IS NOT append-only. The same pattern `delivery_stop_events`
--    uses (20260917c): the database refuses, so no writer can forget.
-- ⚠️ ONE DELIBERATE EXCEPTION, NARROW AND CHECKED: recording the person's DECISION is an UPDATE of
--    `chosen_teams`/`chosen_by`/`chosen_at` on a row that has not been decided yet. Everything
--    else — every input, every setting, every computed answer — is frozen. Allowing the whole row
--    to be updated "because the choice needs saving" is how an append-only table stops being one.
CREATE OR REPLACE FUNCTION public.reject_day_estimate_rewrite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id
     OR NEW.service_date IS DISTINCT FROM OLD.service_date
     OR NEW.team_id     IS DISTINCT FROM OLD.team_id
     OR NEW.reason      IS DISTINCT FROM OLD.reason
     OR NEW.stops       IS DISTINCT FROM OLD.stops
     OR NEW.trees       IS DISTINCT FROM OLD.trees
     OR NEW.gallons     IS DISTINCT FROM OLD.gallons
     OR NEW.drive_minutes IS DISTINCT FROM OLD.drive_minutes
     OR NEW.miles         IS DISTINCT FROM OLD.miles
     OR NEW.threshold_hours IS DISTINCT FROM OLD.threshold_hours
     OR NEW.planting_minutes_per_tree IS DISTINCT FROM OLD.planting_minutes_per_tree
     OR NEW.settings_were_set IS DISTINCT FROM OLD.settings_were_set
     OR NEW.total_hours     IS DISTINCT FROM OLD.total_hours
     OR NEW.drive_known     IS DISTINCT FROM OLD.drive_known
     OR NEW.suggested_teams IS DISTINCT FROM OLD.suggested_teams
     OR NEW.working         IS DISTINCT FROM OLD.working
     OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'delivery_day_estimates is append-only: only the team choice may be recorded'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- A decision is made once. Changing your mind is a NEW estimate, not an edit of the old one.
  IF OLD.chosen_teams IS NOT NULL AND NEW.chosen_teams IS DISTINCT FROM OLD.chosen_teams THEN
    RAISE EXCEPTION 'this estimate already records a choice: record a new estimate instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_delivery_day_estimates_append_only ON public.delivery_day_estimates;
CREATE TRIGGER trg_delivery_day_estimates_append_only BEFORE UPDATE ON public.delivery_day_estimates
  FOR EACH ROW EXECUTE FUNCTION public.reject_day_estimate_rewrite();

CREATE OR REPLACE FUNCTION public.reject_day_estimate_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  RAISE EXCEPTION 'delivery_day_estimates is append-only: DELETE is not permitted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS trg_delivery_day_estimates_no_delete ON public.delivery_day_estimates;
CREATE TRIGGER trg_delivery_day_estimates_no_delete BEFORE DELETE ON public.delivery_day_estimates
  FOR EACH ROW EXECUTE FUNCTION public.reject_day_estimate_delete();

-- ── RLS — membership-scoped (AC-2), read for anyone who can see deliveries ───────────────────
ALTER TABLE public.delivery_day_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_day_estimates_member_select ON public.delivery_day_estimates;
CREATE POLICY delivery_day_estimates_member_select ON public.delivery_day_estimates
  FOR SELECT TO authenticated
  USING (public.has_permission(business_id, 'deliveries:read'));

-- Writing an estimate is part of planning the day, so it rides `deliveries:update` — the same
-- string that lets a person route the day and assign a stop to a team.
DROP POLICY IF EXISTS delivery_day_estimates_member_insert ON public.delivery_day_estimates;
CREATE POLICY delivery_day_estimates_member_insert ON public.delivery_day_estimates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(business_id, 'deliveries:update'));

DROP POLICY IF EXISTS delivery_day_estimates_member_choose ON public.delivery_day_estimates;
CREATE POLICY delivery_day_estimates_member_choose ON public.delivery_day_estimates
  FOR UPDATE TO authenticated
  USING (public.has_permission(business_id, 'deliveries:update'))
  WITH CHECK (public.has_permission(business_id, 'deliveries:update'));

-- ============================================================================================
-- V-BLOCKS — David pastes these AFTER applying. Each states the answer it must give.
-- (Thunder RAN every one of these in PGlite against the real chain before this file went near
--  the SQL editor — they are measured, not read by eye.)
-- ============================================================================================
-- V1 · the table is there with its append-only triggers → expect 2 rows:
--      trg_delivery_day_estimates_append_only (UPDATE), trg_delivery_day_estimates_no_delete (DELETE)
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.delivery_day_estimates'::regclass
--   AND NOT tgisinternal ORDER BY 1;
--
-- V2 · RLS is on and there are THREE policies (select/insert/update) → expect rls = true, 3 rows
-- SELECT c.relrowsecurity AS rls, p.polname FROM pg_class c
--   LEFT JOIN pg_policy p ON p.polrelid = c.oid
--  WHERE c.oid = 'public.delivery_day_estimates'::regclass ORDER BY 2;
--
-- V3–V5 · 🔴 SUPERSEDED — DO NOT RUN THE VERSION THAT WAS HERE. David hit it on 2026-09-22.
--       It INSERTED A REAL ROW into this APPEND-ONLY table on LAWNS — a row nobody can ever
--       delete — and then asked for that row's id to be pasted by hand into V4 and V5. His run
--       failed on the literal '<that id>' (22P02), which rolled back the insert, but only by the
--       luck of the ordering; he then had to check V6 to learn whether a row was stranded. (It
--       was not — V6 read 0.) A verification step that can permanently dirty a customer's data
--       is not a verification step.
--
--       ✅ RUN THIS INSTEAD — one self-contained block that leaves nothing behind:
--            docs/probes/20260922c-v3-v5-append-only.sql
--       It writes a probe row, proves the rewrite is refused, records the choice once, proves a
--       second choice is refused, proves DELETE is refused, and then RAISES on success so the
--       whole block — probe row included — rolls back. The PASS therefore arrives AS AN ERROR,
--       deliberately: a DO block cannot both leave nothing behind and return a result set.
--       Verified on PGlite: PASSED, rows before 0 → rows after 0, and with the append-only
--       trigger dropped it reports FAILED and names the missing refusal ([[R-33]] — a probe that
--       cannot fail is not a probe).
--
--       ⚠️ ONLY THESE COMMENTS CHANGED. Not one line of SQL in this file differs from what David
--       applied on 2026-09-22; the executable content is byte-for-byte what is live. The comments
--       are corrected rather than left standing because the next person to read them would run a
--       trap on a customer's database.
--
-- V6 · nothing was seeded → expect 0 on a fresh apply (1 if you ran V3)
-- SELECT count(*) AS rows_seeded FROM public.delivery_day_estimates;
--
-- V7 · the two SETTINGS keys are NOT in the database yet and that is correct — they are code
--      defaults until someone saves them. Expect either no row, or a config object WITHOUT them.
-- SELECT config ? 'dayHoursBeforeSecondTeam' AS has_x,
--        config ? 'plantingMinutesPerTree'   AS has_minutes
--   FROM public.business_operations_config WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
