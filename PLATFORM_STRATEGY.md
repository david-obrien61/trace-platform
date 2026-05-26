# TRACE Platform — Multi-Vertical Strategy & Architecture

## Scope & Hierarchy

This document owns target architecture — what packages/shared/ and the vertical apps should look like when complete. Every table and section here describes target state, not current state.

When this doc conflicts with another:
- For current state, see TRACE_PLATFORM_AUDIT.md (audit wins on what is built)
- For strategy, revenue, and contacts, see MASTER_BRIEF.md
- For session handoff and infrastructure specifics, see CLAUDE.md
- For the discovery module's product brief, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)

When code reality and architectural ideal disagree about what exists, the audit wins. This doc describes where we're going.

## TRACE Philosophy

TRACE is not a software replacement company. TRACE is a business intelligence layer for owner-operated small businesses. We connect what they have. We fill what they're missing. We show them their whole business in one place. The business never loses their existing tools. The switching cost is near zero. The value is immediate and visible.

Each tile on the dashboard is either a CONNECTOR (links to a tool the customer already uses) or a GAP-FILLER (adds a capability no existing tool provides). Every tile has three states: Active, Available (trial-eligible), or Locked (tier upgrade required). Customers see what's available without being sold to. The trial mechanic proves the value before the charge.

The one-sentence version: "We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself."

**Built with CAI · TRACE Enterprises · David OBrien**
**Document version: 1.0 · May 2026**
**Status: Authoritative — supersedes scattered references in all other briefs**

---

## PART 1 — THE PLATFORM IN ONE PARAGRAPH

Built with CAI is a composable AI operating system for owner-operated small
businesses and nonprofits. The platform is built once. Each vertical is a
configured instance — new question sets, new tiles, new AI prompts, new
integration hooks. Nothing is rebuilt. The same Supabase schema, the same
auth system, the same QuickBooks bridge, the same trial engine, the same
onboarding shell. The beachhead is auto repair. The platform is everything
else. The unfair advantage is 40 years of knowledge management expertise
delivered at SMB price points by a family team.

---

## PART 2 — VERTICAL REGISTRY

Every vertical that exists or is planned. Update this table when a new
vertical is added. Every new vertical requires an entry here before any
code is written.

| Vertical | App Name | Domain | Target Customer | Status | Unique Value |
|---|---|---|---|---|---|
| Auto/Diesel Repair | Ignition OS | ignition-os.com | 1-5 bay owner-operator shops | 🟡 Pilot ready | Margin engine, job lifecycle, tool tracking |
| Nursery/Garden | Cultivar OS | cultivar-os.app | Independent nurseries, garden centers | 🔴 Demo May 25 | Plant timeline, QR per-plant, add-on leakage |
| HVAC/Plumbing/Electrical | Conduit OS | conduit-os.com | 1-3 truck owner-operators | 🟢 Strategy written | Refrigerant compliance, maintenance agreements, equipment registry |
| Food Pantry/Nonprofit | KINNA-OS | kinna-os.app (TBD) | Food pantries, direct service nonprofits | 🟢 Strategy written | TEFAP eligibility, voice receiving, pastoral care, distribution menu |
| Home Automation | CoolRunnings | coolrunnings.app (TBD) | Rural/suburban homeowners, STR operators | 🟡 Live pilot | Local-first, zero cloud, presence detection, vineyard/garden automation |

