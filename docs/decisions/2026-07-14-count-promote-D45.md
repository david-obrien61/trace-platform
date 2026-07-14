# D-45 (proposed) — Count-commit PROMOTES size + qty into a variant_group-keyed business_inventory row

**Date:** 2026-07-14 · **Author:** Thunder · **Status:** proposed (confirm the DECISIONS.md head, then assign D-45)
**Type:** app-code build (ONE file `packages/cultivar-os/src/pages/InventoryCount.tsx`) + ONE gated DATA backfill. **ZERO migration, ZERO new api-fn (12/12 held).**
**Ledger:** CLOSE-OUT-LEDGER row #124 · **Story:** MAPS-TO 2.3 (count-size-persist — buildspec item 4, never shipped; + the "Count-side size-picker" sub-story)

---

## The problem — a broken capture→persist→read seam

Inventory has THREE surfaces and they were not connected:

- **Count CAPTURES** size + qty → wrote **`inventory_counts` only** (`InventoryCount.commitCount` set `business_inventory.qty` **only** on an already-linked lot, and `saveUnknown` wrote `inventory_id: null` — never `size`, never `variant_group`, never a new row).
- **Order picker + inventory grid READ** `business_inventory` (name / size / variant_group / qty / sell_price).

So counted size/qty never reached the surfaces that read inventory. David saw **one Vitex size after scanning several**, and his "45 gal" scans stranded as `was_unknown=true` rows in `inventory_counts`. `variant_group` was READ by `stockLineResolver` (the size-picker gate) but **no UI ever WROTE it** — null everywhere → the picker could never fire.

## The decision

**On count-commit, PROMOTE `size` + `qty` into a `variant_group`-keyed `business_inventory` row (create-or-update).** Both stores are written: `business_inventory` (canonical on-hand — STD-011) **and** `inventory_counts` (append-only count history). This closes the count-size-persist bug AND the `variant_group` orphan-read in one build.

### Model (decided with David)

- **QR is PER-VARIETY** (same QR for all sizes). A scan yields a variety **slug** (`extractTag` → e.g. `vitex-shoal-creek`). The counter then picks/enters **which size** they're counting.
- **`variant_group` KEY** = an existing sibling's shared group (adopt — don't fragment) ?? the scanned **QR slug** ?? `slugify(typed name)` (no QR). This is the same **product-slug** convention `populate` uses (`item.sourceSlug`), so scrape-created and count-created rows converge on one group per variety.
- **Each (variety × size) = ONE `business_inventory` row** (name, size, variant_group, qty, sell_price).
- **MATCH by (variety × size):** found → **SET qty** (a physical count SETS on-hand — reconcile semantics, NOT a decrement; coexists with D-42 decrement-on-paid) + backfill `variant_group` so the size-picker fires next time; **not found → CREATE** the row. `sell_price` is **omitted → null = needs-price** (the cart refuses rather than selling at $0 — D-9 omit-not-fake); `cost_confidence = 'UNKNOWN'`.
- **RESOLVE-BEFORE-CREATE (no-QR path):** the typed name routes through `resolveStockLine` (the #61 token-set resolver, §6 r8 reuse) to match an EXISTING variety before minting a new group — so varied spellings of one variety don't orphan into three. **Boundary (honest, D-9):** EQUALITY handles case / word-order / punctuation / separator variance; extra words + plural stemming ("Big Boy" vs "Big Boy Tomato" vs "tomatoes") are the deferred L5-subset / L6-stemming layers and still mint a distinct variety. Two ungrouped same-name siblings → ambiguous → **record-only + flag** (never a 3rd orphan; the backfill SQL fixes the data).
- **`size` is a FREE LABEL** spanning single-plant (4", 30 gal) AND multi-unit (flat, tray). **qty is stored VERBATIM (unit-agnostic) — we do NOT assume qty = plant count.**

### Size is captured in the review sheet

The L5 size-picker is **folded into the review size-control** (chips for existing sizes + a free-text field for a new one), superseding the separate `picker` phase from #72 (re-owner-prove owed). A single-size variety shows one chip + the field; a multi-size variety shows all its sizes as chips.

## HOOK — per-size unit-multiplier (NAMED, NOT built)

A future column (e.g. `units_per_size`) lets a multi-unit size ("flat" = N plants) convert counted-units → plant-count for reconciliation/valuation. **Not built** (trees are single-plant; the demo doesn't need it). qty is stored verbatim and the create/read boundary is where the multiplier attaches — no reshape of the count loop required. This decision deliberately does **not** hardcode `qty = plant count`.

## Constraints held

- **STD-011** — `business_inventory` is the canonical on-hand fact; counts promote INTO it (not a parallel store).
- **AC-1 / AC-3** — generic `business_inventory` (no vertical noun); every write `business_id`-scoped, RLS-gated (view_costs).
- **§6 r8** — reuses `resolveStockLine` / `nameTokenSet` / `extractTag` / `SyncEngine`; no forked logic.
- **§6 r11** — no new `api/` function (rides the client SyncEngine count path; 12/12 held).
- **D-9** — new-size rows are born needs-price (sell_price null → cart refuses), never $0; ambiguous typed entries are flagged, never guessed.
- **STD-003** — `[TRACE:INVENTORY]` on every promote (variety, group, size, qty, created|updated|record-only), ON until owner-proven.
- **Money-safety** — count SETS on-hand (not a sale); no pricing computed here.

## Data cleanup — gated backfill

David's existing rows have `variant_group = NULL`. The count-promote grouped them in-flow when a variety is counted, but a variety that already has ≥2 ungrouped size-siblings scans ambiguous → UNKNOWN and can't auto-backfill. **`docs/decisions/2026-07-14-variant-group-backfill.sql`** (GATED — David reviews Step A, runs Step C per true multi-size variety). Different varieties get different slugs — **"Shoal Creek Vitex" and "Flip Side Vitex" are DIFFERENT varieties and do NOT group together.**

## Owner-prove (David, live)

1. Scan Vitex QR → enter "30 gal" count 45 → `business_inventory` has Shoal Creek Vitex / 30 gal / `variant_group = vitex-shoal-creek` / qty 45.
2. Scan same QR → enter "45 gal" count 12 → a SECOND row, same group, size 45 gal, qty 12.
3. Order / add → BOTH sizes appear as pickable options at their prices (order-side picker fires — `variant_group` matches).
4. The inventory grid shows both sizes under the variety.
5. A name-typed variety with no QR, entered twice with slightly different spelling → resolves to ONE variety (not two orphans).
6. Apply the backfill SQL → existing Vitex row groups correctly.

`[TRACE:INVENTORY]` stays ON until owner-proven.
