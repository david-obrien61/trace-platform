-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925a — A BUILD RECORDS WHAT IT ACTUALLY MOVED · ledger #410 · yard production P2
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY: A PART-YARD BATCH INVENTS HALF A YARD, AND THE RPC REPORTS THE TRUTH BESIDE IT ──────
-- `business_inventory.qty` AND `business_inventory_ledger.delta` are BOTH `integer NOT NULL`.
-- `record_build_run` computes its yield as `numeric` — LAWNS's mix recipe yields **2.5 yd** a
-- batch — and then assigns it into both of them.
--
-- 🔴 MEASURED, NOT REASONED (§6 r19 / r26) — the real function, the real column types, the real
-- `has_permission`, executed against `live-schema-public.sql` in PGlite:
--
--     BEFORE qty: 1
--     record_build_run(LAWNS, recipe, 1 batch) → {"ok":true, "made":2.5, …}
--     AFTER  qty: 4      ledger delta: 3
--
-- A batch that made **2.5 yards** put **3 yards** on the books, and the RPC said `"made": 2.5` in
-- the same breath. numeric→integer rounds half away from zero (measured: 2.5→3 · 3.5→4 · 0.5→1 ·
-- 1.5→2 · 7.5→8), so a half-yard yield is **inflated by half a yard on every single batch**, in
-- the direction that hides a shortage. Nothing on any screen or in any return value says so.
--
-- ✏️ **A FIRST DRAFT OF THIS HEADER CLAIMED THE LEDGER AND THE ROW DISAGREE — "+2.5 to the ledger
-- while the row moves +3". THAT IS FALSE, AND EXECUTING IT IS WHAT CAUGHT IT.** `delta` is an
-- integer too, so the ledger cannot hold 2.5 either; it stores 3, and for any positive on-hand
-- `round(qty + 2.5) − qty = round(2.5)`, so the two always agree with EACH OTHER. **What they
-- disagree with is reality, and with the figure the function reports.** The correction is left in
-- rather than quietly fixed: a migration comment asserting a defect that is not there is the
-- written declaration nobody checks that [[R-26]] is about, and this one was mine.
--
-- 🔴 THE CONSUME SIDE HAS A SECOND, GENUINELY DIVERGENT DEFECT, AND IT IS THE WORSE ONE. Each
-- component does `qty = GREATEST(0, qty - want)` while writing `-want` to the ledger. A component
-- **clamped at zero** — 25 lb of Osmocote wanted, 10 lb on hand — moves the row by 10 and records
-- **−25**. *A consumption that did not happen, on the permanent record*, and it is silent. Here
-- the ledger and the row really do disagree, and the reconcile replay would carry the difference
-- for ever. **Proven red in the harness, and the mutant that restores it is CAUGHT.**
--
-- ✅ NOTHING IS CORRUPTED TODAY, AND THAT IS WHY THIS LANDS NOW. LIVE 2026-09-25:
-- **0 `build_runs` rows, 0 `build` ledger rows, all tenants**, and `record_build_run` has **no
-- caller anywhere in the app** (grepped `packages/`: comments only). The defect is LATENT — it
-- fires on the first MADE IT tap, which is exactly what yard production is about to build. There
-- is no data repair here because there is no damaged data yet.
--
-- ── WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────────────────────
-- ONE RULE: **the ledger delta, the row movement and the reported figure are the same number.**
-- Every stock write now computes the integer the column will really hold, derives the delta the
-- row really moved by, writes THAT to the ledger, and returns it.
--
-- ⚠️ **TWO OF THE FOUR CLAUSES ARE NO-OPS TODAY AND THE FILE SAYS SO RATHER THAN IMPLYING FOUR
-- FIXES.** Because `delta` is an integer, routing the FINISHED-UNIT ledger write through
-- `v_applied` instead of `v_made`, and writing `v_made_rec` instead of `qty + v_made`, produce
-- byte-identical results — **proven, as declared EQUIVALENT mutants M1 and M2 in the harness,
-- which assert the outcome is IDENTICAL rather than pretending to catch something.** They are kept
-- because they make the intent explicit and they are the clauses that would matter the moment
-- `delta` or `qty` became numeric. **The two clauses doing real work are the ROUNDING REPORT
-- (mutant M4) and the COMPONENT CLAMP FIDELITY (mutant M3).**
--
-- 🔴 IT DOES NOT MAKE `qty` NUMERIC, AND DOES NOT PRETEND ROUNDING IS FIXED. `qty` is an integer
-- because most of this catalogue is trees, and *"27 trees"* is the right shape. A part-yard batch
-- still cannot be held exactly in whole yards — so the RPC now SAYS so, in its own return value,
-- and names the remedy: hold the item in **gallons** (2.5 yd = 505 gal; the error falls from 20%
-- of a batch to 0.013%). That remedy is ledger #409's sale-unit config, NOT this migration.
-- **This migration's job is to stop the silence, not to claim the granularity is solved** —
-- reporting a rounding you cannot avoid is D-9 Surface Honesty; hiding it is the current state.
--
-- ⚠️ NO NEW COLUMN, NO NEW TABLE, NO SIGNATURE CHANGE. `record_build_run(uuid, uuid, numeric,
-- text)` keeps its shape, so nothing that calls it needs editing — and nothing does.
--
-- ⚠️ THE RESPONSE GAINS FIELDS AND LOSES NONE. `made` keeps meaning *what the recipe says the
-- batch makes* — screens already word it that way. New: `recorded` (what went on the books),
-- `rounding` (the difference, absent when there is none), `components_short` (each component
-- whose movement was rounded or clamped, with both figures), `rounding_note`. `message` keeps its
-- existing test-mode sentence verbatim so nothing matching on it breaks.
--
-- DEPENDENCIES: 20260921 (item_recipes, recipe_components, build_runs), 20260921c (the function
--               this replaces), 20260922d (the frozen-cost columns). All three APPLIED.
-- OUTPUTS:      public.record_build_run(uuid, uuid, numeric, text) — REPLACED in place.
-- HARNESS:      scripts/sql-harness/build-run-rounding-410.pglite.mjs — this file executed end to
--               end against the live snapshot, its own V-blocks run verbatim, red-first, 4 mutants.
-- STORY:        user_stories.md → *Is there enough mix for Saturday?*
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.record_build_run(
  p_business_id uuid,
  p_recipe_id   uuid,
  p_batches     numeric,
  p_note        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recipe      public.item_recipes%ROWTYPE;
  v_target      uuid;
  v_run         uuid := gen_random_uuid();
  v_component   record;
  v_moved       int := 0;
  v_unlinked    jsonb := '[]'::jsonb;
  v_short       jsonb := '[]'::jsonb;
  v_made        numeric;
  v_ledger_id   uuid;
  v_recorded    boolean := true;
  v_writes      boolean;
  -- The three figures every stock write now keeps apart on purpose: what was asked for, what the
  -- integer column can hold, and the difference between them.
  v_before      integer;
  v_after       integer;
  v_applied     numeric;
  v_want        numeric;
  v_made_rec    integer;
  v_round       numeric;
BEGIN
  IF NOT public.is_active_member(p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_member',
      'message', 'You are not a member of this business.');
  END IF;
  IF NOT public.has_permission(p_business_id, 'inventory:update') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowed',
      'message', 'Recording a build needs permission to change stock.');
  END IF;
  IF p_batches IS NULL OR p_batches <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_batches',
      'message', 'Say how many batches were built — it must be more than zero.');
  END IF;

  SELECT * INTO v_recipe FROM public.item_recipes
   WHERE id = p_recipe_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_recipe',
      'message', 'That recipe does not belong to this business.');
  END IF;

  SELECT b.qbo_writes_enabled INTO v_writes FROM public.businesses b WHERE b.id = p_business_id;

  IF v_recipe.qb_item_id IS NOT NULL THEN
    SELECT id INTO v_target FROM public.business_inventory
     WHERE business_id = p_business_id AND qb_item_id = v_recipe.qb_item_id AND retired_at IS NULL
     ORDER BY created_at DESC LIMIT 1;
  ELSE
    v_target := v_recipe.inventory_id;
  END IF;
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_stock_row',
      'message', 'This recipe has no stock row to put the finished units into. Re-link it to the item first.');
  END IF;

  -- ── THE CONSUME SIDE ──────────────────────────────────────────────────────────────────────
  FOR v_component IN
    SELECT c.id, c.name, c.quantity, c.unit,
           COALESCE(c.component_inventory_id,
                    (SELECT bi.id FROM public.business_inventory bi
                      WHERE bi.business_id = p_business_id
                        AND bi.qb_item_id = c.component_qb_item_id
                        AND bi.retired_at IS NULL
                      ORDER BY bi.created_at DESC LIMIT 1)) AS stock_id
      FROM public.recipe_components c
     WHERE c.recipe_id = p_recipe_id
     ORDER BY c.position, c.name
  LOOP
    IF v_component.stock_id IS NULL THEN
      v_unlinked := v_unlinked || jsonb_build_object('name', v_component.name,
        'quantity', v_component.quantity * p_batches, 'unit', v_component.unit);
      CONTINUE;
    END IF;

    v_want := v_component.quantity * p_batches;
    -- 🔴 LOCK, THEN DERIVE. The row is read FOR UPDATE so the before-figure this arithmetic rests
    -- on is still true when the UPDATE lands — two concurrent builds must not both compute their
    -- delta from the same starting quantity.
    SELECT COALESCE(qty, 0) INTO v_before FROM public.business_inventory
     WHERE id = v_component.stock_id FOR UPDATE;
    -- GREATEST(0, …) is retained: stock does not go negative. What changes is that the CLAMP is
    -- now visible in the delta, instead of the ledger claiming a movement the row refused.
    v_after   := GREATEST(0, round(v_before - v_want))::integer;
    v_applied := v_after - v_before;                      -- negative, and exactly what moved

    IF v_applied <> -v_want THEN
      v_short := v_short || jsonb_build_object(
        'name', v_component.name, 'unit', v_component.unit,
        'wanted', v_want, 'taken', -v_applied, 'on_hand_before', v_before,
        'because', CASE WHEN v_after = 0 AND v_before < round(v_want)
                        THEN 'there was not enough on hand'
                        ELSE 'stock is counted in whole units' END);
    END IF;

    INSERT INTO public.business_inventory_ledger
      (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, occurred_at)
    VALUES (p_business_id, v_component.stock_id, v_applied, 'consume',
            format('consumed by a build of %s', v_recipe.yield_unit), 'build_run', v_run, auth.uid(), now())
    RETURNING id INTO v_ledger_id;
    -- 🔴 A DISCARDED ROW RETURNS NOTHING. That is the only signal the test-mode trigger gives.
    IF v_ledger_id IS NULL THEN v_recorded := false; END IF;

    UPDATE public.business_inventory SET qty = v_after WHERE id = v_component.stock_id;
    v_moved := v_moved + 1;
  END LOOP;

  -- ── THE FINISHED UNITS ────────────────────────────────────────────────────────────────────
  v_made := v_recipe.yield_quantity * p_batches;
  SELECT COALESCE(qty, 0) INTO v_before FROM public.business_inventory
   WHERE id = v_target FOR UPDATE;
  v_made_rec := round(v_before + v_made)::integer;
  v_applied  := v_made_rec - v_before;
  v_round    := v_applied - v_made;                       -- 0 when the yield is whole

  v_ledger_id := NULL;
  INSERT INTO public.business_inventory_ledger
    (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, occurred_at)
  VALUES (p_business_id, v_target, v_applied, 'build',
          COALESCE(p_note, format('built %s %s', v_made, v_recipe.yield_unit)), 'build_run', v_run, auth.uid(), now())
  RETURNING id INTO v_ledger_id;
  IF v_ledger_id IS NULL THEN v_recorded := false; END IF;
  UPDATE public.business_inventory SET qty = v_made_rec WHERE id = v_target;

  RETURN jsonb_build_object('ok', true, 'run_id', v_run,
    'made', v_made, 'unit', v_recipe.yield_unit,
    -- 🔴 WHAT WENT ON THE BOOKS, BESIDE WHAT THE RECIPE SAYS. Equal whenever the yield is whole.
    'recorded', v_applied,
    'rounding', CASE WHEN v_round = 0 THEN NULL ELSE v_round END,
    'rounding_note', CASE WHEN v_round = 0 THEN NULL ELSE
      format('This batch makes %s %s, but stock is counted in whole %s, so %s went on the books. Hold this item in gallons to record a part-%s batch exactly.',
             v_made, v_recipe.yield_unit, v_recipe.yield_unit, v_applied, v_recipe.yield_unit) END,
    'components_moved', v_moved, 'components_not_stocked', v_unlinked,
    'components_short', v_short,
    'ledger_recorded', v_recorded,
    'test_mode', (v_writes IS DISTINCT FROM true),
    'message', CASE WHEN v_recorded THEN NULL
                    ELSE 'The stock moved, but this business is in test mode, so the movement was not recorded in the ledger.' END);
