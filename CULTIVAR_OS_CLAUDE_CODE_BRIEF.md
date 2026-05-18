# CULTIVAR OS — Claude Code Build Brief
**Read this file at the start of every Claude Code session.**
**Project:** cultivar-os — Nursery SaaS Platform
**Domain:** cultivar-os.app
**Builder:** David OBrien (solo)
**Demo deadline:** ~May 25, 2026 — LAWNS Tree Farm LLC, Leander TX
**Stack:** React + Vite · Supabase · FastAPI · Vercel · Stripe · QuickBooks Online API

---

## HOW TO USE THIS FILE

Paste this at the start of every Claude Code session in VS Code:

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.

Current session: [SESSION NUMBER from the schedule below]
Today's goal: [copy the goal from that session]

Rules:
- Follow the folder structure exactly as defined in the brief
- All shared code goes in packages/shared/ — never duplicate
- Do not modify packages/ignition-os
- Ask before making any schema changes not in the brief
- Commit after every completed task: git add . && git commit -m "description"
```

---

## DEMO REQUIREMENTS (non-negotiable for May 25)

These 6 things must work on a real URL before the meeting:

1. **QR scan → plant profile page** — cultivar-os.app/plant/SCV-0031 loads Shoal Creek Vitex with real data
2. **Quantity selector** — customer picks how many trees
3. **Add-ons screen** — netting ($20 total, pre-checked when transport=self), compost ($28/tree), fertilizer ($18/tree)
4. **Customer capture** — name, email (required), phone, address (optional)
5. **Invoice creation** — appears in QuickBooks Online sandbox automatically on checkout
6. **Owner dashboard** — Layna logs in, sees today's sales, inventory count, live value

Everything else is Phase 1. Do not build Phase 1 features during demo week.

---

## FOLDER STRUCTURE

```
trace-platform/
├── MASTER_BRIEF.md
├── CULTIVAR_OS_CLAUDE_CODE_BRIEF.md        ← this file
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts              ← Supabase client singleton
│   │   │   │   ├── auth.ts                ← login, session, role check
│   │   │   │   └── types.ts               ← shared DB types
│   │   │   ├── stripe/
│   │   │   │   ├── billing.ts             ← subscription creation
│   │   │   │   └── trial.ts               ← trial clock, data blur trigger
│   │   │   ├── quickbooks/
│   │   │   │   ├── oauth.ts               ← QB OAuth 2.0 flow
│   │   │   │   ├── invoice.ts             ← create/update QB invoice
│   │   │   │   └── customer.ts            ← create/find QB customer
│   │   │   ├── qr/
│   │   │   │   ├── generate.ts            ← QR code generation (qrcode.js)
│   │   │   │   └── print.ts               ← Zebra ZPL label format
│   │   │   ├── notifications/
│   │   │   │   ├── sms.ts                 ← Twilio SMS
│   │   │   │   └── email.ts               ← Resend email
│   │   │   └── components/
│   │   │       ├── Button.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Card.tsx
│   │   │       └── LoadingSpinner.tsx
│   │
│   └── cultivar-os/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── .env.local                     ← never commit this
│       ├── .env.example                   ← commit this, no real values
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── router.tsx                 ← React Router v6 routes
│       │   │
│       │   ├── lib/
│       │   │   ├── supabase.ts            ← imports from shared
│       │   │   └── constants.ts           ← TAX_RATE, ADDON_PRICES, etc
│       │   │
│       │   ├── types/
│       │   │   ├── plant.ts
│       │   │   ├── customer.ts
│       │   │   ├── order.ts
│       │   │   └── nursery.ts
│       │   │
│       │   ├── hooks/
│       │   │   ├── usePlant.ts            ← fetch plant by QR tag
│       │   │   ├── useCart.ts             ← cart state management
│       │   │   ├── useNursery.ts          ← nursery config
│       │   │   └── useAuth.ts             ← owner/staff session
│       │   │
│       │   ├── pages/
│       │   │   ├── PlantProfile.tsx       ← PUBLIC: /plant/:tagId
│       │   │   ├── AddOns.tsx             ← PUBLIC: /plant/:tagId/addons
│       │   │   ├── CustomerCapture.tsx    ← PUBLIC: /checkout/customer
│       │   │   ├── CartReview.tsx         ← PUBLIC: /checkout/review
│       │   │   ├── Confirmation.tsx       ← PUBLIC: /checkout/confirm
│       │   │   ├── Dashboard.tsx          ← PRIVATE: /dashboard
│       │   │   ├── Inventory.tsx          ← PRIVATE: /dashboard/inventory
│       │   │   ├── Schedule.tsx           ← PRIVATE: /dashboard/schedule
│       │   │   ├── Losses.tsx             ← PRIVATE: /dashboard/losses
│       │   │   └── Login.tsx              ← PRIVATE: /login
│       │   │
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── NavBar.tsx
│       │   │   │   └── PrivateRoute.tsx
│       │   │   ├── plant/
│       │   │   │   ├── PlantHero.tsx      ← species, size, price, journey
│       │   │   │   ├── PlantTimeline.tsx  ← container progression history
│       │   │   │   └── PlantCard.tsx      ← inventory list item
│       │   │   ├── checkout/
│       │   │   │   ├── QtySelector.tsx
│       │   │   │   ├── AddonCard.tsx      ← toggleable add-on item
│       │   │   │   ├── NettingPrompt.tsx  ← triggered by transport=self
│       │   │   │   ├── CartLine.tsx
│       │   │   │   └── TransportToggle.tsx
│       │   │   └── dashboard/
│       │   │       ├── MetricCard.tsx
│       │   │       ├── SaleRow.tsx
│       │   │       └── LeakageAlert.tsx   ← "3 sales with no add-ons"
│       │   │
│       │   └── styles/
│       │       └── globals.css
│       │
│       └── api/                           ← FastAPI backend (Railway)
│           ├── main.py
│           ├── requirements.txt
│           ├── routers/
│           │   ├── plants.py              ← GET /plant/:tagId
│           │   ├── orders.py              ← POST /order, GET /orders
│           │   ├── customers.py           ← POST /customer
│           │   ├── quickbooks.py          ← QB OAuth + invoice creation
│           │   └── qr.py                  ← QR generation + bulk print
│           └── lib/
│               ├── supabase.py
│               ├── qb_client.py
│               └── notifications.py
```

---

## DATABASE SCHEMA (Supabase PostgreSQL)

Run this SQL in the Supabase SQL editor. Create a new Supabase project named "cultivar-os".

```sql
-- ============================================================
-- NURSERIES (multi-tenant root)
-- ============================================================
CREATE TABLE nurseries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  address         text,
  phone           text,
  email           text,
  website         text,
  logo_url        text,
  qb_realm_id     text,           -- QuickBooks company ID
  qb_access_token text,           -- encrypted, refresh on expiry
  qb_refresh_token text,
  tax_rate        numeric DEFAULT 0.0825,  -- 8.25% Texas default
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- EMPLOYEES (nursery staff + owner)
-- ============================================================
CREATE TABLE employees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id  uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text UNIQUE NOT NULL,
  role        text CHECK (role IN ('owner','manager','staff')) DEFAULT 'staff',
  pin_hash    text,               -- SHA-256 hashed PIN for kiosk login
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- PLANTS (core table — every QR tag maps to one row)
-- ============================================================
CREATE TABLE plants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  tag_id          text UNIQUE NOT NULL,   -- e.g. SCV-0031, NCM-0042
  species         text NOT NULL,          -- e.g. "Shoal Creek Vitex"
  common_name     text,
  plant_type      text CHECK (plant_type IN ('tree','shrub','perennial','annual','garden')) DEFAULT 'tree',
  current_container text,                 -- e.g. "30 gal", "15 gal", "4 in"
  location_zone   text,                   -- nursery zone/row
  status          text CHECK (status IN ('available','reserved','sold','lost','donated')) DEFAULT 'available',
  base_price      numeric NOT NULL,       -- plant only price
  install_price   numeric DEFAULT 0,      -- installation labor
  warranty_months integer DEFAULT 12,
  arrived_at      date,                   -- when plant came to nursery
  photo_url       text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- PLANT EVENTS (full lifecycle history per plant)
