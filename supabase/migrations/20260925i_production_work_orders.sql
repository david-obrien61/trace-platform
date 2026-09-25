-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925i — YARD WORK ORDERS, AND A BUILD THAT TIMES ITSELF · ledger #413 · P5 + P6
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✏️ **RENUMBERED 2026-09-26 (ledger #416): THIS FILE WAS `20260925d_…`, AND THAT SLOT WAS TAKEN TWICE OVER.**
-- `npm run migration:slot` on 2026-09-26 showed slot **c with THREE claimants** and **d with TWO**, across
-- `origin/main` and David's uncommitted folder. A person told to *"apply 20260925c"* would have had two
-- different files to choose from — Rule 11b's exact defect, *"and a collision here is NOT a merge conflict"*.
-- 🔴 **MINE MOVED RATHER THAN THEIRS, AND THE REASON IS MEASURED: all four of mine were UNAPPLIED** (verified
-- live 2026-09-26 — `install_kit_components`, `production_work_orders`, `item_sale_units` and
-- `build_runs.started_at` all absent), so renaming them is legitimate; renaming an applied migration is not
-- (§6 r1). **The old name `20260925d_…` is SUPERSEDED and must not be used.** Ledger #413 is unchanged.
-- ⚠️ The SHA in any note written before 2026-09-26 refers to the old filename and is stale; the current one
-- is in `~/Desktop/MORNING-2026-09-26.md`.
--
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David, 2026-09-25) ─────────────────────────────────────────────────────────────────
-- *"A work order = date + crew (reuse Teams) + lines (items or lots) + status (planned / in progress
-- / done) + notes; types: MIX BATCH (Done → runs the build) and UPPOT (Done → records the potting
-- date)."* And for P5: *"batch time per item is measured from real builds and shown ('measured over N
-- batches'), never assumed."*
--
-- 🔴 **NO YARD WORK ORDER EXISTS TODAY, MEASURED NOT ASSUMED.** LIVE 2026-09-25, the only work-order
-- shaped table is `business_pmi_schedule`, which is EQUIPMENT maintenance. There is nothing to
-- dispatch a crew to make mix or pot trees with.
--
-- ── 🔴 NAMED `production_*`, AND THE NAME IS A RULING APPLIED RATHER THAN A PREFERENCE ────────
-- **NOT `work_orders`.** [[R-168]] renamed `teams` → `delivery_teams` for exactly this reason: a BARE,
-- generic table name collides with the donor codebase and, worse, **breaks every cap that matches on a
-- bare table name.** `work_orders` is the most generic name in this package.
-- **NOT `yard_work_orders` either** — "yard" leans vertical, and AC-1 says vertical identity is a
-- value, never a table name. `production_*` is the family that already exists (`production_plans`,
-- `production_plan_lines`, `production_rung_dates`), it is neither bare nor vertical, and a reader
-- looking for the work orders will find them beside the plans.
--
-- ⚠️ **AND THE FK IS TO `delivery_teams`, NOT `teams`, BECAUSE THE RENAME IS ALREADY LIVE.** Verified
-- against the database 2026-09-25: `delivery_teams` (8 columns) and `delivery_team_members` (7) exist;
-- **`teams` does not.** [[R-168]] said "tomorrow not today" — tomorrow has happened. A migration
-- written against `teams` would have failed to apply, and the snapshot in the repo still shows neither,
-- so only a live read could say. **`team_id` is NULLABLE: a job can be scheduled before a crew is put
-- on it, and a crew that is retired leaves the job standing ([[R-133]]).**
--
-- ── STATUS AND ORIGIN ARE TWO DIFFERENT QUESTIONS, AND THEY GET TWO COLUMNS ───────────────────
-- `status` is WHERE the job is: `draft · planned · in_progress · done · cancelled`.
-- `origin` is WHO PROPOSED it: `person · suggested`.
-- 🔴 **THEY ARE NOT ONE COLUMN, AND THAT MATTERS FOR P7.** A shortage planner proposes a DRAFT with
-- `origin = 'suggested'`; a person confirming it moves the STATUS to `planned` while the origin stays
-- `suggested` for ever — so *"did a person ask for this, or did the platform?"* is still answerable
-- after it is confirmed, which is the question you want when a batch turns out to be unnecessary.
-- David: *"A draft is a suggestion: a person confirms, moves or deletes it."*
--
-- ── 🔴 TIMING: MEASURED, AND THE CHECKS MAKE A NONSENSE IMPOSSIBLE RATHER THAN UNLIKELY ───────
-- `started_at` / `finished_at` on both the work order and `build_runs`. Three CHECKs: you cannot
-- finish what never started; you cannot finish before you start; and **`status = 'done'` REQUIRES a
-- `finished_at`**, so "done" always carries the fact that makes the batch time computable.
-- ⚠️ **`item_recipes.build_minutes` AND `build_minutes_because` ALREADY EXIST** and are not touched.
-- This migration adds no estimate anywhere — the derivation *"measured over N batches"* reads the real
-- runs, and LAWNS has never timed one, so today the honest answer is that there is no figure.
--
-- ── DEPENDENCIES ─────────────────────────────────────────────────────────────────────────────
-- businesses · delivery_teams · item_recipes · build_runs · production_rung_dates ·
-- record_build_run · is_active_member · has_permission. All live.
-- OUTPUTS: production_work_orders · production_work_order_lines · 8 policies · the kind trigger ·
--          build_runs.started_at/finished_at · work_order_apply(uuid).
-- HARNESS: scripts/sql-harness/work-orders-413.pglite.mjs
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.production_work_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('mix_batch','uppot')),
  scheduled_for  date NOT NULL,
  -- NULL = nobody is on it yet. A retired crew leaves the job standing ([[R-133]]).
  team_id        uuid REFERENCES public.delivery_teams(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','planned','in_progress','done','cancelled')),
  -- WHO proposed it. Survives confirmation, so "did a person ask for this?" stays answerable.
  origin         text NOT NULL CHECK (origin IN ('person','suggested')),
  because        text NOT NULL CHECK (btrim(because) <> ''),
  notes          text,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wo_finish_needs_start   CHECK (finished_at IS NULL OR started_at IS NOT NULL),
  CONSTRAINT wo_finish_after_start   CHECK (finished_at IS NULL OR finished_at >= started_at),
  -- 🔴 DONE ALWAYS CARRIES THE FACT THAT MAKES THE BATCH TIME COMPUTABLE.
  CONSTRAINT wo_done_has_finished_at CHECK (status <> 'done' OR finished_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS pwo_by_day  ON public.production_work_orders (business_id, scheduled_for);
CREATE INDEX IF NOT EXISTS pwo_by_team ON public.production_work_orders (business_id, team_id, scheduled_for);

CREATE TABLE IF NOT EXISTS public.production_work_order_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  uuid NOT NULL REFERENCES public.production_work_orders(id) ON DELETE CASCADE,
  position       integer NOT NULL DEFAULT 1,
  -- A MIX BATCH line names a recipe and a batch count.
  recipe_id      uuid REFERENCES public.item_recipes(id) ON DELETE RESTRICT,
  batches        numeric CHECK (batches IS NULL OR batches > 0),
  -- An UPPOT line names a lot. No FK: the catalogue reload changes these ids (STD-019).
  inventory_id   uuid,
  quantity       numeric CHECK (quantity IS NULL OR quantity > 0),
  note           text,
  -- What happened when Done ran. NULL until it does; the RPC's own answer, stored verbatim.
  applied_at     timestamptz,
  applied_result jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pwol_by_order ON public.production_work_order_lines (work_order_id, position);

-- 🔴 A LINE MUST MATCH ITS ORDER'S KIND, AND A CHECK CANNOT SAY SO — the kind is on the parent.
-- Without this a mix-batch order could carry a lot and an uppot order a recipe, and nothing would
-- notice until Done tried to apply a line it had no way to apply.
CREATE OR REPLACE FUNCTION public.production_work_order_line_matches_kind()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM public.production_work_orders WHERE id = NEW.work_order_id;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'work order % does not exist', NEW.work_order_id;
  END IF;
  IF v_kind = 'mix_batch' THEN
    IF NEW.recipe_id IS NULL OR NEW.batches IS NULL THEN
      RAISE EXCEPTION 'a mix_batch line needs a recipe and a batch count (got recipe %, batches %)',
        NEW.recipe_id, NEW.batches;
    END IF;
    IF NEW.inventory_id IS NOT NULL THEN
      RAISE EXCEPTION 'a mix_batch line must not name a lot — it names the recipe that makes the item';
    END IF;
  ELSIF v_kind = 'uppot' THEN
    IF NEW.inventory_id IS NULL THEN
      RAISE EXCEPTION 'an uppot line needs the lot being potted on';
    END IF;
    IF NEW.recipe_id IS NOT NULL OR NEW.batches IS NOT NULL THEN
      RAISE EXCEPTION 'an uppot line must not name a recipe or a batch count — it names the lot';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pwol_matches_kind ON public.production_work_order_lines;
CREATE TRIGGER pwol_matches_kind
  BEFORE INSERT OR UPDATE ON public.production_work_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.production_work_order_line_matches_kind();

-- ── P5: A BUILD RECORDS WHEN IT STARTED AND WHEN IT FINISHED ─────────────────────────────────
-- `built_at` stays: it is when the run was RECORDED. These two are when the work happened.
ALTER TABLE public.build_runs
  ADD COLUMN IF NOT EXISTS started_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL;

COMMENT ON COLUMN public.build_runs.started_at IS
  'When the batch was actually started. NULL when nobody timed it — the batch-time figure then says so '
  'rather than borrowing an estimate (ledger #413).';

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.production_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_work_order_lines ENABLE ROW LEVEL SECURITY;

-- AC-2: membership for reads (a crew must see its own job), `inventory:update` for writes — the same
-- string that gates changing stock, because completing one of these MOVES stock.
DROP POLICY IF EXISTS pwo_member_select ON public.production_work_orders;
CREATE POLICY pwo_member_select ON public.production_work_orders
  FOR SELECT USING (public.is_active_member(business_id));
DROP POLICY IF EXISTS pwo_member_insert ON public.production_work_orders;
CREATE POLICY pwo_member_insert ON public.production_work_orders
  FOR INSERT WITH CHECK (public.is_active_member(business_id)
                         AND public.has_permission(business_id, 'inventory:update'));
DROP POLICY IF EXISTS pwo_member_update ON public.production_work_orders;
CREATE POLICY pwo_member_update ON public.production_work_orders
  FOR UPDATE USING (public.is_active_member(business_id)
                    AND public.has_permission(business_id, 'inventory:update'))
         WITH CHECK (public.is_active_member(business_id)
                     AND public.has_permission(business_id, 'inventory:update'));
DROP POLICY IF EXISTS pwo_member_delete ON public.production_work_orders;
CREATE POLICY pwo_member_delete ON public.production_work_orders
  FOR DELETE USING (public.is_active_member(business_id)
                    AND public.has_permission(business_id, 'inventory:update'));

-- The lines inherit their tenant through the parent — there is no business_id to scope on, and
-- copying one onto the child would be a second home for the same fact (STD-011).
DROP POLICY IF EXISTS pwol_member_select ON public.production_work_order_lines;
CREATE POLICY pwol_member_select ON public.production_work_order_lines
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.production_work_orders w
                             WHERE w.id = work_order_id AND public.is_active_member(w.business_id)));
