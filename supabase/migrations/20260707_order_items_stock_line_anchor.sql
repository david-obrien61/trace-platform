-- ── order_items STOCK-LINE anchor (D-34) ───────────────────────────────────────
-- Decision: docs/DECISIONS.md D-34 ("the lot is the SKU") · spec
--   docs/decisions/2026-07-07-inventory-sale-pipeline-buildspec.md item 2 (2c) · CLOSE-OUT M2
--
-- D-34 anchors purchase to the business_inventory STOCK LINE, not a per-specimen
-- cultivar_plants row. The 114-row discovery catalog lives in business_inventory with
-- ZERO cultivar_plants rows, so an order line must be able to reference the lot. This
-- adds that anchor and relaxes the specimen anchor to nullable, so ONE order line points
-- at exactly ONE of: business_inventory_id (stock line) OR plant_id (specimen), never both.
-- Chosen over the expedient "mint a cultivar_plants row on demand," which would re-
-- introduce the per-specimen rows D-34 abandoned.
--
-- ⚠️ order_items is LIVE-ONLY (tech-debt #39 — no prior migration in version control).
--    This migration was authored FROM the live schema map
--    (docs/decisions/2026-07-07-live-schema-map.md §order_items): columns id, order_id
--    (FK→orders), plant_id (FK→cultivar_plants), quantity, unit_price, subtotal.
--
-- ⚠️ DAVID APPLIES AS postgres (project bgobkjcopcxusjsetfob). The schema-verification
--    gate (CLAUDE.md §9) runs AFTER apply — verify queries (A)-(C) embedded below.
--    Then confirm before the code that writes business_inventory_id is deployed.
--
-- Append-only + additive + lossless: ONE NULLABLE FK column added, the existing plant_id
-- relaxed to nullable. No data rewritten (order_items is empty live — 0 rows). Inherits
-- order_items' existing RLS unchanged — no policy change.

-- (1) The stock-line anchor — nullable FK → business_inventory. SET NULL on lot delete so
--     an order line survives inventory cleanup (mirrors cultivar_plants.inventory_id).
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL;

-- (2) Relax the specimen anchor to nullable, so a stock-line line can leave plant_id NULL.
--     Safe no-op if plant_id is already nullable (live nullability could not be introspected
--     locally — the .env holds empty placeholders; David's verify (B) confirms the final state).
ALTER TABLE order_items
  ALTER COLUMN plant_id DROP NOT NULL;

-- ── VERIFY (David runs after apply — catalog-backed, not from memory) ───────────────
-- (A) business_inventory_id exists, uuid, nullable:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'order_items' AND column_name = 'business_inventory_id';
--   → 1 row; uuid; is_nullable 'YES'.
--
-- (B) plant_id is now nullable (both anchors nullable → one-of enforced in app code):
--   SELECT column_name, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'order_items' AND column_name IN ('plant_id','business_inventory_id')
--   ORDER BY column_name;
--   → both is_nullable 'YES'.
--
-- (C) business_inventory_id FK targets business_inventory(id) ON DELETE SET NULL:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'order_items'::regclass AND contype = 'f'
--     AND pg_get_constraintdef(oid) ILIKE '%business_inventory%';
--   → 1 row; REFERENCES business_inventory(id) ON DELETE SET NULL.
