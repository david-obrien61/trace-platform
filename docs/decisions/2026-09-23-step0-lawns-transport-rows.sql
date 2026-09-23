-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-23-step0-lawns-transport-rows.sql   ·  ledger #386, STEP 0 (Option A)
--
-- 🔴 THIS IS DATA, NOT A MIGRATION. It inserts three `service_offerings` rows for
--    LAWNS. It changes no schema, no policy and no code. It is filed under
--    docs/decisions/ rather than supabase/migrations/ for exactly that reason:
--    a migration is the shape of the platform, and this is one tenant's rows.
--    LAWNS stays read-only to Thunder (CLAUDE.md §4) — DAVID RUNS THIS.
--
-- WHY IT RUNS BEFORE THE BUILD. David, 2026-09-23: *"Do A FIRST as your own step 0
--    — insert the three missing transport rows at flat prices and prove the branch
--    wiring and the stop signal before spending build hours."*
--
-- WHAT IT PROVES, AND WHAT IT DOES NOT.
--    ✅ The radio goes from ONE branch to THREE.
--    ✅ An install rung up at the counter writes `orders.transport_method = 'install'`
--       and therefore `deliveries.service_type = 'planting'` — a planting job on the
--       truck. LAWNS has never been able to do this from checkout.
--    ✅ Self-collect exists for the first time, and re-enables the netting branch.
--    ❌ It does NOT price install per size. $450 is ONE flat price at every size and
--       is WRONG at four of the five sizes Lauren prices. That is ledger #386's job.
--    ❌ It does NOT make Tailgate reachable — tech-debt #251 means the SECOND
--       staff/flat row is offered nowhere and named in no flag. Expect to NOT see
--       Tailgate on the radio after running this. That is the defect, visible.
--
-- PROVEN BEFORE YOU PASTE IT: every row below is driven through the real
--    resolveTransportRoles → availableChoices → choiceToSelection →
--    deriveTransportMethod → deliveryServiceType chain in
--    `packages/cultivar-os/src/lib/transportStep0.test.ts` — 26 assertions, and
--    3 of 3 mutants caught (M1 install made flat · M2 self row removed ·
--    M3 sort_order moved). The fixtures are byte-for-byte these rows.
--
-- REVERSIBLE: the rollback block at the foot deletes exactly these three rows by
--    name, and nothing else. Safe while no order has referenced them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. INSTALLATION — staff, per plant ───────────────────────────────────────
-- 🔴 THE ONLY SHAPE THAT CAN SIGNAL AN INSTALL. `deriveTransportMethod` returns
--    'install' for a staff row with price_type='per_unit' (or when planting is
--    attached); a staff/flat row can only ever return 'delivery'. This is why
--    Trip Charge alone could never put a planting job on the truck.
-- ⚠️ $450 IS PROVISIONAL AND IS THE ONE NUMBER IN THIS FILE THAT IS KNOWINGLY
--    WRONG FOUR TIMES OUT OF FIVE. It is the 45 gal rung — the only size where
--    Lauren's sheet ($450) and LAWNS's own billed median ($450) agree exactly.
--    Billed medians at the other rungs: 15 gal $204 · 30 gal $425 · 65 gal $650 ·
--    95 gal $800. Ledger #386 replaces this scalar with the ladder's per-rung price.
INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   transport_mode, requires_address, pre_selected, is_active, sort_order, service_note)
VALUES
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74',
   'Installation',
   'We deliver and plant it in for you.',
   'transport', 'at_checkout', 'per_unit', 'plant', 450.00,
   'staff', true, false, true, 102,
   'STEP 0 (ledger #386, 2026-09-23): one flat price at every size, provisional. Correct only at 45 gal. Replaced by the per-size price on the container ladder.');

-- ── 2. TAILGATE DELIVERY — staff, once per order ─────────────────────────────
-- ⚠️ EXPECT THIS NOT TO APPEAR ON THE RADIO. It is a SECOND staff/flat row and
--    `resolveTransportRoles` takes `staff.find(price_type === 'flat')` — the first
--    by sort_order, which is Trip Charge at 100. Tailgate at 101 loses, silently.
--    It is inserted anyway, and deliberately, because tech-debt #251 has been a
--    written finding and not a thing anyone could see. Now it is on your screen.
--    $150 is LAWNS's own billed shape: 55 Tailgate lines, median near $150.
INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   transport_mode, requires_address, pre_selected, is_active, sort_order, service_note)
VALUES
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74',
   'Tailgate Delivery',
   'We drop it at the curb or the driveway. We do not carry it in.',
   'transport', 'at_checkout', 'flat', 'order', 150.00,
   'staff', true, false, true, 101,
   'STEP 0 (ledger #386, 2026-09-23): blocked by tech-debt #251 — a second staff/flat transport row is offered nowhere until #251 is fixed. Inserted so the defect is visible.');

