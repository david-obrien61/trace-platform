-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260924e — THE DELIVERY RINGS · ledger #386 · the address check ④
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David, 2026-09-23) ─────────────────────────────────────────────────────────────────
-- *"THE RING MAP IS THE KEY for delivery pricing."* A delivery charge is a fact about how far the
-- truck goes, and until now LAWNS has had no way to say that in the platform: "Trip Charge" is a
-- flat `service_offerings` row, the same price to the next street and to the next county.
--
-- 🔴 NOTHING HERE IS HARD-CODED, AND THE TABLE IS EMPTY ON PURPOSE. No migration seeds a ring for
-- anyone. The radii and the charges are the tenant's, proposed from their OWN delivery history in
-- the widget and then edited by a person — the same shape as `business_not_stock_items`
-- (2026-09-22), where seeding tenant rows from a migration was ruled wrong and removed.
--
-- WHAT THE SEED WILL PROPOSE, measured 2026-09-24 so the shape is known before the screen exists:
-- 566 trip-charge lines across 564 orders, 16 distinct amounts, and **403 of them — 71% — are
-- $50**. At the $3.50 loaded mile (round trip) David set on 2026-09-16 that is about 7 miles one
-- way, with the next steps at $100, $150 and $250. So the proposal is one ring and three steps,
-- not a gradient — and every one of them arrives marked "seeded from N invoices" and editable.
--
-- ⚠️ THE SEED IS NOT COMPLETE UNTIL THE ADDRESSES ARE GEOCODED. Deriving a radius from a CHARGE
-- assumes the rate held; deriving it from a DISTANCE measures what LAWNS actually did. Today 0 of
-- 1,486 addresses carry a coordinate, so the distance half does not exist yet. The widget must
-- show which of the two a proposed ring came from rather than presenting arithmetic as history.
--
-- ── BEYOND THE LAST RING: SHOW, DON'T PRICE (David, 2026-09-23) ─────────────────────────────
-- There is deliberately NO "default" or "everywhere else" ring, and no column for one. A stop
-- outside every ring gets no charge and a sentence — *"outside your delivery rings — set a
-- charge"* — because inventing a number for a place the owner has not priced is exactly the
-- guess that 2026-09-18 forbids.
--
-- ── RINGS ARE TENANT CONFIG: THEY SURVIVE THE WIPE AND RELOAD (David, 2026-09-16) ───────────
-- Nothing here keys on `import_run_id` and nothing is touched by `undo_import_run`. A reload
-- replaces the catalogue and the customers; what the owner decided about their own delivery area
-- is not import data and must still be there afterwards.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.business_delivery_rings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- The OUTER edge of this ring, in miles from the tenant's own located address. A ring covers
  -- everything nearer than this and further than the next-smallest ring — the bands are derived
  -- from the ordered radii, never stored as pairs, so two rings can never disagree about a gap.
  outer_radius_miles numeric(6,2) NOT NULL CHECK (outer_radius_miles > 0),
  charge            numeric(10,2) NOT NULL CHECK (charge >= 0),
  -- What the widget said when it proposed this ring, kept so a person can see where it came from:
  -- 'seeded from 403 invoices' · 'typed by Lauren' · NULL for a hand-added ring.
  origin_note       text,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_delivery_rings IS
  'Per-tenant delivery rings: outer radius in miles from the tenant''s own located address, and what that ring charges. EMPTY on arrival — no migration seeds a ring for anyone (David 2026-09-23: radii seeded from the tenant''s delivery history and edited in the widget; nothing hard-coded). Tenant CONFIG: survives a wipe and reload.';
COMMENT ON COLUMN public.business_delivery_rings.outer_radius_miles IS
  'Outer edge, in miles, one way from the depot. Bands are derived by ordering the radii — never stored as from/to pairs, so two rings cannot disagree about a gap between them.';
COMMENT ON COLUMN public.business_delivery_rings.charge IS
  'What a delivery inside this ring costs. 0 is legitimate (a free local ring) and is NOT the same as no ring: outside every ring there is no charge AND no price, and the screen says so.';
