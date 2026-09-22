-- supabase/migrations/20260922_build_runs_freeze_cost.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- BUILD RUNS FREEZE THEIR COST, AND A COMPONENT MAY CARRY A TYPED PRICE (ledger #370)
--
-- David, 2026-09-22, ruling ④ and ⑤:
--   "Cost FROZEN per build run. Osmocote and MicroMax are also retail items, so a build run
--    consumes shelf stock."
--   "No receipt → a typed price flagged 'no receipt', never zero."
--
-- 🔴 WHY A FROZEN COST IS THE OPPOSITE OF EVERY OTHER COST IN THIS SYSTEM, AND WHY BOTH ARE RIGHT.
--   `20260921`'s header says, correctly: *"NOTHING IS COSTED BY THIS FILE. A stored cost would be a
--   number nobody could re-derive when a receipt is corrected."* That holds for a RECIPE — it is a
--   standing description of how something is made, and it should always read today's prices.
--   A BUILD RUN is not a description. It is an EVENT: on this date, these components left the shelf
--   and these units arrived. What it cost is a fact ABOUT THAT DAY. If a receipt is corrected next
--   month the recipe's figure must move and the run's must not, or the finished units are re-valued
--   retroactively and the books stop reconciling. So the recipe derives and the run freezes.
--
-- WHAT THIS ADDS
--   §1 `build_runs` — one row per build, with the cost frozen into it and the working kept.
--   §2 `build_run_components` — what each run actually consumed, at the price used that day.
--   §3 `recipe_components.typed_*` — a price somebody typed when no receipt exists.
--   §3b `item_recipes.actual_yield_*` — what a real batch actually made.
--   §4 `record_build_run` REDEFINED to write those rows. Every earlier behaviour is preserved.
--
-- ⚠️ APPEND-ONLY (§6 r1). `20260921` and `20260921c` are APPLIED and are not touched. §4 redefines
--   the function by CREATE OR REPLACE, which is how the previous two already relate to each other.
--
-- 🔴 NOT APPLIED. Written and held for David. The V-blocks below are run BY THE AUTHOR first.
-- ════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── §1 THE RUN ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.build_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  recipe_id         uuid NOT NULL REFERENCES public.item_recipes(id) ON DELETE CASCADE,
  batches           numeric NOT NULL CHECK (batches > 0),

  -- WHAT IT MADE. Derived at the time of the run and frozen with it.
  yield_cubic_yards numeric NULL CHECK (yield_cubic_yards IS NULL OR yield_cubic_yards >= 0),
  yield_measured    boolean NOT NULL DEFAULT false,

  -- WHAT IT COST, FROZEN. Null means "could not be costed on the day" — never 0, which would
  -- read as free. `cost_incomplete` says which of those two a null is.
  materials_cost    numeric NULL CHECK (materials_cost IS NULL OR materials_cost >= 0),
  labour_cost       numeric NULL CHECK (labour_cost IS NULL OR labour_cost >= 0),
  total_cost        numeric NULL CHECK (total_cost IS NULL OR total_cost >= 0),
  cost_per_cubic_yard numeric NULL,
  cost_incomplete   boolean NOT NULL DEFAULT true,
  -- The sentence the screen showed when the run was recorded, kept verbatim. A frozen number with
  -- no frozen caveat is how "incomplete" quietly becomes "complete" six months later.
  cost_note         text NULL,
  freight_spread    text NOT NULL DEFAULT 'equal_per_item'
    CHECK (freight_spread IN ('equal_per_item', 'pro_rata_by_value')),

  built_by          uuid NULL,
  built_at          timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS build_runs_business_idx ON public.build_runs (business_id, built_at DESC);
CREATE INDEX IF NOT EXISTS build_runs_recipe_idx   ON public.build_runs (recipe_id, built_at DESC);

COMMENT ON TABLE public.build_runs IS
  'One build. Its cost is FROZEN here (David, 2026-09-22) because a run is an EVENT, not a description: correcting a receipt later must move the RECIPE''s figure and must not re-value units already made.';

-- ── §2 WHAT THE RUN CONSUMED, AT THE PRICE USED THAT DAY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.build_run_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_run_id      uuid NOT NULL REFERENCES public.build_runs(id) ON DELETE CASCADE,
  name              text NOT NULL,
  quantity          numeric NOT NULL,
  unit              text NOT NULL,
  -- The shelf row it actually came off, when it had one. NULL means the component was not linked
  -- to a product, so nothing was consumed for it — reported, never silently skipped.
  inventory_id      uuid NULL REFERENCES public.business_inventory(id) ON DELETE SET NULL,
  consumed          boolean NOT NULL DEFAULT false,
  unit_cost         numeric NULL,
  line_cost         numeric NULL,
  -- 'receipt' · 'typed' · NULL when it had no price at all on the day.
  price_source      text NULL CHECK (price_source IS NULL OR price_source IN ('receipt', 'typed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS build_run_components_run_idx ON public.build_run_components (build_run_id);

-- ── §3 A TYPED PRICE, WHEN NO RECEIPT EXISTS ────────────────────────────────────────────────
-- David: *"No receipt → a typed price flagged 'no receipt', never zero."* Measured on LAWNS
-- 2026-09-21: MicroMax and 12-24-12 are on NO captured receipt at all, so without this the first
-- real recipe can never be fully costed however long somebody waits.
ALTER TABLE public.recipe_components
  ADD COLUMN IF NOT EXISTS typed_pack_cost numeric NULL CHECK (typed_pack_cost IS NULL OR typed_pack_cost > 0),
  ADD COLUMN IF NOT EXISTS typed_pack_size numeric NULL CHECK (typed_pack_size IS NULL OR typed_pack_size > 0),
  ADD COLUMN IF NOT EXISTS typed_pack_unit text NULL,
  ADD COLUMN IF NOT EXISTS typed_because   text NULL;

COMMENT ON COLUMN public.recipe_components.typed_pack_cost IS
  'A price somebody typed because no receipt exists. ALWAYS shown flagged "no receipt" (David, 2026-09-22) — it is a legitimate answer and it is not the same kind of fact as a landed cost.';

-- 🔴 A TYPED PRICE IS ALL THREE OR NONE. A cost with no pack size cannot give a price per pound,
-- and a half-typed price is the blank that reads as zero.
ALTER TABLE public.recipe_components
  DROP CONSTRAINT IF EXISTS recipe_components_typed_price_is_whole;
ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_typed_price_is_whole CHECK (
    (typed_pack_cost IS NULL AND typed_pack_size IS NULL AND typed_pack_unit IS NULL)
    OR (typed_pack_cost IS NOT NULL AND typed_pack_size IS NOT NULL AND typed_pack_unit IS NOT NULL)
  );

-- ── §3b THE ACTUAL YIELD, MEASURED AFTER A REAL BATCH ───────────────────────────────────────
-- David, 2026-09-22: *"an ACTUAL yield typed after a real batch replaces the estimate."*
ALTER TABLE public.item_recipes
  ADD COLUMN IF NOT EXISTS actual_yield_cubic_yards numeric NULL
    CHECK (actual_yield_cubic_yards IS NULL OR actual_yield_cubic_yards > 0),
  ADD COLUMN IF NOT EXISTS actual_yield_because text NULL;

COMMENT ON COLUMN public.item_recipes.actual_yield_cubic_yards IS
  'What one batch actually made, measured. REPLACES the derived estimate outright — not averaged with it (David, 2026-09-22).';

-- 🔴 AND A NOTE ON THE TWO COLUMNS THIS DOES NOT TOUCH. `yield_quantity` / `yield_unit` are NOT
-- NULL in 20260921, which is APPLIED and cannot be altered (§6 r1). Under the 2026-09-22 ruling the
-- batch size is DERIVED and nobody types it — so what do those columns hold?
--   They hold the yield the recipe LAST DERIVED, written on every save. Not because a screen reads
--   it — no screen does; the modal re-derives from the components every time it opens — but because
--   `record_build_run` reads `v_recipe.yield_quantity` to work out how many units a build produced,
--   and that function runs in the database with no access to the model.
-- ⚠️ SO IT IS A DERIVED SNAPSHOT AND IT CAN GO STALE: edit a component through any path that does
--   not re-save the recipe and the column lags. Today there is only one such path — the modal, which
--   always writes both together. Recorded here so the second one is written knowing this.

-- ── RLS. Same shape as the tables these hang off (20260921 §6). ─────────────────────────────
ALTER TABLE public.build_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_run_components   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS build_runs_member_select ON public.build_runs;
CREATE POLICY build_runs_member_select ON public.build_runs
  FOR SELECT USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS build_runs_member_insert ON public.build_runs;
CREATE POLICY build_runs_member_insert ON public.build_runs
  FOR INSERT WITH CHECK (public.has_permission(business_id, 'inventory:update'));

DROP POLICY IF EXISTS build_run_components_member_select ON public.build_run_components;
CREATE POLICY build_run_components_member_select ON public.build_run_components
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.build_runs r
     WHERE r.id = build_run_id AND public.is_active_member(r.business_id)));

DROP POLICY IF EXISTS build_run_components_member_insert ON public.build_run_components;
CREATE POLICY build_run_components_member_insert ON public.build_run_components
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.build_runs r
     WHERE r.id = build_run_id AND public.has_permission(r.business_id, 'inventory:update')));

