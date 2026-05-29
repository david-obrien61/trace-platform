-- Migration D: Update RLS on all operational tables to use business_id
-- Run AFTER migration C. Brief downtime expected — run at low-traffic time.

-- plants
DROP POLICY IF EXISTS authenticated_select_plants ON plants;
DROP POLICY IF EXISTS plants_owner ON plants;
DROP POLICY IF EXISTS plants_business_owner ON plants;
CREATE POLICY plants_business_owner ON plants FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- orders
DROP POLICY IF EXISTS authenticated_select_orders ON orders;
DROP POLICY IF EXISTS orders_owner ON orders;
DROP POLICY IF EXISTS orders_business_owner ON orders;
CREATE POLICY orders_business_owner ON orders FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- addons
DROP POLICY IF EXISTS authenticated_select_addons ON addons;
DROP POLICY IF EXISTS addons_owner ON addons;
DROP POLICY IF EXISTS addons_business_owner ON addons;
CREATE POLICY addons_business_owner ON addons FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- customers
DROP POLICY IF EXISTS authenticated_select_customers ON customers;
DROP POLICY IF EXISTS customers_owner ON customers;
DROP POLICY IF EXISTS customers_business_owner ON customers;
CREATE POLICY customers_business_owner ON customers FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- plant_events
DROP POLICY IF EXISTS authenticated_select_plant_events ON plant_events;
DROP POLICY IF EXISTS plant_events_owner ON plant_events;
DROP POLICY IF EXISTS plant_events_business_owner ON plant_events;
CREATE POLICY plant_events_business_owner ON plant_events FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- social_drafts
DROP POLICY IF EXISTS authenticated_select_social_drafts ON social_drafts;
DROP POLICY IF EXISTS social_drafts_owner ON social_drafts;
DROP POLICY IF EXISTS social_drafts_business_owner ON social_drafts;
CREATE POLICY social_drafts_business_owner ON social_drafts FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- nursery_modules
DROP POLICY IF EXISTS authenticated_select_nursery_modules ON nursery_modules;
DROP POLICY IF EXISTS nursery_modules_owner ON nursery_modules;
DROP POLICY IF EXISTS nursery_modules_business_owner ON nursery_modules;
CREATE POLICY nursery_modules_business_owner ON nursery_modules FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Add unique index on (business_id, module_key) so social/enable.ts upsert works
-- The old unique constraint was on (nursery_id, module_key); this replaces it.
CREATE UNIQUE INDEX IF NOT EXISTS nursery_modules_business_module_key
  ON nursery_modules (business_id, module_key);