-- ============================================================
CREATE TABLE plant_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    uuid REFERENCES plants(id) ON DELETE CASCADE,
  nursery_id  uuid REFERENCES nurseries(id),
  event_type  text CHECK (event_type IN (
    'arrived','repotted','moved','treated','photo','priced','reserved','sold','lost','returned'
  )) NOT NULL,
  from_container  text,           -- previous container size
  to_container    text,           -- new container size
  notes           text,
  employee_id     uuid REFERENCES employees(id),
  occurred_at     timestamptz DEFAULT now()
);

-- ============================================================
-- ADDONS (nursery-configurable upsell items)
-- ============================================================
CREATE TABLE addons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  name            text NOT NULL,          -- "Native compost blend"
  description     text,
  price_per_plant numeric NOT NULL,
  trigger_rule    text,                   -- "transport=self" or "always" or "container>=15gal"
  pre_selected    boolean DEFAULT false,
  active          boolean DEFAULT true,
  sort_order      integer DEFAULT 0
);

-- ============================================================
-- CUSTOMERS (nursery-scoped, not global)
-- ============================================================
CREATE TABLE customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text,                   -- required at checkout
  phone           text,
  address_line1   text,
  city            text,
  state           text DEFAULT 'TX',
  zip             text,
  qb_customer_id  text,                   -- QuickBooks customer record ID
  marketing_opt_in boolean DEFAULT true,
  source          text DEFAULT 'walk-in', -- walk-in | qr-scan | online | contractor
  lifetime_value  numeric DEFAULT 0,      -- updated on each sale
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES customers(id),
  employee_id     uuid REFERENCES employees(id),
  qb_invoice_id   text,                   -- QB invoice number
  qb_invoice_url  text,                   -- "View and pay" link
  transport_method text CHECK (transport_method IN ('self','delivery','install')) DEFAULT 'self',
  install_date    date,
  subtotal        numeric NOT NULL DEFAULT 0,
  tax_amount      numeric NOT NULL DEFAULT 0,
  total_amount    numeric NOT NULL DEFAULT 0,
  addons_amount   numeric DEFAULT 0,
  status          text CHECK (status IN ('pending','invoiced','paid','cancelled')) DEFAULT 'pending',
  leakage_flag    boolean DEFAULT false,  -- true if 15gal+ trees with zero add-ons
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- ORDER ITEMS (one row per plant per order)
-- ============================================================
CREATE TABLE order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES orders(id) ON DELETE CASCADE,
  plant_id    uuid REFERENCES plants(id),
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL,
  subtotal    numeric NOT NULL
);