-- 🔴 NO UPDATE AND NO DELETE POLICY, DELIBERATELY. A frozen cost that can be edited is not frozen.
-- A run recorded in error is corrected by recording its reversal, the way the ledger already works.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER the COMMIT. Each block carries its verdict IN THE FINAL ERROR MESSAGE,
-- because the Supabase editor shows errors and swallows NOTICEs. Read the TEXT:
--   "V1 PASSED …" → passed, the rollback is expected.   "V1 FAILED …" → a real failure, named.
-- ⚠️ EVERY BLOCK ENDS IN A DELIBERATE EXCEPTION SO NOTHING IT WROTE SURVIVES. An ERROR here is the
--   PASS. (Footnote added because V2 of 20260918c read as a real error and cost David a message.)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- V0 · the tables, their columns and their policies exist.
--      EXPECT: build_runs | 16 | 2   and   build_run_components | 11 | 2
-- SELECT c.table_name, count(*) AS cols,
--        (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.table_name) AS policies
--   FROM information_schema.columns c
--  WHERE c.table_schema = 'public' AND c.table_name IN ('build_runs','build_run_components')
--  GROUP BY c.table_name ORDER BY 1;
--
-- V1 · A BUILD RUN FREEZES ITS COST, AND CORRECTING THE RECIPE AFTERWARDS DOES NOT MOVE IT.
-- DO $verify$
-- DECLARE b uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--         rec uuid; run uuid; frozen numeric; after numeric;
-- BEGIN
--   INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
--        VALUES (b, 'V1-'||gen_random_uuid()::text, 2.5, 'yd') RETURNING id INTO rec;
--   INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit,
--                                         typed_pack_cost, typed_pack_size, typed_pack_unit)
--        VALUES (rec, 1, 'V1 Bark', 2, 'yd', 30.88, 1, 'yd');
--   INSERT INTO public.build_runs (business_id, recipe_id, batches, yield_cubic_yards,
--                                  materials_cost, total_cost, cost_per_cubic_yard,
--                                  cost_incomplete, cost_note)
--        VALUES (b, rec, 1, 2.5, 61.76, 61.76, 24.70, false, 'V1 frozen') RETURNING id INTO run;
--   SELECT total_cost INTO frozen FROM public.build_runs WHERE id = run;
--   -- the recipe's own price is corrected AFTER the run
--   UPDATE public.recipe_components SET typed_pack_cost = 99.00 WHERE recipe_id = rec;
--   SELECT total_cost INTO after FROM public.build_runs WHERE id = run;
--   IF after IS DISTINCT FROM frozen THEN
--     RAISE EXCEPTION 'V1 FAILED — the run''s cost MOVED when the recipe changed: % -> %', frozen, after;
--   END IF;
--   RAISE EXCEPTION 'V1 PASSED — run cost frozen at % after the recipe moved to 99.00 · (rollback expected)', frozen;
-- END $verify$;
--
-- V2 · A FROZEN COST CANNOT BE EDITED — THERE IS NO UPDATE POLICY.
--      Run this as an ordinary member, NOT as postgres (postgres bypasses RLS and V2 would
--      "pass" for the wrong reason — the #182 class, so it is said here rather than discovered).
-- DO $verify$
-- DECLARE n int;
-- BEGIN
--   SELECT count(*) INTO n FROM pg_policies
--    WHERE tablename = 'build_runs' AND cmd IN ('UPDATE','DELETE');
--   IF n <> 0 THEN
--     RAISE EXCEPTION 'V2 FAILED — % UPDATE/DELETE policy(ies) on build_runs; a frozen cost that can be edited is not frozen', n;
--   END IF;
--   RAISE EXCEPTION 'V2 PASSED — no UPDATE and no DELETE policy on build_runs · (rollback expected)';
-- END $verify$;
--
-- V3 · A HALF-TYPED PRICE IS REFUSED.
-- DO $verify$
-- DECLARE b uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'; rec uuid; ok boolean := false;
-- BEGIN
--   INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
--        VALUES (b, 'V3-'||gen_random_uuid()::text, 1, 'yd') RETURNING id INTO rec;
--   BEGIN
--     INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit, typed_pack_cost)
--          VALUES (rec, 1, 'V3 half', 1, 'lb', 60.00);
--   EXCEPTION WHEN check_violation THEN ok := true;
--   END;
--   IF NOT ok THEN
--     RAISE EXCEPTION 'V3 FAILED — a cost with no pack size was ACCEPTED; it can give no price per lb';
--   END IF;
--   RAISE EXCEPTION 'V3 PASSED — a half-typed price is refused by the CHECK · (rollback expected)';
-- END $verify$;
--
-- V4 · A RUN THAT COULD NOT BE COSTED STORES NULL, NOT ZERO.
-- DO $verify$
-- DECLARE b uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'; rec uuid; run uuid; t numeric; inc boolean;
-- BEGIN
--   INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
--        VALUES (b, 'V4-'||gen_random_uuid()::text, 1, 'yd') RETURNING id INTO rec;
--   INSERT INTO public.build_runs (business_id, recipe_id, batches, cost_incomplete, cost_note)
--        VALUES (b, rec, 1, true, 'nothing could be costed') RETURNING id INTO run;
--   SELECT total_cost, cost_incomplete INTO t, inc FROM public.build_runs WHERE id = run;
--   IF t IS NOT NULL THEN
--     RAISE EXCEPTION 'V4 FAILED — an uncosted run stored %, which reads as a real figure', t;
--   END IF;
--   IF inc IS NOT TRUE THEN RAISE EXCEPTION 'V4 FAILED — the run does not say its cost is incomplete'; END IF;
--   RAISE EXCEPTION 'V4 PASSED — uncosted run stores NULL and says so · (rollback expected)';
-- END $verify$;
