-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260921_recipes_made_items — A MADE ITEM IS AN INVENTORY ROW WITH A RECIPE
-- Ledger #370 · [[R-118]] (2026-09-05) · David's answers 2026-09-21
--
-- WHAT. Five tables' worth of structure and one function:
--   §1 `business_inventory.item_type` — purchased · grown · manufactured. THE FLAG IS THE
--      IDENTIFIER: it is how the system knows an item needs a build list. Never parsed from a SKU.
--      Plus the per-business LABEL for it ("homemade" at LAWNS), in the operations config.
--   §2 `item_recipes` — one recipe per made item: yield, yield unit, build minutes, notes.
--   §3 `recipe_components` — what goes in. An UNLINKED component is legal and prints "unpriced".
--   §4 `component_purchase_links` — a CONFIRMED match between a component and a receipt line.
--      Tenant config: it is how "what did we last pay" is answered, and it SURVIVES THE WIPE.
--   §5 `labour_rates` — SHIPS EMPTY, behind the money wall. A recipe records MINUTES; cost reads
--      "labour not costed yet — no rates entered" until somebody enters a rate.
--   §6 `record_build_run()` — components out, finished units in, in ONE transaction.
--
-- 🔴 WHY IDENTITY IS `qb_item_id`, NEVER OUR ROW id (David, 2026-09-21; measured the same day).
-- The catalogue re-import of 2026-09-21 (`8ac868b3…`) replaced all 632 rows: the previous run's
-- rows are GONE, not retired, so every row id changed while `qb_item_id` did not. A recipe or a
-- confirmed match keyed on a row id would be dangling rubbish after the next reload. So both carry
-- `qb_item_id` where the item came from QuickBooks, and an `inventory_id` ONLY for an item this
-- platform owns — the bubbler is one: [[R-118]] measured ZERO matches for bubbler, hose or emitter
-- across 1,481 invoices, so it has to be created by hand and has no QuickBooks id to key on.
--
-- 🔴 ONE CAPTURE PER DOCUMENT (David, 2026-09-21; tech-debt #143). The same invoice is captured more
-- than once — Bailey Bark's 7 Jul 2026 is in THREE times, its 28 Apr twice, eight vendor/date/amount
-- groups repeat in all (measured 2026-09-21). A confirmed match therefore records `document_key`
-- (vendor + date + amount) beside `receipt_id`, so the reader can tell "the same purchase, captured
-- again" from "another purchase" without re-deriving it. **This migration does not dedupe anything**
-- — that is #143's own build, and guessing here would hide it.
--
-- 🔴 NOTHING IS COSTED BY THIS FILE. Landed cost is computed at read time from the receipt
-- (`packages/shared/src/costing/landedCost.ts`), both ways, and the chosen spread is recorded per
-- link. A stored cost would be a number nobody could re-derive when a receipt is corrected.
--
-- ⚠️ NOT APPLIED. Written, V-blocks run by Thunder against PGlite. David applies.
-- ══════════════════════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════ §1 — THE FLAG THAT SAYS "WE MAKE THIS" ═══════════════════════════════
ALTER TABLE public.business_inventory
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'purchased'
    CHECK (item_type IN ('purchased', 'grown', 'manufactured'));

COMMENT ON COLUMN public.business_inventory.item_type IS
  'purchased · grown · manufactured. The flag IS the identifier for a made item (R-118) — it is how the system knows the row needs a build list. Never parsed from a SKU. The word a business SEES for it is business_operations_config.madeItemLabel.';

-- The per-business word for it. LAWNS say "homemade"; the platform default says what it means.
INSERT INTO public.business_operations_config (business_id, config)
SELECT b.id, jsonb_build_object('madeItemLabel', 'homemade')
  FROM public.businesses b
 WHERE b.name = 'LAWNS Tree Farm, LLC'
ON CONFLICT (business_id) DO UPDATE
   SET config = public.business_operations_config.config || jsonb_build_object('madeItemLabel', 'homemade')
 WHERE NOT (public.business_operations_config.config ? 'madeItemLabel');

-- ═══════════════════════ §2 — THE RECIPE ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.item_recipes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- EXACTLY ONE identity. `qb_item_id` for anything from QuickBooks (survives the wipe);
  -- `inventory_id` only for an item this platform owns and QuickBooks has never heard of.
  qb_item_id        text NULL,
  inventory_id      uuid NULL REFERENCES public.business_inventory(id) ON DELETE CASCADE,
  yield_quantity    numeric NOT NULL CHECK (yield_quantity > 0),
  yield_unit        text NOT NULL,
  build_minutes     numeric NULL CHECK (build_minutes IS NULL OR build_minutes >= 0),
  build_minutes_because text NOT NULL DEFAULT 'not timed — nobody has timed a build yet',
  notes             text NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_recipes_one_identity CHECK ((qb_item_id IS NOT NULL) <> (inventory_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS item_recipes_one_per_qb_item
  ON public.item_recipes (business_id, qb_item_id) WHERE qb_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS item_recipes_one_per_row
  ON public.item_recipes (business_id, inventory_id) WHERE inventory_id IS NOT NULL;

COMMENT ON TABLE public.item_recipes IS
  'One recipe per made item (R-118, ledger #370). Keyed on qb_item_id so it survives a catalogue wipe; inventory_id only for items QuickBooks has never heard of, e.g. the bubbler.';

-- ═══════════════════════ §3 — WHAT GOES IN ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.recipe_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         uuid NOT NULL REFERENCES public.item_recipes(id) ON DELETE CASCADE,
  position          integer NOT NULL DEFAULT 0,
  -- What the person called it. NOT NULL because an unnamed component cannot be checked on a bench.
  name              text NOT NULL,
  quantity          numeric NOT NULL CHECK (quantity > 0),
  unit              text NOT NULL,
  -- Both nullable ON PURPOSE: "12-24-12, 2 lb" is a legal component with no stock row and no
  -- purchase behind it. It prints UNPRICED and the batch total says it is incomplete.
  component_qb_item_id   text NULL,
  component_inventory_id uuid NULL REFERENCES public.business_inventory(id) ON DELETE SET NULL,
  note              text NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_components_by_recipe ON public.recipe_components (recipe_id, position);

COMMENT ON COLUMN public.recipe_components.component_qb_item_id IS
  'The component''s QuickBooks item id where it has one — the identity that survives a catalogue wipe. NULL is legal: an unlinked component prints unpriced.';

-- ═══════════════════════ §4 — A CONFIRMED MATCH IS TENANT CONFIG ══════════════════════════════
CREATE TABLE IF NOT EXISTS public.component_purchase_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  component_id      uuid NOT NULL REFERENCES public.recipe_components(id) ON DELETE CASCADE,
  receipt_id        uuid NULL REFERENCES public.receipts(id) ON DELETE SET NULL,
  -- 🔴 WHICH DOCUMENT, not which capture of it (tech-debt #143): vendor + date + amount, as the
  -- reader sees them. When the same invoice is captured three times, this is the same key each time.
  document_key      text NULL,
  receipt_line_index integer NULL,
  matched_description text NULL,
  vendor_id         uuid NULL REFERENCES public.vendors(id) ON DELETE SET NULL,
  pack_size         numeric NULL CHECK (pack_size IS NULL OR pack_size > 0),
  pack_unit         text NULL,
  -- What the receipt line said, kept so a link can be re-read without the receipt being re-parsed.
  line_unit_price   numeric NULL,
  purchased_on      date NULL,
  -- Which spread Lauren chose for THIS purchase. Equal-per-item is the default (David, 2026-09-21).
  freight_spread    text NOT NULL DEFAULT 'equal_per_item'
    CHECK (freight_spread IN ('equal_per_item', 'pro_rata_by_value')),
  confirmed_by      uuid NULL,
  confirmed_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS component_purchase_links_by_component ON public.component_purchase_links (component_id, confirmed_at DESC);

COMMENT ON TABLE public.component_purchase_links IS
  'A human-confirmed match between a recipe component and a receipt line (ledger #370). Tenant config — it survives a catalogue wipe, and it is what "what did we last pay" reads. document_key names the DOCUMENT so three captures of one invoice are not three purchases (tech-debt #143).';

-- ═══════════════════════ §5 — THE LABOUR TABLE, SHIPPED EMPTY ═════════════════════════════════
-- David, 2026-09-21: *"no yard-crew rates exist, and crews change week to week."* The structure
-- exists so a recipe can say "labour not costed yet — no rates entered" rather than implying zero.
CREATE TABLE IF NOT EXISTS public.labour_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- A person, or a crew. Named in the business's own words; no link to a login, because the people
  -- doing the work often do not have one.
  who             text NOT NULL,
  hourly_rate     numeric NOT NULL CHECK (hourly_rate > 0),
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  note            text NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labour_rates_by_business ON public.labour_rates (business_id, effective_from DESC);

COMMENT ON TABLE public.labour_rates IS
  'Per-person or per-crew hourly rates (R-118: yard workers are not paid the same). SHIPS EMPTY by David''s instruction 2026-09-21 — a recipe records minutes and says labour is not costed until a rate exists. Behind the money wall (pricing_recipe:*), like every other wage figure (R-87).';

-- ═══════════════════════ RLS — CONFIG IS SETTINGS; WAGES ARE MONEY ════════════════════════════
ALTER TABLE public.item_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_purchase_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_rates ENABLE ROW LEVEL SECURITY;

-- The recipe and its components read like the container ladder: any active member may READ (the
-- person building a batch is not an owner), and editing is `settings:update`.
DROP POLICY IF EXISTS item_recipes_member_select ON public.item_recipes;
CREATE POLICY item_recipes_member_select ON public.item_recipes FOR SELECT
  USING (public.is_active_member(business_id));
DROP POLICY IF EXISTS item_recipes_settings_insert ON public.item_recipes;
CREATE POLICY item_recipes_settings_insert ON public.item_recipes FOR INSERT
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));
DROP POLICY IF EXISTS item_recipes_settings_update ON public.item_recipes;
CREATE POLICY item_recipes_settings_update ON public.item_recipes FOR UPDATE
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

DROP POLICY IF EXISTS recipe_components_member_select ON public.recipe_components;
CREATE POLICY recipe_components_member_select ON public.recipe_components FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.item_recipes r
                  WHERE r.id = recipe_components.recipe_id AND public.is_active_member(r.business_id)));
