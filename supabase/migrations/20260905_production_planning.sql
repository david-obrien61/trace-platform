-- ══════════════════════════════════════════════════════
-- 20260905_production_planning.sql — THE PLAN IS THE HOLD
-- Ledger #276 · David applies · TENANT-AGNOSTIC (no tenant id appears anywhere below)
-- ══════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17:
-- the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS
-- cannot filter TRUNCATE). This migration CREATES TABLES, so unlike 20260903 that rule is
-- load-bearing here rather than belt-and-braces.
--
-- ADDITIVE ONLY. Three NEW tables. NOTHING existing is altered, dropped or backfilled — in
-- particular `business_inventory` gains NO column, which is the whole point (see §0). No existing
-- policy is touched. No existing row is written.
--
-- ── §0 🔴 WHY THERE IS NO `held_qty` COLUMN ────────────────────────────────────────
-- David ruled it 2026-09-05: the hold is DERIVED from open plan lines, exactly as committed stock
-- is derived from open orders. `inventoryStates.ts` states the rule for the number next door:
--   "STD-011 is the reason committed/available are derived and not columns: on-hand is ONE number,
--    and a stored `committed` would be a second representation of the open orders that WILL drift
--    from them. The orders ARE the commitment; we read them."
-- R-27 is the general form — "A DERIVED COLUMN IS A PROJECTION OF ITS SOURCE OR IT IS A SECOND
-- TRUTH, AND THERE IS NO THIRD OPTION" — and tech-debt #71 is that defect already live on
-- `status`: two authors, the reverting one wins, and nothing says so. A `held_qty` column would be
-- a number that can disagree with the plan that created it, and nothing would say which was right.
--
-- ── §0b 🔴 WHY THE NAMES CARRY NO VERTICAL NOUN (AC-1) ─────────────────────────────
-- "Uppot" is nursery vocabulary. AC-1: "Vertical identity is a value (`business_type`), never a
-- table name, column, or identifier." The precedent is `responsibilityCatalogue.ts`, where
-- "Uppot or graduate a lot and record it" is a `text` VALUE on a row whose `vertical` FIELD carries
-- the identity. So the tables are `production_*`, the columns speak in unit values, and the word
-- "uppot" appears only in the cultivar-os surface copy (AC-4: structure shared, vocabulary varies).
--
-- ── §0c ROW-LEVEL SECURITY, AND THE PERMISSION IT USES ─────────────────────────────
-- Both plan tables carry the dual-policy shape verify-universals asserts (#3: owner + member) and
-- the member policies are gated on `inventory:*` — the strings the plan surface already needs. NO
-- NEW PERMISSION STRING is minted. Measured live at LAWNS 2026-09-05 (3 member rows): MANAGER
-- holds inventory:read/create/update, so the production manager can build and commit a plan;
-- STAFF holds inventory:read ALONE, so staff may look and may not hold stock, which is correct and
-- is enforced by the policy rather than by hiding a button.
-- `business_operations_config` is gated on `settings:read` / `settings:update` — MANAGER holds
-- both, which is why the non-money constants live there and the labour rate does not.
--
-- ── §0d NO HARD DELETE ─────────────────────────────────────────────────────────────
-- A plan is CANCELLED, never deleted: the row is the record of a decision somebody made about
-- stock. There is no DELETE policy for a member on either plan table, so the only way to end a plan
-- is to set its status — and `cancelled` releases the hold exactly as `completed` does.
-- ══════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — business_operations_config : the NON-MONEY constants
-- ════════════════════════════════════════════════════════════════════════════════
-- One row per business, on the `business_pricing_config` precedent (20260621) exactly: a jsonb
-- blob rather than a column per constant, because this vocabulary GROWS (mixer output, recovery
-- rate, seasonal dates all arrived in one conversation) and a migration per constant is the cost
-- that stops constants being recorded at all.
CREATE TABLE IF NOT EXISTS public.business_operations_config (
  business_id uuid        PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  config      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_operations_config IS
  'Per-business NON-MONEY production constants: volumes, times, crew sizes, rates of work, months, '
  'percentages, pot recovery, the working window. Readable by anyone holding settings:read, which '
  'includes MANAGER — deliberately, because the production manager runs the plan these feed. The '
  'MONEY constants (labour rates, pot prices) stay in business_pricing_config behind '
  'pricing_recipe:read. The blended mix cost per cubic yard is the ONE money value released to the '
  'operations reader, by David''s ruling 2026-09-05: the plan''s right-hand side is meaningless '
  'without it and the production manager is who would notice bark going up.';

ALTER TABLE public.business_operations_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_operations_config_owner_all ON public.business_operations_config
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_operations_config.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_operations_config.business_id AND b.owner_id = auth.uid()));

