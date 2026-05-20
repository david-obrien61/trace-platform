# CULTIVAR OS — Claude Code Build Brief v2
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
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.

Current session: [SESSION NUMBER from the schedule below]
Today's goal: [copy the goal from that session]

PLATFORM RULES — NON-NEGOTIABLE:
- This is one vertical of a multi-vertical platform. packages/shared/ already exists.
- Before writing ANY new module, check packages/shared/src/ first.
- If the module exists in shared → import and configure it. Do NOT rebuild it.
- If it does not exist in shared → build it IN shared/, then import it here.
- Auth, QB, QR, Stripe, notifications: ALL live in shared. Never duplicate.
- Do not modify packages/ignition-os under any circumstances.
- Ask before making any schema changes not in this brief.
- Commit after every completed task: git add . && git commit -m "description"
```

---

## ⚠️ SHARED MODULE RULE — READ BEFORE EVERY SESSION

This project inherits a fully-built shared module from Ignition OS. The rule is simple:

**CHECK BEFORE YOU BUILD.**

| If you need... | Do NOT build new | Instead... |
|---|---|---|
| Auth / login / session | ❌ Do not write Login.tsx from scratch | ✅ Import from `packages/shared/src/supabase/auth.ts` |
| Supabase client | ❌ Do not initialize a new client | ✅ Import from `packages/shared/src/supabase/client.ts` |
| QB OAuth flow | ❌ Do not write new OAuth | ✅ Import from `packages/shared/src/quickbooks/oauth.ts` |
| QB invoice creation | ❌ Do not write new invoice logic | ✅ Import from `packages/shared/src/quickbooks/invoice.ts` |
| QB customer lookup | ❌ Do not write new customer logic | ✅ Import from `packages/shared/src/quickbooks/customer.ts` |
| QR code generation | ❌ Do not add qrcode.js directly | ✅ Import from `packages/shared/src/qr/generate.ts` |
| ZPL label printing | ❌ Do not write new ZPL logic | ✅ Import from `packages/shared/src/qr/print.ts` |
| SMS notifications | ❌ Do not configure Twilio directly | ✅ Import from `packages/shared/src/notifications/sms.ts` |
| Email notifications | ❌ Do not configure Resend directly | ✅ Import from `packages/shared/src/notifications/email.ts` |
| Button, Badge, Card, Spinner | ❌ Do not create new UI primitives | ✅ Import from `packages/shared/src/components/` |

**The only new code that belongs in `packages/cultivar-os/` is nursery-specific logic:**
plant profiles, add-ons, the checkout flow, the planting timeline, and nursery dashboard tiles.

---

## VERTICAL CONFIGURATION — HOW AUTH WORKS ACROSS THE PLATFORM

The shared auth module is vertical-aware. Configure it once at app startup. Do not modify the module itself.

```typescript
// packages/cultivar-os/src/lib/auth.ts
import { configureAuth } from '@trace/shared/supabase/auth'

