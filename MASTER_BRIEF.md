# MASTER_BRIEF.md
> **TRACE Enterprises — Built with CAI**
> Last updated: 2026-05-12
> Maintained by: [Owner] | Shared with: Development team
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

### For team members (sons / collaborators):
This file is the operating manual. Before touching any code or making any architectural decision, read the **Current Status**, **Active Decisions**, and **Plan of Action** sections. Update the **Changelog** at the bottom when you complete a milestone.

---

## PART 1 — THE COMPANY

### What We Are
TRACE Enterprises builds **Built with CAI** — a composable AI platform for small businesses. We build once, deploy everywhere. Each vertical is a re-skin of the same core stack. The infrastructure cost is already paid for.

### The One-Paragraph Version
Built with CAI is a composable AI operating system for owner-operated small businesses. Version 1 — **Ignition OS** — runs live for diesel and automotive repair shops. Every component is industry-agnostic by design. Each new vertical is a re-skin of the same stack: new tiles, new AI prompts, new integration hooks. Nothing rebuilt. The same $38–50 hardware kit, the same 14-day trial engine, the same sub-$50 customer acquisition cost. The beachhead is auto repair. The platform is everything else.

### Mission
Replace paper, gut-feel pricing, and lost margin with AI-native workflows — for the business owner who doesn't have an IT department.

### The Two Pitches

**To the shop owner / operator:**
> "Stop losing margin on parts, tools, and labor. 14 days free, no card. We'll set it up while you watch."
> Close with: the savings number from their own jobs during the trial.

**To the investor / partner / acquirer:**
> "We built a composable AI platform and proved it in the highest-friction SMB vertical on earth. The architecture re-skins to any industry in 60 days. Auto shops are the beachhead. The platform is the business."
> Close with: vertical expansion roadmap + 80% code reuse proof + CAC/LTV math.

**Rule:** Never lead with the platform story to a shop owner. They don't care. Lead with the dollar they're losing today.

---

## PART 2 — THE PLATFORM ARCHITECTURE

### Core Stack (Built Once, Inherited by Every Vertical)

| Layer | What It Is | Reusable? |
|---|---|---|
| Database | Supabase PostgreSQL — multi-tenant UUID isolation, Row Level Security | ✅ Yes |
| Data layer | DataBridge.js — local-first + cloud sync, offline queue, trial clock | ✅ Yes |
| AI layer | AIEngine.js + ai_router.py — routes tasks to Claude/Gemini/Whisper by type | ✅ Yes |
| Auth | PIN keypad, SHA-256 hash, session guard, role-based routing | ✅ Yes |
| Backend | FastAPI on Railway — AI router, QuickBooks bridge, AI usage logging | ✅ Yes |
| Billing engine | Tier subscription system, trial clock + data blur, savings report trigger | ✅ Yes |
| Margin engine | MarginEngine.js — slab pricing, override audit, parts markup calculator | ✅ Yes |
| Frontend | Vercel deployment, modular tile system, tier gating | ✅ Yes |

### Platform IP Summary

| Asset | Description | Status |
|---|---|---|
| Multi-tenant SaaS architecture | Supabase RLS, shop_id scoping, UUID isolation | ✅ Live |
| Unified AI router | AIEngine.js + ai_router.py — 3 providers, best model per task | ✅ Live |
| Modular tile system | Tier gating, composable blocks, add/remove per vertical | ✅ Live |
| Local-first + cloud sync | Works offline in a shop with spotty WiFi | ✅ Live |
| Physical GTM system | Hardware kit creates habit before first invoice | ✅ Validated |
| Trial-to-paid engine | Day 12 savings report, data blur, archive trigger | ✅ Live |
| Margin engine | Slab pricing + override audit, 5-level markup calculator | ✅ Live |
| Tool PMI system | Barcode chain of custody, PMI schedules, bypass log | ✅ Live |
| Job lifecycle state machine | 13-state RO flow: intake → closed | ✅ Live |
| Customer e-sign portal | Auth snapshot (legal-grade), approved/declined line items frozen | ✅ Live |

