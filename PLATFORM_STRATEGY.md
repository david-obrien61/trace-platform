# TRACE Platform — Multi-Vertical Strategy & Architecture
# Last updated: 2026-06-22
# Changelog:
# 2026-06-22 — Role/Marketplace layer invariant pointer added (§ ROLE / MARKETPLACE LAYER): two-axis permissions, single tile registry, write-authority ≥ read-authority (write-wall), app-state/Stripe-money boundary. Doctrine in MASTER_BRIEF D-010..D-015; acceptance in verify-universals.mjs.
# 2026-06-11 — target architecture set: one-source/many-views model, schema naming convention, one-DB decision (red-teamed); general-target reframe (§ TARGET ARCHITECTURE)
# 2026-06-10 — Capability/Composition Model formalized (§ CAPABILITY / COMPOSITION MODEL); STD reference updated
# 2026-05-29 — Architecture Constants added (AC-1 through AC-4)
# 2026-05-27 — KINNA-OS subtitle updated; TRACE — Who We Are synced across docs

## Scope & Hierarchy

This document owns target architecture — what packages/shared/ and the vertical apps should look like when complete. Every table and section here describes target state, not current state.

When this doc conflicts with another:
- For current state, see PLATFORM_AUDIT.md (audit wins on what is built)
- For strategy, revenue, and contacts, see MASTER_BRIEF.md
- For session handoff and infrastructure specifics, see CLAUDE.md
- For the discovery module's product brief, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)

When code reality and architectural ideal disagree about what exists, the audit wins. This doc describes where we're going.

## TRACE — Who We Are

TRACE is a family. Terrence, Regina, Andrew, Connor, Erin. We named the company after ourselves around a kitchen table, because what we are building is meant to last longer than any one of us and meant to belong to all of us.

Who builds it today. David O'Brien — Terrence — is the builder today. 23 years 9 months military service, 30 years federal service in knowledge management, a lifetime as an electrician, mechanic, and builder. He writes the platform working with Claude and Claude Code as engineering partners. Andrew lives in the house and builds his own products alongside David. He established TRACE's foundation — set up Git, GitHub, Supabase, and Railway, and the working stack TRACE runs on. Before that setup, code was being lost. After it, every commit was preserved. The velocity that followed is built on the substrate Andrew laid down. Erin also lives in the house when she's not on travel nursing assignments; she's currently on an ER rotation in California. Connor visits regularly from out of state and is on call by video any time the work needs him. Regina is the program director at Operation Liberty Hill, the anchor pilot customer for KINNA-OS, and the voice the platform answers to on what it means to treat people as kin.

The five of us are not yet all on payroll. We are a family company in formation. The founder builds; the family is within reach; the runway to bring everyone in is what we are building toward.

The craft. Every TRACE product is Built with CAI — our signature on the work. The signature is literal: this software is built with composable AI as the engineering partner, used carefully, used well, used by people who know what good work looks like because they've done it with their hands for forty years.

The product line. We don't sell platforms. We sell the operating system for your kind of business: Cultivar OS for nurseries and garden centers, Ignition OS for diesel and auto repair shops, Conduit OS for HVAC, plumbing, and electrical, KINNA-OS for community nonprofits, CoolRunnings for homes. Each is its own product. Each is also part of the same family of software underneath — the way a small dedicated family ships fast and stays consistent.

> **⚠️ DRAFT — FLAGGED FOR DAVID'S REVIEW (2026-06-11):** The paragraph above reflects the pre-2026-06-11 framing ("each is its own product"). The architecture decision made 2026-06-11 reframes this: TRACE is one platform with many views — verticals are configured entry points, not separate products. The marketing surface ("your kind of business") stays; the structural claim changes. Proposed reframe for David's edit:
>
> *The product line. TRACE is one platform — one engine, one database, one shared codebase — configured as the operating system for your kind of business. Walk in through Cultivar OS if you're a nursery. Walk in through Ignition OS if you're a diesel shop. Walk in through KINNA-OS if you run a faith-based program. The door is yours. What's behind it is the same family of software, built once, shared by all. David is customer-zero for the general door — TRACE Enterprises runs on the same platform you do.*
>
> David reviews and finalizes this wording. Do not overwrite the current paragraph until David confirms the reframe. Until then, both versions live here — the existing paragraph (marketing copy in use) and this draft (architectural reframe pending).

The silent partner. We are not here to replace what you have. You already have QuickBooks, or Square, or Neon One, or a notebook full of phone numbers. You already have a business that works. What you don't have is enough hours in the day, and the gaps between your tools are where your time and your money are leaking out.

We come alongside, quietly. We connect what you already use. We fill the gaps no one else fills. We give you back your evenings. Your customers see you — not us. We are the silent partner that powers you to soar. For nonprofits, that partnership often shows up as "Powered by KINNA" — a quiet credential visible to funders and peers. For commercial businesses, it usually doesn't need a label at all. The OS is just the tool you use to run your day, made by a family who built it because they needed it themselves.

The one-sentence version: We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**Built with CAI · TRACE Enterprises · David OBrien**
**Document version: 1.0 · May 2026**
**Status: Authoritative — supersedes scattered references in all other briefs**

---

## PART 1 — THE PLATFORM IN ONE PARAGRAPH

TRACE builds an operating system for owner-operated small businesses and nonprofits — one product per vertical, all sharing one platform underneath. The platform is built once. Each vertical is a configured instance — new question sets, new tiles, new AI prompts, new integration hooks. Nothing is rebuilt. The same Supabase schema, the same auth system, the same QuickBooks bridge, the same trial engine, the same onboarding shell. The beachhead is the nursery vertical (Cultivar OS, LAWNS Tree Farm). The platform is everything else. Our craft signature is Built with CAI — every TRACE product is built with composable AI as the engineering partner. The unfair advantage is 40 years of knowledge management and trades experience, delivered at SMB price points by a family team.

