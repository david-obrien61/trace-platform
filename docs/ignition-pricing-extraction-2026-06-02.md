# Ignition OS Pricing Structure — Extraction Audit
**Date:** 2026-06-02  
**Author:** Claude Code audit  
**Status:** Read-only. No code changed.  
**Context:** Foundational pricing extraction for TRACE-wide pricing review. Ignition OS has multiple pricing artifacts from different eras of development. This document reconciles them all into a single reference, flags gaps, and cross-references against current TRACE strategy.

**Files read:**
- `packages/ignition-os/modules/AdminSubscription.jsx` (subscription marketplace UI)
- `packages/ignition-os/DataBridge.js` (module registry, trial clock, tier logic)
- `packages/ignition-os/supabase/migrations/supabase_schema.sql` (tier enum)
- `packages/ignition-os/supabase/migrations/supabase_price_override_migration.sql` (job-level pricing)
- `packages/ignition-os/MarginEngine.js` (parts markup logic)
- `packages/shared/src/pricing/marginEngine.ts` (shared port of same)
- `MASTER_BRIEF.md` (canonical tier pricing, Part 3)
- `THOUGHTS.md` (operating thesis and tiered founding rate consideration)
- `packages/ignition-os/CoreApp.jsx` (trial gate UI)

**Note on `CAI/docs/pricing_sheet.html`:** MASTER_BRIEF.md line 190 cites `CAI/docs/pricing_sheet.html` as "the authoritative printable pricing doc for Ignition OS." The CAI archive folder no longer exists on the local machine — it was removed when the monorepo migration was completed (2026-05-28). The HTML file's content is believed to be the source of the MASTER_BRIEF tier table. The file itself cannot be read. This is noted as a gap: the authoritative pricing document referenced in MASTER_BRIEF does not exist in the active repository.

---

## TASK 1 — Pricing Data Files Found

### File 1: `packages/ignition-os/modules/AdminSubscription.jsx`
**Format:** React component (live UI)  
**Type:** Subscription marketplace UI — platform umbrella fee + per-module trial activation  
**Status:** Active (rendered in CoreApp when user navigates to MARKETPLACE)

Contains:
- Hardcoded state variable: `const [umbrellaPrice, setUmbrellaPrice] = useState(299)` — displayed as the "Current Umbrella Fee"
- Module subscription state (FLUX, PREDICTIVE, ESTIMATOR, CODE, STOK, PROT, HUB, PROC) with `active`, `tier`, `trialActive`, `trialStartedAt`
- 30-day "Deep Integration" trial per module
- Trial tiers always unlock PRO: `tier: 'PRO'` (shows the "Magic Moment")
- No Stripe integration — no payment processing, no price IDs, no checkout flow

**Important:** The $299 umbrella price is a React state default, not a database value. The `setUmbrellaPrice` setter exists but nothing in the component calls it — price is effectively hardcoded to $299 with no way to change it through the UI.

---

### File 2: `packages/ignition-os/DataBridge.js` — `getRegistry()`
**Format:** JavaScript constant (default, overridable from localStorage)  
**Type:** Per-module cost registry (mobile/pre-web era pricing)  
**Status:** Historical reference — these are costs loaded into the trial-era module registry from April 2026 (pre-web build, pre-monorepo). The `trialDate` values are April 2026 dates.

```javascript
getRegistry: () => {
  return DataBridge.load('system_registry') || {
    intake:    { cost: 49,  trialDate: '2026-04-01' },  // Work Orders
    queue:     { cost: 29,  trialDate: '2026-04-01' },  // Job Queue
    vin:       { cost: 99,  trialDate: '2026-04-01' },  // VIN Decode
    voice:     { cost: 149, trialDate: '2026-04-15' },  // Scribe AI
    estimates: { cost: 49,  trialDate: '2026-04-20' },  // Estimates
    parts:     { cost: 79,  trialDate: '2026-04-01' },  // Manifest
    procure:   { cost: 129, trialDate: '2026-04-10' },  // Procurement
    tools:     { cost: 19,  trialDate: '2026-04-01' },  // Tools Checklist
    admin:     { cost: 0,   trialDate: '2026-04-01' },  // Admin (free)
    crm:       { cost: 49,  trialDate: '2026-04-01' },  // CRM
    fleet:     { cost: 199, trialDate: '2026-04-12' },  // Fleet Management
    inv:       { cost: 89,  trialDate: '2026-04-01' },  // Stock AI
    kiosk:     { cost: 0,   trialDate: '2026-04-01' },  // Tech Kiosk (free)
  };
}
```

