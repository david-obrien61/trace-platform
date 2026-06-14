# MARGIN / LEAKAGE — PRECONDITIONS (RECON ARTIFACT)

**Date:** 2026-06-14 · **Session:** THUNDER (read-only) · **Type:** Recon, not design.
Zero code / schema / migrations. Every claim is file:line / key / table evidence against the
live repo — not the design doc's say-so, not memory.

**Question:** Is the settled MarginEngine model — per-business config, baseline margin, per-tier
adjustment, owner override-anytime, override CAPTURE → leakage report — DOCUMENTED, and is the
override-CAPTURE (the part that makes leakage possible) actually BUILT, or design-intent?

**The distinction this whole recon turns on:** APPLIED (computed transiently, used for the calc,
discarded) vs CAPTURED (stored, so it can be aggregated into a report later). Leakage needs
CAPTURED.

---

## CHECK 1 — Is it in the DESIGN DOC? (`docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md`)

| Element | Verdict | Evidence |
|---|---|---|
| Per-business margin config (40% baseline) | **PARTIAL** | The MarginEngine config interface is shown — `slabs[] / pricingTiers[] / overheadPerUnit` (lines 519–532). But there is **no "40% baseline"** anywhere, and **no "per-business" framing** — config is presented as the engine's input shape, not as a per-business stored/adjustable object. |
| Per-tier adjustment (walk-in / F&F / contractor) | **PARTIAL** | `pricingTiers: Tier[]` and `tierName?` appear (lines 525, 528) and F&F leak is named (399–404). But **no tier taxonomy is spelled out** (no walk-in/contractor/fleet list); tiers are referenced abstractly as an interface field. |
| Owner override-anytime | **ABSENT** | No mention of an owner overriding the computed price at point of sale. The doc never describes the override gesture. |
| Override CAPTURE → leakage report (baseline-vs-actual) | **PARTIAL** | The leakage *concept* is documented: F&F discount "leaks via MarginEngine `actualPrice`," surfaced as "Leakage: $Y/unit (market_price − actual_price)" (399–407); `actualPrice?` is in the interface (524). But it is explicitly hand-waved — *"Both are already in the system conceptually"* (406). **No persistence/capture design** — no table, no store, no "where the override is written" exists in the doc. |

**DOC GAP to flag:** Per David, this model is how Ignition was designed and should be in the doc.
The doc captures the leakage *math* but not (a) per-business config as a stored adjustable thing,
(b) the owner override gesture, or (c) how the override is CAPTURED so a report can aggregate it.
The doc treats capture as already-solved ("conceptually") when it is in fact localStorage-only
(see Check 2/3).

**Bonus stale-doc catch:** Lines 539–542 name `plants.cost_price` as the Cultivar cost-input
blocker. Post-UNTANGLE (2026-06-13) the cost input lives on `business_inventory.unit_cost`
(see LOT-POPULATION-PRECONDITIONS §"cost is solved"). The design doc's stated blocker is **stale**.

---

## CHECK 2 — What does Ignition's MarginEngine ACTUALLY implement?

Engine: `packages/ignition-os/MarginEngine.js` (deprecated-in-favor-of shared
`packages/shared/src/business-logic/MarginEngine.ts`). Callers: `PriceField.jsx`,
`OnboardingWizard.jsx`, `IgnitionProcure/Port/Cipher`, `SavingsReport.jsx`.

| Element | BUILT? | Evidence |
|---|---|---|
| 40% baseline markup | **NO (not as described)** | Pricing is a **4-SLAB markup** system, not a flat 40%: 4.0× / 2.0× / 1.5× / 1.25× by cost band (`MarginEngine.js:24–29`; shared `MarginEngine.ts:69–74`). A flat `parts_markup: 0.40` exists ONLY in `shops.margin_config` — and `IgnitionOmni.jsx:620` + the HONEST-DEBT block at `:671–676` flag it **DISPLAY-ONLY, not wired to any pricing calculation**. So "40% baseline" is an orphan default, not the engine's behavior. |
| Tier system | **BUILT** | Tiers `STANDARD / FLEET / LEGACY / FF` as string-keyed **discounts applied on top of the slab** (`MarginEngine.js:30–34, 77–78`). Tier comes from the customer record's `tier` field (`DataBridge.js:980–984` — C-1001 FLEET, C-1002 FF, C-1003 STANDARD). Shared engine generalizes to `pricingTiers[]` with `discountPercent`/`isDefault` (`MarginEngine.ts:75–80, 99–107`) — tier names are pure string data (AC-1 clean). |
| Override mechanism | **BUILT** | `PriceField.jsx` — admin unlocks a locked suggested price (`:27, 68–111`), types a manual price; component computes `isOverride = newPrice < suggestedPrice` and `leakage = suggested − newPrice`, emits via `onUpdate(...)` (`:41–53`). "Override Active" badge + "Relationship Tax: −$X" surfaced (`:108, 157–159`). |
| **Override CAPTURE (stored?)** | **PARTIAL — localStorage only, and NOT via the PriceField path directly** | The PriceField `onUpdate` payload (finalPrice/isOverride/leakage) flows to the **parent job object** (`IgnitionPort.jsx onUpdateJob`), not to a dedicated override store. What is actually PERSISTED is `transaction_history` in **localStorage**: `DataBridge.recordTransaction` enriches a tx (`margin_at_time`, `timestamp`) and `save('transaction_history', …)` (`DataBridge.js:960–971`); `IgnitionAudit.jsx:484–495` pushes missing-charge txs (`actualPrice: 0`). Config-change capture also exists: `margin_change_log` logs every slab/tier edit (`DataBridge.js:908–920`). Wizard capture: `OnboardingWizard.jsx:451` writes `first_margin_check` into `shop_policy`. **So capture is REAL but localStorage-bound, single-device, and the transaction record (carrying `actualPrice`) — not the PriceField override emit — is what feeds the report.** |
| Leakage / "$3,115" calc | **COMPUTED ON-THE-FLY from STORED localStorage data** | `SavingsReport.jsx:52–64` loads `transaction_history` (localStorage) and runs `MarginEngine.analyzeTransaction(tx)` per row to recompute `suggested` vs `tx.actualPrice`, summing `realLeakage`. With zero real txs it falls back to projecting from the single wizard `first_margin_check` (`:66–90`). `analyzeTransaction` itself is pure: `leakage = max(0, suggested − actualPrice)` (`MarginEngine.js:107–114`; `MarginEngine.ts:162–168`). **Input = localStorage-CAPTURED data.** The number is real *because the txs were stored* — not recomputed from live UI state. |