---

## ARCHITECTURE CONSTANTS (Design Invariants)

Non-negotiable platform invariants, checked before any schema, RLS policy,
route, or shared-code change. Deviation requires a documented WHY — inline at
the point of deviation AND a dated entry in the Exception Log below.

**AC-1 — Variation lives in data, not schema.**
Anything that differs between verticals or between businesses is configuration —
a value, a row, or a token — never a name in shared schema or shared code.
Shared/platform tables, columns, RLS policies, routes, and identifiers carry
ZERO vertical nouns (nursery, shop, lawns, garden, etc.). Vertical identity
exists only as a value in business_type. Vertical-specific nouns are permitted
only inside that vertical's own package.

**AC-2 — RLS is membership-scoped by default.**
Every table's row-level security policy is scoped to business_id membership by
default. Tenant isolation is enforced at the data layer, not only in client
code. A looser policy is a deviation requiring a documented WHY.

**AC-3 — Tenant isolation is absolute.**
No query, resolver, or policy returns data for a business the current user is
not a member of, across any vertical. Cross-vertical resolution returns
no-access — never a wrong-vertical record.

**AC-4 — Settle once, encode as variable, stop relitigating.**
Structural design (spacing, type, sizing, validation, loading states) is shared
across all surfaces. The only per-vertical variables are tokens (color) and
configured vocabulary (size classes, lifecycle stages, business noun). Settled
decisions are encoded as variables and executed against, not reopened.

## AC-5: One integration, one connector, one router

**Rule.** A third-party integration is a single connector behind ONE router function. Its endpoints are internal routes (method/path dispatch inside the connector), NOT separate platform functions. New connectors are built to this from the first commit; existing connectors that violate it are consolidated when next touched.

**Boundary (do not over-apply).** One router PER integration, NEVER one router ACROSS integrations. The connector boundary IS the failure-isolation boundary: a shared cross-integration router is a series-wire that drops multiple integrations on one fault (Alan Effect, Parable 4). QBO's endpoints share a client, auth, env, and failure domain → consolidate. QBO + Stripe do not → stay separate.

**Why.** Function-per-endpoint makes platform function-count scale with endpoints (each integration burns 2–4 slots; the Vercel cap becomes a recurring tax). One-router-per-connector makes it scale with integrations (~one slot each; headroom that grows). This is AC-4 (settle once, encode) applied to integration shape, and the grandfather rule at the architecture level: build the pattern right the first time so the class stops recurring.

**Enforcement / violation loop.** A violation is not automatically wrong. When connector work would violate AC-5, reevaluate the work against this principle. If the violation is knowingly accepted, log it in `decisions/override-log.md` (Section 14 machinery) with the reasoning. Silent violation is the only disallowed outcome.

**Exception Log:**
- (none)

---

## ROLE / MARKETPLACE LAYER — INVARIANT POINTER

*Doctrine is settled in MASTER_BRIEF.md (D-010 through D-015); not duplicated here. This pointer records the architecture invariants the Role Machine build must hold to.*

- **Two-axis permissions (D-011):** VISIBILITY (who sees a tile) and ACTIVATION AUTHORITY (who can spend money to activate it) are orthogonal and never fuse. Activation defaults to OWNER, is delegable, and every activation/delegation is audited.
- **Single tile registry (D-012):** ONE declared list `{key, label, group, required_permission}` + marketplace metadata drives the dashboard, role-config, and marketplace — no tile governed from any other list.
- **Write-authority ≥ read-authority (D-015, the write-wall):** any permission that gates reading a data class gates writing it too, enforced at the DATA layer (RLS INSERT/UPDATE + endpoint permission check), never by hiding a button. *You may never write what you cannot see.* This is an architecture invariant, not a feature.
- **App-state / Stripe-money boundary holds:** the app manages tile state up to the payment step; the Stripe Checkout the human confirms is what commits the charge.

Checkable acceptance for all of the above lives in `scripts/verify-universals.mjs`, not in prose.

---

## THE CAPABILITY / COMPOSITION MODEL

*Founding Realization — 2026-06-04. This is why the Architecture Constants exist.*

### The Unit Is CAPABILITY, Not Vertical

A vertical is a preset bundle of capabilities for a named market segment. The underlying unit
of work is the CAPABILITY — an independently activatable function that can be composed across
verticals. Vertical identity is a configuration value over a capability graph, not a first-class
architectural entity.

### Five Layers (Bottom to Top)

| Layer | Definition | Example |
|---|---|---|
| **CAPABILITY** | A discrete, independently activatable unit of work | Missed revenue detection, QB invoice, AI social post |
| **ADAPTER** | A pluggable backend connector that a capability may call | QuickBooks, Stripe, Blotato, Claude, Twilio |
| **COMPOSITION** | The dependency graph — capability A requires capability B to be active | Invoice audit requires QR checkout to be active |
| **VERTICAL** | A default bundle: the preset capability graph for a named market segment | Cultivar OS = nursery preset; Ignition OS = shop preset |
| **IMPORT** | Adding a capability outside the preset bundle | A nursery activating the margin engine from the shop preset |

IMPORT is only possible because AC-1 standards are in force: if table names carried vertical nouns,
a nursery business row could not activate a capability built for shops. AC-1 is the precondition
for any cross-vertical composition.

### Three Buckets — How We Create Value