COMMENT ON COLUMN public.business_delivery_rings.origin_note IS
  'Where this ring came from, in words, for the person reading it — "seeded from 403 invoices" or "typed by Lauren". A proposal and a decision must not look alike.';

-- 🔴 ONE RING PER RADIUS PER BUSINESS. Two rings with the same outer edge is not a preference,
-- it is a question with two answers — and the one that wins would depend on row order.
CREATE UNIQUE INDEX IF NOT EXISTS business_delivery_rings_one_per_radius
  ON public.business_delivery_rings (business_id, outer_radius_miles)
  WHERE active;

ALTER TABLE public.business_delivery_rings ENABLE ROW LEVEL SECURITY;

-- Reuses the EXISTING settings strings — nothing new is minted (the §6 r21 / #228 lesson).
DROP POLICY IF EXISTS business_delivery_rings_member_select ON public.business_delivery_rings;
CREATE POLICY business_delivery_rings_member_select ON public.business_delivery_rings
  FOR SELECT USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:read'));

DROP POLICY IF EXISTS business_delivery_rings_member_write ON public.business_delivery_rings;
CREATE POLICY business_delivery_rings_member_write ON public.business_delivery_rings
  FOR ALL USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only, self-contained, no live counts pinned.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the table exists with its six columns. EXPECT 8 rows (6 named + created_at, updated_at).
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='business_delivery_rings' ORDER BY ordinal_position;
--
-- V2 · 🔴 IT IS EMPTY, FOR EVERY BUSINESS. No migration seeds a tenant's rings. EXPECT 0.
-- SELECT count(*) AS rings_seeded_by_this_migration FROM public.business_delivery_rings;
--
-- V3 · RLS is on and both policies reuse the existing settings strings — nothing minted.
--      EXPECT rls = true, and two policies checking settings:read and settings:update.
-- SELECT relrowsecurity AS rls FROM pg_class WHERE relname='business_delivery_rings';
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_delivery_rings' ORDER BY policyname;
--
-- V4 · 🔴 TWO RINGS CANNOT SHARE A RADIUS. Forced-rollback probe — it always rolls back.
--      EXPECT: 'OK — the second ring was refused', then the exception.
-- DO $probe$
-- DECLARE v_biz uuid;
-- BEGIN
--   SELECT id INTO v_biz FROM public.businesses LIMIT 1;
--   IF v_biz IS NULL THEN RAISE EXCEPTION 'ROLLED BACK — no business to probe with'; END IF;
--   INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge)
--   VALUES (v_biz, 7.10, 50.00);
--   BEGIN
--     INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge)
--     VALUES (v_biz, 7.10, 75.00);
--     RAISE EXCEPTION 'ROLLED BACK — 🔴 THE INDEX DID NOT REFUSE: one radius now has two charges';
--   EXCEPTION WHEN unique_violation THEN
--     RAISE NOTICE 'OK — the second ring was refused';
--   END;
--   RAISE EXCEPTION 'ROLLED BACK ON PURPOSE — this probe never keeps a ring';
-- END
-- $probe$;
--
-- V5 · a negative radius is refused. EXPECT: 'OK — refused', then the exception.
-- DO $probe$
-- DECLARE v_biz uuid;
-- BEGIN
--   SELECT id INTO v_biz FROM public.businesses LIMIT 1;
--   IF v_biz IS NULL THEN RAISE EXCEPTION 'ROLLED BACK — no business to probe with'; END IF;
--   BEGIN
--     INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge)
--     VALUES (v_biz, -1, 50.00);
--     RAISE EXCEPTION 'ROLLED BACK — 🔴 A NEGATIVE RADIUS WAS ACCEPTED';
--   EXCEPTION WHEN check_violation THEN
--     RAISE NOTICE 'OK — refused';
--   END;
--   RAISE EXCEPTION 'ROLLED BACK ON PURPOSE — this probe never keeps a ring';
-- END
-- $probe$;
