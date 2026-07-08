# TRACE — DECISIONS INDEX (read first)

**Purpose:** ONE map of every decision-bearing doc so nobody re-derives what's already
settled. Before re-litigating a design question, look it up here → find its home → **ask
David to paste the right doc** rather than re-reasoning from scratch.

**Last updated:** 2026-07-08 (SETTINGS SERVICE EDITOR — expose all service_offerings categories (+ transport) +
un-conflate `price_type`/`price_unit` on create AND edit, category now editable, category-scoped rule fields surfaced;
NEW generic enum module `serviceOfferingEnums.ts`. Unblocks §4b's demo-data reshape (the "separate Settings-editor task").
drift-watch updated. Earlier: RESTORE transport/netting/decline workflow — added §4b CHECKOUT / ORDER-FLOW
WORKFLOWS with the canonical spec `docs/specs/SPEC-transport-netting-decline-workflow-2026-07-08.md`; drift-watch
updated. Earlier: PURCHASE-OFF-STOCK-LINE built — the D-34 drift row flipped from
"DECIDED (build owed)" to **BUILDER-COMPLETE (M2 GATED)**; earlier same day: D-34 "lot is the SKU"
promoted to a first-class entry; SELL-PRICE flipped OPEN→DECIDED as D-35. Created earlier same day —
DOCS-ONLY scan of `docs/decisions/*.md`, `docs/DECISIONS.md`, `MASTER_BRIEF.md`,
`DISCOVERY_MODULE_BRIEF.md`, `user_stories.md`, `docs/architecture/*`, `docs/cost-to-produce/*`,
all `*BRIEF*`/`*DECISION*`/`*FRAMING*`.)

**How this file stays honest:** it is a POINTER index — it names the home + one-line
what-it-decides + status. It never re-states a decision's substance (that's the home doc's
job). If code and a home doc conflict, **the code wins and the doc gets corrected**
(audit-wins rule). Status legend: **DECIDED** (settled + recorded) · **OPEN** (not yet
decided/recorded — needs David) · **SUPERSEDED** (replaced; kept for provenance) ·
**DRIFTED** (decided, but the code diverged — a build owed).

