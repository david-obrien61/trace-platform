-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925g — ONE ITEM, HELD IN ONE UNIT, SOLD IN SEVERAL · ledger #409 · yard production P1
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✏️ **RENUMBERED 2026-09-26 (ledger #416): THIS FILE WAS `20260925b_…`, AND THAT SLOT WAS TAKEN TWICE OVER.**
-- `npm run migration:slot` on 2026-09-26 showed slot **c with THREE claimants** and **d with TWO**, across
-- `origin/main` and David's uncommitted folder. A person told to *"apply 20260925c"* would have had two
-- different files to choose from — Rule 11b's exact defect, *"and a collision here is NOT a merge conflict"*.
-- 🔴 **MINE MOVED RATHER THAN THEIRS, AND THE REASON IS MEASURED: all four of mine were UNAPPLIED** (verified
-- live 2026-09-26 — `install_kit_components`, `production_work_orders`, `item_sale_units` and
-- `build_runs.started_at` all absent), so renaming them is legitimate; renaming an applied migration is not
-- (§6 r1). **The old name `20260925b_…` is SUPERSEDED and must not be used.** Ledger #409 is unchanged.
-- ⚠️ The SHA in any note written before 2026-09-26 refers to the old filename and is stale; the current one
-- is in `~/Desktop/MORNING-2026-09-26.md`.
--
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David, 2026-09-25) ─────────────────────────────────────────────────────────────────
-- *"ONE item, ONE definition, used everywhere: the load list, inventory, the install kit and sales
-- all read the same mix item… The five sale items are PORTIONS of that one mix, not separate stock."*
--
-- LAWNS blends one pile and sells it five ways. Today those are FIVE SEPARATE STOCK ROWS with five
-- separate quantities, so selling a bucket moves a number with no relationship to the pile, and
-- nothing can answer *"how much mix is there?"* This is the item-master standard: a BASE item held
-- in ONE stocking unit, and every sale unit a CONVERSION of it.
--
-- ── 🔴 THREE MEASUREMENTS THAT CHANGED THE DESIGN (LIVE 2026-09-25, §6 r25) ──────────────────
-- ① **`sku` IS NULL ON ALL TEN MIX ROWS.** The prompt asked for links keyed on `SFCM1` · `SFCM2` ·
--    `FCMB15/30/45`. **Those SKUs do not exist.** Only `qb_item_id` is populated. So the key here is
--    `qb_item_id`, and a config keyed on the SKUs as written would have matched nothing at all.
-- ② **THERE ARE TEN ROWS IN TWO FAMILIES, NOT FIVE.** *Fertile Compost Mix — Proprietary Blend*
--    (the one LAWNS blends: qb **52** 1 yd · **51** ½ yd · **40/41/42** 15/30/45 gal) and *Regular
--    Compost Mix — w/o Fertilizer* (bought, not made: qb **54 · 53 · 48 · 49 · 50**). The table must
--    therefore support MORE THAN ONE base per tenant — one made, one bought — and it does.
-- ③ **EVERY ONE OF THE TEN IS `qty_basis = 'placeholder'`.** Catalogue-import seed values (1, 10, 10,
--    10, 10), not counts. **Nothing here merges them.** Summing five placeholders through the
--    conversions would produce a confident total nobody measured; the reader lists them instead.
--
-- ── WHY GALLONS, AND WHY THAT IS NOT A PREFERENCE ────────────────────────────────────────────
-- `business_inventory.qty` is `integer NOT NULL`. A pile held in YARDS cannot represent half a yard
-- at all, and LAWNS's batch makes **2.5 yd** — measured in ledger #410, one batch moved an integer
-- yard column by **3**. Held in GALLONS the same batch is 505, and the rounding error falls from
-- **20% of a batch to 0.013%**. **The unit changes; the column does not** — `qty` stays an integer
-- because most of this catalogue is trees, and *"27 trees"* is the right shape.
--
-- ── 🔴 THE TABLE SHIPS EMPTY, AND THAT IS THE RULE NOT AN OMISSION ───────────────────────────
-- No migration seeds a conversion for anyone. This is the same call as `business_not_stock_items`
-- (2026-09-22) and `delivery_rings` (`20260924f`), where seeding tenant rows from a migration was
-- ruled WRONG and removed: the conversions are PROPOSED from the tenant's own product names —
-- `proposeSaleUnits` reads *"15gal Bucket: …"* → 15 gallon with the existing `parseUnitOfMeasure`
-- (§6 r8) — shown with *"proposed from the product name"* beside each, and written by a person.
-- ⚠️ **WHICH ROW HOLDS THE PILE IS DAVID'S DECISION AND THIS FILE DOES NOT TAKE IT.** It is in the
-- morning file with a recommended default. `mixPlanning.ts` already says the same thing about the
-- same question: *"`chosenItemId` IS TENANT CONFIG AND IT IS NULL UNTIL LAUREN NAMES ONE… A default
-- here would be a choice made by whoever wrote this line, wearing the appearance of a fact she
-- confirmed."* That comment is honoured rather than worked around.
--
-- ── WIPE CLASS: CONFIG — SURVIVES (STD-019) ──────────────────────────────────────────────────
-- LAWNS's products are RECREATED by the QuickBooks reload, so every `business_inventory.id` changes.
-- These rows key on `qb_item_id`, which the reload preserves, so the conversions survive it. There is
-- **deliberately no FK to `business_inventory`** — one would either block the wipe or cascade the
-- config away with it, and both defeat the point.
--
-- ── ONE LEVEL ONLY, ENFORCED BY A TRIGGER ────────────────────────────────────────────────────
-- A base item MAY be a sale unit of itself (factor = its own size — the ordinary item-master case).
-- It may NOT convert to a DIFFERENT base. A chain (½ scoop → scoop → pile) either stops one hop
-- short or multiplies twice depending on which caller reads it; both are wrong and neither raises
-- anything. The client refuses it in `chainProblem`; the trigger refuses it for everything else.
--
-- DEPENDENCIES: businesses · is_active_member · has_permission (all live).
-- OUTPUTS:      public.item_sale_units + 4 policies + the one-level trigger.
-- READER:       packages/shared/src/inventory/saleUnits.ts (PURE — 35 probes, both directions).
-- HARNESS:      scripts/sql-harness/item-sale-units-409.pglite.mjs — this file executed end to end
--               against the live snapshot, its own V-blocks run verbatim, red-first, mutants.
-- STORY:        user_stories.md → *Is there enough mix for Saturday?*
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.item_sale_units (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- 🔴 qb_item_id, NEVER business_inventory.id — see the wipe class above.
  sale_qb_item_id  text NOT NULL CHECK (btrim(sale_qb_item_id) <> ''),
  base_qb_item_id  text NOT NULL CHECK (btrim(base_qb_item_id) <> ''),
  -- How many BASE units ONE of this sale unit is worth. A 45 gal bucket off a gallon-held pile is 45.
  base_quantity    numeric NOT NULL CHECK (base_quantity > 0),
  -- The BASE item's stocking unit. Display is a separate question the reader answers.
  base_unit        text NOT NULL CHECK (btrim(base_unit) <> ''),
  -- ⚠️ NOT NULL WITH NO DEFAULT, ON PURPOSE. A conversion nobody can explain is one nobody should
  -- trust, and this is the field a person reads when the arithmetic surprises them.
  because          text NOT NULL CHECK (btrim(because) <> ''),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One sale unit converts to exactly one base. Two rows for one item would make the draw depend on
-- which the reader happened to find first.
CREATE UNIQUE INDEX IF NOT EXISTS item_sale_units_one_per_item
  ON public.item_sale_units (business_id, sale_qb_item_id);
CREATE INDEX IF NOT EXISTS item_sale_units_by_base
  ON public.item_sale_units (business_id, base_qb_item_id);

COMMENT ON TABLE public.item_sale_units IS
  'Alternate sale units of a base stock item (UoM conversion). Keyed on qb_item_id so the rows '
  'survive a catalogue wipe/reload (STD-019). CONFIG wipe class. Ships empty; conversions are '
  'proposed from product names and written by a person (ledger #409).';
COMMENT ON COLUMN public.item_sale_units.base_quantity IS
  'How many base units ONE of this sale unit is worth. Must be > 0.';

-- ── ONE LEVEL ONLY ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.item_sale_units_no_chain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_next text;
BEGIN
  -- A base item as its OWN sale unit is the ordinary case, not a chain.
  IF NEW.base_qb_item_id = NEW.sale_qb_item_id THEN RETURN NEW; END IF;

  -- Does the thing we point AT itself point somewhere else?
  SELECT base_qb_item_id INTO v_next FROM public.item_sale_units
   WHERE business_id = NEW.business_id AND sale_qb_item_id = NEW.base_qb_item_id
     AND base_qb_item_id <> NEW.base_qb_item_id;
  IF v_next IS NOT NULL THEN
    RAISE EXCEPTION 'item % converts to %, which itself converts to % — a sale unit must point straight at the item that holds the stock, or the quantity gets converted twice',
      NEW.sale_qb_item_id, NEW.base_qb_item_id, v_next;
  END IF;

  -- And does anything point AT us, making us a middle link?
  SELECT sale_qb_item_id INTO v_next FROM public.item_sale_units
   WHERE business_id = NEW.business_id AND base_qb_item_id = NEW.sale_qb_item_id
     AND sale_qb_item_id <> NEW.sale_qb_item_id;
  IF v_next IS NOT NULL THEN
    RAISE EXCEPTION 'item % already converts to %, so % cannot itself convert to % — that would make % a middle link and convert twice',
      v_next, NEW.sale_qb_item_id, NEW.sale_qb_item_id, NEW.base_qb_item_id, NEW.sale_qb_item_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS item_sale_units_no_chain_trg ON public.item_sale_units;
CREATE TRIGGER item_sale_units_no_chain_trg
  BEFORE INSERT OR UPDATE ON public.item_sale_units
  FOR EACH ROW EXECUTE FUNCTION public.item_sale_units_no_chain();

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- AC-2: scoped to business_id membership. Reads on membership (a yard hand needs to know what a
-- bucket is worth); writes on `inventory:update`, the same string that gates changing stock.
ALTER TABLE public.item_sale_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_sale_units_member_select ON public.item_sale_units;
CREATE POLICY item_sale_units_member_select ON public.item_sale_units
  FOR SELECT USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS item_sale_units_member_insert ON public.item_sale_units;
CREATE POLICY item_sale_units_member_insert ON public.item_sale_units
  FOR INSERT WITH CHECK (public.is_active_member(business_id)
                         AND public.has_permission(business_id, 'inventory:update'));

DROP POLICY IF EXISTS item_sale_units_member_update ON public.item_sale_units;
CREATE POLICY item_sale_units_member_update ON public.item_sale_units
  FOR UPDATE USING (public.is_active_member(business_id)
                    AND public.has_permission(business_id, 'inventory:update'))
         WITH CHECK (public.is_active_member(business_id)
                     AND public.has_permission(business_id, 'inventory:update'));

DROP POLICY IF EXISTS item_sale_units_member_delete ON public.item_sale_units;
CREATE POLICY item_sale_units_member_delete ON public.item_sale_units
  FOR DELETE USING (public.is_active_member(business_id)
                    AND public.has_permission(business_id, 'inventory:update'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_sale_units TO authenticated;
REVOKE ALL ON public.item_sale_units FROM anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — paste each on its own. Each builds its own fixture, RAISEs its verdict and ROLLS
-- BACK, so the message IS the report (§6 r26). No placeholders, nothing to fill in.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · THE TABLE, ITS COLUMNS, ITS RLS AND ITS FOUR POLICIES.
--   DO $v1$
--   DECLARE cols int; pols int; rls boolean; uniq int;
--   BEGIN
--     SELECT count(*) INTO cols FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='item_sale_units';
--     SELECT count(*) INTO pols FROM pg_policies
--      WHERE schemaname='public' AND tablename='item_sale_units';
--     SELECT relrowsecurity INTO rls FROM pg_class WHERE oid='public.item_sale_units'::regclass;
--     SELECT count(*) INTO uniq FROM pg_indexes
--      WHERE schemaname='public' AND tablename='item_sale_units' AND indexname='item_sale_units_one_per_item';
--     IF cols=9 AND pols=4 AND rls AND uniq=1 THEN
--       RAISE EXCEPTION 'V1 PASS — 9 columns, RLS on, 4 policies, the one-per-item unique index present';
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — cols=% policies=% rls=% unique=%', cols, pols, rls, uniq;
--     END IF;
--   END $v1$;
--
--   -- V2 · THE TABLE IS EMPTY ON EVERY TENANT. No migration seeds a conversion for anyone.
--   DO $v2$
--   DECLARE n bigint;
--   BEGIN
--     SELECT count(*) INTO n FROM public.item_sale_units;
--     IF n = 0 THEN
--       RAISE EXCEPTION 'V2 PASS — 0 rows: the conversions are proposed from product names and written by a person, never seeded';
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — % row(s) present; something seeded tenant config', n;
--     END IF;
--   END $v2$;
--
--   -- V3 · A CHAIN IS REFUSED BY THE TRIGGER, AND A BASE AS ITS OWN SALE UNIT IS NOT A CHAIN.
--   -- 🔴 THE TWO HALVES USE DIFFERENT ITEM IDS ON PURPOSE. A first draft inserted 52 → 52 and then
--   -- tried 52 → 99: that IS refused, but by the UNIQUE INDEX, not the trigger, so the block would
--   -- have passed with the trigger missing. Mutant M1 in the harness found it. Here 52 has no row
--   -- of its own, so only the trigger can refuse 52 → 99.
--   DO $v3$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
--           chained boolean := false; selfok boolean := false; msg text := '';
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b,'V3 Co',u);
--     -- a base as its OWN sale unit, on an id nothing else touches: must be ACCEPTED
--     INSERT INTO public.item_sale_units (business_id,sale_qb_item_id,base_qb_item_id,base_quantity,base_unit,because)
--       VALUES (b,'60','60',201.974026,'gal','a base sold as itself');
--     selfok := true;
--     -- 51 points at 52. 52 has NO row of its own.
--     INSERT INTO public.item_sale_units (business_id,sale_qb_item_id,base_qb_item_id,base_quantity,base_unit,because)
--       VALUES (b,'51','52',100.987013,'gal','1/2 Yard Scoop');
--     BEGIN
--       INSERT INTO public.item_sale_units (business_id,sale_qb_item_id,base_qb_item_id,base_quantity,base_unit,because)
--         VALUES (b,'52','99',1,'gal','a chain that must not be allowed');
--     EXCEPTION WHEN others THEN chained := true; msg := SQLERRM;
--     END;
--     IF selfok AND chained AND msg LIKE '%twice%' THEN
--       RAISE EXCEPTION 'V3 PASS — a base as its own sale unit is accepted; the chain 51 → 52 → 99 is refused BY THE TRIGGER: %', msg;
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — self=% chain_refused=% reason=%', selfok, chained, msg;
--     END IF;
--   END $v3$;
--
--   -- V4 · TENANT ISOLATION AND THE WRITE PERMISSION, UNDER A REAL PRINCIPAL (AC-3).
--   DO $v4$
--   DECLARE b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid();
--           u uuid := gen_random_uuid(); seen int; refused boolean := false;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b1,'V4 Mine',u),(b2,'V4 Theirs',u);
--     -- a member of b1 only, holding the write string
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b1,u,true,'owner','V4','["inventory:update"]'::jsonb);
--     INSERT INTO public.item_sale_units (business_id,sale_qb_item_id,base_qb_item_id,base_quantity,base_unit,because)
--       VALUES (b1,'40','52',15,'gal','15gal Bucket'),(b2,'40','52',15,'gal','another tenant''s');
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     PERFORM set_config('role', 'authenticated', true);
--     SELECT count(*) INTO seen FROM public.item_sale_units;
--     BEGIN
--       INSERT INTO public.item_sale_units (business_id,sale_qb_item_id,base_qb_item_id,base_quantity,base_unit,because)
--         VALUES (b2,'41','52',30,'gal','writing into a business I am not in');
--     EXCEPTION WHEN others THEN refused := true;
--     END;
--     IF seen = 1 AND refused THEN
--       RAISE EXCEPTION 'V4 PASS — a member of one business sees only its own row (1 of 2) and cannot write into the other';
--     ELSE
--       RAISE EXCEPTION 'V4 FAIL — rows visible=% (expected 1) cross_tenant_write_refused=%', seen, refused;
--     END IF;
--   END $v4$;
