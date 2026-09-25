-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-26 — LAWNS: THE MIX IS ONE PILE HELD IN GALLONS, AND D3's FOUR STRANDED COUNTS GO TO 0
-- David's rulings D1 and D3, 2026-09-26 · ledger #409 / #414 · YARD-PRODUCTION
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 DATA FILE, NOT A MIGRATION. Paste it in the SQL EDITOR (never the table editor, §6 r17).
-- ⚠️ IT REQUIRES `20260925g_item_sale_units.sql` TO BE APPLIED FIRST. If it is not, the first
--    INSERT fails on a missing table and NOTHING here runs — the whole file is one transaction.
--
-- ── WHAT DAVID RULED (D1, 2026-09-26) ───────────────────────────────────────────────────────
--   base = qb 52 ("1 Yard Scoop: Fertile Compost Mix – Proprietary Blend"), HELD IN GALLONS
--   qb 51 / 40 / 41 / 42 are SALE UNITS of it — 100.99 / 15 / 30 / 45 gal; 52 itself = 201.97
--   opening figure 0, left as a PLACEHOLDER; the planner refuses until the pile is counted once
--   the Regular (bought) family stays SEPARATE — nothing here touches qb 54/53/48/49/50
--   minimum on hand 5 yd = 1,010 gal, on qb 52's `reorder_point`
-- ── AND D3 ──────────────────────────────────────────────────────────────────────────────────
--   the four stranded Fertile counts go to 0 with a dated note, once.
--
-- 🔴 THE EXACT GALLON FIGURES, AND WHY THEY ARE NOT ROUNDED THE WAY THE RULING WRITES THEM.
-- One cubic yard is 46656/231 = 201.974025974… true gallons (`GALLONS_PER_CUBIC_YARD`, and the
-- platform holds it as that fraction, never as 201.974). David's "201.97" and "100.99" are that
-- number written short. **This file stores the precise values** — 201.974026 and 100.987013 — so the
-- arithmetic agrees with `trueGallonsPerCubicYard` everywhere else. Storing 201.97 would put a
-- second, slightly different conversion in the database, which is the STD-011 drift this package
-- has been removing all week.
--
-- ⚠️ 5 yd = 1,009.870130 gal, which `reorder_point` (an INTEGER) holds as **1010**. That is David's
-- "1,010 gal" exactly, and the 0.13 gal is a cup of mix.
--
-- ⚠️ EVERY ROW IS KEYED ON `qb_item_id`, NEVER ON A ROW ID (STD-019) — LAWNS's products are
-- recreated by the QuickBooks reload, so a link on `business_inventory.id` dies on the wipe. And
-- `sku` is NOT used: measured live, it is NULL on all ten mix rows.
--
-- ⚠️ IDEMPOTENT. Run it twice and the second run changes nothing: the conversions are ON CONFLICT
-- updates, and the D3 zeroing only touches rows that are not already 0.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── D1 · THE FIVE SALE UNITS OF THE ONE PILE ─────────────────────────────────────────────────
-- qb 52 appears as a sale unit OF ITSELF at 201.974026 gal. That is the ordinary item-master case
-- (a base item sold in its own stocking unit) and the one-level trigger accepts it by design.
INSERT INTO public.item_sale_units
  (business_id, sale_qb_item_id, base_qb_item_id, base_quantity, base_unit, because)
SELECT b.id, v.sale, '52', v.qty, 'gal', v.why
  FROM (SELECT id FROM public.businesses WHERE name LIKE 'LAWNS%') b,
       (VALUES
         ('52', 201.974026::numeric, '1 Yard Scoop — the base item sold as itself (David D1, 2026-09-26)'),
         ('51', 100.987013::numeric, '1/2 Yard Scoop — half a cubic yard'),
         ('40',  15::numeric,        '15gal Bucket'),
         ('41',  30::numeric,        '30gal Bucket'),
         ('42',  45::numeric,        '45gal Bucket')
       ) AS v(sale, qty, why)
ON CONFLICT (business_id, sale_qb_item_id) DO UPDATE
  SET base_qb_item_id = EXCLUDED.base_qb_item_id,
      base_quantity   = EXCLUDED.base_quantity,
      base_unit       = EXCLUDED.base_unit,
      because         = EXCLUDED.because,
      updated_at      = now();

-- ── D1 · THE MINIMUM ON HAND, ON THE BASE ROW ────────────────────────────────────────────────
-- 5 yd = 1,009.87 gal → 1010 on an integer column.
UPDATE public.business_inventory
   SET reorder_point = 1010, updated_at = now()
 WHERE qb_item_id = '52'
   AND retired_at IS NULL
   AND business_id IN (SELECT id FROM public.businesses WHERE name LIKE 'LAWNS%')
   AND COALESCE(reorder_point, -1) <> 1010;

-- ── D3 · THE FOUR STRANDED FERTILE COUNTS GO TO 0, WITH A DATED NOTE ─────────────────────────
-- 🔴 THE BASE ROW (qb 52) IS NOT IN THIS LIST. Its opening figure is David's separate ruling —
-- 0 as a PLACEHOLDER — and it is set below with its own note, so the two reasons stay apart.
UPDATE public.business_inventory
   SET qty = 0,
       qty_basis = 'placeholder',
       qty_basis_at = now(),
       qty_basis_because =
         'set to 0 on 2026-09-26 (David D3): a catalogue-import seed, never a count. This portion is '
         || 'a SALE UNIT of qb 52, which holds the pile in gallons — a quantity here would be a second '
         || 'figure for one pile.',
       updated_at = now()
 WHERE qb_item_id IN ('51','40','41','42')
   AND retired_at IS NULL
   AND business_id IN (SELECT id FROM public.businesses WHERE name LIKE 'LAWNS%')
   AND qty <> 0;

