-- ─────────────────────────────────────────────────────────────────────────────
-- 20260924e_container_ladder_install_price_check.sql    ·  ledger #404
--
-- TWO THINGS, BOTH ABOUT THE LADDER'S PRICE COLUMNS, AND THEY BELONG TOGETHER
-- BECAUSE THE SECOND EXPLAINS THE FIRST.
--
-- ── 1. `install_price` GETS THE CHECK IT NEVER HAD ──────────────────────────
-- `20260923e` shipped `install_price` with NO constraint of any kind, so a **$0 install** —
-- the single value that whole design exists to keep off a screen — can be written today by
-- any writer that forgets. Its own header says it: *"A DEFAULT of 0 would put a free install
-- on a screen."* The design said so; nothing enforced it.
--
-- ⚠️ MEASURED LIVE BEFORE THIS WAS WRITTEN (2026-09-24), because a constraint that would
-- reject existing rows cannot land and finding that out from Postgres is the expensive way:
--     9 rungs · 1 tenant · **0 at zero · 0 negative** · 3 not set · 6 priced, $204–$1,800.
-- Nothing has to be cleaned first. NULL stays legal — "not set" is the ordinary state and
-- must remain writable (R-171 (c): the counter types an amount with a reason).
--
-- NAMED, per tech-debt #91: an inline CHECK is auto-named by Postgres, so its name is never
-- typed anywhere and a later sweep matching on `conname` can never find it. It mirrors
-- `container_ladder_pyt_price_positive_check` exactly, which is the shape `20260924d` used.
--
-- ── 2. `pyt_price` IS DOCUMENTED AS NOT USED ────────────────────────────────
-- 🔴 DAVID, 2026-09-24: *"PLANT YOUR TREE uses the INSTALL LADDER'S PRICES per container
-- size… 15 gal → the install from ladder."* `20260924d` gave Plant Your Tree its own
-- `pyt_price` column and deliberately seeded NONE of it, so pointing that service at the
-- ladder would have made **every Plant Your Tree line unpriced**. The correction is that
-- there is ONE price per rung and every ladder-priced service reads it.
--
-- ⚠️ THE COLUMN IS NOT DROPPED AND THAT IS DELIBERATE, NOT LAZINESS. A migration is never
-- edited (§6 r1) and `20260924d` is APPLIED; dropping a column on a live table to tidy a
-- decision that lasted four hours risks more than the clutter costs. It carries NULL on every
-- rung on every tenant, nothing reads it, and **its COMMENT now says so** — so the next person
-- to find it learns why it is there instead of wiring something to it.
--
-- ADDITIVE AND IDEMPOTENT: `DROP CONSTRAINT IF EXISTS` before the ADD, and `COMMENT ON` is
-- absolute. A second run changes nothing.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. THE NAMED CHECK ────────────────────────────────────────────────────────
-- NULL passes: "not set" is the ordinary state. 0 does not: a free install is the one value
-- this design exists to keep off a screen.
ALTER TABLE container_ladder
  DROP CONSTRAINT IF EXISTS container_ladder_install_price_positive_check;
ALTER TABLE container_ladder
  ADD CONSTRAINT container_ladder_install_price_positive_check
  CHECK (install_price IS NULL OR install_price > 0);

-- ── 2. THE COLUMN COMMENTS ────────────────────────────────────────────────────
COMMENT ON COLUMN container_ladder.install_price IS
  'What ONE tree of this size costs to have planted in. Read by EVERY ladder-priced service — install AND Plant Your Tree (David, 2026-09-24). NULL = not set; the counter types an amount with a reason. Never 0: refused by container_ladder_install_price_positive_check.';

COMMENT ON COLUMN container_ladder.pyt_price IS
  'NOT USED — Plant Your Tree prices from install_price (David, 2026-09-24). Added by 20260924d when the design gave it its own column; that lasted four hours. NULL on every rung on every tenant, read by nothing. Do not wire anything to it; if a service ever needs a second price, that is a decision, not this column.';

COMMENT ON COLUMN container_ladder.pyt_price_because IS
  'NOT USED — see pyt_price. Kept beside it so the pair stays legible rather than half-removed.';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style, self-contained, and every one runs AS-IS in the SQL