> ✅ **Drift watch (2026-07-08 · build-spec pre-flight gate + hardcoded register + amber-cap rule — DOCS/board only):**
> No drift — this session added process TEETH, wrote no app code and no migration. Landed: (1) CLAUDE.md
> **§1.6 the 10-item build-spec pre-flight gate** (binding, folds into STEP 0 — story · hardcoded-register ·
> validation · CRUD-with-permissions · UI/modals · AC-1..4 · 12-fn ceiling · reuse-don't-fork · TRACE-stays-on ·
> money-safety; "not reconciled = not ready to fire"); (2) **`docs/decisions/HARDCODED-REGISTER.md`** — a living
> checklist of hardcoded literals tagged by owning capability (11 items, cross-ref'd to the receipt/QB/leakage
> recon, NOT duplicated); (3) CLAUDE.md **§6 rule 12** + the status board (`TRACE-SESSION-BOOTSTRAP.md` legend +
> `status.html` `parseBoard`) enforce **"🟢 = done AND no open hardcoded debt; a tile with register items is
> capped at amber."** Applied now: **2.1 QR Checkout dropped 🟢→🟡** (8 open items, led by the QB stub). Gives the
> anti-hardcoding rule the teeth the as-built §6 flag lacked (flagged-never-removed = why it exists). No decision
> settled/deferred/superseded that conflicts; these are new standing rules + a register.
>
> ✅ **Drift watch (2026-07-08 · #100 follow-up — order-detail "PLANTS (0)" fix):**
> No drift — abided by **D-34** (the dedicated `order_items` fetch names every line by the LOT/specimen
> dual anchor, reusing the same `orderItemName.ts` resolver Part A added — NOT forked), **AC-3** (the
> line-item query is `order_id`-scoped only after the orders query verified `.eq('business_id')`), and
> **§6 rule 8 / rule 11** (one resolver reused; ZERO new `api/` file, ZERO migration). No decision
> settled/deferred/superseded — this is a query FIX (a PostgREST nested-embed drop decoupled into a
> top-level query) within existing decisions. Completes the #100 roster drill-in (story MAPS-TO 2.1).
>
> ✅ **Drift watch (2026-07-08 · ORDER ROSTER CRUD + "Unknown plant" fix — as-built §7 gaps):**
> No drift — abided by **D-34** (the roster/drill-in name items by the LOT/specimen dual anchor — the same
> `business_inventory_id`-vs-`plant_id` anchor `submit.ts` writes), **D-35** (edit re-reads server-authoritative
> `sell_price`, refuses $0 per line — never `unit_cost`, never a fabricated total), **AC-3** (every CRUD query
> `business_id`-scoped + verifies order ownership), **MB_D-015 write-authority ≥ read-authority** (edit/delete/status
> are token-gated server-side — owner by `owner_id` OR `manage_orders` via `has_permission` — the same write-wall
> pattern as cost-apply; staff can't edit even though the roster is `qr_checkout`-visible), and **§6 rule 11 / 12-fn
> ceiling** (ZERO new `api/` file — CRUD rides `submit.ts` via an `action` param). No prior decision settled/deferred/
> superseded. **TWO NEW open decisions logged (PART 3):** R-QBSTALE (an edited order surfaces QB-invoice staleness —
> auto re-sync vs the banner is David's call) + R-STATUS (ratify the minimal `pending→confirmed→fulfilled→cancelled`
> enum + whether cancel should auto-release inventory). Satisfies story MAPS-TO 2.1 roster sub-stories.
>
> ✅ **Drift watch (2026-07-08 · CHECKOUT FIX-PASS — search lookup + centered modal + conditional required address/phone + owner delivery-date):**
> No drift — abided by **AC-1** (the new shared `searchStockLines` names only `business_inventory`, no vertical noun —
> same agnostic resolver family as `resolveStockLine`), **AC-3** (search + all reads are `business_id`-scoped), **D-9
> Surface Honesty** (a delivery order can no longer be placed with a blank ship-to — the requirement is READ from the
> owner-set `service_offerings.requires_address` / staff shape, not hardcoded), **§6 rule 11 / 12-fn ceiling** (ZERO new
> `api/` file — the delivery-date write rides the existing `submit.ts`), and the **gated-migration discipline**
> (`orders.delivery_date` doesn't exist → GATED `20260708_orders_delivery_date.sql`, David applies as postgres; NOT
> hand-migrated; `submit.ts` deploy-window-safe fallback). No decision was settled/deferred/superseded — these are FIXES
> within existing decisions (D-34 anchor · D-35 sell_price · D-9 · AC-1/AC-3) and satisfy story MAPS-TO 2.1. NEW gap
> sub-story logged on the board (template-driven service setup, needs-input) — a surfaced NEED, not a decision.
>
> ✅ **Drift watch (2026-07-08 · SETTINGS SERVICE EDITOR — categories + un-conflate price_type/price_unit, create+edit):**
> No drift — abided by **AC-1** (the category / price_type / price_unit / transport_mode option lists are the GENERIC
> schema enums, sourced from the migration column CHECKs into ONE shared `serviceOfferingEnums.ts`; no vertical noun — a
> vertical supplies service ROWS, never enum members), **AC-3** (owner-fenced `service_offerings` RLS unchanged; writes
> scoped to the active business_id), **§8 configuration philosophy** (owner can now shape any service entirely in the UI:
> the fields are available, visible, and propagate immediately — no migration), **D-9 Surface Honesty** (prices are
> OWNER-SET and always editable; the editor invents no number, and moving a service between categories clears the rule
> fields that no longer apply so no stale/mis-charging rule lingers), **§6 rule 11 / 12-fn ceiling** (ZERO new `api/`
> file — rides the existing insert/update; ZERO migration — every column already exists). This is the "separate
> Settings-editor task" §4b/ROW #97 named — it UNBLOCKS the restored transport/netting workflow's demo-data reshape.
>
> ✅ **Drift watch (2026-07-08 · RESTORE transport/netting/decline workflow + canonical spec):** No drift — this
> RESTORES the May-18 proven workflow (recovered from git `0897e00`/`5aeff86`/`8764b39`/`0041769`) onto the current
> service_offerings model and gives it a canonical spec home (docs/specs/SPEC-transport-netting-decline-workflow) so it
> is never re-derived — a NEW retrievable decision (added §4b), not a re-litigation. Abided by **AC-1** (transport/netting
> generic; Ch.725 copy lives in the row's `compliance_title`/`compliance_body`, not code), **AC-3** (business_id-scoped
> reads + business-scoped decline rows), **D-9 Surface Honesty** (delivery+planting read as TWO correctly-ruled services;
> when the two rows aren't both present the workflow FLAGS + best-efforts, never silently mischarges — data reshape is the
> separate Settings-editor task, not hand-migrated here), **§6 rule 8** (the per-branch attach math reuses the ONE shared
> `netting.ts` engine for both display and charge), **§6 rule 11 / 12-fn ceiling** (ZERO new `api/` file — rides
> `submit.ts`; ZERO migration). The decline-capture (orders.netting_declined + immutable order_compliance_records) is
> preserved from the proven build.
>
> ✅ **Drift watch (2026-07-08 · TWO owner-prove-surfaced bug fixes — profile cost-leak + QBO-absent crash):** No drift —
> abided by the **cost wall / D-9 Surface Honesty** (the customer-facing profile now shows `sell_price`, NEVER `unit_cost`;
> `unit_cost` stays only on view_costs owner surfaces; null/0 → honest "Not set", never $0, never cost) and **D-9 fail-loud-not-
> silent** (a QBO failure degrades to an honest "invoice will follow" confirmation with `[TRACE:CHECKOUT]`, never a blank crash).
> **AC-3** (business_id-scoped reads unchanged). ZERO new `api/` file (12/12 held), ZERO schema. Surfaced R3 as a design flag for
> David (pay-at-office fires the QBO call on both pay paths) — flagged, not decided; crash-proof regardless.
>
> ✅ **Drift watch (2026-07-08 · MULTI-ITEM SCAN-LOOP CART + NETTING build):** No drift — abided by **D-34**
> (each cart line reuses the proven per-line `stock_line_id`/`plant_id` anchor branch — extended to loop N,
> not forked), **Item-1 sell_price** (D-35: cart reads `sell_price`, server-authoritative per line, $0 refused
> naming the item — no cost leak), **D-9 surface-not-silent** (the netted itemization is PROPOSED and
> owner-adjustable in CartReview before submit — Regina Principle; nothing silently applied), **AC-3**
> (every resolve/read/write business_id-scoped), **§6 rule 8** (extracted `synthesizePlant`+`anchorKey`,
> `extractTag`, and the attach-rule `nettedQuantity`/`lineSubtotal` into ONE shared definition each —
> client display + server charge import the same rule so they can't drift; QrScanner + `resolveStockLine`
> reused from walk-and-count, not rebuilt), **§6 rule 11 / 12-fn ceiling** (ZERO new `api/` files — the
> order write rides the existing `submit.ts`, generalized to loop lines). No new schema — the per-order vs
> per-plant attach-rule already lived on `service_offerings.price_type`/`price_unit` (recon R1–R5). The
> quantity-bearing-with-spec class (fertilizer "5 × 30gal each") is DEFERRED, seam left untouched, no spec
> column added.
>
> ✅ **Drift watch (2026-07-07 · PURCHASE-OFF-STOCK-LINE build):** No drift — abided by **D-34** (purchase
> anchors to the `business_inventory` stock line, `cultivar_plants` identity-only — this closes the DRIFTED
> code, does not re-decide), **AC-1** (the extracted `resolveStockLine` is agnostic — names only
> `business_inventory`, no `cultivar_` noun; the vertical `cultivar_plants` L1 lane stays in the callers),
> **AC-3** (every resolve/read/write business_id-scoped), **§6 rule 8** (ONE shared resolver + one
> `detectSizeCollision`, consumed by both InventoryCount and usePlant — not a second copy). M2 GATED (order_items
> stock-line anchor). **#72 count size-picker byte-identical (no regression); a quick re-owner-prove recommended,
> expected to hold.** Item 2 of the inventory→sale spec is BUILDER-COMPLETE. *(Prior 2026-07-07 lines preserved below.)*
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
| **HARDCODED-REGISTER.md** | Living checklist of hardcoded tenant/vertical literals that should be data (AC-1), tagged by owning capability. A tile with any OPEN item is CAPPED AT AMBER (CLAUDE.md §6 rule 12 + §1.6 gate item 2). Answers "what fake/leaked literals block this tile from green?". | [docs/decisions/HARDCODED-REGISTER.md](decisions/HARDCODED-REGISTER.md) |
| **Build-spec pre-flight gate (§1.6)** | The 10-item binding checklist every build spec reconciles (scoped to touched files) before firing: story · hardcoded-register · validation · CRUD-with-permissions · UI/modals · AC-1..4 · 12-fn ceiling · reuse-don't-fork · TRACE-stays-on · money-safety. "Not reconciled = not ready to fire." | [CLAUDE.md](../CLAUDE.md) §1.6 |

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

## 4b. CHECKOUT / ORDER-FLOW WORKFLOWS

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **Transport / netting / decline workflow** | Transport is a single-select 3-branch radio — (1) Delivery + planting = delivery (flat ×1) + planting (per_unit ×N); (2) Delivery only = delivery (flat ×1); (3) No thank you (self) = no charge + netting/tarp offer with red-border Ch.725 compliance prompt; a decline is CAPTURED (orders.netting_declined + order_compliance_records). Originally built + owner-proven May-18; regressed by the multi-item rewrite; restored 2026-07-08. Reads delivery + planting as TWO correctly-ruled `service_offerings` rows (FLAGs if not present; data reshape is the separate Settings-editor task). ZERO migration, ZERO new `api/` file. | [docs/specs/SPEC-transport-netting-decline-workflow-2026-07-08.md](specs/SPEC-transport-netting-decline-workflow-2026-07-08.md) | 2026-05-18 (built) / 2026-07-08 (restored) | **DECIDED** · restored BUILDER-COMPLETE (owner-proof owed) |

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
| **Purchase-off-stock-line vs `cultivar_plants` (the drift)** | Purchase resolution still anchored to per-specimen `cultivar_plants`. | **BUILDER-COMPLETE (M2 GATED) 2026-07-07** — [[D-34]] settles the target; [buildspec item 2](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) BUILT: shared `packages/shared/src/inventory/stockLineResolver.ts` (agnostic ladder, consumed by both InventoryCount + usePlant) + `usePlant` fallback + `plant.stock_line_id` discriminator + `submit.ts` one-anchor write + **M2** `20260707_order_items_stock_line_anchor.sql` (`business_inventory_id` + `plant_id` nullable, GATED — David applies). `npm run verify` zero net-new; owner-proof owed. |
| **R-QBSTALE — edited order → QuickBooks invoice** | Order roster CRUD (2026-07-08, ledger #100) lets owner/manager edit a SUBMITTED order → totals recompute. The order's existing QB invoice is now out of date. Current behavior: the edit SURFACES staleness (`qbStale:true` + a UI banner "re-sync in QuickBooks") but does NOT auto re-sync. | **OPEN — needs David.** Options: (a) leave the surfaced banner (owner re-syncs manually — current), (b) auto re-issue/void+recreate the QB invoice on edit (rides `qbo/invoice/cultivar`, no new fn). Same family as the pay-at-office-also-fires-QBO flag (R3, ledger #99). |
| **R-STATUS — order status lifecycle enum** | `orders.status` is a live-only text column with NO CHECK; before #100 nothing moved it off `pending`. #100 added a minimal `pending→confirmed→fulfilled→cancelled` lifecycle (`lib/orderStatus.ts`, ONE source; server-validated) so owner/manager can transition an order; 'cancelled' currently auto-releases reserved inventory. | **OPEN — needs David.** Ratify (a) the status set (is 4 states right? any missing — e.g. `paid`, `out_for_delivery`?), (b) whether cancel should auto-release (currently yes) and whether un-cancel should auto-re-reserve (currently NO — edit to restock). A DB CHECK constraint can follow ratification. |

**Reconciliation note (updated 2026-07-07):** all three former open items are now closed as
*decisions*. SELL PRICE became **D-35**. The two lifecycle/purchase items were always
downstream of the June-13 "lot is the SKU" decision (now first-class **D-34**) — the DECISION
existed; the CODE drifted — and are now sequenced in the consolidated build spec
([2026-07-07-inventory-sale-pipeline-buildspec.md](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md)).
What remains is BUILD, not DECIDE. **UPDATE 2026-07-08 (ledger #100):** two genuinely-open decisions were added below the reconciled rows — **R-QBSTALE** (edited-order QB re-sync) and **R-STATUS** (order status enum ratification) — both surfaced by the order-roster-CRUD build; neither is settled.
