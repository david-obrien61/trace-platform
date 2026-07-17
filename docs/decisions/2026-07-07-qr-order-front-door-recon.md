# RECON — QR → Order Front Door (walk-up, not-logged-in customer)

**Date:** 2026-07-07 · **Type:** READ-ONLY recon, nothing changed · **Tenant in question:** f7ec5d67 ("Test Dave's Tree Nest")
**Question:** What does a pot's QR resolve to, and is there a public path from *scan → tree info → add-to-cart → checkout → QB*? Why is there "no available option to order a tree" on f7ec5d67?

## TL;DR

**The front door is fully built and PUBLIC. The blocker is DATA, not code** — specifically the missing `cultivar_plants.inventory_id` link. A plant's QR resolves to a public tree page with an "Add to cart" button, but that button only appears when the plant is joined (via the `inventory_id` FK) to a `business_inventory` lot with `status='available'`. On f7ec5d67 no such shoppable, QR-scannable plant row exists.

- Fix is a **data/seed-script change David runs with the service key** — no migration, no new Vercel function (stays 12/12).
- The whole cart/checkout/services/QuickBooks machinery is confirmed built and works anonymously.

---

## R0 — What the QR resolves to (the crux)

| Fact | Evidence | Verdict |
|---|---|---|
| QR encodes `${baseUrl}/plant/${plantId}` where `plantId` = `cultivar_plants.tag_id` | `packages/shared/src/qr/generate.ts:24` | ✅ public URL |
| Route `/plant/:tagId` → `PlantProfile`, in the **PUBLIC block outside `PrivateRoute`/`AppLayout`** | `packages/cultivar-os/src/router.tsx:85` | ✅ no login |
| RLS permits anon reads: `cultivar_plants` policy `anon_select_plants USING(true)` | migration `20260613_cultivar_plants_untangle.sql` | ✅ walk-up reads fine |
| Page has a Purchase action: "Add to cart — $X" → `setItem(plant, qty)` → `/plant/:tagId/addons` | `PlantProfile.tsx:81` | ✅ built |