-- ============================================================
-- ORDER ADDONS (which add-ons were selected per order)
-- ============================================================
CREATE TABLE order_addons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES orders(id) ON DELETE CASCADE,
  addon_id    uuid REFERENCES addons(id),
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL,
  subtotal    numeric NOT NULL
);

-- ============================================================
-- LOSSES
-- ============================================================
CREATE TABLE losses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id),
  plant_id        uuid REFERENCES plants(id),
  reason          text CHECK (reason IN (
    'freeze','heat','disease','overwater','underwater',
    'transplant_shock','theft','breakage','unknown'
  )),
  container_at_loss text,
  value_at_loss   numeric,
  notes           text,
  employee_id     uuid REFERENCES employees(id),
  occurred_at     date DEFAULT CURRENT_DATE,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (multi-tenant isolation)
-- ============================================================
ALTER TABLE nurseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Plants are public for QR scan (no auth needed to view)
CREATE POLICY "Plants viewable by anyone" ON plants
  FOR SELECT USING (true);

-- All other tables scoped to nursery_id from JWT claim
CREATE POLICY "Nursery data scoped" ON customers
  FOR ALL USING (nursery_id::text = auth.jwt()->>'nursery_id');

CREATE POLICY "Nursery data scoped" ON orders
  FOR ALL USING (nursery_id::text = auth.jwt()->>'nursery_id');