DROP POLICY IF EXISTS pwol_member_insert ON public.production_work_order_lines;
CREATE POLICY pwol_member_insert ON public.production_work_order_lines
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.production_work_orders w
                                  WHERE w.id = work_order_id
                                    AND public.is_active_member(w.business_id)
                                    AND public.has_permission(w.business_id, 'inventory:update')));
DROP POLICY IF EXISTS pwol_member_update ON public.production_work_order_lines;
CREATE POLICY pwol_member_update ON public.production_work_order_lines
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.production_work_orders w
                             WHERE w.id = work_order_id
                               AND public.is_active_member(w.business_id)
                               AND public.has_permission(w.business_id, 'inventory:update')))
         WITH CHECK (EXISTS (SELECT 1 FROM public.production_work_orders w
                              WHERE w.id = work_order_id
                                AND public.is_active_member(w.business_id)
                                AND public.has_permission(w.business_id, 'inventory:update')));
DROP POLICY IF EXISTS pwol_member_delete ON public.production_work_order_lines;
CREATE POLICY pwol_member_delete ON public.production_work_order_lines
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.production_work_orders w
                             WHERE w.id = work_order_id
                               AND public.is_active_member(w.business_id)
                               AND public.has_permission(w.business_id, 'inventory:update')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_work_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_work_order_lines TO authenticated;
