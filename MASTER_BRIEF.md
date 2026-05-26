# MASTER_BRIEF.md

## Scope & Hierarchy

This document owns strategy, demo plan, revenue, philosophy, team, contacts, and the customer roster. When a question is about "what TRACE wants to be" or "what we're selling to whom," this doc answers it.

When this doc conflicts with another:
- For current code state, defer to TRACE_PLATFORM_AUDIT.md
- For target architecture, defer to PLATFORM_STRATEGY.md
- For session-by-session handoff state, defer to CLAUDE.md
- For the discovery module specifically, defer to DISCOVERY_MODULE_BRIEF.md (created Session 1b)

The source of truth is the repo on David's desktop. GitHub is backup. claude.ai chat memory is reference, never authoritative.

## TRACE Philosophy

TRACE is not a software replacement company. TRACE is a business intelligence layer for owner-operated small businesses. We connect what they have. We fill what they're missing. We show them their whole business in one place. The business never loses their existing tools. The switching cost is near zero. The value is immediate and visible.

Each tile on the dashboard is either a CONNECTOR (links to a tool the customer already uses) or a GAP-FILLER (adds a capability no existing tool provides). Every tile has three states: Active, Available (trial-eligible), or Locked (tier upgrade required). Customers see what's available without being sold to. The trial mechanic proves the value before the charge.

The one-sentence version: "We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself."

> **TRACE Enterprises — Built with CAI**
> Last updated: 2026-05-23
> Maintained by: David O'Brien
> **Purpose:** Single source of truth for strategy, build priorities, and competitive positioning.
> Both Claude.ai (strategy) and Claude Code (build) read this file at the start of every session.

---

## HOW TO USE THIS FILE

### For Claude Code sessions (terminal):
Start every session with:
> *"Read MASTER_BRIEF.md before we start. Current focus: [section name]."*

### For Claude.ai sessions (this chat):
Upload or paste this file and say:
> *"Here is the current MASTER_BRIEF. [Ask your question or describe your task]."*

### For team members / collaborators:
This file is the operating manual. Before touching any code or making any architectural decision, read the **Current Status**, **Active Decisions**, and **Plan of Action** sections. Update the **Changelog** at the bottom when you complete a milestone.

---

## PART 1 — THE COMPANY & PHILOSOPHY

### What We Are
TRACE Enterprises builds **Built with CAI** — a loosely-coupled business intelligence layer for owner-operated small businesses. We connect what they already have. We fill what their tools can't give them. We show the whole business in one dashboard.

### Loose Coupling — Illustrated
```
TIGHT COUPLING (what we avoid):
"You must use our invoicing system"
"You must migrate your data to us"
→ High friction, high risk, slow adoption

LOOSE COUPLING (what we build):
"Connect your QB — we write invoices to it"
"Connect your Instagram — we draft posts for it"
"Connect your calendar — we schedule from it"
→ Low friction, low risk, fast adoption
→ They keep their tools, we add intelligence
```

### Mission
Replace paper, gut-feel pricing, and lost margin with AI-native workflows — for the business owner who doesn't have an IT department.

### The Two Pitches

**To the business owner / operator:**
> "You already have QuickBooks. You already have Instagram. You already have a phone. We don't replace any of that. We connect it all and show you what's falling through the cracks."
> Close with: the specific gap their business has today — the Regina moment.

**To the investor / partner / acquirer:**
> "We built a composable AI platform and proved it in the highest-friction SMB vertical on earth. The architecture re-skins to any industry in 60 days. Each vertical is a new revenue stream. The platform is the business."
> Close with: vertical expansion roadmap + 80% code reuse proof + CAC/LTV math.

**Rule:** Never lead with the platform story to a business owner. Lead with the dollar they're losing today.

---

## PART 2 — THE PLATFORM ARCHITECTURE

### Core Stack (Built Once, Inherited by Every Vertical)

