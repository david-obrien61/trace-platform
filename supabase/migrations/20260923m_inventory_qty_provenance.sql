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
--   · Only **2 distinct lots have ever been counted** (3 `inventory_counts` rows).
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

-- ── BACKFILL ① — EVERY LOT THAT HAS EVER BEEN COUNTED ─────────────────────────
-- Done FIRST so ② cannot claim these rows. The date is the real count date, not now().
UPDATE business_inventory bi
   SET qty_basis = 'counted',
       qty_basis_at = c.counted_at,
       qty_basis_because = 'Counted on the walk (inventory_counts ' || c.id::text || ').'
  FROM (SELECT DISTINCT ON (inventory_id) inventory_id, id, counted_at
          FROM inventory_counts ORDER BY inventory_id, counted_at DESC) c
 WHERE bi.id = c.inventory_id
   AND bi.qty_basis = 'placeholder';   -- never demote or re-date an established basis

-- ── BACKFILL ② — EVERYTHING ELSE IS A PLACEHOLDER, AND SAYS WHY ──────────────
-- 🔴 IT SAYS *WHY* RATHER THAN JUST *WHAT*. "placeholder" alone invites the reader
-- to assume somebody estimated it. Nobody did: it is an import default, and the
-- reason names the run so the claim can be checked.
UPDATE business_inventory
   SET qty_basis_because =
       'Never counted and never derived. This number came from the product import, '
       || 'not from an estimate: the purchases-minus-sales derivation has no inputs yet '
       || '(no purchase-side ledger rows, and order lines are not linked to lots). '
       || 'It is deliberately low so that running out is what triggers a count (R-176).'
 WHERE qty_basis = 'placeholder'
   AND qty_basis_because = '';

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

-- V2 — 🔴 NO ROW IS SILENT. Expect: PASS, 0 silent. This is the whole point: a row
-- with no basis would render as a bare number on the till.
SELECT 'V2 every LAWNS lot states a basis and a reason' AS check,
       CASE WHEN count(*) FILTER (WHERE qty_basis_because = '') = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS lots,
       count(*) FILTER (WHERE qty_basis = 'placeholder') AS placeholder,
       count(*) FILTER (WHERE qty_basis = 'counted')     AS counted,
       count(*) FILTER (WHERE qty_basis = 'derived')     AS derived,
       count(*) FILTER (WHERE qty_basis_because = '')    AS silent_should_be_zero
  FROM business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND retired_at IS NULL;

-- V3 — THE COUNTED ROWS CARRY THEIR REAL DATE, NOT TODAY'S. Expect: PASS.
-- 🔴 A backfill that stamped now() would assert that every lot was counted the day
-- the migration ran — a fabricated fact, and the worst kind because it looks precise.
SELECT 'V3 counted lots carry their real count date' AS check,
       CASE WHEN count(*) = 0 OR bool_and(qty_basis_at::date = '2026-08-26')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS counted_lots,
       string_agg(DISTINCT qty_basis_at::date::text, ', ') AS dates
  FROM business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qty_basis = 'counted';

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