-- ── D1 · THE BASE ROW'S OPENING FIGURE: 0, AND HONESTLY A PLACEHOLDER ────────────────────────
UPDATE public.business_inventory
   SET qty = 0,
       qty_basis = 'placeholder',
       qty_basis_at = now(),
       qty_basis_because =
         'opening figure 0 gal on 2026-09-26 (David D1). This row now HOLDS THE PILE, in GALLONS. '
         || 'It is a placeholder, not a count: nobody has counted the mix. The shortfall planner '
         || 'REFUSES to plan until somebody does — count it once and it plans itself.',
       updated_at = now()
 WHERE qb_item_id = '52'
   AND retired_at IS NULL
   AND business_id IN (SELECT id FROM public.businesses WHERE name LIKE 'LAWNS%')
   AND (qty <> 0 OR qty_basis IS DISTINCT FROM 'placeholder');

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — paste each on its own. Each RAISEs its verdict and rolls back, so the message IS the
-- report. They look up LAWNS themselves; there is nothing to fill in (§6 r26).
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
--   -- V1 · THE FIVE CONVERSIONS EXIST, ALL POINT AT qb 52, AND THE GALLONS ARE THE EXACT ONES.
--   DO $v1$
--   DECLARE b uuid; n int; yard numeric; half numeric; b45 numeric; wrong int;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     SELECT count(*) INTO n FROM public.item_sale_units WHERE business_id=b;
--     SELECT base_quantity INTO yard FROM public.item_sale_units WHERE business_id=b AND sale_qb_item_id='52';
--     SELECT base_quantity INTO half FROM public.item_sale_units WHERE business_id=b AND sale_qb_item_id='51';
--     SELECT base_quantity INTO b45  FROM public.item_sale_units WHERE business_id=b AND sale_qb_item_id='42';
--     SELECT count(*) INTO wrong FROM public.item_sale_units WHERE business_id=b AND base_qb_item_id<>'52';
--     IF n=5 AND wrong=0 AND round(yard,4)=201.9740 AND round(half,4)=100.9870 AND b45=45 THEN
--       RAISE EXCEPTION 'V1 PASS — 5 sale units, all on qb 52; 1 yd=% gal, 1/2 yd=% gal, 45gal bucket=% gal', round(yard,4), round(half,4), b45;
--     ELSE
--       RAISE EXCEPTION 'V1 FAIL — rows=% not_on_52=% yard=% half=% b45=%', n, wrong, yard, half, b45;
--     END IF;
--   END $v1$;
--
--   -- V2 · THE MINIMUM AND THE OPENING FIGURE ON THE BASE ROW.
--   DO $v2$
--   DECLARE b uuid; rp int; q int; basis text; because text;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     SELECT reorder_point, qty, qty_basis, qty_basis_because INTO rp, q, basis, because
--       FROM public.business_inventory WHERE business_id=b AND qb_item_id='52' AND retired_at IS NULL;
--     IF rp=1010 AND q=0 AND basis='placeholder' AND because LIKE '%HOLDS THE PILE%' THEN
--       RAISE EXCEPTION 'V2 PASS — qb 52: minimum % gal (5 yd), opening % gal, basis %, and the note says it holds the pile', rp, q, basis;
--     ELSE
--       RAISE EXCEPTION 'V2 FAIL — reorder_point=% qty=% basis=% because=%', rp, q, basis, left(because,60);
--     END IF;
--   END $v2$;
--
--   -- V3 · THE FOUR STRANDED COUNTS ARE 0 AND SAY WHY — AND THE REGULAR FAMILY IS UNTOUCHED.
--   DO $v3$
--   DECLARE b uuid; stranded int; noted int; regular_nonzero int;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     SELECT count(*) INTO stranded FROM public.business_inventory
--      WHERE business_id=b AND qb_item_id IN ('51','40','41','42') AND retired_at IS NULL AND qty=0;
--     SELECT count(*) INTO noted FROM public.business_inventory
--      WHERE business_id=b AND qb_item_id IN ('51','40','41','42') AND retired_at IS NULL
--        AND qty_basis_because LIKE '%SALE UNIT of qb 52%';
--     SELECT count(*) INTO regular_nonzero FROM public.business_inventory
--      WHERE business_id=b AND qb_item_id IN ('54','53','48','49','50') AND retired_at IS NULL AND qty <> 0;
--     IF stranded=4 AND noted=4 AND regular_nonzero=5 THEN
--       RAISE EXCEPTION 'V3 PASS — all 4 stranded Fertile portions are 0 and carry the dated note; and the REGULAR family is untouched (% rows still hold their own counts)', regular_nonzero;
--     ELSE
--       RAISE EXCEPTION 'V3 FAIL — zeroed=% noted=% regular_still_nonzero=% (expected 4/4/5)', stranded, noted, regular_nonzero;
--     END IF;
--   END $v3$;
--
--   -- V4 · IDEMPOTENCE: nothing is left for a second run to change.
--   DO $v4$
--   DECLARE b uuid; pending int;
--   BEGIN
--     SELECT id INTO b FROM public.businesses WHERE name LIKE 'LAWNS%' LIMIT 1;
--     SELECT count(*) INTO pending FROM public.business_inventory
--      WHERE business_id=b AND retired_at IS NULL
--        AND ((qb_item_id IN ('51','40','41','42') AND qty <> 0)
--          OR (qb_item_id='52' AND (COALESCE(reorder_point,-1) <> 1010 OR qty <> 0)));
--     IF pending=0 THEN
--       RAISE EXCEPTION 'V4 PASS — a second run would change nothing (0 rows still pending)';
--     ELSE
--       RAISE EXCEPTION 'V4 FAIL — % row(s) would still be changed by a re-run', pending;
--     END IF;
--   END $v4$;