END;
$$;

REVOKE ALL ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) TO authenticated;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — paste each one on its own. Every block builds its own fixture, looks up nothing it
-- was not given, RAISEs its verdict and ROLLS BACK, so the message IS the report (§6 r26).
-- 🔴 NO placeholders, no value to fill in. They set the JWT claim rather than `SET ROLE`, which
-- tech-debt #240 records FAILING live with "permission denied to set role".
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · THE ROW, THE LEDGER AND THE REPORT AGREE ON A WHOLE YIELD (the negative control:
--   --      nothing to round, so `rounding` must be NULL and nothing may be flagged).
--   DO $v1$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
--           it uuid; rc uuid; res jsonb; d numeric; q integer;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id, name, owner_id, qbo_writes_enabled) VALUES (b,'V1 Co',u,true);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b,u,true,'owner','V1','["inventory:update"]'::jsonb);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Whole Mix',10,'V1ITEM','manufactured','placeholder','v1','available') RETURNING id INTO it;
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V1ITEM',2,'yd','v1') RETURNING id INTO rc;
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     res := public.record_build_run(b, rc, 1::numeric, 'v1');
--     SELECT delta INTO d FROM public.business_inventory_ledger
--      WHERE business_id=b AND kind='build' ORDER BY occurred_at DESC LIMIT 1;
--     SELECT qty INTO q FROM public.business_inventory WHERE id=it;
--     IF (res->>'ok')::boolean AND d = 2 AND q = 12 AND (res->>'recorded')::numeric = 2
--        AND res->>'rounding' IS NULL AND res->'components_short' = '[]'::jsonb THEN
--       RAISE EXCEPTION 'V1 PASS — whole yield: ledger +% , row 10→%, reported %, rounding NULL', d, q, res->>'recorded';
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — ledger=% row=% recorded=% rounding=% short=%',
--         d, q, res->>'recorded', res->>'rounding', res->'components_short';
--     END IF;
--   END $v1$;
--
--   -- V2 · A 2.5 YARD BATCH: THE LEDGER AND THE ROW MOVE BY THE SAME NUMBER, AND THE ROUNDING IS
--   --      REPORTED. This is the defect. Before this migration: ledger +2.5, row +3, rounding silent.
--   DO $v2$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
--           it uuid; rc uuid; res jsonb; d numeric; q integer;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id, name, owner_id, qbo_writes_enabled) VALUES (b,'V2 Co',u,true);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b,u,true,'owner','V2','["inventory:update"]'::jsonb);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Fertile Mix',1,'V2ITEM','manufactured','placeholder','v2','available') RETURNING id INTO it;
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V2ITEM',2.5,'yd','v2') RETURNING id INTO rc;
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     res := public.record_build_run(b, rc, 1::numeric, 'v2');
--     SELECT delta INTO d FROM public.business_inventory_ledger
--      WHERE business_id=b AND kind='build' ORDER BY occurred_at DESC LIMIT 1;
--     SELECT qty INTO q FROM public.business_inventory WHERE id=it;
--     IF d = (q - 1) AND (res->>'made')::numeric = 2.5 AND (res->>'recorded')::numeric = d
--        AND (res->>'rounding')::numeric = d - 2.5 AND res->>'rounding_note' IS NOT NULL THEN
--       RAISE EXCEPTION 'V2 PASS — made 2.5, recorded % , ledger % = row move % , rounding % reported',
--         res->>'recorded', d, q - 1, res->>'rounding';
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — ledger=% rowmove=% made=% recorded=% rounding=% note=%',
--         d, q - 1, res->>'made', res->>'recorded', res->>'rounding', (res->>'rounding_note' IS NOT NULL);
--     END IF;
--   END $v2$;
--
--   -- V3 · A COMPONENT WITH LESS ON HAND THAN THE RECIPE WANTS: the ledger records what was
--   --      actually taken, never the wanted figure, and the shortfall is NAMED.
--   DO $v3$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
--           it uuid; comp uuid; rc uuid; res jsonb; d numeric; q integer; s jsonb;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id, name, owner_id, qbo_writes_enabled) VALUES (b,'V3 Co',u,true);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b,u,true,'owner','V3','["inventory:update"]'::jsonb);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Mix',0,'V3ITEM','manufactured','placeholder','v3','available') RETURNING id INTO it;
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Osmocote',10,'V3COMP','purchased','placeholder','v3','available') RETURNING id INTO comp;
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V3ITEM',1,'yd','v3') RETURNING id INTO rc;
--     INSERT INTO public.recipe_components (recipe_id,position,name,quantity,unit,component_qb_item_id)
--       VALUES (rc,1,'Osmocote',25,'lb','V3COMP');
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     res := public.record_build_run(b, rc, 1::numeric, 'v3');
--     SELECT delta INTO d FROM public.business_inventory_ledger
--      WHERE business_id=b AND inventory_id=comp AND kind='consume' ORDER BY occurred_at DESC LIMIT 1;
--     SELECT qty INTO q FROM public.business_inventory WHERE id=comp;
--     s := res->'components_short';
--     IF d = -10 AND q = 0 AND jsonb_array_length(s) = 1
--        AND (s->0->>'wanted')::numeric = 25 AND (s->0->>'taken')::numeric = 10 THEN
--       RAISE EXCEPTION 'V3 PASS — wanted 25, on hand 10, ledger % , row now % , shortfall named: %',
--         d, q, s->0->>'because';
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — ledger=% qty=% short=%', d, q, s;
--     END IF;
--   END $v3$;
--
--   -- V4 · THE GUARDS ARE UNTOUCHED: a member WITHOUT `inventory:update` is refused, and the
--   --      refusal names the permission rather than the row.
--   DO $v4$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid(); rc uuid; res jsonb;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id, name, owner_id, qbo_writes_enabled) VALUES (b,'V4 Co',u,true);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b,u,true,'STAFF','V4','["inventory:read"]'::jsonb);
--     INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
--       VALUES (b,'Mix',5,'V4ITEM','manufactured','placeholder','v4','available');
--     INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
--       VALUES (b,'V4ITEM',2.5,'yd','v4') RETURNING id INTO rc;
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     res := public.record_build_run(b, rc, 1::numeric, 'v4');
--     IF (res->>'ok')::boolean IS FALSE AND res->>'code' = 'not_allowed' THEN
--       RAISE EXCEPTION 'V4 PASS — a member without inventory:update is refused: %', res->>'message';
--     ELSE
--       RAISE EXCEPTION 'V4 FAIL — % ', res;
--     END IF;
--   END $v4$;