**Sum of all module costs if purchased à la carte:** $939/mo

---

### File 3: `packages/ignition-os/supabase/migrations/supabase_schema.sql`
**Format:** SQL migration  
**Type:** Tier enumeration on the `shops` table  
**Status:** Active schema

```sql
tier text default 'TRIAL' check (tier in ('TRIAL','STARTER','PROFESSIONAL','PREMIER'))
```

Four named tiers defined. No prices stored in the database. Tier is a status flag only — pricing is external to the schema.

---

### File 4: `MASTER_BRIEF.md` — Part 3 Subscription Tiers
**Format:** Markdown table (canonical business document)  
**Type:** Complete tier pricing with module availability matrix  
**Status:** Active — the most complete pricing definition in the codebase

This is the authoritative source. Full content extracted in Task 2.

---

### File 5: `packages/ignition-os/DataBridge.js` — `getShopTrialStatus()` and `checkTrialStatus()`
**Format:** JavaScript functions  
**Type:** Trial clock logic (not dollar amounts, but governs access gates)  
**Status:** Active

Two separate trial clocks:

**Shop-level trial** (14-day free trial for the shop/platform):
- Day 0–6: Active, no UI pressure
- Day 7: "Nudge" banner — daysRemaining shown
- Day 12: "Savings report ready" banner
- Day 14: Warning, tiles gray at midnight
- Day 15+: UI blurred, subscribe button prominent
- Day 30+: Data archived (not deleted)
- Paid shops (`policy.tier !== 'TRIAL'`): skip trial gate entirely

**Per-module trial** (30-day "Deep Integration" window):
- Starts when owner clicks "Start Free Trial" on a module
- Day 30+: Module shows blurred preview
- Returns `isExpired: diffDays > 30`

---

### File 6: `packages/ignition-os/supabase/migrations/supabase_price_override_migration.sql`
**Format:** SQL migration  
**Type:** Job-level price override tracking (NOT subscription pricing)  
**Status:** Applied to estimate_line_items table

```sql
ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS is_manual_override        boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_calculated_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_leakage             numeric(10,2);
```

This is leakage tracking — when a tech overrides the MarginEngine's suggested price, the gap is recorded. Separate concern from subscription pricing.

---

### File 7: `packages/ignition-os/MarginEngine.js` and `packages/shared/src/pricing/marginEngine.ts`
**Format:** JavaScript/TypeScript  
**Type:** Parts and labor markup engine (NOT subscription pricing — this is what shop charges its customers for parts)  
**Status:** Active (both versions identical in logic)

```javascript
const DEFAULT_MARGIN_CONFIG = {
  slabs: [
    { label: 'Consumables', maxCost: 50,   multiplier: 4.0  },  // $0–$50: 300% markup
    { label: 'Mid-Range',   maxCost: 200,  multiplier: 2.0  },  // $51–$200: 100% markup
    { label: 'Heavy',       maxCost: 1000, multiplier: 1.5  },  // $201–$1k: 50% markup
    { label: 'Major',       maxCost: null, multiplier: 1.25 },  // $1001+: 25% markup
  ],
  tierDiscounts: {
    FLEET:  10,   // 10% off for fleet accounts
    LEGACY: 20,   // 20% off for legacy/repeat customers
    FF:      5,   // 5% off for friends & family
  },
};
```

The slabs are per-job parts pricing. The tier discounts are customer-facing, not TRACE subscription tiers. These are fully configurable per shop via IgnitionProt (PROT module) — the defaults above apply until the owner changes them.

Rounds to nearest $.99 (`Math.ceil(retail) - 0.01`).

---

### File 8: `packages/ignition-os/CoreApp.jsx` — Trial gate UI
**Format:** React JSX  
**Line 1071:** `Subscribe — From $149/mo`