REVOKE ALL ON public.production_work_orders FROM anon;
REVOKE ALL ON public.production_work_order_lines FROM anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- work_order_apply — WHAT "DONE" DOES, AND IT DELEGATES RATHER THAN REIMPLEMENTS
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 IT ADDS NO STOCK LOGIC OF ITS OWN. A mix_batch line calls `record_build_run`, the one function
-- that owns moving components out and finished units in — so the test-mode ledger guard, the
-- permission check, the component resolution and the rounding report all come for free and **cannot
-- drift from the single caller they already have** (§6 r8). An uppot line inserts into
-- `production_rung_dates`, the append-only table that already owns the potting date.
--
-- 🔴 IDEMPOTENT BY LINE, AND THAT IS NOT A NICETY. A crew taps Done on a phone with a bad signal.
-- Every line that already carries `applied_at` is SKIPPED, so a second tap moves no stock a second
-- time and the response says how many it skipped. Without this, one double-tap adds 2.5 yards of mix
-- that was never made.
--
-- ⚠️ IT DOES NOT SWALLOW A FAILURE. If a line's delegate refuses, the line records the refusal in
-- `applied_result`, the order does NOT become `done`, and the response names what failed. A work order
-- that is partly applied says so — it does not report success because most of it worked.
BEGIN;

