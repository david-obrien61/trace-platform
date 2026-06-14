# MARGIN / LEAKAGE / OVERRIDE SYSTEM — FULL INVENTORY (RECON ARTIFACT)

**Date:** 2026-06-14
**Type:** READ-ONLY recon. No migrations, no schema, no code edits. This is a complete map of what exists, so we "know what we know" before deciding any Cultivar port/build.
**Scope searched:** `packages/ignition-os/`, `packages/shared/`, `packages/cultivar-os/`, `supabase/migrations/`
**Bottom line up front:** The leakage **math** and the price-**capture** are built. The **actor dimension** David remembers — recording WHO set/discounted a specific sale price — is **NOT FOUND for per-transaction overrides**. Actor attribution exists, but ONLY for system-wide config changes (who changed the markup policy), via `margin_change_log.changed_by`. See §C and the MAP at the end.

---

## A. THE ENGINE

### A1. Shared canonical engine (TypeScript) — `packages/shared/src/business-logic/MarginEngine.ts`
- `MarginEngine.ts:120` — `calculateRetail(vendorCost, config = DEFAULT_MARGIN_CONFIG, tierName?)` → retail price; rounds `Math.ceil(retail) - 0.01`.
- `MarginEngine.ts:141` — `getProfitMargin(vendorCost, retail)` → margin % string (e.g. "58.34").
- `MarginEngine.ts:152` — `getMarkupPercent(vendorCost, config)` → markup % integer.
- `MarginEngine.ts:162` — `analyzeTransaction(tx, config)` → `{ loadedCost, suggested, leakage, margin }`. **This is the leakage calc.**
- `MarginEngine.ts:88` — `loadedCost = vendorCost + (config.overheadPerUnit ?? 0)` — overhead wired into the slab input.
- `MarginEngine.ts:166` — **leakage formula:** `leakage = Math.max(0, suggested - (tx.actualPrice ?? 0))` (never negative).
- Config types: `MarginEngineConfig` (`MarginEngine.ts:35` — `{ slabs[], pricingTiers[], overheadPerUnit }`), `MarginSlab` (`:17` — `{ label?, maxCost, multiplier }`), `PricingTier` (`:28` — `{ name, discountPercent, isDefault? }`), `MarginTransaction` input (`:49` — `{ cost, actualPrice?, tierName? }`), `MarginAnalysis` output (`:56`).
- **No `getConfig()` on the shared engine** — every function takes `config` as a default param. Callers must supply it. (This is the Cultivar config-source gap flagged in the 2026-06-13 lot-population recon.)
- Exported from `packages/shared/src/index.ts:25` and the business-logic barrel.

### A2. Ignition engine (JavaScript, DEPRECATED) — `packages/ignition-os/MarginEngine.js`
- Header line 1: 🔴 DEPRECATED — "migrate callers to shared MarginEngine (TD#16)".
- `MarginEngine.js:68` — `calculateRetail(cost, tier = 'STANDARD')`.
- `MarginEngine.js:88` `getProfitMargin`, `:98` `getMarkupPercent`, `:107` `analyzeTransaction(tx)` → `{ suggested, leakage, margin }`, `:53` `getSlabForCost`.
- `MarginEngine.js:42` — `getConfig()` reads DataBridge key `'margin_config'`, else `DEFAULT_MARGIN_CONFIG`. **This is the config source the shared engine lacks.**

### A3. Tier system (both engines)
- Tier names are **string values, not enums:** `STANDARD`, `FLEET`, `LEGACY`, `FF`.
- Selection (shared `MarginEngine.ts:100-107`): look up `tierName` in `pricingTiers`; if absent, fall back to the `isDefault: true` tier (STANDARD, 0% discount). Discount applied at `:132` — `retail = baseRetail * (1 - discount/100)`.
- Defaults — `DEFAULT_MARGIN_CONFIG` (`MarginEngine.ts:68`): STANDARD 0% (default), FLEET 10%, LEGACY 20%, FF 5%.
- Slab multipliers (`MarginEngine.ts:68`): Consumables ≤$50 → 4.0× · Mid-Range ≤$200 → 2.0× · Heavy ≤$1000 → 1.5× · Major → 1.25×.

### A4. Active callers (who actually runs the engine)
- Ignition (live, via deprecated JS engine): `OnboardingWizard.jsx:323`, `PriceField.jsx:20`, `IgnitionPort.jsx:33/50/456`, `IgnitionProcure.jsx:21`.
- Shared `SavingsReport.jsx:60,87,90` — calls `analyzeTransaction` / `calculateRetail` (consumption; see §D). Tech-Debt #10 broken-import caveat noted by recon.
- **Cultivar callers: ZERO.** Symbols are importable from `@trace/shared` but unused in Cultivar. (Confirms 2026-06-13 recon: MarginEngine caller is net-new for Cultivar.)

