-- ══════════════════════════════════════════════════════
-- 20260924a_rung_entry_dates.sql — WHEN A LOT WENT INTO THE SIZE IT IS IN
-- Ledger #391 · David applies · TENANT-AGNOSTIC (no tenant id appears anywhere below)
-- ══════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- This migration CREATES A TABLE, so that rule is load-bearing here: the table editor's
-- `supabase_admin` default ACL grants TRUNCATE and REFERENCES to `anon`, and RLS cannot filter
-- TRUNCATE.
--
-- ADDITIVE ONLY. One NEW table. `business_inventory` gains NO column — see §0b.
--
-- ── §0 WHAT THIS RECORDS, AND WHY IT IS ENTERED RATHER THAN DERIVED ────────────────
-- David, 2026-09-23, from LAWNS: the potted-on date is ENTERED, never derived. The alternative was
-- measured and is dead: a size-to-size transition CANNOT be inferred from invoice history, because
-- every size sells in every quarter — Live Oak and Monterrey Oak sold at 15, 30, 45, 65, 95 and 200
-- gallon simultaneously across EIGHT CONSECUTIVE QUARTERS (2024-10 → 2026-09, 1,530 dated orders).
-- Sales measure DEMAND, not graduation. There is no stop-one-start-the-next edge to find.
--
-- Readiness is then arithmetic and is never stored: entered_on + the rung's `grow_months`
-- (20260923h). Nobody types a ready-for-purchase date; a typed one would be a second answer that
-- can disagree with the first (R-27).
--
-- ── §0a THE INDUSTRY STANDARD THIS FOLLOWS ─────────────────────────────────────────
-- ANSI Z60.1 §6.1.1.1's propagation/cultural history code — `C1T2` = *"3-year plant: 1 year in the
-- cutting bench, then transplanted once for 2 years"* — is the industry's own serialisation of a
-- nursery lot's stage history, and in it AGE IS DERIVED FROM THE HISTORY, never stored as a field.
-- This table is that code in rows: one row per stage entered, with its date, and every downstream
-- figure derived from them. (Literature recon, ledger #330.)
--
-- ── §0b 🔴 WHY THIS IS A TABLE AND NOT A COLUMN ON `business_inventory` ─────────────
-- David ruled the shape: *"each entry or edit adds a row (who, when, value); nothing overwritten;
-- current = latest."* A column would be overwritten by the second person to type a date, and the
-- first value — and who typed it — would be gone. A lot also genuinely has a SEQUENCE: a block
-- potted into 15s in 2024 and moved to 30s in 2026 has two true entry dates, and the 2024 one is
-- not wrong, it is history. Tech-debt #71 is this platform's own live example of one field with two
-- authors and no record of which won.
--
-- ⚠️ SO THERE IS NO `current` COLUMN AND NO `is_latest` FLAG ANYWHERE. Current is
-- `ORDER BY recorded_at DESC, seq DESC LIMIT 1` — a projection of the rows, not a second truth that
-- can disagree with them (R-27 / R-84's reasoning, one table over). The `seq` tiebreak is what makes
-- that projection DETERMINISTIC; see the column comment for the defect it fixes.
--
-- ── §0c APPEND-ONLY, ENFORCED THE WAY THIS REPO ALREADY ENFORCES IT ────────────────
-- `business_inventory_ledger` (20260720) sets the pattern: a BEFORE UPDATE OR DELETE trigger that
-- RAISEs, with no exemption, plus RLS that grants no UPDATE or DELETE to anybody. A correction is a
-- NEW ROW, never an edit. Both halves are here, and the trigger is the half that holds even if a
-- future migration adds a policy by accident.
--
-- ── §0d AC-1 — NO VERTICAL NOUN ────────────────────────────────────────────────────
-- "Potting" and "uppot" are nursery vocabulary and appear NOWHERE below. The table is
-- `production_rung_dates`, the column is `entered_on`, and the rung is a `unit_value` number — the
-- same discipline `20260905_production_planning.sql` §0b applied, and for the same reason. The
-- words "Potted on" appear only in the cultivar-os surface copy (AC-4).
-- ══════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.production_rung_dates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  inventory_id  uuid        NOT NULL REFERENCES public.business_inventory(id) ON DELETE CASCADE,

  -- The day the lot went into the size it is in. A DATE, not a timestamp: nobody knows the hour a
  -- block was potted, and storing one would invent precision the yard does not have.
  entered_on    date        NOT NULL,

  -- Which rung it entered, captured AT WRITE TIME from the lot's own projection. Nullable because a
  -- lot may carry no resolvable size at all (107 of LAWNS's 632 live lots carry no size whatever),
  -- and refusing the date because the size is unset would lose the one fact somebody DOES know.
  unit_value    numeric,

  -- Why this entry exists, in the person's own words. The second and later rows for a lot are
  -- CORRECTIONS, and a correction with no reason is the thing the next reader cannot interpret.
  note          text,

  -- 🔴 STAMPED BY THE DATABASE, NOT SENT BY THE CLIENT. `auth.uid()` is the real caller, so a
  -- client cannot record an entry as somebody else, and no screen has to remember to attach it.
  -- The movement ledger enforces the same rule the harder way (`20260720` raises if the actor and
  -- the caller disagree); a DEFAULT achieves it here because nothing may UPDATE this table at all.
  -- ⚠️ Nullable on purpose: a server-side or service-role write has no `auth.uid()`, and refusing
  -- it would be a NOT NULL that fires on the one path that cannot satisfy it.
  recorded_by   uuid        DEFAULT auth.uid(),
  recorded_at   timestamptz NOT NULL DEFAULT now(),

  -- 🔴 THE TIEBREAK, AND IT IS LOAD-BEARING RATHER THAN DECORATIVE. `now()` is TRANSACTION time, so
  -- two rows written in one transaction — or in the same microsecond from two — carry an IDENTICAL
  -- `recorded_at`, and ordering by it alone leaves "latest" to be settled by a RANDOM uuid.
  -- ⚠️ MEASURED, NOT ARGUED: with two rows written in ONE statement and the tiebreak on `id`, the
  -- harness's M4 probe picked the WRONG row 7 times out of 12 — "current" decided by a coin toss.
  -- A bigserial is monotonic per insert whatever the clock does, so `ORDER BY recorded_at DESC,
  -- seq DESC` has exactly one answer.
  -- ✏️ Honest provenance: the probe that first went red here was itself faulty (it compared a JS
  -- Date with `String().startsWith`). The CONCERN it raised was real and M4 is what settled it.
  seq           bigserial   NOT NULL
);

COMMENT ON TABLE public.production_rung_dates IS
  'APPEND-ONLY. One row each time somebody states when a lot entered the container size it is in. '
  'A correction is a NEW ROW; nothing is overwritten and nothing is deleted. CURRENT is the latest '
  'row by (recorded_at, id) — there is no current flag and no current column, because a stored '
  '"current" is a second representation of these rows that will drift from them (R-27). Readiness '
  'is DERIVED: entered_on + the rung''s grow_months. Follows ANSI Z60.1 6.1.1.1, where a plant''s '
  'stage history is the record and age is derived from it rather than stored.';

COMMENT ON COLUMN public.production_rung_dates.entered_on IS
  'The day the lot went into its current container size. ENTERED by the grower, never inferred — '
  'a size-to-size transition cannot be read out of sales history (measured: every size sells in '
  'every quarter, 8 consecutive quarters at LAWNS).';

ALTER TABLE public.production_rung_dates ENABLE ROW LEVEL SECURITY;

-- 🔴 NO UPDATE POLICY AND NO DELETE POLICY FOR ANYBODY, INCLUDING THE OWNER — and that is the
-- append-only rule enforced rather than documented. The owner policy is deliberately FOR SELECT,
-- INSERT only, which DIVERGES from `production_plans`' `FOR ALL` owner policy: that table's rows
-- are plans, which are cancelled; these are statements of fact somebody made on a date.
-- 🔴 EVERY POLICY IS DROPPED-IF-EXISTS BEFORE IT IS CREATED, SO THIS FILE IS RE-RUNNABLE.
-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so a plain CREATE makes a migration fail on its
-- second run with `policy ... already exists` — and the failure ABORTS THE TRANSACTION, so every
-- statement after it is silently skipped too. ⚠️ FOUND BY RUNNING THIS FILE TWICE UNDER §6 r26,
-- not by reading it: the first pass executed cleanly and the second died on the first policy.
DROP POLICY IF EXISTS production_rung_dates_owner_select ON public.production_rung_dates;
DROP POLICY IF EXISTS production_rung_dates_owner_insert ON public.production_rung_dates;
DROP POLICY IF EXISTS production_rung_dates_member_select ON public.production_rung_dates;
DROP POLICY IF EXISTS production_rung_dates_member_insert ON public.production_rung_dates;

CREATE POLICY production_rung_dates_owner_select ON public.production_rung_dates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = production_rung_dates.business_id AND b.owner_id = auth.uid()));

