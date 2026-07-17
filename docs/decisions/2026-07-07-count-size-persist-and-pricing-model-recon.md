# RECON — Count-size persist & Pricing model

**Date:** 2026-07-07 · **Type:** READ-ONLY recon (nothing changed) · **Author:** Thunder
**Source:** David's live CSVs (2026-07-07) — two confirmed gaps.

Session Starter checks passed (date 2026-07-07, branch main, PLATFORM_STATE.md present,
only the 3 known untracked recon docs). Did not touch ignition-os / old Supabase / QB oauth.ts.

---

## GAP 1 — COUNT-SIZE PERSIST

### R1a — The count write path writes `qty` only, never `size`

The count loop is fully client-side in `packages/cultivar-os/src/pages/InventoryCount.tsx`
(via the shared `SyncEngine`; no server action). When a scan resolves, `commitCount` writes
on-hand back:

```ts
// InventoryCount.tsx:377-384
if (resolved.inventoryId) {
  const res = await engine.update({
    table: 'business_inventory',
    set:   { qty },                                    // ← ONLY qty
    match: { id: resolved.inventoryId, business_id: businessId },
  });
}
```

There is **no write of `business_inventory.size` anywhere in the count flow.** `size`
participates only in *row selection* (which lot the picker points at) — never in the write
set. So even a perfectly-resolved sized count leaves `business_inventory.size` untouched.

Where size *can* persist today: only the desktop datasheet `BusinessInventory.tsx:130,184`
(inline `TextCell` → immediate `UPDATE` of `size`/`variant_group`) and the discovery
`populate.ts:127` per-size row insert. The count loop was **never wired to author size** —
that is the core mismatch.

### R1b — The `was_unknown` path drops qty+size entirely (never reaches business_inventory)

`saveUnknown` (`InventoryCount.tsx:428-454`) records into `inventory_counts` with
`inventory_id: null, was_unknown: true` and **does not touch `business_inventory` at all** —
no qty write, no size write. It's a flag-for-later log only.

This is exactly what happened to David's sized Vitex scans: `item_label` "45 gal"/"45",
`was_unknown=true`, `inventory_id` blank. The qty and the size text he typed were logged to
the count record and **lost to business_inventory**. Confirmed.

### R1c — The size-picker never creates or writes a sized row; it only routes to a pre-existing one

`detectSizeCollision` (`InventoryCount.tsx:103-111`) fires **only when ≥2
`business_inventory` rows already share one non-null `variant_group` with distinct non-empty
`size` values.** On pick, `pickSize` (`:341-346`) calls `openReview(c.resolved)` → the qty
write lands on that **existing per-size row**. It does **not** create a per-size row and does
**not** write `size`.

Per the handoff, per-size catalog population is GATED and the `size` column is empty across
the demo catalog. **No per-size rows exist → the picker is inert → it can't be what captured
David's sizes.** The size-picker is not the bug; it's dormant for lack of the rows it needs.

### R1d — Root cause: name-resolution (i) drops sized scans to UNKNOWN; and the write path (ii) never writes size anyway. (iii) is a non-factor.

Two independent failures compound:

**(i) — the dominant cause — L4 token-set EQUALITY rejects a scan that carries a size token.**
The name resolver (`InventoryCount.tsx:271-278`) matches on
`tokenSetsEqual(nameTokenSet(row.name), nameTokenSet(tag))`. For a sized scan:

- `nameTokenSet("vitex-shoal-creek 45 gal")` = `{vitex, shoal, creek, 45, gal}`
- `nameTokenSet("Shoal Creek Vitex")` = `{shoal, creek, vitex}`

Extra tokens `45`/`gal` → sets **not equal** → no match → falls through L1/L2/L4 to
**UNKNOWN** (`:323-329`). That's why the sized Vitex scans landed in the `was_unknown=true`,
blank-`inventory_id` bucket (per R1b, dropped).

**(ii) — the secondary cause — even a resolved count never writes size.** The plain-slug
scans that *did* resolve (`item_label` "Shoal Creek Vitex (SKU DISC-1105)") matched the
single sizeless DISC-1105 row via L4 equality (or L2 SKU), set `qty` on `dfe50b45…`, and —
per R1a — **never wrote size.** So `business_inventory.size` stays blank on both paths.

**(iii)** the size-picker write-back is not implicated (inert, R1c).

**Shortest honest fix shape (GAP 1):** the count loop needs to become size-aware in two
places — (a) resolution must not dump sized scans to UNKNOWN (strip/recognize a trailing
size token so the scan resolves to the variety, then offer size entry/picker), and (b) the
count must **persist size to `business_inventory`** — either by writing `size` onto the
resolved row, or by upserting a per-size sibling row (the intended `variety × size` model).
Note the cleaner architectural path already half-exists: per-size rows are meant to be
authored by populate/the desktop datasheet, and counts route to them via the picker — so an
alternative fix is to unblock per-size population and treat the count loop as
read-and-set-qty only. **Decision for David:** which surface owns size authoring; today
**none of them does during a count**, which is the data-loss.

---

## GAP 2 — PRICING MODEL

### R2a — No sell/retail price field exists. `business_inventory` carries `unit_cost` only.

