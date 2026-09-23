-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-23-switch-install-onto-the-ladder.sql   ·  ledger #386  ·  R-171 (b)
--
-- 🔴 THIS IS THE SWITCH-ON. Without it the whole of #386 is inert.
--
--    Everything is applied and merged, and LAWNS's `Installation` row still reads
--    `price_source = 'fixed'` — so checkout charges its scalar **$450 per plant at
--    EVERY size**, which is right at 45 gal and wrong at the other four:
--       15 gal would bill $450 against a billed median of $204
--       30 gal          $450                              $425
--       65 gal          $450                              $650
--       95/100          $450                              $800
--    That is worse than before the build at both ends, so this is not a polish
--    step — it is the step that makes the feature exist.
--
-- WHY IT IS SQL AND NOT A SCREEN, SAID PLAINLY: **there is no UI for
--    `price_source` yet.** `20260923f` added the column and the Settings service
--    editor was not extended to expose it. That is a real gap in this build and it
--    is recorded rather than glossed — a one-line UPDATE is an acceptable way to
--    switch a feature on ONCE, for one tenant, with the owner watching; it is not
--    an acceptable way for a second tenant to do it.
--
-- ⚠️ THE ROW'S `price` COLUMN BECOMES UNUSED, AND IT IS LEFT IN PLACE ON PURPOSE.
--    Zeroing it would look like "this service is free" to anyone reading the table,
--    and `price_source` is what says the column is not consulted. Leaving 450 there
--    also means flipping back to 'fixed' restores exactly today's behaviour.
--
-- ⚠️ ONE TENANT, ONE ROW. Test Dave's `Placement Service` is deliberately NOT
--    touched — it is the negative control on the owner-test board (CARD 2) proving
--    that per-size pricing is opt-in per row and did not silently re-price another
--    tenant's live service.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE service_offerings
   SET price_source = 'container_ladder'
 WHERE business_id  = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND name         = 'Installation'
   AND category     = 'transport'
   AND price_type   = 'per_unit';   -- a flat row cannot price per size; refuse rather than mislabel

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Read-only. Run AFTER.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE INSTALL ROW NOW PRICES FROM THE LADDER. Expect: PASS, exactly 1 row.
SELECT 'V1 LAWNS Installation prices from the container ladder' AS check,
       CASE WHEN count(*) = 1 AND bool_and(price_source = 'container_ladder')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       min(name) AS row_name,
       min(price_source) AS price_source,
       min(price)::text AS price_column_now_unused,
       min(price_type) || '/' || min(price_unit) AS shape
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND name = 'Installation';

-- V2 — 🔴 NOTHING ELSE MOVED, ANYWHERE. The blast-radius control.
-- Expect: PASS — exactly ONE ladder-priced service on the whole platform.
SELECT 'V2 exactly one service platform-wide prices from the ladder' AS check,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS ladder_priced_services,
       string_agg(name, ' · ') AS which
  FROM service_offerings
 WHERE price_source = 'container_ladder';

-- V3 — 🔴 TEST DAVE'S PLACEMENT SERVICE IS UNTOUCHED. The named negative control
-- that CARD 2 rests on. Expect: PASS — still fixed, still $225.
SELECT 'V3 Placement Service is still a flat $225 per plant' AS check,
       CASE WHEN count(*) = 1 AND bool_and(price_source = 'fixed' AND price = 225.00)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       min(price_source) AS price_source,
       min(price)::text AS price
  FROM service_offerings
 WHERE name = 'Placement Service';

-- V4 — WHAT THE COUNTER WILL NOW CHARGE, PER SIZE. Not a pass/fail — the point of
-- the build, printed, so the first order is checked against a number you chose.
-- ⚠️ `3/5 gal`, `slip`, `4 in` and `200 gal` show "TYPED AT THE COUNTER" — that is
-- R-171 (c) and, for 3/5, R-173: correct, not missing.
SELECT cl.label AS size,
       CASE WHEN cl.install_price IS NULL
            THEN 'TYPED AT THE COUNTER (with a reason)'
            ELSE '$' || cl.install_price::text END AS install_charge,
       CASE WHEN cl.install_price IS NULL THEN left(cl.install_price_because, 44) ELSE '' END AS why_not
  FROM container_ladder cl
 WHERE cl.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND cl.active
 ORDER BY cl.sort_order;

-- ── ROLLBACK — restores exactly today's behaviour (a flat $450/plant). ─────────
-- BEGIN;
-- UPDATE service_offerings SET price_source = 'fixed'
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND name = 'Installation';
-- COMMIT;
