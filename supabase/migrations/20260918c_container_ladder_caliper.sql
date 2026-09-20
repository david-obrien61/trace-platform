-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260918c_container_ladder_caliper — CALIPER LIVES ON THE RUNG
-- Ledger #356 · David, 2026-09-18
--
-- WHAT. Two numbers on every rung — the smallest and largest trunk CALIPER (diameter, in inches) a
-- tree of that container size carries — plus where the figures came from, in words. And the height
-- this nursery measures caliper at, as one Operations figure.
--
-- WHY. David, 2026-09-18: *"the trade measure LAWNS buys and sells on, and the real graduation test."*
-- Evidence it is load-bearing: Terry rejected a load measuring 3.25" against a 4" spec and still paid
-- the freight. A container size says what the pot holds; the caliper says what the TREE is.
--
-- LAWNS, David 2026-09-18:
--   3/5 gal 1.0" · 15 gal 1.25" · 30 gal 1.5–2.5" · 45 gal 2.5–3.5" · 65 gal 3.5–4.5" ·
--   95/100 gal 4–5" · 200 gal 5"+   — measured 12 inches above the soil line.
--
-- 🔴 NULLABLE, NOT DEFAULT 0. A caliper nobody has entered is UNKNOWN, and a 0 would read as a
-- measurement (A9 — absent is not empty). The because-column says which, in the same shape as
-- `install_t_posts_because`. A blank MAX with a min set means "and up" — "200 gal: 5 in and up".
-- 🔴 RANGES MAY OVERLAP BETWEEN RUNGS AND THAT IS NOT REFUSED. LAWNS's own 65 (3.5–4.5) and 95/100
-- (4–5) overlap at 4–4.5: trees are not machined. A size is a pot; the caliper describes the trees
-- that grow in it.
-- 🔴 THE MEASURING HEIGHT IS PER BUSINESS, NOT A CONSTANT, AND THE STANDARD IS A DEFAULT, NEVER A RULE.
-- ANSI Z60.2-2025 §1.2.1, read from the document: caliper is taken six inches above ground for field
-- grown stock and FROM THE SOIL LINE for container grown stock, *"up to and including the four-inch
-- caliper size interval (i.e., from four inches up to, but not including, 4.5 inches). If the caliper
-- measured at six inches is four and one-half inches or more, the caliper shall be measured at 12
-- inches"*. ⚠️ The threshold is 4½ in, not 4. LAWNS measures EVERYTHING at 12, including below 4½ —
-- their choice, recorded in `caliperMeasuredAtBecause` below, not corrected. Both live in
-- `business_operations_config.config`; the code default is 6 and says it is a suggestion.
--
-- 🔴 NO HISTORY MOVES. Nothing stores a caliper copied from a rung.
--
-- ⚠️ NOT APPLIED. Written, not run. David applies it — AND `feat/ladder-caliper` MUST NOT MERGE BEFORE
-- THESE COLUMNS EXIST: the ladder reader selects them, so on a database without them every ladder read
-- fails (the pages say "could not read sizes" rather than guessing — but the load list, the count
-- screen and Settings → Container sizes all lose the ladder). Order: apply this → run V1–V4 → merge.
-- ══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS caliper_min_inches numeric NULL CHECK (caliper_min_inches > 0);

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS caliper_max_inches numeric NULL CHECK (caliper_max_inches > 0);

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS caliper_because text NOT NULL
    DEFAULT 'not set — no caliper recorded for this size';

-- A max below the min is a typo, never a tree. A max with no min is refused too: "up to 4 in" with no
-- floor is not how a grower states a size, and it would print as a range that starts nowhere.
ALTER TABLE public.container_ladder DROP CONSTRAINT IF EXISTS container_ladder_caliper_range_check;
ALTER TABLE public.container_ladder ADD CONSTRAINT container_ladder_caliper_range_check
  CHECK (caliper_max_inches IS NULL OR (caliper_min_inches IS NOT NULL AND caliper_max_inches >= caliper_min_inches));

COMMENT ON COLUMN public.container_ladder.caliper_min_inches IS
  'Smallest trunk caliper (inches) of a tree in this size, measured at the business''s caliperMeasuredAtInches. NULL = not recorded.';
COMMENT ON COLUMN public.container_ladder.caliper_max_inches IS
  'Largest trunk caliper (inches). NULL with a min set = "and up". Equal to the min = one figure.';