DROP POLICY IF EXISTS recipe_components_settings_insert ON public.recipe_components;
CREATE POLICY recipe_components_settings_insert ON public.recipe_components FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.item_recipes r
                       WHERE r.id = recipe_components.recipe_id
                         AND public.is_active_member(r.business_id)
                         AND public.has_permission(r.business_id, 'settings:update')));
DROP POLICY IF EXISTS recipe_components_settings_update ON public.recipe_components;
CREATE POLICY recipe_components_settings_update ON public.recipe_components FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.item_recipes r
                  WHERE r.id = recipe_components.recipe_id
                    AND public.is_active_member(r.business_id)
                    AND public.has_permission(r.business_id, 'settings:update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.item_recipes r
                       WHERE r.id = recipe_components.recipe_id
                         AND public.is_active_member(r.business_id)
                         AND public.has_permission(r.business_id, 'settings:update')));
-- ⚠️ NO DELETE POLICY on a recipe or a component, by the same reasoning as the container ladder
-- (R-133, "retire, never delete"): a build run already recorded points at what it consumed.

DROP POLICY IF EXISTS component_links_member_select ON public.component_purchase_links;
CREATE POLICY component_links_member_select ON public.component_purchase_links FOR SELECT
  USING (public.is_active_member(business_id));
DROP POLICY IF EXISTS component_links_settings_insert ON public.component_purchase_links;
CREATE POLICY component_links_settings_insert ON public.component_purchase_links FOR INSERT
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));
DROP POLICY IF EXISTS component_links_settings_update ON public.component_purchase_links;
CREATE POLICY component_links_settings_update ON public.component_purchase_links FOR UPDATE
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