### Domain & Infrastructure Architecture

```
builtwithcai.com                    ← Platform home. Lists all products. Investor story.
├── ignition-os.builtwithcai.com    ← Auto shop product page
├── conduit-os.builtwithcai.com     ← HVAC product page (next)
└── docs.builtwithcai.com           ← Developer / partner documentation
```

**Owned domains:**
- `builtwithcai.com` — Purchased. Platform landing + investor story.
- `ignition-os.com` — Purchased. Auto/diesel domain → redirects to subdomain.
- `conduit-os.com` — Next purchase (~$0.01/yr, 3-yr term). HVAC domain.

**Why this structure:** One Railway project, one SSL wildcard cert (`*.builtwithcai.com`), one deployment pipeline. Product `.com` domains are for cold-call sales cards. Platform domain is for investors.

---

## PART 3 — REVENUE MODEL

### The Trial Engine (Same Across All Verticals)

| Day | Event |
|---|---|
| Day 1 | Kit installed. Trial starts. Full PREMIER access, no card. |
| Day 7 | In-app nudge: "X jobs processed, $Y in margin tracked" |
| Day 12 | Auto-generated savings report. Owner gets a call. |
| Day 14 | Trial expiry warning. Tiles gray at midnight. |
| Day 15 | Data visible but blurred. Subscribe button prominent. |
| Day 30 | Data archived (not deleted). Retrieval triggers subscription. |

**The psychology:** The shop has real data — real jobs, real parts, real tool history — in the system by day 14. Losing that data feels worse than $299/mo.

### Subscription Tiers (Ignition OS — Same Structure Across Verticals)

| Tier | Price | Users | AI | Target |
|---|---|---|---|---|
| STARTER | $149/mo | 3 | None | Getting off paper |
| PROFESSIONAL | $299/mo | 8 | Gemini + Claude + Whisper | AI-first workflow |
| PREMIER | $499/mo | Unlimited | All three, full usage | Fleet, multi-location |

### À La Carte Add-Ons
- Extra location: +$99/mo
- Extra user block (5 users): +$49/mo
- SMS / Twilio integration: +$29/mo
- API access (fleet integrations): +$99/mo

### Unit Economics

| Metric | Value |
|---|---|
| Hardware kit per shop | ~$35 |
| AI API cost during trial | ~$3–5 |
| Total CAC per pilot shop | ~$40–50 |
| Monthly revenue if converts (PRO) | $299 |
| Payback period | < 1 month |
| LTV at 12-month retention (PRO) | $3,588 |
| LTV at 24-month retention (PRO) | $7,176 |
| Gross margin (software only) | ~80%+ |

### MRR Projections (Conservative)

| Month | Converted Shops | MRR | Notes |
|---|---|---|---|
| Month 1 | 1 | $299 | First pilot converts |
| Month 3 | 5 | $1,495 | Local beachhead shops |
| Month 6 | 15 | $4,485 | Conduit OS launches |
| Month 12 | 40 | $11,960 | Two verticals active |
| Month 18 | 100 | $29,900 | Three verticals, add-ons growing |
| Month 24 | 200 | $59,800+ | Platform story provable to investors |

*These assume PROFESSIONAL tier only. PREMIER and add-ons push this materially higher.*

---

## PART 4 — THE AI ASSESSMENT INTEGRATION STRATEGY

### What Gemini Proposed vs. What We're Building

The Gemini-generated "AI Assessment Consultancy" concept — a $999 paid assessment identifying AI automation opportunities for small businesses — is not a standalone business. **It is a sales motion that feeds Built with CAI.**

### How It Works as a Funnel

```
Cold outreach / LinkedIn / referral
         ↓
$999 AI Assessment (45-min interview → custom automation roadmap)
         ↓
Report identifies: "You're losing $X/mo in margin gaps, unbilled labor, parts markup"
         ↓
Offer: "We already built the system that fixes this. 14-day free trial, no card."
         ↓
Hardware kit installed → Trial engine runs → Converts to subscription
```

