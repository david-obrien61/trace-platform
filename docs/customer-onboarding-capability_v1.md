# CUSTOMER ONBOARDING & CAPABILITY PACKAGE — v1
## The complete capability set for onboarding a customer — LAWNS as first instance

> ↑ **FEEDER doc.** The canonical live-status front-page is `TRACE-SESSION-BOOTSTRAP.md` → 📋 24-CAPABILITY BOARD. This doc holds the deep per-capability spec; for current colors/state, read the board.

**Version:** v1 · **Date:** 2026-06-19 · **Author:** Lightning (strategy synthesis), from this session's recons + conversation history + David's edits
**Intended repo home:** `docs/customer-onboarding-capability_v1.md`
**Purpose:** ONE document listing every capability the customer onboarding experience touches, the build status of each, **when** it's needed for the demo, and **how** it's demonstrated — plus a build-sequence recommendation for the LAWNS demo.
**Framing (David):** "These are needed for all customers — LAWNS is just the first. We're establishing what onboarding a customer should look like, using LAWNS as the example." So this is the reusable package; LAWNS proves it.

> **⚠️ STATUS FLAGS ARE CLAIMS, NOT TRUTH.** Every build-status flag below is Lightning's *provisional* synthesis from prior recons + conversation/doc history. They are inputs to be VERIFIED against the actual code (Cultivar + Ignition) and reconciled against `built-inventory.md` — see `docs/CAPABILITY-PACKAGE-GROUNDTRUTH.md` once that recon runs. Until then, treat 🟢/🟡/🔴/⚪ as "Lightning claims X — confirm against code." The ⚪ flags in particular are explicitly UNVERIFIED.

---

## HOW TO READ THE STATUS FLAGS

**Build status** — two things matter: what state it's in, AND how trustworthy that claim is.

- 🟢 **LIVE (verified)** — built and confirmed working, recon-verified this session or owner-proven.
- 🟡 **PARTIAL (verified)** — some of it exists, recon-confirmed this session; real work remains.
- 🔴 **NET-NEW** — does not exist; must be built.
- ⚪ **CLAIMED (NOT re-verified)** — docs/conversation say it's built, but NOT confirmed this session. **Treat as "must verify-first before trusting."** (We've been burned by phantom-built claims before — e.g. `pmi_assets`.)

**When** — `DEMO-BLOCKING` (the demo fails without it) · `PHASE-1` (wanted soon, not demo-day) · `WHAT-ELSE` (the "what else does it do?" answer when Terry asks — shown as roadmap, not built).

---

# LAYER 0 — THE FOUNDATION (the why under everything)