CREATE OR REPLACE FUNCTION public.work_order_apply(p_work_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wo       public.production_work_orders%ROWTYPE;
  v_line     record;
  v_res      jsonb;
  v_applied  int := 0;
  v_skipped  int := 0;
  v_failed   int := 0;
  v_problems jsonb := '[]'::jsonb;
  v_started  timestamptz;
  v_run_id   uuid;
  v_status   text;
BEGIN
  SELECT * INTO v_wo FROM public.production_work_orders WHERE id = p_work_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_work_order',
      'message', 'That work order does not exist.');
  END IF;
  IF NOT public.is_active_member(v_wo.business_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_member',
      'message', 'You are not a member of this business.');
  END IF;
  IF NOT public.has_permission(v_wo.business_id, 'inventory:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowed',
      'message', 'Finishing this job moves stock, which needs permission to change stock.');
  END IF;
  IF v_wo.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cancelled',
      'message', 'This job was cancelled. Re-plan it rather than finishing it.');
  END IF;

  -- A job that was never started still gets a start time, because a batch time needs one and the
  -- honest answer for "when did it start" on a job finished in one tap is "now".
  v_started := COALESCE(v_wo.started_at, now());

  FOR v_line IN
    SELECT * FROM public.production_work_order_lines
     WHERE work_order_id = p_work_order_id ORDER BY position, created_at
  LOOP
    -- 🔴 ALREADY APPLIED = SKIP. This is the double-tap guard.
    IF v_line.applied_at IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_wo.kind = 'mix_batch' THEN
      v_res := public.record_build_run(v_wo.business_id, v_line.recipe_id, v_line.batches,
                 format('work order %s', p_work_order_id));
      IF COALESCE((v_res->>'ok')::boolean, false) THEN
        -- 🔴 THIS INSERT IS THE FIRST WRITER `build_runs` HAS EVER HAD, AND THAT IS A MEASUREMENT.
        -- `record_build_run` does NOT touch `build_runs` — verified against the LIVE function body,
        -- which does not contain the string at all — and no migration and no line of app code
        -- inserts into it either. The table has an INSERT policy gated on `inventory:update`, so a
        -- CLIENT was meant to write it and none was ever built. **That is why "0 build_runs rows on
        -- every tenant" was never evidence that no batch had been made** (tech-debt #365).
        -- ⚠️ A first draft of this function UPDATEd the row by `run_id`, assuming the RPC had created
        -- it. That UPDATE matched ZERO rows and said nothing — the probe that caught it is D3.
        INSERT INTO public.build_runs
          (business_id, recipe_id, batches, yield_cubic_yards, yield_measured,
           started_at, finished_at, built_by, built_at, cost_incomplete, cost_note)
        VALUES (v_wo.business_id, v_line.recipe_id, v_line.batches,
                -- ⚠️ `recorded` is what went ON THE BOOKS and `made` is what the recipe says; they
                -- differ on a part-yard batch, and only ledger #410's version of `record_build_run`
                -- returns `recorded`. COALESCE so this is correct before AND after that migration,
                -- and prefers the truthful figure the moment it exists. A build run is a record of a
                -- real event, so the books' figure is the right one.
                COALESCE((v_res->>'recorded')::numeric, (v_res->>'made')::numeric), false,
                v_started, now(), auth.uid(), now(), true,
                -- 🔴 NOT A ZERO. The cost engine is client-side (`recipeCost.ts` — landed cost,
                -- receipt matching, the incomplete note), so a server function cannot compute it
                -- here. `cost_incomplete = true` with a reason is the honest value; a 0 in
                -- `total_cost` would read as "this batch was free" (D-9).
                'costed nowhere yet — recorded by a work order, which does not compute landed cost')
        RETURNING id INTO v_run_id;
        UPDATE public.production_work_order_lines
           SET applied_at = now(), applied_result = v_res || jsonb_build_object('build_run_id', v_run_id)
         WHERE id = v_line.id;
        v_applied := v_applied + 1;
      ELSE
        v_failed := v_failed + 1;
        v_problems := v_problems || jsonb_build_object('line', v_line.position,
          'code', v_res->>'code', 'message', v_res->>'message');
        UPDATE public.production_work_order_lines SET applied_result = v_res WHERE id = v_line.id;
      END IF;

    ELSIF v_wo.kind = 'uppot' THEN
      -- The potting date, on the append-only table that owns it. A correction is a NEW row, never
      -- an edit, so this never updates one.
      BEGIN
        INSERT INTO public.production_rung_dates
          (business_id, inventory_id, entered_on, unit_value, note, recorded_by, recorded_at)
        VALUES (v_wo.business_id, v_line.inventory_id, v_wo.scheduled_for, v_line.quantity,
                format('potted on from work order %s', p_work_order_id), auth.uid(), now());
        v_res := jsonb_build_object('ok', true, 'recorded_on', v_wo.scheduled_for);
        UPDATE public.production_work_order_lines
           SET applied_at = now(), applied_result = v_res WHERE id = v_line.id;
        v_applied := v_applied + 1;
      EXCEPTION WHEN others THEN
        v_failed := v_failed + 1;
        v_res := jsonb_build_object('ok', false, 'code', 'rung_date_refused', 'message', SQLERRM);
        v_problems := v_problems || jsonb_build_object('line', v_line.position,
          'code', 'rung_date_refused', 'message', SQLERRM);
        UPDATE public.production_work_order_lines SET applied_result = v_res WHERE id = v_line.id;
      END;
    END IF;
  END LOOP;

  -- 🔴 DONE ONLY WHEN EVERY LINE LANDED. A partly-applied job stays `in_progress` and says so.
  --
  -- ⚠️ THE STATUS IS DECIDED **ONCE**, HERE, AND THE ROW AND THE RESPONSE BOTH READ THIS VARIABLE.
  -- A first draft computed it twice — once in this IF for the UPDATE, once in a CASE inside the
  -- RETURN — and **mutant M3 proved they could disagree**: with the guard removed the ROW said
  -- `done` while the RESPONSE still said `in_progress`. Two representations of one fact, and the
  -- copy that drifts is the one nobody reads against (STD-011). One decision, two uses.
  IF v_failed = 0 AND (v_applied + v_skipped) > 0 THEN
    v_status := 'done';
  ELSIF v_failed > 0 THEN
    v_status := 'in_progress';
  ELSE
    v_status := v_wo.status;
  END IF;

  IF v_status = 'done' THEN
    UPDATE public.production_work_orders
       SET status = 'done', started_at = v_started, finished_at = now(), updated_at = now()
     WHERE id = p_work_order_id;
  ELSIF v_status = 'in_progress' THEN
    UPDATE public.production_work_orders
       SET status = 'in_progress', started_at = v_started, updated_at = now()
     WHERE id = p_work_order_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', v_failed = 0,
    'work_order_id', p_work_order_id,
    'kind', v_wo.kind,
    'applied', v_applied,
    'skipped_already_applied', v_skipped,
    'failed', v_failed,
    'problems', v_problems,
    'status', v_status,
    'message', CASE
      WHEN v_failed > 0 THEN format('%s of %s line(s) could not be applied — the job is still open.',
                                    v_failed, v_applied + v_failed + v_skipped)
      WHEN v_applied = 0 AND v_skipped > 0 THEN 'Every line had already been applied — nothing moved twice.'
      WHEN v_applied = 0 THEN 'This job has no lines, so there was nothing to apply.'
      ELSE NULL END);
