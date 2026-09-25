-- 🛑 DO NOT RUN YET — HELD 2026-09-25 (ledger #419, David's instruction).
-- `20260925h`'s factor CHECK cannot refuse a component with a MISSING factor: a NULL factor makes
-- the CHECK evaluate to NULL, and a CHECK is SATISFIED by NULL — only FALSE rejects.
-- 🔴 APPLY `20260925m_install_kit_factor_check_rejects_null.sql` FIRST, and check its V1 prints
--    `mix_without_factor_refused=t`.
-- Until then this seed would land against a constraint that cannot protect it, and a component
-- whose factor went missing later would be accepted in silence.
-- ⚠️ The seed itself is correct and was executed end to end (25 probes) — it is the ORDER that is
--    being held, not the file.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-26 — LAWNS's INSTALL KIT, SEEDED FROM DAVID'S RULINGS · ledger #411 · YARD-PRODUCTION
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 DATA FILE, NOT A MIGRATION. SQL EDITOR, never the table editor (§6 r17).
-- ⚠️ REQUIRES `20260925h_install_kit_components.sql` APPLIED FIRST. If it is not, the first INSERT
--    fails on a missing table and NOTHING here runs — the file is one transaction.
--
-- ── WHAT IT SEEDS (David, 2026-09-12 / 09-18 / 09-25 / 09-26) ───────────────────────────────
--   special mix         2 gal per CONTAINER GALLON      → qb 52, the pile (D1)
--   T-post              the RUNG says how many          → 2 up to 65 gal, 4 at 95+   [UNLINKED]
--   rope                4 ft per T-POST, and it stays                                [UNLINKED]
--   water monitor kit   1 per INSTALLED TREE, prebuilt                               [UNLINKED]
--   bubbler             only where the ORDER has a bubbler line                      [UNLINKED]
--   deer fence          only where the stop is MARKED                                [UNLINKED]
--   trunk protection    only where the stop is MARKED                                [UNLINKED]
--
-- ── 🔴 SIX OF THE SEVEN SHIP UNLINKED, ON PURPOSE, AND THAT IS THE POINT OF THE FILE ─────────
-- Only the mix has a product David has named (qb 52). **For the other six, nobody has said which
-- catalogue item they come out of, so `qb_item_id` is left NULL and they are LISTED for David or
-- Lauren to pick — never guessed.** A wrong link would issue the wrong product off the shelf on
-- every install, silently, and a guess here is indistinguishable from a decision.
--
-- ✅ **AN UNLINKED COMPONENT IS NOT A BROKEN ONE.** `evaluateKit` still computes its QUANTITY — you
-- know you need 14 T-posts — and reports it in `unlinked` with `issuable = false`, so a screen says
-- *"14 T-posts: not linked to a product, so nothing can come off stock"* rather than silently
-- issuing nothing. **Until they are linked, the crew's Done tap issues nothing and says why**
-- (David, 2026-09-26, D4).
--
-- ⚠️ `per_rung` CARRIES NO `factor` — the count lives on `container_ladder.install_t_posts_per_tree`
-- (nine rows a grower edits), and a factor here would be a second home for it (STD-011). The
-- table's CHECK enforces that both ways.
--
-- ⚠️ EVERY LINK IS BY `qb_item_id` (STD-019) — LAWNS's catalogue is recreated by the QuickBooks
-- reload, so a link on `business_inventory.id` dies on the wipe. `sku` is not used: it is NULL on
-- these rows, measured live.
--
-- ⚠️ IDEMPOTENT — ON CONFLICT on (business_id, component_key). Re-running changes nothing.
-- 🔴 RE-RUNNING DOES **NOT** UNDO A LINK DAVID HAS MADE: the update below deliberately does NOT
-- touch `qb_item_id` for the six unlinked rows, so once somebody picks a product, a later re-run
-- leaves it alone. Only the rule, the factor, the unit and the label are refreshed.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO public.install_kit_components
  (business_id, component_key, label, qb_item_id, rule, factor, unit, because, active)
SELECT b.id, v.k, v.label, v.qb, v.rule, v.factor, v.unit, v.why, true
  FROM (SELECT id FROM public.businesses WHERE name LIKE 'LAWNS%') b,
       (VALUES
         ('special_mix', 'Special planting mix', '52'::text, 'per_container_gallon', 2::numeric, 'gal',
          'David 2026-09-12: 2 gallons of mix per container gallon. Comes out of qb 52, the pile held in gallons (D1, 2026-09-26).'),
         ('t_post', 'T-post', NULL::text, 'per_rung', NULL::numeric, 'each',
          'David 2026-09-12: 2 up to and including 65 gal, 4 at 95 and above. The count is the RUNG''s (container_ladder.install_t_posts_per_tree) — never a factor here. PRODUCT NOT YET NAMED.'),
         ('rope', 'Rope', NULL::text, 'per_t_post', 4::numeric, 'ft',
          'David 2026-09-12: about 4 ft per T-post, and it STAYS with the tree. PRODUCT NOT YET NAMED.'),
         ('water_monitor', 'Water monitor kit', NULL::text, 'only_if_ordered', 1::numeric, 'each',
          'David 2026-09-18: one per INSTALLED tree, prebuilt and on the shelf — a COUNT only, never the PVC or the bamboo. PRODUCT NOT YET NAMED.'),
         ('bubbler', 'Tree bubbler', NULL::text, 'only_if_ordered', 1::numeric, 'each',
          'David 2026-09-18: the BILLED line is the count — a bubbler is manufactured and added with a cost, so it is not on every tree. PRODUCT NOT YET NAMED.'),
         ('deer_fence', 'Deer fence', NULL::text, 'only_if_marked', 1::numeric, 'ft',
          'Only where the stop says it is fenced; measured as the ring''s circumference, because fence is bought by the roll ([[R-156]]). PRODUCT NOT YET NAMED.'),
         ('trunk_protection', 'Trunk protection', NULL::text, 'only_if_marked', 1::numeric, 'each',
          'Only where the stop is marked. PRODUCT NOT YET NAMED.')
       ) AS v(k, label, qb, rule, factor, unit, why)
ON CONFLICT (business_id, component_key) DO UPDATE
  SET label   = EXCLUDED.label,
      rule    = EXCLUDED.rule,
      factor  = EXCLUDED.factor,
      unit    = EXCLUDED.unit,
      because = EXCLUDED.because,
      -- 🔴 `qb_item_id` IS ABSENT FROM THIS LIST ON PURPOSE. Once David or Lauren picks a product
      -- for a component, a re-run of this file must not wipe it back to NULL.
      updated_at = now();

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — each RAISEs its verdict and rolls back; the message IS the report (§6 r26).
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · SEVEN COMPONENTS, THE MIX LINKED, THE OTHER SIX HONESTLY UNLINKED.
--   DO $v1$
--   DECLARE b uuid; n int; linked int; mix text; unlinked_list text;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     SELECT count(*) INTO n FROM public.install_kit_components WHERE business_id=b AND active;
--     SELECT count(*) INTO linked FROM public.install_kit_components WHERE business_id=b AND qb_item_id IS NOT NULL;
--     SELECT qb_item_id INTO mix FROM public.install_kit_components WHERE business_id=b AND component_key='special_mix';
--     SELECT string_agg(label, ', ' ORDER BY label) INTO unlinked_list
--       FROM public.install_kit_components WHERE business_id=b AND qb_item_id IS NULL;
--     IF n=7 AND linked=1 AND mix='52' THEN
--       RAISE EXCEPTION 'V1 PASS — 7 components; only the mix is linked (qb %); STILL TO PICK A PRODUCT FOR: %', mix, unlinked_list;
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — components=% linked=% mix=% (expected 7/1/52)', n, linked, mix;
--     END IF;
--   END $v1$;
--
--   -- V2 · THE RULES AND FACTORS ARE THE RULINGS, AND per_rung CARRIES NO FACTOR.
--   DO $v2$
--   DECLARE b uuid; mixf numeric; ropef numeric; rungf numeric; rungr text; bad int;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     SELECT factor INTO mixf  FROM public.install_kit_components WHERE business_id=b AND component_key='special_mix';
--     SELECT factor INTO ropef FROM public.install_kit_components WHERE business_id=b AND component_key='rope';
--     SELECT factor, rule INTO rungf, rungr FROM public.install_kit_components WHERE business_id=b AND component_key='t_post';
--     SELECT count(*) INTO bad FROM public.install_kit_components
--      WHERE business_id=b AND ((rule='per_rung' AND factor IS NOT NULL) OR (rule<>'per_rung' AND COALESCE(factor,0)<=0));
--     IF mixf=2 AND ropef=4 AND rungf IS NULL AND rungr='per_rung' AND bad=0 THEN
--       RAISE EXCEPTION 'V2 PASS — mix 2 gal per container gallon, rope 4 ft per T-post, T-post is per_rung with NO factor (the rung owns the count), and no row breaks the factor rule';
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — mix=% rope=% rung_factor=% rung_rule=% bad_rows=%', mixf, ropef, rungf, rungr, bad;
--     END IF;
--   END $v2$;
--
--   -- V3 · A RE-RUN DOES NOT WIPE A LINK SOMEBODY HAS MADE. (Plants one, re-runs the INSERT, checks
--   --      it survived, then rolls back — so it leaves nothing behind either way.)
--   DO $v3$
--   DECLARE b uuid; after text;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     UPDATE public.install_kit_components SET qb_item_id='999' WHERE business_id=b AND component_key='rope';
--     INSERT INTO public.install_kit_components
--       (business_id, component_key, label, qb_item_id, rule, factor, unit, because, active)
--     VALUES (b,'rope','Rope',NULL,'per_t_post',4,'ft','a re-run of the seed',true)
--     ON CONFLICT (business_id, component_key) DO UPDATE
--       SET label=EXCLUDED.label, rule=EXCLUDED.rule, factor=EXCLUDED.factor,
--           unit=EXCLUDED.unit, because=EXCLUDED.because, updated_at=now();
--     SELECT qb_item_id INTO after FROM public.install_kit_components WHERE business_id=b AND component_key='rope';
--     IF after='999' THEN
--       RAISE EXCEPTION 'V3 PASS — a product somebody picked (qb %) SURVIVES a re-run of this seed; only the rule and the wording refresh', after;
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — the re-run wiped the link back to % — qb_item_id must not be in the DO UPDATE list', COALESCE(after,'NULL');
--     END IF;
--   END $v3$;