`20260612_business_assets_inventory_pmi_service.sql:97-113` defines `business_inventory`
with `unit_cost numeric(10,2)` (what David paid) and **no** `sell_price`/`retail_price`/
`base_price`. A migration grep across all of `supabase/migrations/` finds no such column
anywhere. (The old `cultivar_plants.base_price`/`install_price` were **dropped**, not
relocated — `20260613_cultivar_plants_untangle.sql:65-66`.) There is no stored sell price
and, per R2c, none computed at read either.

### R2b — Cost-to-Produce computes a suggested price but writes nothing and the cart reads nothing from it

`packages/cultivar-os/src/pages/CostToProduce.tsx` is a read-only analysis tile — its own
header says **"No DB writes"** (`:27`). It reads `business_inventory (unit_cost,
cost_confidence)` + the `business_modules` config and produces a price-sensitivity table.
The config (seeded `20260614_cost_to_produce_trace_seed.sql:41-55`): margin `baseline 0.40`,
tiers `walk-in 0.40 / friends-family 0.20 / contractor 0.30`, `priceReference 149`,
`overheadPerUnit 0`. **None of this is written back to inventory and none of it is read by
the cart.** It is a dead-end analysis surface.

### R2c — The cart charges `unit_cost` directly, falling back to $0 when null

The customer-facing plant price is cost-of-goods, not a sell price:

- Display: `const plantSubtotal = (plant.business_inventory?.unit_cost ?? 0) * quantity`
  — `AddOns.tsx:70`, `CartReview.tsx:57`.
- Charged (server-authoritative, anti-tamper): `submit.ts:89-107` re-reads
  `business_inventory.unit_cost` and charges `serverUnitCost * quantity`, with
  `Number(...?.unit_cost ?? 0)`.

So **if `unit_cost` is NULL (as it is for Vitex), the customer is charged $0 for the plant.**
The code even admits the misuse at `submit.ts:85`: *"unit_cost is the nursery's per-plant
price on this surface … see grower-import sell_price gap."* Only the plant is mispriced this
way — transport/netting/addons carry their own `.price` from the `service_offerings` table.

### R2d — Contractor/wholesale tier exists as data only; nothing consumes it at pricing time

`customers.price_tier` (values `retail | wholesale | contractor`, default `retail`) exists —
`20260625_person_spine.sql:106` — and is **displayed** in `Customers.tsx:141-142`. But a grep
shows it is **never read by the cart or `submit.ts`** — no discount is applied anywhere. The
`contractor` marginOverride (0.30) lives only in the Cost-to-Produce analysis config (R2b),
not in checkout. **Tier = built at the data layer, not-built at the pricing layer.**

### R2e — Verdict: there is no cost→price→sell pipeline. The sell price is a genuine GAP.

The cart has no real sell-price source: it charges cost-of-goods (`unit_cost`), applies no
margin/overhead, and shows $0 when cost is null. Cost-to-Produce produces a sell price but
writes nothing and feeds nothing. The contractor/wholesale tier is inert data. The three
pieces David expects (cost + margin + overhead → sell price → cart, with a tier discount)
exist as **disconnected fragments**, not a pipeline.

**Shortest honest fix shape (GAP 2):** give the cart a real sell-price source and wire the
tier —

1. **Source:** add a `sell_price` (retail) column on `business_inventory`, *or* compute it
   from the existing Cost-to-Produce config (`sell = unit_cost / (1 − margin) +
   overheadPerUnit`). Stored is simpler and demo-safe; computed keeps one source of truth
   but needs the config reachable at checkout.
2. **Repoint the cart:** the three reads (AddOns display, CartReview display, `submit.ts`
   server-authoritative charge) read `sell_price` instead of `unit_cost` — and refuse/flag
   rather than silently charging $0 when it's missing (Surface Honesty).
3. **Tier:** at checkout, read the resolved customer's `customers.price_tier` and apply the
   matching margin override (retail/contractor/wholesale) — the column and the override
   values already exist; only the consumption is missing.

Both fixes are small and mechanical; the hard part is the decision (size authoring surface
for GAP 1; stored-vs-computed sell price for GAP 2), which is David's call.

---

## Evidence index (files read, read-only)

| Concern | File:line |
|---|---|
| Count write path (qty only) | `packages/cultivar-os/src/pages/InventoryCount.tsx:377-384` |
| L4 token-set equality resolve | `InventoryCount.tsx:271-278` → UNKNOWN `:323-329` |
| was_unknown log path | `InventoryCount.tsx:428-454` |
| size-picker (inert) | `InventoryCount.tsx:103-111, 341-346` |
| size CAN persist (desktop only) | `BusinessInventory.tsx:130,184`; `populate.ts:127` |
| size column schema | `supabase/migrations/20260628_inventory_size_variants.sql` |
| business_inventory schema (unit_cost only) | `20260612_business_assets_inventory_pmi_service.sql:97-113` |
| cart price = unit_cost ?? 0 | `AddOns.tsx:70`; `CartReview.tsx:57` |
| server charge = unit_cost ?? 0 + admission | `api/orders/submit.ts:85-107` |
| Cost-to-Produce (no DB writes) | `CostToProduce.tsx:27,81`; config `20260614_cost_to_produce_trace_seed.sql:41-55` |
| price_tier column (data only) | `20260625_person_spine.sql:106`; `Customers.tsx:141-142` |