**1. CONNECT** — Adapter to an existing tool the customer already uses.
The customer has QuickBooks. They have Stripe. They have a phone. We plug in.
Value: elimination of dual entry and manual reconciliation.

**2. FILL THE GAP** — Capability with no external dependency; unserved value.
Nobody sells missed-revenue detection to a nursery. Nobody sells urgency copy to a food pantry.
We own this. It is our moat, and it lives entirely inside the platform.

**3. SURFACE THE BETWEEN** — Cross-system AI inference; only possible because CONNECT and FILL
THE GAP share the same business_id.
Example: a shop's margin engine (FILL THE GAP) reads QB job data (CONNECT) and surfaces jobs
that were profitable on paper but flagged by the tech as underpriced — then writes a draft
social post (CONNECT + FILL THE GAP) explaining the value the shop delivered. None of this is
possible if the connectors and the capability graph live in separate, unlinked schemas.
AC-3 (tenant isolation absolute) is what makes SURFACE THE BETWEEN safe to build at all.

### Discipline

- **Opinionated defaults.** Every vertical ships with a preset bundle. A nursery owner does not
  configure a capability graph — they get the nursery preset on day one.
- **À la carte available.** Any business can activate a capability outside its preset (IMPORT),
  subject to adapter availability. This is how the platform grows without rebuilding.
- **New vertical = one config file + zero component edits.** This is the success test for all
  Noun Purge, Doc Reorg, and Vertical Config Extraction work.

### Sequencing — Why This Layer Is Post-Demo

The Composition layer (dependency graph above business_modules) requires:
1. Noun Purge complete — AC-1 in force on all table names and shared identifiers
2. `VerticalConfig.ts` threaded through shared components — vertical identity as data
3. `business_modules` as the activation surface — not `nursery_modules`

None of this is blocking the LAWNS demo. The architecture already supports two verticals
correctly. The Composition layer is the abstraction above what exists — it formalizes the
pattern once the pattern is clean. Sequencing: post-demo, after noun purge, before KINNA-OS build.

---

## TARGET ARCHITECTURE — One Source, Many Views

*Decided 2026-06-11. Red-teamed and locked (AC-4). Do not relitigate.*

### The Model

**One data source. One shared engine. Views, not apps.**

The platform is one agnostic database and one shared codebase, configured at runtime by
`business_type` and entry domain. Verticals are not separate applications — they are
**configured lenses** (views) on the same source.

The best analogy is SharePoint views: one list, many views. Each view is a filter + skin +
tile-bundle + vertical-specific programming layered on top. Selecting a view doesn't copy the
data to a new location. It configures how you see and interact with what's already there.
TRACE works the same way. The data source is the platform. The vertical is the view.

### Entry Points vs Apps

The `.app` domains (cultivar-os.app, ignition-os.app, conduit-os.app, kinna-os.app,
builtwithcai.app) are **entry points** — pointers that load the platform pre-configured for
that vertical's view. They are not separate applications. One app. Many entry doors.

`builtwithcai.app` is the **general view** — the same platform, unfiltered. David is
customer-zero for the general view. The general entry is the platform experiencing itself,
not a separate product.

The `.com` domains serve a distinct purpose: **marketing and positioning** (who this view is
for). `trace-enterprises.com` is the who-we-are / purpose page. `builtwithcai.com` is
discovery. Vertical `.com` domains describe the market segment.

### Hand Diagram (2026-06-11)

David sketched this by hand: a single circle (the platform database) with five arrows pointing
outward to labeled entry points. Each arrow is labeled with a domain name and a brief
description of who walks through that door. The circle doesn't change. The arrows are views.
This diagram is the correct mental model for the platform. Every architectural decision should
be legible from it. "Does this require a new circle?" — if yes, reconsider.

---

## SCHEMA NAMING CONVENTION — The 80/20 Rule

*Decided 2026-06-11. Red-teamed and locked (AC-4).*

One platform database holds both layers. The **table name itself** tells you which layer
it belongs to. No ambiguity.

**80% — SHARED tables (no vertical noun):**
Tables that serve all verticals carry zero vertical noun in their name.
Examples: `businesses`, `business_members`, `business_modules`, `customers`, `receipts`,
`social_drafts`, `notifications_log`, `ai_usage_log`, `subscription_tiers`, `vendors`,
`growth_goals`.
Rule: shared = vertical-noun-FREE. This enforces AC-1 at the naming layer.

**20% — VERTICAL tables (vertical-PREFIX as identifier):**
Tables that are domain-specific carry a vertical prefix as a namespace marker — making it
unmistakable that the table is not platform-wide.
Examples: `growers_plants`, `growers_plant_events`, `growers_profiles` (nursery/garden);
`shop_jobs`, `shop_estimates`, `shop_members_devices` (auto/diesel);
`trades_tickets`, `trades_equipment` (HVAC/trades);
`kinna_people`, `kinna_distributions` (faith-based/nonprofit).

The prefix makes the layer indicator visible in the name itself. A reader seeing `growers_*`
knows immediately: vertical-specific, not platform schema. A reader seeing `businesses`
knows immediately: shared, applies to every vertical.

**Prefix finalization:** David finalizes exact prefix words (growers_ vs nursery_, etc.) before
any vertical table is created under this convention. The current `nursery_*` tables (nurseries,
nursery_profiles) predate this convention; they will be renamed as part of the post-demo noun
purge (see AC-1 violations in CLAUDE.md §1.5).

---

## RED-TEAM CONSTRAINTS — Decided and Accepted

*Both constraints survived attack 2026-06-11. Locked.*

### Constraint 1 — Blast Radius (Accepted with Mitigation)