### Why This Is Powerful
- The $999 assessment **pays for itself** (covers 20+ hardware kits)
- The shop owner is now **educated and pre-sold** before the trial starts
- Conversion rate from paid assessment → trial should be 80%+
- Assessment revenue offsets CAC to near zero for those accounts
- The assessment is also a **content machine** — every anonymized case study becomes LinkedIn authority content

### Assessment Workflow (Using Existing Stack)
1. **45-min interview** — recorded via Fathom on Google Meet. Focus: "what tasks do you hate that you can't delegate?"
2. **AI synthesis** — transcript fed to Claude via AIEngine.js. Custom prompts identify margin gaps and map to Ignition OS tiles.
3. **Report generation** — Gamma-produced impact/effort matrix + 4-day quick-win plan.
4. **Close** — "Here's exactly what Ignition OS solves. Want to see it live in your shop?"

### Pricing for the Combined Offer

| Entry Point | Price | Outcome |
|---|---|---|
| AI Assessment only | $999 | Roadmap + tool recommendations |
| Assessment + Trial | $999 + free 14-day trial | Assessment leads directly to pilot |
| Assessment + Setup | $1,499 | Assessment + we install and configure the kit |
| Skip assessment, trial only | Free (14 days) | Standard GTM motion |

---

## PART 5 — COMPETITIVE LANDSCAPE

### Ignition OS / Built with CAI Competitors

#### Tier 1 — Direct Vertical SaaS (Most Dangerous)

| Competitor | Price | Strengths | Weaknesses | Our Angle |
|---|---|---|---|---|
| **Tekmetric** | $199–$599/mo | Deep auto shop features, strong market share | No AI, no physical GTM, setup takes weeks | AI-native from day one; we're in their shop before they know we're a threat |
| **Shop-Ware** | $299–$799/mo | Modern UI, parts ordering integration | Expensive, no trial, no offline mode | Half the price, same output quality, 14-day free trial |
| **Mitchell 1 Manager SE** | $150–$400/mo | Industry legacy, deep DMS integration | Legacy software feel, no AI, no mobile kiosk | "Your current software is a spreadsheet with branding. Ours learns." |
| **ServiceTitan** | $398–$1,198/mo | Enterprise-grade, HVAC + plumbing | Priced for 20+ employees, 12-month contracts, requires implementation consultant | "Enterprise-grade AI, SMB price, no contract, 14-day trial" |
| **Housecall Pro** | $65–$299/mo | Easy to use, good mobile app | No AI, no margin engine, no tool tracking | Same price band, but we do the thinking for you |
| **Jobber** | $49–$249/mo | Clean UI, wide adoption | No AI, generic workflows, no physical moat | Jobber is a digital notepad. We're an operating system. |

#### Tier 2 — Generic AI Tools (Indirect)

| Competitor | Strengths | Weaknesses | Our Angle |
|---|---|---|---|
| **ChatGPT / Copilot** | Brand awareness, versatile | No vertical context, owner must know what to ask, no integration with jobs/parts/customers | "CAI knows what your business needs. You don't have to explain it." |
| **Zapier / Make** | Powerful automation | Requires technical setup, no SMB-friendly UI, no AI native | We use these as integration layers, not competitors |
| **QuickBooks** | Accounting standard | Not a shop management tool; we integrate with it | "We feed QuickBooks. We don't replace it." |

#### Tier 3 — Enterprise (Not a Real Threat Yet)

| Competitor | Why They're Not a Threat Now |
|---|---|
| SAP Business One | $1,500+/mo, requires implementation partner, 50+ employee target |
| Salesforce Field Service | Same — priced and designed for enterprise |
| Microsoft Dynamics | Not SMB-accessible, requires IT infrastructure |

### AI Assessment Consultancy Competitors

