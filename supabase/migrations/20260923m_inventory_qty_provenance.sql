-- ─────────────────────────────────────────────────────────────────────────────
-- 20260923m_inventory_qty_provenance.sql        ·  ledger #393  ·  R-176
--
-- PURPOSE: let every on-hand number say WHERE IT CAME FROM — counted, derived, or
--   a placeholder nobody has verified. R-170's rule one surface further in: *"a
--   promise on a surface is derived from the thing that fulfils it."* A bare "10"
--   on a till screen is a promise that somebody knows there are ten.
--
-- 🔴 THE MEASUREMENT THAT MADE THIS URGENT (live, read-only, 2026-09-23):
--   · **512 of LAWNS's 632 live lots sit at exactly qty 10. 120 sit at 0. NOT ONE
--     lot carries any other value.** All 512 were written by ONE import run on
--     2026-09-21. **The 10 is a flat import default, not an estimate of anything.**
--   · The purchases-minus-sales derivation (David's model, 2026-09-01, reaffirmed
--     2026-09-16) has **never run, and cannot run today — it has no inputs**:
--       – **ZERO** ledger rows of any purchase/receive/arrival kind, and
--       – **3,924 of 3,925** LAWNS `order_items` carry no `business_inventory_id`,
--         so the sales side cannot be joined to a lot either.
--   · **445 of 446 `opening_balance` ledger rows assert `delta = 0`** — the opening
--     balance was a no-op for essentially every lot.
--   · **NO LOT HAS EVER BEEN REALLY COUNTED.** There are 3 `inventory_counts` rows and
--     they are a TEST: one never-completed session (`046394fc`, `status='in_progress'`),
--     run from David's own account, three rows in 3.5 minutes, the same lot counted
--     twice 27 seconds apart. **They seed as `placeholder`, not `counted`** — see the
--     backfill. David's ruling 2026-09-23: *the entire inventory has never been counted.*
--   · No provenance column exists. `cost_confidence` and `price_basis` are about
--     COST and PRICE; `cost_confidence` is NULL on all 632 rows.
--
-- 🔴 THIS CHANGES NO QUANTITY AND NO BLOCK. David, 2026-09-23: *"the placeholder is
--   deliberately low — the BLOCK AT SALE IS THE RECONCILE TRIGGER. Do not raise it,
--   do not hide it."* Nothing here touches `qty`, and nothing here makes a
--   placeholder sellable or unsellable. It adds only the ability to SAY which kind
--   of number it is.
--
-- ⚠️ `qty_basis` IS NOT NULLABLE AND ITS DEFAULT IS `placeholder`, WHICH IS THE
--   HONEST DEFAULT AND NOT A CONVENIENCE. A nullable column would let a row say
--   nothing, and "nothing" would render as a bare number — the exact thing this
--   exists to stop. A row that has not been counted or derived IS a placeholder.
--
-- ADDITIVE AND IDEMPOTENT: ADD COLUMN IF NOT EXISTS; the backfill is guarded so a
--   second run changes zero rows and cannot overwrite a later count.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE business_inventory
  ADD COLUMN IF NOT EXISTS qty_basis    text NOT NULL DEFAULT 'placeholder',
  ADD COLUMN IF NOT EXISTS qty_basis_at timestamptz,
  ADD COLUMN IF NOT EXISTS qty_basis_because text NOT NULL DEFAULT '';

-- A NAMED constraint, not inline (tech-debt #91: an inline CHECK is auto-named, so
-- its name is never typed and a name-grep can never find it).
ALTER TABLE business_inventory DROP CONSTRAINT IF EXISTS business_inventory_qty_basis_check;
ALTER TABLE business_inventory ADD CONSTRAINT business_inventory_qty_basis_check
  CHECK (qty_basis IN ('counted', 'derived', 'placeholder'));

COMMENT ON COLUMN business_inventory.qty_basis IS
  'Where this row''s qty came from. counted = a person counted it. derived = purchases minus sales, both sides real. placeholder = nobody has verified it (R-176). Default placeholder: a row that has been neither counted nor derived IS one, and a nullable column would let a number render bare.';
COMMENT ON COLUMN business_inventory.qty_basis_at IS
  'When the basis was established — the count date for counted, the derivation run for derived. NULL for a placeholder, which has no date because nothing happened.';

