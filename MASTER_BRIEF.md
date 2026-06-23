# MASTER_BRIEF.md

## Scope & Hierarchy

This document owns strategy, demo plan, revenue, philosophy, team, contacts, and the customer roster. When a question is about "what TRACE wants to be" or "what we're selling to whom," this doc answers it.

When this doc conflicts with another:
- For current code state, defer to PLATFORM_AUDIT.md
- For target architecture, defer to PLATFORM_STRATEGY.md
- For session-by-session handoff state, defer to CLAUDE.md
- For the discovery module specifically, defer to DISCOVERY_MODULE_BRIEF.md (created Session 1b)

The source of truth is the repo on David's desktop. GitHub is backup. claude.ai chat memory is reference, never authoritative.

## TRACE — Who We Are

TRACE is a family. Terrence, Regina, Andrew, Connor, Erin. We named the company after ourselves around a kitchen table, because what we are building is meant to last longer than any one of us and meant to belong to all of us.

Who builds it today. David O'Brien — Terrence — is the builder today. 23 years 9 months military service, 30 years federal service in knowledge management, a lifetime as an electrician, mechanic, and builder. He writes the platform working with Claude and Claude Code as engineering partners. Andrew lives in the house and builds his own products alongside David. He established TRACE's foundation — set up Git, GitHub, Supabase, and Railway, and the working stack TRACE runs on. Before that setup, code was being lost. After it, every commit was preserved. The velocity that followed is built on the substrate Andrew laid down. Erin also lives in the house when she's not on travel nursing assignments; she's currently on an ER rotation in California. Connor visits regularly from out of state and is on call by video any time the work needs him. Regina is the program director at Operation Liberty Hill, the anchor pilot customer for KINNA-OS, and the voice the platform answers to on what it means to treat people as kin.

The five of us are not yet all on payroll. We are a family company in formation. The founder builds; the family is within reach; the runway to bring everyone in is what we are building toward.

The craft. Every TRACE product is Built with CAI — our signature on the work. The signature is literal: this software is built with composable AI as the engineering partner, used carefully, used well, used by people who know what good work looks like because they've done it with their hands for forty years.

The product line. We don't sell platforms. We sell the operating system for your kind of business: Cultivar OS for nurseries and garden centers, Ignition OS for diesel and auto repair shops, Conduit OS for HVAC, plumbing, and electrical, KINNA-OS for community nonprofits, CoolRunnings for homes. Each is its own product. Each is also part of the same family of software underneath — the way a small dedicated family ships fast and stays consistent.

The silent partner. We are not here to replace what you have. You already have QuickBooks, or Square, or Neon One, or a notebook full of phone numbers. You already have a business that works. What you don't have is enough hours in the day, and the gaps between your tools are where your time and your money are leaking out.

We come alongside, quietly. We connect what you already use. We fill the gaps no one else fills. We give you back your evenings. Your customers see you — not us. We are the silent partner that powers you to soar. For nonprofits, that partnership often shows up as "Powered by KINNA" — a quiet credential visible to funders and peers. For commercial businesses, it usually doesn't need a label at all. The OS is just the tool you use to run your day, made by a family who built it because they needed it themselves.

The one-sentence version: We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

> **TRACE Enterprises — Built with CAI**
> Last updated: 2026-06-11
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
TRACE Enterprises is a family-run software company building operating systems for owner-operated small businesses and nonprofits. Our products — Cultivar OS, Ignition OS, Conduit OS, KINNA-OS, CoolRunnings — are each built for one kind of business. Underneath, they share a single platform we call simply the shared layer, built once, inherited by every vertical. Our craft signature is Built with CAI: every TRACE product is built with composable AI as the engineering partner, used disciplined, used well.

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

**The structural foundation:** The platform is vertical-agnostic by construction — variation lives in data, never in schema. This is what lets a new vertical drop in without a migration, and it is the structural expression of the non-extractive, multi-vertical thesis. See PLATFORM_STRATEGY.md § Architecture Constants for the full design invariants.

---

## PART 1.5 — THE OPERATING MODEL

### Velocity as Evidence
TRACE Cultivar OS reached feature-complete status in five calendar days of focused work — first commit to packages/cultivar-os/ on May 18, 2026 at 10:35 AM; demo-hardened by May 22-23. The work was performed by a solo founder operating with Claude and Claude Code as engineering partners, on the substrate Andrew O'Brien established (Git, GitHub, Supabase, Railway). Ignition OS prework preceded it — 54 commits across 12 days in April 2026 in a separate repo (CAI), which surfaced platform patterns later extracted to the shared layer when Cultivar OS work began. The exact founding timeline is captured in docs/trace-founding-timeline-2026-05-27.md. The earliest verifiable TRACE timestamp is the GitHub account creation date of April 11, 2026.

### Geographic Freedom — The Underlying Why
TRACE is being built to be operated from anywhere with connectivity. David and Regina intend to live in Europe. The children — Andrew, Connor, Erin — are free to operate from wherever life takes them. The architecture, the processes, and the team rhythms all serve this end. This is the why behind the what. Every product decision and every operating decision is evaluated against the question: does this work when the founder is in Europe, the developer is in Texas, the nurse is on a travel assignment in California, and the customer is in Leander? When the answer is no, the decision is wrong.

### Resilience — The Bus Problem
Andrew and Connor both have GitHub access. Both know the laptop password. Both have working understanding of the stack. If David were unavailable for an extended period, TRACE could continue to operate. This is mitigation by family, not by process. The family being a family is the resilience plan.

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

### How TRACE Creates Value — Three Buckets

Every capability TRACE builds falls into one of three buckets. Together they explain why
"infinite verticals" is a real claim, not a marketing line.

**CONNECT** — Adapter to a tool the customer already uses (QuickBooks, Stripe, phone, calendar).
Value: elimination of dual entry and manual reconciliation. The customer already understands the
problem. We plug in and make it disappear.