CREATE POLICY "Nursery data scoped" ON losses
  FOR ALL USING (nursery_id::text = auth.jwt()->>'nursery_id');

-- ============================================================
-- SEED DATA — LAWNS Tree Farm LLC (for demo)
-- ============================================================

-- Insert nursery
INSERT INTO nurseries (id, name, address, phone, email, website, tax_rate) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'LAWNS Tree Farm, LLC',
  '400 Honeycomb Mesa, Leander, TX 78641',
  '(512) 450-3336',
  'info@lawnstrees.com',
  'https://lawnstrees.com',
  0.0825
);

-- Insert plants (real SKUs from invoices)
INSERT INTO plants (nursery_id, tag_id, species, common_name, plant_type, current_container, base_price, install_price, arrived_at, status) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'SCV-0031', 'Vitex agnus-castus ''Shoal Creek''', 'Shoal Creek Vitex', 'tree', '30 gal', 400.00, 225.00, '2022-03-15', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'SCV-0032', 'Vitex agnus-castus ''Shoal Creek''', 'Shoal Creek Vitex', 'tree', '30 gal', 400.00, 225.00, '2022-03-15', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'MS30-001', 'Platanus mexicana', 'Mexican Sycamore', 'tree', '30 gal', 450.00, 225.00, '2021-09-10', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'MS30-002', 'Platanus mexicana', 'Mexican Sycamore', 'tree', '30 gal', 450.00, 225.00, '2021-09-10', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'NCM-0038', 'Lagerstroemia indica ''Natchez''', 'Natchez Crape Myrtle', 'tree', '45 gal', 906.00, 357.00, '2021-03-01', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'NCM-0039', 'Lagerstroemia indica ''Natchez''', 'Natchez Crape Myrtle', 'tree', '45 gal', 906.00, 357.00, '2021-03-01', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'NCM-0040', 'Lagerstroemia indica ''Natchez''', 'Natchez Crape Myrtle', 'tree', '45 gal', 906.00, 357.00, '2021-03-01', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'NCM-0041', 'Lagerstroemia indica ''Natchez''', 'Natchez Crape Myrtle', 'tree', '45 gal', 906.00, 357.00, '2021-03-01', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'NCM-0042', 'Lagerstroemia indica ''Natchez''', 'Natchez Crape Myrtle', 'tree', '45 gal', 906.00, 357.00, '2021-03-01', 'available'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'NCM-0043', 'Lagerstroemia indica ''Natchez''', 'Natchez Crape Myrtle', 'tree', '45 gal', 906.00, 357.00, '2021-03-01', 'available');

-- Insert plant events (journey history for demo plants)
INSERT INTO plant_events (plant_id, nursery_id, event_type, from_container, to_container, occurred_at) VALUES
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'arrived', null, '4 in', '2022-03-15'),
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '4 in', '3 gal', '2022-09-01'),
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '3 gal', '15 gal', '2023-04-15'),
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '15 gal', '30 gal', '2024-03-20'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'arrived', null, 'seedling', '2021-03-01'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', 'seedling', '5 gal', '2021-09-01'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '5 gal', '15 gal', '2022-04-01'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '15 gal', '45 gal', '2023-05-01');

-- Insert add-ons
INSERT INTO addons (nursery_id, name, description, price_per_plant, trigger_rule, pre_selected, sort_order) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Protective travel netting', 'Protects branches and bark on the drive home. Applied before loading.', 10.00, 'transport=self', true, 1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Native compost blend', '2 cu ft per plant. Best applied in the planting hole — right now, not later.', 28.00, 'always', true, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Slow-release fertilizer spike', '6-month feed. Goes in the planting hole — cannot add after planting.', 18.00, 'always', false, 3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Hardwood mulch ring', '3-inch depth, 4-ft ring. Retains moisture, reduces weeds. Can be added anytime.', 22.00, 'always', false, 4);
```

---

## ENVIRONMENT VARIABLES

Create `packages/cultivar-os/.env.local` — never commit this file.
Create `packages/cultivar-os/.env.example` with placeholder values — commit this.

```bash
# Supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# QuickBooks (from developer.intuit.com)
QB_CLIENT_ID=your-qb-client-id
QB_CLIENT_SECRET=your-qb-client-secret
QB_REDIRECT_URI=https://cultivar-os.app/api/qb/callback
QB_ENVIRONMENT=sandbox               # change to production after demo

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX

