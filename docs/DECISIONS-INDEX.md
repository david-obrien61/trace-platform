# TRACE — DECISIONS INDEX (read first)

**Purpose:** ONE map of every decision-bearing doc so nobody re-derives what's already
settled. Before re-litigating a design question, look it up here → find its home → **ask
David to paste the right doc** rather than re-reasoning from scratch.

**Last updated:** 2026-07-07 (D-34 "lot is the SKU" promoted to a first-class entry;
SELL-PRICE flipped OPEN→DECIDED as D-35 "sell_price stored on the stock line"; consolidated
inventory→sale build spec linked. Created earlier same day — DOCS-ONLY scan of `docs/decisions/*.md`,
`docs/DECISIONS.md`, `MASTER_BRIEF.md`, `DISCOVERY_MODULE_BRIEF.md`, `user_stories.md`,
`docs/architecture/*`, `docs/cost-to-produce/*`, all `*BRIEF*`/`*DECISION*`/`*FRAMING*`.)

**How this file stays honest:** it is a POINTER index — it names the home + one-line
what-it-decides + status. It never re-states a decision's substance (that's the home doc's
job). If code and a home doc conflict, **the code wins and the doc gets corrected**
(audit-wins rule). Status legend: **DECIDED** (settled + recorded) · **OPEN** (not yet
decided/recorded — needs David) · **SUPERSEDED** (replaced; kept for provenance) ·
**DRIFTED** (decided, but the code diverged — a build owed).