**FILL THE GAP** — Capability with no external dependency; unserved value in the market.
Nobody sells missed-revenue detection to a nursery owner. Nobody sells urgency copy to a food pantry.
We own this entirely. It is our moat. It lives inside the platform, not in a third-party connector.

**SURFACE THE BETWEEN** — Cross-system AI inference that is only possible because CONNECT and
FILL THE GAP share the same `business_id` in the same schema.
- A shop's margin engine (FILL THE GAP) reads QuickBooks job data (CONNECT) and surfaces jobs
  that were profitable on paper but underpriced relative to actual labor — then drafts a social
  post explaining the value delivered.
- A pantry's voice receiving log (FILL THE GAP) cross-references TEFAP eligibility data (CONNECT)
  and flags items before they enter inventory incorrectly.
- A nursery's leakage detector (FILL THE GAP) cross-references what the tech offered, what the
  customer declined, and what the QB invoice captured (CONNECT) — then suggests the missed
  conversation for the next visit.

None of this works if CONNECT and FILL THE GAP live in separate products or separate schemas.
SURFACE THE BETWEEN is the payoff of the platform architecture. It is the answer to "why not just
use QuickBooks and a Google Sheet?"

### Gap-Filler Registry — Capabilities We Own

These are TRACE-owned capabilities with no external dependency. Each is a competitive moat.

| Capability | Bucket | Description | Status |
|---|---|---|---|
| Missed revenue detection | FILL THE GAP | Flags declined add-ons, skipped upgrades | ✅ Live (Cultivar) |
| Asset growth timeline | FILL THE GAP | Visual history from creation to sale | ✅ Live (Cultivar plants) |
| Urgency copy engine | FILL THE GAP | Regina Rule — time-sensitive add-on prompts | ✅ Live (Cultivar) |
| QR → checkout → QB invoice | SURFACE THE BETWEEN | Full flow, one scan, no typing | ✅ Live (Cultivar) |
| AI social post generation | SURFACE THE BETWEEN | 3 posts per order, vertical templates | ✅ Live (Cultivar) |
| Multi-provider AI router | CONNECT | Claude/Gemini/Whisper by task type | ✅ Live (shared) |
| Module tile system | FILL THE GAP | 3-state per-tenant tile grid | ✅ Live (both) |
| Invoice audit AI | SURFACE THE BETWEEN | Photo → Claude flags uncaptured charges | ✅ Concept (Ignition) |
| ROI / savings report | FILL THE GAP | Dollar value of TRACE to this business | 🟡 Built (shared) |
| Suggestion engine | SURFACE THE BETWEEN | Post-transaction upsell + scheduling | 🟡 Partial (Cultivar addons) |

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

| Tier | Price | Users | AI | Target |
|---|---|---|---|---|
| STARTER | $149/mo | 3 | None | Getting off paper, first connection |
| PROFESSIONAL | $299/mo | 8 | AI Bundle (12 tasks) | AI-first workflow, multiple integrations |
| PREMIER | $499/mo | Unlimited | Full AI (13 tasks) | Multi-location, full module suite |
| FOUNDING | $149/mo locked | — | — | First customers per vertical — forever |
| TRIAL | Free, 14 days | Unlimited | Full PREMIER | No card required, hardware kit included |

**Official source:** `CAI/docs/pricing_sheet.html` (printable pricing doc — authoritative for Ignition OS)

#### Per-Tier Module Availability (Ignition OS canonical)

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

**Add-ons (any tier):**
- Extra Location: +$99/mo
- 5-User Block: +$49/mo
- SMS: +$29/mo
- API Access: +$99/mo

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

### The Regina Principle — the thesis behind the engine