# Resend (email)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@cultivar-os.app

# App
VITE_APP_URL=https://cultivar-os.app
VITE_TAX_RATE=0.0825
```

---

## API ENDPOINTS

### Public (no auth required)
```
GET  /api/plant/:tagId              → plant profile + events (for QR scan)
GET  /api/nursery/:nurseryId/addons → addons configured for this nursery
POST /api/order                     → create order + QB invoice
POST /api/customer                  → create/find customer record
```

### Private (nursery auth required)
```
GET  /api/dashboard                 → today's sales, inventory value, leakage flags
GET  /api/inventory                 → all plants with filters
PUT  /api/plant/:id                 → update plant (status, container, price)
POST /api/plant                     → add new plant + generate QR
POST /api/loss                      → record plant loss
GET  /api/schedule                  → upcoming installs
POST /api/qr/bulk                   → generate batch QR codes
GET  /api/qb/connect                → start QB OAuth flow
GET  /api/qb/callback               → QB OAuth callback
```

---

## KEY BUSINESS LOGIC

### Plant profile page (/plant/:tagId)
1. Fetch plant by tag_id from Supabase (public, no auth)
2. Fetch plant_events for this plant (show journey timeline)
3. Display: species, common name, current container, price, install price, age
4. Age = today - arrived_at, formatted as "X years Y months"
5. Journey = plant_events ordered by occurred_at ascending
6. Show QtySelector (default 1, max = count of same species in same container)
7. "Add to cart" → navigate to /plant/:tagId/addons

### Add-ons screen (/plant/:tagId/addons)
1. Fetch addons for nursery (from addons table)
2. Show TransportToggle: "I'll transport myself" / "LAWNS is delivering/installing"
3. If transport=self → show NettingPrompt (pre-selected, prominent, red border)
4. Show all addons with trigger_rule='always' (pre_selected determines default)
5. Netting description: "Protects branches and bark on the drive home. Applied before loading."
6. Compost description: "Best applied in the planting hole — right now, not later."
7. Fertilizer description: "Goes in the planting hole — cannot add after planting."
8. "Review my cart" → navigate to /checkout/review

### Cart review + customer capture
1. Show all order items + selected add-ons
2. Calculate: subtotal = (plant_price × qty) + (addon_price × qty for each addon)
3. Tax = subtotal × tax_rate (from nursery config, default 0.0825)
4. Total = subtotal + tax
5. Require email before proceeding
6. Optional: phone, address

### Order creation (POST /api/order)
1. Create customer record (or find existing by email + nursery_id)
2. Create order record
3. Create order_items (one per plant type selected)
4. Create order_addons (one per addon selected)
5. Update plant status → 'reserved'
6. Set leakage_flag = true if any plant is 15gal+ AND no add-ons selected
7. Create QB invoice via QB API (see QB section below)
8. Send confirmation email to customer
9. Return: order_id, qb_invoice_url, confirmation message

### Leakage flag logic
```
leakage_flag = order has any plant with container IN ('15 gal','30 gal','45 gal','60 gal','100 gal')
               AND order_addons count = 0