The trial expiration blur gate (day 15+) displays one price: `$149/mo`. This is the only dollar amount in the frontend UI other than the AdminSubscription.jsx umbrella fee.

**Discrepancy:** The blur gate says "From $149/mo" which matches the STARTER tier in MASTER_BRIEF. The AdminSubscription.jsx header displays `$299` as the "Current Umbrella Fee" which matches PROFESSIONAL. These two are in the same app and are inconsistent.

---

## TASK 2 — Pricing Structure Extracted

### Two-Layer Pricing Model

Ignition OS has two distinct pricing layers that coexist but don't interact in the code:

**Layer 1 — Platform subscription** (what TRACE charges the shop)  
**Layer 2 — Parts markup** (what the shop charges its customers — the MarginEngine)

This document covers Layer 1 only. Layer 2 is documented in Task 1 File 7 above.

---

### Layer 1A — Subscription Tiers (MASTER_BRIEF canonical)

| Tier | Price | Users | AI Access | Target Customer |
|---|---|---|---|---|
| **TRIAL** | Free, 14 days | Unlimited | Full PREMIER | No card, hardware kit included |
| **STARTER** | $149/mo | 3 | None | Getting off paper; first QB connection |
| **PROFESSIONAL** | $299/mo | 8 | AI Bundle (12 tasks) | AI-first workflow; multiple integrations |
| **PREMIER** | $499/mo | Unlimited | Full AI (13 tasks) | Multi-location; full module suite |
| **FOUNDING** | $149/mo locked forever | — | — | First customers per vertical |

---

### Layer 1B — Per-Tier Module Availability (Ignition OS)

Modules marked ⚡ require AI (Claude, Gemini, or OpenAI via AIEngine).

| Module | STARTER | PROFESSIONAL | PREMIER |
|---|---|---|---|
| Intake / Work Orders | ✅ | ✅ | ✅ |
| Tech Kiosk | ✅ | ✅ | ✅ |
| Estimates | ✅ | ✅ | ✅ |
| Customer Portal | ✅ | ✅ | ✅ |
| Tools Checklist | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ |
| VIN Decode ⚡ | — | ✅ | ✅ |
| Scribe AI ⚡ | — | ✅ | ✅ |
| DTC Cipher ⚡ | — | ✅ | ✅ |
| Parts & Manifest | — | ✅ | ✅ |
| Procurement | — | ✅ | ✅ |
| Stock AI ⚡ | — | ✅ | ✅ |
| CRM | — | ✅ | ✅ |
| OMNI Summary | — | ✅ | ✅ |
| Full OMNI ⚡ | — | — | ✅ |
| HUB Dispatch | — | — | ✅ |
| DOT Compliance | — | — | ✅ |
| Tools + PMI ⚡ | — | — | ✅ |
| Predictive Maintenance ⚡ | — | — | ✅ |
| Multi-Location | — | — | ✅ |
| White-Label Portal | — | — | ✅ |

---

### Layer 1C — Add-On Pricing (any tier)

#### Platform add-ons

| Add-On | Price | Notes |
|---|---|---|
| Extra Location | +$99/mo | Multi-location expansion |
| 5-User Block | +$49/mo | Users beyond tier limit |
| SMS | +$29/mo | Notification/outbound SMS |
| API Access | +$99/mo | Programmatic integration |

#### Cross-vertical module add-ons

| Module | Price | Verticals |
|---|---|---|
| Social Media + AI posts | $19/mo | All |
| Follow-Up Engine | $19/mo | All |
| Online Shop | $19/mo | All |
| Business Insights | $19/mo | All |
| Equipment Tracking | $19/mo | All |
| Delivery Routing | $29/mo | All |
| GPS Tracking | $29/mo | All |
| PMI — Preventive Maintenance | $29/mo | All |
| Contractor Portal | $49/mo | All |
| DOT Compliance | $29/mo | Ignition only |
| EPA Section 608 | $29/mo | Conduit only |
| Seasonal Module | $29/mo | Cultivar only |
| Water System Module | $29/mo | Cultivar only |
| Greenhouse Module | $29/mo | Cultivar only |