CREATE POLICY business_operations_config_member_select ON public.business_operations_config
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:read'));

CREATE POLICY business_operations_config_member_insert ON public.business_operations_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

CREATE POLICY business_operations_config_member_update ON public.business_operations_config
  FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

DROP TRIGGER IF EXISTS business_operations_config_updated_at ON public.business_operations_config;
CREATE TRIGGER business_operations_config_updated_at
  BEFORE UPDATE ON public.business_operations_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();


-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — production_plans : one planning run
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.production_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  -- The window in which the work may happen. A plan whose last batch finishes after window_end is
  -- OVERRUNNING, and the surface says so BEFORE the plan is committed, never after.
  window_start  date,
  window_end    date,
  status        text        NOT NULL DEFAULT 'draft',
  -- The batch size the plan was costed at. Stored because it is the LEVER (R-86) — the same pots
  -- at batches of 10 or 120 is 187 crew-hours or 73 — so a plan without it cannot be re-read later
  -- and understood.
  batch_size    int         NOT NULL DEFAULT 40,
  -- ONE reason for the batch, not fourteen. E7's commit moment: the cells are inputs to one
  -- decision, and the decision is the plan.
  reason        text,
  created_by    uuid,
  committed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- NAMED, not inline. An inline CHECK is auto-named by Postgres, so its name is never typed and a
-- `conname` grep can never find it — which is exactly why ~129 inline CHECKs are invisible to the
-- tech-debt #23 sweep and how the #91 platform-vocabulary disagreement went unmeasured for months.
-- The plan lifecycle is a genuinely CLOSED axis, so it EARNS a constraint; adding a fifth state is
-- a migration, and it should be, because a state absent from this list holds stock by default in
-- `holdsStock()` and that is an inventory operation.
ALTER TABLE public.production_plans DROP CONSTRAINT IF EXISTS production_plans_status_check;
ALTER TABLE public.production_plans ADD CONSTRAINT production_plans_status_check
  CHECK (status IN ('draft', 'open', 'completed', 'cancelled'));

COMMENT ON COLUMN public.production_plans.status IS
  'draft | open | completed | cancelled. draft and open HOLD stock; completed and cancelled release '
  'it. draft holds deliberately — a manager part-way through deciding should not have the stock he '
  'is planning around sold out from under him. Fail toward not overselling.';

ALTER TABLE public.production_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY production_plans_owner_all ON public.production_plans
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = production_plans.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = production_plans.business_id AND b.owner_id = auth.uid()));

CREATE POLICY production_plans_member_select ON public.production_plans
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:read'));

CREATE POLICY production_plans_member_insert ON public.production_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:create'));

CREATE POLICY production_plans_member_update ON public.production_plans
  FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'));
-- 🔴 NO MEMBER DELETE POLICY, AND THAT IS THE NO-HARD-DELETE RULE ENFORCED RATHER THAN DOCUMENTED.

DROP TRIGGER IF EXISTS production_plans_updated_at ON public.production_plans;
CREATE TRIGGER production_plans_updated_at
  BEFORE UPDATE ON public.production_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE INDEX IF NOT EXISTS production_plans_business_status_idx
  ON public.production_plans (business_id, status);