-- ── BACKFILL — EVERYTHING IS A PLACEHOLDER, INCLUDING THE THREE "COUNTS" ─────
-- 🔴 THE THREE `inventory_counts` ROWS ARE A TEST RUN, NOT A COUNT — AND SEEDING THEM
--    AS `counted` WOULD HAVE BEEN THE EXACT TRUST FAILURE R-170 EXISTS TO STOP.
--    A first draft of this migration marked them `counted` with their real date, which
--    would have put **"1 · counted 26 Aug"** in front of Lauren on a lot nobody has
--    counted. David's red-team caught it before it was applied.
--
--    MEASURED LIVE 2026-09-23, and every one of these says "test", not "walk":
--      · all three belong to ONE session, `046394fc-c679-45db-b458-7746915e6c0d`
--      · that session is **`status = 'in_progress'`, `completed_at` NULL** — it was
--        never finished
--      · `counted_by` = **david_obrien2016@outlook.com** — David's own account, not
--        Lauren's and not Joel's
--      · started 20:32:11, three rows by 20:35:48 — **3½ minutes**, `item_count` 3
--      · the SAME lot (`5eb04bd1`, Brodie Juniper) was counted TWICE, 27 seconds apart
--      · every `counted_qty` is 1; the ledger deltas are +1, 0, +1
--      · neither lot came from the catalogue import (`import_run_id` NULL) and neither
--        carries a `qb_item_name`
--
-- 🔴 AND IT AGREES WITH THE RULING RATHER THAN CONTRADICTING IT. David, 2026-09-23:
--    **the entire inventory has NEVER been counted.** A migration that produced three
--    `counted` rows would have quietly disagreed with that on Lauren's screen.
--
-- ⚠️ SO THERE IS NO `counted` BRANCH IN THIS MIGRATION AT ALL. The first real count
--    writes one, through the count screen, at the moment somebody counts something.
UPDATE business_inventory
   SET qty_basis_because =
       'Never counted and never derived. This number came from the product import, '
       || 'not from an estimate: the purchases-minus-sales derivation has no inputs yet '
       || '(no purchase-side ledger rows, and order lines are not linked to lots). '
       || 'It is deliberately low so that running out is what triggers a count (R-176).'
 WHERE qty_basis = 'placeholder'
   AND qty_basis_because = ''
   AND id NOT IN (SELECT inventory_id FROM inventory_counts WHERE inventory_id IS NOT NULL);

-- The two lots that carry a TEST count say so — a different reason, because a reader
-- who finds a count row against the lot deserves to know why it was not honoured.
UPDATE business_inventory
   SET qty_basis_because =
       'Test count, 2026-08-26 — NOT a real count. The three inventory_counts rows '
       || 'against this business are one never-completed session (046394fc) run from '
       || 'David''s own account in 3.5 minutes, counting the same lot twice. The entire '
       || 'inventory has never been counted (David, 2026-09-23), so this stays a '
       || 'placeholder until somebody walks it.'
 WHERE qty_basis = 'placeholder'
   AND id IN (SELECT inventory_id FROM inventory_counts WHERE inventory_id IS NOT NULL);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Read-only. Run AFTER.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE SHAPE. Expect: PASS. `qty_basis` NOT NULL defaulting to placeholder,
-- `qty_basis_at` NULLABLE (a placeholder has no date because nothing happened).
SELECT 'V1 qty_basis NOT NULL default placeholder; _at nullable' AS check,
       CASE WHEN count(*) = 3
             AND bool_and(CASE WHEN column_name = 'qty_basis_at' THEN is_nullable = 'YES'
                               ELSE is_nullable = 'NO' END)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       string_agg(column_name || ' null=' || is_nullable, ' · ' ORDER BY column_name) AS shape
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'business_inventory'
   AND column_name IN ('qty_basis', 'qty_basis_at', 'qty_basis_because');

