<!-- DESIGN — NOT BUILT. Resolved architecture as of 2026-06-12. No code exists
     for items marked [DESIGN]. Audit wins on any conflict about what is built. -->

# Cost-to-Produce — Resolved Design

**Status:** DESIGN capture. Not a build session. No schema, no code, no migrations.
**Date resolved:** 2026-06-12
**Author:** David O'Brien + Claude Code (THUNDER design series)
**Audit authority:** `PLATFORM_AUDIT.md` wins on any conflict about what is currently built.
**Companion docs:** `PLATFORM_STATE.md` (LEVEL/LOCATION/EVIDENCE), `CLAUDE.md` Tech Debt Log

> ⚠️ **BUILD-GATING CONSTRAINT — `cost_profile` is MULTI-LOCATION.** `cost_profile` must be designed
> for **N locations of varying duration** (a base + a stream of operating locations, permanent AND
> transient) — NOT single-location and NOT two-fixed-base. Transient is the general case; permanent =
> "a transient location that doesn't end." Cheap now, painful to retrofit. Full rationale + the two
> proof cases (David roaming→dual-use Europe; John's unplanned estate-month counterexample) live in
> **`docs/strategy/MULTI-LOCATION-OPERATING-MODEL.md`**. Read it before designing the `cost_profile` schema.

---

## 0. STEP 0 GATE ECHO

**Session Starter checks confirmed before writing:**

1. **Last Handoff (CLAUDE.md Part 3):** 2026-06-11 — THUNDER doc-sync + date-drift sweep.
   Docs-only session. No code or schema changed. Receipt Keeper v1 WORKS propagated.
   MarginEngine B barrel swap completed. No unresolved open items block this design session.

2. **Shared modules this session touches / packages/shared/src/ check:**
   This is a design-capture doc session — NO code written. The design references
   `packages/shared/src/business-logic/MarginEngine.ts` (BUILT, ORPHANED — PLATFORM_STATE.md),
   and a future `packages/shared/src/costs/` path (DESIGN). No files edited.

3. **Off Limits / Part 7:** Not touching `packages/shared/src/quickbooks/oauth.ts`,
   `packages/shared/src/supabase/auth.ts`, old Supabase project `ufsgqckbxdtwviqjjtos`,
   any already-run migrations, or the main branch directly. This is a doc write only.

---

## 1. THE SPINE

*Held through every test case and scenario — never changes.*

> **Accumulate cost honestly by node → emit `cost: number` → divide by the unit the
> business actually sells → surface confidence → never rule on tax or legal.**

Everything in this document is in service of this sentence. If a proposed feature
violates any clause of the spine, it doesn't belong in Cost-to-Produce.

**STATE:** DESIGN (the principle is resolved; no implementation exists)

---

## 2. CORE BOUNDARY

*Load-bearing constant. Same rule applied four times: amortization, home-office %,
depreciation, loan-cost treatment. It is not a safety caveat — it IS the feature.*

> **Cost-to-Produce CAPTURES, SURFBOARDS, and models OWNER-DRIVEN scenarios.
> It NEVER takes a tax or legal position.**

Amortization schedule, depreciation method, deductibility percentage, allocation
basis — those belong to the accountant. TRACE shows the number and labels it clearly.
TRACE does not rule on it.

Same DNA as the mixed-trip principle: document every cost, capture the supporting data,
hand the complete package to the professional who decides. The boundary is explicit and
always surfaced to the owner, not hidden.

Each cost line carries: **when cash actually left** (confirmed-paid / committed-owed /
estimated). This is not an accounting assertion — it is an observation. The accountant's
treatment of that same event is theirs to determine.

**STATE:** DESIGN (no UI exists to surface the boundary statement; it must appear wherever
a cost-line is displayed that could be mistaken for a tax or legal ruling)

---

## 3. THE FORK

*Resolved. One direction only.*

```
ACCUMULATOR (upstream)          PERIOD POOL (downstream)
─────────────────────           ────────────────────────
Cost objects own event-sourced  Snapshot ÷ denominator
lifetime cost.                  (e.g., total_cost / units_sold_this_period)
                                (e.g., total_cost / customer-months)

Both emit:  cost: number        One-directional: accumulator feeds pool.
                                Pool NEVER writes back to accumulator.
                                No-double-count rule at the slice seam.
```

Maps to established accounting patterns:
- **Accumulator → job/process costing** (product businesses: nurseries, shops)
- **Period pool → absorption costing** (service/subscription: TRACE itself)

A single cost object can feed multiple period pools (shared cost allocation).
The seam between accumulator and pool is where the no-double-count rule lives —
enforced at query time, not at write time.
(See KNOWN OPEN SEAMS — this is an open risk flagged for test coverage, not a closed guarantee.)

**STATE:** DESIGN (no accumulator data model exists; no period pool query exists)

---

## 4. FOUR COST FEEDS

All feeds produce the same output contract: `cost: number` (plus metadata for
confidence, timing, and source attribution).

### 4.1 Receipt Keeper — direct/material cost, per-event

**STATE: WORKS**

Evidence: live test 2026-06-11 (McCoy's, bgobkjcopcxusjsetfob production).
- Provider: Gemini 2.5 Flash (confirmed, not fallback)
- Cost per call: ~$0.0001
- Flow: browser-image-compression → Vercel OCR function → editable line-item grid →
  computeReconcile() → confirm → write to `receipts` table
- Reconciliation: MATCH_TOLERANCE $0.02; conflict dialog; `reconcile_overridden_at` col
- Migrations applied: all 5 (20260611–20260614 bundle)
- Known limitation: HANDWRITTEN receipts not reliable (REQ-2, logged)
- Files: `src/pages/ReceiptKeeper.tsx`, `api/receipts/ocr.ts`

**Feeds accumulator as:** confirmed-paid direct cost, per receipt line item.
The `receipts.amount` field is the cost node value for material/direct-cost events.

Receipt → cost object link: not yet wired (Tech Debt #16 Cost-to-Produce tile is the
first caller; `plants.cost_price` column is the blocker — that column does not exist yet).

### 4.2 Recurring — subscriptions and monthly fixed costs

**STATE: DESIGN**

No code exists. Conceptual model:

- Table: (future) `recurring_costs` — `business_id`, `name`, `amount`, `frequency`,
  `starts_at`, `ends_at nullable`, `cost_node_id nullable`
- Feeds accumulator as: committed-owed (if unpaid) or confirmed-paid (after payment
  event lands as a receipt)
- Examples: SaaS subscriptions, monthly utility bills, lease payments
- Relationship to Receipt Keeper: a recurring cost entry generates an EXPECTED cost line;
  Receipt Keeper confirms the actual payment when the receipt arrives. The gap between
  expected and actual is variance (see Pillars §5.3).

### 4.3 Labor — hours × rate, continuous

**STATE: DESIGN**

No code exists. Conceptual model:

- Explicit labor: staff time logged against a cost node (hours × hourly_rate)
- **Imputed labor (family / owner time):** No wage appears on the books but real cost
  was incurred. Treatment: FMV proxy rate (e.g., $75/hr floor for skilled trades;
  junior-SWE FMV for software). Owner selects rate; TRACE does arithmetic. TRACE does
  NOT assert what the deductible rate is.
- Confidence grade: DERIVED (rate is owner-input; hours may be estimated)
- The labor feed is the cost node that absorbs the most estimation uncertainty.
  Surface confidence prominently here.

### 4.4 Asset Manager — capex + PM maintenance stream

**STATE: BUILT (Andrew's product) — promote-and-consolidate to shared [DESIGN]**

⚠️ **AUDIT CONFLICT — audit wins:** `PLATFORM_AUDIT.md` §12 states:
> "Abstract asset model: Shared → None → Action: EXTRACT"

Andrew has built an asset manager product. It is NOT in `packages/shared/src/`. The
abstract asset model does not exist in the monorepo yet. "BUILT" refers to Andrew's
standalone product; the shared version is DESIGN.

**What Andrew's product establishes (design input, not a build claim for this repo):**
- Asset registry (capex line per asset: purchase price, date, vendor)
- PM schedule stream (maintenance events → maintenance cost over asset lifetime)
- The cost shape: `{ asset_id, purchase_cost, maintenance_events[], total_lifetime_cost }`

**Promote-and-consolidate path (AC-1 — no vertical nouns):**
- Target: `packages/shared/src/costs/AssetNode.ts`
- AC-1: `asset_type` is a DATA value (vehicle | plant | equipment | tool | property),
  never a table name or identifier. One `cost_objects` table with `node_type` discriminator.
- No vertical nouns in schema or code. Andrew's vertical-specific field names
  (e.g., VIN, make/model) are vertical config, not shared schema.
- The promote step is a design session + build session after Andrew's shape is finalized.

**PLATFORM_AUDIT §12 open findings relevant to this feed:**
- "Cost tracking per asset: Cultivar ❌ (Plant cost not tracked post-purchase)" — confirmed gap.
  `plants.cost_price` column does not exist. This is the first Cultivar caller for
  MarginEngine AND the first Receipt → Asset link.
- "Abstract asset model: None shared → EXTRACT" — the extract is this design's scope.

---

## 5. COST-OBJECT NODE MODEL

*The tree (mostly a tree; shared costs make it a DAG).*

**STATE: DESIGN**

### 5.1 Node types — one table, type discriminator

```
cost_objects table
  id            uuid PK
  business_id   uuid FK → businesses (AC-2: RLS scoped here)
  node_type     text CHECK ('ASSET' | 'PROJECT' | 'PRODUCT')
  name          text
  parent_id     uuid nullable FK → cost_objects (containment edges)
  created_at    timestamptz
  ...
```

AC-1: variation lives in data (`node_type`), not schema. No `asset_objects`,
`project_objects`, `product_objects` tables. One table.

Node types:
- **ASSET** — a discrete purchased thing (equipment, vehicle, tool, property).
  Carries: `purchase_cost`, `purchase_date`, `vendor_id nullable`.
- **PROJECT** — an initiative that accumulates costs from multiple assets and receipts
  until it converts to a product or is closed.
  Carries: `budget_estimate nullable`, `status` (open/closed/converted).
- **PRODUCT** — the thing the business sells. Accumulates all upstream costs; becomes
  the denominator input for cost-per-unit.
  Carries: `unit_type` (item | customer-month | billable-hour), `selling_price nullable`.

### 5.2 Attribution edges

Two edge types:

**Containment:** A ⊂ B. Flower bed ASSET → office PROJECT → house PRODUCT.
The child's cost rolls up into the parent. Strict tree at the containment level.

**Contribution:** A contributes to B without being contained. Greenhouse ASSET → plant
PRODUCT (the greenhouse contributes overhead to every plant product).
One asset → many products (shared cost). One product ← many assets.

The combination of containment and contribution creates a DAG (not a pure tree) wherever
shared costs exist. The no-double-count rule at the period pool seam prevents the same
cost from appearing twice in a single product's rollup.
(See KNOWN OPEN SEAMS — this is an open risk flagged for test coverage, not a closed guarantee.)

### 5.3 PROJECT → PRODUCT conversion lifecycle

CoolRunnings is the worked case:
1. Garden wall PROJECT accumulates receipts (pavers, mortar, labor hours).
2. Project closes. Accumulated project cost ($2,660 actual) becomes the product's
   cost-to-recover basis.
3. Product (outdoor-living space) now has a loaded cost and a denominator (e.g., sq ft
   of usable space added, or % of home value added).
4. The cost basis does not change after conversion. New costs after conversion
   (maintenance events) attach to the ASSET nodes under the product, not to the
   closed project.

### 5.4 COUNT-ONCE rule

Three things that look like cost but must not all be counted:

| Thing | What it is | When to count |
|---|---|---|
| Receipt | Evidence that cash left | Count ONCE as a direct cost line |
| Asset | The cost object that receipt proves | Link receipt as proof; don't add receipt amount again |
| Project | Sums assets (each asset links its receipt) | Project total = sum of asset costs, not sum of receipts |

Not every receipt is an asset (consumables are not). Example: lumber delivery receipt
→ direct cost of project, not an asset. Tool purchase receipt → asset (amortizable),
AND the purchase cost node, NOT counted again via the receipt amount.

Not every asset has a receipt. HP ProDesk = UNKNOWN. Asset exists; cost is UNKNOWN.
Surface as UNKNOWN, not zero. Never silently zero an unknown cost.

### 5.5 Shared-cost allocation

Owner assigns basis. TRACE does arithmetic. TRACE labels it a model, never rules.

Example: $3,000 office build = project cost on the node.
Owner declares: "336 sq ft of office ÷ 1,800 sq ft total house = 18.67% business use."
TRACE computes: $3,000 × 18.67% = $560.10 allocated to business product nodes.
TRACE surfaces: "18.67% allocation basis (owner-set). Accountant determines deductibility."

These are two different numbers: the project cost and the allocation. Both are shown.
The allocation is labeled MODEL, not FACT.

**STATE: DESIGN** — no allocation UI, no basis-assignment table, no rollup query.

### 5.6 Lot horizon and season-end events

**STATE: DESIGN**

**HORIZON LIVES ON THE COST OBJECT (lot), NOT `business_type`.** One nursery (LAWNS) holds
all horizons at once: oaks = long-accumulator (ride the ladder for years); herbs/veg =
single-season (sell out or die this year); vines/shrubs = CARRY-OR-CULL (sell if they go,
carry to next year if they don't). `business_type` does NOT select the costing engine — the
LOT's horizon does. A single business runs accumulator-path and period-path lots simultaneously.

**SEASON-END EVENT on each lot** (extends the graduate / split / die / sell lifecycle):
- **sell** — realize cost vs revenue; close the lot's accumulator.
- **cull / die** — shrinkage loss; write off accrued cost as a loss event.
- **CARRY** — roll accrued cost forward as next season's OPENING BASIS. The carried lot
  raises a writedown question (is a year-old, harder-to-sell plant worth full accrued cost?).
  That is the accountant's call — we surface "this lot carried $X accrued into this season"
  and hand the package over. (See KNOWN OPEN SEAMS — carried-lot valuation.)

---

## 6. PILLARS

*Intelligence layered on captured cost. All [DESIGN] unless noted.*

### 6.1 CASH-TODAY (a VIEW, not a field)

**STATE: DESIGN**

Cash-today is a LENS over the lower system — not a standalone field, not a co-equal
alternative to the accountant's view. It shows cash-out-today + today's margin
(owner-survival view). We flag that the accountant amortizes differently. We NEVER
compute the accrual schedule or take a position on it — that belongs to the accountant.

The boundary IS the feature. The accrual schedule hides the cash crunch that kills small
operators. An owner seeing amortized cost spread over ten years on the books misses the
month they actually wrote the check. We surface the moment cash left.

Each cost line carries `cash_timing`:
- `confirmed_paid` — cash left. Date confirmed.
- `committed_owed` — obligation incurred; cash not yet out.
- `estimated` — projected; no commitment yet.

The projected-vs-actual dimension of cash timing (the owner's projected cash curve vs
actuals) is part of the variance loop — see §6.3.

### 6.2 COST-OF-CAPITAL

**STATE: DESIGN**

Funding source per cost node:
- `card_paid` — cash equivalent (unless card is rolled)
- `card_rolled` — interest accruing; card APR as the rate
- `loan` — rate%, lender, term; interest as a cash-today line
- `savings_opportunity_cost` — owner's opportunity cost (their stated rate; TRACE never
  suggests a rate)

House-rehab worked case: 3 loans, 3 rates. Each loan generates its own interest
cost-today stream. The total cost-of-capital for the project = sum of interest lines
over the period.

Interest appears as its own cost line, labeled "cost of capital — [source]".
Not blended into the asset cost. The accountant decides deductibility.

### 6.3 ESTIMATE → ACTUAL VARIANCE

**STATE: DESIGN**

Capture: guesstimate at project open + actuals as receipts and confirmations land.
Surface: delta (garden wall: est $2,400 → actual ~$2,660 = +$260 / +11%).

Over time, learns the owner's OWN estimation bias per cost category:
- "You typically underestimate materials by 11%."
- "Your labor estimates are accurate to ±5%."

Auto-corrects future estimates using the owner's historical pattern.
This is the intelligence — personalized to the individual owner's behavior.

The variance signal is the most durable moat: no generic benchmark matches an
owner's specific pattern. Every receipt makes the model more accurate for that owner.

**The SAME variance loop applies to cash TIMING.** Capture the owner's projected cash
curve (cash out in off-season, back at sell-through); capture actuals as they land;
surface the delta; over time learn the owner's projection bias and auto-correct future
projections. We DISPLAY the projection the owner enters and can help STRUCTURE it if
asked — we NEVER generate the forecast as our position. Owner-driven data display,
not financial advice.

Note: the revenue side of the projected cash flow (when sell-through cash returns) is
not yet modeled here — cost timing only. (See KNOWN OPEN SEAMS — revenue-timing layer.)

### 6.4 CONFIDENCE-MIX ROLLUPS

**STATE: DESIGN**

Four confidence grades per cost line:

| Grade | Meaning | Display |
|---|---|---|
| `confirmed` | Receipt in hand, amount verified | Green, no flag |
| `derived` | Computed from confirmed inputs (e.g., interest calc from confirmed loan) | Blue, "derived" label |
| `estimated` | Owner-input guess or AI estimate | Yellow, "estimated" label |
| `unknown` | Cost node exists; amount not known | Red, "unknown — not $0" |

Rollup rule: show as a range with confidence, NOT a false-precise single number.

CoolRunnings example:
> "$720 confirmed + ~$500–1,000 estimated. Total: $1,220–$1,720 (confidence: mixed)"

Not: "$1,220" (hides uncertainty), not "$1,720" (overstates worst case without labeling it).

**Switching-cost invariant:** switching cost stays estimate-grade FOREVER. It is
fundamentally unquantifiable (opportunity cost, learning curve, relationship transfer).
Do not fake precision. The grade is an honest disclosure, not a placeholder to fill.

### 6.5 PAYBACK / BREAK-EVEN CLOCK

**STATE: DESIGN**

Formula: accumulated_cost ÷ unit_margin_per_period = periods_to_recover.

Two leak cases that must surface explicitly:
1. **Free & Family (F&F) period:** Every day of zero/below-cost delivery is the clock
   ticking backward. Surface as: "Hole: -$X (F&F days × daily_cost)." Connor's app case.
2. **F&F discount:** Permanent or ongoing below-market pricing leaks via MarginEngine
   `actualPrice`. Surface as: "Leakage: $Y/unit (market_price - actual_price). Break-even
   extends by Z periods."

Both are already in the system conceptually (MarginEngine has `actualPrice` and leakage
detection). Cost-to-Produce makes the payback clock the primary output surface.

---

## 7. DENOMINATOR

*Per `business_type` config — not hardcoded.*

**STATE: DESIGN**

| business_type | Default denominator | Unit |
|---|---|---|
| cultivar-os | Plants sold per period | `item` |
| ignition-os | Billable hours per period | `billable-hour` |
| kinna-os | Families served per period | `service-event` (TBD) |
| TRACE (self) | Active customer-months | `customer-month` |

TRACE self-pricing (CUSTOMER-ZERO):
- No Stripe exists. No `SubscriptionTier` is active. The denominator is a PLANNING input.
- Output: sensitivity CURVE (floor scenarios at N=1, 5, 20, 100 customers), not a single number.
- The curve shows: "At N customers, your cost-per-customer-month = $X. Viable at N≥Y."
- This is the recursive case: TRACE uses Tier 2 to price TRACE per-vertical.

`denominator_config` lives in vertical config (`packages/shared/src/config/VerticalConfig.ts`
— DESIGN, per CLAUDE.md Active Tasks §Vertical Setup). Not hardcoded in any component.

---

## 8. AI COST METERING

*Always-on infrastructure. Not a feature flag.*

### 8.1 `ai_usage_log` table (shared, all verticals)

**STATE: DESIGN (metering benched — see note on existing ai_usage below)**

Schema:
```sql
ai_usage_log (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid NOT NULL REFERENCES businesses(id),
  user_id         uuid REFERENCES auth.users(id),
  provider        text NOT NULL,      -- 'anthropic' | 'google' | 'openai'
  model           text NOT NULL,      -- actual model string from response
  task            text NOT NULL,      -- 'ocr_receipt' | 'dtc_decode' | etc.
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10,6),      -- DERIVED from token counts + model rates
  receipt_id      uuid REFERENCES receipts(id),  -- NULLABLE: abandoned scans = NULL
  called_at       timestamptz DEFAULT now()
)
```

AC-1: `business_id` (not `nursery_id`, `shop_id`). One table across all verticals.

**Adoption of orphaned types:**
- Ignition `ai_usage` table in `ufsgqckbxdtwviqjjtos` (no committed migration — CLAUDE.md
  TD#27) has a similar shape. Before this table is built for shared, run the STD-008
  inverse sweep on that DB and recover the column shape. Strip `shop_id` → `business_id`.
- AIUsageLog type referenced in AIEngine.ts — adopt as the canonical type.

**Why `receipt_id` is nullable and why that matters:**
- Cost incurred at the moment of the AI call, not at the moment of receipt save.
- Abandoned scan = AI call happened, no receipt row written. `receipt_id = NULL`.
- This is the abandonment-leak catcher: count of NULL receipt_id rows reveals
  how many paid calls yielded no saved data.
- Also the abuse guard: a `business_id` generating 500 NULL-receipt calls/hour is a signal.

### 8.2 `ocr_raw` table (Cultivar, existing)

**STATE: WORKS** (Receipt Keeper v1, confirmed 2026-06-11)

`ocr_raw` captures ACTUAL model per call (`provider` + `model` columns in `receipts` table —
`ocr_primary_model` and `ocr_fallback_model` columns from `platform_config`).
Tokens: CONFIRMED from API response. Cost: DERIVED (tokens × per-model rate).

Gemini 2.5 Flash primary. Claude Haiku 4.5 fallback. 503 if both fail.
Model routing reads from `platform_config` DB table (WORKS — confirmed via `getOcrModels()`
in live test returning `provider=gemini`).

### 8.3 Tier 2: AI cost visibility + model routing intelligence

**STATE: DESIGN**

- Cost visibility: surface `cost_usd` total per period per task, per business. Owner sees
  what AI actually costs them per month. Not hidden.
- Routing intelligence: make the model choice a quiet, costed, automatic decision.
  Surface as a cost line in Cost-to-Produce, not as a UI toggle.
- The model routing logic (Gemini → Haiku → 503) is already implemented for OCR.
  Tier 2 makes it visible and generalizes it across all AI tasks.

---

## 9. MARGINENGINE — DOWNSTREAM CONSUMER

**STATE: BUILT (canonical engine), ORPHANED for Cultivar (zero callers)**

Files:
- Canonical: `packages/shared/src/business-logic/MarginEngine.ts` (BUILT 2026-06-10,
  THUNDER Build 1)
- Dead stub deleted: `packages/shared/src/pricing/marginEngine.ts` (deleted 2026-06-11,
  B barrel swap)
- `packages/shared/src/index.ts` barrel now exports canonical engine.

⚠️ **PLATFORM_AUDIT staleness note:** PLATFORM_AUDIT.md §3 line 51 says:
> "Shared marginEngine.ts is the margin engine — ~17-line stub. No tiers, no overhead..."

This finding was from Audit 4, 2026-06-06. The canonical engine was built AFTER that audit
(2026-06-10). PLATFORM_AUDIT is the authority on what was built at audit time. The
current state is: BUILT (canonical, post-audit). PLATFORM_STATE.md is the current-state
authority (row: "Business-Logic · MarginEngine.ts | ORPHANED").

**Interface (what Cost-to-Produce feeds into):**

```typescript
MarginEngine.analyze({
  cost: number,            // REQUIRED — from accumulator
  actualPrice?: number,    // for F&F/leakage detection
  tierName?: string,       // customer tier
  config: {
    slabs: PriceSlab[],    // 4-slab pricing
    pricingTiers: Tier[],  // tier discounts
    overheadPerUnit: number // absorption hook ← Cost-to-Produce feeds here
  }
})
```

**`overheadPerUnit` absorption hook:** this is where Cost-to-Produce plugs into MarginEngine.
The period pool (total overhead ÷ units-in-period) emits a `cost: number` that becomes
`overheadPerUnit`. MarginEngine absorbs it per-unit. The wiring path: IgnitionProt →
DataBridge `margin_config.overheadPerUnit` (documented in Tech Debt #16).

**First Cultivar caller blocker:** `plants.cost_price` column does not exist. This column
is required to provide the `cost` input to MarginEngine for Cultivar. Adding it is a
schema migration (one column additive change). That migration is the unlock for the
Cost-to-Produce tile in Cultivar.

---

## 10. TWO-TIER BUSINESS MODEL

*Every feature decision maps to one of these tiers.*

### Tier 1 / CORE — "Captured Cost"

**Question answered:** "What did I spend?"

**STATE: WORKS (Receipt Keeper v1)**

Capabilities at Tier 1:
- Capture receipt → OCR → review → accept → write to `receipts` table
- Push to QuickBooks (receipt attach / expense record)
- Asset registry (list of assets with purchase cost)
- Basic cost-per-receipt view

**Why it's table-stakes:** Capture is a saturated market. QuickBooks native, Dext,
Expensify, Ramp, BILL all do this. TRACE's Core capture must be cheap, reliable, and
fast — not differentiated. The differentiation is Tier 2.

### Tier 2 / PRO — "Cost-to-Produce"

**Question answered:** "What does it cost me to MAKE this, loaded, today?"

**STATE: DESIGN (entire intelligence layer)**

Capabilities at Tier 2 (all from §5–§8 above):
- Cost-object node model (accumulator + period pool)
- Four feeds wired (recurring + labor + asset manager + receipt confirmation)
- All five pillars: cash-today, cost-of-capital, variance, confidence-mix, break-even clock
- Denominator per business_type, sensitivity curve
- AI cost visibility + routing intelligence
- MarginEngine fed with loaded cost

**FRACTAL RULE:** Capture is cheap; intelligence is premium — runs INSIDE each feature.
- Asset registry = Core (captures what exists, what it cost)
- Asset cost-intelligence (break-even, maintenance stream, loaded cost-per-unit) = Pro
- Receipt capture = Core
- Receipt → variance → estimation-bias learning = Pro

### Trial model

2 weeks: all-on (owner experiences full Tier 2).
Trial ends: Core stays. Pro becomes the "power layer you tried."

Frame as what they KEEP, never what we TAKE. The capture capability — the necessity —
is never paywalled. The intelligence layer is the optional upside.

### Recursion

TRACE uses Tier 2 to price TRACE per-vertical (CUSTOMER-ZERO case, §7).
The platform that sells Cost-to-Produce must eat its own cooking.

### Anti-exploitation stance

Charge for value delivered (real AI/engine/maintenance cost, not arbitrary markup).
Give away the necessity (capture). The exploiter paywalls capture. We make the
necessity cheap and the upside optional.

---

## 11. SURFACE CONSTRAINT

*Where Cost-to-Produce lives.*

**STATE: DESIGN**

**Cost-to-Produce gets its OWN surface. Do NOT bolt onto `Dashboard.tsx`.**

From the code health audit (`docs/audits/CODE_DOC_HEALTH_AUDIT-2026-06-11.md`):
- `Dashboard.tsx`: 936 lines, 27 commits in 90 days, 5 colliding concerns
- Named as the highest collision risk in the audit

Adding a sixth concern (Cost-to-Produce rollup tiles) to Dashboard.tsx would:
1. Push the file past 1,000 lines
2. Create merge conflicts every session that touches any other dashboard feature
3. Violate the single-concern principle already under pressure there

**Target route:** `/costs` (owned by Cost-to-Produce module).
**Target file:** `packages/cultivar-os/src/pages/CostsToDashboard.tsx` or similar
— name to be decided at build time per STD-010 (no opaque names).

Tile summary (quick read at a glance) may surface ONE read-only tile on Dashboard.tsx:
"Loaded cost this period: $X" — no interaction, no data write, one metric. The detail
lives at `/costs`.

---

## 12. AUDIT CONFLICT LOG

*All conflicts between this design and PLATFORM_AUDIT.md are logged here. Audit wins.*

| # | This doc claims | PLATFORM_AUDIT says | Resolution |
|---|---|---|---|
| 1 | Asset Manager: BUILT (Andrew's) | §12: "Abstract asset model: Shared → None → Action: EXTRACT" | Audit wins. Andrew's product is not in this repo. Shared version is DESIGN. "BUILT" in this doc refers to Andrew's standalone product only — clearly labeled. |
| 2 | MarginEngine: BUILT (canonical) | §3: "~17-line stub. No tiers, no overhead." | Audit is STALE on this point (audit date: 2026-06-06; canonical engine built: 2026-06-10). PLATFORM_STATE.md is current-state authority. Current state: BUILT, ORPHANED. No conflict — the audit was correct at audit time. |
| 3 | ai_usage_log: DESIGN (shared) | No shared ai_usage_log in audit | No conflict. ai_usage exists in ufsgqckbxdtwviqjjtos (Ignition DB only, no committed migration — CLAUDE.md TD#27). Shared version is net-new DESIGN. |
| 4 | `plants.cost_price` column: does not exist | §12: "Cost tracking per asset: Cultivar ❌" | Confirmed consistent. Audit and this doc agree: the column is missing. |

---

## 13. WHAT DOES NOT EXIST (honest inventory)

Items listed in this design that have zero code, schema, or migration:

- Cost-object node model (`cost_objects` table, attribution edges)
- Recurring costs feed (`recurring_costs` table)
- Labor feed (explicit + imputed)
- Shared asset manager in `packages/shared/src/costs/`
- Confidence-mix rollup logic
- Cash-timing labels on any cost line
- Cost-of-capital tracking (funding source per node)
- Estimate → actual variance capture and bias learning
- Payback / break-even clock
- Denominator config in VerticalConfig.ts
- Sensitivity curve generator
- `ai_usage_log` shared table
- `/costs` route and page
- `plants.cost_price` schema column
- MarginEngine `overheadPerUnit` wire (IgnitionProt → DataBridge → shared engine)
- Trial gating for Tier 2 features

The only built things in this design's scope:
- Receipt Keeper v1 (WORKS — receipts table, OCR, reconciliation)
- MarginEngine.ts canonical (BUILT, ORPHANED — zero callers in Cultivar)
- Andrew's asset manager (BUILT, separate repo — not in this codebase)

---

## 14. KNOWN OPEN SEAMS

*Unresolved risks. Not solved rules. Do not soften "open" to "handled".*

### SLICE SEAM (OPEN — highest-risk edge, flag for test coverage)

The accumulator → pool slice is the one place double-count can creep. Specifically: an
asset's PM (maintenance) cost stream entering the period pool while the same asset's
capex is also counted in the accumulator rollup. The no-double-count rule is stated in §3
and §5.2 — but the rule is a design intent, not an implementation guarantee. Until there
is test coverage at the slice seam, this risk is OPEN. Flag for test coverage in the
build plan. Highest-risk edge in the entire system.

**Status: OPEN**

### CARRIED-LOT VALUATION (OPEN)

The CARRY season-end event (§5.6) rolls a lot's accrued cost forward as next season's
opening basis. This immediately raises a writedown question: is a year-old, harder-to-sell
lot worth its full accrued cost? The answer is the ACCOUNTANT's call, not ours. TRACE
surfaces "this lot carried $X accrued into this season" and hands the package over — we
never rule on whether to write it down, at what rate, or by what method. The valuation
question is architecturally deferred to the professional.

**Status: OPEN**

### REVENUE-TIMING LAYER (OPEN — future)

The projected-vs-actual variance loop in §6.3 currently models COST timing only — when
cash left, when it was committed, when it was estimated. The revenue side of the cash
curve (when sell-through cash actually returns; when a customer pays) is NOT yet modeled
in this design. A full cash-flow picture requires both sides. The revenue-timing layer is
explicitly out of scope for this design capture and is flagged here so it is not silently
assumed to be included.

**Status: OPEN**

### RECEIPT ROUTING SEAM (OPEN)

A receipt can populate `business_inventory` (stock on hand — the dollars become asset
basis) OR flow to QB/accounting as an operating expense — the SAME dollars, two possible
treatments. Double-count risk is real: the accumulator could see the receipt amount once
as inventory cost and again as an accounting expense, inflating the period pool.

The dedup link is `business_inventory.receipt_id` (and the parallel `business_service_log.receipt_id`
added in the 2026-06-12 migrations). **PRESENT receipt_id = the receipt is the cost source
for that row; the accumulator must not also count the QB expense for the same receipt.**

What TRACE does: capture, link, surface the receipt_id relationship. What TRACE never
does: rule on whether the item should be capitalized as stock vs. expensed now. That is
the accountant's call — the inventory-vs-expense tax treatment is outside TRACE's boundary
(see §1: "never take a tax or legal position"). The receipt_id is the join that makes the
accountant's job possible; the dedup logic itself is an open implementation seam until
the accumulator is built and the count-once rule is enforced in code, not just intent.

**Status: OPEN — receipt_id seam exists in schema (2026-06-12); accumulator enforcement
not yet built. Flag for test coverage at the accumulator → pool slice (same risk class as
SLICE SEAM above).**

---

## 15. BUILD SEQUENCING (recommended order, not committed)

*Not a sprint plan. A logical dependency order when building begins.*

1. `plants.cost_price` column migration → unblocks first Cultivar MarginEngine caller
2. MarginEngine A callers (Ignition import-path swaps — no behavior change)
3. Cost-object node model (`cost_objects` table + shared types)
4. Receipt → cost_object link (attach existing Receipt Keeper receipts to nodes)
5. Recurring costs feed (table + entry UI)
6. `/costs` route + page (surface constraint, own surface)
7. Confidence-mix rollup (query + display range)
8. Break-even clock (denominator config + sensitivity curve)
9. Labor feed
10. Asset manager promote-and-consolidate (after Andrew's shape is finalized)
11. Cost-of-capital tracking
12. Estimate → actual variance + bias learning
13. `ai_usage_log` shared table + wiring
14. Tier 2 trial gating

Steps 1–4 are the unlock for Cost-to-Produce v1 (minimum viable loaded cost).
Steps 5–8 add the core pillars. Steps 9–14 complete the full design.

---

## 16. ACTIVATABLE INSIGHT TILES (BENCHED — Kind-2: design + bench, build when triggered)

**STATE: DESIGN + BENCH-SIZED (2026-06-14). Not on the build path. David triggers each tile
individually.** These are NOT the core Cost-to-Produce engine (§5–§9). They are *insight tiles*
that ride on top of it, deepening cost/margin visibility. Captured here so the design doesn't
evaporate; sized against existing plumbing in the bench look below.

### 16.0 The day-1-sharp / day-14-fuzzy behavior (one coherent system)

Both tiles are **ACTIVE DAY 1** — full real insight during the 2-week trial, computed from the
customer's own data. At **DAY 14, IF NO SIGNUP**, they go **FUZZY**: the **aggregate dollar value
stays SHARP** (it's real — computed from their own two weeks of captured receipts/inventory/sales),
the **line-item DETAIL blurs**. Framed as **KEEP, not TAKE**: "you had this; here's what it was
worth; sign up to see it clearly again."

This is not a new mechanic — it is the concrete application of three already-decided things, which
together form **one system**:
- **BD-2 · Trial mechanic** (the policy: 2 weeks all-on, Core stays, framed as KEEP) —
  [DECISIONS.md](../DECISIONS.md) BD-2 · also §10 *Trial model* above.
- **BD-3 · Fuzz mechanic** (the how: deactivated tiles still display, fuzzed, with a real aggregate
  dollar estimate) — [DECISIONS.md](../DECISIONS.md) BD-3. These tiles are *what fuzzes* at day 14.
  The blur uses the existing `LockedOverlay.tsx` + data-blur components in `packages/shared`.
- **BD-4 · Anti-exploitation** (capture is never paywalled; the *intelligence* is the optional
  upside) — [DECISIONS.md](../DECISIONS.md) BD-4 · §10 above.

Do not re-litigate the mechanic here; this section only states *which tiles* it applies to.

### 16.1 TILE A — Cost-Intake Reconciliation (item ↔ receipt)

**Class:** GENERAL capability (shared substrate, AC-1 clean — operates on `receipts` +
`business_inventory`, no vertical noun), surfaced as an **activatable Pro tile** (the fuzz tile of
§16.0). See [TILE-CLASSIFICATION.md](../architecture/TILE-CLASSIFICATION.md) — Cost-to-Produce family.

**What it surfaces (activation value):** every inventory item resolved to a *confirmed* cost with
receipt provenance — turning "I think this cost ~$X" into "this cost $X, here's the receipt."

**Two independent capture paths into one inventory item, arriving in EITHER order:**
- (A) photograph the THING (asset/inventory capture) → item exists, **cost UNKNOWN**.
- (B) photograph the RECEIPT (Receipt Keeper) → a **cost looking for an item**.

**Four item states:** (1) item / no-cost = **UNKNOWN**; (2) cost / no-item = **orphan receipt line**;
(3) item + confirmed cost = **CONFIRMED** (with `receipt_id` provenance); (4) item + typed cost =
**ESTIMATED**. (Mirrors the `cost_confidence` enum already on `business_inventory` /
`business_assets`.)

**Reconciliation = HUMAN-CONFIRMED SUGGESTION, not auto-join.** Item-by-item: "this item has no
cost; I found this receipt line that might be it — is this the correct cost?" UNKNOWN is **never
silently zeroed**.

**ANTI-DOUBLE-COUNT:** when a receipt line is confirmed as an item's cost, it is **CLAIMED** (marked
consumed via `receipt_id`) so the same dollar can't also count as a loose expense. One dollar, one
home. This is the same count-once concern as the **RECEIPT ROUTING SEAM** (§14) — that seam's
`receipt_id` join is exactly the link this tile populates.

**Day-1 sharp / day-14 fuzz:** sharp = "$X of inventory cost confirmed, $Y still UNKNOWN, $Z orphan
receipt dollars" (aggregate). Fuzz = the item-by-item match list blurs; the aggregate stays.

**Dependencies:** `receipts.line_items` (FOUND), `business_inventory.receipt_id` +
`cost_confidence` (FOUND), an inventory-write path from the photo-the-thing capture (PARTIAL — see
bench), and the **match/claim engine** (NET-NEW). See bench §16.3.

### 16.2 TILE B — Three-Way Margin Check (receipt ↔ inventory ↔ invoice)

**Class:** GENERAL concept (shared), but its third corner — the **sale/invoice** record — is
**vertical-shaped today** (`order_items` is Cultivar-local), so TILE B needs a vertical-agnostic
sale/invoice abstraction to be cross-vertical. Until then it is general-in-concept,
Cultivar-first-in-impl. See [TILE-CLASSIFICATION.md](../architecture/TILE-CLASSIFICATION.md).

**The reconciliation triangle:** receipt = what you **PAID**, inventory = what you **HAVE**,
invoice/sale = what you **SOLD it for**. Every sale should trace back through inventory to a receipt.

**The accountability questions it surfaces (these ARE the insight — knowledge-management framing,
each break in the chain is a FINDING, not an error to suppress):**
- Sold item X — when, and what did you buy it for? **Did it MEET MARGIN?** (suggested vs actual)
- Sold but **NOT in inventory** → "how did you sell something you weren't tracking?"
- Sold but **NO cost captured** → "you made money on this but can't tell how much."
- Cost but **no sale** → dead stock.

**"Did it meet margin" is the LEAKAGE calc** — the gap between the suggested (margin-correct) price
and what was actually charged. This triangle is the **DATA MODEL leakage reads from**; the margin
math and the actor/per-sale-override capture live in
[MARGIN-LEAKAGE-RESEARCH-LOG.md](MARGIN-LEAKAGE-RESEARCH-LOG.md) — do NOT duplicate that thinking
here. (Note: the actor / per-sale override capture from that log is still its own net-new build,
sequenced separately — it is not part of this tile.)

**Day-1 sharp / day-14 fuzz:** sharp = "$X total margin captured this period, $Y margin leaked, N
sales with no cost basis" (aggregate). Fuzz = the per-sale margin/leakage line list blurs; the
aggregate stays.

**Dependencies:** TILE A's confirmed costs (so a sale has a cost to compare against), a sale↔cost
join (PARTIAL — `order_items.plant_id` → `business_inventory.unit_cost` exists but cost and
sold-price are conflated today), and MarginEngine wired as a live caller (BUILT but ORPHANED, §9).
See bench §16.3.

### 16.3 BENCH LOOK — sizing each tile against existing plumbing (read-only, file:line-backed)

| # | Corner the tiles need | Verdict | Evidence |
|---|---|---|---|
| 1 | **Receipt LINE extraction w/ prices** (the HINGE for TILE A) | **FOUND** | OCR prompt extracts `line_items: [{description, quantity, unit_price, amount}]` — `packages/cultivar-os/api/receipts/ocr.ts:63`. Stored to `receipts.line_items` jsonb — `ReceiptKeeper.tsx:290`, migration `supabase/migrations/20260613_receipts_add_line_items.sql:12`. A priced receipt line exists to match an item against. |
| 2 | **`receipt_id` provenance link on inventory** | **FOUND (schema) / NOT WIRED (write)** | Column + FK + `cost_confidence` enum: `supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql:55-59`. But it is never populated — `BusinessInventory.tsx:50,155` explicitly leaves `receipt_id` absent ("linked by receipt flow later"). The slot exists; nothing fills it. |
| 3 | **Invoice/sale → inventory + cost comparison** (TILE B's 3rd corner) | **PARTIAL** | `order_items` carries `plant_id, quantity, unit_price` — `packages/cultivar-os/api/orders/submit.ts:165-169`. Join path order_items → `plant_id` → `cultivar_plants` → `business_inventory.unit_cost` exists. BUT `unit_price` is *set to* `unit_cost` (submit.ts:169, :121) — cost and sold-price are **conflated** (no margin, because price==cost). No sold-vs-cost comparison is computed or stored today; MarginEngine is BUILT-ORPHANED (§9). |
| 4 | **Asset/photo capture → `business_inventory`** | **NOT FOUND (net-new)** | `BusinessAssets.tsx` writes only to `business_assets` via a manual form (`:131,:179`); no photo/AI-vision pipeline — `CONFIRMED requires a receipt link (future flow)` and `DERIVED = AI-only` are label comments only (`:11`). `BusinessInventory.tsx` is a manual form with no image input. Routing a photo → AI appraisal → `business_inventory` is net-new. |
| — | **Existing reconcile = item-match?** | **NO** | `computeReconcile()` in `packages/cultivar-os/src/utils/receiptReconciliation.ts:25` is LINE-vs-TOTAL *within one receipt* (sum of lines vs header amount). It is NOT cross-object item↔receipt-line matching. TILE A's matcher is net-new. |

### 16.4 BOTTOM LINE — per-tile sizing

- **TILE A — Cost-Intake Reconciliation: WIRING on data, BUILD on the engine.** Both data inputs are
  FOUND (priced receipt lines #1, the `receipt_id` slot #2). The **single biggest net-new piece is
  the match/claim engine**: the item↔receipt-line suggestion (item-by-item, human-confirmed) plus the
  "claimed" state on a receipt line that prevents double-count. The photo→inventory write path (#4)
  is a secondary net-new dependency. Net: a focused engine build on top of mostly-present plumbing.
- **TILE B — Three-Way Margin Check: mostly BUILD.** The join plumbing only PARTIALLY exists (#3) and
  is corrupted by the cost/price conflation; MarginEngine is orphaned (§9). The **single biggest
  net-new piece is the cost↔sale comparison wired through a (currently vertical) sale record** —
  which requires un-conflating cost from sold-price first, then a vertical-agnostic sale/invoice
  abstraction to make the tile cross-vertical. TILE B depends on TILE A landing first (a sale needs a
  confirmed cost to compare against).

---

*TRACE Enterprises · Built with CAI*
*This document is a design capture. It is not a build record.*
*Source of truth for what is built: `PLATFORM_STATE.md` + `PLATFORM_AUDIT.md`.*
*Update this doc when design decisions change. Mark resolved sections with date + evidence.*