CREATE POLICY production_rung_dates_owner_insert ON public.production_rung_dates
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = production_rung_dates.business_id AND b.owner_id = auth.uid()));

CREATE POLICY production_rung_dates_member_select ON public.production_rung_dates
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:read'));

-- `inventory:update`, not `inventory:create`: this is not a new lot, it is a statement about stock
-- that already exists. Measured at LAWNS 2026-09-05: MANAGER holds it, STAFF holds inventory:read
-- alone — so staff may read the schedule and may not date a block, which is correct and is enforced
-- by the policy rather than by hiding a control. NO NEW PERMISSION STRING IS MINTED.
CREATE POLICY production_rung_dates_member_insert ON public.production_rung_dates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'));

-- The append-only backstop. Same shape and same reasoning as
-- `reject_inventory_ledger_mutation` (20260720) — its own function, because the message names its
-- own table; the PATTERN is reused, the text is honest.
CREATE OR REPLACE FUNCTION public.reject_rung_date_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'production_rung_dates is append-only: % is not permitted (a correction is a NEW row, never an edit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_rung_dates_immutable ON public.production_rung_dates;
CREATE TRIGGER trg_rung_dates_immutable
  BEFORE UPDATE OR DELETE ON public.production_rung_dates
  FOR EACH ROW EXECUTE FUNCTION public.reject_rung_date_mutation();