**The risk:** One shared database = one failure domain. A bad migration can affect all tenants
simultaneously, not just one vertical.

**Why accepted:** This is the standard, industry-proven multi-tenant SaaS pattern. Every
major SaaS platform (Salesforce, Stripe, GitHub, AWS) runs multi-tenant on shared databases
with row-level isolation. This is an implementation of a solved problem, sized as such — not
a novel risk requiring novel architecture.

**Mitigation (already in force):**
- STD-008: committed migration ≠ applied migration. Every migration has a verification query.
  No migration is "done" until the live DB is confirmed.
- Snapshot-first before any destructive migration.
- Migration discipline enforced by the STD-008 standard.

### Constraint 2 — RLS Before Convergence (Hard Sequence)

**The rule:** Tenant isolation via RLS must be fully in place BEFORE the two separate Supabase
projects (`bgobkjcopcxusjsetfob` Cultivar and `ufsgqckbxdtwviqjjtos` Ignition) are merged
into one platform database.

**Why:** With a shared database, RLS is the sole tenant boundary. The industry-standard
pattern (Postgres/Supabase native) is well-known and well-solved — apply the recipe, not
invent. But known holes currently exist.

**The gate:** Tech Debt #28 — `supabase_rls_pilot.sql` sets `USING(true) WITH CHECK(true)` on
19+ Ignition tables (pilot_all wide open). ANY row of ANY shop is readable by ANY authed
session in the Ignition project. This is the known gap.

**Sequence:**
1. Fix TD#28 — replace `pilot_all` policies with `shop_id`-scoped policies
   (`USING(EXISTS (SELECT 1 FROM businesses WHERE id=shop_id AND owner_id=auth.uid()))`)
   on ALL 19+ affected Ignition tables.
2. Verify: run `SELECT * FROM shops WHERE id != <test_shop_id>` with a non-owner session →
   expect zero rows returned.
3. Only after TD#28 is confirmed resolved: proceed with DB convergence (Ignition schema
   migration into the platform DB, snapshot-first).

**Do NOT merge while TD#28 exists.** LAWNS is live in Cultivar's DB. One breach in the
merged DB affects LAWNS. Treat accordingly.

---

## CURRENT STATE vs TARGET

*Honest accounting as of 2026-06-11.*

**CURRENT:**
- Two separate Supabase projects: `bgobkjcopcxusjsetfob` (Cultivar + platform) and
  `ufsgqckbxdtwviqjjtos` (Ignition-only).
- TRACE Enterprises (general) lives in Cultivar's DB (`bgobkjcopcxusjsetfob`).
- BusinessProvider has a TEMP OPEN-ACCESS bypass active (commit-marked, reversible) —
  `business_type` filter commented out so David sees all his businesses now.
- Pre-naming-convention tables in production: `nurseries`, `nursery_profiles`, `nursery_modules`
  (partly resolved — `nursery_modules` → `business_modules` done; others deferred to noun purge).

**TARGET:**
- One agnostic platform database (the current `bgobkjcopcxusjsetfob` becomes/represents the
  platform DB after Ignition schema is migrated in).
- One app with runtime view-configuration by `business_type` and entry domain.
- 80/20 schema: shared tables with no vertical noun; vertical tables with vertical prefix.
- BusinessProvider `business_type` filter restored and replaced by the one-app/views routing
  model (entry domain → businessType prop — no bypass needed).

**DB CONVERGENCE SEQUENCE (deferred, not this week):**
1. Fix TD#28 (RLS Before Convergence — hard gate; see above)
2. Snapshot `ufsgqckbxdtwviqjjtos` before any migration
3. Write Ignition schema migration under 80/20 naming convention
4. Apply to `bgobkjcopcxusjsetfob`, verify RLS isolation
5. Retire `ufsgqckbxdtwviqjjtos`
LAWNS is live in Cultivar's DB — every step involving `bgobkjcopcxusjsetfob` touches production.

**`packages/trace-app/` — TRIAGE FLAG:**
This package was built 2026-06-11 as a separate "general business" entry point app
(commit `d4017a1`). It is now **superseded by the one-app/views decision** — the one-app
model makes a separate `trace-app` package unnecessary; the general view is just the single
app loaded with `businessType='general'`. This package needs triage: either repurpose as the
canonical single-app root (folding cultivar-os into it), or remove. Do NOT treat `trace-app`
as the live target architecture in its current form. Decision deferred — David owns this call.

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
| Auth | Shared auth package — email/password + member invite/accept flow, role-based routing, two-path BusinessProvider (owner + member fallback). Gesture layer (PIN, biometric) is vertical-specific on top of shared Supabase session. | packages/shared/src/auth/ | ✅ Live (Cultivar OS, 2026-06-02) — business_members, invitations, member_devices with real RLS; 29/29 E2E assertions passing |
| Data sync | DataBridge.js — local-first, offline queue, trial clock | packages/shared/src/supabase/bridge.ts | ⚠️ localStorage only — Supabase migration needed |
| AI router | AIEngine.ts — Claude/Gemini/Whisper by task. ai_router.py is legacy (Railway, mobile-era). Forward path: Vercel serverless functions. | packages/shared/src/ai/ | ✅ Built · ⚠️ Backend needs porting before AI features go live |
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

