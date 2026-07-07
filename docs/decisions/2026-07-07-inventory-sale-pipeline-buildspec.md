# CONSOLIDATED BUILD SPEC — Inventory → Sale Pipeline (make a tree sellable end-to-end)

**Date:** 2026-07-07 · **Type:** BUILD SPEC (for David's review — **no code, no schema written this pass**)
**Author:** Thunder (Claude Code) · **For:** David

**What this is:** the ONE spec that makes a tree sellable end-to-end, built strictly FROM the
recorded decisions — not re-litigating them. Five ordered work items, each scoped (files,
migration y/n, function-ceiling impact, TRACE emit), each tagged **DEMO-CRITICAL** or
**POST-DEMO**. DO NOT BUILD from this yet — it's for review.

---

## GROUNDING — the decisions this spec is built FROM (cited, not re-argued)

| # | Decision | Home | What it fixes here |
|---|---|---|---|
| **Size model = B-clean** | One `business_inventory` row per **variety × size**; `size text` (grower's own value, no CHECK) + `variant_group text` (parent slug). Migration `20260628_inventory_size_variants.sql` **applied**. | [2026-06-27-discovery-size-variants.md](2026-06-27-discovery-size-variants.md) + [2026-07-07-size-variant-build-state-recon.md](2026-07-07-size-variant-build-state-recon.md) | The row shape every item below writes to. |
| **D-34** The LOT is the SKU — lot-level history, `cultivar_plants` is identity-only. | [DECISIONS.md](../DECISIONS.md) D-34 + `20260613_cultivar_plants_untangle.sql:4-11` | Purchase + history anchor to the stock line, not per-pot. |
| **D-35** Sell price STORED on the stock line (`business_inventory.sell_price`), engine suggests but the stored price governs; cart refuses $0; `price_tier` applies at checkout. | [DECISIONS.md](../DECISIONS.md) D-35 | The whole pricing pipeline (item 1). |
| **QR → variety, size is a pick-step** | Pot QR encodes `${baseUrl}/plant/${tag_id}` → variety resolves; size chosen at count/checkout via the size-picker. | [2026-06-26-grower-resolve-design.md](2026-06-26-grower-resolve-design.md); front-door in [2026-07-07-qr-order-front-door-recon.md](2026-07-07-qr-order-front-door-recon.md) | Purchase resolution (item 2), count resolution (item 4). |
| **Lifecycle events** (June-5 / June-13 design) | Stages are dated, cost-bearing EVENTS on the lot; timeline shows accumulated cost basis vs sale price. | [2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md](2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md) §R1 | Timeline re-anchor (item 5). |

**Constraint held throughout:** Vercel Hobby **12-function ceiling — currently 12/12, zero headroom**
(CLAUDE.md §6 rule 11, tech-debt #41). **No item below mints a 13th `api/` function** — every
change edits an existing surface (client code, or the existing `submit.ts` / datasheet). Confirmed
at the end.

---

## THE SPEC — five ordered work items

Sequence rationale: **1 → 2 → 3 → 4** is the demo-critical chain (a tree needs a price → a QR must
resolve to a sellable lot → the demo tenant needs sized+priced rows → a phone count must persist
what it captures). **5** (lifecycle timeline) is the margin-story payoff and is **POST-DEMO**.

---

### ITEM 1 — SELL_PRICE (D-35) — **DEMO-CRITICAL**

**Why first:** nothing sells for a real amount until this exists. Today the cart reads `unit_cost`
(NULL on all rows) → customer sees **$0.00** and the order writes total $0 with **no block**
(recon GAP-2). D-35 fixes the source of truth.

**1a — Schema (migration; David applies):**
`ALTER TABLE business_inventory ADD COLUMN sell_price numeric(10,2)` (nullable). Additive, lossless,
no CHECK. DISTINCT from `unit_cost` (cost, from receipts). *Migration → the master list below.*

**1b — Entry UI (no migration, no function):** add `sell_price` to the desktop inventory datasheet
`packages/cultivar-os/src/pages/BusinessInventory.tsx` — it already inline-edits `size`/`variant_group`
via `TextCell` → immediate `UPDATE` (lines ~130/184); `sell_price` is one more editable column on the
same mechanic. The MarginEngine SUGGESTS (show a computed hint from `unit_cost + margin + overhead`)
but the typed value is what's stored and governs (D-35).

**1c — Cart reads `sell_price`, never `unit_cost` (no migration, no function):** repoint the three
reads —
- `packages/cultivar-os/src/pages/AddOns.tsx:70` (display subtotal),
- `packages/cultivar-os/src/pages/CartReview.tsx:57` (display),
- `packages/cultivar-os/api/orders/submit.ts:~89-107` (server-authoritative charge)
— from `unit_cost` → `sell_price`. **REFUSE / flag a $0-or-null sale** (Surface Honesty, D-9) instead of
silently charging $0: `submit.ts` returns a clear "this lot has no sell price set" error; the cart
surfaces it rather than completing a $0 order.

**1d — Tier at checkout (no migration, no function):** `submit.ts` reads the resolved customer's
`customers.price_tier` (`retail | contractor | wholesale` — column exists, `20260625_person_spine.sql:106`)
and applies the matching tier adjustment. The override values live in the Cost-to-Produce config today
(`walk-in / friends-family / contractor`); wire the consumption that's missing.

**Scope:** files `BusinessInventory.tsx`, `AddOns.tsx`, `CartReview.tsx`, `api/orders/submit.ts` · **migration: YES** (1a) · **function ceiling: no new function** (edits existing `submit.ts`) · **TRACE emit:** `[TRACE:PRICE]` on datasheet write + on cart read/refuse + on tier application.

---

### ITEM 2 — PURCHASE-OFF-STOCK-LINE (fix the D-34 drift) — **DEMO-CRITICAL**

**Why:** the real 114-row catalog lives in `business_inventory` with **zero `cultivar_plants` rows**, but
`usePlant` queries `cultivar_plants` only and returns **"Plant not found"** with no fallback (recon
[qr-lifecycle-and-stock-line-purchase-recon] R2). The June-13 untangle (D-34) moved *stock* to
`business_inventory` but left *purchase resolution* on per-specimen `cultivar_plants` — decided model,
drifted code. This makes the real catalog sellable.

**2a — `usePlant` fallback ladder (no migration, no function):**
`packages/cultivar-os/src/hooks/usePlant.ts` — on `cultivar_plants` miss, resolve `business_inventory`
by sku / tag / name (+ size-picker) and synthesize a plant-shaped object (name, size, `sell_price`,
`qty`, `status`). This resolver is a **semantic-dup of `InventoryCount`'s resolver** → **extract ONE
shared resolver** and use it in both (CLAUDE.md §6 rule 8 — do not write a second copy).

**2b — `submit.ts` price off the stock line (no migration beyond 2c):** fetch price off
`business_inventory.sell_price` directly (item 1 already repoints it); take size/container from
`business_inventory.size`, not `plant.current_container`, for the leakage flag.

**2c — `order_items` schema (migration; David applies — the sticky bit):** add nullable
`order_items.business_inventory_id` and make `plant_id` nullable, so an order line can reference the
stock line (design-aligned option 3a from the recon — chosen over the expedient "mint a
`cultivar_plants` row on demand," which would re-introduce the per-specimen rows D-34 abandoned).
**⚠️ `order_items` is live-only (tech-debt #39) — author this migration FROM the live schema first**
(see [2026-07-07-live-schema-map.md](2026-07-07-live-schema-map.md)), not from version control.

**Scope:** files `usePlant.ts`, new shared resolver module (+ `InventoryCount.tsx` re-point), `api/orders/submit.ts` · **migration: YES** (2c, author from live schema) · **function ceiling: no new function** · **TRACE emit:** `[TRACE:RESOLVE]` on the fallback ladder + which lane resolved.

---

### ITEM 3 — SIZED + PRICED DATA on the demo tenant (safe fill) — **DEMO-CRITICAL**

**Why:** the demo tenant `f7ec5d67…` ("Test Dave's Tree Nest") is stale — pre-#62, **0 of 111 rows have a
`size` and 0 have a `sell_price`** (recon GAP-2, sell-price-answers-plain §3). The size-picker and the
sized-count flow are inert for lack of rows.

**Data-safety (recon'd):** a full discovery **re-populate is clear→rewrite** — `clearDiscovery` wipes all
`DISC-%` rows first — so it **WOULD clobber** any hand-entered `qty`/`size`. Do **NOT** re-populate.

**3 — Safe backfill (data step, service key; David runs):** backfill Vitex into per-size rows —
`5 / 15 / 30 / 45 gal`, all sharing `variant_group='shoal-creek-vitex'` — **without destroying
hand-entered data** (targeted upsert of the sibling rows, not a clear-and-rewrite), and set `sell_price`
per size. This gives the size-picker its ≥2 same-`variant_group` distinct-`size` rows to fire on, and
gives the cart a real price to read.

**Scope:** a data/seed step (service-key script, idempotent, targeted — no clear), not app code · **migration: NO** (data only; depends on item-1 `sell_price` column existing) · **function ceiling: n/a** · **flag:** **David runs the data step with the service key.** · **TRACE emit:** n/a (data step).

---

### ITEM 4 — COUNT-SIZE PERSIST (the confirmed data-loss bug) — **DEMO-CRITICAL**

**Why:** David's sized "Vitex 45 gal" scans landed `was_unknown=true`, `inventory_id=null`, size surviving
only as throwaway `item_label` text (recon [count-size-persist] R1). Two compounding failures: (i) the L4
name resolver rejects any scan carrying a size token (`{vitex,shoal,creek,45,gal}` ≠ `{shoal,creek,vitex}`
→ UNKNOWN), and (ii) even a resolved count **writes `qty` only, never `size`** (`InventoryCount.tsx:377-384`).

**4a — Resolver recognizes a trailing size token (no migration, no function):** the shared resolver
(from item 2a) strips/recognizes a trailing size token so a sized scan resolves to the **variety**, then
offers the size pick-step (per the QR-→-variety decision). Fixes failure (i).

**4b — Count persists size (no migration, no function):** on commit, write `business_inventory.size`
onto the resolved row (or route to / upsert the sized sibling per the variety×size model). Fixes failure
(ii) — the count loop finally authors size, which today **no surface does during a count**.

**Cite:** [2026-07-07-count-size-persist-and-pricing-model-recon.md](2026-07-07-count-size-persist-and-pricing-model-recon.md) §GAP-1.

**Scope:** files `InventoryCount.tsx` + the shared resolver (item 2a) · **migration: NO** (`size`/`variant_group` columns already applied, `20260628`) · **function ceiling: no new function** (count loop is client-side via `SyncEngine`) · **TRACE emit:** `[TRACE:COUNT]` extended — size-token recognized, size written.

---

### ITEM 5 — LIFECYCLE-TO-LOT (D-34 + June-5 design; drifted) — **POST-DEMO**

**Why:** the timeline mechanism exists (`plant_events` table + `PlantTimeline.tsx`) but is anchored
per-specimen (`plant_id`) with **no cost dimension**, so it's empty for the entire real catalog and can't
render the "margin story Excel can't tell" (recon R1). This is the payoff, not the prerequisite — **flag
POST-DEMO** (does not fit the Aug-4 window; the sale completes without it).

**5a — Re-anchor events to the stock line (migration; David applies):** re-anchor `plant_events` from
`plant_id` → the `business_inventory` stock line / `variant_group` (lot-level per D-34).

**5b — Add cost-basis columns (same migration):** add `cost_in` / `qty_at_stage` / `value` so the timeline
can show accumulated cost basis vs sale price.

**5c — Re-point the timeline (no migration, no function):** `PlantTimeline.tsx` reads lot events instead
of per-specimen — **~80% reusable** per the recon.

**Scope:** files `PlantTimeline.tsx`, `usePlant.ts` (events read) · **migration: YES** (5a+5b, one migration) · **function ceiling: no new function** (events read is client-side) · **TRACE emit:** `[TRACE:TIMELINE]` on lot-event render.

---

## DEMO-CRITICAL vs POST-DEMO (the split)

| Item | Tag | One line |
|---|---|---|
| 1 · SELL_PRICE | **DEMO-CRITICAL** | No real sale without it — cart is $0 today. |
| 2 · Purchase-off-stock-line | **DEMO-CRITICAL** | The real 114-row catalog returns "Plant not found" until this lands. |
| 3 · Sized + priced demo data | **DEMO-CRITICAL** | Depends on item 1's column; makes the picker + cart live on the demo tenant. |
| 4 · Count-size persist | **DEMO-CRITICAL** | The confirmed data-loss bug on the phone count. |
| 5 · Lifecycle-to-lot timeline | **POST-DEMO** | The margin-story payoff; sale completes without it. |

**Build order:** 1 → 2 → 3 → 4 (demo chain), then 5 after the demo. Item 3 depends on item 1's
`sell_price` column; item 4's resolver reuses item 2's shared resolver — so 1 and 2 lead.

---

## ALL MIGRATIONS IN ONE PLACE (David applies each)

| # | Item | Migration | Notes |
|---|---|---|---|
| M1 | 1a | `ALTER TABLE business_inventory ADD COLUMN sell_price numeric(10,2)` (nullable) | Additive, lossless. |
| M2 | 2c | `ALTER TABLE order_items ADD COLUMN business_inventory_id …` (nullable FK) + `plant_id` nullable | **`order_items` is live-only (tech-debt #39) — author FROM the live schema first**, then version-control the migration. |
| M3 | 5a+5b | `plant_events` re-anchor to stock line + add `cost_in` / `qty_at_stage` / `value` columns | **POST-DEMO.** One migration. |

**Plus one non-migration data step:** item 3 — safe Vitex sized+priced backfill (service key, targeted
upsert, **no clear**). **David runs it.** Depends on M1.

Every migration is **GATED** — David applies as `postgres`, then the schema-verification gate (CLAUDE.md §9)
runs catalog-backed proof before the item is BUILDER-COMPLETE.

---

## FUNCTION CEILING — 12/12 HELD ✅

Confirmed the deployed `api/` directory holds exactly **12 functions** (campaigns · customers/create ·
dashboard · discovery/ingest · members/invite · orders/submit · pmi/suggest · qbo-connector ·
qbo/invoice/cultivar · receipts/ocr · social/enable · social/generate-posts). **No item in this spec
adds a 13th.** Items 1, 2, 4, 5 edit existing surfaces (`submit.ts`, client hooks/pages); item 3 is a data
step. The ceiling is not touched.

---

## Evidence index (recons this spec is built on)

| Concern | Doc |
|---|---|
| Sell-price gap + cart-$0 + tier-inert | [2026-07-07-count-size-persist-and-pricing-model-recon.md](2026-07-07-count-size-persist-and-pricing-model-recon.md) §GAP-2 · [2026-07-07-sell-price-answers-plain.md](2026-07-07-sell-price-answers-plain.md) |
| Count-size persist bug | [2026-07-07-count-size-persist-and-pricing-model-recon.md](2026-07-07-count-size-persist-and-pricing-model-recon.md) §GAP-1 |
| Purchase-off-stock-line + lifecycle drift | [2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md](2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md) |
| Live schema (order_items, tech-debt #39) | [2026-07-07-live-schema-map.md](2026-07-07-live-schema-map.md) |
| Size-variant build state | [2026-07-07-size-variant-build-state-recon.md](2026-07-07-size-variant-build-state-recon.md) |
| Decisions this is grounded in | [DECISIONS.md](../DECISIONS.md) D-34, D-35, D-16, D-9 |

*Spec only — nothing built. For David's review.*