---

## B. CAPTURE STORES (the leakage-enabling data)

### B1. `transaction_history` (DataBridge, localStorage) — `DataBridge.js:67-73`
Schema: `customer`, `tier`, `standardPrice`, `actualPrice`, `timestamp`. **NO actor field.**
- Write path: `recordTransaction` `DataBridge.js:960-971` — enriches with `margin_at_time`, `labor_rate_at_time`, `quarter`, `timestamp`, then `save('transaction_history', …)`. The enrichment adds margin context but **still no user/actor field** (verified by reading the enriched object).
- ⚠️ **Actor question:** searched for `user_id`, `modified_by`, `set_by`, `technician`, `employee`, `changed_by`, `author`, `actor` — **NONE present** on transaction records.

### B2. `margin_change_log` (DataBridge, localStorage) — `DataBridge.js:135-144`
Schema: `id`, **`changed_by: user_id`**, `changed_at`, `field_changed`, `category` (SLAB | LABOR | TIER_OFFSET | OVERHEAD), `old_value`, `new_value`, `reason`.
- ✅ **This store DOES record an actor (`changed_by`).** Writer: `logMarginChange()` `DataBridge.js:908-920`.
- **But it is written ONLY for system-wide CONFIG changes**, never for a per-sale price override:
  - `setMarginConfig` → slab change `DataBridge.js:623`, tier change `:646` (`changed_by: userId || 'SYSTEM'`)
  - `setSystemRates` → labor rate `:866` (`changed_by: adminId || 'SYSTEM'`)
  - `setOverhead` → overhead `:941` (`changed_by: userId || 'SYSTEM'`)
- This is **"who changed the pricing policy,"** not **"who discounted this customer."** Critical distinction — see MAP.

### B3. `first_margin_check` (onboarding calibration) — `OnboardingWizard.jsx:451` (saved into `shop_policy`)
Fields: `partName`, `costPaid`, `priceCharged`, `suggested`, `leakagePerPart`, `annualLeakage`. **NO actor field.** Records WHAT the owner priced during onboarding, not WHO.

### B4. `estimate_line_items` (Supabase, Ignition) — write at `IgnitionEstimate.jsx:233`
On a price override, the updates object = `{ unit_price, line_total, is_manual_override, original_calculated_price, price_leakage }`. **NO actor field.** Marks THAT an override happened + the dollar delta, not WHO.

### B5. Other config stores
- `overhead_config` (DataBridge) — `DataBridge.js:146-157`; getter `getOverhead()` (~`:496`). Schema-ready, has `updated_by` for the config edit, **not** consumed into `overheadPerUnit` yet.
- `shops.margin_config` (Supabase) — read at `IgnitionOmni.jsx:616-622` (`{ labor_rate, parts_markup }`). 🟡 **DISPLAY-ONLY** — explicitly "not wired to any pricing calculation" (`IgnitionOmni.jsx:612`).

---

## C. THE OVERRIDE / ACTOR PATH (the sophisticated part)

### C1. Price-edit UI → store, traced hop by hop
1. `PriceField.jsx:41-52` — user edits price; detects `isOverride = newPrice < suggestedPrice`; calls `onUpdate({ finalPrice, isOverride, suggestedPrice, leakage })`. **No user captured at UI level.**
2. `IgnitionEstimate.jsx:228` — `handlePriceOverride(id, {finalPrice, isOverride, suggestedPrice, leakage})`.
3. `IgnitionEstimate.jsx:233` — builds `updates = { unit_price, line_total, is_manual_override, original_calculated_price, price_leakage }`.
4. Writes to Supabase `estimate_line_items.update(updates)`. **No `logMarginChange()` call. No `currentUser.id` written. No role/authorization stamped.**

### C2. Authorization / role check on override?
- `IgnitionEstimate.jsx:104` loads `currentUser = DataBridge.load('current_user')`; `:105` uses it **only** to resolve `shop_id`.
- `PriceField.jsx:32-33` computes `isAdmin = currentUser?.permissions?.includes('ADMIN')` — but this gates **only the UI lock/unlock button**, not what gets stored. A clerk override and a manager override produce **identical records**.
- **No `authorized_by`, no role field, no approval flag** persisted with any override. → **NOT FOUND.**

