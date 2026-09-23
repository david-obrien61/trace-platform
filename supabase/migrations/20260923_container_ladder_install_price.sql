-- ─────────────────────────────────────────────────────────────────────────────
-- 20260923_container_ladder_install_price.sql      ·  ledger #386  ·  R-171 (b)(c)
--
-- PURPOSE: give every rung on the container ladder an INSTALL PRICE, so Lauren can
--   ring up an install at the counter and the number comes from the tree's size.
--
-- 🔴 WHY THE LADDER AND NOT A NEW TABLE OR A CONFIG KEY — DAVID'S OWN RULING.
--   R-157 as amended 2026-09-16: *"ONE LOCATION, MANY READS, EXTREMELY FLEXIBLE.
--   Every size is read from the ladder; each consumer applies its own math. No
--   second list of sizes, no size thresholds, no size parsed outside the resolver."*
--   The ladder ALREADY carries a per-rung install fact with its provenance —
--   `install_t_posts_per_tree` / `install_t_posts_because` (20260916). This is that
--   shape one more time. A `business_operations_config` key would be a second list
--   of sizes; a new table would buy only a price history nothing else on the ladder
--   has, and would reopen the size-key question R-157 closed.
--
-- 🔴 `install_price` IS NULLABLE AND NULL IS A REAL ANSWER — D-9, and David's
--   ruling (c), 2026-09-23: *"A RUNG WITH NO PRICE: offer install and REQUIRE A
--   TYPED AMOUNT with a reason — never $0, never a guess, never refused."*
--   A DEFAULT of 0 would put a free install on a screen. NULL means "not set", the
--   line says so in those words, and the counter types the number.
-- 🔴 THE FIGURES, AND `3/5 gal` IS THE ONE TO ASK LAUREN ABOUT FIRST — IT IS 88 LOTS.
--   Measured 2026-09-23 by running the REAL resolver over LAWNS's 632 live lots, NOT by
--   joining on volume_gallons — that join is exactly what the resolver exists to prevent and
--   it gave a WRONG answer first time (it misses an alias match and mis-reads a range rung):
--     · 365 lots sit on a PRICED rung
--     ·  95 sit on a rung with NO price — 88 of them `3/5 gal`, 7 `200 gal`
--     · 172 reach NO rung at all — 107 carry no size whatever, 65 are off-ladder (1/2/7/10 gal)
--   So 267 of 632 lots would ask for a typed amount today, and ONE price on `3/5 gal` removes 88.
--   The null path is therefore the ordinary one, not the edge.
--
-- ⚠️ IT SEEDS, AND THE SEED IS *WHAT THEY ACTUALLY BILL*, NOT THE PRICE LIST.
--   David's ruling (b), 2026-09-23: *"SEED FROM WHAT THEY ACTUALLY BILL, with
--   Lauren's sheet shown BESIDE each rung and the gap named, for her to confirm or
--   change."* The figures are the MEDIAN difference between a plant line whose
--   description says "install" and one that does not, at the same container size,
--   zero-priced lines excluded — 1,878 LAWNS order_items lines, measured live
--   2026-09-23. Lauren's sheet is recorded in the `because` beside it, so the gap
--   travels with the number instead of living in a report.
--
--        rung      billed median   Lauren's sheet   gap
--        15 gal        $204            $150         sheet is $54 LOW
--        30 gal        $425            $300         sheet is $125 LOW
--        45 gal        $450            $450         agree exactly
--        65 gal        $650            $600         sheet is $50 LOW
--        95/100        $800            $900         sheet is $100 HIGH
--
--   ⚠️ SEEDED FOR LAWNS ONLY, BY business_id. No other tenant is touched, and no
--   default is invented for one. A new tenant answers the question on its own screen.
--
-- ADDITIVE AND IDEMPOTENT: ADD COLUMN IF NOT EXISTS; the seed is guarded by
--   `install_price IS NULL`, so a second run changes zero rows and CANNOT overwrite
--   a figure Lauren has since corrected. That guard is the point of it.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. THE COLUMNS ────────────────────────────────────────────────────────────
ALTER TABLE container_ladder
  ADD COLUMN IF NOT EXISTS install_price   numeric(10,2),
  ADD COLUMN IF NOT EXISTS install_price_because text NOT NULL DEFAULT '';