| Layer | What It Is | Reusable? |
|---|---|---|
| Database | Supabase PostgreSQL — multi-tenant UUID isolation, Row Level Security | ✅ Yes |
| Auth | configureAuth() factory — email + PIN strategies, role-based routing | ✅ Yes |
| AI layer | AIEngine.js + ai_router.py — routes tasks to Claude/Gemini/Whisper by type | ✅ Yes |
| Tile system | TileGrid + Tile — 3 states (active/available/locked), per-tenant config | ✅ Yes |
| QB integration | OAuth + invoice + customer — vertical-agnostic | ✅ Yes |
| Notifications | send.ts + queue.ts — provider-agnostic (Resend + Twilio) | ✅ Yes |
| Social posts | generate-posts.ts + templates/ — vertical prompt templates | ✅ Yes |
| QR system | generate.ts + print.ts — asset tagging | ✅ Yes |
| Frontend | Vercel deployment, modular tile system, tier gating | ✅ Yes |

### Integration Registry — All Connectors

| Connector | What it does | Cultivar | Ignition | Priority |
|---|---|---|---|---|
| QuickBooks Online | Invoice creation, customer sync, OAuth | ✅ Live | 🟡 Partial | P1 |
| Blotato | Social media post publishing | ✅ Live | ❌ | P2 |
| Anthropic Claude | AI post generation, analysis, suggestions | ✅ Live | 🟡 Routed | P1 |
| Supabase | Database, auth, storage | ✅ Live | 🟡 Partial | P1 |
| Resend | Transactional email | 🟡 Wired | ❌ | P1 |
| Twilio | SMS notifications | 🟡 Wired | ❌ | P1 |
| Stripe | Billing + subscriptions | ❌ | ❌ | P1 |
| Google Maps | Delivery routing, geocoding | ❌ | ❌ | P2 |
| Google Calendar | Scheduling, installs, service | ❌ | ❌ | P2 |
| Gemini | Vision AI (invoice scan, VIN) | ❌ | 🟡 Routed | P2 |
| OpenAI/Whisper | Voice transcription | ❌ | 🟡 Routed | P3 |
| Samsara/Geotab | Fleet telematics | ❌ | 🟡 UI only | P3 |

### Gap-Filler Registry — Capabilities We Own

These are TRACE-owned capabilities with no external dependency. Each is a competitive moat.

| Capability | Description | Status |
|---|---|---|
| Missed revenue detection | Flags declined add-ons, skipped upgrades | ✅ Live (Cultivar) |
| Asset growth timeline | Visual history from creation to sale | ✅ Live (Cultivar plants) |
| Urgency copy engine | Regina Rule — time-sensitive add-on prompts | ✅ Live (Cultivar) |
| QR → checkout → QB invoice | Full flow, one scan, no typing | ✅ Live (Cultivar) |
| AI social post generation | 3 posts per order, vertical templates | ✅ Live (Cultivar) |
| Multi-provider AI router | Claude/Gemini/Whisper by task type | ✅ Live (shared) |
| Module tile system | 3-state per-tenant tile grid | ✅ Live (both) |
| Invoice audit AI | Photo → Claude flags uncaptured charges | ✅ Concept (Ignition) |
| ROI / savings report | Dollar value of TRACE to this business | 🟡 Built (shared) |
| Suggestion engine | Post-transaction upsell + scheduling | 🟡 Partial (Cultivar addons) |

### Domain & Infrastructure

```
builtwithcai.com                    ← Platform home. Investor story.
├── cultivar-os.vercel.app          ← Nursery vertical (active)
├── ignition-os.builtwithcai.com    ← Auto shop vertical (dry run)
└── conduit-os.builtwithcai.com     ← HVAC vertical (next)
```

---

## PART 3 — REVENUE MODEL

### The Trial Engine (Same Across All Verticals)

| Day | Event |
|---|---|
| Day 1 | Onboarding complete. Trial starts. Full access, no card. |
| Day 7 | In-app nudge: "X transactions processed, $Y in value tracked" |
| Day 12 | Auto-generated savings report. Owner gets a call. |
| Day 14 | Trial expiry warning. Tiles gray at midnight. |
| Day 15 | Data visible but blurred. Subscribe button prominent. |
| Day 30 | Data archived (not deleted). Retrieval triggers subscription. |

### Subscription Tiers

| Tier | Price | Target |
|---|---|---|
| STARTER | $149/mo | Getting off paper, first connection |
| PROFESSIONAL | $299/mo | AI-first workflow, multiple integrations |
| PREMIER | $499/mo | Multi-location, full module suite |
| FOUNDING | $149/mo locked | First customers per vertical — forever |