### C3. Where the current user/role comes from (what an actor field WOULD be populated from)
- `current_user` (DataBridge): `{ id, name, pin, permissions[] }`, set during PIN auth. Available in `PriceField` and `IgnitionEstimate` — **present but never read at the override write.** So the data to attribute exists; the wiring to record it does not.

---

## D. THE REPORT (consumption)

### D1. `SavingsReport.jsx` (shared) — `packages/shared/src/components/SavingsReport.jsx`
- Inputs (`:41-99`): `shop_policy` (onboarding date + `first_margin_check`), `transaction_history` (filtered to trial window).
- Per-tx: `:59-64` `MarginEngine.analyzeTransaction(tx)` → accumulates `realRevenue`, `realCaptured (actualPrice - cost)`, `realLeakage (Σ leakage)`.
- Projection (`:70-74`): `projectedAnnual = leakagePerPart × weeklyParts × 52` from `first_margin_check`.
- Display (`:80-84`): real data if any trial transactions exist, else the wizard projection.
- ⚠️ **Surfaces only the DOLLAR gap.** No actor / authorized-vs-unauthorized distinction anywhere in the report. → **NOT FOUND.**

### D2. Ignition dashboard leakage tile — `IgnitionOmniDashboard.jsx:63-72`
- Sums `standardPrice - actualPrice` over `transaction_history` where `actualPrice < standardPrice`; **hardcoded fallback `$450.00`** if zero. Label "Relationship Tax (Leakage)". No actor.

### D3. The "$3,115 revenue leak" figure
- **NOT FOUND in the codebase.** No `3115` / `3,115` / `revenueLeak` constant exists. The live leak numbers are computed (D1/D2) or demo fallbacks ($450 in Ignition, $28 in Cultivar). The $3,115 was likely a prior demo/verbal figure, not a wired value.

### D4. Cultivar leakage (the live, shipping system — different model)
- `api/orders/submit.ts:127-129` — `leakageFlag = isLargeContainer && (nettingTotal + otherTotal) === 0` (binary flag, NOT margin math). `LARGE_CONTAINERS = ['15 gal','30 gal','45 gal','60 gal','100 gal']`. Stored `orders.leakage_flag` (`:154`).
- Dashboard `Dashboard.tsx:391` — `missedRevenue = leakageCount × LEAKAGE_AVG_VALUE` where `LEAKAGE_AVG_VALUE = 28` (hardcoded). Owner alert fired on flag (`submit.ts:251-278`, template `owner_leakage_alert`).
- **No actor here either** — flag records THAT add-ons were declined, not who declined or why.

---

## E. CONFIG FILES (where margin/tier/markup is defined or defaulted)
- `MarginEngine.ts:68` — `DEFAULT_MARGIN_CONFIG` (shared canonical: slabs + pricingTiers + `overheadPerUnit: 0`).
- `MarginEngine.js:23` — `DEFAULT_MARGIN_CONFIG` (Ignition deprecated: slabs + `tierDiscounts` object).
- `DataBridge.js:125-128` — `margin_config` schema; `getMarginConfig()` (~`:456`) reads it, `setMarginConfig(newConfig, userId)` writes + logs.
- `DataBridge.js:146-157` — `overhead_config` schema + `getOverhead()`/`setOverhead()`.
- Cultivar `packages/cultivar-os/src/lib/constants.ts` — **NO margin config** (only TAX_RATE, container sizes, transport options). Confirms the Cultivar config-source gap.

### The flat 0.40 / 40% baseline — where it lives, wired or orphan
- `IgnitionOmni.jsx:571` `useState({ labor_rate:125, parts_markup:0.40 })` and `:620` fallback — **DISPLAY-ONLY**, explicitly "not wired to any pricing calculation" (`:612`). Rendered at `:270`. → **ORPHAN (not applied).**
- `IgnitionEstimate.jsx:97` `markupPercent = shopPolicy.markup_percent || 40` — **APPLIED** to estimate display (sent to API `:203`), but 🔴 Honest-Debt flat-percent fallback slated to retire to the slab model.
- **No `0.40` baseline in the shared engine** — it uses slab multipliers (4.0/2.0/1.5/1.25×), not a flat 40%. No `BASELINE_MARGIN` constant exists.

---

