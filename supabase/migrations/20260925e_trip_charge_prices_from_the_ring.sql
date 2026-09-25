-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925e — TRIP CHARGE PRICES FROM THE RING · ledger #386
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────────────────────────
-- ONE ROW. LAWNS's `Trip Charge` starts pricing from `business_delivery_rings` instead of its own
-- flat $50. Nothing else moves: `Tailgate Delivery` and `Backyard` stay FLAT until David rules,
-- and every other tenant is untouched.
--
-- 🔴 WHY TRIP CHARGE AND ONLY TRIP CHARGE. The rings were derived from TRIP CHARGE history — 566
-- TC lines, 403 of them $50. They are a statement about what a trip costs by distance. A tailgate
-- drop and a backyard placement happen to cost $50 today and are different services; ring-pricing
-- them would silently re-price a curb drop two miles away down to ring 1 and a backyard placement
-- forty miles out up to $300, and nobody would be told it had changed.
--
-- ⚠️ IT MATCHES ONE ROW BY NAME, AND THAT IS THE RISK, NAMED. A hand-typed id↔name mapping put a
-- Gift Certificate in the not-stock list on 2026-09-22. So this file does NOT guess: it matches
-- `name = 'Trip Charge'` EXACTLY, inside ONE business id, restricted to `category = 'transport'`,
-- and V1 below SHOWS YOU THE ROW BEFORE YOU CHANGE IT. Read V1, then run the UPDATE.
--
-- ⚠️ REVERSIBLE IN ONE LINE, AND THE LINE IS AT THE FOOT. This changes what customers are charged.
-- Anything that changes money should say how to undo it in the same file, not in a chat message.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── V1 · LOOK FIRST. Run this ALONE and read it before the UPDATE below. ────────────────────
-- EXPECT: five transport rows, all `flat`, one of them named exactly `Trip Charge`.
-- SELECT id, name, price, category, transport_mode, pricing_basis
--   FROM public.service_offerings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND category = 'transport'
--  ORDER BY name;

BEGIN;

UPDATE public.service_offerings
   SET pricing_basis = 'ring'
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND category    = 'transport'
   AND name        = 'Trip Charge';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V2 · EXACTLY ONE row changed, and it is the right one.
--      EXPECT: Trip Charge = ring · Tailgate Delivery = flat · Backyard = flat ·
--              Installation = flat · "I will collect it myself" = flat.
-- SELECT name, price, pricing_basis FROM public.service_offerings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND category = 'transport'
--  ORDER BY pricing_basis DESC, name;
--
-- V3 · 🔴 NOBODY ELSE'S ROWS MOVED. EXPECT 0.
-- SELECT count(*) AS other_tenants_on_ring FROM public.service_offerings
--  WHERE pricing_basis = 'ring' AND business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V4 · what a delivery will now cost at each ring — the whole point, in one table.
--      EXPECT five rows: 7.1/$50 · 14.3/$100 · 21.4/$150 · 35.7/$250 · 42.9/$300.
-- SELECT outer_radius_miles AS out_to_miles, charge AS trip_charge, origin_note
--   FROM public.business_delivery_rings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND active
--  ORDER BY outer_radius_miles;
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 TO PUT IT BACK — one line, and it takes effect immediately:
-- UPDATE public.service_offerings SET pricing_basis = 'flat'
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND category = 'transport' AND name = 'Trip Charge';
-- ⚠️ Lauren can also flip it herself on Settings → Services, without SQL. This file exists so it
-- can be done today, not because it is the only way.
-- ════════════════════════════════════════════════════════════════════════════════════════════