### Module Economy — Add-On Billing

Every tile beyond core is a billable module. Owner enables/disables from dashboard. Stripe adjusts automatically.

**Core (included in base subscription):**
- QR Checkout
- QuickBooks integration
- Owner dashboard
- Basic inventory / asset tracking
- Customer records

**Add-on modules (per month):**

| Module | Price | Vertical |
|---|---|---|
| Social Media + AI posts | $19/mo | All |
| Follow-Up Engine | $19/mo | All |
| Online Shop | $19/mo | All |
| Business Insights | $19/mo | All |
| Equipment Tracking | $19/mo | All |
| Delivery Routing | $29/mo | All |
| GPS Tracking | $29/mo | All |
| Seasonal Module | $29/mo | Cultivar |
| Water System Module | $29/mo | Cultivar |
| Greenhouse Module | $29/mo | Cultivar |
| PMI — Preventive Maintenance | $29/mo | All |
| Contractor Portal | $49/mo | All |
| EPA Section 608 | $29/mo | Conduit |
| DOT Compliance | $29/mo | Ignition |

**Bundle: all modules = $149/mo add-on**
(doubles MRR per customer at Professional tier)

**MRR potential per customer:**
- Base only: $299/mo
- Base + all modules: ~$450/mo
- Founding: $149 + modules at standard cost

### Unit Economics

| Metric | Value |
|---|---|
| Hardware kit per pilot | ~$35 |
| AI API cost during trial | ~$3–5 |
| Total CAC per pilot | ~$40–50 |
| Monthly revenue (PRO) | $299 |
| Payback period | < 1 month |
| LTV at 24-month retention (PRO) | $7,176 |
| Gross margin (software only) | ~80%+ |

---

## PART 4 — THE SUGGESTION ENGINE

Every completed transaction is a revenue opportunity. The suggestion engine fires after every order, service, or interaction.

### Three Suggestion Types

**1. IMMEDIATE ADD-ONS (during checkout)**
Items that must be added now or never.
Pre-selected, urgency copy, high prominence.
→ Add to current invoice immediately.

**2. SCHEDULED SERVICES (post-checkout)**
Future services with configured intervals.
No charge today — reminder fires at interval.
→ Queue in follow-up engine.
→ New invoice created when booked.

**3. REORDER REMINDERS**
Consumables that need periodic replacement.
→ SMS/email at configured interval.
→ Customer self-books or staff follows up.

### Cross-Vertical Examples

```
Ignition OS:
  Oil change → "Add crush washer?" (pre-selected, $2.50)
  Brake job → "Brake fluid flush recommended — add it?"
  Service complete → "Schedule next oil change in 90 days?"

Cultivar OS:
  Tree purchased → "Fertilizer in 30 days?"
  Installation booked → "Spring mulch refresh in 180 days?"
  Netting declined → "Drive carefully reminder" (free)

Conduit OS:
  AC service → "Filter replacement in 30 days?"
  Refrigerant topped → "Schedule follow-up in 60 days?"
```

### The Rule Structure

```typescript
interface SuggestionRule {
  trigger: {
    event: 'order_complete' | 'item_purchased' | 
           'item_skipped' | 'service_complete'
    item_category?: string
  }
  suggestion: {
    type: 'add_to_invoice' | 'schedule_service' | 
          'reorder_reminder'
    name: string
    price?: number        // null = free reminder
    interval_days?: number
    urgency_copy?: string
  }
  display: {
    timing: 'during_checkout' | 'post_checkout' | 
            'scheduled_reminder'
    pre_selected: boolean
    prominence: 'normal' | 'high' | 'urgent'
  }
}
```

### Platform Location
```
packages/shared/src/suggestions/
  engine.ts       ← core logic
  scheduler.ts    ← recurring service scheduling
  templates/
    automotive.ts ← ignition-os rules
    nursery.ts    ← cultivar-os rules
    hvac.ts       ← conduit-os rules
```

Every decline is tracked. Dashboard shows: "X customers declined mulch refresh this month — est. $Y missed."

---

## PART 5 — VERTICAL ROADMAP

