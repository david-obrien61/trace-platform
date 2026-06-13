-- Migration: THUNDER UNTANGLE — plants → cultivar_plants (identity-only join table)
-- Date: 2026-06-13
--
-- Settled model: LAWNS tracks LOTS (qty-of-SKU) via business_inventory.
-- plants' only surviving value is vertical IDENTITY (tag_id, species, container, zone, etc.).
-- Stock facts (status, arrived_at, base_price, install_price) move to business_inventory.
-- This is test-data-only — no data migration, no preserve step.
--
-- AC-1 compliance: cultivar_ prefix marks vertical identity join; no vertical nouns in shared schema.
-- nursery_id dropped (AC-1 violation — vertical noun as column, not a value).
-- inventory_id FK → business_inventory (nullable; lot population is a separate sequenced step).
--
-- Run in bgobkjcopcxusjsetfob SQL editor.
-- ⚠️ NOTE: The existing plants table has no committed CREATE TABLE migration — it predates
-- the migrations directory. This migration operates on the live table in place.
--
-- After running, verify with the queries at the bottom of this file.

-- ── STEP 1: Rename table ─────────────────────────────────────────────────────
-- Postgres automatically updates FK constraints from other tables (order_items.plant_id)
-- to point to the renamed table. No manual FK updates needed.

ALTER TABLE plants RENAME TO cultivar_plants;

-- ── STEP 2: Drop old RLS policy that references nursery_id ───────────────────
-- Must drop before dropping nursery_id, or Postgres will error on column-in-use.

DROP POLICY IF EXISTS "authenticated_select_plants" ON cultivar_plants;

-- ── STEP 3: Replace with business_id-scoped policy (AC-2 compliant) ──────────
-- Matches the membership-scoped pattern used on business_assets / business_inventory.
-- Two paths: owner (businesses.owner_id = auth.uid()) OR member (business_members).

CREATE POLICY "cultivar_plants_owner_select"
  ON cultivar_plants
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = cultivar_plants.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

-- anon_select_plants (USING(true)) stays — QR scan is unauthenticated. No change needed.

-- ── STEP 4: Add inventory_id FK (nullable — lot population is sequenced after) ──

ALTER TABLE cultivar_plants
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL;

-- ── STEP 5: Drop AC-1 violation column ───────────────────────────────────────

ALTER TABLE cultivar_plants DROP COLUMN IF EXISTS nursery_id;

-- ── STEP 6: Drop stock-fact columns (belong on business_inventory) ────────────

ALTER TABLE cultivar_plants DROP COLUMN IF EXISTS status;
ALTER TABLE cultivar_plants DROP COLUMN IF EXISTS arrived_at;
ALTER TABLE cultivar_plants DROP COLUMN IF EXISTS base_price;
ALTER TABLE cultivar_plants DROP COLUMN IF EXISTS install_price;

-- ── STEP 7: Drop cost_price if it exists (should not; confirmed absent in VERIFY doc) ──
-- Included defensively — IF EXISTS is a no-op if the column doesn't exist.

ALTER TABLE cultivar_plants DROP COLUMN IF EXISTS cost_price;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-RUN VERIFICATION QUERIES (run these in the Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- C1: cultivar_plants exists, plants is gone
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('cultivar_plants', 'plants');
-- EXPECTED: 1 row → cultivar_plants only

-- C2: RLS enabled on cultivar_plants
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'cultivar_plants';
-- EXPECTED: rowsecurity = true

-- C3: Policies attached to cultivar_plants
-- SELECT policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'cultivar_plants';
-- EXPECTED: anon_select_plants (SELECT, {anon}) + cultivar_plants_owner_select (SELECT, {authenticated})

-- C4: inventory_id FK present; nursery_id + stock-fact cols absent; identity cols intact
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'cultivar_plants'
-- ORDER BY ordinal_position;
-- EXPECTED PRESENT:  id, business_id, inventory_id, tag_id, species, common_name, plant_type,
--                    current_container, location_zone, warranty_months, photo_url, notes,
--                    created_at, updated_at
-- EXPECTED ABSENT:   nursery_id, status, arrived_at, base_price, install_price

-- C5: inventory_id FK constraint exists
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_schema = 'public' AND table_name = 'cultivar_plants'
--   AND constraint_type = 'FOREIGN KEY';
-- EXPECTED: FK constraint referencing business_inventory(id)

-- C6: order_items.plant_id FK still resolves (Postgres auto-updated on rename)
-- SELECT constraint_name, table_name, foreign_table_name
-- FROM information_schema.referential_constraints rc
-- JOIN information_schema.table_constraints tc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'order_items';
-- EXPECTED: FK from order_items pointing at cultivar_plants