-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — production_plan_lines : one batch. ONE BATCH, ONE COMPLETION, ONE DATE.
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 R-88: David killed per-day cohorts. "the date tags would have to have the exact date not the
-- month… if the date tag got removed or lost then we don't know which exact day this particular
-- tree was uppotted. that will be too strict and it will fail." So DAILY PROGRESS is a measurement
-- that moves no stock and tags nothing, and BATCH COMPLETION is the event: the whole line moves as
-- ONE cohort on ONE date. There is deliberately NO per-day table here.
CREATE TABLE IF NOT EXISTS public.production_plan_lines (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id               uuid        NOT NULL REFERENCES public.production_plans(id) ON DELETE CASCADE,
  -- Denormalised for RLS: a policy that had to join through production_plans to find the tenant
  -- would be evaluated per row on every read of the grid. AC-3 is asserted directly on the row.
  business_id           uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  source_inventory_id   uuid        NOT NULL REFERENCES public.business_inventory(id) ON DELETE RESTRICT,
  -- NULL until the destination lot exists. A 15-gallon Brodie Juniper lot may simply not be there
  -- yet, and forcing one to be created at planning time would mint 400 empty lots for a plan that
  -- may never be committed.
  target_inventory_id   uuid        REFERENCES public.business_inventory(id) ON DELETE RESTRICT,

  -- The rung, as NUMBERS from the unit projection, never as the raw `size` string. Measured at
  -- LAWNS 2026-09-04: 447 rows carry 46 distinct spellings of `size` that fold to 13 unit_value
  -- numbers — six spellings of "30" summing to exactly the 90 rows at unit_value 30. Keying a plan
  -- on the string would split one rung six ways.
  from_unit_value       numeric     NOT NULL,
  to_unit_value         numeric     NOT NULL,

  qty_planned           int         NOT NULL,
  qty_completed         int         NOT NULL DEFAULT 0,

  -- The inputs the split was computed from, stored so the plan can be re-read and understood later
  -- rather than silently recomputed against constants that have since moved.
  sales_per_month       numeric,
  cover_months          numeric,
  cushion_pct           numeric,
  grow_months           numeric,

  scheduled_date        date,
  completed_date        date,
  completed_by          uuid,
  -- Required when completed_date is earlier than the day it was recorded. Stamping today when the
  -- work finished three weeks ago makes the sellable date and every forecast on it three weeks
  -- wrong, so the backdate carries a reason and an author.
  backdate_reason       text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_plan_lines DROP CONSTRAINT IF EXISTS production_plan_lines_qty_check;
ALTER TABLE public.production_plan_lines ADD CONSTRAINT production_plan_lines_qty_check
  CHECK (qty_planned >= 0 AND qty_completed >= 0 AND qty_completed <= qty_planned);

-- A rung must go UP. A "promotion" to the same size or a smaller one is not a data point we have a
-- meaning for, and allowing it would let `mixCubicYardsPerPot` be asked for a negative volume.
ALTER TABLE public.production_plan_lines DROP CONSTRAINT IF EXISTS production_plan_lines_rung_check;
ALTER TABLE public.production_plan_lines ADD CONSTRAINT production_plan_lines_rung_check
  CHECK (to_unit_value > from_unit_value);

-- 🔴 A BACKDATED COMPLETION CARRIES A REASON, AND THE DATABASE SAYS SO RATHER THAN THE CLIENT.
-- The client validates this too (`validateCompletion`), but a guard the write does not depend on is
-- advice rather than a gate (STD-023). This CHECK cannot express "earlier than the day it was
-- RECORDED" — that day is not stored — so it asserts the weaker, checkable form: a completion
-- dated before its own row's creation date is a backdate and needs a reason.
ALTER TABLE public.production_plan_lines DROP CONSTRAINT IF EXISTS production_plan_lines_backdate_check;
ALTER TABLE public.production_plan_lines ADD CONSTRAINT production_plan_lines_backdate_check
  CHECK (
    completed_date IS NULL
    OR completed_date >= created_at::date
    OR (backdate_reason IS NOT NULL AND btrim(backdate_reason) <> '')
  );

COMMENT ON TABLE public.production_plan_lines IS
  'One BATCH: a quantity of one lot moving from one container size to a larger one. The batch is '
  'the unit of completion — one cohort, one date — because a per-day cohort would need a date tag '
  'on every tree that survives the season, and a lost tag would lose the date. Daily progress is a '
  'measurement recorded elsewhere; it moves no stock. The unfinished remainder of a line on an open '
  'plan IS the hold on its source lot — there is no held_qty column anywhere.';

ALTER TABLE public.production_plan_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY production_plan_lines_owner_all ON public.production_plan_lines
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = production_plan_lines.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = production_plan_lines.business_id AND b.owner_id = auth.uid()));

CREATE POLICY production_plan_lines_member_select ON public.production_plan_lines
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:read'));

CREATE POLICY production_plan_lines_member_insert ON public.production_plan_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:create'));

CREATE POLICY production_plan_lines_member_update ON public.production_plan_lines
  FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'));