## F. THE CULTIVAR ORDERS/INVOICE SPINE (landing zone — current shape only, no design)
- `orders` columns (`submit.ts:142-157`, `types/order.ts:22`): id, business_id, customer_id, employee_id(null), qb_invoice_id/url, transport_method/note, netting_declined, install_date, subtotal, tax_amount, total_amount, addons_amount, status, **leakage_flag**, notes, created_at. **No cost/margin/suggested fields.**
- `order_items` (`submit.ts:165-171`): order_id, plant_id (→ cultivar_plants), quantity, **`unit_price` (selling-price snapshot = `plant.business_inventory?.unit_cost` at order time, `submit.ts:121`)**, subtotal. **Missing: cost, margin, suggested_price, actual_price, discount.**
- `order_service_selections` (`20260529_businesses_f_service_offerings.sql:66-74`): order_id, service_offering_id, quantity, `unit_price_at_time` (snapshot), subtotal. **No cost/margin.**
- `service_offerings` (`…:10-53`): name, category, timing, price_type, price_unit, **`price` (selling price only)**, etc. **No `cost`, no margin rule.**
- `addons` / `order_addons` — legacy, superseded by service_offerings; price field only.
- **Price flow at checkout:** `business_inventory.unit_cost` → `order_items.unit_price` (snapshot, NOT margin-derived); `service_offerings.price` → `order_service_selections.unit_price_at_time`. **No margin calc runs at checkout. The spine carries selling prices only — zero cost or actor data flows through it.**

---

## MAP — WHAT EXISTS vs WHAT WAS EXPECTED-BUT-NOT-FOUND

### Exists & where
| Piece | Location | Level |
|---|---|---|
| Leakage math (`leakage = max(0, suggested − actual)`) | `MarginEngine.ts:166` | BUILT |
| Slab + tier engine (4 slabs, STANDARD/FLEET/LEGACY/FF) | `MarginEngine.ts:68` | BUILT |
| Per-transaction capture (price + actual) | `transaction_history` `DataBridge.js:67`, `recordTransaction:960` | CAPTURED |
| Override-occurred marker + dollar delta | `estimate_line_items` `IgnitionEstimate.jsx:233` | CAPTURED |
| **Actor on CONFIG changes** (`changed_by`) | `margin_change_log` `DataBridge.js:137`, written `:623/646/866/941` | ATTRIBUTED (config only) |
| Savings/leakage report | `SavingsReport.jsx`, `IgnitionOmniDashboard.jsx:63` | BUILT (dollar gap only) |
| Cultivar binary leakage flag | `submit.ts:127`, `Dashboard.tsx:391` | BUILT (no margin, no actor) |
| Logged-in user available (`current_user.id/permissions`) | `DataBridge.load('current_user')`, `IgnitionEstimate.jsx:104` | EXISTS but unused at override |

### Expected but NOT FOUND (was intent, not built)
| Expected piece | Verdict | Evidence |
|---|---|---|
| Actor on a **per-sale price override** (who discounted THIS customer) | **NOT FOUND** | `estimate_line_items` update `IgnitionEstimate.jsx:233` has no user field; `transaction_history` schema `DataBridge.js:67-73` + enriched `:960` have no actor |
| Authorized-vs-unauthorized discount distinction | **NOT FOUND** | No `authorized_by`/role/approval stamped on any override; `isAdmin` (`PriceField.jsx:32`) gates UI only |
| Leakage report surfacing WHO caused a leak | **NOT FOUND** | `SavingsReport.jsx` + Cultivar tile report dollar gap only |
| `$3,115` wired leak figure | **NOT FOUND** | no such constant; live values are computed or $450/$28 fallbacks |
| Cultivar margin/cost on the order spine | **NOT FOUND** | order_items/orders/service_offerings carry selling price only |

### Three layers, stated precisely
- **APPLIED** (used in calc): slab multiplier + tier discount → suggested price (`MarginEngine.ts`). ✅
- **CAPTURED** (stored): the price paid + the leakage delta (`transaction_history`, `estimate_line_items`). ✅
- **ATTRIBUTED** (stored WITH who): **only for system-wide config policy changes** (`margin_change_log.changed_by`). ❌ for per-transaction/per-line price overrides.

---

## PLAIN STATEMENT

**Actor-capture for the thing David remembers — recording WHO set or discounted a specific sale/invoice price — is NOT FOUND. It was design intent, not built.** What WAS built is actor attribution one level up: `margin_change_log.changed_by` records who changed the **pricing policy** (slab multipliers, tier discounts, labor rate, overhead) — `DataBridge.js:137`, written at `:623/646/866/941`. The per-sale override path (`PriceField → handlePriceOverride → estimate_line_items`, `IgnitionEstimate.jsx:233`) stores that an override happened and its dollar leakage, but **not the user, role, or authorization** — even though `current_user` is loaded two functions away (`:104`) and is never read at the write. The unauthorized-vs-deliberate-discount distinction therefore does not exist in stored data or in any report.