```

---

## QUICKBOOKS INTEGRATION

### Setup (do this before demo)
1. Go to developer.intuit.com → create account
2. Create app → select "QuickBooks Online and Payments"
3. Set Redirect URI: https://cultivar-os.app/api/qb/callback
4. Copy Client ID and Client Secret to .env.local
5. Use sandbox environment for demo — switch to production after Layna signs

### OAuth flow
```
Owner clicks "Connect QuickBooks"
→ GET /api/qb/connect
→ Redirect to Intuit OAuth URL
→ Owner approves
→ Intuit redirects to /api/qb/callback?code=...&realmId=...
→ Exchange code for access_token + refresh_token
→ Store both in nurseries table (encrypted at rest)
→ Store realmId in nurseries.qb_realm_id
```

### Invoice creation (every checkout)
```python
# POST to QB API
invoice_payload = {
    "Line": [
        {
            "Amount": order.subtotal,
            "DetailType": "SalesItemLineDetail",
            "SalesItemLineDetail": {
                "ItemRef": {"name": plant.species},
                "Qty": item.quantity,
                "UnitPrice": item.unit_price
            }
        }
        # one Line per order_item + one per order_addon
    ],
    "CustomerRef": {"value": customer.qb_customer_id},
    "TxnDate": today,
    "DueDate": today,      # "Due on receipt"
    "BillEmail": {"Address": customer.email}
}
```

### Demo proof (what to show in the meeting)
1. Customer scans SCV-0031 on phone
2. Adds compost and netting
3. Enters email
4. Taps "Send invoice"
5. Open QuickBooks on laptop → Invoices
6. Invoice appears with correct line items, tax, total
7. Show: "You didn't type anything. The invoice wrote itself."

---

## REACT ROUTER STRUCTURE

```tsx
// src/router.tsx
<Routes>
  {/* PUBLIC — no auth needed */}
  <Route path="/plant/:tagId" element={<PlantProfile />} />
  <Route path="/plant/:tagId/addons" element={<AddOns />} />
  <Route path="/checkout/customer" element={<CustomerCapture />} />
  <Route path="/checkout/review" element={<CartReview />} />
  <Route path="/checkout/confirm" element={<Confirmation />} />

  {/* PRIVATE — nursery owner/staff */}
  <Route path="/login" element={<Login />} />
  <Route element={<PrivateRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/dashboard/inventory" element={<Inventory />} />
    <Route path="/dashboard/schedule" element={<Schedule />} />
    <Route path="/dashboard/losses" element={<Losses />} />
  </Route>

  {/* DEFAULT */}
  <Route path="/" element={<Navigate to="/dashboard" />} />
</Routes>
```

---

## DEMO DATA — QR CODES TO PRINT

Generate QR codes pointing to these URLs. Print on cardstock or weatherproof label.

| Tag ID | URL | Species | Demo purpose |
|---|---|---|---|
| SCV-0031 | cultivar-os.app/plant/SCV-0031 | Shoal Creek Vitex 30-gal | Scan in meeting |
| NCM-0042 | cultivar-os.app/plant/NCM-0042 | Natchez Crape Myrtle 45-gal | Same as Karolina Bradt invoice |
| MS30-001 | cultivar-os.app/plant/MS30-001 | Mexican Sycamore 30-gal | David's own purchase today |

---

## BUILD SCHEDULE — SESSION BY SESSION

### SESSION 1 — Saturday afternoon (90 min)
**Goal:** Monorepo + Supabase live + real data in database

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 1
Goal: Create monorepo structure, Supabase project, run schema SQL, seed LAWNS data

Tasks:
1. Create trace-platform/ folder structure as defined in brief
2. Initialize packages/shared and packages/cultivar-os with package.json + vite.config
3. Run the full schema SQL in Supabase SQL editor
4. Verify all tables created with correct columns
5. Verify seed data: 10 plants, 8 plant_events, 4 addons
6. Set up .env.local and .env.example
7. git add . && git commit -m "Session 1: monorepo + schema + seed data"
```

### SESSION 2 — Saturday evening or Sunday AM (2 hrs)
**Goal:** Plant profile page live on real URL

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 2
Goal: Build PlantProfile.tsx and PlantTimeline.tsx. Deploy to Vercel.
cultivar-os.app/plant/SCV-0031 must load Shoal Creek Vitex with real Supabase data.

Tasks:
1. Build usePlant.ts hook — fetch plant + events by tagId
2. Build PlantHero.tsx — species, container, price, age calculation
3. Build PlantTimeline.tsx — container progression with dates
4. Build PlantProfile.tsx page — assemble hero + timeline + qty selector + "Add to cart" button
5. Wire React Router — /plant/:tagId
6. Deploy to Vercel: vercel --prod
7. Test: scan SCV-0031 QR on phone — profile loads correctly
8. git commit -m "Session 2: plant profile page live"
```

### SESSION 3 — Sunday afternoon (2 hrs)
**Goal:** Add-ons screen working with netting prompt

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 3
Goal: Build AddOns.tsx with transport toggle and netting prompt.
Netting must appear pre-checked when "I'll transport myself" is selected.

Tasks:
1. Build useCart.ts — cart state (items, addons, qty, transport method)
2. Build TransportToggle.tsx — self vs delivery/install
3. Build NettingPrompt.tsx — appears when transport=self, pre-checked, red border
4. Build AddonCard.tsx — toggleable, shows price per plant, description
5. Build AddOns.tsx page — transport toggle + netting + addon list + "Review cart" button
6. Wire cart state through React Context or Zustand
7. Test full flow: plant profile → add-ons → netting appears
8. git commit -m "Session 3: add-ons screen + netting prompt"
```

### SESSION 4 — Monday evening (2 hrs)
**Goal:** Checkout + customer capture + order creation

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 4
Goal: Build CustomerCapture, CartReview, Confirmation pages.
Order must be created in Supabase on checkout.

Tasks:
1. Build CustomerCapture.tsx — name, email (required), phone, address (optional)
2. Build CartReview.tsx — line items, addon lines, subtotal, tax (8.25%), total
3. Build CartReview price calculation — verify math matches QB invoice format
4. Build POST /api/order endpoint (FastAPI) — creates order + order_items + order_addons
5. Build Confirmation.tsx — "Invoice sent to your email" + order summary
6. Set leakage_flag correctly on order creation
7. Test: complete checkout flow, verify order in Supabase
8. git commit -m "Session 4: checkout flow + order creation"
```

### SESSION 5 — Tuesday evening (2 hrs)
**Goal:** QuickBooks sandbox connected — invoice appears on checkout

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 5
Goal: Connect QuickBooks Online sandbox. Invoice must appear in QB when order is created.

Tasks:
1. Register at developer.intuit.com — create sandbox app
2. Build GET /api/qb/connect — generates QB OAuth URL
3. Build GET /api/qb/callback — exchanges code for tokens, stores in nurseries table
4. Build lib/qb_client.py — authenticated QB API requests with token refresh
5. Build POST invoice creation in qb_client.py — maps order to QB invoice payload
6. Wire QB invoice creation into POST /api/order — call after Supabase order created
7. Store qb_invoice_url on order record
8. Test: checkout → verify invoice appears in QB sandbox dashboard
9. git commit -m "Session 5: QuickBooks sandbox connected"
```

### SESSION 6 — Wednesday evening (1.5 hrs)
**Goal:** Owner dashboard — Layna's view

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 6
Goal: Build Login and Dashboard pages. Layna must be able to log in and see today's sales.

Tasks:
1. Build Login.tsx — email + password → Supabase auth
2. Build PrivateRoute.tsx — redirect to /login if no session
3. Build GET /api/dashboard endpoint — today's sales, inventory count, live value, leakage flags
4. Build Dashboard.tsx — metric cards (plants tracked, inventory value, installs this week)
5. Build MetricCard.tsx component
6. Build LeakageAlert.tsx — "X sales this week with no add-ons — est. $Y missed"
7. Add LAWNS owner account to Supabase auth: layna@lawnstrees.com
8. Test: login → dashboard loads with real LAWNS data
9. git commit -m "Session 6: owner dashboard"
```

### SESSION 7 — Thursday (2 hrs)
**Goal:** Generate QR codes, print tags, full demo run-through

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 7
Goal: QR generation working. 3 tags printed. Full demo run-through under 4 minutes.

Tasks:
1. Build QR generation — qrcode.js library, URL format: cultivar-os.app/plant/:tagId
2. Build /dashboard/qr page — enter tag IDs, generate QR codes, download as PNG
3. Generate and download: SCV-0031, NCM-0042, MS30-001
4. Print on cardstock (3 copies each if possible)
5. Full demo run-through:
   - Scan SCV-0031 on phone
   - Select 1 tree, transport=self, add netting + compost
   - Enter email
   - Submit → QB invoice appears
   - Log in as Layna → dashboard shows the sale
6. Time it — must be under 4 minutes
7. Fix any bugs found during run-through
8. git commit -m "Session 7: QR generation + demo ready"
```

### SESSION 8 — Friday (1 hr buffer)
**Goal:** Polish, test on mobile, fix anything broken

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF.md before we begin.
Session: 8
Goal: Mobile testing + polish. Nothing fancy — just make sure it works on a phone.

Tasks:
1. Test entire flow on iPhone/Android — fix any layout issues
2. Verify netting prompt is prominent and readable on mobile
3. Check all prices calculate correctly (especially tax rounding)
4. Verify QB invoice has correct line items
5. Do the full demo as if you're Layna — no prior knowledge, just the phone
6. Final git push
7. Done.
```

---

## PACKAGE.JSON (cultivar-os)

```json
{
  "name": "cultivar-os",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "qrcode": "^1.5.3",
    "zustand": "^4.4.7",
    "date-fns": "^3.0.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

## REQUIREMENTS.TXT (FastAPI backend)

```
fastapi==0.109.0
uvicorn==0.27.0
supabase==2.3.0
httpx==0.26.0
python-dotenv==1.0.0
python-jose==3.3.0
intuit-oauth==1.2.4
stripe==7.11.0
twilio==8.11.0
resend==0.6.0
```

---

## VERCEL DEPLOYMENT

```bash
# Install Vercel CLI
npm i -g vercel

# From packages/cultivar-os/
vercel

# Follow prompts:
# Project name: cultivar-os
# Framework: Vite
# Build command: npm run build
# Output directory: dist

# Add environment variables in Vercel dashboard
# (same as .env.local)

# Custom domain in Vercel dashboard:
# Add cultivar-os.app → configure GoDaddy DNS
# Add CNAME: @ → cname.vercel-dns.com
```

---

## CONSTANTS (lib/constants.ts)

```typescript
export const TAX_RATE = 0.0825  // Texas 8.25%

export const CONTAINER_SIZES = [
  '4 in', '1 gal', '3 gal', '5 gal', '10 gal',
  '15 gal', '30 gal', '45 gal', '60 gal', '100 gal'
]

export const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal']

export const DEMO_NURSERY_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

export const TRANSPORT_OPTIONS = {
  SELF: 'self',
  DELIVERY: 'delivery',
  INSTALL: 'install'
}
```

---

## DESIGN GUIDELINES

Keep the UI clean and fast — customers are using it on a phone in a nursery with variable signal.

- Colors: deep forest green (#27500A) primary, light sage (#EAF3DE) backgrounds, white cards
- Typography: system-ui — no web font loading (slow on mobile)
- Buttons: full-width on mobile, 48px min height (thumb-friendly)
- Netting prompt: red border (#A32D2D), amber background — must be unmissable
- Compost/fertilizer: green border when pre-selected
- No animations — fast render is more important than motion
- QR scan page must work offline (cache plant data after first load)

---

## THE DEMO URL TO HAND LAYNA

```
cultivar-os.app/plant/SCV-0031
```

This is the Shoal Creek Vitex tag she can see on her lot right now. When she scans it or types the URL in the meeting, she sees her own plant, her own nursery's branding, the plant's full journey from 2022 to today, the price with install, and the add-on that should have been offered before you loaded your truck.

---

*Cultivar OS — A TRACE Enterprises Platform*
*cultivar-os.app · builtwithcai.com*
*This file is the memory of the build. Update session checkboxes as you complete them.*