-- 🔴 NO MEMBER DELETE POLICY — see §0d.

DROP TRIGGER IF EXISTS production_plan_lines_updated_at ON public.production_plan_lines;
CREATE TRIGGER production_plan_lines_updated_at
  BEFORE UPDATE ON public.production_plan_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- The hold read: every open line for a business, by source lot. This index is the one that keeps
-- `fetchHeldByLot` cheap on the checkout path.
CREATE INDEX IF NOT EXISTS production_plan_lines_source_idx
  ON public.production_plan_lines (business_id, source_inventory_id);
CREATE INDEX IF NOT EXISTS production_plan_lines_plan_idx
  ON public.production_plan_lines (plan_id);

COMMIT;

-- ══════════════════════════════════════════════════════
-- VERIFY — David runs these AFTER apply. Catalog-backed, never from memory (§9 schema gate).
-- Substitute a real business_id for :bid where one appears.
-- ══════════════════════════════════════════════════════
--
-- (A) All three tables exist and RLS is ENABLED on each. Expect 3 rows, all rowsecurity = t.
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('business_operations_config','production_plans','production_plan_lines')
--   ORDER BY relname;
--
-- (B) Every table has BOTH an owner policy and a member SELECT policy (verify-universals #3).
--     Expect 4 + 4 + 4 = 12 rows.
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename IN ('business_operations_config','production_plans','production_plan_lines')
--   ORDER BY tablename, policyname;
--
-- (C) 🔴 NO DELETE POLICY FOR A MEMBER on either plan table — the no-hard-delete rule.
--     Expect ZERO rows. A row here means a member can destroy the record of a stock decision.
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('production_plans','production_plan_lines')
--     AND cmd = 'DELETE' AND policyname NOT LIKE '%owner_all%';
--
-- (D) 🔴 `business_inventory` GAINED NO COLUMN. This is the §0 ruling, asserted rather than assumed.
--     Expect ZERO rows.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'business_inventory'
--     AND column_name IN ('held_qty','held_for_uppot','uppot_hold','production_hold');
--
-- (E) The named CHECKs exist and are findable BY NAME (tech-debt #91's lesson). Expect 4 rows.
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid IN ('public.production_plans'::regclass,'public.production_plan_lines'::regclass)
--     AND contype = 'c'
--   ORDER BY conname;
--
-- (F) 🔴 AC-3 CROSS-TENANT PROBE — the one that matters, and it must be run IMPERSONATED, not as
--     postgres (as postgres RLS does not apply and this returns rows for every tenant, which looks
--     like a failure and is not). Expect ZERO rows: a member of business A sees no line of B.
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<a user_id who is a member of ONE business>"}';
--   SELECT count(*) FROM public.production_plan_lines WHERE business_id <> ':bid_of_that_user';
--   RESET ROLE;
--
-- (G) 🔴 THE BACKDATE CHECK ACTUALLY REFUSES. A guard nobody has watched refuse is a claim (R-33).
--     The first statement must FAIL with production_plan_lines_backdate_check; the second succeed.
--     Run inside a transaction and roll it back.
--   BEGIN;
--     -- expect: ERROR ... violates check constraint "production_plan_lines_backdate_check"
--     INSERT INTO public.production_plan_lines
--       (plan_id, business_id, source_inventory_id, from_unit_value, to_unit_value,
--        qty_planned, completed_date)
--     VALUES ('<a real plan id>', ':bid', '<a real lot id>', 30, 45, 10, '2020-01-01');
--   ROLLBACK;
--   BEGIN;
--     -- expect: INSERT 0 1
--     INSERT INTO public.production_plan_lines
--       (plan_id, business_id, source_inventory_id, from_unit_value, to_unit_value,
--        qty_planned, completed_date, backdate_reason)
--     VALUES ('<a real plan id>', ':bid', '<a real lot id>', 30, 45, 10, '2020-01-01', 'finished before the button was pressed');
--   ROLLBACK;
--
-- (H) The rung check refuses a sideways or downward move. Expect the first to FAIL.
--   BEGIN;
--     INSERT INTO public.production_plan_lines
--       (plan_id, business_id, source_inventory_id, from_unit_value, to_unit_value, qty_planned)
--     VALUES ('<a real plan id>', ':bid', '<a real lot id>', 30, 30, 1);
--   ROLLBACK;