### 0.1 Customer-zero / capability-composition model
- **What:** The unit of the platform is the CAPABILITY, not the vertical. A vertical (Cultivar, Ignition…) is just a default *bundle* of capabilities. Verticals are **config-driven pointers**, not separate apps — ~80% shared code, heavy variable reliance (e.g. flip "nursery"→"grower" with no code change). David is customer-zero: the problems are his own.
- **Status:** 🟡 PARTIAL (verified this session) — the architecture constants (AC-1 variation-in-data-not-schema) are locked and the shared spine is real; full config-driven vertical-as-pointer is in-progress, not complete.
- **When:** Foundational — not demoed directly, but it's *why* the onboarding composes.
- **How demonstrated:** Implicitly — the customer sees their vertical "just know" their business; they never see the bundle mechanics. (NATO lesson: don't weld terminology in.)

---

# LAYER 1 — THE ONBOARDING ARC (front of the experience)

### 1.1 Recognition — "we know you" (+ correction moment)
- **What:** On contact, discovery reads their **live** site and reflects their business back. The stronger version: catches a discrepancy ("we notice your site lists owner X — is this correct? Your site may be stale"). **David: in scope — but we must interrogate the LIVE website, not a cached/history copy. That is honesty in action.**
- **Status:** 🟡 PARTIAL (verified) — website-read engine (`fetchWebsiteContent`) is real and solid; two-pass Claude extraction works; glimpse UI wired. The **discrepancy-compare** ("you said X, site says Y") is 🔴 NET-NEW.
- **When:** DEMO-BLOCKING (it's the first wow).
- **How demonstrated:** Customer enters URL → within seconds sees accurate observations about their own business → optional "we noticed X, correct?" moment.

### 1.2 Sandbox — the alive dashboard (play with sample data)
- **What:** Dashboard is **never empty**. Discovery seeds a believable ~7-day sample dataset **branded as their business** so they can play (generate a sale, watch add-ons fire, see history). **David: "sandbox" is a removable label — it comes off when they subscribe and load real data.**
- **Status:** 🔴 NET-NEW for the *real* wow. `seed.ts` exists but is orphaned and only writes inactive $0 service-offerings (verified) — NOT a believable 7-day branded dataset. The sandbox seed is net-new.
- **When:** DEMO-BLOCKING.
- **How demonstrated:** They walk into a dashboard already alive with their name and a week of believable activity.

### 1.3 "Do you really want to see what we can do?" — clear sandbox → real populate
- **What:** A prompt; on click, **clear the sandbox** and **AI-populate their real data** (catalog, inventory types) from their site. Full D-9 honesty — flag uncertain mappings, never silently mis-map.
- **Status:** 🔴 NET-NEW. Catalog extraction (varieties/categories) does not exist (verified — engine extracts services, not catalog). D-9 honesty in discovery does not exist (verified — `seed.ts` currently does the *opposite*: silent coercion → see tech-debt item below).
- **When:** DEMO-BLOCKING (this is THE wow).
- **How demonstrated:** Click → sandbox clears → their real lineup (e.g. 116 varieties, 27 categories) materializes, flagged where uncertain.

### 1.4 AI-assisted questions — the onboarding IS the demo
- **What:** For what the site can't tell us (sizes, counts), discovery **asks** — and the asking *is* the demonstration of "exploiting AI for small business." They confirm; the AI configures. **David: if builtwithCAI shows "exploit AI for small business," add that to the definition.**
- **Status:** 🟡 PARTIAL (verified) — pain-point/question scaffolding exists in discovery; the "asking-as-configuration" wiring into real setup is net-new.
- **When:** DEMO-BLOCKING (it's the close of the wow).
- **How demonstrated:** A short AI conversation fills the gaps the site couldn't; customer watches setup happen by talking, not form-filling.

### 1.5 The handshake — one auth, two products
- **What:** Discovery account = vertical login (same Supabase auth). **David's flow:** email + password + (business address OR website URL) → validation email → link back to discovery (so we track/learn) → if they continue, passed via link to chosen vertical (general / grower / auto / trades) → scrape → sandbox → real-populate. ("Handshake" = David's term for the documented "bridge"/"login transition.")
- **Status:** 🟡 PARTIAL — the auth mechanism exists; the discovery→vertical pass is designed. `business_discovery_profiles` persistence table is 🔴 NET-NEW (v2, not built — verified in built-inventory).
- **When:** DEMO-BLOCKING (the demo rides on it).
- **How demonstrated:** They sign up once at discovery and land in their vertical already logged in and already known.

---

# LAYER 2 — POINT OF SALE (the transaction)

### 2.1 Cart path / QR checkout (no money in-app)
- **What (David's full flow):** Customer scans QR on phone → learns about the tree → selects for purchase → cart shows price + add-ons → selects purchase → **invoice ready at office → customer swipes card in person → transaction complete → tree loaded / delivered / delivered-and-planted.** Customer is now emailable, phone captured, address on file.
- **Status:** 🟢 LIVE (verified) — full QR→profile→addons→cart-review→submit→confirmation flow exists; takes **no money in-app** (no Stripe/charge calls; "pay" buttons are demo links). Order completes as `pending`. The "no money" intent = "pay at office" (in-person), which already exists. Minor relabel only.
- **When:** DEMO-BLOCKING.
- **How demonstrated:** Walk to a tree, scan, build a cart with add-ons, complete to an in-office invoice — no money moves in the app.

### 2.2 Compliance capture — netting / Texas-law (the Regina story)
- **What:** At point of sale, prompt for load-securing netting (TX Transp. Code Ch. 725), capture accepted/declined with the law citation (liability protection). The emotional core of the pitch — the Regina 40-minute-drive story made literal.
- **Status:** ⚪ CLAIMED — netting prompt with red border + Texas-law citation + decline tracking was built per conversation history; NOT re-verified this session. **Verify-first before demo.**
- **When:** DEMO-BLOCKING (it's the founding story).
- **How demonstrated:** During checkout the netting prompt fires *before* the sale closes — the opposite of what happened to Regina.

### 2.3 Walk-and-count inventory
- **What:** Walk the lot, scan QR/tag → OCR the variety → pick size → enter qty → save → dated count snapshot. First count bootstraps the catalog (create-on-confirmed-miss).
- **Status:** 🟡 PARTIAL (verified) — OCR engine + camera/compression reusable (verified); catalog-match, count-session store, size dimension are 🔴 NET-NEW. Recon complete, build prompt written, not yet built.
- **When:** DEMO-BLOCKING (the physical-proof beat: count a real tree).
- **How demonstrated:** Walk outside, scan a real tag, size + qty, "bam — a real count" tied to the dashboard.

---

# LAYER 3 — GAP-FILLERS (the intelligence existing tools can't do)

### 3.1 Leakage / missed-upsell visibility (the quantified Regina story)
- **What:** `leakage_flag` on orders (15-gal+ tree with zero add-ons) → owner dashboard: "X sales this week with no add-ons — est. $Y missed." (US-010/011/012.) Demo moment in the user stories: *"This is what Regina's order would have flagged."*
- **Status:** ⚪ CLAIMED — `leakage_flag` field + dashboard alert built per history (US-010/011/012 marked "Demo — must work"); NOT re-verified this session. **Verify-first.**
- **When:** DEMO-BLOCKING (it's the Regina story as a *metric* — arguably the strongest gap-filler).
- **How demonstrated:** After the checkout demo, show the dashboard alert quantifying missed revenue.

### 3.2 Suggestion engine (at-moment-of-sale upsell)
- **What:** Shared capability firing **after every transaction**: immediate add-ons, scheduled services, reorder reminders. Cross-vertical (crush-washer in Ignition, fertilizer in Cultivar).
- **Status:** ⚪ CLAIMED (concept formalized; shared notification engine architected per history) — implementation NOT re-verified. Likely 🟡 PARTIAL at best. **Verify-first.**
- **When:** PHASE-1 (nice in demo; overlaps add-ons which are live).
- **How demonstrated:** At checkout, relevant add-ons surface automatically.

### 3.3 Post-sale service engine (configurable triggers)
- **What:** Lauren adds a **service item** (Fertilizer, Mulch…) and sets triggers with no code: declined→3 days; purchased→180/365 days; tree purchased + hot months→90 days. Follow-up fires to her action queue; customer can self-book. (Epic 5: US-013 no-purchase follow-up, US-014 reorder follow-up, US-015 customer self-books.) Rides shared notification engine. **This is the back half of David's cart story — "customer relationship follow-up."**
- **Status:** 🔴 NET-NEW (fully specified in user stories, not built — no contradicting build claim found).
- **When:** PHASE-1 (huge value; shown as "and then this happens automatically").
- **How demonstrated:** Show the config (add an item, set a trigger) + a queued follow-up firing — "you never track this by hand again."

### 3.4 Scheduling (customer self-book + owner calendar)
- **What:** Customer books a service/delivery slot themselves; owner sees a calendar and plans around it. Tied to route days.
- **Status:** 🔴 NET-NEW (referenced across follow-up + delivery stories; no standalone scheduler built). **David named this as missing from the first list — confirmed in.**
- **When:** PHASE-1.
- **How demonstrated:** Customer self-books from a follow-up link; owner sees the booking land on a calendar.

### 3.5 Routing / delivery management
- **What:** Delivery + planting management; route-day planning ("3 customers near Tuesday's Cedar Park route"). Configurable transport/delivery options Lauren prices herself.
- **Status:** ⚪ CLAIMED PARTIAL — "Delivery" tile listed Phase-1-available; transport options flagged as needing to move to a configurable table (open issue at last mention). NOT verified. **Verify-first.**
- **When:** PHASE-1.
- **How demonstrated:** Group due follow-ups by route day; plan a delivery run.

### 3.6 Insights / analytics dashboard
- **What:** Owner's at-a-glance: plants tracked, live inventory value, today's sales, installs this week, leakage alerts. (US-011.)
- **Status:** ⚪ CLAIMED — owner dashboard built per history (US-011 "Demo — must work"); NOT re-verified. **Verify-first.**
- **When:** DEMO-BLOCKING (it's the dashboard the sandbox/real-populate fills).
- **How demonstrated:** The live dashboard the customer lands on — the thing that's "never empty."

---

# LAYER 4 — CONNECTORS (connect what they already have)

### 4.1 QuickBooks (invoice, sync, reconciliation source)
- **What:** QB invoice creation from checkout; token refresh; the source of truth for the reconciliation whammy.
- **Status:** ⚪ CLAIMED LIVE — real QB invoice created/verified in production per history; token-refresh built; Intuit production approval completed. NOT re-verified this session. **Verify-first (token/connection state drifts).**
- **When:** DEMO-BLOCKING (cart invoice + reconciliation depend on it).
- **How demonstrated:** Checkout produces a real QB invoice; "you didn't type anything."

### 4.2 Reconciliation double-whammy (validity check)
- **What:** Point at QBO **or** an Excel sheet → near-real-time validity check: "you counted Vitex 15-gal: 45, records show 47 — which is today's truth, or flag 2 missing?"
- **Status:** 🔴 NET-NEW (deliberately deferred — needs their source of truth; out of scope for the count build).
- **When:** WHAT-ELSE / PHASE-1 upsell (the "double whammy" close, shown as "when you connect QB, this").
- **How demonstrated:** Live variance check against their own records after the walk-and-count.

### 4.3 Social media (post generation + publishing)
- **What:** Claude-generated posts + Blotato publishing. One of Lauren's known pains.
- **Status:** ⚪ CLAIMED — social module built (Claude post-gen + Blotato) per history, but the *tile* was an active stub at last audit (empty handler). Mixed signal. **Verify-first.**
- **When:** WHAT-ELSE.
- **How demonstrated:** Generate a post about a featured tree; "this goes out without you writing it."

---

# LAYER 5 — OPERATIONAL ("what else does it do?" — Terry's question)

These are the depth tiles. Not demo-day; they're the answer when Terry asks "what else?" Per history, all locked Phase-1/2, mostly extractable from Ignition's PMI pattern.

| Capability | What | Status | When |
|---|---|---|---|
| **Inventory management** | Beyond the walk-count: ongoing stock | ⚪ CLAIMED (tile locked Phase-1) | PHASE-1 |
| **Equipment PMI** | Tractors/mowers/sprayers service schedules | ⚪ CLAIMED (extract from Ignition PMI) | WHAT-ELSE |
| **Water system** | Filters, lines, zones, flush schedules | 🔴 NET-NEW (no build anywhere per history) | WHAT-ELSE |
| **Greenhouse** | Per-greenhouse tracking, temp/humidity, capacity | 🔴 NET-NEW | WHAT-ELSE |
| **Seasonal** | Seasonal planning | ⚪ CLAIMED (tile locked Phase-1) | WHAT-ELSE |
| **Online shop** | Customer-facing storefront | ⚪ CLAIMED (tile available Phase-1) | WHAT-ELSE |
| **Contractors portal** | Contractor-specific pricing/accounts | ⚪ CLAIMED (tile locked Phase-2) | WHAT-ELSE |

**The line for Terry:** *"Everything you operate — equipment, irrigation, greenhouses. Service reminders, maintenance history. The same system that tracks your trees tracks everything on your property. You turn on what you need."*

---

# BUILD-SEQUENCE RECOMMENDATION (for the LAWNS demo)

Goal: the demo arc lands — recognition → sandbox → real-populate → walk-and-count → leakage → "what else." Sequenced by (a) what's demo-blocking and (b) what's net-new vs. just-needs-verifying.

### STEP 0 — Verify-first sweep (cheap, do before building anything)
Several DEMO-BLOCKING capabilities are ⚪ CLAIMED but unverified. Confirm these are actually live *before* trusting them in the demo — a phantom-built capability discovered live is the worst case:
- Compliance/netting prompt (2.2), Leakage dashboard (3.1), Owner dashboard/Insights (3.6), QuickBooks connection + token (4.1).
- *Why first:* if any are stale, that changes the build list. One read each.

### STEP 1 — The wow (net-new, the centerpiece, biggest build)
The whole front of the demo is net-new and it's the thing that sells:
- Sandbox seed (1.2) + clear→real catalog-populate (1.3) + D-9 honesty + catalog extraction.
- This is the single largest build. **David's call: build the full wow before re-engaging Lauren.**
- *Dependency note:* the handshake persistence (1.5, `business_discovery_profiles`) underpins this — build the minimum that lets populate work.

### STEP 2 — The physical proof (net-new, recon already done)
- Walk-and-count (2.3) — prompt already written; build it. Once 1.3 populates the catalog, the count has real varieties to match against, so this naturally follows the wow.

### STEP 3 — Recognition correction (net-new, smaller)
- The discrepancy-compare (1.1) — "we notice X, correct?" Adds polish to the opening wow; smaller than 1–2.

### STEP 4 — Demo-day connective tissue
- Relabel cart "pay at office" path (2.1) — trivial.
- Confirm the AI-assisted questions (1.4) wire into real setup.

### THEN (Phase-1, post-demo or as "coming"):
- Post-sale service engine (3.3) + scheduling (3.4) — the customer-relationship loop. Net-new, high value, shown as roadmap in the demo.
- Reconciliation whammy (4.2) — the upsell close, shown as "when you connect QB."

### NOT demo (WHAT-ELSE roadmap):
- Operational tiles (Layer 5), social (4.3) — the "what else does it do" answer, not built for demo.

---

# OPEN ITEMS / TECH DEBT TO LOG (from David's edits)

1. **`seed.ts` silent coercion** (David: "identify and document — is this bug or tech debt? We have places for this, write it down.") — `seed.ts` maps unknown category→'addon', price→0 silently. Violates D-9. **Log as tech debt; must be replaced with D-9 flagging before the real-populate (1.3) ships.**
2. **Clean-button vs Phase-3-clear** (David: "should be the same operation") — open question David raised: *if they clean and leave the platform, do we delete the business or mark it deleted? On the sandbox operation we keep their business profile (small distinction).* **Decision needed before building 1.3's clear step.**
3. **Discovery host** (apex `builtwithcai.com` vs `discovery.builtwithcai.com`) — still both in docs. **David: discovery is primarily at builtwithCAI.** Resolve to one when folding into canonical docs.
4. **Domain stack** — David confirmed the evolved model: verticals are config-driven pointers at their own domains (~80% shared code, variable-driven labels). Fix stale MASTER_BRIEF subdomain stack.

---

*Status flags are honest as of 2026-06-19: 🟢/🟡/🔴 = recon-verified this session; ⚪ = claimed in docs/history, NOT re-verified — verify-first before trusting in a demo. Next: David reviews; agreed version folds into canonical docs (MASTER_BRIEF / PLATFORM_STRATEGY / DISCOVERY_MODULE_BRIEF / DECISIONS / Tech Debt Log) via Thunder.*
