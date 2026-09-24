-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-24 — LAWNS DATA: Plant Your Tree prices by container size    · ledger #399
--
-- ⚠️ THIS IS A DATA FILE, NOT A MIGRATION. It is not in `supabase/migrations/` and it is
--   not idempotent-by-accident — it is guarded so a second run changes nothing. It touches
--   ONE tenant's ONE row, and CLAUDE.md §4 reserves LAWNS data writes to David.
--
-- 🔴 RUN IT ONLY AFTER `20260924d_container_ladder_pyt_price.sql` IS APPLIED and the branch
--   `feat/pyt-ladder-price` is merged and deployed. Before the code is live, flipping
--   `price_source` makes checkout read a scalar price it no longer displays.
--
-- WHAT IT DOES AND WHY, IN ONE SENTENCE: it tells the platform that `Plant Your Tree` takes its
--   price from the container ladder, exactly as `Installation` already does — David, 2026-09-24:
--   *"PLANT YOUR TREE IS PRICED BY CONTAINER SIZE FROM A LADDER, like install."*
--
-- ⚠️ THE $125 ON THAT ROW IS DAVID'S OWN DEMO FIGURE, NOT LAUREN'S PRICE — he said so on
--   2026-09-24. It is LEFT IN PLACE rather than zeroed, deliberately: once `price_source` is
--   `container_ladder` nothing reads it (checkout shows *"priced by container size"* where a
--   scalar price would go), and zeroing a column nobody reads would look like a price of $0 to
--   the next person who greps for it. 🔴 **It is still a second representation of one fact
--   (STD-011) and it is recorded as such** — the durable fix is a NOT NULL price that is only
--   NOT NULL when `price_source = 'fixed'`, which is a migration and David's call, not a default
--   taken inside this build.
--
-- ⚠️ AND NO RUNG HAS A PRICE YET, SO THE FIRST ORDER AFTER THIS RUNS WILL SAY SO. That is the
--   designed behaviour, not a failure: the line reads *"Size to be confirmed on install day"*,
--   charges nothing today, and the order still sends. Lauren sets the figures in
--   Settings → Container sizes → Plant Your Tree price, one rung at a time, as she learns them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE service_offerings
   SET price_source = 'container_ladder'
 WHERE business_id  = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND name         = 'Plant Your Tree'
   AND price_source = 'fixed';   -- guard: a second run changes 0 rows

COMMIT;

-- ── VERDICTS ────────────────────────────────────────────────────────────────
-- 🔴 Neither pins a live count (§6 r26). They assert the SHAPE of the change.

-- D1 — the row now prices by size, and nothing else on this tenant moved. Expect: PASS.
SELECT 'D1 Plant Your Tree prices from the ladder; no other row changed' AS check,
       CASE WHEN count(*) FILTER (WHERE name = 'Plant Your Tree' AND price_source = 'container_ladder') = 1
             AND count(*) FILTER (WHERE name <> 'Plant Your Tree' AND name <> 'Installation'
                                    AND price_source <> 'fixed') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       string_agg(name || ' → ' || price_source, ' · ' ORDER BY sort_order) AS rows_informational
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- D2 — 🔴 WHAT THE COUNTER WILL SEE ON THE NEXT ORDER, BEFORE ANY RUNG IS PRICED.
-- Expect: PASS, and `rungs_priced` = 0 is the CORRECT answer today, not a failure. It is printed
-- without a verdict precisely so it can be read as it changes.
SELECT 'D2 the ladder is ready to be priced — every rung says why it is not' AS check,
       CASE WHEN count(*) FILTER (WHERE pyt_price_because = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE pyt_price_because = '') AS silent_should_be_zero,
       count(*) FILTER (WHERE pyt_price IS NOT NULL) AS rungs_priced_informational,
       count(*) AS rungs_informational
  FROM container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- D3 — idempotence. Re-running the UPDATE changes 0 rows. Expect: PASS, 0.
SELECT 'D3 re-running this file would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_it_would_still_write
  FROM service_offerings
 WHERE business_id  = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND name         = 'Plant Your Tree'
   AND price_source = 'fixed';