**All-modules bundle:** $149/mo add-on (effectively doubles MRR at PROFESSIONAL tier)

---

### Layer 1D — Mobile-Era Registry Costs (DataBridge, historical reference)

The `getRegistry()` function in DataBridge.js contains per-module costs dating from the April 2026 mobile build era. These predate the flat-tier model and appear to represent an earlier à la carte pricing concept. They are NOT the current pricing model but are present in active code as defaults.

| Module (Registry ID) | Display Name | Monthly Cost |
|---|---|---|
| `intake` | Intake | $49 |
| `queue` | Queue | $29 |
| `vin` | VIN Decode | $99 |
| `voice` | Scribe AI | **$149** |
| `estimates` | Estimates | $49 |
| `parts` | Manifest | $79 |
| `procure` | Procure | $129 |
| `tools` | Tools | $19 |
| `admin` | Admin | $0 (free) |
| `crm` | CRM | $49 |
| `fleet` | Fleet | **$199** |
| `inv` | Stock AI | $89 |
| `kiosk` | Kiosk | $0 (free) |
| **Total à la carte** | | **$939/mo** |

**Cross-reference note:** The Scribe AI module at $149/mo in the registry is the same dollar amount as the STARTER tier base subscription. The Fleet module at $199/mo in the registry exceeds the STARTER tier but is less than PROFESSIONAL. These registry costs are not wired to any billing system and appear to be early product thinking, not a current billing model.

---

### Layer 1E — AdminSubscription.jsx Module List (web era)

The web-era marketplace UI tracks a different set of modules than the mobile registry:

| AdminSubscription Key | Maps To | Trial Model |
|---|---|---|
| FLUX | IgnitionFlux (job workflow) | 30-day, unlocks PRO |
| PREDICTIVE | PredictiveKey (maintenance prediction) | 30-day, unlocks PRO |
| ESTIMATOR | IgnitionEstimate (job estimating) | 30-day, unlocks PRO |
| CODE | IgnitionCipher (DTC decode) | 30-day, unlocks PRO |
| STOK | IgnitionStok (inventory) | 30-day, unlocks PRO |
| PROT | IgnitionProt (margin engine) | 30-day, unlocks PRO |
| HUB | IgnitionHub (dispatch) | 30-day, unlocks PRO |
| PROC | IgnitionProc (procurement) | 30-day, unlocks PRO |

No dollar amounts appear in this UI component except the $299 umbrella fee header. No Stripe price IDs. No checkout flow. This is a trial-activation UI only, not a payment UI.

---

### Unit Economics (MASTER_BRIEF)

| Metric | Value |
|---|---|
| Hardware kit per pilot | ~$35 |
| AI API cost during trial | ~$3–5 |
| Total CAC per pilot | ~$40–50 |
| Monthly revenue (PROFESSIONAL) | $299 |
| Payback period | < 1 month |
| LTV at 24-month retention (PRO) | $7,176 |
| Gross margin (software only) | ~80%+ |
| MRR — base only | $299 |
| MRR — base + all modules | ~$450 |
| MRR — FOUNDING customer | $149 (locked) |

---

## TASK 3 — Pricing Model Characterization

### The Model

**Ignition OS uses a flat per-business subscription model with per-tier module gating and optional per-module add-ons.**