-- editor (§6 r26). Read-only except V3, which is marked.
-- 🔴 NOT ONE PINS A LIVE COUNT. Live figures are PRINTED in columns that carry no verdict.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE CHECK EXISTS AND IS FINDABLE BY NAME. Expect: PASS, 1.
SELECT 'V1 container_ladder_install_price_positive_check exists BY NAME' AS check,
       CASE WHEN count(*) = 1 AND bool_and(pg_get_constraintdef(oid) ILIKE '%install_price%>%0%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS constraints_found,
       coalesce(string_agg(pg_get_constraintdef(oid), ' · '), '(none)') AS definition
  FROM pg_constraint
 WHERE conrelid = 'container_ladder'::regclass
   AND conname  = 'container_ladder_install_price_positive_check';

-- V2 — 🔴 NOT ONE ROW WAS HARMED, AND NOT ONE PRICE MOVED. Expect: PASS, 0 broken.
-- The constraint is only safe because nothing violates it; this asserts that AFTERWARDS, on
-- whatever the table actually holds, rather than trusting the read taken before it was written.
SELECT 'V2 every existing install price still satisfies the new rule' AS check,
       CASE WHEN count(*) FILTER (WHERE install_price IS NOT NULL AND install_price <= 0) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE install_price IS NOT NULL AND install_price <= 0) AS violations_should_be_zero,
       count(*) FILTER (WHERE install_price IS NULL)     AS not_set_informational,
       count(*) FILTER (WHERE install_price > 0)         AS priced_informational,
       min(install_price) AS lowest_informational,
       max(install_price) AS highest_informational
  FROM container_ladder;

-- V3 — 🔴 RUN THIS ONE ALONE. AN ERROR IS THE PASS.
-- [[R-33]]: a guard nobody has watched refuse is a claim, not a guard. This WRITES and must
-- fail. Expect: ERROR 23514, naming container_ladder_install_price_positive_check. The
-- statement is atomic, so nothing is left holding a 0.
UPDATE container_ladder SET install_price = 0
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND sort_order = (SELECT min(sort_order) FROM container_ladder
                      WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74');

-- V4 — THE COMMENTS SAY WHAT THEY SHOULD. Expect: PASS.
-- A comment is the only thing standing between `pyt_price` and somebody wiring to it, so it is
-- asserted like any other guard rather than assumed to have landed.
SELECT 'V4 install_price says it serves every service; pyt_price says NOT USED' AS check,
       CASE WHEN bool_and(CASE
              WHEN a.attname = 'install_price'     THEN d.description ILIKE '%Plant Your Tree%'
              WHEN a.attname = 'pyt_price'         THEN d.description ILIKE 'NOT USED%'
              ELSE d.description ILIKE 'NOT USED%' END)
             AND count(*) = 3
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS columns_commented,
       string_agg(a.attname || ' → ' || left(d.description, 40), ' · ' ORDER BY a.attname) AS comments
  FROM pg_description d
  JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
 WHERE d.objoid = 'container_ladder'::regclass
   AND a.attname IN ('install_price', 'pyt_price', 'pyt_price_because');

-- V5 — 🔴 THE BLAST-RADIUS CONTROL, AS AN INVARIANT RATHER THAN A COUNT. Expect: PASS, 0.
-- A priced rung must still say where its price came from. An ALTER that disturbed a
-- neighbouring column would break that without changing how many rungs there are.
SELECT 'V5 every priced rung still says why, and pyt_price is empty everywhere' AS check,
       CASE WHEN count(*) FILTER (WHERE install_price IS NOT NULL
                                    AND coalesce(install_price_because, '') = '') = 0
             AND count(*) FILTER (WHERE pyt_price IS NOT NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE install_price IS NOT NULL
                          AND coalesce(install_price_because, '') = '') AS priced_but_silent_should_be_zero,
       count(*) FILTER (WHERE pyt_price IS NOT NULL) AS pyt_priced_should_be_zero,
       count(*) AS rungs_informational,
       count(DISTINCT business_id) AS tenants_informational
  FROM container_ladder;

-- V6 — IDEMPOTENCE. Re-running the whole file changes nothing. Expect: PASS, 1.
-- (The constraint is dropped and re-added, so "unchanged" means exactly one still exists.)
SELECT 'V6 re-running this file leaves exactly one such constraint' AS check,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS constraints_named_this
  FROM pg_constraint
 WHERE conrelid = 'container_ladder'::regclass
   AND conname  = 'container_ladder_install_price_positive_check';
