-- ============================================================
-- Migration: business_assets / business_inventory /
--            business_pmi_schedule / business_service_log
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- AC-1: no vertical nouns — business_ prefix only
-- Date: 2026-06-12 (verified via `date` command — clock is not drifted)
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without
--     David's explicit "run it" approval.
-- ============================================================
-- Pre-write verify (completed before writing):
--   business_assets         → 404 (ABSENT ✅)
--   business_inventory      → 404 (ABSENT ✅)
--   business_pmi_schedule   → 404 (ABSENT ✅)
--   business_service_log    → 404 (ABSENT ✅)
--   businesses              → 200 (PRESENT ✅)  FK target + owner_id RLS target
--   business_members        → 200 (PRESENT ✅)  business_id/user_id/active confirmed
--   receipts                → 200 (PRESENT ✅)  FK target for service_log.receipt_id
-- ============================================================


-- ============================================================
-- TABLE 1: business_assets
-- The asset itself (tools, equipment, vehicles, structures, etc.)
-- AC-1: no vertical nouns; vertical-specific columns go to
--       cultivar_/ or ignition_/ extension tables later.
-- ============================================================
CREATE TABLE business_assets (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              text         NOT NULL,
  asset_type        text,
  make              text,
  model             text,
  serial_number     text,
  year              int,
  barcode_id        text,
  assigned_to       jsonb,
  status            text         NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','IN_REPAIR','OFFLINE','RETIRED')),
  acquisition_cost  numeric(10,2),
  warranty_months   int,
  photo_url         text,
  notes             text,
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE business_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_assets_owner_all ON business_assets
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_assets.business_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_assets.business_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY business_assets_member_all ON business_assets
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_assets.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_assets.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

-- updated_at trigger — reuses set_updated_at_generic() created in 20260604_business_modules.sql
DROP TRIGGER IF EXISTS business_assets_updated_at ON business_assets;
CREATE TRIGGER business_assets_updated_at
  BEFORE UPDATE ON business_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();


-- ============================================================
-- TABLE 2: business_inventory
-- Stock items at SKU+qty grain.
-- serial_number is nullable here; set on install-event transfer.
-- ============================================================
CREATE TABLE business_inventory (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sku           text,
  name          text         NOT NULL,
  description   text,
  qty           int          NOT NULL DEFAULT 0,
  unit_cost     numeric(10,2),
  serial_number text,
  location      text,
  status        text         NOT NULL DEFAULT 'available',
  received_at   timestamptz,
  photo_url     text,
  notes         text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE business_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_inventory_owner_all ON business_inventory
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_inventory.business_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_inventory.business_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY business_inventory_member_all ON business_inventory
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_inventory.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_inventory.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

DROP TRIGGER IF EXISTS business_inventory_updated_at ON business_inventory;
CREATE TRIGGER business_inventory_updated_at
  BEFORE UPDATE ON business_inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();


-- ============================================================
-- TABLE 3: business_pmi_schedule
-- Maintenance PLAN: optional, one per asset.
-- last_service_at is denormalized from the latest service_log row
-- for fast "overdue?" queries — updated by application on log insert.
-- ============================================================
CREATE TABLE business_pmi_schedule (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  asset_id        uuid         NOT NULL REFERENCES business_assets(id) ON DELETE CASCADE,
  interval_days   int,
  tasks           jsonb        NOT NULL DEFAULT '[]',
  overrides       jsonb        NOT NULL DEFAULT '[]',
  last_service_at timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE business_pmi_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_pmi_schedule_owner_all ON business_pmi_schedule
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_pmi_schedule.business_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_pmi_schedule.business_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY business_pmi_schedule_member_all ON business_pmi_schedule
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_pmi_schedule.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_pmi_schedule.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

DROP TRIGGER IF EXISTS business_pmi_schedule_updated_at ON business_pmi_schedule;
CREATE TRIGGER business_pmi_schedule_updated_at
  BEFORE UPDATE ON business_pmi_schedule
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();


-- ============================================================
-- TABLE 4: business_service_log
-- Service EVENTS that carry cost. Append-only ledger.
-- receipt_id is the COUNT-ONCE dedup seam (Cost-to-Produce design):
--   PRESENT  → receipt is authoritative; this cost field is a draft/estimate.
--   ABSENT   → this cost field stands as the authoritative figure.
-- No updated_at column — service log rows are immutable once written;
-- corrections create new rows. No trigger needed.
-- ============================================================
CREATE TABLE business_service_log (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  asset_id      uuid         NOT NULL REFERENCES business_assets(id) ON DELETE CASCADE,
  service_type  text         NOT NULL,
  performed_by  text,
  performed_at  timestamptz  NOT NULL DEFAULT now(),
  cost          numeric(10,2),
  receipt_id    uuid         REFERENCES receipts(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE business_service_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_service_log_owner_all ON business_service_log
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_service_log.business_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_service_log.business_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY business_service_log_member_all ON business_service_log
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_service_log.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_service_log.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

-- ============================================================
-- END OF MIGRATION
-- Run verification after applying:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'business_assets','business_inventory',
--       'business_pmi_schedule','business_service_log'
--     );
-- Expected: 4 rows returned.
-- ============================================================