| Competitor | Model | Weakness | Our Angle |
|---|---|---|---|
| **McKinsey / Deloitte AI practices** | $50k–$500k engagements | Priced for Fortune 500, no SMB relevance | We're the $999 version that actually gets implemented |
| **Freelance AI consultants (Upwork/Fiverr)** | $50–$200/hr, generic advice | No productized system, no follow-through, no software to back it up | We don't just tell you what to do — we hand you the tool that does it |
| **Local IT consultants** | One-off projects, hourly billing | No recurring value, no AI expertise, no vertical depth | We're vertical-specific and backed by a live platform |
| **AI tool vendors (HubSpot, Monday.com)** | Sell their own tools as "AI solutions" | Self-serving recommendations, no honest assessment | We're tool-agnostic in the assessment; we recommend what's right for the shop |

### Our Defensible Moats (What Can't Be Copied Quickly)

1. **Physical hardware moat** — Tools are barcoded, PMI schedules running, job history in Supabase. Leaving means losing everything. Copying the software doesn't copy the data.
2. **Multi-vertical architecture** — Competitors are monolithic. We're in 5 verticals before they can build a second one.
3. **Trial engine psychology** — By day 14, the shop has real operational data. The switching cost is emotional, not just financial.
4. **AI router** — Three AI providers (Claude, Gemini, Whisper) routing to the best model per task. No competitor has this in the SMB space.
5. **Sub-$50 CAC** — Our physical GTM (hardware kit) creates habit before the first invoice. Most SaaS competitors spend $300–$1,000+ to acquire a customer.

---

## PART 6 — VERTICAL ROADMAP

### V1 — Ignition OS (Auto / Diesel Repair) — NOW
**Status:** End-to-end dry run in progress. Production Supabase live. Full job lifecycle built and deployed to Vercel.
**Domain:** ignition-os.com
**Beachhead region:** Liberty Hill / Georgetown / Round Rock / North Austin TX
**Target:** Independent diesel/auto shops, 3–8 bays, $500K–$3M/yr
**Hook:** Margin engine — "what you charge vs. what the slab recommends"
**Physical moat:** Tools barcoded, PMI schedules running, job history in Supabase = leaving means losing everything
**Why first:** Highest friction SMB vertical. If the platform survives here, it survives anywhere.

**Ignition OS Tile Inventory (Built):**
- Customer intake + approval portal (e-sign, legal-grade auth snapshot)
- Tech kiosk (mobile, PIN-based)
- Tool tracking + barcode (chain of custody, PMI schedules, bypass log)
- Margin engine (slab pricing, 5-level markup, override audit)
- Labor clock + time ledger
- Invoice + payment
- OMNI analytics + velocity leaderboard
- Admin + billing (trial clock, data blur, archive trigger)
- Job lifecycle state machine (13 states: intake → closed)

---

### V2 — Conduit OS (HVAC / Plumbing / Electrical) — NEXT (60 days)
**Status:** Pre-build planning complete
**Domain:** conduit-os.com (purchase pending)
**Target:** 1–3 truck owner-operators, $300K–$2M/yr
**Market size:** $180B HVAC + $130B Plumbing + $210B Electrical = $520B total; 94% SMB owner-operators
**Hook:** Parts markup gap — "what you charge for refrigerant vs. what you paid"
**Regulatory add-on:** EPA Section 608 refrigerant tracking — compliance tile, immediate PREMIER differentiator
**New tile needed:** Service Agreement Manager (recurring maintenance contracts)
**Build estimate:** 25–34 hours. Fork Ignition OS → rename UI labels → new compliance tile → new AI prompts.
**Carry-over modules (zero code change):** Customer intake, tech kiosk, tool tracking, margin engine, labor clock, invoice, OMNI analytics, admin + billing

---

### V3 — Anchor OS (Food Service / Restaurant) — 60 days post-Conduit
**Status:** Planning
**Target:** Restaurant owners, food trucks, catering — 1–3 locations
**Market size:** $997B US restaurant industry; ~80% independent operators
**Hook:** Recipe cost vs. menu price — the food cost margin engine
**New tiles:** Recipe Cost Calculator, Waste Log, Shift Scheduling, Health Inspection Checklist
**Key reuse:** Inventory (IgnitionSTOK → ingredient tracking), Vendor PO, Customer CRM
**Domain pattern:** anchor-os.com → anchor-os.builtwithcai.com
**Entry angle:** Food trucks first (lower complexity, high pain, owner is always on-site)