COMMENT ON COLUMN container_ladder.install_price IS
  'What it costs to install ONE tree of this size. NULL = not set — the counter types an amount with a reason (R-171 (c)); never 0, which would read as free.';
COMMENT ON COLUMN container_ladder.install_price_because IS
  'Where that figure came from. Required for the same reason handling_because is: an unlabelled price cannot be checked.';

-- ── 2. THE SEED — LAWNS ONLY, AND ONLY WHERE NOTHING IS SET ───────────────────
-- Matched on LABEL, which is the rung's identity on its own ladder. Not on
-- volume_gallons: the 95/100 rung stores 95 and answers to 100 by alias, so a
-- numeric match would be a second size rule living outside the resolver.
UPDATE container_ladder SET
  install_price = v.price,
  install_price_because = v.because
FROM (VALUES
  ('15 gal',  204.00, 'LAWNS billed median, measured 2026-09-23 over 534 order_items lines at this size (389 plant-only, 145 with install), zero-priced lines excluded. Lauren''s 2026-09-23 sheet says $150 — $54 LOW. David ruled 2026-09-23 to seed from what they bill and show her the gap.'),
  ('30 gal',  425.00, 'LAWNS billed median, measured 2026-09-23 over 758 lines (501 plant-only, 257 with install). Lauren''s sheet says $300 — $125 LOW, the largest gap on the ladder.'),
  ('45 gal',  450.00, 'LAWNS billed median, measured 2026-09-23 over 467 lines (241 plant-only, 226 with install). Lauren''s sheet says $450 — the ONE rung where the sheet and the billing agree exactly.'),
  ('65 gal',  650.00, 'LAWNS billed median, measured 2026-09-23 over 105 lines (48 plant-only, 57 with install). Lauren''s sheet says $600 — $50 LOW.'),
  ('95/100',  800.00, 'LAWNS billed median, measured 2026-09-23 over 115 lines (44 plant-only, 71 with install). Lauren''s sheet says $900 — $100 HIGH, the only rung where the sheet charges MORE than the billing.')
) AS v(label, price, because)
WHERE container_ladder.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
  AND container_ladder.label = v.label
  AND container_ladder.install_price IS NULL;   -- never overwrite a corrected figure

-- ── 3. THE RUNGS DELIBERATELY LEFT UNPRICED ───────────────────────────────────
-- slip · 4 in · 3/5 gal · 200 gal. Lauren's sheet prices none of them, and this
-- migration does not invent one. They get a NULL price and a reason that SAYS so,
-- because "nobody has set this" and "nobody has looked" are different facts and the
-- screen is about to show one of them to a person.
UPDATE container_ladder SET
  install_price_because = 'Not priced. Lauren''s 2026-09-23 sheet covers 15/30/45/65/95 only, and no install has been billed at this size often enough to take a median. The counter types an amount with a reason (R-171 (c)).'
WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
  AND install_price IS NULL
  AND install_price_because = '';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Each returns a row saying PASS or FAIL in words.
-- Read-only. Run AFTER the migration.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE COLUMNS EXIST, WITH THE RIGHT NULLABILITY. Expect: PASS.
-- 🔴 `install_price` MUST be nullable and MUST have no default. A default of 0 is
-- the defect this whole design is avoiding, so it is asserted, not assumed.
SELECT 'V1 install_price nullable with NO default; because NOT NULL' AS check,
       CASE WHEN count(*) = 2
             AND bool_and(CASE WHEN column_name = 'install_price'
                               THEN is_nullable = 'YES' AND column_default IS NULL
                               ELSE is_nullable = 'NO' END)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS columns_found,
       string_agg(column_name || ' ' || data_type || ' null=' || is_nullable ||
                  ' default=' || coalesce(column_default, '(none)'), ' · ' ORDER BY column_name) AS shape
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'container_ladder'
   AND column_name IN ('install_price', 'install_price_because');

