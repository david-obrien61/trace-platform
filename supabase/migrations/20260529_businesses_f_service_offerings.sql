-- Migration F: service_offerings + order_service_selections
-- Replaces the rigid transport_method enum + addons table + opportunity_items
-- with a single universal service catalog per business.
--
-- Every service a business offers at any point in the customer journey
-- lives here: transport options, add-ons, maintenance plans, subscriptions.
-- Works identically for nurseries, HVAC shops, auto shops, and any future vertical.

-- ── service_offerings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_offerings (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  description            text,

  -- What kind of service this is
  category               text        NOT NULL
    CHECK (category IN ('transport', 'addon', 'maintenance', 'inspection', 'subscription')),

  -- When it appears in the customer journey
  timing                 text        NOT NULL DEFAULT 'at_checkout'
    CHECK (timing IN ('at_checkout', 'post_purchase', 'recurring')),

  -- How the price is calculated
  price_type             text        NOT NULL DEFAULT 'per_unit'
    CHECK (price_type IN ('flat', 'per_unit')),

  -- What one "unit" is (plant, vehicle, visit, or whole order)
  price_unit             text        NOT NULL DEFAULT 'plant'
    CHECK (price_unit IN ('order', 'plant', 'vehicle', 'visit')),

  price                  numeric(10,2) NOT NULL DEFAULT 0,

  -- Only meaningful when category = 'transport':
  -- 'self'  = customer provides own transport (triggers netting prompt for nurseries)
  -- 'staff' = business provides transport
  transport_mode         text        CHECK (transport_mode IN ('self', 'staff')),

  -- For addons: only show this offering when the selected transport has this mode
  trigger_transport_mode text        CHECK (trigger_transport_mode IN ('self', 'staff')),

  -- Only meaningful when timing = 'recurring'
  recurrence_days        int,

  -- Delivery and install services need a destination address
  requires_address       boolean     NOT NULL DEFAULT false,

  -- Whether this offering is pre-selected in the UI
  pre_selected           boolean     NOT NULL DEFAULT true,

  is_active              boolean     NOT NULL DEFAULT true,
  sort_order             int         NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_offerings_owner ON service_offerings
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ── order_service_selections ─────────────────────────────────────────────────
-- Records which service offerings were selected (or declined) on each order.
-- Replaces order_addons for new orders. order_addons is kept for historical data.
CREATE TABLE IF NOT EXISTS order_service_selections (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_offering_id  uuid          NOT NULL REFERENCES service_offerings(id),
  quantity             int           NOT NULL DEFAULT 1,
  unit_price_at_time   numeric(10,2) NOT NULL,  -- snapshot: price won't change historical records
  subtotal             numeric(10,2) NOT NULL,
  created_at           timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE order_service_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_service_selections_owner ON order_service_selections
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    )
  );

-- ── Seed LAWNS Tree Farm service offerings ───────────────────────────────────
-- Transport options (replace the transport_method enum)
INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   transport_mode, requires_address, pre_selected, is_active, sort_order)
SELECT
  id,
  'Pick up myself',
  'Take it home today — netting required for large containers',
  'transport', 'at_checkout', 'flat', 'order', 0.00,
  'self', false, true, true, 0
FROM businesses WHERE business_type = 'nursery';

INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   transport_mode, requires_address, pre_selected, is_active, sort_order)
SELECT
  id,
  'We deliver',
  'We bring it to your property',
  'transport', 'at_checkout', 'flat', 'order', 0.00,
  'staff', true, false, true, 1
FROM businesses WHERE business_type = 'nursery';

INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   transport_mode, requires_address, pre_selected, is_active, sort_order)
SELECT
  id,
  'We deliver and plant',
  'Full planting service — we dig it in for you',
  'transport', 'at_checkout', 'per_unit', 'plant', 225.00,
  'staff', true, false, true, 2
FROM businesses WHERE business_type = 'nursery';

-- Add-on: netting (only shown when self-transport is selected)
INSERT INTO service_offerings
  (business_id, name, description, category, timing, price_type, price_unit, price,
   trigger_transport_mode, requires_address, pre_selected, is_active, sort_order)
SELECT
  id,
  'Travel netting',
  'Protective netting for trees in transit (Texas TCC Ch.725)',
  'addon', 'at_checkout', 'per_unit', 'plant', 10.00,
  'self', false, true, true, 10
FROM businesses WHERE business_type = 'nursery';
