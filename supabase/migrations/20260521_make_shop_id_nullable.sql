-- cultivar-os customers have no shop_id (Ignition OS concept).
-- RLS keeps tenants separate, so this is safe.
ALTER TABLE customers ALTER COLUMN shop_id DROP NOT NULL;