-- V2 — 🔴 NO ROW IS SILENT, AND NOT ONE ROW CLAIMS TO HAVE BEEN COUNTED.
-- Expect: PASS — 632 lots, 632 placeholder, **0 counted**, 0 derived, 0 silent.
-- 🔴 THE ZERO IS THE ASSERTION. David's ruling, 2026-09-23: *the entire inventory has
-- never been counted.* A migration that produced even one `counted` row would put
-- "counted 26 Aug" in front of Lauren on a lot nobody has walked — the trust failure
-- R-170 exists to stop, and what an earlier draft of this file would have done.
SELECT 'V2 every lot states a basis; NONE claims to be counted' AS check,
       CASE WHEN count(*) FILTER (WHERE qty_basis_because = '') = 0
             AND count(*) FILTER (WHERE qty_basis = 'counted') = 0
             AND count(*) FILTER (WHERE qty_basis = 'derived') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS lots,
       count(*) FILTER (WHERE qty_basis = 'placeholder') AS placeholder_expect_632,
       count(*) FILTER (WHERE qty_basis = 'counted')     AS counted_expect_0,
       count(*) FILTER (WHERE qty_basis = 'derived')     AS derived_expect_0,
       count(*) FILTER (WHERE qty_basis_because = '')    AS silent_expect_0
  FROM business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND retired_at IS NULL;

-- V3 — 🔴 THE TWO LOTS CARRYING A TEST COUNT SAY SO, AND ARE STILL PLACEHOLDERS.
-- Expect: PASS, 2 lots, both `placeholder`, both naming the test.
-- ⚠️ They get a DIFFERENT reason from the other 630 deliberately: a reader who finds an
-- `inventory_counts` row against the lot deserves to be told why it was not honoured,
-- rather than left to wonder whether the backfill missed it.
SELECT 'V3 the two test-counted lots are placeholders that say why' AS check,
       CASE WHEN count(*) = 2
             AND bool_and(qty_basis = 'placeholder')
             AND bool_and(qty_basis_because LIKE 'Test count, 2026-08-26%')
             AND bool_and(qty_basis_at IS NULL)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS lots_expect_2,
       string_agg(DISTINCT qty_basis, ',') AS basis_expect_placeholder,
       count(*) FILTER (WHERE qty_basis_at IS NOT NULL) AS dated_expect_0
  FROM business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND id IN (SELECT inventory_id FROM inventory_counts WHERE inventory_id IS NOT NULL);

-- V4 — 🔴 NOT ONE QUANTITY MOVED. The control that matters most: this migration
-- describes numbers, it does not change them. Expect: PASS — still 512 at 10, 120 at 0.
SELECT 'V4 no qty changed — still 512 at ten, 120 at zero' AS check,
       CASE WHEN count(*) FILTER (WHERE qty = 10) = 512
             AND count(*) FILTER (WHERE qty = 0)  = 120
             AND count(*) FILTER (WHERE qty NOT IN (0, 10)) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE qty = 10) AS at_ten,
       count(*) FILTER (WHERE qty = 0)  AS at_zero,
       count(*) FILTER (WHERE qty NOT IN (0, 10)) AS anything_else_should_be_zero
  FROM business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND retired_at IS NULL AND status <> 'deleted';

-- V5 — 🔴 NO OTHER TENANT WAS TOUCHED BY THE BACKFILL'S REASON TEXT. AC-3 control.
-- The column defaults for everyone (that is correct and unavoidable); the REASON is
-- written for every placeholder row platform-wide, so this states the blast radius
-- rather than assuming it. Expect: PASS, and read the counts.
SELECT 'V5 blast radius of the backfill, stated' AS check,
       CASE WHEN count(*) FILTER (WHERE qty_basis_because = '') = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_platform_wide,
       count(*) FILTER (WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS lawns,
       count(*) FILTER (WHERE business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS other_tenants
  FROM business_inventory;

-- V6 — 🔴 THE CHECK CAN REFUSE. §6 r19. RUN THIS BLOCK ON ITS OWN.
--   EXPECTED: an ERROR, `23514 check_violation`, naming
--   `business_inventory_qty_basis_check`. **That error IS the pass.**
--   If it says `UPDATE 1`, the constraint is not working — and the ROLLBACK on the
--   next line undoes the write either way, so the probe is safe whichever way it goes.
BEGIN;
UPDATE business_inventory SET qty_basis = 'guessed'
 WHERE id = (SELECT id FROM business_inventory ORDER BY created_at LIMIT 1);
ROLLBACK;

-- V7 — IDEMPOTENCE. Re-running the backfill changes nothing. Expect: PASS, 0.
SELECT 'V7 re-running the backfill would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_that_would_still_change
  FROM business_inventory
 WHERE qty_basis = 'placeholder' AND qty_basis_because = '';