---

### V4 — FieldOS (Home Services Expansion)
**Status:** Future planning
**Target:** Larger HVAC, landscaping, pool service, pest control — 5–20 trucks
**Differentiator from Conduit OS:** Route optimization, GPS dispatch, fleet compliance, predictive maintenance
**Key reuse:** HUB dispatch module, tool PMI, DOT compliance forms
**Revenue angle:** Fleet tracking add-on at +$99/mo per truck

---

### V5 — StockOS (Retail / Boutique / Consignment)
**Status:** Future planning
**Target:** Independent retail, boutiques, consignment shops
**Market size:** 1M+ independent retail locations in US
**Hook:** Inventory turns + dead stock report — "you have $12,000 sitting that hasn't moved in 90 days"
**New tiles:** POS sync, VIP CRM, Dynamic Merchandising, Consignment Tracker
**Key reuse:** Inventory module, CRM, Invoice, OMNI analytics

---

## PART 7 — THE PHYSICAL GTM SYSTEM

### Hardware Kit (Target: Under $50 Per Shop)

| Item | Model | Purpose | Cost |
|---|---|---|---|
| Magnetic mount | RAM Mounts neodymium base | Phone at workstation — always on app | ~$25 |
| Charging cable | Anker PowerLine III USB-C | Survives shop abuse | ~$10 |
| Voice cheat sheet | Print + laminate locally | Taped to toolbox — instant command reference | ~$1 |
| Branded sticker | Custom (Sticker Mule) | Logo visible daily — brand reinforcement | ~$2 |

**For demos:** Brother QL-820NWB (~$200) — WiFi/Bluetooth, prints barcodes wirelessly in 3 seconds. The demo close.
**Pilot loaner:** Brother QL-800 (~$120, USB) — leave with converting shops. Recover after trial if they don't convert.

**The play:** Leave hardware at the shop on day one. Once tools are barcoded, PMI schedules running, and job history is live — leaving means losing everything. The hardware creates switching cost before the first invoice.

---

## PART 8 — TEAM & ROLES

### Current Team Structure

| Role | Person | Primary Responsibility |
|---|---|---|
| Founder / Strategy | [Owner] | Vision, sales, investor relations, strategic decisions |
| Developer 1 | [Son 1] | [Define: frontend / backend / full-stack?] |
| Developer 2 | [Son 2] | [Define: frontend / backend / full-stack?] |

### How We Work Together
- **This file** (`MASTER_BRIEF.md`) is the handoff document. Update it when milestones are completed.
- **Claude Code** handles build tasks. Start every session: *"Read MASTER_BRIEF.md. Current task: [X]."*
- **Claude.ai** handles strategy, writing, investor materials, and planning. Upload this file each session.
- **GitHub** is the source of truth for code. This file lives in the root of the repo.

### Decision Authority
| Decision Type | Who Decides |
|---|---|
| Architecture changes | All three — consensus required |
| New vertical launch | Founder |
| Pricing changes | Founder |
| UI/UX within existing tile | Developer assigned |
| New tile build | Founder approves, developer executes |

---

## PART 9 — PLAN OF ACTION

### Phase 0 — Complete the Beachhead (NOW — Next 2 Weeks)

**Goal:** Ignition OS end-to-end dry run on a real repair order. First customer walk-in ready.

| Priority | Task | Owner | Status |
|---|---|---|---|
| 🔴 P1 | Complete end-to-end dry run on real RO | Dev team | In progress |
| 🔴 P1 | Validate trial clock + data blur on expiry | Dev team | Pending |
| 🔴 P1 | Validate savings report auto-generation (Day 12) | Dev team | Pending |
| 🔴 P1 | Test barcode print + tool scan full loop | Dev team | Pending |
| 🟡 P2 | Build ignition-os.builtwithcai.com landing page | Dev team | Pending |
| 🟡 P2 | Prepare hardware kit for first pilot shop | Founder | Pending |
| 🟡 P2 | Identify and contact 3 pilot shops in beachhead area | Founder | Pending |
| 🟢 P3 | Document dry run results in this file (Changelog) | All | Pending |