### V1 — Cultivar OS (Nursery) — ACTIVE
**Status:** Demo-ready. LAWNS Tree Farm LLC meeting May 25, 2026.
**Domain:** cultivar-os.vercel.app
**First customer target:** LAWNS Tree Farm LLC, Leander TX
**Contacts:** Terry (owner, 65), Lauren Bishop (manager)
**Hook:** QR scan → QB invoice in one flow. Missed upsell visibility.

**Full Cultivar OS Asset Scope:**
```
PLANTS (live)
  Trees, shrubs, perennials, annuals
  Container progression, QR tags, growth timeline
  Buy/sell/install workflow

EQUIPMENT (Phase 1)
  Tractors, skid steers, trailers
  Mowers, tillers, chippers, spray rigs
  PMI schedules, service history

WATER SYSTEMS (Phase 1)
  Filters (sediment, UV, carbon) — replacement intervals
  Water lines, manifolds, irrigation zones
  Flush schedules, water quality log

GREENHOUSES (Phase 1)
  Individual greenhouse tracking
  Temperature/humidity logs
  Capacity management, crop rotation

PMI (Phase 1 — from Ignition OS shared)
  All asset types: equipment + water + greenhouse
  Service schedules, overdue alerts
  Bypass log, service history per asset
```

**Cultivar OS Tile Inventory:**
- QR Checkout ✅ active
- QuickBooks ✅ active
- Online Shop — available (Phase 1)
- Social Media ✅ active
- Follow-Up — available (Phase 1)
- Delivery — available (Phase 1)
- Contractors — locked (Phase 2)
- Seasonal — locked (Phase 1)
- Insights — locked (Phase 1)
- Inventory — locked (Phase 1)
- Equipment PMI — locked (Phase 1)
- Water System — locked (Phase 1)
- Greenhouse — locked (Phase 1)

---

### V2 — Ignition OS (Auto / Diesel Repair) — DRY RUN
**Status:** End-to-end dry run in progress.
**Domain:** ignition-os.com
**Target:** Independent diesel/auto shops, 3–8 bays, $500K–$3M/yr
**Hook:** Margin engine — "what you charge vs. what the slab recommends"

**Ignition OS Tiles (Built):**
- Customer intake + approval portal
- Tech kiosk (mobile, PIN-based)
- Tool tracking + barcode (PMI, chain of custody)
- Margin engine (slab pricing, override audit)
- Labor clock + time ledger
- Invoice + payment
- OMNI analytics + velocity leaderboard
- Job lifecycle state machine (13 states)
- Admin + billing (trial clock, data blur)

**Pending before first customer:**
- Intuit production approval (separate app)
  Use INTUIT_PRODUCTION_APPROVAL_GUIDE.md
- Stripe billing integration
- Trial engine validation

---

### V3 — Conduit OS (HVAC / Plumbing / Electrical) — NEXT
**Status:** Pre-build planning complete.
**Domain:** conduit-os.com
**Target:** 1–3 truck owner-operators, $300K–$2M/yr
**Hook:** Parts markup gap. EPA Section 608 compliance.
**Build estimate:** 25–34 hours. Fork + configure.
**Asset shape:** Equipment (units, loads, vehicles)

---

### V4 — Anchor OS (Food Service / Restaurant)
**Status:** Planning.
**Target:** Independent restaurants, food trucks, catering.
**Hook:** Recipe cost vs. menu price — the food cost margin engine.

---

### V5 — FieldOS (Home Services — Larger Scale)
**Status:** Future.
**Target:** Landscaping, pool service, pest control — 5–20 trucks.

---

### V6 — StockOS (Retail / Boutique / Consignment)
**Status:** Future.
**Target:** Independent retail, boutiques, consignment shops.

---

## KINNA-OS — Identity and Definition

**KINNA-OS** is the TRACE vertical for faith-based and direct-service community nonprofits. It replaces the prior placeholder name "Pantry OS," which incorrectly anchored the vertical to food distribution when the actual work spans pastoral care, financial assistance, prayer follow-up, clothing, dreams, and a dozen other services.

### KINNA *(noun, verb)*

A coined word naming both a person and a posture.

**A kinna** *(n.)* — a person held as kin. Not a client, not a case, not a recipient. Someone known by name, met at the door as family, remembered between visits.

**To kinna** *(v.)* — to treat someone as kin. To remember their name. To remember their hopes and their dreams and their problems. To support without judgment. To forgive the way God forgives. To walk alongside them across years rather than transactions.