**Application:** Every new UI element gets reviewed against this rule before merge. Existing dead-button states (see PLATFORM_AUDIT.md's "UI Surface State — Cultivar OS (May 25 snapshot)" section) are technical debt to be cleared before any next demo.

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

### **Honest Velocity** *(name provisional)*

TRACE prioritizes forward motion. We ship before things are polished. We let customer contact reveal what we couldn't have learned from inside the building. When something breaks, we acknowledge it, fix it, learn from it, and move on. We do not optimize for perfection because perfection is a stall mechanism dressed up as virtue.

This principle is balanced against, not opposed to, Surface Honesty (we don't ship dead surfaces and call them done) and Honest Friction (we don't move forward over the top of unresolved contradictions). All three principles apply together: move forward, surface what's broken, resolve conflicts deliberately, don't stop.

**Application:** When a decision presents itself as "ship now imperfect vs. defer until polished," the default is ship — paired with honest documentation of what's still rough. The trade debt is captured in CLAUDE.md's Tech Debt Log, not hidden. Forward motion is the default; deferral requires justification.

**On the name:** "Honest Velocity" is a provisional label. The principle is locked; the name may be revised after 30-60 days of use. See CLAUDE.md Open Architecture Decisions.

---

### **Epistemic Humility** *(name provisional)*

TRACE acknowledges what it does not know. Decisions are documented as decisions, not as truths. Standards are versioned with Draft / Active / Superseded states because we expect to be wrong sometimes. Open Architecture Decisions are tracked with target resolution windows because we know we're deciding under uncertainty. The Tech Debt Log exists because we know workarounds will happen and we want to admit them.

The discovery surface itself is built on this principle: synthesis output includes a "Questions we should have asked but didn't" section, because the conversation has limits we won't always recognize in the moment.

**Application:** When drafting documentation, code comments, customer copy, or operational claims, prefer language that admits uncertainty over language that performs certainty. "We believe this is correct as of date X" is stronger than "this is correct." When we don't know, we say so.

**On the name:** "Epistemic Humility" is a provisional label. The principle is locked; the name may be revised after 30-60 days of use. See CLAUDE.md Open Architecture Decisions.

---

### **Honest Debt** *(name provisional)*

Do it right by default. If we make an informed decision to deviate, we document it the SAME DAY in three places: (1) a loud, grep-able code marker at the deviation point, (2) a Tech Debt Log entry in CLAUDE.md, (3) a note in any affected canonical doc. Each entry states WHAT, WHY, and the sentence "We make this decision knowing we will need to fix it." Silent shortcuts are not permitted — only chosen, visible, documented ones.

**The three documentation requirements for any deviation:**

1. **Code marker** — placed at the deviation point in source the same session it is introduced:
   ```
   // 🔴 HONEST DEBT: <what> — <why> — "We make this decision knowing we will need to fix it." See Tech Debt #<N>
   ```
   Grep-able token: `HONEST DEBT`. Every deviation is discoverable via `grep -rn "HONEST DEBT" .`

2. **Tech Debt Log entry** — added to CLAUDE.md's Tech Debt Log table the same session: what, when introduced, correct architecture, trigger for repair.

3. **Canonical doc note** — a note in any doc that describes the area being deviated from, so future sessions don't treat the workaround as the intended design.

**Status color convention** (used across all TRACE docs and Tech Debt Log entries):

- 🔴 **RED** — Honest Debt. A chosen, documented deviation. Must carry the "we know we'll fix it" sentence. Not the same as an unexplained bug — an unexplained bug has no entry and no marker.
- 🟢 **GREEN** — Done right. On-spec and VERIFIED — someone confirmed it works correctly end-to-end, not "probably fine."
- 🟡 **YELLOW** — Unverified / known-risk / needs-eyes. Works but unconfirmed. A transition state, not a resting state: every yellow item has an owner and a decide-by, and resolves to 🟢 GREEN (verified) or is promoted to 🔴 RED (chosen debt). Yellow must not sit indefinitely — unattended caution is how silent bugs hide.

**What's forbidden:** A deviation without same-day documentation. "I'll log it later" is a silent shortcut. The code marker and log entry happen at the same time as the decision to deviate, or the deviation does not happen.

**Application:** This principle governs Claude Code sessions, Claude.ai sessions, and David when writing code directly. The Tech Debt Log entry and the code marker are both required — one without the other is insufficient. Existing entries in the Tech Debt Log that predate this principle are retroactively 🔴 RED; they already carry the substance of the principle (what, correct architecture, trigger), even without the explicit sentence.

**On the name:** "Honest Debt" is a provisional label. The principle is locked; the name may be revised after 30-60 days of use. See CLAUDE.md Open Architecture Decisions.

---

### **Shared Structure, Vertical Content (80/20 Pattern)**

Most user-facing surfaces in TRACE — help, onboarding, settings, navigation, common workflows, error messages, customer support flows — are approximately 80% the same across verticals. They serve the same kinds of users (small business owners) solving the same kinds of problems (configuration, payment, support, getting started) using the same connected systems (QuickBooks, Stripe, email).

The vertical-specific 20% is domain language and specialized workflows. A nursery's first-run experience involves QR-tagging plants; an auto shop's involves logging a work order. The structure is identical; the content differs.

This is not a coincidence or a temporary property of the current two verticals. It reflects something true about the customer type: owner-operators of small businesses share nearly identical needs at the operational layer, regardless of their industry. The platform earns its name by encoding that shared layer once and letting domain specialists focus on what actually differs.

**This principle requires:**

1. **User-facing surfaces are built in `packages/shared/`** with a vertical-content injection point — a configuration object, a typed content file, or a prop that supplies the 20%.
2. **Each vertical owns only its 20% of specialized content.** A vertical's help page, for example, is a content file and a wrapper — not a rebuilt component.
3. **New verticals can stand up new surfaces as primarily content work, not rebuild work.** The structural investment is made once. Each new vertical is a multiplier.
4. **The shared surface enforces consistency; the vertical content provides domain authenticity.** Both matter. A help page that says "repair order" to a nursery owner fails. A help page that was rebuilt from scratch for each vertical diverges in ways that are never tracked.

**Application:** Every time a new user-facing surface is built, the first question is: does an equivalent already exist in `packages/shared/src/pages/` or `packages/shared/src/components/`? If yes, extend the content interface rather than building a parallel component. If no, build the new surface in shared with a content injection point from day one — even if only one vertical needs it today.

**Consequence:** Adding a new vertical's Help page should be approximately 30 minutes of content work, not days of component building. The same applies to onboarding shells, settings pages, error boundaries, and support flows. If it takes longer than an hour, the shared layer is missing something worth extracting.

**What this is not:** This principle does not mean every line of every page must be shared. The 20% that is genuinely domain-specific (leakage metrics for nurseries, refrigerant logs for HVAC, TEFAP eligibility for food pantries) lives in the vertical and stays there. The principle governs the container, not every piece of content inside it.

---

### **Auth Layer vs. Gesture Layer**

Authentication is one layer — a single Supabase auth account per person, tied to email, holding the actual security boundary. Gestures are convenience layers on top — PIN, facial recognition, biometric, passkey — that can vary per device for the same authenticated identity.

The design driver is the **"hands not available" case**: a diesel mechanic with greasy hands cannot reliably type a password. A gardener wearing gloves cannot use a touchscreen keyboard. A nurse in PPE cannot scan a fingerprint. Each of these customers needs to authenticate quickly without their hands being available for typing.

**The pattern that solves this:**
- Personal phone: passkey using Face ID or fingerprint
- Shop tablet: passkey using whatever biometric the tablet supports, or PIN fallback
- Shop kiosk: PIN only (no biometric hardware)

Same auth account. Different gestures per device. The authentication is one. The conveniences are many.

**This is why authentication infrastructure is shared** (`packages/shared/src/auth/`) while gesture implementations are vertical-specific. The shared layer enforces real security via Supabase auth — `auth.uid()` must be non-null for any query that touches customer data. The verticals add gestures appropriate to their customer's working environment.

| Vertical | Auth layer | Gesture layer |
|---|---|---|
| Cultivar OS (nurseries) | Shared Supabase auth | PIN for daily on-the-job access; WebAuthn passkey upgrade available |
| Ignition OS (auto/diesel) | Shared Supabase auth | PIN (standard gesture for shop floor, shared hardware) |
| CoolRunnings (home automation) | Shared Supabase auth | Biometric-first via mobile device passkey |
| KINNA-OS (nonprofits) | Shared Supabase auth | PIN for distribution volunteers on shared devices |
| Future verticals | Shared Supabase auth | Gesture choice driven by customer's working context |

**PIN is the platform-wide gesture layer standard** for verticals with on-the-job operators (shop floor, field, counter, distribution). The question per vertical is not "should we use PIN?" — it is "what does PIN unlock in this context?" PIN-on-top-of-auth is the default. Biometric registration is an optional step offered after PIN setup; it enhances PIN, it does not replace it.

**The principle prevents both failure modes:**
- *Single global gesture* = broken UX for hands-not-available cases (the mechanic cannot type, the gesture fails them)
- *Per-vertical custom auth* = security fragmentation, code duplication, impossible to share customer accounts across verticals

Standard auth, vertical-specific gestures. One identity, many ways to prove it.

**Application:** When a new vertical is built, authentication is not rebuilt — it is configured via the shared auth package. When a new gesture is needed for an existing vertical, it is added as a gesture layer that wraps a Supabase auth session, not as a replacement for it. No vertical is ever allowed to gate data access using only a PIN or biometric without an underlying `auth.uid()` — the gesture unlocks the UX, but RLS and tenant isolation always run against the Supabase session.

---

### **Lean Cost Architecture & Failure Isolation Over Platform Limits**

*Origin: 2026-06-05 — Blotato cancellation + Vercel 12-function-cap question. David applied the Alan Effect to infrastructure.*

TRACE runs on free/cheap tiers by default — the founder's own lean cost base is the model for the customer's. Paid dependencies must justify themselves or be cut. When a paid capability is genuinely needed, build it as a swappable, demand-gated **adapter slot** so the cost lives with the customer who needs it, not baked into everyone's base. **BUT cost minimization never overrides failure isolation.** A platform limit (e.g. Vercel Hobby's 12-function cap) must NOT dictate architecture in a way that couples capabilities that should fail independently. When the free tier forces a cascade, that is the signal to pay — not to compromise the engineering. Minimal cost means the lowest cost that *still delivers the value* — and resilience IS the value.