---

### Phase 1 — First Paying Customer (Weeks 3–6)

**Goal:** One shop on a paid subscription. Proof the trial-to-paid engine works.

| Priority | Task | Owner | Notes |
|---|---|---|---|
| 🔴 P1 | Install kit at pilot shop #1 | Founder | Day 1 of trial clock |
| 🔴 P1 | Monitor Day 7 nudge, Day 12 savings report | Dev team | Validate automation |
| 🔴 P1 | Owner call on Day 12 — review savings report | Founder | Sales call |
| 🟡 P2 | Install at pilot shops #2 and #3 | Founder | Stagger by 1 week each |
| 🟡 P2 | Document conversion objections | Founder | Feed into pricing/messaging |
| 🟢 P3 | Build first LinkedIn case study (anonymized) | Founder | AI Assessment funnel seed |

---

### Phase 2 — AI Assessment Sales Funnel (Weeks 4–8, runs parallel)

**Goal:** Run 3 paid AI Assessments. Use at least 2 as direct pipeline into Ignition OS trials.

| Priority | Task | Owner | Notes |
|---|---|---|---|
| 🔴 P1 | Define the 45-min interview script | Founder | Focus on "bottleneck" tasks |
| 🔴 P1 | Build Claude prompt for transcript → roadmap synthesis | Dev team | Uses AIEngine.js |
| 🟡 P2 | Create Gamma report template for assessment deliverable | Founder | Reusable for each client |
| 🟡 P2 | Set up Fathom for recording + transcription | Founder | Free tier available |
| 🟡 P2 | Post first "Invisible Leak" case study on LinkedIn | Founder | Drives inbound |
| 🟡 P2 | Price and launch: $999 assessment / $1,499 assessment + setup | Founder | Test both |
| 🟢 P3 | Track: how many assessments → Ignition OS trials | Founder | Validate funnel |

---

### Phase 3 — Conduit OS Build (Weeks 8–14)

**Goal:** Fork Ignition OS into Conduit OS. Deploy to conduit-os.builtwithcai.com. First HVAC pilot.

| Priority | Task | Owner | Notes |
|---|---|---|---|
| 🔴 P1 | Purchase conduit-os.com domain | Founder | ~$0.01/yr, 3-yr term |
| 🔴 P1 | Fork Ignition OS codebase into conduit-os branch | Dev team | Do not modify Ignition OS main |
| 🔴 P1 | Rename UI labels: vehicle→equipment, RO→service ticket | Dev team | ~2 hours |
| 🔴 P1 | Build EPA Section 608 compliance tile | Dev team | PREMIER differentiator |
| 🔴 P1 | Build Service Agreement Manager tile | Dev team | Their recurring revenue tool |
| 🟡 P2 | Update AI prompts for HVAC fault codes | Dev team | AIEngine.js update |
| 🟡 P2 | Deploy conduit-os.builtwithcai.com | Dev team | Same Railway project |
| 🟡 P2 | Identify 3 HVAC pilot operators in beachhead region | Founder | 1–3 truck owner-operators |
| 🟢 P3 | Update builtwithcai.com to list both products | Dev team | Platform story begins |

---

### Phase 4 — Platform Story & Investor Readiness (Months 4–6)

**Goal:** 10+ paying shops across 2 verticals. MRR visible. Investor deck ready.

| Priority | Task | Owner | Notes |
|---|---|---|---|
| 🔴 P1 | Hit 10 paying shops (any tier, any vertical) | Founder + Dev | Proof of repeatability |
| 🔴 P1 | Build builtwithcai.com investor landing page | Dev team | Platform story, not product story |
| 🟡 P2 | Produce investor one-pager (from this brief) | Founder + Claude.ai | Upload MASTER_BRIEF.md to Claude.ai |
| 🟡 P2 | Document 80% code reuse proof with metrics | Dev team | Investor credibility |
| 🟡 P2 | Begin Anchor OS planning (food service) | Founder | V3 pre-build |
| 🟢 P3 | Apply to 1–2 Texas-based startup programs or accelerators | Founder | SXSW ecosystem, Capital Factory |