### Etymology

From the Old English *cynn* — kindred, those belonging together, family by blood or by covenant — with a soft trailing *-na* that turns it into something ongoing. Family as continuous action. Kin as a verb.

The word also reaches into the language scripture uses for the church — *brother and sister in Christ*, *the household of faith*, *love your neighbor as yourself.* When Jesus was asked who his family was, he gestured at the crowd: *whoever does the will of my Father is my brother and sister.* That's the posture. KINNA gives it a verb.

### What KINNA-OS is in the brand architecture

KINNA-OS is the engine underneath. It is not customer-facing branding. OLH stays OLH. The intake form says OLH. The thank-you letter says OLH. Volunteer training says OLH. KINNA-OS is the credential — "Powered by KINNA" — a quiet marker visible to other nonprofits, funders, and tank partners that signals "this organization runs on a real platform."

Customers of TRACE who run on KINNA-OS keep their own identity. KINNA is the system that connects their existing tools (Neon One, QuickBooks, MealConnect, Volgistics, etc.) and fills the gaps no existing nonprofit software fills.

### Why the name matters even though it stays mostly invisible

The definition does the philosophical work even when the word stays behind the scenes. When designing a new feature, the design test is "which choice is more *kinna*?" Every feature gets measured against whether it treats people as kin or as cases.

When another nonprofit evaluates the platform and asks "what makes this different from a regular CRM," the answer is the definition. *We built it on the assumption that the people walking through your door are kin, not cases. Everything else follows from that.*

### Tagline

*KINNA — powering nonprofits to soar upon wings of grace.*

OLH is the wings. KINNA is what lets them lift.

### Status of name approval

The name and definition above have been drafted and shared with Regina (OLH Program Director, anchor pilot customer). As of this session, Regina has not yet formally responded. If Regina suggests refinements, those land as follow-up commits to this section. The structural choice — KINNA-OS as the vertical name — is locked.

---

## PART 6 — PLATFORM AUDIT FINDINGS
*(From TRACE_PLATFORM_AUDIT.md — May 23, 2026)*

### Top 10 Things to Extract to shared/ Before Conduit OS

Ranked by: needed by 2+ verticals, hard to rebuild, highest strategic value.

| # | What | Why | Target Location |
|---|---|---|---|
| 1 | OnboardingWizard shell | Universal acquisition mechanic — Welcome→Setup→Path→TeamQR | `shared/src/onboarding/WizardShell.tsx` |
| 2 | Trial clock + data blur | Ignition has it, Cultivar has the seam but no enforcement. Neither has Stripe. | `shared/src/billing/useTrial.ts` |
| 3 | Abstract asset model | Plants + vehicles + loads = same shape: QR→record→event history | `shared/src/assets/` |
| 4 | Customer record + history | Cultivar creates duplicates; no directory; Conduit needs shippers | `shared/src/customers/` |
| 5 | Integration registry + OAuth UI | Both verticals need connect→health→disconnect pattern | `shared/src/integrations/` |
| 6 | Form component library | Severe duplication across both verticals already | `shared/src/components/forms/` |
| 7 | Settings page pattern | Every vertical needs: business info, tax/pricing, modules, integrations | `shared/src/settings/` |
| 8 | Dashboard metrics pattern | `api/dashboard.ts` in Cultivar is the right template — parameterize | `shared/src/dashboard/` |
| 9 | Notification log + history | Type exists in shared types.ts but no migration or UI | `shared/src/notifications/` |
| 10 | RLS policy templates | Two-phase approach: loose for demo → tight (owner_id) post-demo | `shared/docs/rls-pattern.md` |

### Known Technical Debt (Fix Before Conduit OS)

| Item | Location | Priority |
|---|---|---|
| `IGNITION_OS_DATA` hardcoded in QB oauth.ts | `shared/src/quickbooks/oauth.ts` | P1 — fix with integration registry |
| QB token refresh missing | `api/qbo/invoice/cultivar.ts` | P1 — demo critical |
| Customer deduplication | `CustomerCapture.tsx` | P1 — creates duplicates now |
| `nurseryPlan` hardcoded in useModules.ts | `cultivar-os/src/hooks/useModules.ts` | P2 |
| Resend + Twilio env vars unconfirmed | `shared/src/notifications/send.ts` | P2 |
| Stripe not wired in either vertical | Both | P1 — before first paid customer |
| `owner_id` null on demo nursery row | Supabase nurseries table | P2 — tighten RLS post-demo |

