# Migrations still waiting — what each does, whether it is still needed, and the SQL

**Date:** 2026-09-11 · **For:** David, to paste into Lightning and discuss · **Build:** ledger #294
**Measured by:** `node scripts/verify-migration-apply-state.mjs --catalog` (read-only) plus live checks of each file's own pre-conditions. **Nothing has been applied.**

Of 135 migration files, **4 are not applied.** Every other file is applied, deliberately superseded, or a data backfill whose effect is checked in `migration-data-checks.json`.

| Migration | Still needed? | Can it run today? |
|---|---|---|
| `20260905_production_planning` | 🔴 **YES — shipped code already depends on it** | Yes. Additive; its dependencies are live |
| `20260911_service_offerings_transport_requires_mode` | 🟡 Yes — it is R-120's database guard | 🔴 **No — it refuses while one test-tenant service has no mode** |
| `20260727d_drop_losses_and_nurseries` | 🟡 Not for anything to work — it finishes the noun purge | Yes. Its own safety checks pass |
| `20260529_pmi_shared` | ⚪ **No — retire it** (#248) | Would run, but nothing uses what it creates |

---

## 1 · `20260905_production_planning` — 🔴 NEEDED

**What it does:** creates three tables for the uppot planning build (R-84…R-92): `business_operations_config`, `production_plans`, `production_plan_lines`, with their policies, indexes, triggers and constraints. Additive only; it changes no existing table.

**Why it is needed — measured, not assumed:** shipped code reads and writes all three tables, and they do not exist (tech-debt #253):
- **Settings → Operations** (`OperationsSettings.tsx`) cannot save; its own trace logs *"operations settings write landed NOTHING"*.
- **The Uppot plan page** (`UppotPlan.tsx` → `uppotPlanWrite.ts`) cannot commit a plan.
- `productionHold.ts` reads `production_plan_lines` and logs the error.

**Can it run:** yes. It needs `is_active_member`, `has_permission` and `set_updated_at`, and all three are live.

**The choice:** apply it, or retire it **and** remove those two surfaces. Leaving both as they are means features that look shipped and fail.

**Apply in the SQL editor, never the table editor** (CLAUDE.md §6 r17 — this migration creates tables).

```sql
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
```

---

## 2 · `20260911_service_offerings_transport_requires_mode` — 🟡 NEEDED, BUT IT WILL REFUSE TODAY

**What it does:** adds a database constraint so a transport service must say who transports (`transport_mode`). It is the one form of R-120 that a future writer cannot forget. It repairs nothing.

**Why it will refuse:** its §0 stops if any transport service has no mode, and **one does** (measured):
- *Test David's new Business* → **Backyard Placement & Staging Service** (`category = transport`, `transport_mode` NULL)

**Before applying:** settle that one row in Settings → Services (staff, self, or not transport at all). Then apply.

⚠️ Its header says *"ledger #292"*; its ledger row is actually **#293**. Cosmetic, recorded so nobody chases it.

```sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260911 — A TRANSPORT SERVICE MUST SAY WHO TRANSPORTS (R-120 · ledger #292)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17).
--
-- WHY. On 2026-09-09 LAWNS's Trip Charge was written `category = 'transport'` with `transport_mode`
-- NULL and DID NOT APPEAR ON AN ORDER AT ALL. Checkout sorts transport rows by mode and nothing else,
-- so a NULL row matches no role and falls out without an error. The app now refuses that row on every
-- writer it has (`serviceOfferingShape.ts`, asked by the Settings editor, the books review and the
-- discovery seed). THIS is the only form of the rule a FOURTH writer cannot forget — tech-debt #218
-- says the next writer is coming, and every writer so far has restated the table's rules its own way.
--
-- WHAT IT DOES NOT DO — AND THIS IS THE HALF THAT MATTERS.
--   · It REPAIRS NOTHING. A half-bound row is the owner's decision (staff? self? not transport at all?)
--     and a row that has been invisible for weeks is a finding to see, not one to quietly start billing.
--   · So §0 REFUSES to run while any half-bound row exists, and names them. Settle those first.
--   · It is NOT `NOT VALID`. A NOT VALID constraint is still enforced on UPDATE, which would stop an
--     owner turning a broken row OFF — the one thing they should always be able to do.
--
-- ⚠️ ONE DIRECTION ONLY. It does not require a NON-transport row to carry NULL; that is the app's
-- clearing rule, never measured live, and a constraint on unmeasured rows is a guess (R-111).
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- §0 PRE-FLIGHT — refuse while any half-bound row exists. Repairs nothing.
DO $$
DECLARE
  n     int;
  names text;
BEGIN
  SELECT count(*), string_agg(format('%s [%s, active=%s]', so.name, b.name, so.is_active), '; ')
    INTO n, names
    FROM service_offerings so
    JOIN businesses b ON b.id = so.business_id
   WHERE so.category = 'transport' AND so.transport_mode IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'REFUSED — % transport service(s) carry no transport_mode: %. Each is the owner''s decision; settle them in Settings → Services, then run this again. Nothing was changed.', n, names;
  END IF;
END $$;

-- §1 THE CONSTRAINT — named explicitly. An inline CHECK is auto-named, and a grep for its name
-- could never find it (tech-debt #91). Idempotent: a second run is a no-op, not an error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.service_offerings'::regclass
       AND conname  = 'service_offerings_transport_requires_mode'
  ) THEN
    ALTER TABLE service_offerings
      ADD CONSTRAINT service_offerings_transport_requires_mode
      CHECK (category <> 'transport' OR transport_mode IS NOT NULL);
  END IF;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run AFTER applying. Read-only except V3, which writes nothing that survives.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the constraint exists, is VALIDATED, and says what the app says. EXPECT one row, convalidated = true.
-- SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
--   FROM pg_constraint
--  WHERE conrelid = 'public.service_offerings'::regclass
--    AND conname  = 'service_offerings_transport_requires_mode';
--
-- V2 — no half-bound row exists anywhere. EXPECT 0.
-- SELECT count(*) FROM service_offerings WHERE category = 'transport' AND transport_mode IS NULL;
--
-- V3 — THE REFUSAL, AND THE ACCEPTANCE, ON TEST DAVE'S. Both inserts are rolled back inside their own
-- sub-block, so NOTHING is left behind. EXPECT two rows, both starting PASS.
-- CREATE TEMP TABLE r120_proof (result text);
-- DO $$
-- BEGIN
--   BEGIN
--     INSERT INTO service_offerings (business_id, name, category, price_type, price_unit, price)
--     VALUES ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 probe — no mode', 'transport', 'flat', 'order', 1);
--     INSERT INTO r120_proof VALUES ('FAIL refusal: a transport row with NO mode was ACCEPTED');
--     RAISE EXCEPTION 'r120-undo';
--   EXCEPTION
--     WHEN check_violation THEN INSERT INTO r120_proof VALUES ('PASS refusal: ' || SQLERRM);
--     WHEN raise_exception THEN IF SQLERRM <> 'r120-undo' THEN RAISE; END IF;
--   END;
--   BEGIN
--     INSERT INTO service_offerings (business_id, name, category, price_type, price_unit, price, transport_mode, requires_address)
--     VALUES ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 probe — staff', 'transport', 'flat', 'order', 1, 'staff', true);
--     RAISE EXCEPTION 'r120-undo';
--   EXCEPTION
--     WHEN raise_exception THEN
--       IF SQLERRM = 'r120-undo' THEN INSERT INTO r120_proof VALUES ('PASS acceptance: a transport row WITH a mode was accepted (then undone)');
--       ELSE RAISE; END IF;
--     WHEN OTHERS THEN INSERT INTO r120_proof VALUES ('FAIL acceptance: ' || SQLERRM);
--   END;
-- END $$;
-- SELECT * FROM r120_proof;
-- -- and confirm nothing survived — EXPECT 0:
-- SELECT count(*) FROM service_offerings WHERE name LIKE 'ZZ R-120 probe%';
```

---

## 3 · `20260727d_drop_losses_and_nurseries` — 🟡 SAFE, NOT URGENT

**What it does:** drops `losses` and `nurseries`, the empty pre-`businesses` generation (ledger #162). Loss recording is still planned, on `plant_events['lost']`, not on this table.

**Why it is safe — measured:** both tables have **0 rows**. Nothing else depends on them (0 dependent views). The only foreign keys run between the two and outward to `auth.users` and `cultivar_plants`, which its own checks allow. The one piece of app code that reads `nurseries` (`hooks/useNursery.ts`) is **imported by nothing** — `useNursery` elsewhere is an alias for the business context.

**What it buys:** it finishes the AC-1 noun purge, and it removes `nurseries_select_public`, **one of the six policies still readable by anyone**. It gates nothing else.

**Its header's instruction stands:** *APPLY AS postgres — ONLY ON DAVID'S SAY-SO.*

```sql
-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727d — DROP the pre-`businesses` generation: `losses`, then `nurseries`
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres — **ONLY ON DAVID'S SAY-SO.** Dropping tables is not a side effect of a
-- security pass, so this ships as its own commit and its own decision.
--
-- ── WHAT THESE TWO WERE ─────────────────────────────────────────────────────────
-- `nurseries` was the ORIGINAL TENANT TABLE and `losses` was its LOSS LEDGER — one generation
-- of the schema, superseded by `businesses` and never dropped. The generational marker is on
-- the column: `losses` keys on `nursery_id`, not `business_id`. It was specced in
-- CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md (a `/dashboard/losses` page, a staff "record losses"
-- permission, a CREATE TABLE at line 380) and NONE of it was built — no page, no route, no
-- permission string, no client call, no migration (tech-debt **#39** — the CULTIVAR live-only
-- schema class, NOT #27, which is Ignition tables only).
--
-- ⚠️ THIS IS NOT ABANDONMENT BY ASSUMPTION. Loss recording IS still a planned capability; it is
-- planned on a DIFFERENT SHAPE, and that choice predates this drop. The pricing-intelligence
-- story's Layer 3 ("great losses / shrinkage on this line") reads `plant_events` with
-- `event_type = 'lost'` (packages/cultivar-os/src/types/plant.ts:48). It was written down in
-- docs/concepts/margin-aware-pricing-intelligence.md:96 — "treat plant_events['lost'] as the
-- real source, not the orphan `losses` table." Dropping `losses` removes an orphan, not the
-- shape the feature will use.
--
-- `nurseries` carried `qb_access_token` / `qb_refresh_token` columns and a
-- `nurseries_select_public` policy — SELECT **TO public USING (true)**, world-readable. It held
-- ZERO ROWS and ZERO TOKENS: the QB OAuth relocation (20260622) took the values with it and left
-- an empty husk still carrying a public read. **Nothing was ever exposed. That is precisely why
-- this is CLEANUP and not a finding** — no incident, no disclosure, no remediation window. What
-- is being removed is the room, not a leak: a table nobody writes and anyone on the internet may
-- SELECT from is one stray INSERT away from being a real one.
--
-- AC-1 bonus, stated but not the reason: both are VERTICAL NOUNS in shared schema (§1.5 Noun
-- Purge). Their successor is `businesses`.
--
-- SIDE EFFECT, NAMED RATHER THAN SILENT: `losses` sits on the owner-only list in
-- docs/decisions/2026-07-27-rbac-transition-execution-plan.md:288 (a MANAGER holding a
-- permission cannot read a row). That row is retired BY REMOVAL, not by being fixed. Strike it
-- from the plan; do not leave it reading as an unresolved gap.
--
-- ── ORDER AND FORCE ─────────────────────────────────────────────────────────────
-- `losses_nursery_id_fkey` references `nurseries` FROM `losses`. **`losses` drops FIRST and the
-- constraint dissolves with it.** The constraint is NEVER dropped separately to force `nurseries`
-- through — that would be defeating the check that found the dependency rather than satisfying
-- it. Both DROPs are RESTRICT, never CASCADE: if anything still depends on either, this must FAIL
-- LOUDLY, not quietly take a dependent object with it.
--
-- ── EMPTINESS IS RE-CONFIRMED HERE, NOT INHERITED (STD-021 / ledger #159) ───────
-- David probed both at 0 rows. **That claim is NOT trusted by this file.** #159's lesson is that
-- an emptiness claim goes stale between the probe and the apply, so the guard below re-reads the
-- catalog INSIDE the transaction and ABORTS the whole thing if anything has changed. A DROP is
-- irreversible; a stale premise is how an irreversible thing goes wrong.

BEGIN;

-- ── GUARD — runs at APPLY TIME, aborts on any surprise. Not a comment; not dismissible.
--    Covers all three of: rows present · dependent object (pg_depend) · FK from a third table.
DO $$
DECLARE
  v_losses_rows    bigint;
  v_nurseries_rows bigint;
  v_dep            text;
  v_fk             text;
BEGIN
  -- (1) EMPTINESS, re-read now.
  IF to_regclass('public.losses') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.losses' INTO v_losses_rows;
    IF v_losses_rows <> 0 THEN
      RAISE EXCEPTION
        'ABORT: public.losses has % row(s). The premise of this migration is that it is empty. Rows mean this is a DIFFERENT FINDING — stop and report, do not drop.', v_losses_rows;
    END IF;
  END IF;

  IF to_regclass('public.nurseries') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.nurseries' INTO v_nurseries_rows;
    IF v_nurseries_rows <> 0 THEN
      RAISE EXCEPTION
        'ABORT: public.nurseries has % row(s) — a stray INSERT landed since the probe. Stop and report.', v_nurseries_rows;
    END IF;
  END IF;

  -- (2) ANY dependent object — view, matview, function, trigger, rule, default, index.
  --     Catalog, not grep: neither table has a migration, so source is blind by construction.
  --     Self-dependencies (the tables' own columns/constraints/indexes/types) are excluded.
  SELECT string_agg(DISTINCT format('%s %s', d.classid::regclass, d.objid::text), ', ')
    INTO v_dep
    FROM pg_depend d
   WHERE d.refobjid IN (
           COALESCE(to_regclass('public.losses'),    0::oid),
           COALESCE(to_regclass('public.nurseries'), 0::oid))
     AND d.deptype IN ('n','a')                       -- normal + auto: real dependents
     AND d.classid <> 'pg_class'::regclass            -- exclude own indexes/toast
     AND NOT (d.classid = 'pg_constraint'::regclass)  -- FKs handled explicitly below
     AND NOT (d.classid = 'pg_type'::regclass)        -- own composite rowtype
     AND NOT (d.classid = 'pg_attrdef'::regclass);    -- own column defaults
  IF v_dep IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: dependent object(s) on losses/nurseries: %. Investigate before dropping.', v_dep;
  END IF;

  -- (3) FK from a THIRD table (i.e. any inbound FK that is not losses -> nurseries).
  --     losses -> nurseries is EXPECTED and dissolves with the losses drop.
  SELECT string_agg(format('%s ON %s', c.conname, c.conrelid::regclass), ', ')
    INTO v_fk
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.confrelid IN (
           COALESCE(to_regclass('public.losses'),    0::oid),
           COALESCE(to_regclass('public.nurseries'), 0::oid))
     AND c.conrelid NOT IN (
           COALESCE(to_regclass('public.losses'),    0::oid),
           COALESCE(to_regclass('public.nurseries'), 0::oid));
  IF v_fk IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: inbound FK from a third table: %. Resolve that table first.', v_fk;
  END IF;

  RAISE NOTICE 'GUARD PASSED — losses=% rows, nurseries=% rows, no dependents, no third-table FK.',
    COALESCE(v_losses_rows, -1), COALESCE(v_nurseries_rows, -1);
END $$;

-- ── FK ORDER: the ledger before the tenant table it points at.
DROP TABLE IF EXISTS public.losses    RESTRICT;
DROP TABLE IF EXISTS public.nurseries RESTRICT;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run after COMMIT.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── V1 — NEGATIVE: both tables gone. EXPECT 0 rows.
-- SELECT tablename FROM pg_tables
--  WHERE schemaname='public' AND tablename IN ('losses','nurseries');

-- ── V2 — NEGATIVE: their policies went with them, incl. nurseries_select_public. EXPECT 0 rows.
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname='public' AND tablename IN ('losses','nurseries');

-- ── V3 — NEGATIVE: the FK is gone because the table is, not because we dropped it. EXPECT 0.
-- SELECT conname FROM pg_constraint WHERE conname = 'losses_nursery_id_fkey';

-- ── V4 — the unscoped-public set is now FIVE, not six. Corpus is BOTH roles — `TO public`
--    INCLUDES anon, which the first N6 sweep missed by grepping the anon role alone.
-- SELECT tablename, policyname, cmd, roles::text FROM pg_policies
--  WHERE schemaname='public' AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
--    AND qual = 'true'
--  ORDER BY tablename;

-- ── V5 — POSITIVE: the successor shape is untouched. plant_events still carries the loss
--    signal the pricing-intelligence story reads. EXPECT 1 row.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='plant_events';
```

---

## 4 · `20260529_pmi_shared` — ⚪ NOT NEEDED — RETIRE

**What it does:** creates `pmi_assets` and `pmi_service_logs`.

**Why it is not needed:** it never ran, **no code uses either table**, and its job went to the `business_*` tables in `20260612_business_assets_inventory_pmi_service.sql`. Applying it now would create two unused tables. The only cost of leaving it is that every apply-state run lists it as not applied, beside the migrations that really are waiting on you (tech-debt #248).

**The choice:** leave it and accept that noise, or move it out of `supabase/migrations/` (it never ran, so nothing applied depends on it). Other documents cite it, so this is your call.

```sql
-- Migration: Shared PMI (Preventive Maintenance)
-- Works identically for every vertical — tools, farm equipment, HVAC units, vehicles.
-- Tenant anchor: business_id (references businesses table).

CREATE TABLE IF NOT EXISTS pmi_assets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  asset_type        text,
  make              text,
  model             text,
  serial_number     text,
  year              int,
  pmi_interval_days int,
  last_service_at   timestamptz,
  notes             text,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pmi_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY pmi_assets_owner ON pmi_assets
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS pmi_service_logs (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid          NOT NULL REFERENCES pmi_assets(id) ON DELETE CASCADE,
  business_id   uuid          NOT NULL REFERENCES businesses(id),
  service_type  text          NOT NULL,
  performed_by  text,
  notes         text,
  cost          numeric(10,2),
  performed_at  timestamptz   NOT NULL DEFAULT now(),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE pmi_service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pmi_service_logs_owner ON pmi_service_logs
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS pmi_assets_business_idx     ON pmi_assets     (business_id, is_active);
CREATE INDEX IF NOT EXISTS pmi_service_logs_asset_idx  ON pmi_service_logs (asset_id, performed_at DESC);
```
