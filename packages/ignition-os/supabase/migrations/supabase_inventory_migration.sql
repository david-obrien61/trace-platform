-- supabase_inventory_migration.sql
CREATE TABLE IF NOT EXISTS inventory (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  part_number  text,
  name         text NOT NULL,
  description  text,
  qty          integer NOT NULL DEFAULT 0,
  bin_location text,
  unit_cost    numeric(10,2),
  fits_codes   text[],        -- DTC/fault codes this part covers
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_shop_idx    ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS inventory_partnum_idx ON inventory(shop_id, part_number);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_inventory" ON inventory;
CREATE POLICY "pilot_all_inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