**Check-2 bottom line:** The leakage REPORT is genuinely BUILT and is fed by CAPTURED (stored)
data — `transaction_history` + `margin_change_log` + `first_margin_check`. The capture is not
design-intent; it exists. **But it is localStorage, single-device, single-tenant.** And the
literal PriceField override emit is APPLIED to a job object, not written to a dedicated
override-capture store — the report relies on the *transaction record's* `actualPrice`.

---

## CHECK 3 — Where does config + override history LIVE?

| Surface | Store | Evidence |
|---|---|---|
| Ignition margin config | **localStorage** key `margin_config` (slabs + tierDiscounts) | `DataBridge.js:125, 599–611`; `MarginEngine.getConfig()` reads it (`MarginEngine.js:42–46`). |
| Ignition overhead (overheadPerUnit source) | **localStorage** key `overhead_config` | `DataBridge.js:146, 927–942`. |
| Ignition override/actual capture | **localStorage** key `transaction_history` | `DataBridge.js:67, 968–970`; read by SavingsReport + ExternalBridge + OmniDashboard. |
| Ignition config-change capture | **localStorage** key `margin_change_log` | `DataBridge.js:135, 908–920`. |
| Ignition wizard capture | **localStorage** `shop_policy.first_margin_check` | `OnboardingWizard.jsx:451`; read `SavingsReport.jsx:66`. |
| **Cultivar** margin config / override store | **NONE** | Zero `MarginEngine` / `margin_config` / `calculateRetail` / `analyzeTransaction` callers in `packages/cultivar-os/src/` (grep: empty). `business_modules.config` unused (prior LOT-POPULATION recon §3). Re-confirmed. |
| **Server-persisted, business_id-scoped** store (any vertical) | **NONE** | No supabase migration contains `margin_config` / `override` / `leakage` / `pricing_tier` / `transaction_history` / `margin_change` (grep over `supabase/migrations/`: empty). |

**Check-3 bottom line:** All capture today is localStorage (single-device, single-tenant).
For a leakage report to work **platform-wide**, override + config history must be
**server-persisted and `business_id`-scoped** — localStorage cannot aggregate across devices or
tenants. **That store does not exist anywhere yet — it is net-new.**

---

## BOTTOM LINE

1. **DOCUMENTED in the design doc?** **PARTIAL.** The leakage math (`actualPrice`,
   market − actual) is in the doc; **per-business config as a stored/adjustable object,
   owner override-anytime, and the capture-persistence mechanism are absent or hand-waved**
   ("already in the system conceptually"). → **DOC GAP** per David's stated model. (Plus the
   stale `plants.cost_price` blocker — cost now lives on `business_inventory.unit_cost`.)

2. **Override-CAPTURE built in Ignition, or design-intent?** **BUILT — but localStorage-only,
   single-device, single-tenant.** Capture lives in `transaction_history` + `margin_change_log`
   + `first_margin_check` (all localStorage). The leakage report recomputes on-the-fly *from
   that stored data*, so it's APPLIED-at-read over CAPTURED-at-write — the capture is real.
   Caveat: the literal `PriceField` override emit is APPLIED to a job object; the report's input
   is the *transaction record's* `actualPrice`, not a dedicated override-capture row.

3. **For Cultivar: PORT or BUILD?** **Mostly a BUILD.** The *engine* (`MarginEngine.ts`, pure
   functions, config-injected, AC-1-clean) is a clean PORT — drop in a Cultivar config. But the
   **capture/config STORE is a BUILD**: Ignition's is localStorage and platform-wide leakage
   needs server-persisted, `business_id`-scoped storage. None exists. Cultivar also has **zero**
   MarginEngine callers today.

4. **Minimal net-new piece for a Cultivar MarginEngine caller WITH leakage capture:**
   - **(a) Config source** — a server-persisted, `business_id`-scoped per-business margin config
     (slabs + pricingTiers + overheadPerUnit). Decision still open (constants vs new table vs
     `business_modules.config` — see LOT-POPULATION-PRECONDITIONS §3). For leakage to aggregate,
     it must be server-side, not localStorage.
   - **(b) Override CAPTURE store** — a `business_id`-scoped row per priced transaction recording
     `{ cost, suggested, actualPrice, tierName, timestamp }`. Could be a new table OR
     carried on `order_items` (suggested-vs-actual columns) since Cultivar already has the
     orders/order_items spine. **This is the leakage-enabling piece and it does not exist.**
   - **(c) Cultivar caller** — a `PriceField`-equivalent at checkout that writes the captured
     override (b) using the cost input from `business_inventory.unit_cost` (already solved by the
     UNTANGLE — *not* `plants.cost_price`).

   The engine math is free (port). The **server-side capture + per-business config store** is the
   whole net-new cost — and it's what the platform-wide leakage report actually depends on.

---
*Recon only. No build performed. Sequenced behind LAWNS-yes per Cost-to-Produce gating.*