### Open Questions Before Conduit OS

1. **Resend + Twilio** — are they actually wired with working API keys?
2. **Multi-nursery / multi-tenant** — what does auth→nursery_id lookup look like when LAWNS has a second location?
3. **Lauren staff roles** — configureAuth email strategy needs role from DB for manager vs owner access.
4. **QB token refresh** — 60-min expiry, no refresh logic. Fix before demo.
5. **Conduit asset shape** — what is Conduit's equivalent of a "plant"? Abstract asset model can't be extracted until the second vertical's asset shape is known.

---

## PART 7 — COMPETITIVE LANDSCAPE

### Tier 1 — Direct Vertical SaaS

| Competitor | Price | Our Angle |
|---|---|---|
| Tekmetric | $199–$599/mo | AI-native from day one; physical GTM |
| Shop-Ware | $299–$799/mo | Half the price, 14-day free trial |
| ServiceTitan | $398–$1,198/mo | SMB price, no contract, 14-day trial |
| Housecall Pro | $65–$299/mo | Same price band, but we do the thinking |
| Jobber | $49–$249/mo | Jobber is a notepad. We're an OS. |

### Our Defensible Moats

1. **Physical GTM** — hardware creates habit before first invoice
2. **Multi-vertical architecture** — competitors are monolithic
3. **Trial engine psychology** — real data by day 14, switching cost is emotional
4. **AI router** — three AI providers routing to best model per task
5. **Sub-$50 CAC** — hardware kit creates switching cost before first invoice
6. **Loose coupling** — we enhance existing tools, not replace them

---

## PART 8 — THE PHYSICAL GTM SYSTEM

### Hardware Kit (Target: Under $50 Per Business)

| Item | Purpose | Cost |
|---|---|---|
| Magnetic mount | Phone at workstation — always on app | ~$25 |
| Charging cable | Survives shop/nursery abuse | ~$10 |
| Voice cheat sheet | Printed + laminated — instant reference | ~$1 |
| Branded sticker | Logo visible daily | ~$2 |

**For demos:** Brother QL-820NWB — prints QR tags wirelessly in 3 seconds. The demo close.

---

## PART 9 — PLAN OF ACTION

### Phase 0 — Cultivar OS Demo (NOW)
**Goal:** Close LAWNS Tree Farm LLC as founding customer. May 25, 2026.

| Priority | Task | Status |
|---|---|---|
| 🔴 P1 | QB token refresh fix | In progress (Claude Code) |
| 🔴 P1 | Transport options → database (configurable) | In progress |
| 🔴 P1 | Demo run-through timed under 5 min | This weekend |
| 🔴 P1 | Print QR tags + invoice + agreement | This weekend |
| 🔴 P1 | Practice Regina story out loud 3 times | Before May 25 |
| 🟡 P2 | Settings page (tax rate, install price UI) | Post-demo |
| 🟡 P2 | Lauren manager role implementation | Post-demo |

### Phase 1 — After LAWNS Signs (Weeks 1–4)
**Goal:** LAWNS live on real data. Ignition OS first pilot shop.

| Priority | Task |
|---|---|
| 🔴 P1 | Connect LAWNS real QB (not sandbox) |
| 🔴 P1 | Lauren invited as manager role |
| 🔴 P1 | Settings page: tax rate, pricing, nursery info |
| 🔴 P1 | Transport options configurable by Lauren |
| 🔴 P1 | Customer deduplication at checkout |
| 🔴 P1 | Follow-up engine (post-sale service scheduling) |
| 🔴 P1 | Stripe billing integration |
| 🟡 P2 | Equipment PMI module |
| 🟡 P2 | Water system module |
| 🟡 P2 | Greenhouse module |
| 🟡 P2 | Online shop (/shop page) |
| 🟡 P2 | QR onboarding flow (new nursery signup) |
| 🟡 P2 | Ignition OS — Intuit production approval |
| 🟡 P2 | Ignition OS — first pilot shop install |

