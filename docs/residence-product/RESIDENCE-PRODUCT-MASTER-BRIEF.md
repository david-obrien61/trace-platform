# RESIDENCE PRODUCT — Master Brief

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**The one doc to read first.** This consolidates a full design/prototype session into a
single front door: what the product is, the philosophy it's built through, where it sits in
the platform, the dependency-ordered build plan, the connector decisions, and an index to
every supporting spec. Hand this to Thunder; it points to everything else.

**Status:** Design + clickable prototype complete. Nothing is in the repo yet — this thread's
files are scratch until Thunder writes them in. **Customer-zero: David, running his own house.**

> **Reconciliation note (reuse, don't relitigate):** This product RIDES ON locked platform
> doctrine — it does not restate or redecide it. Specifically it inherits: *one source, many
> views* (one DB/engine/app skinned by type; .app = entry pointer, not separate app); the
> *schema naming convention* (shared = no vertical noun; vertical-specific = prefix); the
> *Apple value anchor* (difficult-look-easy, invisible maintenance, opinionated defaults) as
> the design north star; *Surface Honesty* (WORKS/LABELED/HIDDEN); the *PIN gesture standard*
> for auth; the existing *shared multi-tenant auth + RLS*; *Receipt Keeper* (already works;
> mobile OCR needs work); and the *local-first logic proven in DataBridge* for offline. Where
> this brief touches those, it POINTS at them. New contributions are the residence product
> itself, DESIGN-FOR-THE-MESS, variant memory, acquisition intelligence, ingredient-form,
> technique notes, the waste insight, and farmers-market-as-source.

---

## 1. What it is (one paragraph)
A household operations product — the residence treated as the smallest business, rooted at
the primary residence. It captures what the household already does (receipts), removes the
ceremony (logging, list-building, remembering where things were bought), and surfaces what
the owner can't see by hand: what they spend, what they waste, what's cheaper where, and
whether to drive / pick up / have it delivered. The kitchen/food loop is the first room, not
the whole house. It is NOT a recipe app or a pantry tracker — those exist and lose. The moat
is cross-supplier cost intelligence from the customer's own receipts, a chef's technique in
the house, the grow/raise channels, and the composable platform spine underneath.

## 2. Where it sits (architecture — LOGGED DECISION)
- **Layer:** shared core, NOT a vertical, NOT platform-infra. It is the residence-SCOPED
  view of the one shared engine — same spine as Cultivar/Ignition, skinned for a house
  ("business = my residence").
- **One source, many views (locked doctrine):** one agnostic database, one shared engine,
  one app skinned at runtime by business type. The residence product is NOT a separate app
  or a separate instance — it's the one app, skinned for the residence.
- **Schema naming (locked convention):** ~80% shared tables carry NO vertical noun (e.g.
  `receipts`); ~20% vertical-specific tables carry a vertical prefix (growers_, shop_,
  trades_). Residence/household tables that are shared-core take NO prefix; anything truly
  residence-specific takes its prefix. (Do NOT invent a `business_` prefix.)
- **Sibling to CoolRunnings, loosely coupled:** CoolRunnings = house SYSTEMS (off-grid,
  local-first); this = house OPERATIONS (food, supply, cost, schedule; runs anywhere). Can
  optionally run on a CoolRunnings box but MUST NOT require one — Terry/Lauren use it
  standalone.
- **Front door:** `home.builtwithcai.app` — an ENTRY-POINT POINTER into the one app, skinned
  for the residence (per one-source-many-views). Not a separate app.
- **TLD principle:** `.com` EXPLAINS/markets (discovery.builtwithcai.com), `.app` domains are
  entry points into the one app. Both owned. `.app` not yet wired.
- **Sequencing:** wiring `home.` is DEFERRED — it's an entry point into the general core, so
  `builtwithcai.app` (core) must get its `.app` home first. Build capabilities now; pointer
  last.
- **Auth/access (locked):** inherits the shared multi-tenant auth + RLS (already built/
  deployed) and the platform-wide **PIN gesture standard** (foundation for biometric). Do not
  reinvent login/sharing — reference these.

## 3. The philosophy — DESIGN FOR THE MESS (the lens for everything)
Full doc: `DESIGN-FOR-THE-MESS.md`. The essentials:
- **Every household runs a different OS, and they're all messy.** Nobody audits the pantry
  before shopping; there's a list on the fridge. The app starts from the mess and nudges —
  it never demands organization as the price of admission. Reward first, organize never.
- **Leverage what they're already doing; remove the ceremony.** People already shop, already
  get receipts, already rebuy the same things. The friction was never the content — it was
  the ritual (format, where, name, findable-again). The document model: Office/Adobe "Recent"
  won by removing the ceremony. So the list builds ITSELF from receipts (the real job of
  variant memory); the app carries the organizational burden; sharing makes one member's
  effort visible to all (or the ceremony returns for whoever didn't do it).
- **Plans must survive change.** The mess mutates mid-flight (pickup order ready → spouse
  calls, guest for dinner → pickup becomes pickup + walk-in on the same trip). Fulfillment
  mode is never locked at checkout.
- **Discipline is friction + feedback, not a trait.** Apps die because disciplined founders
  assume disciplined users. Visibility MANUFACTURES discipline — show the number effortlessly
  and people start caring. Families aren't undisciplined, they're **un-instrumented**; the
  app is the instrument that creates operational awareness (David's 40 yrs of military/gov
  knowledge management — engineer the awareness into the system so no one has to summon it).
- **The five real modes (design for all):** list-driven (David) · inspiration (Regina, chef)
  · heat-and-eat raid (Andrew) · just-in-case fallback · countdown-to-empty (Erin, 90-day
  travel nurse, single-serving, land at empty). One spine, many doors.

### Non-negotiable constraints (or it dies in two weeks)
1. Depletion must be effortless/invisible — NEVER a manual "scan-out" chore (the
   competitors' graveyard). Honestly-approximate (UNKNOWN, not zeroed) beats precise-but-
   abandoned.
2. Never scold — not on waste, fast food, or overspend. Information that helps incrementally,
   never judgment.
3. Reward before asking anything. 4. Optional enrichment, never required.

### Look & feel (full doc: DESIGN-AND-TRUST-STANDARD.md)
Lean base: React + TypeScript + plain CSS, NO Tailwind/framework (complexity rejected on
purpose). Design tokens (color/radii/spacing/type) defined once, reused everywhere.
**Responsive across device + orientation is REQUIRED** — fluid grid/flex + media queries +
orientation queries, mobile-first; every screen works on phone/tablet/desktop in both
orientations (native CSS, no framework). The "secure feeling" (Apple-adjacent calm) is
engineered via restraint + transparency — the CONFIRMED/DERIVED stamps and no-silent-data
ARE that feeling. Everything toggleable; default to calm-minimum, add via progressive
disclosure — never everything-on.

## 4. What it wins, in order
1. **VISIBILITY / BUDGET (lead win)** — "this is our number; don't surprise me." From
   receipts alone, zero discipline: the number, the monthly rhythm, the legible deviations
   (guests +, seasonal garden/orchard/vineyard −, Erin's bounded cycle).
2. **WASTE — bought-but-never-made** — Regina's tikka-masala-cod that became a forgotten
   receipt line. Surfaced as kindness ("bought 3×, never made — plan it or skip it?").
3. **MEET THE MODE** — serve each person's habit with the same engine.

## 5. Build plan (dependency-ordered — full doc: RESIDENCE-PRODUCT-BUILD-PLAN.md)
The core is **P0 + P1**: schema right, then receipt → structured inventory + price, persisted
on the spine. Nearly every smart feature is downstream of that. Order:
- **P0 — Schema + spine.** Residence-rooted tables following the LOCKED naming convention
  (shared = no vertical noun, e.g. `receipts`; residence-specific = prefix). cost_confidence
  CHECK; receipt_id count-once seam. INHERITS the existing shared multi-tenant auth + RLS
  (already built/deployed) — not new setup. Test multi-user early.
- **P1 — Core loop.** **Receipt Keeper already WORKS — WIRE to it, don't build it.** (Known
  gap: mobile-device OCR needs work — that's a fix, not a build.) Persist receipt_lines →
  inventory + price (CONFIRMED).
- **P1.5 — Visibility/budget.** The lead win; ship early.
- **P2 — Pantry + depletion** (effortless/invisible only).
- **P3 — Cost/price intelligence** (the moat, house-wide).
- **P4 — Planning** (calendar + recipes + Regina's notes; persistent week history).
- **P5 — Smart layer** (variant/size memory, consumption rate, delivery-vs-drive, bought-
  but-never-made, modes) — last, downstream of all history.
- **P6 — Connectors + offline.** Recipes/health/maps/deals connectors. Offline capture
  applies the **local-first logic proven in DataBridge** (pull the pattern, make it shared —
  not a module extraction). ✅ RECONCILED 2026-07-03: the shared foundation **already exists** —
  `packages/shared/src/sync/` (`SyncEngine` + `OfflineQueue` + `NamespacedStore`, built
  2026-06-26 for Cultivar's walk-and-count loop, ledger #54; its own header: "Built NEW in
  shared rather than moving DataBridge … DataBridge stays put as donor-reference"). Residence
  offline **inherits/extends this shared SyncEngine**, it does not re-derive it. See D-29.
  Sharing-UX rides with P2/P4.
- **P7 — Front door** (home.builtwithcai.app entry-point pointer — deferred, gated on core
  .app).

## 6. Connectors & data sources (all swappable via platform_config — D-009 lineage)
Governed by the **API NEUTRALITY decision (logged):** use any API that makes the answer more
honest or more effortless; refuse any whose price of admission is bias. Green = neutral
utilities; Red = single-retailer data that buys loyalty; Amber = retailer featuring, later,
from strength.

| Need | Source | Class | Notes |
|------|--------|-------|-------|
| Price spine | **the customer's own receipts** (existing `receipts` table / Receipt Keeper) | core | CONFIRMED, free, neutral, unbreakable, reflects real paid price incl. the deal. THE foundation. Receipt Keeper WORKS; mobile OCR needs work. |
| Recipes/ontology/parsing | Spoonacular (primary) + TheMealDB (free fallback) | green | metered, no long-term cache → bake stable form/conversion facts locally (AC-4). From Andrew. |
| Barcode → ingredients/additives | Open Food Facts | green | feeds health card |
| Nutrition gram-weights | USDA FoodData Central | green | the "national food DB" |
| Sources near a ZIP (meat, farmers market) | maps/places connector | green | markets = a source TYPE found by location, w/ day/season |
| Mileage (delivery-vs-drive) | maps/distance | green | DERIVED |
| Deal-finder (lowest price across stores) | see §6a | green (if neutral) | OPTIONAL enrichment, NOT the spine |

### 6a. Deal-finder — Connor's idea (optional enrichment, receipts stay primary)
Real and buildable; three candidate categories, very different:
1. **Retailer-direct** (Kroger has one) — single-retailer, no TX presence, neutrality risk.
2. **Scraper/aggregator** (Apify-style) — searches all stores, returns bestPrice. BUT
   ~$500/mo, brittle (breaks when store sites change), and snapshots MISS flash sales/coupons
   — exactly the deal data we'd want.
3. **Open Prices** (Open Food Facts family) — free, neutral, non-commercial; thinner coverage.
**Architecture rule:** receipts are the CONFIRMED price spine (they reflect the real price
paid, including the deal). A deal-finder is forward-looking "cheaper elsewhere this week"
enrichment — swappable, metered, never load-bearing. A scraper's "current" price is a guess;
your receipt is the truth.

### 6b. Fulfillment — three modes, per-order, splittable, change-surviving
in-store / pickup / delivery live ON the order, can be split, and can change after submit
(the dinner-guest call). Pickup often wins — kills shop-hungry impulse buys. Acquisition math
is 3-way (see DeliveryVsDrive.jsx, to grow from 2-way to 3-way when built for real).

## 7. What's built (prototype — clickable, in-memory, mocked backends)
- **KitchenLoop.jsx** — the tile. Tabs: This Week (full calendar, pickable week-start,
  past=history/future=editable), Capture (whiteboard reader), Recipes (+ Regina's technique
  notes teach/correct/pair, + cumin ingredient-form demo), Pantry (+ shelf-scan), Orders
  (+ variant memory honey/ketchup, + farmers-market ZIP finder), Freezers, Costs
  (make-vs-buy), Health. tsc-verified.
- **DeliveryVsDrive.jsx** — money-only vs money+time acquisition decision; verdict can flip.
- **SmartComparison.jsx** — database-smart vs assistant-smart, side by side (real ranch data).

## 8. Open questions (assign + answer)
**Andrew:** (a) does the receipt/scanner payload expose retailer item number (SKU) + size
reliably? (the join key for variant memory + everything price). (b) Spoonacular free-tier
point budget + is the course key reusable?
**Connor:** which deal-finder did you mean — retailer API / scraper (~$500/mo, misses
coupons) / Open Prices (free, thinner)? Service or key already chosen?
**David (deferred):** none blocking; wiring home.builtwithcai.app waits on core .app.

## 9. Working discipline carried from this session
- **tsc/parse-gate every artifact before claiming "it runs"** (three syntax-error rounds this
  session were caught by David loading it, not by brace-counting). BUILDER-COMPLETE ≠
  OWNER-PROVEN; only David loading it = proven. No inline IIFEs in JSX; no bare `$` before `{`
  in JSX text.
- Surface Honesty (WORKS/LABELED/HIDDEN; UNKNOWN never zeroed; nothing silently vanishes).
- Confidence everywhere: CONFIRMED (you set/made/paid) / DERIVED (a DB's claim) / ESTIMATED
  (typed) / UNKNOWN. Physical/receipt truth beats a DB on conflict.

## 10. Document index (FILED 2026-07-03 → `docs/residence-product/`)
- `DESIGN-FOR-THE-MESS.md` — philosophy (read after this brief)
- `DESIGN-AND-TRUST-STANDARD.md` — how every screen looks/feels: lean React+TS+plain CSS (no
  Tailwind), tokens-once, responsive-across-device-and-orientation (required), the "secure
  feeling," calm-minimum configurability
- `RESIDENCE-PRODUCT-BUILD-PLAN.md` — dependency-ordered phases
- `ACQUISITION-INTELLIGENCE-SPEC.md` — receipts→BI, delivery-vs-drive flagship
- `REPURCHASE-CHOICE-SPEC.md` — variant/size memory (honey, ketchup), SKU seam
- `INGREDIENT-FORM-AND-CONVERSION-SPEC.md` — cumin seed-vs-ground, Spoonacular routing
- `INVENTORY-INPUT-AND-HEALTH-CARD-SPEC.md` — input doors, health card, Open Food Facts/USDA
- `HOUSEHOLD-SHARING-DECISION.md` — multi-user model (note: multi-tenancy is now P0, not late)
- Prototypes: `prototypes/` (`KitchenLoop.jsx`, `DeliveryVsDrive.jsx`, `SmartComparison.jsx`) —
  REFERENCE artifacts only, not wired; see `prototypes/README.md`

> ✅ FILED 2026-07-03: this session's platform decisions are logged in the living ledger
> **`docs/DECISIONS.md`** (NOT the MASTER_BRIEF `MB_D-0XX` log, which is frozen at MB_D-015 —
> every decision since D-16 lives in DECISIONS.md): **D-27** (Residence Product placement +
> URL + TLD), **D-28** (API neutrality), **D-29** (offline / local-first capture). MASTER_BRIEF
> carries a pointer to them.
