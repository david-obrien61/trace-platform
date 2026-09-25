-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925m — THE KIT'S FACTOR CHECK ACTUALLY REFUSES A MISSING FACTOR · fixes 20260925h
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
-- 🔴 IT FIXES A DEFECT DAVID FOUND BY RUNNING `20260925h`'s OWN V3 ON THE LIVE DATABASE:
--      rung_ok=t  rung_with_factor_refused=t  mix_ok=t  mix_without_factor_refused=**f**
--    So `install_kit_components` ACCEPTS a `per_container_gallon` component with **NO factor** —
--    a kit line that multiplies by nothing, which would compute no mix at all and say nothing.
--
-- ── WHY, AND IT IS SQL's THREE-VALUED LOGIC, NOT A TYPO ─────────────────────────────────────
-- `20260925h` shipped:
--
--     CHECK ((rule = 'per_rung' AND factor IS NULL) OR (rule <> 'per_rung' AND factor > 0))
--
-- With `rule = 'per_container_gallon'` and `factor = NULL`:
--     branch 1 →  FALSE AND (NULL IS NULL)  →  FALSE
--     branch 2 →  TRUE  AND (NULL > 0)      →  TRUE AND **NULL**  →  **NULL**
--     whole    →  FALSE OR NULL             →  **NULL**
--
-- 🔴 **AND A CHECK CONSTRAINT IS SATISFIED WHEN IT EVALUATES TO NULL. ONLY FALSE REJECTS.** So the
-- constraint could not refuse a missing factor on any rule — it was structurally incapable of it.
-- Measured on a real engine before this was written: `null::numeric > 0` returns **null**, and
-- `TRUE AND null` returns **null**.
--
-- **THE FIX IS `factor IS NOT NULL`, WHICH IS NEVER NULL ITSELF**, so branch 2 becomes
-- `TRUE AND FALSE AND …` → FALSE, and `FALSE OR FALSE` → FALSE → the row is refused.
-- ⚠️ Proven in both directions before and after, on the same engine: the `per_rung` behaviour is
-- unchanged (NULL accepted, a factor refused), which is the half that was already right.
--
-- ── 🔴 WHY THIS WAS NOT CAUGHT BEFORE DAVID PASTED IT, STATED PLAINLY BECAUSE IT IS THE WORSE HALF ─
-- **`20260925h`'s V-blocks were never executed by anything.** Its own header names
-- `scripts/sql-harness/install-kit-411.pglite.mjs` as its harness — **and that file was never
-- written.** The other three migrations of that set each had a harness that ran their V-blocks
-- verbatim; this one had a citation instead. So the file asserted a proof that did not exist
-- ([[R-26]] in my own artefact), and its V3 went to David unexercised.
-- ✅ **THE MISSING HARNESS IS WRITTEN WITH THIS FIX**, and it does the thing that would have caught
-- it: it runs **`20260925h`'s V-blocks VERBATIM**, red-first against the shipped constraint — V3
-- must FAIL there, reproducing David's exact line — then applies this migration and requires the
-- same V3 text to PASS. A harness that cannot fail is not a harness (§6 r19).
--
-- ── NO DATA REPAIR IS NEEDED, AND THAT IS ASSERTED RATHER THAN ASSUMED ──────────────────────
-- `install_kit_components` is **EMPTY on every tenant** — nothing has been seeded yet, by design
-- (the kit seed data file was deliberately held back until this is applied). **V2 below asserts
-- the table is empty AND that no row anywhere breaks the corrected rule**, so if a row had appeared
-- between the writing and the applying, the V-block says so instead of the constraint failing
-- mid-`ALTER`.
--
-- DEPENDENCIES: 20260925h_install_kit_components.sql, APPLIED 2026-09-25.
-- OUTPUTS:      `install_kit_factor_matches_rule` REPLACED on public.install_kit_components.
-- HARNESS:      scripts/sql-harness/install-kit-factor-419.pglite.mjs  ← written, and it exists.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ⚠️ DROP-THEN-ADD, not an edit: §6 r1 — an applied migration is never modified, so the constraint
-- is replaced here. Named exactly as before, so nothing that cites the name has to change.
ALTER TABLE public.install_kit_components
  DROP CONSTRAINT IF EXISTS install_kit_factor_matches_rule;

ALTER TABLE public.install_kit_components
  ADD CONSTRAINT install_kit_factor_matches_rule CHECK (
    (rule =  'per_rung' AND factor IS NULL)
    OR
    -- 🔴 `factor IS NOT NULL` IS THE WHOLE FIX. It is never NULL, so this branch can be FALSE, which
    -- is what a CHECK needs in order to refuse anything at all.
    (rule <> 'per_rung' AND factor IS NOT NULL AND factor > 0)
  );