### Phase 2 — Platform Extraction (Before Conduit OS)
**Goal:** Extract top 10 shared modules. Conduit OS ready to build.

| Priority | Task |
|---|---|
| 🔴 P1 | Stripe trial engine extracted to shared |
| 🔴 P1 | Abstract asset model extracted to shared |
| 🔴 P1 | Integration registry extracted to shared |
| 🔴 P1 | Fix IGNITION_OS_DATA hardcode in QB oauth |
| 🔴 P1 | OnboardingWizard shell extracted to shared |
| 🔴 P1 | Settings page pattern extracted to shared |
| 🟡 P2 | Customer record + dedup extracted to shared |
| 🟡 P2 | Form component library extracted to shared |
| 🟡 P2 | Suggestion engine built in shared |
| 🟡 P2 | Notification log + communication history |

### Phase 3 — Conduit OS Build (60 days post-Phase 2)
**Goal:** Fork platform → HVAC vertical. First pilot operator.

| Priority | Task |
|---|---|
| 🔴 P1 | Define Conduit asset shape (equipment/loads) |
| 🔴 P1 | Fork platform → conduit-os branch |
| 🔴 P1 | Rename UI labels for HVAC context |
| 🔴 P1 | EPA Section 608 compliance tile |
| 🔴 P1 | Service Agreement Manager tile |
| 🟡 P2 | Conduit suggestion templates |
| 🟡 P2 | Conduit Intuit app + production approval |
| 🟡 P2 | First HVAC pilot operator |

---

## PART 10 — OPEN QUESTIONS & ACTIVE DECISIONS

| # | Question | Status |
|---|---|---|
| 1 | Resend + Twilio — actually wired with working keys? | Open — verify |
| 2 | Multi-nursery auth pattern | Open — design before Phase 1 |
| 3 | Lauren manager role in configureAuth | Open — Phase 1 |
| 4 | QB token refresh | In progress — demo critical |
| 5 | Conduit asset shape | Open — answer before Phase 3 |
| 6 | Stripe — which tier unlocks which modules? | Open |
| 7 | White-label platform for resellers? | Future decision |
| 8 | Outside funding at 10-shop milestone or bootstrap to 25? | Open |

---

## PART 11 — INTUIT PRODUCTION APPROVAL

See: `INTUIT_PRODUCTION_APPROVAL_GUIDE.md` in repo root.

**Vertical status:**

| Vertical | App Name | Submitted | Approved | Production Live |
|---|---|---|---|---|
| Cultivar-OS | Cultivar-OS | ✅ May 22, 2026 | ✅ May 22, 2026 | ✅ |
| Ignition-OS | TBD | ❌ | ❌ | ❌ |
| Conduit-OS | TBD | ❌ | ❌ | ❌ |

**Rule:** Each vertical needs its own Intuit app and separate production approval. Use the guide — takes 20 minutes with it.

---

## PART 12 — SECURITY & KEY MANAGEMENT

### API Key Locations

| Key | Location | Notes |
|---|---|---|
| ANTHROPIC_API_KEY | Vercel (cultivar-os) + Railway (ignition-os) | Rotate both when rotating one |
| QBO_CLIENT_ID (production) | Vercel (cultivar-os) | ABuTb3EU... |
| QBO_CLIENT_SECRET (production) | Vercel (cultivar-os) | d9mctADc... |
| QBO_CLIENT_ID (dev/sandbox) | Vercel (cultivar-os) | ABmD6ELs... |
| BLOTATO_API_KEY | Vercel (cultivar-os) | blt_Wq7U... |
| SUPABASE_SERVICE_KEY | Vercel (cultivar-os) | Never expose to frontend |

### Key Management Rules
- Never paste API keys into any chat interface
- Copy directly from source dashboard → paste directly into destination
- When rotating ANTHROPIC_API_KEY: update Vercel AND Railway in same session
- Production QB keys: never use for development/testing
- Sandbox QB keys: never use for production/demo with real customer data

---

## PART 13 — DEMO PLAYBOOK (LAWNS TREE FARM — MAY 25, 2026)

### Key Contacts
- **Terry** — owner, 65, male. Wants to retire. Approves if Lauren is confident.
- **Lauren Bishop** — manager. Overwhelmed. Wants the tech. The real buyer.
- **Address:** 400 Honeycomb Mesa, Leander TX 78641