It is NOT:
- Per-user/per-seat (user limits exist by tier, but the base price doesn't scale with headcount)
- Per-vehicle/per-bay (bay count is in the schema, not in pricing)
- Per-usage (no metered billing, no per-API-call charges)

The model structure:

```
Base subscription (STARTER/PROFESSIONAL/PREMIER)
  + Modules unlocked by tier (no extra charge within tier)
  + Optional add-ons (per-module, per-month, independent of tier)
  + Platform add-ons (extra locations, extra user blocks)
= Monthly recurring revenue
```

### How the Trial Works

The 14-day shop trial grants full PREMIER access — every module available, no credit card required. This is the "no card required, hardware kit included" offer in MASTER_BRIEF. After 14 days:
- Days 14–15: Warning state
- Day 15: Data visible but blurred, subscribe button prominent
- Day 30: Data archived (retrievable with subscription)

Per-module trials are separate 30-day windows for modules beyond base tier. These represent upsell opportunities after the shop converts to STARTER — the PROFESSIONAL and PREMIER modules can be individually trialed.

### How Founding Customer Rates Work

**The founding rate is a discount on the base subscription only, locked forever.** Per MASTER_BRIEF line 262: "Founding: $149 + modules at standard cost."

This means:
- Founding customer pays $149/mo base (vs $149/$299/$499 depending on tier they'd otherwise be on)
- Module add-ons are at standard pricing (no founding discount on add-ons)
- The lock is forever — the rate cannot be raised for founding customers

In code: the founding rate is not implemented anywhere in the current codebase. The `shops.tier` enum includes TRIAL/STARTER/PROFESSIONAL/PREMIER but not FOUNDING. There is no FOUNDING value in the database schema, no Stripe price ID for a founding product, and no discount application logic. The founding rate exists in business documents only.

---

## TASK 4 — Cross-Reference With TRACE Strategy

### The Operating Thesis (THOUGHTS.md 2026-06-01)

The operating thesis captured in THOUGHTS.md on 2026-06-01 describes the founding rate structure:

> "**Locked-forever founding customer rates** — reward early risk-takers; LAWNS at $149/month is the prototype, though the structure may need tiering ($149 for first 10, $199 for next 15, $249 for next 25, $299 standard after) so the math works at self-serve scale"

The same document also notes:

> "Tiered founding rate structure (first 10 at $149, next 15 at $199, next 25 at $249, $299 standard) considered"

### What the Code Shows

The code predates this tiered founding concept. The mobile-era registry (DataBridge.getRegistry(), April 2026) shows individual module costs ranging from $19–$199. The web-era AdminSubscription.jsx (approximately May 2026) shows $299 as the umbrella fee. The MASTER_BRIEF (canonical, likely May-June 2026) establishes the three-tier flat subscription model.

The tiered founding rate consideration is the most recent thinking (captured 2026-06-01 in THOUGHTS.md) and does NOT yet appear in MASTER_BRIEF. MASTER_BRIEF shows only a single FOUNDING tier at $149 locked forever.

### Alignment Assessment

| Element | Ignition Code | MASTER_BRIEF | Operating Thesis (THOUGHTS) | Aligned? |
|---|---|---|---|---|
| Base subscription price | $299 (AdminSubscription.jsx state) | $149/$299/$499 by tier | $299 standard after tiered founding | Partially |
| Founding rate | Not implemented | $149 locked | $149 for first 10 (then tiered) | Not yet |
| Trial length | 14 days (DataBridge) | 14 days | — | ✅ |
| Trial scope | Full PREMIER (DataBridge) | Full PREMIER | — | ✅ |
| Module trial | 30 days per module | Not specified | — | No conflict |
| Per-module add-ons | Not wired to billing | $19–$49/mo list | — | Defined, not built |
| Stripe integration | None in codebase | Implied by billing model | — | ❌ Gap |

### What Needs to Propagate

The tiered founding rate decision (THOUGHTS.md 2026-06-01) should propagate to MASTER_BRIEF when it's confirmed. It is currently "considered" — the decision is not locked. Once locked, MASTER_BRIEF's FOUNDING row should be updated from:

> FOUNDING | $149/mo locked | — | — | First customers per vertical — forever

To something like:

> FOUNDING-1 | $149/mo locked | — | — | First 10 customers per vertical  
> FOUNDING-2 | $199/mo locked | — | — | Customers 11–25 per vertical  
> FOUNDING-3 | $249/mo locked | — | — | Customers 26–50 per vertical  

This decision is pending; do not update MASTER_BRIEF until David confirms. Log it here as a propagation pending item.

### The $149 Collision

The same dollar amount ($149/mo) appears in four distinct contexts:
1. **STARTER tier base price** — $149/mo, 3 users, no AI
2. **Founding customer rate** — $149/mo locked forever
3. **All-modules bundle add-on** — $149/mo on top of base subscription
4. **Scribe AI (voice) per-module cost** — $149/mo in the mobile registry

Items 1 and 2 being the same creates a product ambiguity: a FOUNDING customer at $149 is paying the same as a STARTER non-founding customer, but is locked at that rate forever and may receive different module access. The founding rate needs to specify which tier it maps to (STARTER? PROFESSIONAL?). MASTER_BRIEF doesn't specify; it just says "$149/mo locked" with no tier assignment. This is a gap that needs resolution before the first founding contract is signed.

**Current interpretation from MASTER_BRIEF line 262:** "Founding: $149 + modules at standard cost" — suggests founding customers are at STARTER tier features but PROFESSIONAL module pricing applies (they pay add-ons at standard rates). This interpretation is implied, not explicit.

---

## TASK 5 — Pricing Gaps

### Gap 1 — No Stripe integration anywhere in the codebase

**Severity: BLOCKER for self-serve**

There are zero Stripe price IDs, zero Stripe API calls, zero checkout flows, and zero webhook handlers anywhere in `packages/ignition-os/`. The AdminSubscription.jsx UI presents subscription management but clicking "Subscribe" anywhere goes nowhere — there is no payment processing.

Self-serve readiness plan (`docs/self-serve-readiness-plan-2026-05-31.md`) identifies this as 8 hours of effort for Cultivar OS. The same gap exists for Ignition OS. Neither vertical can process a self-serve subscription today.

---

### Gap 2 — Founding rate is not implemented

**Severity: LOW for current pilot (manual agreement), HIGH for self-serve**

The `shops.tier` enum has no FOUNDING value. There is no database concept of a founding customer. No lock mechanism prevents a founding customer's rate from being raised. MASTER_BRIEF says the rate is "locked forever" but there is no technical enforcement of this. 

For the LAWNS pilot: this is fine — the founding agreement is a signed document, and David is manually managing pricing. For self-serve scale: a founding Stripe price must be created and linked to the customer before the standard price can be changed.

---

### Gap 3 — Module add-on billing not wired to subscription system

**Severity: MEDIUM**

The MASTER_BRIEF module economy defines $19–$49/mo add-ons. The `system_subscriptions` DataBridge key tracks which modules are active. But activating a module in AdminSubscription.jsx only writes to DataBridge (localStorage) — it does not create or update a Stripe subscription line item. A shop could enable all modules for free by clicking "Start Free Trial" and never paying for them.

---

### Gap 4 — The two pricing registries are not reconciled

**Severity: LOW now, MEDIUM at billing implementation**

The mobile-era `getRegistry()` (DataBridge) has 13 modules with individual per-module costs ($19–$199). The web-era AdminSubscription.jsx has 8 modules in a flat umbrella model with no per-module dollar amounts. These two registries are not wired together and express different pricing models.

When billing is implemented, one canonical module list with one pricing model must be chosen. The mobile registry costs appear to be development-era thinking that predates the flat-tier model decision in MASTER_BRIEF.

---

### Gap 5 — Multi-location pricing is defined but not functional

**Severity: LOW until multi-location is built**

MASTER_BRIEF: "Extra Location: +$99/mo." The multi-location feature itself is not built (DataBridge schema placeholder only, confirmed in yesterday's multi-tenant audit). The pricing exists but the feature does not.

---

### Gap 6 — Professional services pricing is completely absent

**Severity: LOW (no Erin-managed services yet)**

No pricing exists for:
- Social media management (e.g., Erin managing a shop's Instagram account as a TRACE service)
- Setup / implementation fees
- Onboarding assistance
- Data migration from legacy systems (CSV importer exists for free, but assisted migration is unpriced)
- Training sessions

These are mentioned conceptually in MASTER_BRIEF and THOUGHTS.md but have no defined price, no contract template, and no billing mechanism. They would be billed outside the SaaS subscription — likely flat-fee per engagement.

---

### Gap 7 — DOT Compliance module pricing conflict

**Severity: LOW**

MASTER_BRIEF lists DOT Compliance in two places:
1. In the tier table: included in PREMIER (no add-on charge)
2. In the add-on table: $29/mo for Ignition

This is contradictory. If DOT Compliance is in PREMIER, shops on PREMIER shouldn't pay $29/mo for it. Likely intended: DOT Compliance is a $29/mo add-on for STARTER and PROFESSIONAL shops; it's included in PREMIER. The tier table and add-on table use different framing and haven't been reconciled.

---

### Gap 8 — AdminSubscription.jsx umbrella price is hardcoded with no write path

**Severity: LOW (cosmetic issue)**

```javascript
const [umbrellaPrice, setUmbrellaPrice] = useState(299);
```

`setUmbrellaPrice` is never called in the component. The price cannot be changed through the UI. This was likely built as a placeholder for a future billing integration. The $299 value is the PROFESSIONAL tier price per MASTER_BRIEF, but if a shop is on STARTER ($149) or PREMIER ($499), the displayed price would be wrong.

---

### Gap 9 — CAI/docs/pricing_sheet.html is missing from the repository

**Severity: MEDIUM**

MASTER_BRIEF.md line 190: "Official source: `CAI/docs/pricing_sheet.html` (printable pricing doc — authoritative for Ignition OS)"

This file was in the CAI archive which has been removed from the local machine. It was never imported into the monorepo. If the file contained pricing information beyond what's in MASTER_BRIEF (e.g., a formatted customer-facing price sheet, Stripe product IDs, or contractual language), that information is now inaccessible unless recovered from git history on the CAI repo or from David's memory.

**Action:** Confirm with David whether `CAI/docs/pricing_sheet.html` had anything not captured in MASTER_BRIEF's pricing tables. If yes, recover from `david-obrien61/CAI` repo git history. If no, update MASTER_BRIEF to remove the reference to a file that no longer exists.

---

## Summary — Current Pricing State

### What exists and is authoritative

| Artifact | Status | Location |
|---|---|---|
| Subscription tier names (TRIAL/STARTER/PROFESSIONAL/PREMIER) | ✅ In database schema | `supabase_schema.sql` |
| Tier prices ($149/$299/$499) | ✅ Defined in MASTER_BRIEF | `MASTER_BRIEF.md:184–188` |
| Module-per-tier availability matrix | ✅ Defined in MASTER_BRIEF | `MASTER_BRIEF.md:196–218` |
| Add-on module pricing ($19–$49/mo) | ✅ Defined in MASTER_BRIEF | `MASTER_BRIEF.md:237–256` |
| All-modules bundle ($149/mo) | ✅ Defined in MASTER_BRIEF | `MASTER_BRIEF.md:256` |
| Platform add-ons ($29–$99/mo each) | ✅ Defined in MASTER_BRIEF | `MASTER_BRIEF.md:220–224` |
| 14-day shop trial + day-by-day gates | ✅ Implemented in code | `DataBridge.getShopTrialStatus()` |
| 30-day per-module trial | ✅ Implemented in code | `AdminSubscription.jsx` + `DataBridge.checkTrialStatus()` |
| Parts/labor markup engine | ✅ Implemented in code | `MarginEngine.js` + `shared/pricing/marginEngine.ts` |
| Price override / leakage tracking | ✅ Implemented in database | `supabase_price_override_migration.sql` |

### What does not exist yet

| Item | Gap Type | Priority |
|---|---|---|
| Stripe integration (checkout, webhooks, subscription management) | Billing blocker | HIGH for self-serve |
| Founding rate as a database tier / Stripe product | Business model risk | HIGH before first contract |
| Module add-on billing wired to payment system | Revenue leak | HIGH for self-serve |
| Tiered founding rate decision ($149/$199/$249) | Strategic decision pending | MEDIUM |
| Multi-location pricing enforcement | Dependent on feature | LOW (feature not built) |
| Professional services pricing | Undefined product | LOW |
| DOT Compliance module pricing reconciliation (PREMIER included vs. $29 add-on) | Document conflict | LOW |
| `CAI/docs/pricing_sheet.html` — confirm or replace | Reference integrity | LOW |

---

*Read-only audit — no code changed. Pricing data reflects codebase state as of 2026-06-02.*  
*To implement billing: (1) Create Stripe products and price IDs for STARTER/PROFESSIONAL/PREMIER/FOUNDING tiers, (2) add `stripe_customer_id` and `stripe_subscription_id` columns to businesses/shops tables, (3) build checkout flow and webhook handler, (4) wire `shops.tier` to Stripe subscription status. The module add-on billing can follow after base subscription is live.*