---

## PART 10 — OPEN QUESTIONS & ACTIVE DECISIONS

These are unresolved items. Do not make unilateral decisions on these without team alignment.

| # | Question | Context | Status |
|---|---|---|---|
| 1 | Do we charge for the AI Assessment separately or bundle it as a premium trial entry? | Assessment-as-funnel vs. assessment-as-revenue | Open |
| 2 | What is the developer role split between the two sons? | Need clear ownership per module to avoid conflicts | Open — define in team section |
| 3 | Do we pursue outside funding at the 10-shop milestone or bootstrap to 25? | Affects how aggressively we build Conduit OS | Open |
| 4 | Do we hire a part-time salesperson for the beachhead region at Phase 2? | Founder bandwidth is the bottleneck for installs | Open |
| 5 | QuickBooks integration — which tier does it unlock? | Currently planned for PROFESSIONAL, but shops may expect it at STARTER | Open |
| 6 | Do we white-label the platform for other consultants / resellers? | High leverage but adds support burden | Future decision |

---

## PART 11 — GAPS TO CLOSE (Previously Identified)

These were identified during the Claude.ai strategy review on 2026-05-12:

| Gap | Priority | Assigned To |
|---|---|---|
| Financial model — MRR targets, break-even, runway (now in Part 3) | ✅ Done | Claude.ai |
| Competitive landscape (now in Part 5) | ✅ Done | Claude.ai |
| Team / founder section (partially done — needs role definitions) | 🟡 In progress | Founder |
| GTM timeline with milestones (now in Part 9) | ✅ Done | Claude.ai |
| Risk register | 🟡 Needed | Founder + Claude.ai |
| Investor one-pager (separate document) | 🟢 Phase 4 | Founder + Claude.ai |

### Risk Register (Initial Draft)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| First pilot shop doesn't convert | Medium | High | Have 3 pilots running simultaneously; one loss isn't fatal |
| Tekmetric / competitor drops price to compete | Low | Medium | Our moat is data lock-in + physical GTM, not price |
| AI API costs spike during scale | Medium | Medium | Usage logging already built; set per-tier caps |
| Founder bandwidth limits installs | High | Medium | Define a referral/installer partner program by Phase 2 |
| One developer leaves or is unavailable | Medium | High | Document all architecture decisions; Claude Code is the institutional memory |
| Trial engine doesn't convert at target rate | Medium | High | A/B test Day 12 savings report format; adjust pricing |

---

## PART 12 — CHANGELOG

*Update this section every time a milestone is completed. Include date, what was done, and who did it.*

| Date | Milestone | Who |
|---|---|---|
| 2026-05-12 | MASTER_BRIEF.md created. Strategy session with Claude.ai. Competitive landscape, financial model, AI Assessment integration strategy, and plan of action added. | Founder + Claude.ai |
| | | |
| | | |

---

## APPENDIX A — HOW TO START A CLAUDE CODE SESSION

Copy and paste this at the start of every Claude Code terminal session:

```
Read MASTER_BRIEF.md in the root of this repo before we begin.

Current phase: [Phase 0 / 1 / 2 / 3 / 4]
Current focus: [specific task from the Plan of Action]
Today's goal: [what you want to accomplish this session]

Do not make architectural changes outside the current focus area without flagging them first.
```

---

## APPENDIX B — HOW TO START A CLAUDE.AI SESSION

Upload MASTER_BRIEF.md and say:

```
Here is the current MASTER_BRIEF for Built with CAI / TRACE Enterprises.
Today I need help with: [strategy / writing / investor materials / competitive research / etc.]
Current status: [what phase you're in, what's been completed]
```

---

*Built with CAI — A TRACE Enterprises Platform*
*ignition-os.com · builtwithcai.com*
*MASTER_BRIEF.md — Keep this file updated. It is the memory of the company.*
