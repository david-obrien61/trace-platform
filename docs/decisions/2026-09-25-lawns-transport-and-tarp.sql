-- ═══════════════════════════════════════════════════════════════════════════════
-- LAWNS DATA — the four transport choices, and the tarp.      Ledger #408.
-- David pastes this. SQL editor. Run AFTER `supabase/migrations/20260925c_transport_pairing_and_service_rows.sql`.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ DATA, NOT A MIGRATION. One tenant's rulings; CLAUDE.md §4 reserves LAWNS data writes to David.
--
-- 🔴 WHAT THIS CORRECTS, IN DAVID'S OWN WORDS, AFTER HE USED CHECKOUT ON 2026-09-25:
--   · Tailgate Delivery read **$150**. His ruling of 2026-09-12 is **$50**, editable —
--     the $150 was his own demo input, not a price.
--   · Checkout offered installation with **every** delivery. Only **Trip Charge** pairs with it
--     (2026-09-18), and that fact now has a column to live in.
--   · **Backyard** read $100 flat. His ruling: **the tailgate fee plus an amount set at the point
--     of sale, with a required reason**. The row is CHANGED — never a second row.
--   · **Tree Tarp** said `per_unit`/`order` — a contradiction, and each screen read a different
--     half (add-ons said "per order", order detail said "per plant"). His ruling of 2026-09-25:
--     **per order, $35 each, with a quantity a person sets** — *"the human needs to identify if 1
--     or more due to loading."* **Never the plant count.**
--
-- ✅ WHAT IT DOES NOT TOUCH, AND WHY. Installation's scalar `$450` and Plant Your Tree's `$125`
--   are both left in place. Both rows price from the container ladder (`price_source`), so
--   nothing reads those numbers — and zeroing a column nobody reads would look like a price of
--   $0 to the next person who greps for it. 🔴 They are still a second representation of one
--   fact (STD-011) and are recorded as such rather than tidied silently.
--
-- ⚠️ **Rule 29 (pending filing)** — crew-link files it tonight. Every figure below is editable in
--   Settings, which is what r29 will require.
--
-- IDEMPOTENT: every UPDATE is absolute and matched on `name`. A second run changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① THE FOUR TRANSPORT CHOICES ─────────────────────────────────────────────
UPDATE service_offerings AS s SET
  price                   = v.price,
  offers_installation     = v.offers_install,
  amount_required_at_sale = v.amount_required
FROM (VALUES
  -- 1. DELIVERY + INSTALLATION. $50 default, changeable WITH A REASON. The only row that pairs
  --    with installation (David, 2026-09-18).
  ('Trip Charge',              50.00,  true,  false),
  -- 2. TAILGATE — the tailgate fee ONLY. No trip charge, no installation. Was $150 (demo input).
  ('Tailgate Delivery',        50.00,  false, false),
  -- 3. BACKYARD — the tailgate fee as the FLOOR, and an amount stated at the point of sale with
  --    a reason. `amount_required_at_sale` is what makes the $50 a starting point rather than
  --    the answer. No installation.
  ('Backyard',                 50.00,  false, true),
  -- 4. SELF-COLLECT — $0, and it stays $0.
  ('I will collect it myself',  0.00,  false, false)
) AS v(name, price, offers_install, amount_required)
WHERE s.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
  AND s.name = v.name;

-- ── ② TREE TARP — ONE REPRESENTATION, CLOSING #252's CONTRADICTION FOR THIS ROW ──────────────
-- 🔴 `flat` AND `order` AGREE NOW. The row said `per_unit`/`order`, so `AddOns.tsx` (which reads
-- `price_unit`) printed "per order" and `OrderDetail.tsx` (which reads `price_type`) printed
-- "per plant" — neither screen wrong, the row wrong. tech-debt #252, filed 2026-09-11.
-- ⚠️ `quantity_editable` is what keeps it per-order AND countable: 1 by default, a person may
-- say 2, and it is NEVER multiplied by the plant count.
UPDATE service_offerings SET
  price_type        = 'flat',
  price_unit        = 'order',
  quantity_editable = true,
  price             = 35.00
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND name = 'Tree Tarp';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style, self-contained, every one runs AS-IS (§6 r26). Read-only.
-- 🔴 NOT ONE PINS A ROW COUNT.
-- ═══════════════════════════════════════════════════════════════════════════════