export const auth = configureAuth({
  vertical: 'cultivar-os',
  roles: ['owner', 'manager', 'staff'],
  redirectAfterLogin: '/dashboard',
  redirectIfNoSession: '/login',
})
```

Role permissions for this vertical:

| Role | Can do |
|---|---|
| `owner` | Full dashboard, inventory, losses, schedule, QB connect, billing |
| `manager` | Dashboard, inventory, losses, schedule — no billing |
| `staff` | View inventory, record losses — no financials |

The `PrivateRoute` component reads from the shared session — do not build a new one. Configure it:

```typescript
// src/components/layout/PrivateRoute.tsx
import { PrivateRoute as SharedPrivateRoute } from '@trace/shared/components'
export const PrivateRoute = () => <SharedPrivateRoute auth={auth} />
```

**To create the LAWNS owner account:** Use Supabase dashboard → Authentication → Users → Invite user. Email: `layna@lawnstrees.com`. Do NOT do this manually in SQL. Do NOT build a user creation flow — that is a Phase 1 feature.

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
├── CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md      ← this file
├── packages/
│   ├── shared/                              ← DO NOT MODIFY — shared platform code
│   │   ├── package.json
│   │   └── src/
│   │       ├── supabase/
│   │       │   ├── client.ts              ← ✅ USE THIS — Supabase client singleton
│   │       │   ├── auth.ts                ← ✅ USE THIS — login, session, role check, configureAuth()
│   │       │   └── types.ts               ← ✅ USE THIS — shared DB types
│   │       ├── stripe/
│   │       │   ├── billing.ts             ← ✅ USE THIS — subscription creation
│   │       │   └── trial.ts               ← ✅ USE THIS — trial clock, data blur trigger
│   │       ├── quickbooks/
│   │       │   ├── oauth.ts               ← ✅ USE THIS — QB OAuth 2.0 flow
│   │       │   ├── invoice.ts             ← ✅ USE THIS — create/update QB invoice
│   │       │   └── customer.ts            ← ✅ USE THIS — create/find QB customer
│   │       ├── qr/
│   │       │   ├── generate.ts            ← ✅ USE THIS — QR code generation
│   │       │   └── print.ts               ← ✅ USE THIS — Zebra ZPL label format
│   │       ├── notifications/
│   │       │   ├── sms.ts                 ← ✅ USE THIS — Twilio SMS
│   │       │   └── email.ts               ← ✅ USE THIS — Resend email
│   │       └── components/
│   │           ├── Button.tsx             ← ✅ USE THIS
│   │           ├── Badge.tsx              ← ✅ USE THIS
│   │           ├── Card.tsx               ← ✅ USE THIS
│   │           └── LoadingSpinner.tsx     ← ✅ USE THIS
│   │
│   └── cultivar-os/                        ← nursery-specific code only
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── .env.local                     ← never commit this
│       ├── .env.example                   ← commit this, no real values
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── router.tsx
│           │
│           ├── lib/
│           │   ├── auth.ts                ← configureAuth() wrapper (see above)
│           │   ├── supabase.ts            ← re-exports shared client
│           │   └── constants.ts           ← TAX_RATE, ADDON_PRICES, etc
│           │
│           ├── types/
│           │   ├── plant.ts               ← nursery-specific types
│           │   ├── customer.ts
│           │   ├── order.ts
│           │   └── nursery.ts
│           │
│           ├── hooks/
│           │   ├── usePlant.ts            ← fetch plant by QR tag
│           │   ├── useCart.ts             ← cart state management
│           │   ├── useNursery.ts          ← nursery config
│           │   └── useAuth.ts             ← thin wrapper over shared auth
│           │
│           ├── pages/
│           │   ├── PlantProfile.tsx       ← PUBLIC: /plant/:tagId
│           │   ├── AddOns.tsx             ← PUBLIC: /plant/:tagId/addons
│           │   ├── CustomerCapture.tsx    ← PUBLIC: /checkout/customer
│           │   ├── CartReview.tsx         ← PUBLIC: /checkout/review
│           │   ├── Confirmation.tsx       ← PUBLIC: /checkout/confirm
│           │   ├── Dashboard.tsx          ← PRIVATE: /dashboard
│           │   ├── Inventory.tsx          ← PRIVATE: /dashboard/inventory
│           │   ├── Schedule.tsx           ← PRIVATE: /dashboard/schedule
│           │   ├── Losses.tsx             ← PRIVATE: /dashboard/losses
│           │   └── Login.tsx              ← PRIVATE: /login — thin wrapper over shared auth UI
│           │
│           ├── components/
│           │   ├── layout/
│           │   │   ├── NavBar.tsx
│           │   │   └── PrivateRoute.tsx   ← configures shared PrivateRoute for this vertical
│           │   ├── plant/
│           │   │   ├── PlantHero.tsx
│           │   │   ├── PlantTimeline.tsx
│           │   │   └── PlantCard.tsx
│           │   ├── checkout/
│           │   │   ├── QtySelector.tsx
│           │   │   ├── AddonCard.tsx
│           │   │   ├── NettingPrompt.tsx
│           │   │   ├── CartLine.tsx
│           │   │   └── TransportToggle.tsx
│           │   └── dashboard/
│           │       ├── MetricCard.tsx
│           │       ├── SaleRow.tsx
│           │       └── LeakageAlert.tsx
│           │
│           └── styles/
│               └── globals.css
│
│       └── api/                           ← FastAPI backend (Railway)
│           ├── main.py
│           ├── requirements.txt
│           ├── routers/
│           │   ├── plants.py
│           │   ├── orders.py
│           │   ├── customers.py
│           │   ├── quickbooks.py          ← imports from shared lib/qb_client.py
│           │   └── qr.py                  ← imports from shared lib/qr.py
│           └── lib/
│               ├── supabase.py            ← re-exports shared supabase client
│               ├── qb_client.py           ← imports from packages/shared quickbooks module
│               └── notifications.py       ← imports from packages/shared notifications module
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
  qb_realm_id     text,
  qb_access_token text,
  qb_refresh_token text,
  tax_rate        numeric DEFAULT 0.0825,
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
  pin_hash    text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- PLANTS
-- ============================================================
CREATE TABLE plants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  tag_id          text UNIQUE NOT NULL,
  species         text NOT NULL,
  common_name     text,
  plant_type      text CHECK (plant_type IN ('tree','shrub','perennial','annual','garden')) DEFAULT 'tree',
  current_container text,
  location_zone   text,
  status          text CHECK (status IN ('available','reserved','sold','lost','donated')) DEFAULT 'available',
  base_price      numeric NOT NULL,
  install_price   numeric DEFAULT 0,
  warranty_months integer DEFAULT 12,
  arrived_at      date,
  photo_url       text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- PLANT EVENTS
-- ============================================================
CREATE TABLE plant_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    uuid REFERENCES plants(id) ON DELETE CASCADE,
  nursery_id  uuid REFERENCES nurseries(id),
  event_type  text CHECK (event_type IN ('arrived','repotted','fertilized','pruned','treated','sold','lost','donated')),
  from_container text,
  to_container   text,
  notes          text,
  employee_id    uuid REFERENCES employees(id),
  occurred_at    timestamptz DEFAULT now()
);

-- ============================================================
-- ADDONS
-- ============================================================
CREATE TABLE addons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price_per_plant numeric NOT NULL,
  trigger_rule    text,
  pre_selected    boolean DEFAULT false,
  active          boolean DEFAULT true,
  sort_order      integer DEFAULT 0
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      uuid REFERENCES nurseries(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text,
  phone           text,
  address_line1   text,
  city            text,
  state           text DEFAULT 'TX',
  zip             text,
  qb_customer_id  text,
  marketing_opt_in boolean DEFAULT true,
  source          text DEFAULT 'walk-in',
  lifetime_value  numeric DEFAULT 0,
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
  qb_invoice_id   text,
  qb_invoice_url  text,
  transport_method text CHECK (transport_method IN ('self','delivery','install')) DEFAULT 'self',
  install_date    date,
  subtotal        numeric NOT NULL DEFAULT 0,
  tax_amount      numeric NOT NULL DEFAULT 0,
  total_amount    numeric NOT NULL DEFAULT 0,
  addons_amount   numeric DEFAULT 0,
  status          text CHECK (status IN ('pending','invoiced','paid','cancelled')) DEFAULT 'pending',
  leakage_flag    boolean DEFAULT false,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- ORDER ITEMS
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
-- ORDER ADDONS
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
-- ROW LEVEL SECURITY
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

-- Plants are public for QR scan
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
-- SEED DATA — LAWNS Tree Farm LLC
-- ============================================================

INSERT INTO nurseries (id, name, address, phone, email, website, tax_rate) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'LAWNS Tree Farm, LLC',
  '400 Honeycomb Mesa, Leander, TX 78641',
  '(512) 450-3336',
  'info@lawnstrees.com',
  'https://lawnstrees.com',
  0.0825
);

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

INSERT INTO plant_events (plant_id, nursery_id, event_type, from_container, to_container, occurred_at) VALUES
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'arrived', null, '4 in', '2022-03-15'),
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '4 in', '3 gal', '2022-09-01'),
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '3 gal', '15 gal', '2023-04-15'),
  ((SELECT id FROM plants WHERE tag_id='SCV-0031'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '15 gal', '30 gal', '2024-03-20'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'arrived', null, 'seedling', '2021-03-01'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', 'seedling', '5 gal', '2021-09-01'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '5 gal', '15 gal', '2022-04-01'),
  ((SELECT id FROM plants WHERE tag_id='NCM-0042'), 'a1b2c3d4-0000-0000-0000-000000000001', 'repotted', '15 gal', '45 gal', '2023-05-01');

INSERT INTO addons (nursery_id, name, description, price_per_plant, trigger_rule, pre_selected, sort_order) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Protective travel netting', 'Protects branches and bark on the drive home. Applied before loading.', 10.00, 'transport=self', true, 1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Native compost blend', '2 cu ft per plant. Best applied in the planting hole — right now, not later.', 28.00, 'always', true, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Slow-release fertilizer spike', '6-month feed. Goes in the planting hole — cannot add after planting.', 18.00, 'always', false, 3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Hardwood mulch ring', '3-inch depth, 4-ft ring. Retains moisture, reduces weeds. Can be added anytime.', 22.00, 'always', false, 4);
```