-- The read this table exists for: the latest row for each lot of a business.
CREATE INDEX IF NOT EXISTS production_rung_dates_lot_idx
  ON public.production_rung_dates (business_id, inventory_id, recorded_at DESC, seq DESC);

COMMIT;

-- ══════════════════════════════════════════════════════
-- VERIFY — catalog-backed, never from memory (§9 schema gate).
-- 🔴 EVERY BLOCK BELOW WAS EXECUTED BEFORE THIS FILE WAS HANDED OVER, on PGlite against the real
-- migration text, by `scripts/sql-harness/rung-dates-391.pglite.mjs`. Verdicts are in ledger #391.
-- ══════════════════════════════════════════════════════
--
-- (V1) The table exists and RLS is ENABLED. Expect one row, rowsecurity = t.
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'production_rung_dates';
--
-- (V2) 🔴 NO UPDATE OR DELETE POLICY EXISTS FOR ANYONE, OWNER INCLUDED. Expect ZERO rows.
--      A row here means somebody can rewrite a statement of fact instead of correcting it.
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'production_rung_dates' AND cmd IN ('UPDATE','DELETE');
--
-- (V3) The four expected policies are present. Expect 4: owner_select, owner_insert,
--      member_select, member_insert.
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'production_rung_dates' ORDER BY policyname;
--
-- (V4) 🔴 THE APPEND-ONLY TRIGGER ACTUALLY REFUSES. A guard nobody has watched refuse is a claim
--      (R-33). BOTH statements must FAIL; the SELECT between them must still show the row.
--      🔴 THE ERROR IS THE PASS — if either statement SUCCEEDS, this has failed.
--   BEGIN;
--     INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on)
--     VALUES (:bid, (SELECT id FROM public.business_inventory WHERE business_id = :bid LIMIT 1), '2026-06-25');
--     -- expect: ERROR … production_rung_dates is append-only: UPDATE is not permitted
--     UPDATE public.production_rung_dates SET entered_on = '2020-01-01' WHERE business_id = :bid;
--   ROLLBACK;
--   BEGIN;
--     -- expect: ERROR … production_rung_dates is append-only: DELETE is not permitted
--     DELETE FROM public.production_rung_dates WHERE business_id = :bid;
--   ROLLBACK;
--
-- (V4b) 🔴 CURRENT IS DETERMINISTIC EVEN FOR TWO ROWS IN ONE TRANSACTION. Both inserts below share
--       a `recorded_at` (it is transaction time); `seq` is what decides. Expect the SECOND date.
--   BEGIN;
--     INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on)
--     VALUES (:bid, :lot, '2026-06-25'), (:bid, :lot, '2026-07-02');
--     SELECT entered_on FROM public.production_rung_dates
--     WHERE inventory_id = :lot ORDER BY recorded_at DESC, seq DESC LIMIT 1;   -- expect 2026-07-02
--   ROLLBACK;
--
-- (V5) `business_inventory` GAINED NO COLUMN — §0b, asserted rather than assumed. Expect ZERO rows.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'business_inventory'
--     AND column_name IN ('entered_on','potted_on','rung_started_on','current_rung_date');
--
-- (V6) 🔴 AC-3 CROSS-TENANT PROBE — run IMPERSONATED, not as postgres (as postgres RLS does not
--      apply and this returns every tenant's rows, which looks like a failure and is not).
--      Expect ZERO rows.
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<a user_id who is a member of ONE business>"}';
--   SELECT count(*) FROM public.production_rung_dates WHERE business_id <> ':bid_of_that_user';
--   RESET ROLE;