-- V1 — 🔴 EXACTLY ONE ROW PAIRS WITH INSTALLATION, AND IT IS TRIP CHARGE. Expect: PASS, 1.
-- This is the whole of defect A in one row. Named individually, because a count of 1 would
-- also be satisfied by the WRONG row being the one.
SELECT 'V1 only Trip Charge offers installation' AS check,
       CASE WHEN count(*) FILTER (WHERE offers_installation) = 1
             AND count(*) FILTER (WHERE offers_installation AND name = 'Trip Charge') = 1
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE offers_installation) AS rows_offering_install_expect_1,
       coalesce(string_agg(name, ' · ') FILTER (WHERE offers_installation), '(none)') AS which
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V2 — THE FOUR TRANSPORT PRICES ARE DAVID'S. Expect: PASS, 4.
SELECT 'V2 TC $50 · Tailgate $50 · Backyard $50 · self-collect $0' AS check,
       CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_correct_of_4,
       string_agg(name || ' $' || price::text, ' · ' ORDER BY sort_order) AS prices
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND (name, price) IN (VALUES ('Trip Charge', 50.00), ('Tailgate Delivery', 50.00),
                                ('Backyard', 50.00), ('I will collect it myself', 0.00));

-- V3 — 🔴 BACKYARD IS THE ONLY ROW THAT DEMANDS AN AMOUNT AT THE COUNTER. Expect: PASS, 1.
-- If Trip Charge were also true, Lauren would be forced to state an amount on the commonest
-- branch in the shop — it has a real default and must not ask.
SELECT 'V3 only Backyard requires an amount at the point of sale' AS check,
       CASE WHEN count(*) FILTER (WHERE amount_required_at_sale) = 1
             AND count(*) FILTER (WHERE amount_required_at_sale AND name = 'Backyard') = 1
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE amount_required_at_sale) AS rows_requiring_amount_expect_1,
       coalesce(string_agg(name, ' · ') FILTER (WHERE amount_required_at_sale), '(none)') AS which
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V4 — 🔴 TREE TARP NOW SAYS ONE THING. Expect: PASS.
-- `flat` and `order` agree, the quantity is a person's, and the price is $35. The two screens
-- that disagreed read `price_type` and `price_unit` respectively; both now give "per order".
SELECT 'V4 Tree Tarp is flat/order, $35, quantity editable' AS check,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_matching_all_four,
       (SELECT price_type || '/' || price_unit || ' $' || price::text || ' qty_editable=' || quantity_editable::text
          FROM service_offerings
         WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND name = 'Tree Tarp') AS row_now
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND name = 'Tree Tarp'
   AND price_type = 'flat' AND price_unit = 'order'
   AND quantity_editable IS TRUE AND price = 35.00;

-- V5 — 🔴 NOTHING ELSE MOVED. The blast-radius control. Expect: PASS.
-- Installation and Plant Your Tree keep their ladder price source AND their unused scalars —
-- this file is not allowed to "tidy" a number nobody reads into a $0 somebody might.
SELECT 'V5 the ladder-priced rows are untouched, scalars and all' AS check,
       CASE WHEN count(*) FILTER (WHERE name = 'Installation'
                                    AND price_source = 'container_ladder' AND price = 450.00) = 1
             AND count(*) FILTER (WHERE name = 'Plant Your Tree'
                                    AND price_source = 'container_ladder' AND price = 125.00) = 1
             AND count(*) FILTER (WHERE offers_installation AND category <> 'transport') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE price_source = 'container_ladder') AS ladder_priced_informational,
       count(*) AS services_informational,
       string_agg(name || ' ' || price_source, ' · ' ORDER BY sort_order) AS every_row
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V6 — NO OTHER TENANT WAS TOUCHED. AC-3 negative control. Expect: PASS, 0.
SELECT 'V6 no other tenant changed' AS check,
       CASE WHEN count(*) FILTER (WHERE offers_installation
                                     OR amount_required_at_sale
                                     OR quantity_editable) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE offers_installation OR amount_required_at_sale OR quantity_editable) AS touched_should_be_zero,
       count(*) AS other_tenant_services_informational
  FROM service_offerings
 WHERE business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V7 — IDEMPOTENCE. Re-running changes nothing. Expect: PASS, 0.
SELECT 'V7 re-running this file would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_the_updates_would_still_change
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND ((name = 'Trip Charge'              AND (price <> 50.00 OR NOT offers_installation))
     OR (name = 'Tailgate Delivery'        AND (price <> 50.00 OR offers_installation))
     OR (name = 'Backyard'                 AND (price <> 50.00 OR NOT amount_required_at_sale))
     OR (name = 'I will collect it myself' AND price <> 0.00)
     OR (name = 'Tree Tarp'                AND (price_type <> 'flat' OR price_unit <> 'order'
                                             OR NOT quantity_editable OR price <> 35.00)));
