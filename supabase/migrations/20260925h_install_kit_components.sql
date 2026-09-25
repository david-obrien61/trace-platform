-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925h — THE INSTALL KIT IS CONFIGURABLE · ledger #411 · yard production P3
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✏️ **RENUMBERED 2026-09-26 (ledger #416): THIS FILE WAS `20260925c_…`, AND THAT SLOT WAS TAKEN TWICE OVER.**
-- `npm run migration:slot` on 2026-09-26 showed slot **c with THREE claimants** and **d with TWO**, across
-- `origin/main` and David's uncommitted folder. A person told to *"apply 20260925c"* would have had two
-- different files to choose from — Rule 11b's exact defect, *"and a collision here is NOT a merge conflict"*.
-- 🔴 **MINE MOVED RATHER THAN THEIRS, AND THE REASON IS MEASURED: all four of mine were UNAPPLIED** (verified
-- live 2026-09-26 — `install_kit_components`, `production_work_orders`, `item_sale_units` and
-- `build_runs.started_at` all absent), so renaming them is legitimate; renaming an applied migration is not
-- (§6 r1). **The old name `20260925c_…` is SUPERSEDED and must not be used.** Ledger #411 is unchanged.
-- ⚠️ The SHA in any note written before 2026-09-26 refers to the old filename and is stale; the current one
-- is in `~/Desktop/MORNING-2026-09-26.md`.
--
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David, 2026-09-25) ─────────────────────────────────────────────────────────────────
-- *"The COMPONENT LIST is hard-coded today — David wants it CONFIGURABLE."* Adding a component to
-- what an install consumes, or changing which product it comes out of, is a build today.
--
-- ── 🔴 WHAT IS ACTUALLY MISSING, AND IT IS NOT THE ARITHMETIC ────────────────────────────────
-- `packages/cultivar-os/src/lib/loadList.ts` ALREADY computes every install quantity LAWNS needs —
-- special mix per container gallon, T-posts per rung, rope per T-post, bubblers, water monitor kits,
-- deer-fence posts, ring circumference — from the container ladder plus five Operations keys. It is
-- 748 lines of deliberate design under [[R-155]] and ledger #343, and its own header says *"this file
-- holds NO numbers of its own."* **None of that is duplicated here (§6 r8).**
--
-- **What is missing is the COMPONENT → INVENTORY ITEM LINK.** The load list can tell you a stop needs
-- 120 gallons of special mix and 14 T-posts; **nothing anywhere says which product those come out of**,
-- so nothing can be issued from stock when a crew taps Done. That link is this table, and it is the
-- whole reason P4 cannot exist without it.
--
-- ⚠️ **SO THE DIVISION OF LABOUR IS EXPLICIT: this table DECLARES, the load list EVALUATES.** A row
-- here says *"special mix comes out of item 52, at 2 gallons per container gallon."* The load list
-- remains the one place that multiplies. A future component nobody has thought of gets a row with a
-- rule, not a code change.
--
-- ── THE SIX RULES ARE DAVID'S OWN WORDS, AND EACH ONE ALREADY HAS A COMPUTED QUANTITY ────────
--   per_tree             one per tree installed            → water monitor kit (1 per installed tree)
--   per_container_gallon × the tree's container gallons     → special mix (2 gal per container gallon)
--   per_t_post           × the number of T-posts            → rope (~4 ft per T-post; it STAYS)
--   per_rung             the RUNG supplies the count        → T-posts (2 up to 65 gal, 4 at 95+)
--   only_if_ordered      only where the order has that line → bubbler
--   only_if_marked       only where the stop is marked      → deer fence · trunk protection
--
-- 🔴 `per_rung` IS THE ONE RULE WITH NO `factor`, AND THAT IS ENFORCED RATHER THAN TRUSTED. The count
-- lives on `container_ladder.install_t_posts_per_tree` — nine rows a grower edits — so a factor here
-- would be a SECOND home for it (STD-011), and the copy that drifts is always the one nobody loads
-- against. A CHECK requires `factor IS NULL` for `per_rung` and `factor > 0` for every other rule.
--
-- ── 🔴 `qb_item_id` IS NULLABLE, DELIBERATELY, AND THE READER MUST SAY SO ─────────────────────
-- A component can be declared before anyone knows which product it comes out of. **An unlinked
-- component is REPORTED, never silently skipped** — the same shape as `recipe_components`, where 7 of
-- LAWNS's 7 are unlinked and a build consequently consumes nothing. Skipping it quietly is how an
-- install appears to cost nothing.
--
-- ── WIPE CLASS: CONFIG — SURVIVES (STD-019) ──────────────────────────────────────────────────
-- Keyed on `qb_item_id`, which the QuickBooks reload preserves; **no FK to `business_inventory`**,
-- whose ids the reload changes. Same reasoning as `20260925g`.
--
-- ── 🔴 THE TABLE SHIPS EMPTY. IT DOES NOT SEED LAWNS'S KIT. ───────────────────────────────────
-- The brief says *"Seed LAWNS's kit from the rulings above."* **It is not seeded here, and the reason
-- is a standing ruling rather than an omission:** seeding tenant rows from a migration was ruled WRONG
-- and REMOVED on 2026-09-22 (`business_not_stock_items`), and `20260924f_delivery_rings` states the
-- same rule in its own header — *"NOTHING HERE IS HARD-CODED, AND THE TABLE IS EMPTY ON PURPOSE."*
-- ⚠️ **The seed exists as a SEPARATE file for David to run** — `docs/decisions/2026-09-25-lawns-install-kit-seed.sql`
-- — so that what is written on LAWNS's behalf is something he reads and pastes, not something a
-- migration did to him. **And it cannot be written until he says which product each component is**,
-- which is the open question in the morning file.
--
-- DEPENDENCIES: businesses · is_active_member · has_permission (all live).
-- OUTPUTS:      public.install_kit_components + 4 policies + the factor/rule CHECK.
-- READER:       packages/shared/src/inventory/installKit.ts (PURE).
-- HARNESS:      scripts/sql-harness/install-kit-411.pglite.mjs
-- STORY:        user_stories.md → *What goes on the trailer for one delivery day*
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.install_kit_components (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- A stable key for the component, so a rename does not orphan the link. Lowercase, underscores.
  component_key  text NOT NULL CHECK (component_key ~ '^[a-z][a-z0-9_]*$'),
  -- What a person calls it on a screen and on the printed load list.
  label          text NOT NULL CHECK (btrim(label) <> ''),
  -- 🔴 NULLABLE ON PURPOSE: declared before it is linked. The reader REPORTS unlinked, never skips.
  qb_item_id     text CHECK (qb_item_id IS NULL OR btrim(qb_item_id) <> ''),
  rule           text NOT NULL CHECK (rule IN
                   ('per_tree','per_container_gallon','per_t_post','per_rung','only_if_ordered','only_if_marked')),
  -- The multiplier. NULL only for per_rung, where the RUNG supplies the count — see the header.
  factor         numeric,
  unit           text NOT NULL CHECK (btrim(unit) <> ''),
  because        text NOT NULL CHECK (btrim(because) <> ''),
  -- Retire, never delete ([[R-133]]): a retired component stays on the installs it already priced.
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT install_kit_factor_matches_rule CHECK (
    (rule = 'per_rung' AND factor IS NULL) OR (rule <> 'per_rung' AND factor > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS install_kit_one_per_key
  ON public.install_kit_components (business_id, component_key);

COMMENT ON TABLE public.install_kit_components IS
  'What one install consumes: component -> inventory item (by qb_item_id) + a quantity rule. '
  'DECLARES; loadList.ts EVALUATES (ledger #411). CONFIG wipe class — survives the catalogue reload. '
  'Ships empty; LAWNS''s kit is a separate file David pastes.';
COMMENT ON COLUMN public.install_kit_components.factor IS
  'The multiplier. NULL only for per_rung, whose count lives on container_ladder.install_t_posts_per_tree.';
COMMENT ON COLUMN public.install_kit_components.qb_item_id IS
  'The product this component comes out of. NULL = declared but not linked; the reader reports it.';

ALTER TABLE public.install_kit_components ENABLE ROW LEVEL SECURITY;

-- AC-2: membership-scoped. Reads on membership — a yard hand needs the kit to load a trailer.
-- Writes on `inventory:update`, the same string that gates changing what stock exists.
DROP POLICY IF EXISTS install_kit_member_select ON public.install_kit_components;
CREATE POLICY install_kit_member_select ON public.install_kit_components
  FOR SELECT USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS install_kit_member_insert ON public.install_kit_components;
CREATE POLICY install_kit_member_insert ON public.install_kit_components
  FOR INSERT WITH CHECK (public.is_active_member(business_id)
                         AND public.has_permission(business_id, 'inventory:update'));

DROP POLICY IF EXISTS install_kit_member_update ON public.install_kit_components;
CREATE POLICY install_kit_member_update ON public.install_kit_components
  FOR UPDATE USING (public.is_active_member(business_id)
                    AND public.has_permission(business_id, 'inventory:update'))
         WITH CHECK (public.is_active_member(business_id)
                     AND public.has_permission(business_id, 'inventory:update'));

DROP POLICY IF EXISTS install_kit_member_delete ON public.install_kit_components;
CREATE POLICY install_kit_member_delete ON public.install_kit_components
  FOR DELETE USING (public.is_active_member(business_id)
                    AND public.has_permission(business_id, 'inventory:update'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.install_kit_components TO authenticated;
REVOKE ALL ON public.install_kit_components FROM anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — paste each on its own. Each builds its own fixture, RAISEs its verdict and ROLLS
-- BACK, so the message IS the report (§6 r26). No placeholders, nothing to fill in.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · THE TABLE, ITS COLUMNS, ITS RLS, ITS FOUR POLICIES AND ITS UNIQUE KEY.
--   DO $v1$
--   DECLARE cols int; pols int; rls boolean; uniq int;
--   BEGIN
--     SELECT count(*) INTO cols FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='install_kit_components';
--     SELECT count(*) INTO pols FROM pg_policies
--      WHERE schemaname='public' AND tablename='install_kit_components';
--     SELECT relrowsecurity INTO rls FROM pg_class WHERE oid='public.install_kit_components'::regclass;
--     SELECT count(*) INTO uniq FROM pg_indexes
--      WHERE schemaname='public' AND tablename='install_kit_components' AND indexname='install_kit_one_per_key';
--     IF cols=12 AND pols=4 AND rls AND uniq=1 THEN
--       RAISE EXCEPTION 'V1 PASS — 12 columns, RLS on, 4 policies, the one-per-key unique index present';
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — cols=% policies=% rls=% unique=%', cols, pols, rls, uniq;
--     END IF;
--   END $v1$;
--
--   -- V2 · THE TABLE IS EMPTY ON EVERY TENANT. No migration seeds a kit for anyone.
--   DO $v2$
--   DECLARE n bigint;
--   BEGIN
--     SELECT count(*) INTO n FROM public.install_kit_components;
--     IF n = 0 THEN
--       RAISE EXCEPTION 'V2 PASS — 0 rows: LAWNS''s kit is a separate file David pastes, not something a migration did to him';
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — % row(s) present; a migration seeded tenant config', n;
--     END IF;
--   END $v2$;
--
--   -- V3 · THE FACTOR RULE, BOTH DIRECTIONS: per_rung must carry NO factor, everything else must.
--   DO $v3$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
--           rung_ok boolean := false; rung_with_factor boolean := false;
--           mix_ok boolean := false; mix_without_factor boolean := false;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b,'V3 Co',u);
--     -- per_rung with NO factor: ACCEPTED
--     INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--       VALUES (b,'t_post','T-post','200','per_rung',NULL,'each','the rung says how many');
--     rung_ok := true;
--     -- per_rung WITH a factor: REFUSED (it would be a second home for the rung's count)
--     BEGIN
--       INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--         VALUES (b,'t_post_bad','T-post','200','per_rung',2,'each','a second home for the rung count');
--     EXCEPTION WHEN others THEN rung_with_factor := true;
--     END;
--     -- per_container_gallon WITH a factor: ACCEPTED
--     INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--       VALUES (b,'special_mix','Special planting mix','52','per_container_gallon',2,'gal','2 gal per container gallon');
--     mix_ok := true;
--     -- per_container_gallon WITHOUT a factor: REFUSED
--     BEGIN
--       INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--         VALUES (b,'mix_bad','Mix','52','per_container_gallon',NULL,'gal','no factor');
--     EXCEPTION WHEN others THEN mix_without_factor := true;
--     END;
--     IF rung_ok AND rung_with_factor AND mix_ok AND mix_without_factor THEN
--       RAISE EXCEPTION 'V3 PASS — per_rung carries no factor and is refused with one; every other rule requires one';
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — rung_ok=% rung_with_factor_refused=% mix_ok=% mix_without_factor_refused=%',
--         rung_ok, rung_with_factor, mix_ok, mix_without_factor;
--     END IF;
--   END $v3$;
--
--   -- V4 · AN UNLINKED COMPONENT IS LEGAL (it is declared, not yet linked), AND TENANT ISOLATION HOLDS.
--   DO $v4$
--   DECLARE b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid();
--           u uuid := gen_random_uuid(); seen int; refused boolean := false; unlinked boolean := false;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b1,'V4 Mine',u),(b2,'V4 Theirs',u);
--     INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
--       VALUES (b1,u,true,'owner','V4','["inventory:update"]'::jsonb);
--     -- qb_item_id NULL: a component declared before anyone knows which product it comes from
--     INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--       VALUES (b1,'rope','Rope',NULL,'per_t_post',4,'ft','about 4 ft per T-post, and it stays');
--     unlinked := true;
--     INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--       VALUES (b2,'rope','Rope','999','per_t_post',4,'ft','another tenant''s');
--     PERFORM set_config('request.jwt.claim.sub', u::text, true);
--     PERFORM set_config('role', 'authenticated', true);
--     SELECT count(*) INTO seen FROM public.install_kit_components;
--     BEGIN
--       INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--         VALUES (b2,'mix','Mix','52','per_tree',1,'gal','writing into a business I am not in');
--     EXCEPTION WHEN others THEN refused := true;
--     END;
--     IF unlinked AND seen = 1 AND refused THEN
--       RAISE EXCEPTION 'V4 PASS — an UNLINKED component is accepted and reported later; a member of one business sees 1 of 2 rows and cannot write into the other';
--     ELSE
--       RAISE EXCEPTION 'V4 FAIL — unlinked_accepted=% rows_visible=% cross_tenant_refused=%', unlinked, seen, refused;
--     END IF;
--   END $v4$;
