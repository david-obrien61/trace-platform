-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260921c_build_run_says_when_the_ledger_did_not_record — TEST MODE MUST NOT LOOK LIKE SUCCESS
-- Ledger #370 · follows 20260921_recipes_made_items.sql (APPLIED 2026-09-21). ⚠️ NAMED 'c': HISTORY applied its own 20260921b (capture re-link) the same day.
--
-- ✅ APPLIED 2026-09-21 by David. W1 refused with not_a_member · W2 has_recorded/has_test_mode both
--    true · W3 qbo_writes_enabled false (so a build run here reports ledger_recorded false and
--    test_mode true, and the screen must say so) · and the CORRECTED V3 in this file's footer
--    refused on item_recipes_one_identity — reaching the CHECK that 20260921's own V3 could not,
--    because the wipe guard fired first on every imported row.
-- ⚠️ HEADER-ONLY EDIT, ON DAVID'S INSTRUCTION (2026-09-21). §6 r1 says migrations are append-only;
--    no SQL changed here, only this note, so what ran and what this file says still match. The
--    copy in David's own folder predates this note and is otherwise identical.
--
-- 🔴 WHAT THIS FIXES, FOUND AFTER THE APPLY AND MEASURED, NOT SUPPOSED. `record_build_run` reported
-- `ok: true` and moved quantities whether or not the movement was RECORDED. On this tenant that is
-- not hypothetical: LAWNS is in TEST MODE right now (`businesses.qbo_writes_enabled = false`,
-- measured 2026-09-21), and `discard_ledger_row_in_test_mode` silently DISCARDS every ledger row —
-- *"RETURN NULL; -- test mode (or unknown): the row is discarded, silently"*. So a build run in test
-- mode moved stock with no event behind it, and said nothing about it.
--
-- 🔴 WHY IT REPORTS RATHER THAN REFUSES. The platform's own convention is already this shape:
-- `adjust_inventory_manual` moves the quantity and RETURNS `ledger_id`, which is NULL when the row
-- was discarded. Refusing here would make the recipe screen behave unlike every other stock surface
-- in test mode — which is what testing is for. So the build run now says, in its own result,
-- whether the ledger recorded it: `ledger_recorded` and `test_mode`. A screen that shows "built 5
-- yards" can now also say "not recorded — this business is in test mode".
-- ⚠️ THE DIVERGENCE ITSELF IS NOT FIXED HERE AND IS NOT MINE TO FIX: in test mode `qty` moves while
-- the ledger stays empty, so on-hand and the replay disagree until the test data is wiped. That is
-- the family of tech-debt #308 (a test-mode starting number with no opening ledger line).
-- ══════════════════════════════════════════════════════════════════════════════════════════════

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
  v_made        numeric;
  v_ledger_id   uuid;
  v_recorded    boolean := true;
  v_writes      boolean;
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
    INSERT INTO public.business_inventory_ledger
      (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, occurred_at)
    VALUES (p_business_id, v_component.stock_id, -(v_component.quantity * p_batches), 'consume',
            format('consumed by a build of %s', v_recipe.yield_unit), 'build_run', v_run, auth.uid(), now())
    RETURNING id INTO v_ledger_id;
    -- 🔴 A DISCARDED ROW RETURNS NOTHING. That is the only signal the test-mode trigger gives.
    IF v_ledger_id IS NULL THEN v_recorded := false; END IF;
    UPDATE public.business_inventory
       SET qty = GREATEST(0, COALESCE(qty, 0) - (v_component.quantity * p_batches))
     WHERE id = v_component.stock_id;
    v_moved := v_moved + 1;
  END LOOP;

  v_made := v_recipe.yield_quantity * p_batches;
  v_ledger_id := NULL;
  INSERT INTO public.business_inventory_ledger
    (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, occurred_at)
  VALUES (p_business_id, v_target, v_made, 'build',
          COALESCE(p_note, format('built %s %s', v_made, v_recipe.yield_unit)), 'build_run', v_run, auth.uid(), now())
  RETURNING id INTO v_ledger_id;
  IF v_ledger_id IS NULL THEN v_recorded := false; END IF;
  UPDATE public.business_inventory SET qty = COALESCE(qty, 0) + v_made WHERE id = v_target;

  RETURN jsonb_build_object('ok', true, 'run_id', v_run, 'made', v_made, 'unit', v_recipe.yield_unit,
    'components_moved', v_moved, 'components_not_stocked', v_unlinked,
    -- 🔴 THE TWO NEW FIELDS. A screen that says "built 5 yards" must be able to say "not recorded".
    'ledger_recorded', v_recorded,
    'test_mode', (v_writes IS DISTINCT FROM true),
    'message', CASE WHEN v_recorded THEN NULL
                    ELSE 'The stock moved, but this business is in test mode, so the movement was not recorded in the ledger.' END);
END;
$$;

REVOKE ALL ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying.
-- 🔴 Where a step expects a refusal, THE ERROR IS THE PASS (David, 2026-09-21).
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- W1 · the function reports the two new fields (a dry probe on a recipe that does not exist —
--      it refuses, which proves the function is the NEW one only once W2 passes; see W2)
--   SELECT public.record_build_run('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', gen_random_uuid(), 1);
--   -- EXPECT: {"ok": false, "code": "no_recipe", …}
--
-- W2 · the new body is live — the source carries the fields
--   SELECT pg_get_functiondef(oid) LIKE '%ledger_recorded%' AS has_recorded,
--          pg_get_functiondef(oid) LIKE '%test_mode%'       AS has_test_mode
--     FROM pg_proc WHERE proname = 'record_build_run';
--   -- EXPECT: true · true
--
-- W3 · this tenant's write flag, which decides what a build run will report
--   SELECT qbo_writes_enabled FROM public.businesses WHERE id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--   -- EXPECT today: false  → a build run will return ledger_recorded false and test_mode true,
--   --   and the screen must say so. When writes are turned on, both flip.
--
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- ✏️ A CORRECTED V3 FOR 20260921 (that file is applied and is NOT edited — §6 r1).
-- Its V3 meant to prove `item_recipes_one_identity`: a recipe may not carry BOTH a QuickBooks id and
-- a row id. As written it picked any inventory row, and every live row came from a catalogue load,
-- so the WIPE GUARD fired first and the CHECK was never reached (David, 2026-09-21). The guard only
-- refuses rows that carry an `import_run_id`, so the corrected probe makes a row that does not —
-- inside a transaction that is rolled back, so nothing is left behind.
--   BEGIN;
--   WITH probe AS (
--     INSERT INTO public.business_inventory (business_id, name, qty)
--     VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 'V3 probe row — rolled back', 0)
--     RETURNING id
--   )
--   INSERT INTO public.item_recipes (business_id, qb_item_id, inventory_id, yield_quantity, yield_unit)
--   SELECT 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 'V3-PROBE', probe.id, 1, 'each' FROM probe;
--   -- EXPECT: new row … violates check constraint "item_recipes_one_identity"   ← the PASS
--   --   (NOT the guard's "that product came from a catalogue load" message — that would mean the
--   --    probe row was somehow tagged to a run and the CHECK is still unproven.)
--   ROLLBACK;
