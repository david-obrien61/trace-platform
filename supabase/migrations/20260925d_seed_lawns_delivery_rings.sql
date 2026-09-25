-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925d — LAWNS'S FIVE DELIVERY RINGS · ledger #386
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- 🔴 THIS IS TENANT DATA, AND IT IS THE ONE EXCEPTION, STATED. `20260924f` deliberately seeds no
-- rings for anyone — radii are the tenant's, not the platform's. This file seeds LAWNS ALONE,
-- by their own business id, because David asked for their rings today and they come from HIS
-- numbers, not from a guess. No other tenant is touched and no default is created.
--
-- ── WHERE THE RADII COME FROM (David, 2026-09-16, re-confirmed 2026-09-25) ──────────────────
-- radius = charge ÷ $3.50 per loaded mile ÷ 2   (ROUND TRIP — his ruling; the platform shows
-- both readings beside every ring and never rules which one a loaded mile means).
--
--   Ring 1   $50  ÷ 3.50 ÷ 2 =  7.142…  →   7.1 mi     paper map ≈  7
--   Ring 2  $100  ÷ 3.50 ÷ 2 = 14.285…  →  14.3 mi     paper map ≈ 13
--   Ring 3  $150  ÷ 3.50 ÷ 2 = 21.428…  →  21.4 mi     paper map ≈ 20
--   Ring 4  $250  ÷ 3.50 ÷ 2 = 35.714…  →  35.7 mi     paper map ≈ 33
--   Ring 5  $300  ÷ 3.50 ÷ 2 = 42.857…  →  42.9 mi     paper map ≈ 48
--
-- ⚠️ THE PAPER READING IS CARRIED IN EVERY `origin_note`, INCLUDING WHERE IT DISAGREES. Rings 1–4
-- sit within a mile or two of Lauren's printed map; **ring 5 is 5 miles SHORT of hers (42.9 vs
-- ~48)**. That gap is not smoothed away and it is not averaged: it is written on the row so the
-- first person to open the screen sees it and can decide. A seeded number that quietly splits the
-- difference between two sources is the kind of figure nobody can ever check again.
--
-- 🔴 NOTHING HERE IS FINAL. Every row is editable in Settings → Delivery, and the note says
-- "adjust". These are a PROPOSAL from an arithmetic rule, not a decision about what LAWNS charges
-- — Lauren decides, and the note is what keeps those two apart on screen.
--
-- ⚠️ IDEMPOTENT BY RADIUS. `20260924f`'s unique index is (business_id, outer_radius_miles) WHERE
-- active, so a second run updates rather than duplicating. Re-pasting this file is safe.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO public.business_delivery_rings
  (business_id, outer_radius_miles, charge, origin_note, active)
VALUES
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74',  7.1,  50.00,
   'seeded from $3.50/loaded mile round trip, 2026-09-16 — adjust. Paper map ≈ 7 mi.', true),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 14.3, 100.00,
   'seeded from $3.50/loaded mile round trip, 2026-09-16 — adjust. Paper map ≈ 13 mi.', true),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 21.4, 150.00,
   'seeded from $3.50/loaded mile round trip, 2026-09-16 — adjust. Paper map ≈ 20 mi.', true),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 35.7, 250.00,
   'seeded from $3.50/loaded mile round trip, 2026-09-16 — adjust. Paper map ≈ 33 mi.', true),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 42.9, 300.00,
   'seeded from $3.50/loaded mile round trip, 2026-09-16 — adjust. PAPER MAP ≈ 48 mi — 5 miles further than this. Lauren''s map and the arithmetic disagree here; her map wins if she says so.', true)
ON CONFLICT (business_id, outer_radius_miles) WHERE active
DO UPDATE SET charge = EXCLUDED.charge, origin_note = EXCLUDED.origin_note, updated_at = now();

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · five rings, smallest first, with what each implies at $3.50 read BOTH ways.
--      EXPECT 5 rows: 7.1/$50 · 14.3/$100 · 21.4/$150 · 35.7/$250 · 42.9/$300.
-- SELECT outer_radius_miles AS out_to_miles, charge,
--        ROUND(charge / 3.50, 1)     AS implied_miles_one_way,
--        ROUND(charge / 3.50 / 2, 1) AS implied_miles_round_trip,
--        origin_note
--   FROM public.business_delivery_rings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND active
--  ORDER BY outer_radius_miles;
--
-- V2 · 🔴 NO OTHER TENANT GAINED A RING. EXPECT 0.
-- SELECT count(*) AS rings_for_anyone_else FROM public.business_delivery_rings
--  WHERE business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · every ring says where it came from, and none claims to be final. EXPECT 5, and 0.
-- SELECT count(*) FILTER (WHERE origin_note ILIKE '%seeded from%') AS say_where_they_came_from,
--        count(*) FILTER (WHERE origin_note IS NULL)               AS unexplained
--   FROM public.business_delivery_rings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND active;