**Next vertical candidates** (informed by onboarding "Other" selections):
- Healthcare/aging-in-place (daughter's domain — CoolRunnings extension)
- Food service / restaurant (Anchor OS — planned)
- Electrical contractor (Circuit OS — Conduit OS extension)

---

## PART 3 — THE PLATFORM ARCHITECTURE

### The Governing Rule

```
One codebase. One deployment. Infinite verticals.
Shared modules are written once and never duplicated.
Vertical config is changed in one file — verticalConfig.ts.
Everything else inherits automatically.
```

### Core Stack — Built Once, Inherited by Every Vertical

| Layer | Module | Location | Status |
|---|---|---|---|
| Database | Supabase PostgreSQL, RLS, multi-tenant UUID | packages/shared/src/supabase/ | ✅ Live (Ignition OS) |
| Auth | configureAuth() — PIN or email/password, role-based routing | packages/shared/src/supabase/auth.ts | ⚠️ PIN only — needs configureAuth() wrapper |
| Data sync | DataBridge.js — local-first, offline queue, trial clock | packages/shared/src/supabase/bridge.ts | ⚠️ localStorage only — Supabase migration needed |
| AI router | AIEngine.js + ai_router.py — Claude/Gemini/Whisper by task | packages/shared/src/ai/ | ✅ Live (Ignition OS) |
| QuickBooks | OAuth 2.0 + invoice creation + customer sync | packages/shared/src/quickbooks/ | ⚠️ Ignition hardcoded — needs vertical-agnostic wrapper |
| Billing | Stripe subscription + trial clock + data blur | packages/shared/src/stripe/ | ✅ Live (Ignition OS) |
| Notifications | Twilio SMS + Resend email + templates | packages/shared/src/notifications/ | ⚠️ Partial — needs vertical template system |
| QR/Barcode | QR generation + ZPL label print | packages/shared/src/qr/ | ❌ Missing — needs to be built in shared |
| Pricing | MarginEngine — slab markup, override audit | packages/shared/src/pricing/ | ❌ Missing — port from IgnitionMobile/MarginEngine.js |
| Components | Button, Card, Badge, LoadingSpinner, LockedOverlay | packages/shared/src/components/ | ❌ Missing — needs to be built in shared |
| Onboarding | Shared shell + vertical question sets | packages/shared/src/onboarding/ | ❌ Not built — design complete |
| Vertical config | verticalConfig.ts — the master switch | packages/shared/src/config/ | ❌ Not built — design complete |

### The Monorepo Structure

```
trace-platform/                          ← GitHub: david-obrien61/trace-platform
├── PLATFORM_STRATEGY.md                 ← THIS FILE — read first, always
├── MASTER_BRIEF.md                      ← Company vision, revenue model, team
├── CLAUDE.md                            ← Multi-AI handoff state (filled in)
├── packages/
│   ├── shared/                          ← PLATFORM CODE — never vertical-specific
│   │   └── src/
│   │       ├── supabase/               ← client, auth, bridge, types
│   │       ├── ai/                     ← AIEngine, ai_router, task definitions
│   │       ├── quickbooks/             ← oauth, invoice, customer
│   │       ├── stripe/                 ← billing, trial, blur
│   │       ├── notifications/          ← sms, email, templates
│   │       ├── qr/                     ← generate, print (ZPL)
│   │       ├── pricing/                ← marginEngine, slabs
│   │       ├── components/             ← Button, Card, Badge, LockedOverlay
│   │       ├── onboarding/             ← shared shell + step components
│   │       └── config/
│   │           └── verticalConfig.ts  ← THE MASTER SWITCH
│   │
│   ├── ignition-os/                    ← Auto/Diesel vertical only
│   ├── cultivar-os/                    ← Nursery vertical only
│   ├── conduit-os/                     ← HVAC vertical only (fork of ignition)
│   ├── kinna-os/                      ← Nonprofit vertical only
│   └── coolrunnings/                   ← Home automation (different model)
│
├── docs/
│   ├── conduit_os_expansion.html       ← Conduit OS strategy (66-90hr estimate)
│   └── [other strategy docs]
└── README.md
```

---

## PART 4 — THE VERTICAL CONTRACT

### What Every Vertical MUST implement

These are non-negotiable. Every vertical that ships must have all of these:

1. **Onboarding flow** — uses shared shell, provides vertical question set
2. **Auth** — uses configureAuth() with vertical-specific role set
3. **Multi-tenant isolation** — every query scoped to tenant_id (shop_id / nursery_id / pantry_id)
4. **RLS policies** — every table has row-level security, no exceptions
5. **Trial engine** — 14-day clock, Day 7 nudge, Day 12 savings report, Day 15 blur
6. **Subscription gating** — LockedOverlay on premium tiles, tier config in verticalConfig
7. **QuickBooks bridge** — uses shared oauth and invoice modules (where applicable)
8. **Notification pattern** — uses shared sendNotification() with vertical templates

### What Every Vertical CAN customize

These are expected to differ per vertical — the vertical config drives them:

- Role names and permission sets
- Dashboard tile selection and layout
- Add-on / upsell item definitions
- AI task prompts (same engine, different instructions)
- Onboarding question sets
- Notification templates
- Pain point → tile activation mapping
- Color palette (within brand system)
- "Items" label (Repair Orders / Plants / Tickets / Clients)

### What No Vertical is EVER Allowed to Duplicate

This is the hard rule. Violation creates drift and breaks the platform:

- ❌ Never initialize a new Supabase client — import from shared
- ❌ Never write new auth/session/login logic — configure shared auth
- ❌ Never write new QB OAuth or invoice logic — wire shared modules
- ❌ Never write new notification/email/SMS logic — use shared sendNotification()
- ❌ Never add qrcode.js directly to a vertical — import from shared/qr
- ❌ Never write new trial clock logic — import from shared/stripe/trial
- ❌ Never add UI primitives (Button, Card) to a vertical — import from shared/components
- ❌ Never hardcode a vertical name in a shared module (no 'IGNITION_OS_DATA' in shared)

---

## Design Principles

These principles govern how TRACE products are built and how TRACE AI sessions are conducted. They are listed here — in the architecture document — because they have architectural consequences. Both are provisionally named; names are open for revision after 30–60 days of use (see CLAUDE.md Open Architecture Decisions).

### **Surface Honesty** *(name provisional)*

Every visible UI element in any TRACE product must do something meaningful when interacted with. A button that looks active and produces only a flash on click is a credibility leak — the customer doesn't think "that button isn't done yet," they think "this product doesn't work."

The pitch to small business owners is that TRACE is the connective tissue that *works*. The first dead button a prospect clicks is the first crack in that pitch. Every silent button compounds the credibility tax across the entire demo.

**Three legal states for any UI element:**

1. **WORKS** — the action does what its label implies
2. **LABELED** — visible state shows "coming soon," "configure first," or similar; clicking shows an honest modal explaining the state ("This feature is in setup. Want to configure it now?")
3. **HIDDEN** — if neither WORKS nor LABELED is achievable, the element is not in the UI

**What's forbidden:** the fourth state — looks active, clicks, does nothing. This state is the default when developers (human or AI) build a UI element ahead of its backing logic. Surface Honesty inverts that default. Build the LABELED modal first if necessary, or hide the element until WORKS is achievable.

**Application:** Every new UI element gets reviewed against this rule before merge. Existing dead-button states (see TRACE_PLATFORM_AUDIT.md's "UI Surface State — Cultivar OS (May 25 snapshot)" section) are technical debt to be cleared before any next demo.

**On the name:** "Surface Honesty" is a provisional label. The principle is locked; the name may be revised after 30-60 days of use. See CLAUDE.md Open Architecture Decisions.

---

### **Honest Friction** *(name provisional)*

When David gives an instruction that conflicts with something already settled in the docs — strategy, architecture, vertical naming, customer state, schema decisions, design principles — neither Claude.ai nor Claude Code may silently comply. The conflict is surfaced, discussed, and resolved deliberately.

Silent compliance with contradictory instructions is how three failure modes compound invisibly:

1. **Drift** — a decision made in conversation today and a decision documented in the repo from last week disagree, and the disagreement only surfaces months later when both have produced downstream consequences.
2. **Hidden debt** — workarounds get implemented for legitimate reasons (urgent demo, customer pressure, time constraint), but the workaround status is forgotten and the code is treated as the intended architecture.
3. **Lost reasoning** — when instruction X conflicts with decision Y, there's usually a *reason* X is being requested. If the conflict isn't surfaced, the reason disappears with it.

**The behavior:** When a conflict is detected, pause before complying. Surface the conflict to David in clear terms — what's being asked, what's already settled, where they disagree. Wait for explicit resolution.

**The three legal resolutions:**

1. **Update the docs.** The new instruction is correct; the existing decision was outdated or wrong. Update the canonical doc to reflect the new truth in the same session.
2. **Defer the decision.** The conflict is real but not resolvable right now. Add an entry to CLAUDE.md's Open Architecture Decisions list with a target resolution window.
3. **Acknowledge as tech debt.** The new instruction is a workaround that intentionally violates the architectural intent for a real-world reason. Execute it, but add an entry to CLAUDE.md's Tech Debt Log describing the workaround, the correct architecture, and what triggers the repair.

**What's forbidden:** silent execution of an instruction that contradicts a documented decision, with no record of the contradiction. This is the failure mode Honest Friction exists to prevent.

**Application:** This principle applies to Claude.ai (strategy and chat sessions), Claude Code (build sessions), and David (when reading code or docs that contradict what was said in conversation). All three parties are accountable for the friction.

**On the name:** "Honest Friction" is a provisional label. The principle is locked; the name may be revised after 30-60 days of use. See CLAUDE.md Open Architecture Decisions.

---

## PART 5 — VERTICAL CONFIG — THE MASTER SWITCH

This is the file that makes the platform work. One entry per vertical.
Adding a new vertical means adding one block to this file. Everything else
inherits automatically.

```typescript
// packages/shared/src/config/verticalConfig.ts

export type VerticalId =
  | 'ignition-os'
  | 'cultivar-os'
  | 'conduit-os'
  | 'kinna-os'
  | 'coolrunnings'

export const VERTICAL_CONFIG = {

  'ignition-os': {
    appName: 'Ignition OS',
    tagline: 'Stop losing margin on parts, tools, and labor.',
    tenantTable: 'shops',
    tenantIdField: 'shop_id',
    itemLabel: 'Repair Orders',
    itemLabelPlural: 'Repair Orders',
    authPattern: 'pin',                    // PIN keypad for kiosk use
    roles: ['owner', 'service_writer', 'tech'],
    defaultAddons: [],
    qbEnabled: true,
    qbLineItemFormat: 'ro_number',
    trialReportFocus: 'labor_and_parts',
    pricingTiers: {
      starter: 149,
      professional: 299,
      premier: 499,
    },
    colors: {
      primary: '#1E3A5F',                  // Ignition blue-slate
      background: '#F0F4F8',
    },
    activeTiles: [
      'customer_intake', 'job_lifecycle', 'tech_kiosk',
      'tool_tracking', 'margin_engine', 'invoice',
      'omni_analytics', 'admin_billing',
    ],
  },

  'cultivar-os': {
    appName: 'Cultivar OS',
    tagline: 'Every plant tracked. Every add-on captured.',
    tenantTable: 'nurseries',
    tenantIdField: 'nursery_id',
    itemLabel: 'Plant',
    itemLabelPlural: 'Plants',
    authPattern: 'email',                  // Email/password for nursery owners
    roles: ['owner', 'manager', 'staff'],
    defaultAddons: ['netting', 'compost', 'fertilizer', 'mulch'],
    qbEnabled: true,
    qbLineItemFormat: 'species_container',
    trialReportFocus: 'addon_leakage',
    pricingTiers: {
      starter: 149,
      professional: 299,
      premier: 499,
    },
    colors: {
      primary: '#27500A',                  // Deep forest green
      background: '#EAF3DE',              // Light sage
    },
    activeTiles: [
      'plant_profile', 'addon_leakage', 'inventory_value',
      'install_schedule', 'loss_tracking', 'qr_generator',
    ],
  },

  'conduit-os': {
    appName: 'Conduit OS',
    tagline: 'Stop losing margin on parts and unbilled callbacks.',
    tenantTable: 'shops',                  // same schema as ignition — fork
    tenantIdField: 'shop_id',
    itemLabel: 'Service Ticket',
    itemLabelPlural: 'Service Tickets',
    authPattern: 'pin',
    roles: ['owner', 'dispatcher', 'tech'],
    defaultAddons: [],
    qbEnabled: true,
    qbLineItemFormat: 'equipment_service',
    trialReportFocus: 'refrigerant_and_callbacks',
    pricingTiers: {
      starter: 149,
      professional: 299,
      premier: 499,
    },
    colors: {
      primary: '#1A4731',                  // Conduit green-slate
      background: '#EDF4F0',
    },
    activeTiles: [
      'service_intake', 'equipment_registry', 'dispatch_board',
      'refrigerant_tracker', 'maintenance_agreements', 'van_inventory',
      'permit_tracker', 'margin_engine', 'invoice',
    ],
  },

  'kinna-os': {
    appName: 'KINNA-OS',
    tagline: 'The technology handles the mechanical. You handle the human.',
    tenantTable: 'organizations',
    tenantIdField: 'pantry_id',
    itemLabel: 'Client',
    itemLabelPlural: 'Clients',
    authPattern: 'email',
    roles: ['executive_director', 'program_director', 'staff', 'volunteer'],
    defaultAddons: [],
    qbEnabled: true,                       // Financial assistance → QBO
    qbLineItemFormat: 'assistance_category',
    trialReportFocus: 'clients_served_and_units_distributed',
    pricingTiers: {
      basic: 49,
      standard: 149,
      pro: 299,
    },
    colors: {
      primary: '#5B4FCF',                  // KINNA-OS purple (TBD — placeholder)
      background: '#F5F4FF',
    },
    activeTiles: [
      'qr_checkin', 'client_intake', 'tefap_eligibility',
      'distribution_menu', 'clothing_voucher', 'voice_receiving',
      'financial_assistance', 'pastoral_care', 'dreams_pathway',
      'broadcast_composer', 'social_composer', 'command_center',
      'grant_generator', 'sop_pipeline',
    ],
    // KINNA-OS unique flags
    bilingualRequired: true,
    offlineRequired: true,                 // Distribution day must work offline
    legalComplianceModule: 'tefap',
  },

  'coolrunnings': {
    appName: 'CoolRunnings',
    tagline: 'Your home runs itself.',
    tenantTable: 'properties',
    tenantIdField: 'property_id',
    itemLabel: 'Zone',
    itemLabelPlural: 'Zones',
    authPattern: 'email',
    roles: ['owner', 'admin'],
    defaultAddons: [],
    qbEnabled: false,                      // No QB for home automation
    qbLineItemFormat: null,
    trialReportFocus: 'energy_and_presence',
    pricingTiers: {
      monitoring: 49,
      full: 99,
    },
    colors: {
      primary: '#2D6A4F',
      background: '#F0F7F4',
    },
    activeTiles: [
      'climate_control', 'presence_detection', 'energy_monitoring',
      'irrigation_management', 'security_alerts', 'voice_control',
    ],
  },
}
```

---

## PART 6 — AUTH STRATEGY

### The Problem Being Solved

Ignition OS uses PIN-based auth (kiosk, shop floor, no keyboard).
Cultivar OS and KINNA-OS use email/password (owner on desktop/tablet).
CoolRunnings uses email/password (homeowner on phone).
Conduit OS uses PIN (field tech on tablet).

One auth module must support both patterns. The vertical config drives which
pattern is used. No vertical writes its own auth logic.

### The configureAuth() Pattern

```typescript
// packages/shared/src/supabase/auth.ts

export type AuthPattern = 'pin' | 'email'

export interface AuthConfig {
  vertical: VerticalId
  pattern: AuthPattern
  roles: string[]
  redirectAfterLogin: string
  redirectIfNoSession: string
  sessionTimeoutMinutes?: number    // default: 480 (8hrs)
  kioskLockMinutes?: number         // PIN only: auto-lock after inactivity
}

export function configureAuth(config: AuthConfig) {
  return {
    login: config.pattern === 'pin'
      ? (pin: string, tenantId: string) => pinLogin(pin, tenantId)
      : (email: string, password: string) => emailLogin(email, password),
    logout: () => supabase.auth.signOut(),
    getSession: () => supabase.auth.getSession(),
    getRole: () => getRoleFromSession(config.roles),
    PrivateRoute: buildPrivateRoute(config),
  }
}
```

### Role Permission Matrix

| Action | volunteer | staff | manager | owner / PD / ED |
|---|---|---|---|---|
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| Process transactions | ✅ | ✅ | ✅ | ✅ |
| Edit inventory/clients | ❌ | ✅ | ✅ | ✅ |
| View financial data | ❌ | ✅ | ✅ | ✅ |
| Override caps/limits | ❌ | ❌ | ❌ | ✅ |
| Connect QB / billing | ❌ | ❌ | ✅ | ✅ |
| Pastoral care access | ❌ | ❌ | ❌ | ✅ (KINNA-OS only) |
| Grant tools | ❌ | ❌ | ❌ | ✅ (KINNA-OS only) |
| Admin / settings | ❌ | ❌ | ✅ | ✅ |

---

## PART 7 — ONBOARDING STRATEGY

### The Governing Principle

Onboarding is a business intelligence conversation, not a setup wizard.
The owner describes their business. The app configures itself. We learn
what they have, what they want, what their pain is, and who supplies them.
That data makes the platform smarter for every future customer.

### The Shared Onboarding Shell

Five steps. Same shell for every vertical. Vertical config provides the
question sets for steps 2, 3, and 4.

```
Step 0 — What kind of business?
   Business type selector → sets vertical, loads verticalConfig

Step 1 — Tell us about your business
   Name, address, state (tax rate auto-fills), phone, email
   SHARED — identical for every vertical

Step 2 — What do you sell / serve TODAY?
   Vertical-specific inventory shape question
   Examples:
     Nursery: Trees · Shrubs · Annuals · Bulk · Services · Contractor
     Auto shop: Import · Domestic · Diesel · Fleet · All
     Pantry: TEFAP · SNAP-Ed · Food Rescue · Clothing · Financial Assistance

Step 3 — What do you WANT to add?
   Growth intentions — activates Coming Soon tiles
   Each "want" triggers vendor question:
     "Do you have a supplier for that, or are you still looking?"
   Answers stored in growth_goals table

Step 4 — What's your biggest pain right now?
   Pain point selection → drives tile priority on dashboard
   Each selection activates specific tiles as primary
   Examples:
     "Missed sales" → addon_leakage tile surfaced first
     "Inventory" → inventory_value tile surfaced first
     "QuickBooks" → QB connect flagged as CRITICAL in Step 5
     "Reporting" → analytics tile surfaced first

Step 5 — Connect your tools
   QuickBooks: flagged CRITICAL if QB was a pain point
              flagged RECOMMENDED otherwise
              skippable — dashboard works, invoices won't auto-create
   Other integrations per vertical (Oasis for pantries, etc.)

Step 6 — You're ready
   Dashboard configured from their answers
   Active tiles: what they have today
   Coming Soon tiles: what they said they want
   First action card: their biggest pain point, solved first
```

### Growth Intentions Data Model

```sql
-- What they want but don't have yet
CREATE TABLE growth_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,           -- nursery_id, shop_id, pantry_id
  vertical     text NOT NULL,
  category     text NOT NULL,           -- 'bulk_mulch', 'delivery', etc.
  status       text DEFAULT 'intended', -- intended | in_progress | active
  vendor_id    uuid REFERENCES vendors(id),
  created_at   timestamptz DEFAULT now(),
  activated_at timestamptz
);

-- Supplier relationships
CREATE TABLE vendors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  name          text NOT NULL,
  contact_name  text,
  phone         text,
  email         text,
  categories    text[],
  payment_terms text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);
```

### Pain Point → Tile Activation Map

| Pain Point Selected | Primary Tile | Secondary Tiles Activated |
|---|---|---|
| Missed sales / upsells | addon_leakage | inventory_value |
| Inventory / don't know what I have | inventory_value | loss_tracking |
| Scheduling / hard to track | install_schedule | customer_history |
| QuickBooks / invoicing slow | qb_connect (CRITICAL) | invoice |
| Reporting / can't see what makes money | analytics | margin_engine |
| Tools / things go missing | tool_tracking | barcode_scanner |
| Compliance / regulatory | compliance_module | documentation |
| Clients / outreach | broadcast_composer | re_engagement |

---

## PART 8 — DATA ARCHITECTURE

### Multi-Tenant Isolation Rule

Every table in every vertical MUST have a tenant_id column.
Every query MUST filter by tenant_id.
Every RLS policy MUST scope to the tenant from the JWT claim.
No exceptions. No cross-tenant data leakage is acceptable.

```sql
-- Every table follows this pattern
CREATE TABLE [table_name] (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  [tenant_id] uuid REFERENCES [tenant_table](id) ON DELETE CASCADE,
  -- ... other columns
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[table] scoped to tenant" ON [table_name]
  FOR ALL USING (
    [tenant_id]::text = auth.jwt()->>'[tenant_id_claim]'
  );
```

### Shared Schema vs Vertical Schema

**Shared schema** (lives in packages/shared, every vertical runs it):
- growth_goals — what tenants want to expand into
- vendors — supplier relationships
- notifications_log — all outgoing SMS/email
- ai_usage_log — per-tenant token tracking and cost allocation
- subscription_tiers — billing state per tenant

**Vertical schema** (lives in each vertical's migration folder):
- Ignition OS: shops, employees, repair_orders, parts, tools
- Cultivar OS: nurseries, plants, plant_events, orders, addons
- Conduit OS: shops, employees, service_tickets, equipment, refrigerant_log
- KINNA-OS: organizations, people, households, distributions, financial_assistance, prayer_requests
- CoolRunnings: properties, zones, devices, automations, sensor_readings

**Note:** The primary person-record table is `people` rather than `clients`. The KINNA philosophy explicitly states that the people walking through the door are "not clients, not cases, not recipients" — naming the table `clients` would contradict that at the data layer. `people` is broader (accommodates volunteers, donors, pastoral contacts, staff, and service recipients alike) and doesn't pre-commit the schema to any one role taxonomy.

### LLM Placement Rules (from KINNA-OS — applies platform-wide)

```
Zone 1 — NO LLM (deterministic code only):
  Auth, eligibility checks, unit calculations, tax math, RLS,
  QR scan/lookup, subscription gating, trial clock

Zone 2 — ON-DEMAND AI (user triggered, synchronous):
  ID scan auto-fill, appointment briefing, invoice description,
  broadcast draft, bilingual translation, grant narrative,
  damage/plant/equipment photo analysis

Zone 3 — ASYNC BACKGROUND AI (batch, non-blocking):
  SOP generation, community intelligence, re-engagement targeting,
  order/inventory forecasting, grant opportunity detection,
  savings report generation (Day 12)
```

---

## PART 9 — VERTICAL SUMMARIES

### Ignition OS — Auto/Diesel Repair
- **Pilot status:** Dry run active
- **Target:** 1-5 bay owner-operator shops
- **Pitch:** "Stop losing margin on parts, tools, and labor. 14 days free."
- **Close:** Savings number from their own jobs during trial
- **Unique:** 13-state RO job lifecycle, tool barcode chain of custody, labor clock,
  customer e-sign portal (legal-grade), Margin Engine slab pricing
- **QB:** Invoice per RO — labor + parts line items
- **CAC:** ~$38-50 hardware kit
- **LTV (PRO, 24mo):** $7,176

### Cultivar OS — Nursery/Garden Center
- **Pilot status:** Demo May 25 — LAWNS Tree Farm LLC, Leander TX
- **Contacts:** Terry (owner), Lauren Bishop (manager)
- **Pitch hook:** "Regina drove 40 minutes home at 25mph because the $20 netting
  was offered two minutes after she said goodbye."
- **Target close:** $149/mo founding beta, locked forever
- **Unique:** Per-plant QR tag with 4-year growth timeline, add-on leakage
  dashboard, transport-triggered netting prompt
- **QB:** Invoice on checkout — species, container, add-ons as line items
- **Invoice on hand:** #3648.380 — $920.13 PAID — MS30 + VSC30

### Conduit OS — HVAC/Plumbing/Electrical
- **Status:** Strategy complete — 66-90 hours to build from Ignition OS fork
- **Target:** 1-3 truck owner-operators
- **Competitive gap:** ServiceTitan/Housecall Pro start at $199-599/mo,
  require 5+ trucks. Conduit OS owns the 1-3 truck market.
- **Fork approach:** ~80% reuse from Ignition OS. Rename UI labels,
  re-write AI prompts, build 6 new tiles.
- **New tiles:** Equipment Registry, Refrigerant Tracker (EPA 608),
  Maintenance Agreement Manager, Parts Van Inventory, Permit Tracker,
  Energy Efficiency Report
- **Close hook:** "An EPA 608 violation starts at $44,539 per day per violation.
  Our log costs $299/month."

### KINNA-OS — Food Pantry/Nonprofit
- **Pilot status:** Strategy and all SOPs written — OLH Phase 1 targets August 1
- **Pilot org:** Operation Liberty Hill, Liberty Hill TX
  Contact: Regina O'Brien (Program Director — David's wife)
- **Scale market:** Central Texas Food Bank 300+ partner agencies →
  Feeding America 60,000 pantries nationwide
- **Governing principle:** "The technology handles the mechanical parts so the
  humans can focus entirely on the human parts."
- **Unique:** TEFAP eligibility engine, voice receiving (hands-free food rescue),
  clothing voucher calculator, bilingual distribution menu, pastoral care module
  with prayer queue, dreams/pathway module with local resource matching,
  community intelligence from intake data
- **Integrations:** Oasis Insight (TEFAP reporting), QBO (financial assistance),
  MealConnect (food rescue), Neon One (donor CRM), Blotato (social media)
- **Pricing:** $49 basic / $149 standard / $299 pro (nonprofit-priced intentionally)
- **Phase 1 hard deadline:** August 1, 2026 — Back to School event
- **Critical path blocker:** Regina must call CTFB for Oasis API access
  (phone call, not email) by May 27

### CoolRunnings — Home/Property Automation
- **Status:** Live pilot at 770 Co Rd 284, Liberty Hill TX (David's property)
- **Hardware live:** HP ProDesk 600 G6 + HA OS + Zigbee mesh + 8 temp sensors
- **Different model:** Not SaaS subscription. Hardware install + monthly monitoring.
- **Pricing:** $149 assessment / $499 basic / $999 full / $1,499 rural / $49-99/mo
- **LAWNS connection:** Their 10× Rain Bird ESP-ME3 controllers =
  CoolRunnings highest-value commercial install
- **Future extensions:** Healthcare/aging-in-place (daughter's domain),
  STR automation, agricultural sensing

---

## PART 10 — CODE REUSE MAP

### What Every Vertical Inherits (Zero New Code)

| Module | Ignition | Cultivar | Conduit | KINNA  | CoolRunnings |
|---|---|---|---|---|---|
| Supabase client | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth (configureAuth) | ✅ PIN | ✅ Email | ✅ PIN | ✅ Email | ✅ Email |
| Trial engine | ✅ | ✅ | ✅ | ✅ | ✅ |
| LockedOverlay | ✅ | ✅ | ✅ | ✅ | ✅ |
| QB bridge | ✅ | ✅ | ✅ | ✅ | ❌ |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI router | ✅ | ✅ | ✅ | ✅ | ✅ |
| Onboarding shell | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shared components | ✅ | ✅ | ✅ | ✅ | ✅ |
| verticalConfig | ✅ | ✅ | ✅ | ✅ | ✅ |

### What's Vertical-Specific (Per-Vertical Code)

| Module | Lives In | Notes |
|---|---|---|
| Plant profile + timeline | cultivar-os | Unique to nursery |
| TEFAP eligibility engine | kinna-os | Federal income table, govt compliance |
| Voice receiving | kinna-os | Web Speech API + Claude parsing |
| Pastoral care | kinna-os | Privacy-critical, never shared |
| Refrigerant tracker | conduit-os | EPA 608 compliance |
| Maintenance agreements | conduit-os | HVAC recurring revenue |
| Equipment registry | conduit-os | Replaces vehicle database |
| Job lifecycle (13 states) | ignition-os | Auto shop RO workflow |
| Tool tracking + barcode | ignition-os | Can be ported to conduit |
| HA integration | coolrunnings | Home Assistant specific |
| Zigbee mesh config | coolrunnings | Hardware specific |

---

## PART 11 — BUILD PRIORITIES (SOLO BUILDER EDITION)

### Reality Check

Current team: David OBrien + Claude Code.
Connor: promoted to AI team — not available.
Andrew: learning — not yet load-bearing on platform code.
Daughter: not yet formally joined.

**This is a one-person build with an AI developer.
Every timeline must be honest about that.**

### Sequenced Build Order

```
NOW — MAY 25
  Cultivar OS demo — 6 requirements, real URL, LAWNS meeting

MAY 26–31 — GROUND TRUTH
  Fill in CLAUDE.md — multi-AI handoff state document
  Run Ignition OS Supabase audit — what's real vs localStorage
  Document exact state of packages/shared — what exists vs missing

JUNE 1–15 — SHARED FOUNDATION
  Build verticalConfig.ts — the master switch
  Build configureAuth() — unified auth, both patterns
  Build shared components — Button, Card, Badge, LockedOverlay
  Build shared QR module — from IgnitionMobile reference
  Migrate QB modules — remove IGNITION_OS_DATA hardcoding

JUNE 15 – JULY 15 — IGNITION OS STABILIZATION
  DataBridge → Supabase migration (Connor's original work, now David's)
  Plain JS → TypeScript port (incremental, file by file)
  First Ignition OS pilot shop install
  Trial engine validated end-to-end

JULY 15 – AUGUST 1 — KINNA-OS PHASE 1
  August 1 hard deadline — Back to School event at OLH
  QR check-in, client intake, TEFAP eligibility
  Digital distribution menu (replaces green paper form)
  Voice receiving (replaces paper weights log)
  Back to School registration flow

AUGUST — CONDUIT OS FORK
  Fork Ignition OS → Conduit OS
  UI re-label (vehicle → equipment, RO → ticket)
  AI prompts rewritten for HVAC
  Identify 3 pilot HVAC shops in Liberty Hill / Georgetown corridor

SEPTEMBER+ — PLATFORM STORY
  3 revenue streams active
  Shared modules fully extracted and proven
  verticalConfig driving all three verticals
  Investor story: "80% reuse proven across 3 verticals"
```

---

## PART 12 — DECISION LOG

Architectural decisions that are locked. Do not reverse without explicit
written justification added to this log.

| # | Decision | Rationale | Date | Forecloses |
|---|---|---|---|---|
| 1 | Supabase is source of truth — never localStorage | Multi-tenant, RLS, real-time, offline-capable | May 2026 | DataBridge as primary storage |
| 2 | TypeScript for all new shared modules | Type safety across vertical imports | May 2026 | Plain JS in shared/ |
| 3 | Monorepo (trace-platform) — one repo, all verticals | Shared code written once, imported everywhere | May 2026 | Separate repos per vertical |
| 4 | verticalConfig.ts drives all variation | One file to add a vertical | May 2026 | Per-vertical config scattered in code |
| 5 | No vertical duplicates a shared module | Compliance audits enforced before merge | May 2026 | Local copies of auth, QB, QR, etc. |
| 6 | KINNA-OS: relief is a legitimate outcome | Pathway module staff-initiated only, never auto-triggered | May 2026 | Auto-pushing pathway to any client |
| 7 | KINNA-OS: LLM in Zone 1 is forbidden | Eligibility and unit calc are deterministic — no hallucination risk | May 2026 | AI on TEFAP eligibility path |
| 8 | CoolRunnings: local-first, zero cloud dependency | Works offline, survives vendor sunset | May 2026 | Cloud-dependent home automation |
| 9 | QB is RECOMMENDED not REQUIRED at onboarding | Checkout works without QB — just no auto-invoice | May 2026 | Blocking users who haven't set up QB |
| 10 | KINNA-OS integrates with Oasis/QBO/MealConnect/Neon — does not replace them | Each system serves a different constituency | May 2026 | Building donor CRM or TEFAP reporting in-house |

---

## PART 13 — OPEN QUESTIONS

Items that need a decision before the relevant vertical builds.

| # | Question | Vertical | Deadline | Owner |
|---|---|---|---|---|
| 1 | configureAuth() PIN vs email — exact interface design | All | June 1 | David + Claude |
| 2 | Oasis API access — Network Admin elevation | KINNA-OS | May 27 | Regina (phone call to CTFB) |
| 3 | Financial assistance policy POL-001 signed | KINNA-OS | June 6 | Regina + ED |
| 4 | QB plan confirmation for OLH — Simple Start or above | KINNA-OS | June 6 | Regina |
| 5 | Dignity Dollar — definition and workflow | KINNA-OS | June 6 | Pantry manager session |
| 6 | Back to School scope Q22–Q28 | KINNA-OS | June 6 | Regina |
| 7 | SOS amendment filed — technology/software services | All | Before first subscription | David |
| 8 | WHOIS privacy on conduit-os.com, trace-enterprises.com | Platform | July 1 or immediate | David |
| 9 | KINNA-OS domain — kinna-os.app or similar | KINNA-OS | Before Phase 1 build | David |
| 10 | Ignition OS DataBridge full Supabase audit results | Ignition OS | May 26 | Claude Code |

---

## PART 14 — HOW TO START EVERY SESSION

### Claude Code session starter (paste this every time)

```
Read PLATFORM_STRATEGY.md and CLAUDE.md before we begin.

Current vertical: [ignition-os / cultivar-os / conduit-os / kinna-os]
Current session: [session number or description]
Today's goal: [specific deliverable]

PLATFORM RULES — NON-NEGOTIABLE:
1. Check packages/shared/ before writing any new module
2. If it exists in shared → import and configure, do not rebuild
3. If it doesn't exist in shared → build it IN shared first, then import
4. Never hardcode a vertical name in a shared module
5. Never duplicate auth, QB, QR, notifications, or UI primitives
6. Do not modify another vertical's package without flagging first
7. Commit after every completed task

Do not start coding until you have confirmed which shared
modules this session will use and verified they exist.
```

### Claude.ai session starter (paste this every time)

```
Read PLATFORM_STRATEGY.md — this is the source of truth
for the TRACE multi-vertical platform.

Today's topic: [strategy / architecture / vertical design / investor materials]
Current status: [what phase, what's been completed]

I am a solo builder. Connor is no longer available.
Andrew is learning. All architectural decisions come to me.
Recommend the simplest path that a solo builder with
Claude Code can execute.
```

---

## PART 15 — INTEGRATION ARCHITECTURE

### The Governing Rule

Every business on the platform configures its own accounting
system and POS through a pluggable adapter layer. The platform
code never knows which provider is active. Integration failure
never blocks an order. New providers are added by implementing
the adapter interface — no changes to vertical code required.

### Market Reality (2026)

**Accounting:**
- QuickBooks: 82% US small business market share — default
- Xero: strongest challenger, better UI, growing US share
- Wave: free tier — important for nonprofits (KINNA-OS)
- FreshBooks: service businesses, freelancers
- QuickBooks Desktop: being discontinued — forced migration
  opportunity for competitors

**POS:**
- Square: 28% share, dominates 0-9 employee businesses
- Toast: 23% share, restaurant-specific
- Clover: 7% share, flexible hardware
- Shopify POS: best for businesses also selling online

**By vertical:**
- Ignition OS: QB ~90%, no POS (invoice-based)
- Cultivar OS: QB ~70%, Square most common POS
- Conduit OS: QB ~80%, no POS (invoice-based)
- KINNA-OS: QB Nonprofit ~60%, Wave ~25%, no POS
- CoolRunnings: not applicable (install + monitoring)

### The Adapter Interface

```typescript
// packages/shared/src/integrations/adapters.ts

interface AccountingAdapter {
  name:           string
  connected:      boolean
  createInvoice:  (order: Order) => Promise<InvoiceResult>
  findCustomer:   (email: string) => Promise<Customer | null>
  createCustomer: (customer: Customer) => Promise<string>
  syncPayment:    (invoiceId: string, amount: number) => Promise<void>
  getAuthUrl:     () => string
  handleCallback: (code: string, realmId?: string) => Promise<void>
  refreshToken:   () => Promise<void>
  testConnection: () => Promise<boolean>
}

interface POSAdapter {
  name:             string
  connected:        boolean
  processPayment:   (amount: number, method: string) => Promise<PaymentResult>
  refundPayment:    (transactionId: string) => Promise<void>
  syncInventory:    (items: InventoryItem[]) => Promise<void>
  getDailySummary:  (date: Date) => Promise<SalesSummary>
  testConnection:   () => Promise<boolean>
}
```

### The Adapter Registry

```typescript
// packages/shared/src/integrations/registry.ts

export const ACCOUNTING_ADAPTERS = {
  'quickbooks': { label: 'QuickBooks Online', recommended: true,  verticals: ['all'] },
  'xero':       { label: 'Xero',              recommended: false, verticals: ['all'] },
  'wave':       { label: 'Wave (free)',        recommended: false, verticals: ['kinna-os','cultivar-os'] },
  'freshbooks': { label: 'FreshBooks',         recommended: false, verticals: ['conduit-os','ignition-os'] },
  'none':       { label: 'Not yet',            recommended: false, verticals: ['all'] },
}

export const POS_ADAPTERS = {
  'square':   { label: 'Square',       recommended: true,  verticals: ['cultivar-os','kinna-os'] },
  'clover':   { label: 'Clover',       recommended: false, verticals: ['cultivar-os'] },
  'shopify':  { label: 'Shopify POS',  recommended: false, verticals: ['cultivar-os'] },
  'none':     { label: 'No POS',       recommended: false, verticals: ['all'] },
}
```

### The Database Table

```sql
CREATE TABLE business_integrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid REFERENCES businesses(id) ON DELETE CASCADE,
  integration_type text CHECK (integration_type IN (
    'accounting', 'pos', 'crm', 'email_marketing',
    'sms', 'food_rescue', 'donor_crm', 'tefap_reporting'
  )) NOT NULL,
  provider         text NOT NULL,
  access_token     text,           -- encrypted at rest
  refresh_token    text,           -- encrypted at rest
  token_expires_at timestamptz,
  realm_id         text,           -- QB: company, Square: location, Xero: tenant
  connected        boolean DEFAULT false,
  last_sync_at     timestamptz,
  last_error       text,
  config           jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  UNIQUE (business_id, integration_type)
);
```

### The Critical Rule

Integration failure NEVER blocks an order.

```typescript
export async function createInvoiceIfConnected(
  businessId: string, order: Order
): Promise<string | null> {
  const adapter = await getAdapter(businessId, 'accounting')
  if (!adapter.connected) return null   // no QB? fine
  try {
    const customer = await adapter.findCustomer(order.customer.email)
                  ?? await adapter.createCustomer(order.customer)
    const invoice = await adapter.createInvoice({...order, customerId: customer.id})
    return invoice.url
  } catch (error) {
    await logIntegrationError(businessId, 'accounting', error)
    return null   // order saves regardless
  }
}
```

### Build Priority

```
Phase 0 (demo — May 25):
  QuickBooks hard-wired — acceptable for demo

Phase 1 (post-demo):
  Refactor QB into QuickBooksAdapter
  Add NullAdapter (graceful no-op)
  business_integrations table live
  Onboarding integration step

Phase 2 (first non-QB customer):
  XeroAdapter
  WaveAdapter (KINNA-OS)
  SquareAdapter (nursery checkout)

Phase 3 (contractor portal):
  CloverAdapter
  ShopifyAdapter
  Cross-nursery routing respects each
  nursery's own payment processing
```

---

## PART 16 — CULTIVAR OS MODULE REGISTRY

### Modules and Phase

| Module | Description | Phase | Status |
|---|---|---|---|
| QR Plant Profile | Per-plant page, growth timeline, qty selector | Demo | 🔴 Building |
| Smart Checkout Add-Ons | Accessories sized to container at point of sale | Demo | 🔴 Building |
| QB Invoice Auto-Creation | Invoice writes itself on checkout | Demo | 🔴 Building |
| Owner Dashboard | Sales, inventory value, leakage alerts | Demo | 🔴 Building |
| Sized Add-On Engine | Planting mix/mulch/fertilizer sized to tree | Phase 1 | ⬜ Designed |
| Post-Sale Service Engine | Configurable triggers, follow-up queue | Phase 1 | ⬜ Designed |
| Seasonal Perishable Module | 14-day clock, aging dashboard, death tracking | Phase 1 | ⬜ Designed |
| Seasonal Order Forecast | History-based order recommendations | Phase 1 | ⬜ Designed |
| Business Insights | Add-on performance, follow-up conversion | Phase 1 | ⬜ Designed |
| Contractor Portal | Multi-nursery inventory, trade pricing | Phase 2 | ⬜ Designed |
| Integration Layer | Pluggable QB/Xero/Wave/Square adapters | Phase 2 | ⬜ Designed |
| Onboarding Flow | Business type, pain points, vendor questions | Phase 2 | ⬜ Designed |

### Key Design Decisions — Cultivar OS

| # | Decision | Rationale |
|---|---|---|
| 1 | Per-plant unique asset model (not qty stock) | Trees are individuals — each has a history, a tag, a journey |
| 2 | Seasonal module uses configurable windows — nothing hardcoded | Lauren's operation may differ from any default |
| 3 | Follow-up triggers configured by manager, not developer | Lauren owns the service business — no IT required |
| 4 | Integration failure never blocks checkout | A nursery can't lose a sale because QB is down |
| 5 | Netting prompt pre-checked when self-transport | The default must be protection — opt-out, not opt-in |

---

*TRACE Enterprises · Built with CAI*
*builtwithcai.com · ignition-os.com · cultivar-os.app*
*cultivar-os.com · conduit-os.com*

*This document is the memory of the platform.*
*Update it when decisions are made, not after.*
*Version it in the changelog when sections change.*