COMMENT ON COLUMN public.container_ladder.caliper_because IS
  'Where the caliper figures came from, in words. Shown beside them on Settings → Container sizes.';

-- ─── BACKFILL — LAWNS, DAVID 2026-09-18 ───────────────────────────────────────────────────────
-- Per RUNG, by label, scoped BY NAME so it cannot land on another tenant, and only on rows still
-- carrying the column default — a re-run never overwrites a figure somebody has since edited.
UPDATE public.container_ladder cl
   SET caliper_min_inches = v.min_in,
       caliper_max_inches = v.max_in,
       caliper_because    = 'LAWNS, David 2026-09-18 — measured 12 in above the soil line'
  FROM public.businesses b,
       (VALUES ('3/5 gal', 1.0,  1.0),
               ('15 gal',  1.25, 1.25),
               ('30 gal',  1.5,  2.5),
               ('45 gal',  2.5,  3.5),
               ('65 gal',  3.5,  4.5),
               ('95/100',  4.0,  5.0),
               ('200 gal', 5.0,  NULL)) AS v(label, min_in, max_in)
 WHERE b.id = cl.business_id
   AND b.name = 'LAWNS Tree Farm, LLC'
   AND cl.label = v.label
   AND cl.caliper_because = 'not set — no caliper recorded for this size';

-- ─── THE MEASURING HEIGHT — LAWNS, 12 in ──────────────────────────────────────────────────────
-- LAWNS has no Operations row today (measured 2026-09-18), so this creates one holding ONLY this key;
-- every other figure keeps reading its default, exactly as before. If a row exists by the time this
-- runs, the key is added only when absent — never overwriting a height somebody has since saved.
INSERT INTO public.business_operations_config (business_id, config)
SELECT b.id, jsonb_build_object('caliperMeasuredAtInches', 12,
                                 'caliperMeasuredAtBecause', 'LAWNS, David 2026-09-18 — they measure everything at 12 in, including below 4.5 in where ANSI Z60.2-2025 says 6. Their choice, recorded, not corrected.')
  FROM public.businesses b
 WHERE b.name = 'LAWNS Tree Farm, LLC'
ON CONFLICT (business_id) DO UPDATE
   SET config = public.business_operations_config.config || jsonb_build_object('caliperMeasuredAtInches', 12,
                                 'caliperMeasuredAtBecause', 'LAWNS, David 2026-09-18 — they measure everything at 12 in, including below 4.5 in where ANSI Z60.2-2025 says 6. Their choice, recorded, not corrected.')
 WHERE NOT (public.business_operations_config.config ? 'caliperMeasuredAtInches');

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the three new columns
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='container_ladder' AND column_name LIKE 'caliper%'
--    ORDER BY column_name;
--   -- EXPECT 3 rows: caliper_because text NO 'not set — …' · caliper_max_inches numeric YES · caliper_min_inches numeric YES
--
-- V2 · a max below the min is refused (inside a rolled-back tx)
--   BEGIN;
--   UPDATE public.container_ladder SET caliper_max_inches = 1
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND label = '45 gal';
--   -- EXPECT: new row … violates check constraint "container_ladder_caliper_range_check"
--   ROLLBACK;
--
-- V3 · LAWNS's rungs carry David's calipers, in ladder order
--   SELECT label, caliper_min_inches, caliper_max_inches, caliper_because
--     FROM public.container_ladder
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    ORDER BY sort_order;
--   -- EXPECT: slip — — · 4 in — — · 3/5 gal 1.0 1.0 · 15 gal 1.25 1.25 · 30 gal 1.5 2.5 · 45 gal 2.5 3.5 ·
--   --         65 gal 3.5 4.5 · 95/100 4.0 5.0 · 200 gal 5.0 — ; slip and 4 in still 'not set — …'
--
-- V4 · LAWNS measures at 12 in, and nothing else in its Operations row was invented
--   SELECT config FROM public.business_operations_config WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--   -- EXPECT: {"caliperMeasuredAtInches": 12, "caliperMeasuredAtBecause": "LAWNS, David 2026-09-18 — they measure
--   --           everything at 12 in, including below 4.5 in where ANSI Z60.2-2025 says 6. Their choice, recorded, not corrected."}
