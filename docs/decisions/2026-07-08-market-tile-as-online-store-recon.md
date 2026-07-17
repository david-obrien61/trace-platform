# RECON: Can the cart/offerings engine carry platform tiles as products?

**Date:** 2026-07-08
**Type:** READ-ONLY recon — report only. No code/schema/migration/commit.
**Question:** Can the market tile be an internal instance of the online store (TRACE = merchant, businesses = customers, tiles = the products they select), reusing `service_offerings` + cart rather than a net-new engine? Where would platform-tile PRICES live?
**Session-starter checks:** passed (main branch, PLATFORM_STATE.md present, `[TRACE:*]` untouched; ignition-os / old-Supabase / QB-oauth not touched).

---

## Verdict (up front)

**The market tile CAN be an internal online-store instance — MEDIUM delta, not a trivial field-add, but not a net-new engine either.** The cart's base+optional+subtotal *pattern* and `service_offerings`' *shape* both fit the "TRACE = merchant, businesses = customers, tiles = products" model conceptually, and the per-business entitlement store (`business_modules`) **already exists**. It clears the AC-4 test in spirit: the offerings engine already encodes "what a business sells" as variable rows — making TRACE-as-merchant sell tiles is the *same pattern one level up* (platform→business mirrors business→consumer). But four concrete plumbing gaps stop it from being pure reuse.

---

## R1 — Can `service_offerings` carry a tile? (structural fit: **mostly yes, 3 gaps**)

**Schema** (`supabase/migrations/20260529_businesses_f_service_offerings.sql`): `id · business_id (FK→businesses CASCADE) · name · description · category CHECK(transport|addon|maintenance|inspection|subscription) · timing CHECK(at_checkout|post_purchase|recurring) · price_type CHECK(flat|per_unit) · price_unit CHECK(order|plant|vehicle|visit) · price numeric(10,2) · transport_mode · trigger_transport_mode · recurrence_days int · requires_address · pre_selected · is_active · sort_order · created_at` (+ later `compliance_title/body/service_note`).

**Tile → offering, field by field:**

| Tile needs | service_offerings field | Fit |
|---|---|---|
| name | `name` | ✅ as-is |
| price ($/mo) | `price` numeric | ✅ as-is |
| recurring monthly billing | `timing='recurring'` + `recurrence_days=30` + `category='subscription'` | ✅ **already supported** — the killer fit; the subscription shape exists |
| base vs optional | `pre_selected` (bool) + the transport(single-select)/addon(multi-select) split | 🟡 maps but semantically overloaded (see R2) |
| tier/bundle grouping (STARTER/PRO/PREMIER) | — | 🔴 **MISSING** — no group/tier/bundle column beyond `category`+`sort_order` |
| link to which registry tile it entitles | — | 🔴 **MISSING** — no `module_key`/tile pointer on an offering row |
| category='platform_tile' | `category` CHECK enum | 🔴 needs a NEW enum value (or overload `subscription`) |

**Scoping / "merchant = TRACE":** `business_id`-scoped, FK→businesses CASCADE. TRACE is a real business row (`45830ba7…`, `business_type='general'`), so TRACE **can** own a set of offerings the way LAWNS owns netting — the scoping does **not** fight merchant=TRACE. **BUT the RLS does:** `service_offerings_owner` is `FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))` — **owner-only**. A *different* business browsing TRACE's tile catalog could not read those rows. **Gap: a readable-catalog policy is required** (the one genuine RLS blocker).

## R2 — Can the cart select them? (surface reuse: **pattern yes, components no**)

- `packages/cultivar-os/src/hooks/useServices.ts` reads `service_offerings` by `business_id` + `is_active` + `timing='at_checkout'`, splits by category → **generic in shape** (takes a plain `businessId`).
- `packages/cultivar-os/src/hooks/useCart.ts`: the mechanic is **one base single-select** (`selectedTransport`) **+ multi-select optionals** (`services[]`) **+ running subtotal** — structurally exactly "base bundle + optional module tiles." The single-select/multi-select engine is genuinely reusable.
- **BUT the coupling is real and honest:** `packages/cultivar-os/src/pages/AddOns.tsx` is hardwired to plant context — reads `item.plant.business_id`, multiplies by *plant* `quantity`, `plantSubtotal` from `plant.business_inventory.unit_cost` (AddOns.tsx:70), and `useCart` stores `Plant`/`CartItem`. The selection *pattern* transfers; **AddOns.tsx and useCart do not drop in** — a tile-picker would reuse the pattern via a parallel/generalized page+store, not the existing components. **Reuse the mechanic, not the files.**