END;
$$;

REVOKE ALL ON FUNCTION public.work_order_apply(uuid) FROM public;
REVOKE ALL ON FUNCTION public.work_order_apply(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.work_order_apply(uuid) TO authenticated;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — paste each on its own. Each builds its own fixture, RAISEs its verdict and ROLLS
-- BACK, so the message IS the report (§6 r26). No placeholders, nothing to fill in.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · THE TABLES, THEIR RLS, THEIR EIGHT POLICIES, AND THE TIMING COLUMNS ON build_runs.
--   DO $v1$
--   DECLARE wo int; wol int; pols int; rls1 boolean; rls2 boolean; timing int;
--   BEGIN
--     SELECT count(*) INTO wo  FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='production_work_orders';
--     SELECT count(*) INTO wol FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='production_work_order_lines';
--     SELECT count(*) INTO pols FROM pg_policies WHERE schemaname='public'
--       AND tablename IN ('production_work_orders','production_work_order_lines');
--     SELECT relrowsecurity INTO rls1 FROM pg_class WHERE oid='public.production_work_orders'::regclass;
--     SELECT relrowsecurity INTO rls2 FROM pg_class WHERE oid='public.production_work_order_lines'::regclass;
--     SELECT count(*) INTO timing FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='build_runs' AND column_name IN ('started_at','finished_at');
--     IF wo=14 AND wol=11 AND pols=8 AND rls1 AND rls2 AND timing=2 THEN
--       RAISE EXCEPTION 'V1 PASS — work orders 14 cols, lines 11 cols, RLS on both, 8 policies, build_runs gained started_at + finished_at';
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — wo=% lines=% policies=% rls=%/% timing=%', wo, wol, pols, rls1, rls2, timing;
--     END IF;
--   END $v1$;
--
--   -- V2 · A LINE MUST MATCH ITS ORDER'S KIND, BOTH DIRECTIONS.
--   DO $v2$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid(); w uuid; rc uuid;
--           mix_needs_recipe boolean := false; mix_rejects_lot boolean := false;
--           uppot_needs_lot boolean := false; good boolean := false;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b,'V2 Co',u);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Mix',0,'V2ITEM','manufactured','placeholder','v2','available');
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V2ITEM',2.5,'yd','v2') RETURNING id INTO rc;
--     INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
--       VALUES (b,'mix_batch',current_date,'person','v2') RETURNING id INTO w;
--     -- a mix line with no recipe: REFUSED
--     BEGIN
--       INSERT INTO public.production_work_order_lines (work_order_id,position,quantity) VALUES (w,1,5);
--     EXCEPTION WHEN others THEN mix_needs_recipe := true;
--     END;
--     -- a mix line naming a LOT: REFUSED
--     BEGIN
--       INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches,inventory_id)
--         VALUES (w,1,rc,1,gen_random_uuid());
--     EXCEPTION WHEN others THEN mix_rejects_lot := true;
--     END;
--     -- a proper mix line: ACCEPTED
--     INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches)
--       VALUES (w,1,rc,2);
--     good := true;
--     -- an uppot order whose line names a recipe: REFUSED
--     INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
--       VALUES (b,'uppot',current_date,'person','v2') RETURNING id INTO w;
--     BEGIN
--       INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches)
--         VALUES (w,1,rc,1);
--     EXCEPTION WHEN others THEN uppot_needs_lot := true;
--     END;
--     IF mix_needs_recipe AND mix_rejects_lot AND good AND uppot_needs_lot THEN
--       RAISE EXCEPTION 'V2 PASS — a mix line needs a recipe and refuses a lot; an uppot line refuses a recipe; a correct line is accepted';
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — mix_needs_recipe=% mix_rejects_lot=% good=% uppot_needs_lot=%',
--         mix_needs_recipe, mix_rejects_lot, good, uppot_needs_lot;
--     END IF;
--   END $v2$;
--
--   -- V3 · DONE RUNS THE BUILD, AND A SECOND TAP MOVES NOTHING (the double-tap guard).
--   DO $v3$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid(); w uuid; rc uuid; it uuid;
--           r1 jsonb; r2 jsonb; q_after int; runs int;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id,qbo_writes_enabled) VALUES (b,'V3 Co',u,true);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b,u,true,'owner','V3','["inventory:update"]'::jsonb);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Mix',0,'V3ITEM','manufactured','placeholder','v3','available') RETURNING id INTO it;
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V3ITEM',2,'yd','v3') RETURNING id INTO rc;
--     INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
--       VALUES (b,'mix_batch',current_date,'suggested','stock low') RETURNING id INTO w;
--     INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches)
--       VALUES (w,1,rc,1);
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     r1 := public.work_order_apply(w);
--     r2 := public.work_order_apply(w);
--     SELECT qty INTO q_after FROM public.business_inventory WHERE id = it;
--     SELECT count(*) INTO runs FROM public.build_runs WHERE business_id = b;
--     IF (r1->>'ok')::boolean AND (r1->>'applied')::int = 1 AND r1->>'status' = 'done'
--        AND (r2->>'skipped_already_applied')::int = 1 AND (r2->>'applied')::int = 0
--        AND q_after = 2 AND runs = 1 THEN
--       RAISE EXCEPTION 'V3 PASS — Done built once (qty 0→%, % run), and a second tap applied 0 and skipped 1: %',
--         q_after, runs, r2->>'message';
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — first=% second=% qty=% runs=%', r1, r2, q_after, runs;
--     END IF;
--   END $v3$;
--
--   -- V4 · A MEMBER WITHOUT `inventory:update` CANNOT FINISH A JOB, AND THE REFUSAL SAYS WHY.
--   DO $v4$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid(); w uuid; rc uuid; res jsonb;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b,'V4 Co',u);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b,u,true,'STAFF','V4','["inventory:read"]'::jsonb);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Mix',0,'V4ITEM','manufactured','placeholder','v4','available');
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V4ITEM',2,'yd','v4') RETURNING id INTO rc;
--     INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
--       VALUES (b,'mix_batch',current_date,'person','v4') RETURNING id INTO w;
--     INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches)
--       VALUES (w,1,rc,1);
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     res := public.work_order_apply(w);
--     IF (res->>'ok')::boolean IS FALSE AND res->>'code' = 'not_allowed' THEN
--       RAISE EXCEPTION 'V4 PASS — a member without inventory:update is refused: %', res->>'message';
--     ELSE
--       RAISE EXCEPTION 'V4 FAIL — %', res;
--     END IF;
--   END $v4$;
