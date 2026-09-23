-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-23-r173-three-five-not-installed.sql   ·  ledger #386  ·  R-173
--
-- 🔴 DATA, NOT A MIGRATION, AND NOT AN EDIT TO ONE. `20260923e` is APPLIED, and an
--    applied migration is never edited (§6 r1). This corrects ONE ROW'S REASON.
--
-- WHY. David, 2026-09-23, after asking Lauren: *"they sell 3/5 rarely and do not
--    install at that size. 'Not set' is the correct value; do not price it."*
--    `20260923e` seeded the reason as *"Not priced. Lauren's sheet covers
--    15/30/45/65/95 only, and no install has been billed at this size often enough
--    to take a median."* Every word of that is true — and it reads as A GAP
--    AWAITING A NUMBER, which is exactly what it is not.
--
-- 🔴 THE PRICE ITSELF DOES NOT CHANGE. It stays NULL. What changes is what the
--    NULL MEANS, and that is the whole ruling: a null on the ladder says either
--    *nobody has set this yet* or *we do not do this at this size*, and only the
--    owner can tell those apart. `install_price_because` is where the answer
--    lives, which is why the column is NOT NULL.
--
-- ⚠️ 3/5 ONLY. `slip`, `4 in` and `200 gal` KEEP their original wording. David
--    asked Lauren about 3/5; answering for the other three would be the invention
--    this ruling exists to correct.
--
-- ⚠️ NOTHING BREAKS FOR A 3/5 INSTALL THAT DOES HAPPEN. R-171 (c) makes an
--    unpriced rung OFFER install and ask for a typed amount with a reason, so the
--    rare one is still sellable — the counter names the price. That is the
--    *"never refused"* half of (c) doing its job.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE container_ladder
   SET install_price_because =
       'Not installed at this size. LAWNS sell 3/5 gal rarely and do not install it '
       || '(Lauren, via David, 2026-09-23 — R-173). "Not set" is the correct value here, '
       || 'not a gap: leave it blank. A rare 3/5 install is still sellable — the counter '
       || 'types an amount with a reason (R-171 (c)).',
       updated_at = now()
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND label       = '3/5 gal'
   AND install_price IS NULL;   -- refuses to relabel a rung somebody has since priced

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Read-only. Run AFTER.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE 3/5 RUNG SAYS WHY, AND STILL HAS NO PRICE. Expect: PASS.
SELECT 'V1 3/5 gal is unpriced BY DECISION and says so' AS check,
       CASE WHEN count(*) = 1
             AND bool_and(install_price IS NULL)
             AND bool_and(install_price_because LIKE 'Not installed at this size%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       min(install_price::text) AS price_should_be_null,
       left(min(install_price_because), 60) AS because_starts
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND label = '3/5 gal';

-- V2 — 🔴 THE OTHER THREE UNPRICED RUNGS ARE UNTOUCHED. The negative control:
-- this ruling covers ONE size. Expect: PASS, 3 still on the original wording.
SELECT 'V2 slip / 4 in / 200 gal keep their original reason' AS check,
       CASE WHEN count(*) = 3 AND bool_and(install_price_because LIKE 'Not priced.%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rungs,
       string_agg(label, ' · ' ORDER BY sort_order) AS untouched
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND label IN ('slip', '4 in', '200 gal');

-- V3 — 🔴 THE FIVE PRICED RUNGS ARE UNTOUCHED. Expect: PASS, 5.
SELECT 'V3 the five priced rungs still carry the billed medians' AS check,
       CASE WHEN count(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       string_agg(label || ' $' || install_price::text, ' · ' ORDER BY sort_order) AS ladder
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND (label, install_price) IN
       (VALUES ('15 gal', 204.00), ('30 gal', 425.00), ('45 gal', 450.00),
               ('65 gal', 650.00), ('95/100', 800.00));

-- V4 — IDEMPOTENCE. Re-running changes nothing. Expect: PASS, 0.
SELECT 'V4 re-running would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_that_would_still_change
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND label = '3/5 gal' AND install_price IS NULL
   AND install_price_because NOT LIKE 'Not installed at this size%';
