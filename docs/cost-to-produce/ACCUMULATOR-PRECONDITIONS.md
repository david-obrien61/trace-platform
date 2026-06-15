# Accumulator Core — Verify-Before-Build (RECON artifact)

**Created:** 2026-06-15 · **Type:** READ-ONLY recon. No schema, no migration, no code, no build.
**Scope:** size the accumulator CORE = `cost_objects` (ASSET|PROJECT|PRODUCT nodes) + receipt/asset → project
ROLLUP + the accumulator→pool SLICE SEAM (count-once). Tax-into-item, invoice validation, carve-out are
LATER layers — seams named, not built.
**Spine:** [COST-TO-PRODUCE-DESIGN.md](COST-TO-PRODUCE-DESIGN.md) §5 (node model), §6.1 (cash-today),
§14 (open seams), §16.3 (bench look).

**Bottom line (read first):** the ASSET-node half is ~80% already built in *this* repo (not Andrew's
separate one). What's genuinely net-new is the **PROJECT/PRODUCT node storage + attribution edges + the
cross-object rollup + the count-once enforcement at the pool seam**. The core is **too big for one build —
split into Core-1 (node+edge foundation) and Core-2 (rollup+tile-feed+count-once)**. Both schema questions
resolved below; a *third* schema question surfaced (does `cost_objects` subsume `business_assets`?) and is
flagged — the build must answer it.

---

## PART 1 — Scaffolding that already exists (file:line, FOUND/PARTIAL/ABSENT)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | `cost_objects` table / node model | **ABSENT** | `grep cost_objects / node_type` over `packages/ supabase/ api/` → zero hits. Pure design: [COST-TO-PRODUCE-DESIGN.md:250-271](COST-TO-PRODUCE-DESIGN.md) §5.1 is the spec; §13:850 lists it under "WHAT DOES NOT EXIST". |
| 2 | Asset Manager (design says "BUILT, separate repo") | **PARTIAL — further along than the design implies, IN this repo** | The ASSET-node shape is already a live migration set: `business_assets` (`acquisition_cost`, `asset_type`, `status`, RLS owner+member) — [20260612_business_assets_inventory_pmi_service.sql:27-89](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql); `cost_confidence` enum added — [20260612_..._cost_confidence.sql:32-35](../../supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql). The **PM/maintenance cost stream exists**: `business_pmi_schedule` (plan, :163-173) + `business_service_log` (cost-carrying events: `cost numeric` + `receipt_id` FK, the count-once seam — :226-237). UI write path: `BusinessAssets.tsx` (374 lines, manual form). CLAUDE.md confirms all 4 tables PRESENT (2026-06-13 audit). So the design's "`{asset_id, purchase_cost, maintenance_events[], total_lifetime_cost}`" shape (§4.4:182) is **already stored** — minus the `cost_objects` unification + the `total_lifetime_cost` rollup. |
| 3 | Receipt → cost (does a receipt line become a cost on a project/asset?) | **PARTIAL — capture + link slot exist; NO attachment, NO rollup** | OCR extracts priced `line_items` — `ocr.ts:63` (per §16.3:1092). Link slots exist (`business_service_log.receipt_id`, `business_inventory.receipt_id`). But nothing turns a receipt line into a cost attached to a project/asset. `receiptReconciliation.ts:25` `computeReconcile()` is line-vs-header-total *within one receipt* — NOT cross-object item↔line matching (§16.3:1096). Stops at capture. |
| 4 | `business_inventory.receipt_id` + `cost_confidence` | **FOUND (schema) / NOT WIRED (write)** | Column + FK + enum: [..._cost_confidence.sql:55-59](../../supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql). Never populated — `BusinessInventory.tsx:50,155` leaves `receipt_id` absent ("linked by receipt flow later") per §16.3:1093. Slot exists; nothing fills it. |
| 5 | Period-pool tile interface (what the accumulator must FEED) | **FOUND & precise** | Tile/page consume `CostToProduceConfig.locations[].recurring[]` = `CostLine[]` (`{label, amount\|null, period, confidence, note}`) — [CostToProduce.ts:54-105](../../packages/shared/src/business-logic/CostToProduce.ts). Stored in `business_modules.config` jsonb, `module_key='cost_to_produce'` (load: `CostToProduceSettings.tsx:111-116`; read: `CostToProduce.tsx:62-64`). `accumulate()` buckets recurring → `floorMonthly` (CONFIRMED+DERIVED) / `estimatedMonthly` (ESTIMATED) / `unknownLines` (CostToProduce.ts:159-202). `analyze(config, extraUnknownInventory[])` → per-N sensitivity (:274). **The page already reads `business_inventory` — but ONLY folds UNKNOWN rows into the unknown *count*** (`CostToProduce.tsx:64,75`); it does NOT add inventory `unit_cost` to the floor, and never reads `business_assets`. |

