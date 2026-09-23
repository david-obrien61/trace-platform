-- ─────────────────────────────────────────────────────────────────────────────
-- 20260923g_manager_holds_order_discount_apply.sql  ·  ledger #386  ·  R-171 (a)
--
-- PURPOSE: give the MANAGER floor `order_discount:apply`, and give it to every
--   existing MANAGER member who lacks it. Nothing else changes.
--
-- 🔴 WHY — DAVID'S RULING, 2026-09-23: *"YES — LAWNS's MANAGER gets
--   order_discount:apply. Lauren runs the counter; the backyard amount is the
--   whole point of that choice, and every override already records amount, reason
--   and leakage."*
--
--   THE MEASUREMENT THAT PROMPTED IT (live, read-only, 2026-09-23): CartReview
--   gates the price-override control on `can('order_discount:apply')`, and LAWNS's
--   MANAGER holds 25 permission strings without it. So the one control that lets a
--   person type an amount at the counter is invisible to the only person standing
--   at the counter. Of LAWNS's four real transport choices, "backyard placement,
--   amount agreed at the counter" is unbuildable without this — not awkward,
--   unbuildable.
--
-- ⚠️ WHAT THIS IS NOT: it is NOT a discount on goods. `order_discount:apply` gates
--   the SERVICE PRICE OVERRIDE, which the platform treats as attributed leakage
--   (D-48): the retail baseline is preserved on the row, the concession rides the
--   line's discount, and `order_service_selections` records `original_price`,
--   `price_leakage`, `override_by` and `override_reason`. STD-013 is enforced
--   SERVER-SIDE in `applyOverride` — a reasonless override is REFUSED and the
--   BASELINE is charged, which errs toward charging more, never toward giving
--   money away unrecorded. Five such rows already exist live. Granting this string
--   does not widen what is recorded; it widens WHO can be recorded doing it.
--
-- 🔴 IT DOES NOT TOUCH `costs:read`, AND THAT IS DELIBERATE — a manager who can
--   concede a price still cannot see what the item cost. Margin stays owner-only
--   unless David's separate `20260922e` lands. The two are independent grants and
--   this migration takes no position on the other.
--
-- ⚠️⚠️ IT IS A NEAR-TWIN OF DAVID'S OWN `20260922e_manager_holds_costs_read.sql` (ledger #382),
--   AND THE TWO OVERLAP ON THE SAME TWO ROWS: the MANAGER floor in `role_definitions` and the
--   MANAGER rows in `business_members`. Each adds a DIFFERENT string and each is guarded by its own
--   `NOT (permissions ? …)`, so they do not conflict and both are idempotent.
--
-- 🔴 EITHER ORDER IS CORRECT. WHAT CHANGES IS THE NUMBERS THE V-BLOCKS PRINT, SO HERE THEY ARE BOTH
--   WAYS. Measured live 2026-09-23, read-only, immediately before this rename: **`20260922e` has
--   NOT been applied** — the MANAGER floor holds **25** strings and `costs:read` is **false**.
--
--     IF THIS FILE (20260923g) RUNS FIRST — the state as measured today:
--       · 20260923g V1 `strings_now` = 26 · V5 `costs_read_true_only_if_20260922e_ran` = false
--       · then 20260922e V1 `strings_now` = 27, beside its own hardcoded
--         `25 AS strings_before_expected`, which will READ ODD AND STILL PASS: that column is a
--         literal reminder of the before-state, not an assertion, and 20260922e's real check is
--         `permissions ? 'costs:read'`.
--       · 20260922e V5 asserts the STAFF floor is 10 and the OWNER floor is 59 — both untouched by
--         this file (V6 here asserts the same OWNER 59), so it passes either way.
--
--     IF 20260922e RUNS FIRST:
--       · 20260922e V1 `strings_now` = 26, matching its own `25 AS strings_before_expected` exactly
--       · then 20260923g V1 `strings_now` = 27 · V5 `costs_read_true_only_if_20260922e_ran` = true
--
--   🔴 IN BOTH ORDERS EVERY `verdict` CELL READS `PASS`, because every V-block in THIS file asserts
--   the STRING'S PRESENCE and never a total count. That is why they were written that way.
--
--   ⚠️ RECOMMENDED ORDER: **`20260922e` FIRST, THEN THIS FILE.** Not for correctness — for reading.
--   It is the older file, it is David's own, and running it first is the only order in which
--   20260922e's `25 AS strings_before_expected` column tells the truth on screen.
--
-- MEASURED LIVE IMMEDIATELY BEFORE WRITING (2026-09-23, read-only):
--   role_definitions, system floor (business_id IS NULL, is_system = true):
--     OWNER   59 strings · order_discount:apply = true
--     MANAGER 25 strings · order_discount:apply = FALSE   ← the row this edits
--     STAFF   10 strings · order_discount:apply = false
--   role_definitions, per-business overrides:
--     f7ec5d67… (Test Dave's) MANAGER 40 · order_discount:apply = TRUE ← already holds it
--     f7ec5d67… (Test Dave's) STAFF   10 · order_discount:apply = false
--   business_members, role = MANAGER, platform-wide — THREE rows:
--     ed2e5933… (LAWNS)       joel joiner   25 · FALSE  ← the only one changed
--     f7ec5d67… (Test Dave's) test obrien   40 · true
--     f7ec5d67… (Test Dave's) Erin O'Brien  40 · true
--
-- ⚠️ PER-BUSINESS OVERRIDE ROWS ARE LEFT ALONE, for the same reason `20260922e`
--   leaves them: a tenant that customised its own MANAGER role owns that choice.
--   The only override today already holds the string, so nothing is stranded.
--
-- IDEMPOTENT: every statement guarded by `NOT (permissions ? 'order_discount:apply')`.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. THE MANAGER FLOOR ──────────────────────────────────────────────────────
UPDATE role_definitions
   SET permissions = permissions || '["order_discount:apply"]'::jsonb,
       updated_at  = now()
 WHERE role_key    = 'MANAGER'
   AND business_id IS NULL
   AND is_system   = true
   AND NOT (permissions ? 'order_discount:apply');

-- ── 2. EXISTING MANAGER MEMBERS ───────────────────────────────────────────────
-- The floor governs what a NEW member is given; it does not reach back. Without
-- this, Lauren's role changes and Lauren does not.
UPDATE business_members
   SET permissions = permissions || '["order_discount:apply"]'::jsonb
 WHERE role = 'MANAGER'
   AND NOT (permissions ? 'order_discount:apply');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Read-only. Run AFTER the migration.
-- 🔴 Every one asserts the STRING, never a total count — see the ordering note above.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE MANAGER FLOOR NOW HOLDS IT. Expect: PASS.
SELECT 'V1 MANAGER floor holds order_discount:apply' AS check,
       CASE WHEN (permissions ? 'order_discount:apply') THEN 'PASS' ELSE 'FAIL' END AS verdict,
       jsonb_array_length(permissions) AS strings_now,
       '25 before this migration; 26 after; 27 if 20260922e also ran (MEASURED 2026-09-23: 20260922e has NOT run, so expect 26 here unless you applied it first)' AS note
  FROM role_definitions
 WHERE role_key = 'MANAGER' AND business_id IS NULL AND is_system = true;

-- V2 — LAWNS'S MANAGER HOLDS IT. The named person the ruling is about. Expect: PASS, 1.
SELECT 'V2 LAWNS MANAGER holds order_discount:apply' AS check,
       CASE WHEN count(*) = 1 AND bool_and(permissions ? 'order_discount:apply')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS manager_rows_at_lawns,
       min(jsonb_array_length(permissions)) AS strings_now
  FROM business_members
 WHERE role = 'MANAGER' AND business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V3 — EVERY MANAGER PLATFORM-WIDE HOLDS IT. Expect: PASS, 3 of 3.
SELECT 'V3 every MANAGER member holds it' AS check,
       CASE WHEN count(*) FILTER (WHERE NOT (permissions ? 'order_discount:apply')) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS manager_rows_total,
       count(*) FILTER (WHERE permissions ? 'order_discount:apply') AS holding
  FROM business_members
 WHERE role = 'MANAGER';

-- V4 — 🔴 STAFF IS STILL REFUSED. The negative control: nothing beyond MANAGER
-- was widened. Expect: PASS, 0 holding.
SELECT 'V4 STAFF still refused order_discount:apply' AS check,
       CASE WHEN count(*) FILTER (WHERE permissions ? 'order_discount:apply') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS staff_rows,
       count(*) FILTER (WHERE permissions ? 'order_discount:apply') AS holding_should_be_zero
  FROM business_members
 WHERE role = 'STAFF';

-- V5 — 🔴 NO OTHER STRING MOVED. The blast-radius control, and the one that would
-- catch a `||` that appended more than it meant to. Expect: PASS — the MANAGER
-- floor gained EXACTLY the one string, and `costs:read` is still absent from it
-- unless David's 20260922e has also run.
SELECT 'V5 the floor gained exactly one string' AS check,
       CASE WHEN (permissions ? 'order_discount:apply')
             AND NOT (permissions ? 'costs:delete')
             AND NOT (permissions ? 'order_discount:approve')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       (permissions ? 'costs:read') AS costs_read_true_only_if_20260922e_ran,
       jsonb_array_length(permissions) AS strings_now
  FROM role_definitions
 WHERE role_key = 'MANAGER' AND business_id IS NULL AND is_system = true;

-- V6 — 🔴 THE OWNER FLOOR IS UNTOUCHED. It always held this string. Expect: PASS, 59.
SELECT 'V6 OWNER floor unchanged at 59 strings' AS check,
       CASE WHEN (permissions ? 'order_discount:apply') AND jsonb_array_length(permissions) = 59
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       jsonb_array_length(permissions) AS strings_now
  FROM role_definitions
 WHERE role_key = 'OWNER' AND business_id IS NULL AND is_system = true;

-- V7 — IDEMPOTENCE. Re-running changes nothing. Expect: PASS, 0 rows.
SELECT 'V7 re-running the grant would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_that_would_still_change
  FROM business_members
 WHERE role = 'MANAGER' AND NOT (permissions ? 'order_discount:apply');