-- ── 3. SELF-COLLECT — the branch LAWNS has never had ─────────────────────────
-- 🔴 PRE-SELECTED ON PURPOSE, AND THIS CHANGES THE DEFAULT ON EVERY ORDER.
--    `AddOns` picks the opening branch from the pre_selected transport row's mode.
--    David, 2026-09-23: *"self-collect (most customers; NO invoice line, because
--    nothing is charged)"* — so the order starts where most orders end up.
--    It also restores the netting/tarp offer, which only shows on the self branch.
-- ⚠️ requires_address = false: R-120 clause ② — the mode sets the default, self ⇒ false.
INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   transport_mode, requires_address, pre_selected, is_active, sort_order, service_note)
VALUES
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74',
   'I will collect it myself',
   'Pick up at the farm. Secure-your-load notice applies.',
   'transport', 'at_checkout', 'flat', 'order', 0.00,
   'self', false, true, true, 103,
   'STEP 0 (ledger #386, 2026-09-23): pre_selected so checkout opens on the branch most LAWNS customers actually use.');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Each returns a row saying PASS or FAIL in words.
-- Read-only. Run them after the INSERTs.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — FOUR TRANSPORT ROWS, EVERY ONE BOUND TO A MODE. Expect: PASS, 4.
-- The live CHECK `service_offerings_transport_requires_mode` would have refused an
-- unbound one, so this is the check confirming the rows landed, not hoping they did.
SELECT 'V1 LAWNS has four bound transport rows' AS check,
       CASE WHEN count(*) = 4 AND count(*) FILTER (WHERE transport_mode IS NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS transport_rows,
       count(*) FILTER (WHERE transport_mode IS NULL) AS unbound_should_be_zero
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND category = 'transport' AND is_active AND timing = 'at_checkout';

-- V2 — THE THREE ROLES THE RADIO NEEDS ALL RESOLVE. Expect: PASS.
-- This is `resolveTransportRoles` expressed in SQL: self = mode 'self';
-- delivery = staff + flat; planting = staff + per_unit.
SELECT 'V2 all three transport roles resolve' AS check,
       CASE WHEN count(*) FILTER (WHERE transport_mode = 'self') >= 1
             AND count(*) FILTER (WHERE transport_mode = 'staff' AND price_type = 'flat') >= 1
             AND count(*) FILTER (WHERE transport_mode = 'staff' AND price_type = 'per_unit') >= 1
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE transport_mode = 'self')                                 AS self_role,
       count(*) FILTER (WHERE transport_mode = 'staff' AND price_type = 'flat')        AS delivery_role,
       count(*) FILTER (WHERE transport_mode = 'staff' AND price_type = 'per_unit')    AS planting_role
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND category = 'transport' AND is_active AND timing = 'at_checkout';

-- V3 — 🔴 THE DEFECT, MEASURED RATHER THAN DESCRIBED. tech-debt #251.
-- Expect: PASS, and `staff_flat_rows = 2` with `offered = 1`. PASS here means
-- "the defect is present exactly as predicted", NOT "everything is fine".
SELECT 'V3 #251 — two staff/flat rows exist, ONE is reachable' AS check,
       CASE WHEN count(*) = 2 THEN 'PASS (defect present as predicted)' ELSE 'FAIL (unexpected shape)' END AS verdict,
       count(*) AS staff_flat_rows,
       1        AS offered_by_resolveTransportRoles,
       (array_agg(name ORDER BY sort_order))[1] AS the_one_that_wins,
       (array_agg(name ORDER BY sort_order))[2] AS the_one_that_vanishes
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND category = 'transport' AND is_active AND timing = 'at_checkout'
   AND transport_mode = 'staff' AND price_type = 'flat';

-- V4 — 🔴 NEGATIVE CONTROL: NO OTHER TENANT WAS TOUCHED. Expect: PASS.
-- Test Dave's three transport rows and Test David's one must be exactly as before.
SELECT 'V4 no other tenant changed' AS check,
       CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS other_tenant_transport_rows_expected_4
  FROM service_offerings
 WHERE business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND category = 'transport';

-- V5 — 🔴 NEGATIVE CONTROL: THE ADD-ONS ARE UNTOUCHED. Expect: PASS, 3.
-- Tree Installation ($125/plant), Tree Bubbler ($65/plant) and Tree Tarp ($35)
-- are still add-ons. Step 0 does NOT retire or convert them.
-- ⚠️ SEPARATELY WORTH YOUR EYE: `Tree Tarp` is price_type='per_unit' with
--    price_unit='order'. `nettedQuantity` keys on price_type ALONE, so it scales
--    ×N PLANTS despite saying "order" — a tarp charged per tree. Not touched here.
SELECT 'V5 the three add-ons are unchanged' AS check,
       CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS addon_rows,
       string_agg(name || ' $' || price::text || ' ' || price_type, ' · ' ORDER BY sort_order) AS addons
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND category = 'addon';

-- ═════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — deletes exactly these three rows and nothing else.
-- ⚠️ Only safe while no order has referenced them: order_service_selections
--    .service_offering_id is NOT NULL REFERENCES service_offerings(id) with no
--    ON DELETE clause, so the FK will REFUSE the delete once one has been used.
--    That refusal is correct and is the reason no ON DELETE was added.
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DELETE FROM service_offerings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND category = 'transport'
--    AND name IN ('Installation', 'Tailgate Delivery', 'I will collect it myself');
-- COMMIT;