---

## ENVIRONMENT VARIABLES

```bash
# Supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# QuickBooks (from developer.intuit.com)
QB_CLIENT_ID=your-qb-client-id
QB_CLIENT_SECRET=your-qb-client-secret
QB_REDIRECT_URI=https://cultivar-os.app/api/qb/callback
QB_ENVIRONMENT=sandbox

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio (SMS) — pulled from shared/notifications/sms.ts
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX

# Resend (email) — pulled from shared/notifications/email.ts
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@cultivar-os.app

# App
VITE_APP_URL=https://cultivar-os.app
VITE_TAX_RATE=0.0825
VITE_VERTICAL=cultivar-os
```

---

## API ENDPOINTS

### Public (no auth required)
```
GET  /api/plant/:tagId              → plant profile + events
GET  /api/nursery/:nurseryId/addons → addons for this nursery
POST /api/order                     → create order + QB invoice
POST /api/customer                  → create/find customer record
```

### Private (nursery auth required)
```
GET  /api/dashboard                 → today's sales, inventory value, leakage flags
GET  /api/inventory                 → all plants with filters
PUT  /api/plant/:id                 → update plant
POST /api/plant                     → add new plant + generate QR
POST /api/loss                      → record plant loss
GET  /api/schedule                  → upcoming installs
POST /api/qr/bulk                   → batch QR generation
GET  /api/qb/connect                → start QB OAuth (uses shared oauth.ts)
GET  /api/qb/callback               → QB OAuth callback (uses shared oauth.ts)
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
1. Fetch addons for nursery from addons table
2. Show TransportToggle: "I'll transport myself" / "LAWNS is delivering/installing"
3. If transport=self → show NettingPrompt (pre-selected, prominent, red border)
4. Show all addons with trigger_rule='always'
5. Netting: "Protects branches and bark on the drive home. Applied before loading."
6. Compost: "Best applied in the planting hole — right now, not later."
7. Fertilizer: "Goes in the planting hole — cannot add after planting."
8. "Review my cart" → navigate to /checkout/review

### Cart review + customer capture
1. Show all order items + selected add-ons
2. subtotal = (plant_price × qty) + (addon_price × qty per addon)
3. Tax = subtotal × tax_rate (from nursery config, default 0.0825)
4. Total = subtotal + tax
5. Require email before proceeding
6. Optional: phone, address

### Order creation (POST /api/order)
1. Create customer record (or find existing by email + nursery_id)
2. Create order record
3. Create order_items
4. Create order_addons
5. Update plant status → 'reserved'
6. Set leakage_flag = true if any plant is 15gal+ AND no add-ons selected
7. Create QB invoice via **shared** qb_client.py — do NOT write new invoice logic
8. Send confirmation email via **shared** notifications/email.ts
9. Return: order_id, qb_invoice_url, confirmation message

### Leakage flag logic
```
leakage_flag = order has any plant with container IN ('15 gal','30 gal','45 gal','60 gal','100 gal')
               AND order_addons count = 0