**The precise interface the accumulator output must land in:** a set of `CostLine` rows (or a monthly-normalized
floor delta) merged into what `accumulate()` sums — i.e. the accumulator feeds `recurring: CostLine[]`
(label, monthly amount, confidence) **or** a parallel "accumulated lines" input added before `accumulate()`.
The tile reads its number from there; the accumulator must not bypass it.

---

## PART 2 — The two OPEN schema questions, RESOLVED

### A. Household-root schema shape → **REUSE `node_type=ASSET` as the root; do NOT add a RESIDENCE node_type.**

**Options:** dedicated `RESIDENCE`/`HOUSEHOLD` node_type vs. ASSET with `parent_id = null` (§14:933-944).

**Recommendation: reuse ASSET-as-root** (`node_type='ASSET'`, `asset_type='property'`/`'residence'`,
`parent_id=null`), plus **one scoping field** to mark personal/household origin.

**Reasoning:**
1. **AC-1.** Residence-ness is a *data value* (`asset_type` is already `vehicle|plant|equipment|tool|property`
   per §4.4:187, and `business_assets.asset_type` is free-text). A new node_type pushes a semantic noun into
   the discriminator — the exact thing AC-1 forbids. §5.1:260 already states "variation lives in data
   (`node_type`), not schema… One table."
2. **The CHECK constraint** is `('ASSET'|'PROJECT'|'PRODUCT')` (§5.1:253). Adding `'RESIDENCE'` = a CHECK
   migration *and* every rollup/consumer grows a 4th case. §5.0:241-243 already concludes reuse is viable
   ("a PROPERTY-flavored node, or the existing ASSET type used as a root with `parent_id = null`").
3. **The real distinction is NOT node_type — it's cost-flow + ownership.** What makes the residence special
   is (a) it's the `parent_id=null` root, and (b) its common costs are *personal-origin* and only a
   use-fraction crosses into the business (carve-out, §5.7). That is an **edge + node-scope** property, not a
   type. Capture it with a small node field — recommend **`domain text CHECK ('business'|'personal'|'household')`**
   (default `'business'`) — NOT a node_type. The rollup then excludes the un-carved personal remainder by
   `domain`, not by branching on a 4th type.

**Tradeoff (stated honestly):** reuse costs slightly more *rollup query logic* — the pool projection must
exclude personal-origin nodes' un-carved remainder (the carve-out conservation rule, §5.7:388). A new
node_type would make "is this the household root?" a cheap type check, but at the price of AC-1 violation +
a CHECK migration + a permanent 4th branch in every consumer. **Reuse wins — not 50/50.** The cost lands in
one well-tested projection (which the slice seam needs anyway), not spread across the schema.

### B. Use-fraction primitive → **ONE shared primitive is viable; build it once on the EDGE.**

**Existing field?** **ABSENT in code.** §5.5 describes owner-set-fraction arithmetic but is explicitly
`STATE: DESIGN — no allocation UI, no basis-assignment table, no rollup query` (§5.5:361). `CostLocation`
(CostToProduce.ts:85-93) has `kind: base|permanent|transient` + `overheadPerUnit` — **no use-fraction /
allocation-basis field anywhere**.