*(Doctrine-tier. This is the platform's reason to exist, stated in a demonstrable form. Anchor it with Regina the way the anti-Nelson story (DECISIONS.md OP-5) anchors the cost thesis.)*

**Thesis.** The owner already HAS the data and already KNOWS the business principles. What they cannot do is VISUALIZE the action hiding inside their own data. The platform's job is to **surface owner-known business principles against existing data, so the action becomes visible at the right moment and place** — moving the labor of *noticing what to do* off the owner's overloaded head and onto the tool. This is the same anti-Nelson spine as the cost thesis (flip the labor from owner to tool), applied to customer relationships and revenue rather than cost.

**The worked example — Regina (the anchor story).** Regina bought trees. We planted them. The data knows this. Months later the engine surfaces her: *"you're driving out her way — the trees are due a look."* That one prompted touch compounds into three stacked actions in a single visit:

1. **Courtesy check** — "we're in your area, want us to look at the trees?" (warranty / relationship principle; costs nothing, already there).
2. **Soft upsell, in context** — "by the way, we've got a fertilizer that'd be wonderful for these" (new-service-to-proven-buyer; offered standing in the yard, not cold).
3. **Free consult on the rest** — "and while we're here, we'll look at your other trees" (expand-the-relationship; seeds the NEXT opportunity).

One surfaced reminder → one visit → three services → trust → repeat business → word of mouth. The engine did exactly one thing to make the whole chain possible: **it reminded the owner that Regina existed, at the moment they were near her.** They'd have driven past. The data knew not to let them.

**The flywheel (the pitch to the customer, e.g. Lauren).** courtesy service → service sale → free consult → trust → repeat business → word of mouth. The owner KNOWS this is how a nursery grows; they just can't act on it systematically because nobody surfaces "here are the people this applies to, this week, on your way." The pitch is not "we schedule deliveries" — it is **"a delivery run becomes three sales you'd otherwise have missed."** That is revenue left on the table today, made visible.

**The principle set (a GROWING list — owner head-rules made systematic).** Each principle = a rule the owner holds + the data it runs on + the action it surfaces:

- **Warranty / courtesy-by-window** — a planted tree carries a ~6-month warranty → before it lapses is the moment to check in. *Data: customer + sale date (plant date ≈ sale date).*
- **New-service-to-proven-buyer** — a proven buyer is a warm candidate for a newly-offered service (e.g. fertilizer). *Data: purchase history + services catalog.*
- **Consult-to-expand** — while on-site, a free consult on their other trees seeds the next sale. *Data: customer relationship.*
- **Proximity-to-route** — a past customer near today's route is an almost-free touch. *Data: address + route (geocoding).*
- *(The list grows as the owner names more of their head-rules. The engine is the framework; principles are data/config added over time.)*

**Confidence honesty (the ladder applies here too).** Plant date is DERIVED from sale date (within a few days), NOT CONFIRMED. The surfaced action must show its precision honestly — "warranty closing ~late next month (est. from sale date)," never "expires July 28" when we don't hold an exact plant date. Same epistemic discipline as the cost engine (CONFIRMED / DERIVED / ESTIMATED; see DECISIONS.md D-9): the engine tells you what it knows AND how well it knows it. A surfaced opportunity is a human follow-up prompt, not an automated legal deadline — derived precision is correct and sufficient; precision theater would be the smoke.

**Services as the spine (the key dependency).** The Regina chain only works because the system knows three SERVICES: **planting** (→ warranty + relationship), **fertilizer** (→ new-service upsell), **consult** (→ expand). Services are currently UNMODELED. They are the spine the surfacing chain hangs on — not a side dependency. *Open question for the services model (captured, not resolved):* is a service a cost-ledger object (cost-to-produce + price, like a 30-gal Live Oak) or a JOB-like object (labor + visit + materials + schedule)? "Courtesy inspection" / "fertilizer visit" lean closer to a JOB than a product — resolve when services is built. Demo-seedable: planting + fertilizer + consult is enough to demo the full Regina chain end-to-end.

**Visualization layers (engine ≠ lens).** The surfacing ENGINE (principles → actions) is separate from how actions are SHOWN:

- **List / morning briefing** — near-term, NO map dependency. "This week's opportunities: Regina (warranty closing + fertilizer candidate), …" The engine earns its keep the moment the first principle fires into a list.
- **Map** — the NORTH-STAR lens that makes proximity visible (the showstopper demo: "you're driving past these 3 lapsed customers Tuesday"). Geocoding/maps is a Kind-2 vendor dependency — and an API-neutrality call per the platform's data covenant (a neutral utility, not a provider that buys loyalty). Map is map-ONLY; warranty/repeat principles surface fine as a list without it.

**Honest dependency ledger.**

- Customer entity — EXISTS (MB_D-014) ✓
- Purchase history (what + when) — exists / derivable from sale ✓
- Plant date — DERIVED from sale date (±days), no new capture needed ✓ (DERIVED confidence)
- Services catalog — UNMODELED; seedable as demo data ⚠️
- Address → proximity / geocoding — Kind-2 vendor (map lens only); list surfacing needs none ⚠️

**Build path (incremental — proves the thesis before the big build).**

1. **Principles → list** (near-term): warranty-closing + repeat-candidate fire from data we already hold; Regina appears in "this week's opportunities" with NO map. Proves the thesis cheaply.
2. **Services model + seed** (unlocks the upsell half).
3. **Principles → map** (NORTH-STAR): geocoding + route + proximity flags — the showstopper lens.

The three suggestion types below are the surface this thesis fires through.

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

### The social-intelligence surface — `[POINTER]`

Same surfacing family as the Regina Principle, applied to social/campaign output. **Scheduling layer**
(platform·day slots on a dual-layer calendar — steady cadence markers overlaid with event-bounded campaign
bands; one weekly aggregation rendered per-audience in the one voice; copy-and-go preserved, no auto-publish)
**+ measurement layer** (Erin O'Brien's design — 5 variations, owner-picks-vs-reality, the view→click→schedule
funnel, guided by **sales-correlation BI** as the honest first signal). Rides on the locked social doctrine
(weekly-aggregate · two-generators-one-voice · per-platform cadence · copy-and-go v1). Full record:
**`docs/CONCEPT-social-scheduling-and-measurement.md`**.

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

### V2 — Ignition OS (Auto / Diesel Repair)
**Status:** Web build infrastructure complete (2026-05-28). `packages/ignition-os/` is now the canonical source — web build verified at 1825 modules, zero errors. `CAI/` is archive. Vercel auto-deploy project ready to configure. Business logic is feature-complete; the voice subsystem is non-functional per docs/ignition-os-voice-audit-2026-05-27.md and requires remediation before any next demo. AI features (AIEngine tasks) require porting `ai_router.py` endpoints to Vercel functions before activation — app functions fully without them. Nine mobile-only modules remain renamed to `-delete.jsx` pending final deletion.
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
*(From PLATFORM_AUDIT.md — May 23, 2026)*

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

### Tier 2 — Job-Costing / Cost-to-Produce Landscape (2026, research-backed)

*Captured 2026-06-15 (THUNDER). The Cost-to-Produce design (`docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md`)
needed a read on who else does cost intelligence for small businesses. Reasoning below; **verify by search
at decision/build time — the market moves, treat none of this as frozen.***

**What exists.** Job-costing software today is mostly **vertical-specific** and built for the
**post-garage business with crews** (construction / job-shop, ~$6–50/mo/user up to ~$499/mo). The top end
is **ERP** (NetSuite et al.) at six-figure implementations. Pricing tools do the margin math; ERPs do
everything at six figures. Nothing in the middle is built for the solo, residence-rooted owner-operator.

**The gap (our wedge).** NEITHER tier serves the **garage-genesis owner-operator** — solo, residence-rooted,
no crew to track by job code, can't afford or implement ERP. No tool found combines all four of:
(a) garage-genesis / residence-root awareness (see node-model §5.0), (b) connector-not-replacement,
(c) the **honesty layer** (`cost_confidence`, cash-today, hidden-cost surfacing), (d) multi-vertical.

**Connector strategy is market-validated.** ~2/3 of small businesses run lean stacks (≤2 paid tools), are
cost-sensitive about software (41% report rising software costs), and will **not rip out QuickBooks** to
re-platform onto us. This validates TRACE's founding philosophy — *"we don't replace your systems, we
connect them and fill the gaps"* — OVER rip-and-replace. Most existing job-costing tools ask the owner to
**live inside them**; our differentiation is that we don't. They keep QB; we connect and surface what
QB / those tools don't.

**The philosophy is industry-recognized.** 2026 sources independently state our thesis: broad averages hide
the truth on custom / mixed / service work, and the failure mode is *"record costs, close the month, file
the report away — by then the chance to protect margin is gone."* Surfacing cost **while there's still time
to act** is the recognized gap existing tools don't close. That is our wedge, externally confirmed.

**The real threat — name it honestly.** NOT a direct competitor doing our exact thing. It is an **INCUMBENT**
(QuickBooks / Intuit, or a tool already in the stack) adding *"good enough"* cost intelligence. Incumbents
own the connection; if Intuit ships cost-to-produce, our connector advantage shrinks. **Watch the
incumbents, not startups.**

**Price band — defensible.** Comparable tools run $6–50/mo/user up to ~$499/mo; ERP is six figures. Our
**$149/mo founding rate** sits in a defensible band. The market supports the price.

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
| ANTHROPIC_API_KEY | Vercel (cultivar-os) + Vercel (ignition-os, when AI features are activated) | Railway is decommissioned for web builds |
| QBO_CLIENT_ID (production) | Vercel (cultivar-os) | ABuTb3EU... |
| QBO_CLIENT_SECRET (production) | Vercel (cultivar-os) | d9mctADc... |
| QBO_CLIENT_ID (dev/sandbox) | Vercel (cultivar-os) | ABmD6ELs... |
| BLOTATO_API_KEY | Vercel (cultivar-os) | blt_Wq7U... |
| SUPABASE_SERVICE_KEY | Vercel (cultivar-os) | Never expose to frontend |

### Key Management Rules
- Never paste API keys into any chat interface
- Copy directly from source dashboard → paste directly into destination
- When rotating ANTHROPIC_API_KEY: update both Vercel projects (cultivar-os and ignition-os)
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

Lauren,

cultivar-os.app/plant/SCV-0031
cultivar-os.app/plant/NCM-0042
cultivar-os.app/plant/MS30-001

Show anyone who picks up a plant tag this week.

David
```

---

## Current Customer State (as of 2026-05-26)

This section is the live snapshot of where each near-term customer relationship sits. Update this section at the start of any session where customer state has changed. If this section disagrees with anything else in this doc about a customer, this section wins because it is dated and intentionally maintained as ground truth.

### LAWNS Tree Farm (Cultivar OS prospect)

- **Stage:** Prototype demo pending. Demo was informally targeted for May 25 (passed). David texted Lauren morning of May 26 asking if she and Terry have connected internally. No response as of this session.
- **Prototype status:** Built but rough. Multi-pain mini-suite covering the netting upsell story, inventory lookup, and post-sale follow-up. Not Terry-ready; rough edges visible. Not yet polished to "approver demo" standard.
- **Buyer dynamic:** Lauren is the champion (feels the pain, drowning operationally). Terry is the approver (tech-shy, retirement-bound). Lauren will not move without Terry's approval.
- **Centerpiece narrative:** The netting upsell story — Regina bought trees at LAWNS, protective netting was offered after the sale had already closed, resulting in a regretful 40-minute slow drive home. Price discrepancy in offer: $20 actual, $36 quoted. The missed-upsell moment is the demo's emotional anchor.
- **Secondary narrative:** The stone-mason flowerbed story — David asked a local stone mason for an estimate. Mason came out, measured, took photos, promised the estimate that evening. Four days later the estimate never arrived; David hired someone else. The mason lost a job he wanted because his front-office workflow couldn't keep up with his hands. This is the TRACE thesis in one anecdote — the gap is "estimate didn't go out, deal died." A connector tile or gap-filler catches this.
- **Next move:** Hold demo until prototype is polished to Terry-ready on the single core flow (the netting story). Cut the mini-suite for the first demo. Demo champions early; demo approvers late.
- **Pricing/contract status:** Founding customer agreement template exists but not yet pitched to LAWNS.

### Operation Liberty Hill (KINNA-OS anchor pilot)

- **Stage:** Anchor pilot. Customer relationship established via Regina (David's wife, OLH Program Director).
- **Hard deadline:** Back to School distribution — Saturday, August 1, 2026, 9:00 AM – 12:00 PM at Cross Tracks Church. Registration window is already open and closes July 26. This date is fixed; it is not a soft target.
- **Phase 1 must-haves (for Aug 1):** Campaign engine + scheduler, Back to School campaign template seeded from Regina's 12-week cadence, registration form replacement (lift 4-child cap, structured shoe-size picker), shoe-size auto-tally engine, social composer driving Back to School campaign, donor thank-you queue (Neon One lookup + email/SMS routing), donation attribution from Neon One to active campaign.
- **Phase 1 should-haves:** Page content sync to Wix BTS page, job coaching intake form (New Beginnings — surfaces the hidden service), volunteer coordination read-only view (Volgistics + SignUpGenius).
- **Customer-side situation:** Regina has a firm job offer at another organization. She is trying to leave OLH gracefully without it failing. KINNA-OS Phase 1 is partly her transition gift — the system that lets her replacement run OLH without her. This shapes design priorities: anything that requires Regina's personal knowledge to operate is a Phase 2 concern; anything that captures her knowledge for her successor is Phase 1 critical.
- **Discovery module:** Discovery v1 build is pre-Aug-1, not post-Aug-1. See DISCOVERY_MODULE_BRIEF.md (created Session 1b). For Regina's onboarding specifically, voice-recorded conversation (Apple Voice Memos → Claude transcription) is acceptable in lieu of the built discovery surface. Flag this for further follow up reference David Said

### Ignition OS (diesel/auto shop pilot pipeline)

- **Stage:** Web build infrastructure complete (2026-05-28). Vercel project ready to configure. AI features need Vercel function ports before activation; all other functionality works now.
- **Status:** Not currently in front of a named prospect. Demo-ready inventory exists but cold outreach has not started.
- **Strategic position:** Ignition OS is the highest-leverage second iron in the fire. If LAWNS slows down or stalls, Ignition OS pipeline is the move because the diesel shop market is larger and the product is closer to ready than Cultivar's polish gap.
- **Next move:** Final walkthrough and demo-readiness audit (deferred until LAWNS pace clarifies, or when David has a 1-day block to focus on it).
- **Pricing/contract status:** Same founding customer agreement template as Cultivar; not pitched.

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
| 2026-05-23 | MASTER_BRIEF.md v2. PLATFORM_AUDIT.md complete. Platform philosophy, module economy, suggestion engine, vertical roadmap documented. | David + Claude.ai |
| 2026-05-27 | Brand framing rewrite: TRACE family architecture, Built with CAI as craft signature, silent partner philosophy made primary. | David + Claude.ai |
| 2026-05-27 | Brand framing committed: TRACE family architecture (Terrence, Regina, Andrew, Connor, Erin), Built with CAI as craft signature, silent partner philosophy as center, two new Design Principles (Honest Velocity, Epistemic Humility) added to PLATFORM_STRATEGY.md. The "TRACE — Who We Are" block is now synchronized across MASTER_BRIEF, PLATFORM_STRATEGY, DISCOVERY_MODULE_BRIEF, and PLATFORM_AUDIT. Three new Open Architecture Decisions logged (provisional names, family-member sign-off). | David + Claude.ai |
| 2026-05-27 | Session L: Factual corrections from founding timeline audit — Cultivar velocity language, Ignition status, founding doc reference. | David + Claude Code |

---

## PART 16 — DESIGN DECISIONS CAPTURED 2026-06-11

These decisions were settled in the 2026-06-11 session while building Receipt Keeper v1 (OCR → DB pipeline) and reviewing the grower inventory model. They are recorded here — not in code or migration files — because they shape the product thesis and constrain future feature work. They are locked; if a subsequent session challenges one of these, it must first read this section.

> **Decision-citation convention (binding):** Decision citations are source-prefixed: `MB_D-NNN` = MASTER_BRIEF decisions (this log, D-001..D-015); `D_D-NN` = DECISIONS.md decisions (D-10..D-16, the cost-model namespace). Never cite a bare D-number. Existing decisions keep their numbers — only the citation FORM changes going forward.

---

### D-001 — PLATFORM IDENTITY CONSTRAINT

**Decision:** TRACE is not a system of record. TRACE is a lens.

The authoritative version of any data record lives in the customer's own system — QuickBooks, Neon One, the notebook, the cash register. TRACE captures at the point of context (the transaction, the receipt scan, the service call) and derives insight. It does not aspire to replace the system the customer trusts for audit, compliance, or reporting.

**Test for any new feature:** Is this feature trying to be the authoritative record, or is it a derived view? If authoritative → push it to the customer's system (QB, their CRM). If derived → TRACE holds it as a lens, tagged by `business_id`, readable by that business only.

**Why it matters:** This constraint prevents scope creep into ERP/CRM territory, keeps the platform's value proposition clean (connect + fill + surface), and explains why QB write-back (receivables, expenses) is always in scope but "replacing QuickBooks" is explicitly not.

**Implication for Receipt Keeper:** The receipt is captured at point-of-purchase (the physical moment). The OCR result is a derived read. The line items are a derived extract. None of these are the authoritative accounting record — that lives in QB. Receipt Keeper feeds QB (future write-back), not the other way around.

---

### D-002 — CAPTURE-AT-POS PRINCIPLE

**Decision:** Capture happens on the mobile device at the physical moment of the transaction. Review and resolution happen on desktop, at a deliberate time.

Two roles in the pipeline:
- **Mobile / field role:** Capture the receipt / scan the QR / confirm the order. Minimal friction. The goal is zero-friction data entry at the moment the data exists.
- **Desktop / owner role:** Review the captured data, classify lines, reconcile totals, approve or correct. No urgency. Full screen.

**Why it matters:** If capture is friction-heavy, it won't happen consistently. If review is time-pressured, errors compound. Separating the two roles by device and timing lets each be designed for its actual context.

**Current state:** Receipt Keeper v1 captures on any device (no explicit mobile/desktop split in the UI yet). The confirm-before-write step is the beginning of the review layer. Future: a dedicated desktop review queue where multiple receipts can be classified and reconciled in a single session.

---

### D-003 — THREE-STATE LINE CLASSIFICATION

**Decision:** Every line item on a receipt is classified into one of three states: **BUSINESS / PERSONAL / NEEDS-A-DECISION**.

**Rules:**
- The receipt inherits a default classification at the top (e.g., "business receipt") and each line inherits that default.
- The user overrides only the exceptions — not the common case.
- **Zero-click common case:** A business-purpose receipt where all lines are business expenses requires no user action beyond the receipt-level classification.
- **NEEDS-A-DECISION:** Lines that are ambiguous (personal item bought on business card, mixed-use supply) park here with an optional why-note. The why-note is accountant-readable and enables hand-off without a meeting.
- **No fractional splitting in v1.** A fuel charge is either business or personal. The 70%/30% case is deferred to v2 (requires accounting sophistication the v1 target user doesn't have).

**Data model:** `line_items jsonb` (already built, 2026-06-11) stores the raw extracted lines. Classification state is a future column (`line_items_classified jsonb` or a separate `receipt_lines` table) when the review UI is built.

**Why it matters:** Three states is the minimum viable model. Two states (business/personal) forces the user to make a binary decision on every ambiguous line — which kills adoption. Four or more states (business/personal/mixed/capital/etc.) is accounting software, not a capture tool. Three states with a why-note is the right tension: enough to be useful to an accountant, not enough to require an accountant to set up.

---

### D-004 — RECONCILIATION ENGINE

**Decision:** The Receipt Keeper reconciliation engine compares summed line items against the stated receipt total and applies severity-scaled friction.

**Three outcomes:**
1. **Match (within tolerance):** Silent green indicator. No user action required. Most receipts.
2. **Small gap (e.g., tax rounding, missing a line):** Shown to the user — non-alarming, informational. "Total is $0.23 more than your lines." User can accept or correct.
3. **Large gap or overage (lines exceed stated total, or gap > threshold):** **HARD FLAG before save.** The user must reconcile with the physical receipt in hand before the record is written. The system does not save a materially wrong record silently.

**Surface Honesty application:** The system must not write a record it knows is inconsistent without telling the user. Silent rubber-stamping is a Surface Honesty violation. The severity-scaled friction model honors both the principle and the user's time — don't interrupt them for rounding noise, but stop them before they file a receipt that's off by $40.

**v1 state:** BUILT — `computeReconcile()` with MATCH_TOLERANCE $0.02, three severity outcomes (match/small_gap/large_gap), `ConflictDialog` blocks save on large_gap/overage, `reconcile_overridden_at` write path. Confirmed 2026-06-11 (McCoy's live test: green "Lines = Total"). Three-state LINE CLASSIFICATION (D-003 — business/personal/needs-a-decision per line) remains deferred to v2.

---

### D-005 — HONESTY LEDGER

**Decision:** For every OCR-extracted field, TRACE tracks what was presented to the user (the OCR read) versus what was sent to the database (what the user confirmed or corrected).

**Captured signals:**
- `accept_vs_edit` (already built, 2026-06-11): receipt-level — did the user accept the OCR output or edit any field?
- Future per-field: which specific fields were edited, from what value to what value?
- `ocr_cost_estimate` (already built, 2026-06-11): cost per receipt — operator visibility into AI spend.

**Purpose:** Two uses:
1. **Audit trail:** If a receipt is challenged, the ledger shows exactly what the AI read and exactly what the human confirmed. This is compliance-adjacent and earns trust with accountants.
2. **OCR quality signal:** Aggregate `accept_vs_edit` data across receipts reveals which vendors, receipt formats, or photo conditions produce bad reads. This feeds provider selection and prompt tuning decisions.

**v1 state:** Receipt-level honesty ledger is live (`accept_vs_edit`, `ocr_cost_estimate`). Per-field ledger is a v2 enhancement — requires the desktop review UI to instrument individual field edits.

---

### D-006 — RERUN-AS-LEARNING

**Decision:** Every OCR rerun on a receipt that previously failed (or was heavily edited) is a labeled training signal, not just a retry.

**What to log on rerun:**
- The original image (or a reference to it in storage)
- The original bad read (the prior `ocr_raw` output)
- The corrected values (what the user entered manually)
- The provider that generated the bad read
- The reason for rerun (explicit: user initiated; implicit: validation failed)

**Why it matters:** The failure mode for OCR is not random — it is systematic. Bad receipt paper, certain fonts, crumpled edges, poor lighting all produce predictable failure patterns. Logging labeled failures lets TRACE (a) tune the provider prompt, (b) flag image quality to the user before they submit, and (c) build a small training set that would support a fine-tuned model if volume ever justifies it.

**v1 state:** Not yet instrumented. The prerequisite is the rerun UI (user-initiated retry on a failed or corrected receipt). The data model is the `receipts` table (already has `ocr_raw`, `accept_vs_edit`) — logging the prior read alongside the corrected values is a two-column addition (`prior_ocr_raw jsonb`, `rerun_reason text`).

---

### D-007 — EVENT MODEL RESOLUTION (GROWER INVENTORY)

**Decision:** The grower inventory event model has exactly ONE primitive: **draw a count off a lot for a reason.** Reasons are data, not code branches.

**The primitive:**
```
lot (e.g., "250 Liberty Maples — 2024 crop")
 └─ event: draw N units for reason R
     ├── reason: graduate (moved to container, cost-to-ADVANCE)
     ├── reason: sell (left lot, revenue attached)
     ├── reason: die (loss, loss-rate tracked)
     └── reason: [new reason] ← new row in reasons table, zero code change
```

**Cost rides along:** Each event carries the cost-basis at the time of the draw. This enables the Cost-to-Produce tile — the loaded cost per unit at any stage — without requiring a separate accounting layer.

**Remaining = leftover, not a separate tracking object.** The remaining count is derived: lot.initial_count minus sum of all event draws. There is no "current inventory" field to update — the current state is always computed from events.

**Why "reasons are data, not code":** Adding a new event type (e.g., "donated," "composted," "returned to supplier") requires no code change — it's a new row in the reasons table. The event model is open-ended by construction. This is the AC-1 discipline applied to business events: vertical-specific vocabulary lives in data, never in schema identifiers.

**v1 state:** This model is the architectural decision for the Cost-to-Produce tile (not yet built). The current `plant_events` table in Cultivar OS is a partial implementation — it has event types but they are hardcoded as string literals rather than a lookup table. The refactor is a post-demo task.

---

### D-008 — BENCH-E MATURATION (EXTERNAL AI PROVIDER RESILIENCE)

**Decision:** BENCH-E (External AI Provider Resilience) matures in three successive passes. Each pass is a distinct build milestone.

**Pass 1 — Foundation (DONE, 2026-06-11):**
- Provider try-chain with isolated catches and timeouts
- Operator-greppable fallback log: `[TRACE:SUBSYSTEM] provider-fallback fired: X→Y, reason: Z`
- Clean user error on all-fail: actionable, non-technical copy
- Provider 3+ slot documented in code comments

**Pass 2 — Configuration externalization (NEXT):**
- Provider list, timeout values, and retry counts move from code constants to a config object (`providerConfig`)
- Config object can be overridden per-vertical or per-business-module
- Enables A/B testing of provider order without a code deploy
- Enables disabling a provider for a specific business (e.g., data-sovereignty concern)

**Pass 3 — Operational monitoring (FUTURE, threshold: >10 receipts/day):**
- Fallback-rate counter: how often did each provider fall through to the next?
- Displayed as a glanceable number on an operator dashboard (not a log file)
- Threshold alerting: if Gemini fallback rate exceeds X% in a rolling window, surface it proactively
- This is the difference between "we have logs" and "we have observability"

**Why three passes:** Pass 1 is correctness (the feature works). Pass 2 is flexibility (the feature can be tuned without a deploy). Pass 3 is intelligence (the feature tells the operator when it's struggling). Each pass has a different build complexity and a different trigger — Pass 1 always, Pass 2 when a second vertical uses the same provider chain, Pass 3 when daily volume makes manual log-scanning impractical.

**Current state:** Pass 1 is DONE (committed 2026-06-11, `ocr.ts` Gemini→Claude fallback chain). BENCH-E Rule 7 (model names externalized to `platform_config` DB) also completed 2026-06-11 — this partially fulfills Pass 2 for the provider-name dimension; timeout/retry configuration remains Pass 2. Pass 3 benched pending volume.

---

### D-009 — OCR IS COMMODITY

**Decision:** Receipt OCR is commodity infrastructure, not a TRACE differentiator. The moat is Cost-to-Produce/margin intelligence, not receipt digitization.

**Evidence settled 2026-06-11:**
- App Store has free receipt-scanning apps available to any user
- Nanonets is a specialist receipt OCR vendor — its API exists and is competitively priced, but offers no capability not covered by Gemini Flash + Claude Haiku
- QuickBooks Online has NO external reader API — QB's receipt OCR is import-only through their own app; a TRACE→QB receipt write-back path must go through the QB expense/attachment API, not OCR
- Gemini 2.5 Flash + Claude Haiku (already in BENCH-E chain) cover the use case at sub-penny cost per receipt with zero vendor lock-in

**What this constrains:**
1. **No specialist OCR vendor.** Nanonets, Textract, Google Document AI, and equivalents are out of scope. Gemini Flash + Claude Haiku handle the job at a fraction of the cost. The BENCH-E Rule 7 externalization means a provider swap is one DB row, not a code change.
2. **Do not pitch Receipt Keeper as the differentiator.** It is table stakes — something TRACE must provide, not something TRACE competes on. The pitch is Cost-to-Produce, margin clarity, and QB write-back.
3. **OCR is the input; margin intelligence is the product.** What happens after capture (D-001 lens model, QB write-back, Cost-to-Produce tile) is where TRACE is different. Receipt digitization alone is a commodity every phone already does.

**Why it matters:** Without this decision explicit, a future session could justify spec'ing a specialist OCR vendor or positioning Receipt Keeper as a selling point. Neither is correct. OCR is infrastructure; margin is the product.

---

> **Role Machine doctrine (D-010 through D-015), settled 2026-06-22.** Decisions D-010 through D-014 are the role/marketplace architecture (system roles, two-axis permissions, single tile registry, tile trial lifecycle, customer entity + signing); D-015 is the write-wall invariant surfaced by the Gate-3 close-out. These are the spec the Role Machine build is proven against. (MASTER_BRIEF's D-0XX log is a separate namespace from `DECISIONS.md`/`docs/DECISION-*.md`, which use D-10..D-16 for the cost-model decisions.) Checkable acceptance lives in `scripts/verify-universals.mjs`, not duplicated here.

### D-010 — ROLE ARCHITECTURE: SYSTEM ROLES ARE LOCKED ANCHORS, CUSTOM ROLES ARE FREE

**Decision:** Five out-of-box PLATFORM SYSTEM ROLES ship per tenant: OWNER, MANAGER, TECH, SERVICE (front-office). (CUSTOMER is NOT a member role — see D-014.) OWNER is a fully-locked superuser floor (not editable, not deletable). The others are tunable in permission *sets* (expand-only) but not deletable or renamable — code references them as floors.

**Three-tier storage (do not fuse):**
1. **Shared system-role definition** — the platform floor, ONE canonical representation, never tenant-mutated.
2. **Per-tenant `(business_id, role_key)` override** — "adjust Tech in place," exists only when the owner changed something (AC-1; the platform cannot know nursery-tech vs diesel-tech).
3. **Per-tenant custom role** — a new `business_id`-scoped row. "Add perms onto Tech" = **CLONE Tech into a new role and extend**, NOT mutate the system role.

**Read-time:** shared floor → apply override → custom alongside; all RLS-scoped via `is_active_member`; tenant rows private (AC-3). Identity is the key `(business_id, role_key)`, never the label.

**Owner composes, does not mint:** the owner builds/clones roles from the LISTED catalog (the registry auto-extends it — a new tile's `required_permission` is selectable WITHOUT a separate edit); the owner cannot create a permission primitive with no code behind it.

**Reset to factory = delete the tier-2 override and re-inherit the incorruptible shared floor** (NOT a snapshot restore — restoring *nothing* is what makes it incorruptible). Role-admin-gated + audited. Custom roles have no factory default (reset-to-seed or delete, separately confirmed). The owner must never lose the keys — reset is the recovery.

---

### D-011 — TWO-AXIS PERMISSION MODEL: VISIBILITY AND ACTIVATION AUTHORITY NEVER FUSE

**Decision:** Two orthogonal axes, never collapsed into one grant.
- **VISIBILITY** = who sees/uses a tile (owner-configured per role).
- **ACTIVATION AUTHORITY** = who can activate/trial/convert/restore a tile (a *money* action). Defaults to OWNER; ONE delegable blanket permission; every activation AND every delegation writes an audit row; revocation is live/immediate (live `has_permission`, not cached); a lapsed-restore uses the same permission.

Per-tile accountability comes from the audit trail, not from per-tile granting. The app manages state up to the payment step; the Stripe Checkout the human confirms is what commits the charge.

---

### D-012 — SINGLE TILE REGISTRY IS THE ONE SOURCE FOR VISIBILITY, ROLE-CONFIG, AND MARKETPLACE

**Decision:** One declared list `{key, label, group, required_permission}` + marketplace metadata, read by the dashboard + role-config + marketplace. No tile is rendered or governed from any other list. Adding a tile = ONE entry → it appears on all three surfaces. This kills the three-list drift (Ignition's grid is hardcoded). AC-1 + AC-4.

---

### D-013 — TILE TRIAL LIFECYCLE + LAPSED-FUZZY STATE

**Decision:** Per tile, per business: `inactive → trial → active`, transitioning to `lapsed` on expiry-without-payment. The per-tile countdown persists the end date as **stored state, not a client timer**. Lifecycle: Day 1 start → Day 7 nudge → Day 12 savings report → Day 14 gray → Day 15 real data BLURRED + subscribe → Day 30 archived (not deleted). **Fuzzy = real data blurred, restored on payment** — NOT placeholders, NOT deletion. State is per `business_id`, dual RLS. App = state, Stripe = money.

---

### D-014 — CUSTOMER ENTITY + DOCUMENT-SIGNING (DOCUSIGN-LITE, CHANNEL-VALIDATED)

**Decision:** CUSTOMER is NOT a member role — it is a per-vertical ENTITY (outside-party data, no login, no authority). Member roles are owner, manager, front-office (Lexicon display per vertical), tech. (Ignition's vestigial customer role existed only for kiosk sign — left behind.)

**Channel validated ONCE up front** (a test SMS confirms the phone; an email link confirms the address) → the customer becomes a VERIFIED CONTACT; after that, sending docs is routine with NO per-document re-auth (verify-the-contact-then-trust-it). Validation is LAZY (on first signable send).

**Signing UX:** scribble OR typed-name + script font (a consent gesture, not the security). **Proof = a bound record, always captured:** a content snapshot/hash of EXACTLY what was shown + the verified channel + the consent artifact, on the standard who/what/when audit.

**Honest limits:** possession-of-channel proves the channel, not the biometric person; **biometric/face capture is OUT OF SCOPE entirely** (BIPA-class liability, disproportionate); observed identifiers (device ID) are not in the always-on floor. **Legal ESIGN ceremony = optional, default OFF** (proof always; ceremony on demand).

Platform-shared primitive (Cultivar quote, Conduit sign-off, KINNA pledge). Design discipline: proof PROPORTIONATE to stakes — stop climbing the assurance ladder when it costs more than the dispute it prevents; do not build a per-document gauntlet.

---

### D-015 — WRITE AUTHORITY ≥ READ AUTHORITY ON PROTECTED DATA (THE WRITE-WALL INVARIANT)

**Decision:** For any permission that gates READING a class of data, the SAME permission (or stricter) must gate WRITING/creating/updating that data, enforced at the DATA layer (an RLS INSERT/UPDATE policy + an endpoint permission check) — never by hiding a UI button. **You may never write what you cannot see.**

**Reasoning to defend later:**
1. A blind write is worse than a blind read — the actor corrupts protected data (e.g. operating-cost, `unit_cost` — the moat) without ever being able to view what they corrupt, silently.
2. Gate 3 was scoped as a READ wall and proven only on SELECT (HAR: cost reads return `200 []`); the INSERT/UPDATE side was never proven, so every financial write path is currently unproven.
3. Two confirmed open instances: the operating-cost "+cost" save (writes with no view-permission gate) and the costDiscovery cost-apply endpoint (service-key, no caller permission check, tunnels under RLS).
4. Hiding the button is render-layer theater; the database must refuse the write for a JWT lacking the permission.

**Remediation = "Gate-3b write-wall,"** built and proven against real roles via Role Machine. AC-4: settle all financial-write gates once, not piecemeal. Cross-ref: STD-011 (one canonical representation), tech-debt #46, verify-universals assertion (h).

---

### Open Threads for Next Session

*(Not decisions — active uncertainties that must be resolved before the affected features advance.)*

**~~Thread 1 — Gemini 2.0 live-test failure~~** ✅ RESOLVED 2026-06-11 — Upgraded to `gemini-2.5-flash` (validated in bake-off). AbortController extended to 9s. Live test at McCoy's produced provider=gemini, 3-4s, 5 line items, $31.00 formatted. Receipt Keeper v1 advanced to WORKS.

**~~Thread 2 — line_items quality not yet eyeballed~~** ✅ RESOLVED 2026-06-11 — McCoy's live test confirmed well-structured `line_items` array: 5 line items + Tax $2.36 injected correctly. `line_items` column applied (part of 5-migration bundle). UI grid renders from it in ReceiptKeeper.tsx.

**Thread 3 — David as customer-zero on the 80% shared spine:** The Receipt Keeper, the Cost-to-Produce tile, and the grower event model are all features that David will use himself (truck receipts, nursery accounting, business operations). This is the most reliable design feedback loop available. As each feature is built, David uses it for 2-4 weeks before it goes to LAWNS or any other customer. The 80% shared spine means that what works for David's general business (`business_type='general'`) will work for Lauren's nursery with only vocabulary differences. Document the use-for-yourself cycle as explicit protocol before shipping to customers.

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
*MASTER_BRIEF.md v4 — June 13, 2026*
*Update this file every session. No exceptions.*