```

---

## QUICKBOOKS INTEGRATION

**Do not build new QB logic.** Import from `packages/shared/src/quickbooks/`.

### Setup (do once before demo)
1. Go to developer.intuit.com → create account
2. Create app → select "QuickBooks Online and Payments"
3. Set Redirect URI: https://cultivar-os.app/api/qb/callback
4. Copy Client ID and Client Secret to .env.local
5. Use sandbox for demo — switch to production after Layna signs

### OAuth flow — uses shared module
```python
# packages/cultivar-os/api/routers/quickbooks.py
from packages.shared.quickbooks.oauth import handle_connect, handle_callback

@router.get("/api/qb/connect")
async def qb_connect():
    return handle_connect()          # shared module generates the OAuth URL

@router.get("/api/qb/callback")
async def qb_callback(code: str, realmId: str):
    return handle_callback(code, realmId)  # shared module exchanges + stores tokens
```

### Invoice creation — uses shared module
```python
# packages/cultivar-os/api/routers/orders.py
from packages.shared.quickbooks.invoice import create_invoice
from packages.shared.quickbooks.customer import find_or_create_customer

# After creating order in Supabase:
qb_customer = find_or_create_customer(nursery_id, customer)
invoice = create_invoice(nursery_id, order, qb_customer)
# store invoice.id and invoice.invoice_url on order record
```

---

## REACT ROUTER STRUCTURE

```tsx
<Routes>
  {/* PUBLIC */}
  <Route path="/plant/:tagId" element={<PlantProfile />} />
  <Route path="/plant/:tagId/addons" element={<AddOns />} />
  <Route path="/checkout/customer" element={<CustomerCapture />} />
  <Route path="/checkout/review" element={<CartReview />} />
  <Route path="/checkout/confirm" element={<Confirmation />} />

  {/* PRIVATE — uses shared PrivateRoute configured for cultivar-os */}
  <Route path="/login" element={<Login />} />
  <Route element={<PrivateRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/dashboard/inventory" element={<Inventory />} />
    <Route path="/dashboard/schedule" element={<Schedule />} />
    <Route path="/dashboard/losses" element={<Losses />} />
  </Route>

  <Route path="/" element={<Navigate to="/dashboard" />} />
</Routes>
```

---

## BUILD SCHEDULE — SESSION BY SESSION

### SESSION 1 — Saturday afternoon (90 min)
**Goal:** Monorepo + Supabase live + real LAWNS data in database

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 1
Goal: Monorepo structure, Supabase project, schema, seed data.

SHARED MODULE CHECK: No shared modules needed this session. Schema only.

Tasks:
1. Create trace-platform/ folder structure as defined in this brief
2. Initialize packages/shared and packages/cultivar-os with package.json + vite.config
3. Confirm packages/shared already has auth.ts, client.ts, quickbooks/, qr/, notifications/
   — if any are missing, flag immediately before proceeding
4. Run the full schema SQL in Supabase SQL editor
5. Verify all tables created with correct columns
6. Verify seed data: 10 plants, 8 plant_events, 4 addons
7. Set up .env.local and .env.example
8. git commit -m "Session 1: monorepo + schema + seed data"
```

### SESSION 2 — Saturday evening (2 hrs)
**Goal:** Plant profile page live on real URL

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 2
Goal: cultivar-os.app/plant/SCV-0031 must load with real data.

SHARED MODULE CHECK:
- Supabase client → import from packages/shared/src/supabase/client.ts
- Do NOT initialize a new Supabase client anywhere in cultivar-os/

Tasks:
1. Import Supabase client from shared — do not create a new one
2. Build usePlant.ts hook — fetches plant + plant_events by tag_id
3. Build PlantHero.tsx — species, container, price, install price, age calculation
4. Build PlantTimeline.tsx — plant_events as a vertical journey (oldest → newest)
5. Build QtySelector.tsx — default 1, max = available count of same species
6. Build PlantProfile.tsx page — assembles hero + timeline + qty + "Add to cart" CTA
7. Deploy to Vercel — must be live at cultivar-os.app/plant/SCV-0031, not localhost
8. Test on phone — verify SCV-0031 loads with Vitex data and journey timeline
9. git commit -m "Session 2: plant profile live on real URL"
```

### SESSION 3 — Sunday evening (2 hrs)
**Goal:** Add-ons screen working — netting prompt appears

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 3
Goal: Add-ons screen functional. Netting must appear and be pre-checked when transport=self.

SHARED MODULE CHECK:
- Supabase client → import from shared (already done in Session 2)
- No other shared modules needed this session

Tasks:
1. Build TransportToggle.tsx — "I'll transport myself" vs "LAWNS delivers/installs"
2. Build NettingPrompt.tsx — pre-checked, red border (#A32D2D), amber background, unmissable
3. Build AddonCard.tsx — toggleable, price per plant, description
4. Build AddOns.tsx page — transport toggle + netting + addon list + "Review cart" CTA
5. Wire cart state via Zustand (useCart.ts)
6. Test: plant profile → add-ons → netting appears when self-transport selected
7. git commit -m "Session 3: add-ons screen + netting prompt"
```

### SESSION 4 — Monday evening (2 hrs)
**Goal:** Checkout + customer capture + order creation

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 4
Goal: Full checkout flow. Order created in Supabase on submit.

SHARED MODULE CHECK:
- Email confirmation → import from packages/shared/src/notifications/email.ts
- Do NOT configure Resend directly in cultivar-os/ — use the shared module

Tasks:
1. Build CustomerCapture.tsx — name, email (required), phone, address (optional)
2. Build CartReview.tsx — line items, addon lines, subtotal, tax (8.25%), total
3. Verify price math: subtotal + (subtotal × 0.0825) = total
4. Build POST /api/order FastAPI endpoint — order + order_items + order_addons in Supabase
5. Set leakage_flag per logic defined in KEY BUSINESS LOGIC section
6. Send confirmation email using shared notifications/email.ts — do not write new email logic
7. Build Confirmation.tsx — "Invoice sent to your email" + order summary
8. Test: complete checkout, verify order appears in Supabase
9. git commit -m "Session 4: checkout flow + order creation"
```

### SESSION 5 — Tuesday evening (2 hrs)
**Goal:** QuickBooks sandbox — invoice appears on checkout

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 5
Goal: Invoice appears in QB when order is created.

SHARED MODULE CHECK:
- QB OAuth → import handle_connect, handle_callback from packages/shared/quickbooks/oauth.ts
- QB invoice → import create_invoice from packages/shared/quickbooks/invoice.ts
- QB customer → import find_or_create_customer from packages/shared/quickbooks/customer.ts
- Do NOT write new QB OAuth or invoice logic — wire the shared modules only

Tasks:
1. Register at developer.intuit.com → create sandbox app (David does this, not Claude Code)
2. Wire GET /api/qb/connect → calls shared handle_connect()
3. Wire GET /api/qb/callback → calls shared handle_callback(), stores tokens in nurseries table
4. Wire POST /api/order to call find_or_create_customer() then create_invoice() from shared
5. Store qb_invoice_id and qb_invoice_url on order record
6. Test: checkout → verify invoice appears in QB sandbox dashboard
7. git commit -m "Session 5: QB sandbox wired via shared modules"
```

### SESSION 6 — Wednesday evening (1.5 hrs)
**Goal:** Owner dashboard — Layna's view

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 6
Goal: Layna logs in and sees today's sales.

SHARED MODULE CHECK:
- Auth / Login → import from packages/shared/src/supabase/auth.ts — do NOT build a new login flow
- PrivateRoute → configure the shared PrivateRoute for vertical='cultivar-os'
- Do NOT write new session management, cookie handling, or redirect logic

Tasks:
1. Create LAWNS owner account via Supabase dashboard:
   → Authentication → Users → Invite user → layna@lawnstrees.com
   → Do NOT do this in SQL. Do NOT build a user creation UI.
2. Build src/lib/auth.ts — configureAuth() wrapper for cultivar-os vertical (see VERTICAL CONFIG section)
3. Build Login.tsx — thin wrapper over shared auth UI, styled with cultivar-os colors
4. Build PrivateRoute.tsx — configures shared PrivateRoute with cultivar-os auth
5. Build GET /api/dashboard — today's sales, inventory count, live value, leakage flags
6. Build Dashboard.tsx — metric cards using shared Card component
7. Build MetricCard.tsx — imports Card from shared components
8. Build LeakageAlert.tsx — "X sales this week with no add-ons — est. $Y missed"
9. Test: login → dashboard loads with real LAWNS data
10. git commit -m "Session 6: auth via shared module + owner dashboard"
```

### SESSION 7 — Thursday (2 hrs)
**Goal:** QR codes generated, tags printed, full demo run-through

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 7
Goal: 3 QR codes generated and printed. Full demo under 4 minutes.

SHARED MODULE CHECK:
- QR generation → import from packages/shared/src/qr/generate.ts
- ZPL printing → import from packages/shared/src/qr/print.ts
- Do NOT add qrcode.js directly to cultivar-os package.json

Tasks:
1. Build /dashboard/qr page — enter tag IDs, calls shared generate(), download as PNG
2. Generate and download: SCV-0031, NCM-0042, MS30-001
3. Print on cardstock (3 copies each)
4. Full demo run-through:
   - Scan SCV-0031 on phone
   - Select 1 tree, transport=self, add netting + compost
   - Enter email
   - Submit → QB invoice appears in sandbox
   - Log in as Layna → dashboard shows the sale
5. Time it — must be under 4 minutes
6. Fix any bugs
7. git commit -m "Session 7: QR via shared module + demo ready"
```

### SESSION 8 — Friday (1 hr buffer)
**Goal:** Mobile polish, final checks

```
Read CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md before we begin.
Session: 8
Goal: Works on a phone. Nothing broken.

Tasks:
1. Test entire flow on iPhone/Android — fix any layout issues
2. Verify netting prompt is prominent and readable on mobile
3. Verify tax math is correct (especially rounding)
4. Verify QB invoice has correct line items and tax
5. Do the full demo as Layna — no prior knowledge, just a phone
6. Final git push
7. Done.
```

---

## DEMO DATA — QR CODES TO PRINT

| Tag ID | URL | Species | Demo purpose |
|---|---|---|---|
| SCV-0031 | cultivar-os.app/plant/SCV-0031 | Shoal Creek Vitex 30-gal | Scan in meeting |
| NCM-0042 | cultivar-os.app/plant/NCM-0042 | Natchez Crape Myrtle 45-gal | Same SKU as invoice |
| MS30-001 | cultivar-os.app/plant/MS30-001 | Mexican Sycamore 30-gal | David's own purchase |

---

## PACKAGE.JSON (cultivar-os)

Note: qrcode.js is NOT listed here — it lives in packages/shared. Do not add it here.

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
    "@trace/shared": "workspace:*",
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
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

Note: QB and notification logic lives in shared Python modules. Do not re-add those packages here unless shared doesn't already have them.

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
npm i -g vercel
cd packages/cultivar-os
vercel
# Framework: Vite | Build: npm run build | Output: dist

# Custom domain: cultivar-os.app
# GoDaddy DNS: CNAME @ → cname.vercel-dns.com
```

---

## CONSTANTS (lib/constants.ts)

```typescript
export const TAX_RATE = 0.0825
export const VERTICAL = 'cultivar-os'

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

Mobile-first. Customers use this on a phone in a nursery with variable signal.

- Primary: deep forest green (#27500A)
- Background: light sage (#EAF3DE)
- Cards: white
- Typography: system-ui — no web fonts (slow on mobile)
- Buttons: full-width mobile, 48px min height
- Netting prompt: red border (#A32D2D), amber background — unmissable
- Compost/fertilizer: green border when pre-selected
- No animations — fast render over motion
- QR scan page: cache plant data after first load for offline use

---

## THE DEMO URL TO HAND LAYNA

```
cultivar-os.app/plant/SCV-0031
```

The Shoal Creek Vitex on her lot right now. She scans it and sees her own plant, her own nursery's branding, four years of growth history, the price, and the netting that should have been offered before the truck was loaded.

---

## WHAT THIS BRIEF CHANGED FROM v1 (audit summary)

| Session | v1 violation | v2 correction |
|---|---|---|
| Session 1 | Silent on shared module check | Explicit: verify shared modules exist before building |
| Session 2 | No mention of shared Supabase client | Explicit: import from shared/supabase/client.ts |
| Session 4 | No mention of shared email module | Explicit: import from shared/notifications/email.ts |
| Session 5 | "Build lib/qb_client.py from scratch" | Explicit: import handle_connect, handle_callback, create_invoice, find_or_create_customer from shared |
| Session 6 | "Build Login.tsx — email + password → Supabase auth" | Explicit: import shared auth, configure for vertical, create Layna's account via Supabase dashboard UI |
| Session 6 | "Build PrivateRoute.tsx" | Explicit: configure shared PrivateRoute — do not write new session logic |
| Session 7 | "Build QR generation — qrcode.js library" | Explicit: import from shared/qr/generate.ts — do not add qrcode.js to cultivar-os |
| package.json | qrcode listed as direct dependency | Removed — lives in shared |
| All sessions | No platform rule in session starter | PLATFORM RULES block added to every session starter |

---

*Cultivar OS — A TRACE Enterprises Platform*
*cultivar-os.app · builtwithcai.com*
*v2 — corrected for shared module compliance*
*This file is the memory of the build. Update session checkboxes as you complete them.*
