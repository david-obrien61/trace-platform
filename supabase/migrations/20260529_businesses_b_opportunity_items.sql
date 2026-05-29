-- Migration B: Create opportunity_items table
-- Generic add-on/upsell catalog replacing hardcoded netting_price

CREATE TABLE IF NOT EXISTS opportunity_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  price       numeric(10,2) NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE opportunity_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY opportunity_items_owner ON opportunity_items
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