**Part 1 — Lean cost architecture:**
- Default to free/cheap/self-hostable over paid SaaS dependencies.
- The founder's cost base is the proof-of-concept for the customer's. Every paid dependency is a cost the founder eats or the customer eats.
- Paid dependencies must justify themselves or be cut. First application: **Blotato — CUT** (no connection API, never published, leaked key; social-publishing deferred to a demand-gated adapter).
- When a paid capability IS needed → adapter slot, not hard dependency. Swappable, optional, demand-gated. The customer who needs it plugs in (and pays for) the adapter; everyone else pays nothing and the capability degrades gracefully.
- **Track free-tier ceilings (grandfather: know where it breaks before it breaks):**
  - Supabase free: row/storage/bandwidth limits.
  - Vercel Hobby: 12 serverless functions/deployment; **non-commercial use only** — billing customers requires Vercel Pro regardless of function count. The 12-function cap is a pre-revenue/demo-phase constraint only. It must NEVER bake a structural compromise into the architecture.

**Part 2 — Failure isolation over platform limits (Alan Effect applied to infra):**

The Alan test for serverless functions: are the things being combined naturally ONE capability (cohesive — fine to combine), or SEPARATE capabilities being smashed together to hit a number (cascade risk — don't)?

- **Combining cohesive actions within one capability** → fine. Example: `publish-post` + `schedule-post` in one `campaigns.ts`. They share fate correctly — if campaigns are down, all campaign actions down is correct behavior.
- **Merging separate capabilities to dodge the cap** → Alan Effect. A bug in one capability should NOT take down a different capability. GFI-plugs-in-series.

> **The rule:** organize serverless functions by **capability**, never by function-count. If capability-isolation fits under 12 → stay on Hobby. If it does NOT → that is the signal to move to Vercel Pro (needed for commercial use anyway), NOT to corrupt the architecture. Never merge unrelated capabilities to dodge the cap.

**The cost reframe:** Vercel Pro is ~$20/mo. The cost of a cascade failure taking down checkout or QB during a demo is catastrophic. $20/mo to keep capabilities failure-isolated is the cheapest insurance available. *(Grandfather: costs almost nothing to do it right; costs an awful lot to do it wrong.)*

**Operational check when recomposing api/ functions:**
- Within one capability → consolidate freely.
- Across separate capabilities → STOP. That's the cascade signal. Move to Vercel Pro, keep them isolated.

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

PIN is the platform-wide gesture layer for on-the-job operators (shop floor, counter,
field, distribution). Email/password is the auth layer — every vertical uses it for
account creation and recovery. The gesture layer wraps the auth layer; it never replaces it.

Ignition OS: PIN on shop floor and kiosk. No keyboard entry.
Cultivar OS: PIN for daily counter/operations access; owner uses email/password to create account.
KINNA-OS: PIN for distribution volunteers on shared devices.
Conduit OS: PIN for field techs on tablets.
CoolRunnings: Biometric-first via mobile passkey (phone-based, not shared hardware).

One auth module supports all patterns. The vertical config drives gesture choice.
No vertical writes its own auth logic.

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

### KINNA-OS — Faith-Based and Direct-Service Nonprofits
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

## PART 16 — TILE SYSTEM STANDARD (Platform-Wide)

> Decision locked 2026-05-29: The shared tile system is the standard module navigation pattern for ALL TRACE verticals. No vertical builds its own navigation component for modules. Ignition OS's current hardcoded tab system is tech debt to be converted.

### What a Tile Is

A tile is a tappable card representing one module or integration. It has exactly three states:

| State | Meaning | User action |
|---|---|---|
| `active` | Module is enabled AND configured | Tap → navigate to module page |
| `available` | Module exists but not yet enabled/configured | Tap → enable/setup flow |
| `locked` | Module requires a higher subscription tier | Tap → no-op (tier copy shown) |

### Shared Implementation

| File | Role |
|---|---|
| `packages/shared/src/components/tiles/Tile.tsx` | Single tile — icon, label, state badge, count badge, click dispatch |
| `packages/shared/src/components/tiles/TileGrid.tsx` | Responsive grid container |
| `packages/shared/src/context/BusinessProvider.tsx` | Provides `businessId` consumed by `useModules` |

**Tile props contract:**
```typescript
interface TileProps {
  id: string;
  label: string;
  icon: ComponentType<LucideProps>;
  color: string;              // icon color
  bg: string;                 // card background
  state: 'active' | 'available' | 'locked';
  onEnable?: () => void;      // fires when available tile tapped
  onNavigate?: () => void;    // fires when active tile tapped
  tierRequired?: string;      // shown on locked tiles
  count?: number;             // amber badge (social drafts, alerts)
}
```

### DB Schema Required per Vertical

Every vertical must have two tables in its own Supabase project:

```sql
-- System registry (seeded once, read-only at runtime)
CREATE TABLE modules (
  key            text PRIMARY KEY,
  name           text NOT NULL,
  description    text,
  tier_required  text   -- null = all tiers, 'growth' = paid only
);

-- Per-business enable/config state
CREATE TABLE business_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  module_key  text NOT NULL REFERENCES modules(key),
  enabled     boolean NOT NULL DEFAULT false,
  configured  boolean NOT NULL DEFAULT false,
  config      jsonb,
  updated_at  timestamptz,
  UNIQUE(business_id, module_key)
);
```

> Note: Cultivar OS currently uses the table name `nursery_modules` for backward compat. New verticals should use `business_modules`. Cultivar will rename post-demo.

### Pain Point → Tile Activation (Onboarding Contract)

The onboarding wizard records which pain points the owner selected. These drive which tiles appear `active` vs `available` on first login:

| Pain Point | Primary Tile Surfaced First |
|---|---|
| Missed sales / add-ons | `qr_checkout` (leakage tracking) |
| Invoicing takes too long | `qb_invoicing` |
| Social media | `social_media` |
| Delivery logistics | `delivery_routing` |
| Customer follow-up | `followup_engine` |

### Ignition OS Conversion — Required Work

Ignition currently uses hardcoded navigation tabs (IgnitionOmniDashboard.jsx) and a localStorage-based module trial system (AdminSubscription.jsx / DataBridge). This is the tech debt to convert.

**Conversion scope:**

| Step | Work | Effort |
|---|---|---|
| 1 | Create `modules` + `business_modules` tables in Ignition Supabase project | Small — SQL migration |
| 2 | Seed module rows: FLUX, PREDICTIVE, ESTIMATOR, HUB, STOK, PROT, CODE, PROC | Small — seed SQL |
| 3 | Port `AdminSubscription.jsx` trial state from `DataBridge.load('system_subscriptions')` → Supabase `business_modules` | Medium — rewrites trial logic |
| 4 | Build `useIgnitionModules()` hook (or parameterize shared `useModules()` with vertical key) | Small |
| 5 | Replace IgnitionOmniDashboard hardcoded TABS with `TileGrid` + `Tile` from shared | Medium |
| 6 | Wire `handleNavigate(key)` per Ignition module key | Small |
| 7 | Port data-blur trial expiry pattern from `IgnitionHub.jsx` → shared `LockedOverlay` | Medium |
| 8 | Replace `DataBridge` reads in each module with Supabase queries | Large — 28+ module files |

**Total estimate:** 2–3 dedicated sessions. Steps 1–6 can ship without step 8 (DataBridge can coexist with Supabase temporarily). Step 8 is the full DataBridge → Supabase migration from the June 15–July 15 roadmap window.

**Triggers this work:** First Ignition OS pilot shop install (June 15–July 15 window per roadmap).

---

## PART 17 — CULTIVAR OS MODULE REGISTRY

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

## PART 11 — CANONICAL PLATFORM VOCABULARY

One name per concept. Used identically in UI labels, code identifiers, database table names, and all documentation. When a vertical uses a different name today, it is tech debt — migrate to the canonical term on next touch.

### Module Names

| Canonical Name | What It Does | Ignition Label | Cultivar Label | Status |
|---|---|---|---|---|
| **Market** | Activate / deactivate tiles; manage subscription tier | Marketplace | *(missing)* | Ignition live; Cultivar pending |
| **PMI** | Preventive maintenance — asset registry, service schedule, service log | *(in Tools tab)* | Equipment *(new, 2026-05-29)* | Shared component built |
| **Audit** | Analyze receipts and invoices; flag missed charges or undercharges | Audit | *(missing)* | Ignition live |
| **Admin** | Settings, team, configuration | Admin | Settings | Rename Cultivar "Settings" → "Admin" on next touch |
| **Assets** | Registry of owned physical things — tools, equipment, vehicles, units | Tools | *(missing)* | Ignition live as "Tools"; rename on next touch |
| **Orders** | Customer transaction pipeline — pending, invoiced, paid, cancelled | Flux | Orders | Cultivar live; Ignition uses "Flux" (vertical-specific OK for now) |
| **Team** | Staff roster, roles, permissions, invite links | *(in Admin)* | *(missing)* | Not yet extracted |
| **Campaigns** | Social / marketing post scheduling and tone learning | *(missing)* | Campaigns | Cultivar live |
| **Delivery** | Route planning, stop sequencing, driver dispatch | *(missing)* | Deliveries | Cultivar live |

### Shared Data Concepts

| Canonical Term | Definition | Old Term(s) |
|---|---|---|
| `business_id` | Universal tenant anchor — every row that belongs to a business carries this | `nursery_id`, `shop_id` |
| `businesses` | Universal tenant table — one row per owner account per vertical | `nurseries`, `shops` (shops still exists for Ignition staff auth) |
| `service_offerings` | Everything a business sells or offers at checkout — transport, addons, subscriptions | `addons`, `transport_method`, `netting_price` |
| `pmi_assets` | Any physical asset that needs a maintenance schedule | `tools` (Ignition), *(none in Cultivar before 2026-05-29)* |
| `pmi_service_logs` | Immutable log of service events on a pmi_asset | *(DataBridge only in Ignition)* |
| `opportunity_items` | Business-level catalog of missed-sale prompts | `netting_price` (hardcoded), `addons` (partial) |
| `leakage_flag` | Boolean on an order: was an upsell opportunity declined? | Same — keep |

### Code Identifiers

| Canonical Term | Meaning | Replace |
|---|---|---|
| `businessId` | The tenant UUID in all frontend hooks and API calls | `nurseryId`, `shopId` |
| `useBusinessContext()` | The hook that resolves auth.uid() → business row | `useNursery()` |
| `BusinessProvider` | The context wrapper at app root | `NurseryProvider` |
| `DEMO_BUSINESS_ID` | The hardcoded demo tenant ID for read-only demos | `DEMO_NURSERY_ID` |
| `accounting_type` | Which accounting connector is active ('quickbooks' \| null) | `qb_realm_id` presence check |
| `accounting_token` | The OAuth access token for the accounting connector | `qb_access_token` |

### Styling

TRACE uses inline styles exclusively. Tailwind CSS is deprecated as of 2026-05-31 (see Tech Debt #14 in CLAUDE.md). Existing Tailwind in Ignition OS and two shared components (SavingsReport.jsx, QuickBooksConnector.jsx) is being converted to inline styles post-August 2026. All new code in any package uses `style={{ ... }}` inline styles, referencing shared design tokens where applicable (forthcoming: `packages/shared/src/design-system/tokens.ts`). The decision: one styling system across the platform, simple enough that any developer can understand any file without learning a separate framework.

### Rules

1. If you write a new module and it isn't in this table, add it here before shipping.
2. If you see a non-canonical name in code, add it to the tech debt log.
3. The canonical name is the one in the **Canonical Name** column — not what Ignition calls it, not what Cultivar calls it.
4. No new Tailwind in any file in any package. Inline styles are canonical.

---

*TRACE Enterprises · Built with CAI*
*builtwithcai.com · ignition-os.com · cultivar-os.app*
*cultivar-os.com · conduit-os.com*

*This document is the memory of the platform.*
*Update it when decisions are made, not after.*
*Version it in the changelog when sections change.*