**Two caveats:**
1. **QR generation is NOT wired to any UI.** `generatePlantQR()` / `printPlantLabel()` exist in `packages/shared/src/qr/` but there's **no `/plants` page and no in-app print** (Help.tsx flags this). Today QR sheets are made manually / server-side. No in-app way to *mint* a plant's QR.
2. **The tree page is minimal, not the rich "LAWNS-site" page David envisions.** Shows photo-or-emoji, name, container/age/warranty, price, event timeline. `photo_url` is usually null. Footer **hardcodes "LAWNS Tree Farm"** (tech-debt #4), not tenant-aware for f7ec5d67.

---

## R1 — Can an unauthenticated customer reach the cart? YES

All five flow routes sit **outside `PrivateRoute`** (`router.tsx:85-89`):

```
/plant/:tagId → /plant/:tagId/addons → /checkout/customer → /checkout/review → /checkout/confirm
```

- Cart is **anonymous** — Zustand store `useCart`, no auth/session tie.
- **Two structural limits on the "keep scanning and shopping" vision:**
  - **Single-item cart** — `setItem(plant, qty)` *replaces* the cart; it holds **one plant at a time**, not a growing basket.
  - **In-memory only, not persisted** — survives in-app navigation, but a **new physical QR scan is a fresh page load** → the store resets → prior item lost. Multi-scan accumulation does not hold today.

---

## R2 — Confirmed built machinery (all real)

| Piece | File | Status |
|---|---|---|
| Cart / add-ons / services (reads live `service_offerings`, `timing='at_checkout'`; netting compliance-gated + declinable) | `useServices.ts`, `AddOns.tsx` | ✅ built |
| Checkout w/ delivery / delivery+planting / self options adding cost (per-unit vs flat) | `CartReview.tsx` | ✅ built |
| Order submit — **server-authoritative pricing** (re-fetches `unit_cost` + `tax_rate`, defeats client tamper), writes `orders`/`order_items`/`order_service_selections`/`order_compliance_records`, reserves inventory, leakage alert | `api/orders/submit.ts` | ✅ built |
| QuickBooks invoice — non-blocking, finds/creates QB customer, builds lines, writes `qb_invoice_url` | `api/qbo/invoice/cultivar.ts` | ✅ built |

**Nuance:** order submit reserves inventory via `plant.inventory_id` — so it *also* depends on the same plant↔lot link R3 flags as missing.

---

## R3 — The gap + shortest fix

**Front door is built and public. The blocker on f7ec5d67 is the missing `cultivar_plants.inventory_id` link.**

The gate:
```ts
// PlantProfile.tsx:45
isUnavailable = !inv || inventoryStatus !== 'available';
```
`usePlant` joins **via the `inventory_id` FK** (`usePlant.ts:66`). If that FK is null → `business_inventory` resolves null → "Availability not set up yet," no purchase path.

**Why f7ec5d67 has no shoppable tree:**
- **`populate-catalog.ts` writes only `business_inventory` (DISC-* lots) — never `cultivar_plants`.** The 111-row catalog gave inventory but **zero scannable plant identities** (per the 2026-06-21 handoff, per-specimen QR identity was deliberately left unpopulated to avoid fabrication). → QR scan → **"Plant not found."**
- **`seed-sandbox.mjs` creates paired `cultivar_plants` (SMPL-*) + `business_inventory` (SMPL-*, `status='available'`) but never sets `inventory_id`** (`scripts/seed-sandbox.mjs:97-110`). They correlate only by matching string, not the FK. → even seeded sandbox plants show **"Availability not set up yet."**
- The **only** writers of `cultivar_plants.inventory_id` are `InventoryCount.tsx:389` (count flow) and a throwaway test script. Nothing in the shopping/seed path links them.

**The gap is (a) missing shoppable plant data** — no `cultivar_plants` row that is *both* QR-scannable by `tag_id` *and* linked via `inventory_id` to an available lot with `unit_cost`. It is **NOT** (b) QR encoding, (c) anonymous cart, or (d) auth gating — those are all fine.

### Shortest path to a walk-up demo on f7ec5d67 (no flow-code change)
1. Seed (or fix the seeder to produce) a few `cultivar_plants` rows with real `tag_id`s **and set `inventory_id`** → `business_inventory` lots with `status='available'`, `qty>0`, `unit_cost` set. **One-line addition to `seed-sandbox.mjs`** (set `inventory_id` after inserting the lots). Data/script fix — **David runs it with the service key.** No migration, no new Vercel function.
2. Generate QR labels for those `tag_id`s — note there's **no in-app QR UI**, so `generatePlantQR()` via script or the manual sheet path.

### Secondary (matches David's richer intent — larger, optional, separate builds)
- Tree-page content richness (photos/description like the LAWNS site) + tenant-aware footer.
- Persistent / multi-item cart if the "keep scanning and accumulate" flow is wanted.

### Flags
- **No schema/migration or new Vercel function needed** for the shortest fix (`api/` stays 12/12).
- **Live data NOT verified** — the `.env` service key is deny-gated and was not worked around. David can confirm in one query whether f7ec5d67 has **zero** `cultivar_plants` (→ "Plant not found") or **unlinked** ones (→ "Availability not set up yet"); both resolve with the same step-1 fix.

---

## Key file map (for the fix session)

- `packages/shared/src/qr/generate.ts:24` — QR URL template
- `packages/cultivar-os/src/router.tsx:85-89` — public flow routes
- `packages/cultivar-os/src/pages/PlantProfile.tsx:45,81` — availability gate + Add-to-cart
- `packages/cultivar-os/src/hooks/usePlant.ts:66` — the `inventory_id` FK join
- `scripts/seed-sandbox.mjs:97-110` — the seeder that omits `inventory_id` (the fix site)
- `scripts/populate-catalog.ts` — writes only `business_inventory`, no plants
- `packages/cultivar-os/api/orders/submit.ts` — server-authoritative order write
- `packages/cultivar-os/api/qbo/invoice/cultivar.ts` — QB invoice