COMMENT ON COLUMN public.install_kit_components.factor IS
  'The multiplier. NULL only for per_rung, whose count lives on '
  'container_ladder.install_t_posts_per_tree. Enforced by install_kit_factor_matches_rule — which '
  'from 20260925m actually refuses a NULL on the other rules (before it, NULL made the CHECK '
  'evaluate to NULL, and a CHECK passes on NULL).';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — paste each on its own. Each builds its own fixture, RAISEs its verdict and ROLLS
-- BACK, so the message IS the report (§6 r26). Nothing to fill in.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · 🔴 THE EXACT V3 FROM `20260925h`, RE-RUN. This is the block David watched FAIL; every
--   --      one of its four flags must now be TRUE, and `mix_without_factor_refused` is the one
--   --      that was `f`.
--   DO $v1$
--   DECLARE b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
--           rung_ok boolean := false; rung_with_factor boolean := false;
--           mix_ok boolean := false; mix_without_factor boolean := false;
--   BEGIN
--     INSERT INTO auth.users (id) VALUES (u);
--     INSERT INTO public.businesses (id,name,owner_id) VALUES (b,'V1 Co',u);
--     INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--       VALUES (b,'t_post','T-post','200','per_rung',NULL,'each','the rung says how many');
--     rung_ok := true;
--     BEGIN
--       INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--         VALUES (b,'t_post_bad','T-post','200','per_rung',2,'each','a second home for the rung count');
--     EXCEPTION WHEN others THEN rung_with_factor := true;
--     END;
--     INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--       VALUES (b,'special_mix','Special planting mix','52','per_container_gallon',2,'gal','2 gal per container gallon');
--     mix_ok := true;
--     BEGIN
--       INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
--         VALUES (b,'mix_bad','Mix','52','per_container_gallon',NULL,'gal','no factor');
--     EXCEPTION WHEN others THEN mix_without_factor := true;
--     END;
--     IF rung_ok AND rung_with_factor AND mix_ok AND mix_without_factor THEN
--       RAISE EXCEPTION 'V1 PASS — per_rung carries no factor and is refused with one; every other rule REQUIRES one (rung_ok=% rung_with_factor_refused=% mix_ok=% mix_without_factor_refused=%)',
--         rung_ok, rung_with_factor, mix_ok, mix_without_factor;
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — rung_ok=% rung_with_factor_refused=% mix_ok=% mix_without_factor_refused=%',
--         rung_ok, rung_with_factor, mix_ok, mix_without_factor;
--     END IF;
--   END $v1$;
--
--   -- V2 · NO DATA REPAIR WAS NEEDED, AND HERE IS THE PROOF RATHER THAN THE ASSUMPTION:
--   --      the table is EMPTY, and no row anywhere breaks the corrected rule.
--   DO $v2$
--   DECLARE n bigint; bad bigint;
--   BEGIN
--     SELECT count(*) INTO n FROM public.install_kit_components;
--     SELECT count(*) INTO bad FROM public.install_kit_components
--      WHERE (rule = 'per_rung' AND factor IS NOT NULL)
--         OR (rule <> 'per_rung' AND (factor IS NULL OR factor <= 0));
--     IF n = 0 AND bad = 0 THEN
--       RAISE EXCEPTION 'V2 PASS — install_kit_components holds 0 rows on every tenant, and 0 rows break the corrected rule: no data repair was needed';
--     ELSIF bad = 0 THEN
--       RAISE EXCEPTION 'V2 PASS (with rows) — % row(s) exist and ALL of them satisfy the corrected rule, so nothing needed repairing', n;
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — % row(s) BREAK the corrected rule and must be fixed before this constraint can hold', bad;
--     END IF;
--   END $v2$;
--
--   -- V3 · THE CONSTRAINT IS THE NEW ONE — its definition names `IS NOT NULL`, and there is
--   --      exactly ONE constraint of that name (a DROP that silently did nothing would show here).
--   DO $v3$
--   DECLARE n int; def text;
--   BEGIN
--     SELECT count(*), max(pg_get_constraintdef(oid)) INTO n, def
--       FROM pg_constraint
--      WHERE conrelid = 'public.install_kit_components'::regclass
--        AND conname  = 'install_kit_factor_matches_rule';
--     IF n = 1 AND def ILIKE '%factor IS NOT NULL%' THEN
--       RAISE EXCEPTION 'V3 PASS — one constraint by that name, and its definition carries the IS NOT NULL that makes it able to refuse: %', def;
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — count=% def=%', n, COALESCE(def,'(none)');
--     END IF;
--   END $v3$;