-- 🔴 WAGES ARE THE MOAT (R-87). A manager holds settings:* and NOT pricing_recipe:* — measured at
-- LAWNS — so the labour table is gated on the money permission, exactly like business_pricing_config.
DROP POLICY IF EXISTS labour_rates_money_select ON public.labour_rates;
CREATE POLICY labour_rates_money_select ON public.labour_rates FOR SELECT
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:read'));
DROP POLICY IF EXISTS labour_rates_money_insert ON public.labour_rates;
CREATE POLICY labour_rates_money_insert ON public.labour_rates FOR INSERT
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:update'));
DROP POLICY IF EXISTS labour_rates_money_update ON public.labour_rates;
CREATE POLICY labour_rates_money_update ON public.labour_rates FOR UPDATE
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:update'));

-- ═══════════════════════ §5b — THE WIPE GUARD: A LINK THAT WOULD BLOCK THE WIPE IS REFUSED ════
-- 🔴 PROVED NECESSARY BY THE PROBE, NOT ASSUMED (recipes-survive-wipe-370.pglite, 2026-09-21).
-- `undo_import_run` enumerates every single-column FK into `business_inventory` from the catalog and
-- REFUSES the wipe when one of them points at a row the load created — naming the table and column.
-- A recipe or component linked by ROW ID to an IMPORTED product therefore silently takes away the
-- customer's ability to reload their catalogue. The identity that survives is `qb_item_id`, so:
--   · linking to a product that carries an `import_run_id` is REFUSED, and the message says to use
--     the QuickBooks id instead;
--   · linking to a row this platform owns (no import run — the bubbler) is allowed, because the wipe
--     never touches it.
-- This is the rule stated once, in the only place that cannot be bypassed.
CREATE OR REPLACE FUNCTION public.recipe_link_must_survive_a_wipe()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_id uuid; v_run uuid; v_qb text;
BEGIN
  -- ⚠️ IF, not CASE: plpgsql resolves the field reference in EVERY branch of a CASE expression, so
  -- `NEW.component_inventory_id` was looked up on `item_recipes` too and the trigger died with
  -- "record new has no field". An IF statement is parsed branch by branch, as it executes.
  IF TG_TABLE_NAME = 'item_recipes' THEN
    v_id := NEW.inventory_id;
  ELSE
    v_id := NEW.component_inventory_id;
  END IF;
  IF v_id IS NULL THEN RETURN NEW; END IF;
  SELECT bi.import_run_id, bi.qb_item_id INTO v_run, v_qb FROM public.business_inventory bi WHERE bi.id = v_id;
  IF v_run IS NOT NULL THEN
    RAISE EXCEPTION 'recipe_link_must_survive_a_wipe: that product came from a catalogue load, so a link by row id would be erased by the next reload and would block it. Link it by its QuickBooks item id (%) instead.', COALESCE(v_qb, 'none recorded');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_recipes_link_survives ON public.item_recipes;
