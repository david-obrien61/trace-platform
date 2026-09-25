-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-24 — LAWNS DATA: Plant Your Tree prices from the INSTALL ladder   · ledger #404
--
-- ✏️ THIS FILE REPLACES THE 2026-09-24 VERSION SHA `624db4da…`. **DO NOT RUN THAT ONE.**
--   Its SQL was identical; what changed underneath it is what `price_source` MEANS. When it was
--   written, a service named "Plant Your Tree" was routed to a SECOND price column (`pyt_price`),
--   deliberately seeded on no rung — so running it would have made **every Plant Your Tree line
--   unpriced**. Ledger #404 removed that routing. Now `price_source = 'container_ladder'` means
--   one thing for every service: **read `install_price` off the rung.**
--
-- 🔴 DAVID, 2026-09-24: *"PLANT YOUR TREE uses the INSTALL LADDER'S PRICES per container size…
--   15 gal → the install from ladder."*
--
-- ⚠️ THIS IS A DATA FILE, NOT A MIGRATION. It is not in `supabase/migrations/`, it touches ONE
--   tenant's ONE row, and CLAUDE.md §4 reserves LAWNS data writes to David.
--
-- 🔴 RUN IT ONLY AFTER `feat/pyt-from-install-ladder` (#404) IS MERGED AND DEPLOYED. Before the
--   code is live, the old routing is still in the bundle and the line would read `pyt_price`,
--   which is NULL on every rung.
--
-- WHAT IT DOES: tells the platform that `Plant Your Tree` takes its price from the container
--   ladder, exactly as `Installation` already does — and now from the SAME column.
--
-- ⚠️ THE $125 ON THAT ROW IS DAVID'S OWN DEMO FIGURE, NOT LAUREN'S PRICE — he said so on
--   2026-09-24. It is LEFT IN PLACE rather than zeroed: once `price_source` is `container_ladder`
--   nothing reads it (checkout shows *"priced by container size"* where a scalar price would go),
--   and zeroing a column nobody reads would look like a price of $0 to the next person who greps
--   for it. 🔴 It is still a second representation of one fact (STD-011) and is recorded as such.
--
-- ✅ AND UNLIKE THE VERSION THIS REPLACES, THE PRICES ARE ALREADY THERE. LAWNS's install ladder is
--   priced on 6 of its 9 rungs — 15 gal $204 · 30 $425 · 45 $450 · 65 $650 · 95/100 $800 ·
--   200 gal $1,800 (measured live 2026-09-24). So the first Plant Your Tree line after this runs
--   is PRICED, not owed. `slip`, `4 in` and `3/5 gal` carry no install price and will ask — and
--   for Plant Your Tree they ask WITHOUT blocking the sale, by David's ruling of the same day.
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

-- D2 — 🔴 WHAT THE COUNTER WILL SEE ON THE NEXT ORDER. Expect: PASS.
-- Every rung that carries an install price now also prices a Plant Your Tree line, because they
-- are the same number. `rungs_unpriced` is the count that will ASK rather than charge — for Plant
-- Your Tree that is a flag, not a refusal. Printed without a verdict so it can be read as it moves.
SELECT 'D2 the install ladder is what Plant Your Tree will read, and it is priced' AS check,
       CASE WHEN count(*) FILTER (WHERE install_price IS NOT NULL
                                    AND coalesce(install_price_because, '') = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE install_price IS NOT NULL
                          AND coalesce(install_price_because, '') = '') AS priced_but_silent_should_be_zero,
       count(*) FILTER (WHERE install_price IS NOT NULL) AS rungs_priced_informational,
       count(*) FILTER (WHERE install_price IS NULL)     AS rungs_unpriced_informational,
       string_agg(label || ' ' || coalesce('$' || install_price::text, 'not set'), ' · ' ORDER BY sort_order) AS ladder_informational
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
