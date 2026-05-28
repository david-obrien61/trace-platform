-- Migration: Track 1.5 — per-tenant RLS isolation for all Cultivar OS tenant tables
-- Date: 2026-05-28
--
-- Replaces all USING(true) authenticated SELECT policies with owner_id-scoped expressions.
-- Adds policies for the four previously-unverified tables (nurseries, plants, plant_events, addons).
-- Adds child-table policies for order_items and order_addons (join through orders).
--
-- Public-route exception: plants, plant_events, addons are also readable by anon because the
-- QR checkout flow is unauthenticated. Explicit anon USING(true) policies are added for these
-- three tables only.
--
-- Writes go through the service key (bypasses RLS). These policies guard frontend reads only.
-- modules is unchanged — it is a platform catalog with no nursery_id (USING(true) is correct).
--
-- Run in Supabase SQL editor (bgobkjcopcxusjsetfob) before the next cross-tenant onboarding.
-- This migration is safe to re-run (all CREATE POLICY statements are preceded by DROP IF EXISTS).

-- ── nurseries ─────────────────────────────────────────────────────────────────
-- NurseryProvider resolves uid → nursery post-login; useModules reads by id after resolution.
-- Both calls are authenticated and scoped to the current user's row.

ALTER TABLE nurseries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_nurseries" ON nurseries;
CREATE POLICY "authenticated_select_nurseries"
  ON nurseries
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- ── plants ────────────────────────────────────────────────────────────────────
-- anon: usePlant reads by tag_id on the public /plant/:tagId route.
-- authenticated: dashboard inventory tile + species count query.

ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_plants" ON plants;
CREATE POLICY "anon_select_plants"
  ON plants
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "authenticated_select_plants" ON plants;
CREATE POLICY "authenticated_select_plants"
  ON plants
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));

-- ── plant_events ──────────────────────────────────────────────────────────────
-- anon: growth timeline rendered on the public plant profile page.
-- authenticated: (future) event history in the owner dashboard.

ALTER TABLE plant_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_plant_events" ON plant_events;
CREATE POLICY "anon_select_plant_events"
  ON plant_events
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "authenticated_select_plant_events" ON plant_events;
CREATE POLICY "authenticated_select_plant_events"
  ON plant_events
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));

-- ── addons ────────────────────────────────────────────────────────────────────
-- anon: useAddons fetches addons for the nursery during public QR checkout.
-- authenticated: (future) addon management in the owner dashboard.

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_addons" ON addons;
CREATE POLICY "anon_select_addons"
  ON addons
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "authenticated_select_addons" ON addons;
CREATE POLICY "authenticated_select_addons"
  ON addons
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));

-- ── customers ─────────────────────────────────────────────────────────────────

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_customers" ON customers;
CREATE POLICY "authenticated_select_customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));

-- ── orders ────────────────────────────────────────────────────────────────────
-- Replaces the USING(true) policy written in 20260527_orders_authenticated_select_policy.sql.
-- RLS is already enabled on this table.

DROP POLICY IF EXISTS "authenticated_select_orders" ON orders;
CREATE POLICY "authenticated_select_orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));

-- ── order_items ───────────────────────────────────────────────────────────────
-- No nursery_id column; join through orders.
-- Only written by the service-key API. Frontend does not yet read order_items directly.

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_order_items" ON order_items;
CREATE POLICY "authenticated_select_order_items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid())
    )
  );

-- ── order_addons ──────────────────────────────────────────────────────────────
-- No nursery_id column; join through orders.

ALTER TABLE order_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_order_addons" ON order_addons;
CREATE POLICY "authenticated_select_order_addons"
  ON order_addons
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid())
    )
  );

-- ── nursery_modules ───────────────────────────────────────────────────────────
-- Replaces the USING(true) policy from 20260522_rls_modules_nursery_modules.sql.
-- RLS is already enabled on this table.

DROP POLICY IF EXISTS "authenticated_select_nursery_modules" ON nursery_modules;
CREATE POLICY "authenticated_select_nursery_modules"
  ON nursery_modules
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));

-- ── social_drafts ─────────────────────────────────────────────────────────────
-- Replaces the USING(true) policy from 20260522_social_drafts_rls.sql.
-- RLS is already enabled on this table.

DROP POLICY IF EXISTS "authenticated_select_social_drafts" ON social_drafts;
CREATE POLICY "authenticated_select_social_drafts"
  ON social_drafts
  FOR SELECT
  TO authenticated
  USING (nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid()));