## R3 — Where do tile prices live today? (**net-new — confirmed**)

- **tileRegistry has NO price/billable/tier field** — re-verified by grep; every hit was a comment or a label, zero price data. `packages/cultivar-os/src/registry/tileRegistry.ts` header states `required_permission` is the only locked field; there is no commerce dimension.
- **No pricing/subscription/plan/billing table exists.** The one near-hit, `business_pricing_config` (`supabase/migrations/20260621_financial_wall_phase2.sql`), is a business's **own margin/pricing config** (the financial wall — `business_id PK, config jsonb`), NOT "TRACE charges business." Ruled out.
- `platform_config` is a generic string KV (`key/value/description`) — could stash prices as JSON strings but is unstructured.
- **The only place tier/module prices exist is MASTER_BRIEF prose** (line 214+): STARTER $149 / PRO $299 / PREMIER $499 + module add-ons ($19–$29/mo: Social, Follow-Up, Online Shop, Insights, Equipment, Delivery, GPS, Seasonal). **⇒ the price home is genuinely net-new.**

**Options (tradeoffs, NOT deciding):**

| Option | Pros | Cons |
|---|---|---|
| **(a)** price field ON tileRegistry | co-located, version-controlled, single source | prices in **code** (redeploy to change a price); can't model tier *bundles* (a bundle is a set of tiles, not one tile); no per-tenant/per-deal override (FOUNDING $149-locked) |
| **(b)** `service_offerings` rows owned by TRACE | reuses cart/checkout, prices are **live-editable DB data**, native recurring/subscription shape, per-row | RLS owner-only today (needs readable policy), needs category enum value + a `module_key` link column, and creates a **second catalog** to keep in sync with the registry |
| **(c)** new pricing table (`module_key → price` + tier bundles + overrides) | purpose-built; models tiers + add-ons + per-tenant overrides cleanly; keyed to registry by `module_key` | net-new subsystem/table; still needs a selection surface (doesn't itself reuse cart) |

## R4 — "businesses all differ" per-business tile config (**already exists**)

`business_modules` (`supabase/migrations/20260604…business_modules…sql`) IS the per-business entitlement store: **PK `(business_id, module_key)`, `enabled · configured · config jsonb`**. `packages/cultivar-os/src/hooks/useModules.ts` already overlays it on the registry for active-vs-available styling. So "this business has THESE tiles enabled" is **built**. **Net-new** is only the *commerce link*: `business_modules` tracks enabled/configured but has **no notion of purchased/billed/price** — no bridge between "enabled" and "paid for at $X." The entitlement primitive is there; the transaction that sets it isn't.

---

## Bottom line for "where do I enter prices?"

**Small-to-medium delta, not a full pricing subsystem** — *if* you reuse `service_offerings` (option b) with TRACE as merchant. Concrete gap list to close the loop:

1. **RLS** — add a readable-catalog policy so a customer-business can read TRACE's offerings (the one true blocker).
2. **Link column** — `module_key` (or tile pointer) on the offering so a purchase flips the right `business_modules` row.
3. **category enum** — add `'platform_tile'`/`'plan'` (or reuse `subscription`).
4. **Selection surface** — generalize the cart pattern off plant/quantity (parallel page+store, not AddOns.tsx as-is).
5. **Tier bundles** — STARTER/PRO/PREMIER (sets of tiles) are modeled by *neither* the registry *nor* service_offerings today → that grouping concept is net-new to both.

The AC-4 read: one engine, TRACE is just another `business_id` whose "products" are tiles — clean in principle; items 1–5 are the plumbing. **No decision made; recon only.**

---

## Evidence trail (files read)

- `supabase/migrations/20260529_businesses_f_service_offerings.sql` — service_offerings + order_service_selections schema, RLS, LAWNS seed
- `packages/cultivar-os/src/hooks/useServices.ts` — offering fetch by business_id/is_active/timing
- `packages/cultivar-os/src/hooks/useCart.ts` — base single-select + multi-select optional + subtotal store
- `packages/cultivar-os/src/pages/AddOns.tsx` — selection surface (plant-coupled)
- `packages/cultivar-os/src/registry/tileRegistry.ts` — TileEntry shape (no price field)
- `packages/cultivar-os/src/types/plant.ts` — ServiceOffering type
- `supabase/migrations/20260604…business_modules…sql` — per-business enablement store
- `supabase/migrations/20260611_platform_config.sql` — generic KV
- `supabase/migrations/20260621_financial_wall_phase2.sql` — business_pricing_config (own-margin, ruled out)
- `MASTER_BRIEF.md` lines 212–278 — the only extant tier/module price sheet (prose)