**Can carve-out and multi-location share it?** **Yes — same shape.** §5.7:399-405 argues the use-fraction is
the single primitive shared by carve-out and the `cost_profile` N-location model ("permanent office = a
transient office that doesn't end"). The arithmetic is identical (`basis × cost`). Recommend the primitive
live on the **attribution edge** (the contribution/allocation row, §5.2):

```
use_fraction  numeric  CHECK (use_fraction >= 0 AND use_fraction <= 1)   -- the slice
basis_label   text     -- owner's declared basis, e.g. "336/1800 sqft", "4 of 30 days"
basis_kind    text     -- 'sqft' | 'time' | 'revenue' | 'manual'  (data, not code — AC-1)
```

**The conservation difference (carve-out vs allocation) is NOT a different field — it's the edge's source
node `domain`:** personal-origin source (`domain='personal'/'household'`) → carve-out → remainder stays
OUTSIDE the rollup; business-origin source (`domain='business'`) → allocation → remainder stays INSIDE,
distributed across products. Same `use_fraction`; the node's `domain` (Part 2A) + edge direction drive the
conservation rule. This matches the §5.7 red-team #2 resolution (distinct direction, shared machinery).

**One genuine divergence flagged (do NOT solve here):** the SHARED-LABOR seam (§14:946) — David's hours, a
shared server — has **no fixed basis** (it changes period to period), breaking "owner states basis once."
That is a *temporal* extension (basis-per-period) layered on the **same** `use_fraction` field, not a
different shape. Build the fraction primitive once; flag per-period basis for the labor seam later.

---

## PART 3 — Slice-seam risk (the part most likely to bite), mapped concretely

**Where the seam is:** the accumulator (cost objects own event-sourced lifetime cost: `acquisition_cost`,
`business_service_log.cost` events, receipt line costs) feeds the period pool (`accumulate()` → `floorMonthly`
÷ N). One-directional. The seam = the projection that turns cost-object cost into the `CostLine[]`/floor that
`accumulate()` (CostToProduce.ts:159) sums. **Today there is no projection — the floor comes only from
manually-typed `recurring[]` lines.** When the accumulator feeds it, four concrete double-counts open:

1. **Capex leaking into a *monthly* pool.** `business_assets.acquisition_cost` is a one-time cash-out
   (§6.1 cash-today). If it lands as a recurring monthly `CostLine`, ÷N inflates every unit. Capex must be
   shown cash-today OR amortized — **never summed as a recurring monthly line.** (TRACE never computes the
   accrual schedule — §6.1 boundary — so the pool projection must classify capex distinctly, not monthlyize it.)
2. **Asset capex + its PM stream both counted** (the §14:880 SLICE SEAM, highest-risk). A tool's
   `acquisition_cost` AND its `business_service_log.cost` maintenance events both enter — these are *different*
   costs and both legitimately count, but only if capex is treated once (one-time) and maintenance as the
   recurring stream. Risk is conflating them or summing capex monthly.
3. **Receipt counted twice: as inventory/asset cost AND as a typed recurring line / QB expense**
   (RECEIPT ROUTING SEAM §14:911-931 + COUNT-ONCE §5.4). The dedup join is `business_inventory.receipt_id` /
   `business_service_log.receipt_id` — **present today as schema, enforcement NOT built** (§14:929). Concretely:
   a receipt populates `business_inventory.unit_cost` AND the owner also typed a `recurring` line for the same
   spend → double count. §5.4:329-331: receipt = evidence (count once), asset = cost object (link the receipt,
   don't re-add its amount), project = sum of asset costs (not sum of receipts).
4. **Carve-out remainder leaking IN.** If the rollup naively sums all nodes under the residence root
   (Part 2A), the *un-carved personal remainder* (mortgage minus the office fraction) inflates the business
   pool. The `domain` field + `use_fraction` must gate this.

**Enforcement the build needs (one canonical projection, the ONLY place the pool reads cost objects):**
- (a) **Receipt-dedup set first:** any cost-object/inventory/service row carrying a `receipt_id` means that
  receipt's dollars are already counted there — the raw receipt / QB expense for that `receipt_id` is NOT
  added again.
- (b) **Period classification per cost:** `capex` (one-time → cash-today view, never ÷N-monthly) vs
  `recurring` (monthly) vs `maintenance-stream`. Capex never becomes a monthly `CostLine`.
- (c) **Carve-out gate:** only `use_fraction × cost` of a `domain≠business` node crosses; remainder excluded.
- (d) **TEST COVERAGE at the seam** — the design demands this explicitly ("highest-risk edge in the entire
  system… OPEN until there is test coverage" §14:884-885). The build plan must include slice-seam tests.

**Most likely to bite:** #1 (capex into a monthly ÷N pool) and #3 (typed recurring line vs receipt-linked
inventory cost for the same dollars). Both are invisible inflation, exactly the failure class the
Cost-to-Produce panel truncation bug was (silent, data-shaped).

---

## PART 4 — Sizing the core build

### Net-new vs exists

**EXISTS (substantial — the ASSET-node half):**
- `business_assets` = ASSET-node storage: `acquisition_cost`, `asset_type`, `cost_confidence`, status, RLS
  (owner+member) + a write UI (`BusinessAssets.tsx`).
- `business_service_log` = the PM/maintenance **cost stream** (`cost` + `receipt_id` count-once seam).
- `business_inventory` = material cost rows + `receipt_id` + `cost_confidence` seam (schema only; write unwired).
- `receipts` + OCR priced line extraction (`ocr.ts:63`).
- The **period-pool engine + interface + tile/page**: `accumulate()`/`analyze()` (CostToProduce.ts) +
  `business_modules.config` storage + `CostToProduceSettings.tsx` (load/save w/ truncation guard) +
  `CostToProduce.tsx` (SEE-IT tile, already reads inventory for unknown-count).

**NET-NEW (6 pieces):**
1. **PROJECT + PRODUCT node storage** — `business_assets` is ASSET-only; there is no project/product
   accumulator table. node_type discriminator (`'ASSET'|'PROJECT'|'PRODUCT'`), `parent_id`, `domain` (Part 2A).
2. **Attribution edges** (containment + contribution, §5.2) — none exist — carrying the `use_fraction`
   primitive (Part 2B).
3. **The ROLLUP query/function** — receipt/asset/service_log → project → product, count-once enforced.
4. **The tile-feed projection** — turn accumulated cost-object cost into `CostLine[]`/floor that
   `accumulate()` consumes (Part 1 #5 interface). This is also where Part 3's enforcement lives.
5. **Receipt → cost-object attachment write path** — wire the `receipt_id` slots (currently unwired, Part 1 #4).
6. **`domain` node field + carve-out edge handling** (Part 2A/B) — minimal, but schema-touching.

### The two schema questions, RESOLVED so the build doesn't guess
- **A — household root:** reuse `node_type=ASSET`, `parent_id=null`, add `domain` field. No RESIDENCE type.
- **B — use-fraction:** one `use_fraction`+`basis_*` primitive on the edge; `domain` drives conservation.

### A THIRD schema question surfaced (the build MUST decide — not asked, but discovered)
**Does `cost_objects` SUBSUME `business_assets`, or sit beside it?** `business_assets` already has a working
UI, `cost_confidence`, and TWO FK dependents (`business_pmi_schedule.asset_id`, `business_service_log.asset_id`).
Re-pointing all of that into a new `cost_objects` table is a painful migration of working code. **Lean
(flag, don't bake):** `cost_objects` holds PROJECT + PRODUCT (+ the residence root); `business_assets` stays
the ASSET *detail* table, bridged by FK (`cost_objects.asset_id` or `business_assets.cost_object_id`). This
preserves the working asset manager and confines the migration. The build prompt must resolve this explicitly.

### Seams where LATER layers attach (named, not built)
- **Carve-out** → the edge `use_fraction` + node `domain` (Part 2). Distinct conservation rule; reuses §5.5 math.
- **Tax-into-item** → downstream of per-unit cost, after `analyze()` (never a tax position — §2 boundary).
- **Invoice validation (TILE B, §16.2)** → depends on un-conflating cost from sold-price in
  `order_items` (`submit.ts:169` sets `unit_price = unit_cost` today — §16.3:1094) + a vertical-agnostic
  sale abstraction. Depends on the rollup landing first (a sale needs a confirmed cost to compare).

### Honest size estimate: **SPLIT — the core is two builds, not one.**
- **Core-1 (foundation):** `cost_objects` (PROJECT/PRODUCT + root) + edges table + `use_fraction` primitive +
  `domain` field + RLS (business_id-scoped, AC-2) + **schema verification gate** (catalog-backed). Resolves
  schema question C. No rollup yet.
- **Core-2 (rollup + feed + count-once):** rollup function (receipt/asset/service_log → project → product) +
  the tile-feed projection (the Part 1 #5 interface) + the Part 3 count-once enforcement + **slice-seam test
  coverage** (mandatory per §14).

One build doing both would (a) cross a schema migration AND a multi-table rollup AND the highest-risk seam in
a single pass — too much to verify cleanly, and the slice seam specifically demands its own test pass.

---

## VERIFY (don't grade own homework)
- Every Part-1 item file:line-backed: ✅ (1 ABSENT, 2 PARTIAL, 1 FOUND/NOT-WIRED, 1 FOUND — all cited).
- Both schema questions resolved w/ recommendation + reasoning: ✅ A (reuse ASSET-root + `domain`), B (one
  edge `use_fraction` primitive). Plus discovered question C flagged.
- Slice-seam risk mapped concretely: ✅ 4 named double-counts + 4-part enforcement + test-coverage requirement.
- Core sized, net-new-vs-exists explicit: ✅ ASSET-half ~80% exists; 6 net-new pieces; split into Core-1/Core-2.

**RESULT:** accumulator core sized — **6 net-new pieces** (PROJECT/PRODUCT nodes · edges · rollup · tile-feed
projection · receipt→object wiring · `domain` field); **household-root resolved to reuse `node_type=ASSET`
+ `domain` field** (no new type); **use-fraction is ONE primitive** on the edge (conservation driven by node
`domain`, not field shape); **slice-seam risk is capex-into-monthly-pool + receipt-double-count**, gated by
one canonical projection w/ receipt_id dedup + mandatory seam tests. **Ready to write the build prompt — but
it must (1) decide schema question C (cost_objects subsumes vs. bridges business_assets) and (2) be SPLIT into
Core-1 foundation + Core-2 rollup.** Those two are the only items still OPEN before the build.

---
*TRACE Enterprises · Built with CAI · RECON artifact, not a build record.*