### The Emotional Core
Lauren IS the Regina story. She's the one who ran out to the parking lot. The system doesn't just capture $20 in netting — it gives Lauren her afternoon back.

**The numbers that close Lauren:**
- 29 hours/month in manual work eliminated
- $149/month cost
- Net benefit: $1,906/month month 1

**The numbers that close Terry:**
- Investment protected
- Lauren stays sane
- Business runs without him

### Physical Items to Bring
- ✅ Laptop — QB connected, invoices visible
- ✅ Phone — cultivar-os.app loaded
- ✅ 3 printed QR tags: SCV-0031, NCM-0042, MS30-001
- ✅ Invoice #3648.380 — Regina & David O'Brien — $920.13 PAID
- ✅ Founding customer agreement (1 page)
- ✅ ROI one-pager

### Demo Flow (target: under 12 minutes)
1. Opening + invoice on table (2 min)
2. QR scan + plant timeline (1 min)
3. Regina story + netting moment (2 min) ← emotional peak
4. Checkout flow (1 min)
5. QB invoice appears (30 sec) ← magic moment
6. Lauren's dashboard (1 min)
7. Future features — one sentence each (1 min)
8. The close (1 min)

### The Close
> "$149 a month. Locked forever — that price never goes up. You're the business that shapes how this gets built."

### Post-Demo Follow-Up Email (if they ask to think)
```
Subject: Your plants are live

Layna,

cultivar-os.app/plant/SCV-0031
cultivar-os.app/plant/NCM-0042
cultivar-os.app/plant/MS30-001

Show anyone who picks up a plant tag this week.

David
```

---

## PART 14 — RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LAWNS doesn't close May 25 | Medium | High | Leave QR tags, set follow-up date |
| QB token expires during demo | Medium | High | Token refresh fix in progress |
| Intuit production issue day of demo | Low | High | Sandbox as fallback — still impressive |
| First pilot shop doesn't convert (Ignition) | Medium | High | 3 pilots simultaneously |
| Stripe not wired before first paid customer | High | High | Wire Stripe in Phase 1 immediately |
| Founder bandwidth limits installs | High | Medium | Define referral/installer partner program |
| Claude Code is institutional memory | Medium | High | All architecture in CLAUDE.md + this doc |

---

## PART 15 — CHANGELOG

| Date | Milestone | Who |
|---|---|---|
| 2026-05-12 | MASTER_BRIEF.md v1 created. Strategy session. | David + Claude.ai |
| 2026-05-22 | Cultivar OS demo-ready. QB production approved. Social module complete. Full checkout → QB invoice verified with real QB account. | David + Claude Code |
| 2026-05-23 | MASTER_BRIEF.md v2. TRACE_PLATFORM_AUDIT.md complete. Platform philosophy, module economy, suggestion engine, vertical roadmap documented. | David + Claude.ai |

---

## APPENDIX A — SESSION STARTERS

### Claude Code session:
```
Read MASTER_BRIEF.md and CLAUDE.md before we begin.

Current phase: [Phase 0 / 1 / 2 / 3]
Current focus: [specific task]
Today's goal: [deliverable]

Do not make architectural changes outside 
the current focus without flagging first.
```

### Claude.ai session:
```
Here is the current MASTER_BRIEF for TRACE Enterprises.
Today I need help with: [strategy / writing / planning]
Current status: [phase, what's been completed]
```

---

## APPENDIX B — KEY URLS & CONTACTS

```
Platform:         builtwithcai.com
Cultivar OS:      cultivar-os.vercel.app
Repo:             github.com/david-obrien61/trace-platform
Supabase:         bgobkjcopcxusjsetfob (cultivar-os)
Intuit app:       Cultivar-OS (TRACE workspace)
App ID:           c638ea14-22d0-4edb-a013-0c3a9aed535c

TRACE phone:      (512) 456-3632
TRACE email:      david@trace-enterprises.com
Demo nursery ID:  a1b2c3d4-0000-0000-0000-000000000001
Blotato user ID:  269df7e1-351d-4add-9111-3d42564b1fc6
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*MASTER_BRIEF.md v2 — May 23, 2026*
*Update this file every session. No exceptions.*
