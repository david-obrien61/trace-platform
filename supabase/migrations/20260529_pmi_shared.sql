-- Migration: Shared PMI (Preventive Maintenance)
-- Works identically for every vertical — tools, farm equipment, HVAC units, vehicles.
-- Tenant anchor: business_id (references businesses table).

CREATE TABLE IF NOT EXISTS pmi_assets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  asset_type        text,
  make              text,
  model             text,
  serial_number     text,
  year              int,
  pmi_interval_days int,
  last_service_at   timestamptz,
  notes             text,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pmi_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY pmi_assets_owner ON pmi_assets
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS pmi_service_logs (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid          NOT NULL REFERENCES pmi_assets(id) ON DELETE CASCADE,
  business_id   uuid          NOT NULL REFERENCES businesses(id),
  service_type  text          NOT NULL,
  performed_by  text,
  notes         text,
  cost          numeric(10,2),
  performed_at  timestamptz   NOT NULL DEFAULT now(),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE pmi_service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pmi_service_logs_owner ON pmi_service_logs
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS pmi_assets_business_idx     ON pmi_assets     (business_id, is_active);
CREATE INDEX IF NOT EXISTS pmi_service_logs_asset_idx  ON pmi_service_logs (asset_id, performed_at DESC);
