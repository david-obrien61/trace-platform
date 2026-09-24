-- ─────────────────────────────────────────────────────────────────────────────
-- 20260924d_container_ladder_pyt_price.sql          ·  ledger #399  ·  David 2026-09-24
--
-- PURPOSE: give every rung on the container ladder a PLANT YOUR TREE price, so the
--   counter can ring up "plant this tree for me" and the number comes from the
--   tree's container size — exactly as install already does.
--
-- DAVID, 2026-09-24: *"PLANT YOUR TREE IS PRICED BY CONTAINER SIZE FROM A LADDER,
--   like install. Customer says 15 gal → the 15 gal rung; 30 gal → the 30 gal rung;
--   'I don't know' → the installer identifies it on the install day and LAWNS
--   AMENDS the order to add the charge."*
--
-- 🔴 THE SEED IS EMPTY, AND THAT IS A MEASUREMENT, NOT A SHORTCUT.
--   The red-team passed this build on one condition: *seed each rung where history
--   supports it, leave it UNPRICED WITH A REASON otherwise.* So the history was
--   measured before any SQL was written — and it supports NO rung.
--
--   LAWNS has invoiced FIVE Plant-Your-Tree lines, ever (measured live 2026-09-24
--   over every `order_items` row on the LAWNS business):
--       $100    invoice 3311      "Plant Your Tree (Olive Tree)"
--       $450×10 invoice 3623      "Planting of Yaupons In New Location"
--       $300    invoice 5107      "Plant Your Tree (Japanese Maple)"
--       $0      invoice 3648.401  "Plant Your Tree - In Your Pot" (the demo invoice)
--       $150    (no item id)      "Plant Your Tree"
--
--   🔴 EVERY ONE OF THEM IS A TREE THE CUSTOMER ALREADY OWNS, OR AN EXISTING TREE
--   BEING MOVED — an Olive, a Japanese Maple, yaupons relocated in a garden. On each
--   of those invoices the container size on the order belongs to a DIFFERENT line:
--   3311's only sized line is a 65-gallon Wax Myrtle, 5107's is a 95-gallon Holly.
--   Taking a median across them would attach a number to a rung the number was never
--   about. So no rung is seeded, and each carries a reason that says why.
--
--   ⚠️ THAT FINDING CONFIRMS DAVID'S SPEC RATHER THAN CONTRADICTING IT. *"'I don't
--   know' → the installer identifies it on the install day"* only makes sense for a
--   tree we did not sell; a tree bought here has its size on its own line already.
--
-- 🔴 `pyt_price` IS NULLABLE AND NULL IS A REAL ANSWER — the same design as
--   `install_price` (R-171 (c), 20260923e), for the same reason: a DEFAULT of 0 would
--   put a FREE planting on a screen. NULL means "not set", the line says so in those
--   words, and someone types the number (D-9, A9 — absent is not empty).
--
-- 🔴 IT CARRIES A NAMED CHECK AND `install_price` DOES NOT — THE ASYMMETRY IS
--   DELIBERATE AND IS FILED. The red-team asked for a named CHECK refusing 0 and
--   negatives, and it is here. `20260923e` shipped `install_price` with NO constraint
--   at all, so a 0 CAN be written there today by any writer that forgets — the exact
--   value the design says must never appear. NAMED, per tech-debt #91: an inline CHECK
--   is auto-named by Postgres, so its name is never typed anywhere and a later sweep
--   matching on `conname` can never find it. ⚠️ **Adding the same constraint to
--   `install_price` is NOT done here** — it would need a live read first to prove no
--   0 is already stored, and doing it inside this build is the drift the gate exists
--   to catch. Filed as tech-debt against `20260923e`.
--
-- ADDITIVE AND IDEMPOTENT: `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
--   before the ADD, and every UPDATE guarded on `pyt_price_because = ''` — so a
--   second run changes zero rows and CANNOT overwrite a reason someone has since
--   corrected. That guard is the point of it.
--
-- ⚠️ NO PRICE IS WRITTEN FOR ANY TENANT, LAWNS INCLUDED. The only thing seeded is a
--   SENTENCE, and a sentence invents nothing: it states that nobody has set a figure
--   and why. That is why the generic branch is safe to run across every tenant, where
--   seeding a PRICE across tenants would not be (AC-3).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. THE COLUMNS ────────────────────────────────────────────────────────────
ALTER TABLE container_ladder
  ADD COLUMN IF NOT EXISTS pyt_price         numeric(10,2),
  ADD COLUMN IF NOT EXISTS pyt_price_because text NOT NULL DEFAULT '';

COMMENT ON COLUMN container_ladder.pyt_price IS
  'What it costs to PLANT ONE tree of this size that the customer already owns. NULL = not set — the line says so and someone types an amount; never 0, which would read as free.';
COMMENT ON COLUMN container_ladder.pyt_price_because IS
  'Where that figure came from, or why there is none. Required for the same reason install_price_because is: an unlabelled price cannot be checked.';

-- ── 2. THE NAMED CHECK — 0 AND NEGATIVES ARE REFUSED ──────────────────────────
-- NULL passes: "not set" is the ordinary state and must stay writable. 0 does not:
-- a free planting is the one value this whole design exists to keep off a screen.
ALTER TABLE container_ladder
  DROP CONSTRAINT IF EXISTS container_ladder_pyt_price_positive_check;
ALTER TABLE container_ladder
  ADD CONSTRAINT container_ladder_pyt_price_positive_check
  CHECK (pyt_price IS NULL OR pyt_price > 0);

-- ── 3. THE REASON — LAWNS FIRST, IN ITS OWN MEASURED WORDS ────────────────────
UPDATE container_ladder SET
  pyt_price_because = 'Not set. LAWNS has invoiced five Plant Your Tree lines ever ($100, $450, $300, $0, $150, measured 2026-09-24) and every one is a tree the customer already owned or an existing tree being moved — on each of those invoices the container size belongs to a different line. There is nothing to take a median from at this size. Lauren sets the figure; until she does, the counter types it.'
WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
  AND pyt_price_because = '';

-- ── 4. EVERY OTHER TENANT GETS A SENTENCE TOO, NOT A SILENCE ──────────────────
-- ⚠️ THIS IS WHERE THIS MIGRATION DIVERGES FROM `20260923e` ON PURPOSE. That one
-- seeded LAWNS and left every other tenant's `install_price_because` at '', so a new
-- tenant's ladder editor shows a blank where a reason belongs — a screen with nothing
-- to say. A REASON is not a PRICE: writing one for every tenant asserts nothing about
-- their business, it only refuses to be silent (D-9).
UPDATE container_ladder SET
  pyt_price_because = 'Not set. Nobody has told the system what it costs to plant a tree of this size that the customer already owns. The counter types an amount, with a reason.'
WHERE pyt_price_because = '';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Each returns a row saying PASS or FAIL in words.
-- Read-only except V3, which is marked. Run AFTER the migration.
--
-- 🔴 NOT ONE OF THESE PINS A LIVE COUNT (§6 r26). `20260923m`'s V4 asserted
-- "512 lots at qty 10" and read FAIL twenty hours later because ONE lot moved in test
-- mode — a true-shaped failure about nothing. These assert SHAPE and INVARIANTS: what
-- must be true however many rungs exist. Live figures are still PRINTED, in columns
-- that carry no verdict, so they can be read without being asserted.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE COLUMNS EXIST WITH THE RIGHT NULLABILITY. Expect: PASS.
-- 🔴 `pyt_price` MUST be nullable and MUST have NO default. A default of 0 is the
-- defect this whole design avoids, so it is asserted, never assumed.
SELECT 'V1 pyt_price nullable with NO default; because NOT NULL' AS check,
       CASE WHEN count(*) = 2
             AND bool_and(CASE WHEN column_name = 'pyt_price'
                               THEN is_nullable = 'YES' AND column_default IS NULL
                               ELSE is_nullable = 'NO'  AND column_default IS NOT NULL END)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS columns_found,
       string_agg(column_name || ' ' || data_type || ' null=' || is_nullable ||
                  ' default=' || coalesce(column_default, '(none)'), ' · ' ORDER BY column_name) AS shape
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'container_ladder'
   AND column_name IN ('pyt_price', 'pyt_price_because');

-- V2 — THE CHECK EXISTS AND IS FINDABLE BY NAME. Expect: PASS, 1.
-- tech-debt #91: an inline CHECK is auto-named, so its name is never typed and no
-- sweep matching on `conname` can ever find it. This one is named, and this asserts it.
SELECT 'V2 container_ladder_pyt_price_positive_check exists BY NAME' AS check,
       CASE WHEN count(*) = 1 AND bool_and(pg_get_constraintdef(oid) ILIKE '%pyt_price%>%0%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS constraints_found,
       string_agg(pg_get_constraintdef(oid), ' · ') AS definition
  FROM pg_constraint
 WHERE conrelid = 'container_ladder'::regclass
   AND conname  = 'container_ladder_pyt_price_positive_check';

-- V3 — 🔴 RUN THIS ONE ALONE. AN ERROR IS THE PASS. (Run it AFTER V1/V2, BEFORE V4–V7.)
-- [[R-33]]: a guard nobody has watched refuse is a claim, not a guard. This WRITES,
-- and it must fail. Expect: ERROR 23514, naming container_ladder_pyt_price_positive_check.
-- If it SUCCEEDS, a free planting can be stored and the constraint is not doing its job.
-- ⚠️ IT IS LIVE SQL, NOT A COMMENT, AND IT RUNS AS-IS (§6 r26). It writes, it fails, and the
-- failure is atomic — the statement is rolled back and no rung is left holding a 0.
UPDATE container_ladder SET pyt_price = 0
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND sort_order = (SELECT min(sort_order) FROM container_ladder
                      WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74');

-- V4 — 🔴 EVERY RUNG SAYS WHY, ON EVERY TENANT. Expect: PASS, 0 silent.
-- The D-9 assertion, and it is a SHAPE assertion: it does not care how many rungs
-- exist or which tenants have them — only that not one of them is silent.
SELECT 'V4 no rung on any tenant carries a blank reason' AS check,
       CASE WHEN count(*) FILTER (WHERE pyt_price_because = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE pyt_price_because = '') AS silent_should_be_zero,
       count(*) AS rungs_total_informational,
       count(DISTINCT business_id) AS tenants_informational
  FROM container_ladder;

-- V5 — 🔴 THE SEED WROTE NO PRICE ANYWHERE. Expect: PASS, 0.
-- The negative control for section 3/4: those two UPDATEs touch the REASON only. A
-- number appearing here means the seed wrote something it was never asked to.
SELECT 'V5 the migration set no price on any rung' AS check,
       CASE WHEN count(*) FILTER (WHERE pyt_price IS NOT NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE pyt_price IS NOT NULL) AS priced_should_be_zero
  FROM container_ladder;

-- V6 — 🔴 THE LADDER'S OTHER FACTS ARE UNTOUCHED. The blast-radius control.
-- An INVARIANT, not a count: a rung that HAS an install price must still say where it
-- came from. An ALTER that disturbed the neighbouring columns would break that without
-- changing how many rungs there are. The live figures are printed and NOT asserted.
SELECT 'V6 install pricing is intact — every priced rung still says why' AS check,
       CASE WHEN count(*) FILTER (WHERE install_price IS NOT NULL
                                    AND coalesce(install_price_because, '') = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE install_price IS NOT NULL
                          AND coalesce(install_price_because, '') = '') AS priced_but_silent_should_be_zero,
       count(*) FILTER (WHERE install_price IS NOT NULL) AS install_priced_informational,
       count(*) AS rungs_informational
  FROM container_ladder;

-- V7 — 🔴 IDEMPOTENCE, AND IT IS WHAT PROTECTS LAUREN'S EDITS. Expect: PASS, 0.
-- Re-running sections 3 and 4 must change ZERO rows, because every rung now fails the
-- `pyt_price_because = ''` guard.
SELECT 'V7 re-running the reason seed would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_the_seed_would_still_write
  FROM container_ladder
 WHERE pyt_price_because = '';