> ✅ **Drift watch (2026-07-07 · SELL_PRICE build):** No drift — abided by **D-34** (price lives on
> the stock line, not per-specimen), **D-35** (built exactly: stored `sell_price` DISTINCT from
> `unit_cost`, cart reads sell_price never unit_cost, MarginEngine only suggests), **AC-1** (sell_price
> on the agnostic `business_inventory`, no `cultivar_` noun), **AC-3** (every read/write business_id-scoped),
> **Surface Honesty / D-9** ($0/null sale REFUSED server+client, never silently charged $0). Item 1 of the
> inventory→sale spec is BUILDER-COMPLETE (M1 migration GATED — David applies). **STEP 5 tier math HELD, not
> drift:** the `price_tier`→adjustment mechanism is undefined and taxonomies don't match (customers
> retail/contractor/wholesale ≠ Cost-to-Produce walk-in/friends-family/contractor), so per **AC-4** (settle-once,
> don't guess) the read is wired + TRACE-logged but NO adjustment applied — surfaced to David for a decision.
> *(Prior 2026-07-07 line — D-34/D-35 recording + spec — preserved below.)*
> ✅ **Drift watch (2026-07-07 · decisions + spec):** No drift — this session (record D-34 lot-is-the-SKU + D-35
> sell_price-on-stock-line, then write the consolidated inventory→sale build spec) stayed
> strictly within the settled decisions: D-34 promotes an already-settled 2026-06-13 decision
> to a first-class entry (no new call), D-35 resolves a genuinely-OPEN question David decided
> this pass, and the spec only sequences work FROM those decisions (no code, no schema written).
> The close-out rule (CLAUDE.md §9) updates THIS line every session: "✅ No drift — abided by …"
> or "⚠️ DRIFT — went outside #Z: [what/why]". status.html renders this line as a banner on the
> 📇 Decisions panel (green = clean, red = drift).

---

## 1. THE CANONICAL LEDGERS (start here)

| Ledger | What it holds | Path |
|---|---|---|
| **DECISIONS.md** | The living decision ledger — **D-1…D-33** (product/architecture decisions) + **OP-1…OP-12** (operating principles). The single home for anything not frozen. | [docs/DECISIONS.md](DECISIONS.md) |
| **Architecture Constants (AC-1…AC-5)** | The non-negotiable structural rules (no vertical nouns in shared schema · RLS scoped to `business_id` · absolute tenant isolation · structural design shared/tokens vary · one-integration-one-connector). | [PLATFORM_STRATEGY.md](../PLATFORM_STRATEGY.md) § Architecture Constants (summaries in [CLAUDE.md](../CLAUDE.md) §1.5) |
| **MASTER_BRIEF — MB_D-001…MB_D-015** | **FROZEN** decision log (strategy/revenue-era). Nothing new goes here; every decision since MB_D-015 lives in DECISIONS.md. | [MASTER_BRIEF.md](../MASTER_BRIEF.md) |
| **CLOSE-OUT-LEDGER.md** | Per-build completion state (BUILDER-COMPLETE vs OWNER-PROVEN, SHA, what live test closes it). Answers "is it closed?" not "was it decided?". | [docs/CLOSE-OUT-LEDGER.md](CLOSE-OUT-LEDGER.md) |
| **built-inventory.md** | Flat catalog of what's BUILT (capability ledger). Answers "was X built?". | [docs/built-inventory.md](built-inventory.md) |
| **TRACE-SESSION-BOOTSTRAP.md** | The status front-page (⚡ ACTIVE STATUS · 📋 24-board · 🧵 ARC-MAP · 📚 CAPTURE INDEX). Answers "what's the current state?". | [TRACE-SESSION-BOOTSTRAP.md](../TRACE-SESSION-BOOTSTRAP.md) |

---

## 2. INVENTORY / SIZE / LOT / QR — the model most re-litigated

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **Inventory size model = B-clean** | One `business_inventory` row per **variety × size**; `size text` (grower's own value, no CHECK) + `variant_group text` (parent product slug). Migration `20260628_inventory_size_variants.sql` (applied). | [docs/decisions/2026-06-27-discovery-size-variants.md](decisions/2026-06-27-discovery-size-variants.md) (pick recorded at line 64); build state in [2026-07-07-size-variant-build-state-recon.md](decisions/2026-07-07-size-variant-build-state-recon.md) | 2026-06-27 | **DECIDED** |
| **D-34** Lot-level history, "the lot is the SKU" | LAWNS tracks **lots (qty-of-SKU)** via `business_inventory`, **not individual organisms**; history attaches to the variety/lot. `cultivar_plants` demoted to vertical-IDENTITY-only. | [docs/DECISIONS.md](DECISIONS.md) D-34 (promoted from the migration header) + [supabase/migrations/20260613_cultivar_plants_untangle.sql](../supabase/migrations/20260613_cultivar_plants_untangle.sql) (lines 4–11) + design in [docs/architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md](architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md) | 2026-06-13 (recorded as D-34 2026-07-07) | **DECIDED** |
| **Three-layer inventory model (item → size class → stock line) + lifecycle-stages-as-events** | Catalog item → size class → countable stock line; lifecycle stages modeled as events on the lot. | ⚠️ **No single dedicated doc found.** Realized across the B-clean size decision (variety×size rows) + the June-13 lot=SKU untangle; lifecycle/stages-as-events design captured in [docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md](cost-to-produce/COST-TO-PRODUCE-DESIGN.md) §5.3/§5.9 (project→product lifecycle, season-end event on each lot). The "June 5" framing appears to be **chat-origin, not a repo doc** — see PART 2 flag. | June 5 (framing) / 2026-06-13–27 (realized) | **DECIDED (scattered)** |
| **QR resolves to VARIETY (bare-domain QR), size is a pick-step** | A pot's QR encodes `${baseUrl}/plant/${tag_id}` → public `/plant/:tagId` page → resolves the variety; size is chosen at count/checkout time (the count-side size-picker). | [docs/decisions/2026-06-26-grower-resolve-design.md](decisions/2026-06-26-grower-resolve-design.md) + [walk-and-count-inventory-verify-first.md](decisions/walk-and-count-inventory-verify-first.md); front-door path in [2026-07-07-qr-order-front-door-recon.md](decisions/2026-07-07-qr-order-front-door-recon.md) | 2026-06-21 / 26 | **DECIDED** |
| **Count-side size-picker (L5 NEED_CLARIFICATION seam)** | Same-name multi-size scan → size-picker → routes to the exact per-size lot (owner-proven on iPhone). | [docs/decisions/2026-06-27-discovery-size-variants.md](decisions/2026-06-27-discovery-size-variants.md) + CLOSE-OUT-LEDGER #72 | 2026-06-30 | **DECIDED (OWNER-PROVEN)** |
| **Grower-resolve L4 (name token-set equality)** | Scan-slug tokens == catalog NAME tokens (order-insensitive) → resolve; >1 → UNKNOWN, never auto-pick. | [docs/decisions/2026-06-26-grower-resolve-design.md](decisions/2026-06-26-grower-resolve-design.md) | 2026-06-26 | **DECIDED (OWNER-PROVEN)** |
| **Discovery captures WooCommerce size variants** | Deterministic `extractSizeVariants(rawHtml)` — variation-form JSON primary, `<select>` fallback; write one row per (variety×size). | [docs/decisions/2026-06-27-discovery-size-variants.md](decisions/2026-06-27-discovery-size-variants.md) | 2026-06-27/28 | **DECIDED** |
| **Local-storage vocabulary** | Clarifies inventory/count storage vocabulary. | [docs/decisions/2026-07-01-local-storage-vocabulary-clarification.md](decisions/2026-07-01-local-storage-vocabulary-clarification.md) | 2026-07-01 | **DECIDED** |
| **Schema stress-battery (business_inventory)** | Adversarial identity-model stress cases; CASE-5 dup-size hardening at populate write time. | [docs/decisions/2026-06-30-schema-stress-battery-findings.md](decisions/2026-06-30-schema-stress-battery-findings.md) | 2026-06-30 | **DECIDED** |
| **Live schema map (inventory/orders/customers)** | Authoritative per-column snapshot of the live tables (the version-control gap, tech-debt #39). | [docs/decisions/2026-07-07-live-schema-map.md](decisions/2026-07-07-live-schema-map.md) | 2026-07-07 | **RECON (reference)** |

---

## 3. COST-TO-PRODUCE / PRICING / MARGIN

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **D-1** Cost-object node model — rename-in-place (approach C) | `business_assets`→`cost_objects` unified node table. | [docs/DECISIONS.md](DECISIONS.md) D-1 (+ [docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md](cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md)) | 2026-06-15 | **DECIDED** |
| **D-4** Two edge tables | Structural (`cost_object_edges`) vs temporal (`cost_object_assignments`). | [docs/DECISIONS.md](DECISIONS.md) D-4 | 2026-06 | **DECIDED** |
| **D-5** Cost event is truth; receipt = signal + substantiation | We surface, don't reconcile. | [docs/DECISIONS.md](DECISIONS.md) D-5 | 2026-06-13 | **DECIDED** |
| **D-8** Cost usage-coupling shape | RECURRING-FIXED vs PER-OCCASION. | [docs/DECISIONS.md](DECISIONS.md) D-8 | 2026-06-13 | **DECIDED** |
| **D-9** The honesty contract | KNOW / THINK / REASON / NEED-CLARIFICATION; acceptance is the pivot. | [docs/DECISIONS.md](DECISIONS.md) D-9 | 2026-06-13 | **DECIDED** |
| **D-10** Cost-to-Produce primary lens = BY PROJECT | Not a flat business pool. | [docs/DECISIONS.md](DECISIONS.md) D-10 + [docs/DECISION-project-lens-ui-design.md](DECISION-project-lens-ui-design.md) | 2026-06-16 | **DECIDED** |
| **D-11** Cost Category dimension = Schedule C / QBO-mappable | Adopt the standard, don't invent. | [docs/DECISIONS.md](DECISIONS.md) D-11 + [docs/DECISION-cost-category-dimension.md](DECISION-cost-category-dimension.md) | 2026-06-18 | **DECIDED** |
| **D-12** Labor cost model | Robust schema now, UI depth incremental. | [docs/DECISIONS.md](DECISIONS.md) D-12 + [docs/DECISION-labor-cost-model.md](DECISION-labor-cost-model.md) | 2026-06-18 | **DECIDED** |
| **D-13** Unified margin store + history | **DEFERRED** (future cross-vertical arc). | [docs/DECISIONS.md](DECISIONS.md) D-13 + [docs/DECISION-unified-margin-store-and-history.md](DECISION-unified-margin-store-and-history.md) | 2026-06-18 | **DEFERRED** |
| **D-14** Cost attribution follows consumption | Shared cost flows by use-fraction carve-out. | [docs/DECISIONS.md](DECISIONS.md) D-14 + [docs/DECISION-cost-attribution-and-shared-cost.md](DECISION-cost-attribution-and-shared-cost.md) | 2026-06 | **DECIDED** |
| **D-15** Cost object = compressed industry-standard cost record | Adopt/deviate/add/skip, each logged. | [docs/DECISIONS.md](DECISIONS.md) D-15 + [docs/DECISION-cost-object-model-of-record.md](DECISION-cost-object-model-of-record.md) | 2026-06-18 | **DECIDED** |
| **D-16** Pricing = COST-TO-SERVE + separate payback line (Model B) | Not fully-loaded cost. | [docs/DECISIONS.md](DECISIONS.md) D-16 + [docs/DECISION-pricing-model.md](DECISION-pricing-model.md) | 2026-06-19 | **DECIDED** |
| **D-17** One pricing engine, four display surfaces, three audiences | Prospects never see owner economics. | [docs/DECISIONS.md](DECISIONS.md) D-17 + [docs/DECISION-pricing-display-surfaces.md](DECISION-pricing-display-surfaces.md) | 2026-06 | **DECIDED** |
| **D-18** Platform overhead hand-allocated across verticals | Platform = computed remainder, guarded at 100%. | [docs/DECISIONS.md](DECISIONS.md) D-18 + [docs/DECISION-platform-overhead-carveout.md](DECISION-platform-overhead-carveout.md) | 2026-06 | **DECIDED** |
| **D-19** Three cost layers; the hidden third = OPPORTUNITY COST | The cost of pulled labor. | [docs/DECISIONS.md](DECISIONS.md) D-19 | 2026-06 | **DECIDED** |
| **Unified cost model (Option 2) / small-business accounting model** | Cost-NATURE (CapEx/COGS/OpEx) × PROJECT × SHAPE tagging. | [docs/DECISION-unified-cost-model-option2.md](DECISION-unified-cost-model-option2.md) + [docs/DECISION-small-business-cost-accounting-model.md](DECISION-small-business-cost-accounting-model.md) | 2026-06-17 | **DECIDED** |
| **Nested projects + BI what-if blocker** | Future arc — build when real. | [docs/DECISION-nested-projects-and-BI-whatif-blocker.md](DECISION-nested-projects-and-BI-whatif-blocker.md) | 2026-06 | **DEFERRED** |
| **D-35** Sell price stored on the stock line | `business_inventory.sell_price` (stored, editable, authoritative) DISTINCT from `unit_cost`; MarginEngine suggests but the stored price governs; cart reads `sell_price`, refuses $0; `price_tier` applies at checkout. Industry-standard variant pricing (Shopify/Square/WooCommerce). | [docs/DECISIONS.md](DECISIONS.md) D-35 + build items in [docs/decisions/2026-07-07-inventory-sale-pipeline-buildspec.md](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) item 1 | 2026-07-07 | **DECIDED** · item 1 BUILDER-COMPLETE (M1 migration GATED; datasheet column + cart repoint + $0-refusal built; **tier math OPEN — AC-4 hold**) |

---

## 4. PLATFORM ARCHITECTURE / IDENTITY / NAV / DISCOVERY / RESIDENCE

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **D-31** Platform DB + spine-first architecture | One platform database (80/20); Ignition retires onto the shared spine. | [docs/DECISIONS.md](DECISIONS.md) D-31 | 2026-07 | **DECIDED** |
| **D-21** Screen real estate is sacred | Direct access over scroll (platform-wide design law). | [docs/DECISIONS.md](DECISIONS.md) D-21 | 2026-06 | **DECIDED** |
| **D-22** Admin = business-entity config; Settings = user-self | The nav gating axis. | [docs/DECISIONS.md](DECISIONS.md) D-22 | 2026-06 | **DECIDED** |
| **D-23** FAITHFUL vs CONNECTED | One source, two renders, default faithful. | [docs/DECISIONS.md](DECISIONS.md) D-23 | 2026-06 | **DECIDED** |
| **D-24** RIGID SPINE / FLEXIBLE EDGE | The per-field decision rule (the disciplined blob). | [docs/DECISIONS.md](DECISIONS.md) D-24 | 2026-06 | **DECIDED** |
| **D-25** Intelligence tiers | Tier 0 (world knowledge) gives day-one value pre-data. | [docs/DECISIONS.md](DECISIONS.md) D-25 | 2026-06 | **DECIDED** |
| **D-26** The dual lexicon ("Happy Hose") | Speak trade + owner language, translate between. | [docs/DECISIONS.md](DECISIONS.md) D-26 | 2026-06 | **DECIDED** |
| **D-30** Shared-device authentication | Three flavors; face-swap preferred; face-recognition do-not-build. | [docs/DECISIONS.md](DECISIONS.md) D-30 | 2026-07 | **DECIDED** |
| **D-32 / D-33** Discovery — gap vs deliberate business decision | Not every absence is an opportunity; FIX = Option A (scoped, post-demo). | [docs/DECISIONS.md](DECISIONS.md) D-32/D-33 | 2026-07-07 | **DECIDED (build deferred)** |
| **D-27 / D-28 / D-29** Residence Product ("Kitchen Loop") + API neutrality + offline gradient | Residence = residence-scoped VIEW of the one shared engine; API neutrality Green/Red/Amber; offline capture always works, parses on sync. | [docs/DECISIONS.md](DECISIONS.md) D-27–29 + [docs/residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md](residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md) + [HOUSEHOLD-SHARING-DECISION.md](residence-product/HOUSEHOLD-SHARING-DECISION.md) | 2026-07-03 | **DECIDED** |
| **D-31 spine — member/device/role console** | Agnostic console; role-floor seed; nav-integrity guard. | CLAUDE.md HANDOFF 2026-07-06 + CLOSE-OUT-LEDGER #86–92 | 2026-07-06 | **DECIDED (OWNER-PROVEN)** |
| **Role financial permissions** | Which roles see cost/margin (the moat). | [docs/decisions/2026-06-21-role-financial-permissions.md](decisions/2026-06-21-role-financial-permissions.md) | 2026-06-21 | **DECIDED** |
| **Grower import + mobile roles** | Import path + mobile role model. | [docs/decisions/2026-06-21-grower-import-and-mobile-roles.md](decisions/2026-06-21-grower-import-and-mobile-roles.md) | 2026-06-21 | **DECIDED** |
| **Vercel 12-function ceiling** | STOP-and-surface; reuse existing endpoints before minting #13. | [docs/decisions/2026-06-20-vercel-function-ceiling-mitigation.md](decisions/2026-06-20-vercel-function-ceiling-mitigation.md) | 2026-06-20 | **DECIDED** |
| **Discovery module** | The discovery capability brief. | [DISCOVERY_MODULE_BRIEF.md](../DISCOVERY_MODULE_BRIEF.md) | — | **REFERENCE** |
| **Canonical layer definitions** | shared/vertical/platform code layers + placement authority. | [docs/architecture/LAYER-DEFINITIONS.md](architecture/LAYER-DEFINITIONS.md) | 2026-06-14 | **DECIDED** |
| **AC-1…AC-5** Architecture Constants | Non-negotiable structural rules (see §1). | [PLATFORM_STRATEGY.md](../PLATFORM_STRATEGY.md) / [CLAUDE.md](../CLAUDE.md) §1.5 | — | **DECIDED (locked)** |

---

## 5. OPERATING PRINCIPLES (how we work) — OP-1…OP-12

All live in [docs/DECISIONS.md](DECISIONS.md). One-line each:

| OP | Principle |
|---|---|
| OP-1 | "Any ethical means within the covenant" |
| OP-2 | Composite working register |
| OP-3 | "This isn't working" reconsider-framework |
| OP-4 | STD-003 instrumentation-as-gate + two completion bars |
| OP-5 | Good-enough model + AI-as-equalizer (design north star) |
| OP-6 | Graceful degradation / fidelity tiers |
| OP-7 | AI infers → proposes → owner confirms |
| OP-8 | HAVE / NEED / WANT three-lens recon standard |
| OP-9 | The Regina Principle — the surfacing engine (product north star) |
| OP-10 | Structure-Last — the structure tax is paid by the MACHINE |
| OP-11 | Reconcile on both bars — OWNER-PROVEN triggers the flip |
| OP-12 | Reference-first promotion — the live boundary is crossed only by promoting a reference-proven artifact |

Plus the top-of-hierarchy framing doc: [NORTH-STAR.md](../NORTH-STAR.md).

---

## PART 2 — TWO REFERENCED-BUT-UNFOUND DOCS (located)

### 1. The June-13 "lot is the SKU" decision → **IN REPO, but not as a first-class decision**

- **Where it actually lives:** the header rationale block of the migration
  [supabase/migrations/20260613_cultivar_plants_untangle.sql](../supabase/migrations/20260613_cultivar_plants_untangle.sql)
  (lines 4–11): *"Settled model: LAWNS tracks LOTS (qty-of-SKU) via business_inventory.
  plants' only surviving value is vertical IDENTITY … Stock facts move to
  business_inventory."* Design rationale is also in
  [docs/architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md](architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md)
  (the layer-split + promotion feasibility test) and
  [docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md](cost-to-produce/COST-TO-PRODUCE-DESIGN.md).
- **Who quotes it as the yardstick:** the 2026-07-07 recon
  [docs/decisions/2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md](decisions/2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md)
  (line 14: *"June 13: 'LAWNS tracks lot-level history, not individual organisms; the lot
  is the SKU.'"*).
- **✅ RESOLVED 2026-07-07:** promoted to **[D-34 · The LOT is the SKU](DECISIONS.md)** in
  DECISIONS.md (a `[POINTER]` entry back to the migration header + feasibility doc). A
  decision lookup now finds it where it should. The migration header remains the canonical
  rationale home; D-34 is the discoverable ledger pointer.

### 2. STORIES_AND_FRAMINGS.md → **NEVER CREATED**

- **Filename search:** no match anywhere in the tree (excluding node_modules).
- **Git history (all branches, including deleted files):** no file by that name ever existed.
- **String search (any extension):** zero references to `STORIES_AND_FRAMINGS` anywhere in
  the repo.
- **Verdict: the doc was never created.** The "stories + framings" content it implies is
  currently **split** across: [user_stories.md](../user_stories.md) + [stories.html](../stories.html)
  (the Story Board system, ledger #56) for the day-in-the-life stories, and the many
  `docs/decisions/*.md` recon/framing docs indexed above for the framings.
- **🚩 FLAG:** if David wants a single consolidated STORIES_AND_FRAMINGS doc, it **needs
  authoring from scratch** — there is nothing to rename or recover.

---

## PART 3 — GENUINELY-OPEN DECISIONS (need David)

These are NOT yet decided/recorded. Lightning should surface them rather than assume a home.

| Open item | Current state | Decided anywhere? |
|---|---|---|
| ~~**SELL PRICE on the stock line**~~ | ✅ **DECIDED 2026-07-07 as [D-35](DECISIONS.md)** — stored `business_inventory.sell_price` (editable, authoritative, DISTINCT from `unit_cost`); MarginEngine suggests, stored price governs; cart reads `sell_price` and refuses $0; `price_tier` applies at checkout. | **DECIDED** — build owed (spec item 1: migration + datasheet entry UI + cart repoint + tier consumption). |
| **Lifecycle / transplant EVENT grain (cohort vs per-size)** | Events key on `plant_id`; design says lot-level. The re-anchor target (variety-cohort vs per-size row) is spec'd but the grain is the one sub-question David still picks at build time. | **PARTIALLY DECIDED** — the DRIFT is settled by [[D-34]] (re-anchor to the stock line, add cost-basis columns); spec'd as [buildspec item 5](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) and marked **POST-DEMO**. The cohort-vs-per-size grain is the residual call, made when item 5 is built. |
| **Purchase-off-stock-line vs `cultivar_plants` (the drift)** | Purchase resolution still anchored to per-specimen `cultivar_plants`. | **DECIDED (build owed)** — no longer an open *decision*: [[D-34]] settles the target; the fix is spec'd as [buildspec item 2](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) (`usePlant` fallback ladder + shared resolver + `order_items` schema), **DEMO-CRITICAL**. It's DRIFTED code, not an undecided question. |

**Reconciliation note (updated 2026-07-07):** all three former open items are now closed as
*decisions*. SELL PRICE became **D-35**. The two lifecycle/purchase items were always
downstream of the June-13 "lot is the SKU" decision (now first-class **D-34**) — the DECISION
existed; the CODE drifted — and are now sequenced in the consolidated build spec
([2026-07-07-inventory-sale-pipeline-buildspec.md](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md)).
What remains is BUILD, not DECIDE. Nothing genuinely-undecided is left in this section.
