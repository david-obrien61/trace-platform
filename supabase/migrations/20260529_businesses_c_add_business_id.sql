-- Migration C: Migrate LAWNS data, add business_id to all operational tables
-- IMPORTANT: Run migrations A and B first.
-- businesses.id = nurseries.id (same UUID) — backfill is safe.

-- Step 1: Copy LAWNS nursery row into businesses
INSERT INTO businesses (
  id, owner_id, name, phone, address, email, website, logo_url, tax_rate,
  business_type,
  accounting_type, accounting_token, accounting_refresh_token,
  accounting_token_expires_at, accounting_needs_reconnect, accounting_company_id,
  trial_started_at, created_at
)
SELECT
  id, owner_id, name, phone, address, email, website, logo_url, tax_rate,
  'nursery',
  CASE WHEN qb_realm_id IS NOT NULL THEN 'quickbooks' ELSE NULL END,
  qb_access_token, qb_refresh_token,
  qb_token_expires_at, qb_needs_reconnect, qb_realm_id,
  created_at, created_at
FROM nurseries
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create nursery_profile for each nursery
INSERT INTO nursery_profiles (business_id)
SELECT id FROM businesses WHERE business_type = 'nursery'
ON CONFLICT DO NOTHING;

-- Step 3: Seed netting as an opportunity_item for each nursery
INSERT INTO opportunity_items (business_id, name, description, price, is_active, sort_order)
SELECT id, 'Netting', 'Protective netting for trees', 10.00, true, 0
FROM businesses WHERE business_type = 'nursery'
ON CONFLICT DO NOTHING;

-- Step 4: Add business_id columns (nullable first for backfill)
ALTER TABLE plants          ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE plant_events    ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE addons          ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE customers       ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE orders          ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE social_drafts   ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE nursery_modules ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);

-- Step 5: Backfill from nursery_id (same UUID as businesses.id)
UPDATE plants        SET business_id = nursery_id WHERE business_id IS NULL;
UPDATE addons        SET business_id = nursery_id WHERE business_id IS NULL;
UPDATE customers     SET business_id = nursery_id WHERE business_id IS NULL;
UPDATE orders        SET business_id = nursery_id WHERE business_id IS NULL;
UPDATE nursery_modules SET business_id = nursery_id WHERE business_id IS NULL;

-- plant_events has no direct nursery_id — derive from plant
UPDATE plant_events pe
SET business_id = p.nursery_id
FROM plants p
WHERE pe.plant_id = p.id AND pe.business_id IS NULL;

-- social_drafts derive from order
UPDATE social_drafts sd
SET business_id = o.nursery_id
FROM orders o
WHERE sd.order_id = o.id AND sd.business_id IS NULL;

-- Step 6: Make business_id NOT NULL
ALTER TABLE plants          ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE plant_events    ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE addons          ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE customers       ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE orders          ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE social_drafts   ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE nursery_modules ALTER COLUMN business_id SET NOT NULL;