-- V2 — THE FIVE PRICED RUNGS CARRY THE BILLED MEDIANS. Expect: PASS, 5.
SELECT 'V2 LAWNS five priced rungs = the billed medians' AS check,
       CASE WHEN count(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rungs_priced_correctly,
       string_agg(label || ' $' || install_price::text, ' · ' ORDER BY sort_order) AS ladder
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND (label, install_price) IN
       (VALUES ('15 gal', 204.00), ('30 gal', 425.00), ('45 gal', 450.00),
               ('65 gal', 650.00), ('95/100', 800.00));

-- V3 — 🔴 EVERY RUNG SAYS WHY, PRICED OR NOT. Expect: PASS, 0 silent.
-- This is the D-9 assertion. A NULL price is fine; a NULL price with no reason is
-- a screen that says "not set" and cannot say why.
SELECT 'V3 no rung carries a price or a blank without a reason' AS check,
       CASE WHEN count(*) FILTER (WHERE install_price_because = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rungs_total,
       count(*) FILTER (WHERE install_price IS NOT NULL) AS priced,
       count(*) FILTER (WHERE install_price IS NULL)     AS not_set,
       count(*) FILTER (WHERE install_price_because = '') AS silent_should_be_zero
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V4 — 🔴 THE FOUR UNPRICED RUNGS ARE STILL UNPRICED. The negative control.
-- Expect: PASS, 4 — slip, 4 in, 3/5 gal, 200 gal. If a number appeared on one of
-- these, the seed matched something it should not have.
SELECT 'V4 slip / 4 in / 3/5 gal / 200 gal carry NO price' AS check,
       CASE WHEN count(*) = 4 AND count(*) FILTER (WHERE install_price IS NOT NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS unpriced_rungs,
       count(*) FILTER (WHERE install_price IS NOT NULL) AS wrongly_priced_should_be_zero,
       string_agg(label, ' · ' ORDER BY sort_order) AS rungs
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND label IN ('slip', '4 in', '3/5 gal', '200 gal');

-- V5 — 🔴 NO OTHER TENANT WAS SEEDED. The AC-3 negative control. Expect: PASS, 0.
SELECT 'V5 no other tenant got an install price' AS check,
       CASE WHEN count(*) FILTER (WHERE install_price IS NOT NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS other_tenant_rungs,
       count(*) FILTER (WHERE install_price IS NOT NULL) AS priced_should_be_zero
  FROM container_ladder
 WHERE business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V6 — 🔴 IDEMPOTENCE, AND IT IS THE ONE THAT PROTECTS LAUREN'S EDITS.
-- Re-running the seed must change ZERO rows, because every priced rung now fails
-- the `install_price IS NULL` guard. Expect: PASS, 0.
SELECT 'V6 re-running the seed would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_the_seed_would_still_write
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND install_price IS NULL
   AND label IN ('15 gal', '30 gal', '45 gal', '65 gal', '95/100');

-- V7 — 🔴 THE LADDER'S OTHER FACTS ARE UNTOUCHED. The blast-radius control.
-- Expect: PASS — 9 rungs, the T-post figures and calipers exactly as 20260916 and
-- 20260918c left them. An ALTER that quietly moved another column would show here.
SELECT 'V7 the ladder is otherwise unchanged' AS check,
       CASE WHEN count(*) = 9 AND sum(install_t_posts_per_tree) = (
              SELECT sum(install_t_posts_per_tree) FROM container_ladder
               WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rungs,
       count(*) FILTER (WHERE active) AS active_rungs,
       sum(install_t_posts_per_tree) AS t_posts_total,
       count(*) FILTER (WHERE caliper_min_inches IS NOT NULL) AS rungs_with_caliper
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