CREATE TRIGGER trg_item_recipes_link_survives BEFORE INSERT OR UPDATE ON public.item_recipes
  FOR EACH ROW EXECUTE FUNCTION public.recipe_link_must_survive_a_wipe();
DROP TRIGGER IF EXISTS trg_recipe_components_link_survives ON public.recipe_components;
CREATE TRIGGER trg_recipe_components_link_survives BEFORE INSERT OR UPDATE ON public.recipe_components
  FOR EACH ROW EXECUTE FUNCTION public.recipe_link_must_survive_a_wipe();

-- ═══════════════════════ §6 — A BUILD RUN IS AN INVENTORY EVENT ═══════════════════════════════
-- 🔴 ONE TRANSACTION, OR NOTHING (tech-debt #69's lesson: a multi-step accept that half-lands leaves
-- stock wrong in two directions and the ledger is append-only, so there is no rolling back a part).
-- Components out, finished units in, one ledger row each, all inside this function.
-- ⚠️ A component with no stock row MOVES NOTHING and is REPORTED — it is a real recipe line (the
-- 12-24-12 is one) and silently skipping it would make a partial build look complete.
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

  -- The made item's own stock row: by QuickBooks id where the recipe carries one, else the row it names.
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

  -- Components OUT. A component with no stock row moves nothing and is named in the result.
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
            format('consumed by a build of %s', v_recipe.yield_unit), 'build_run', v_run, auth.uid(), now());
    UPDATE public.business_inventory
       SET qty = GREATEST(0, COALESCE(qty, 0) - (v_component.quantity * p_batches))
     WHERE id = v_component.stock_id;
    v_moved := v_moved + 1;
  END LOOP;

  -- Finished units IN.
  v_made := v_recipe.yield_quantity * p_batches;
  INSERT INTO public.business_inventory_ledger
    (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, occurred_at)
  VALUES (p_business_id, v_target, v_made, 'build',
          COALESCE(p_note, format('built %s %s', v_made, v_recipe.yield_unit)), 'build_run', v_run, auth.uid(), now());
  UPDATE public.business_inventory SET qty = COALESCE(qty, 0) + v_made WHERE id = v_target;

  RETURN jsonb_build_object('ok', true, 'run_id', v_run, 'made', v_made, 'unit', v_recipe.yield_unit,
    'components_moved', v_moved, 'components_not_stocked', v_unlinked);
END;
$$;

REVOKE ALL ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.record_build_run(uuid, uuid, numeric, text) IS
  'A build run: components out, finished units in, one transaction (ledger #370). Components with no stock row move nothing and are NAMED in the result — a partial build never reads as complete.';

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying. Catalog-backed, never the builder''s memory (§9 gate).
-- 🔴 WHERE A STEP EXPECTS A REFUSAL, THE ERROR IS THE PASS (David, 2026-09-21): the SQL editor shows
--    a red error and the transaction rolls back — that IS the check passing. Read the constraint name.
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the flag, its default and its CHECK
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='business_inventory' AND column_name='item_type';
--   -- EXPECT: item_type · text · NO · 'purchased'::text
--   SELECT item_type, count(*) FROM public.business_inventory
--    WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' GROUP BY 1;
--   -- EXPECT: purchased | 1079  (nothing is manufactured until somebody says so)
--
-- V2 · the four tables exist with RLS ON and the policies named
--   SELECT c.relname, c.relrowsecurity, count(p.polname) AS policies
--     FROM pg_class c LEFT JOIN pg_policy p ON p.polrelid = c.oid
--    WHERE c.relname IN ('item_recipes','recipe_components','component_purchase_links','labour_rates')
--    GROUP BY 1,2 ORDER BY 1;
--   -- EXPECT four rows, relrowsecurity = true, 3 policies each. NO delete policy anywhere.
--
-- V3 · 🔴 THE ERROR IS THE PASS — a recipe must carry exactly one identity (rolled back)
--   BEGIN;
--   INSERT INTO public.item_recipes (business_id, qb_item_id, inventory_id, yield_quantity, yield_unit)
--   VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '999',
--           (SELECT id FROM public.business_inventory WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' LIMIT 1),
--           1, 'each');
--   -- EXPECT: new row … violates check constraint "item_recipes_one_identity"   ← the PASS
--   ROLLBACK;
--
-- V4 · 🔴 THE ERROR IS THE PASS — a yield of zero is refused (rolled back)
--   BEGIN;
--   INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
--   VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '998', 0, 'yd');
--   -- EXPECT: violates check constraint "item_recipes_yield_quantity_check"      ← the PASS
--   ROLLBACK;
--
-- V5 · the labour table is EMPTY and stays that way until somebody enters a rate
--   SELECT count(*) FROM public.labour_rates;   -- EXPECT 0
--
-- V6 · the build run is callable by a logged-in user and not by the public key
--   SELECT has_function_privilege('anon','public.record_build_run(uuid,uuid,numeric,text)','EXECUTE') AS anon_can,
--          has_function_privilege('authenticated','public.record_build_run(uuid,uuid,numeric,text)','EXECUTE') AS auth_can;
--   -- EXPECT: anon_can false · auth_can true
--
-- V7 · 🔴 THE ERROR IS THE PASS — a component may not be linked by row id to an IMPORTED product
--   BEGIN;
--   INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
--   VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 'PROBE-1', 1, 'each');
--   INSERT INTO public.recipe_components (recipe_id, name, quantity, unit, component_inventory_id)
--   SELECT r.id, 'probe', 1, 'each',
--          (SELECT id FROM public.business_inventory
--            WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND import_run_id IS NOT NULL LIMIT 1)
--     FROM public.item_recipes r WHERE r.qb_item_id='PROBE-1';
--   -- EXPECT: recipe_link_must_survive_a_wipe: that product came from a catalogue load …   ← the PASS
--   ROLLBACK;
--
-- V8 · LAWNS's word for a made item
--   SELECT config->>'madeItemLabel' FROM public.business_operations_config
--    WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--   -- EXPECT: homemade
