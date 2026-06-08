# Margin Engine Migration Checklist
**Audit date:** 2026-06-10  
**Session:** THUNDER · Build 1  
**Status:** Shared engine BUILT. Callers NOT yet migrated (non-destructive phase).  
**New canonical location:** `packages/shared/src/business-logic/MarginEngine.ts`

---

## Five Pricing Implementations (Reconciliation Verdict)

| ID | Location | Model | Status |
|----|----------|-------|--------|
| **A** | `packages/ignition-os/MarginEngine.js` | Slab + tier discount + charm round | CANONICAL (source of shared engine) — marked 🔴 DEPRECATED (superseded by shared) |
| **B** | `packages/shared/src/pricing/marginEngine.ts` | Slab, broken rounding, no tiers, no overhead | DEAD STUB — marked 🔴 DEPRECATED; zero live callers |
| **C** | `DataBridge.getActiveMargin()` + `.calculateRetail()` | prot_matrix anchor % model — DIFFERENT MODEL | DEPRECATED — marked 🔴; retire after IgnitionCipher migrated |
| **D** | `IgnitionEstimate.jsx` `shopPolicy.markup_percent` | Flat percent fallback (40%) | DEPRECATED — marked 🔴; retire after Estimate migrates |
| **E** | `IgnitionOmni.jsx` `shops.margin_config` | Display-only JSON (labor_rate + parts_markup) | Display storage only, not a pricing calculation — marked 🔴 for review |

---

## Full Caller Map (grep-confirmed 2026-06-10)

### A Callers — `MarginEngine.js` (slab model, correct)

These callers already get the canonical slab price. Migration = swap import path only.

| File | Line(s) | Call | Risk |
|------|---------|------|------|
| `packages/ignition-os/OnboardingWizard.jsx` | 323 | `MarginEngine.calculateRetail(cost)` (STANDARD) | LOW — demo wizard only |
| `packages/ignition-os/PriceField.jsx` | 20 | `MarginEngine.calculateRetail(cost)` (STANDARD) | LOW — price suggestion display |
| `packages/ignition-os/PriceField.native.js` | 20 | Same | LOW — mobile archive |
| `packages/ignition-os/modules/IgnitionPort.jsx` | 33, 50, 456 | `MarginEngine.calculateRetail(pState.cost)` (STANDARD) | LOW — customer estimate portal |
| `packages/ignition-os/modules/IgnitionProcure.jsx` | 21 | `MarginEngine.calculateRetail(cost)` (STANDARD) | LOW — vendor price calc |
| `packages/ignition-os/modules/IgnitionProcure.native.js` | 21 | Same | LOW — mobile archive |
| `packages/shared/src/components/SavingsReport.jsx` | 53, 87, 90, 206 | `MarginEngine.analyzeTransaction()` + `calculateRetail()` | MEDIUM — imports from `'../MarginEngine'` which resolves to `packages/shared/src/MarginEngine` (BROKEN PATH — file does not exist in shared). Build passes because IgnitionOmniDashboard imports `'./SavingsReport'` (ignition-os/modules/) which also MISSING (Tech Debt #10). Fixing both is the same migration step. |

**A migration steps (when ready):**
1. Change import `from './MarginEngine'` → `from '@trace/shared/business-logic/MarginEngine'`
2. Change `MarginEngine.calculateRetail(cost)` → `calculateRetail(cost, shopConfig, tierName)` where `shopConfig` comes from `business_modules.config` for `module_key='margin_engine'`
3. `MarginEngine.analyzeTransaction(tx)` → `analyzeTransaction({ cost: tx.cost, actualPrice: tx.actualPrice, tierName: tx.tier }, shopConfig)`
4. No price change expected — same slab model, same rounding. ✅

---

### B Callers — `packages/shared/src/pricing/marginEngine.ts` (dead stub)

| File | Line | Call | Risk |
|------|------|------|------|
| `packages/shared/src/index.ts` | 26 | re-exports `calculateRetail, calculateMargin` | LOW — zero live callers confirmed; safe to switch export to `business-logic/MarginEngine` in same session as stub delete |

**B migration steps (when ready):**
1. Update `packages/shared/src/index.ts:26` to re-export from `'./business-logic/MarginEngine'` instead of `'./pricing/marginEngine'`
2. Delete `packages/shared/src/pricing/marginEngine.ts`
3. Delete `packages/shared/src/pricing/` directory if empty

---

### C Callers — `DataBridge.getActiveMargin()` / `.calculateRetail()` (prot_matrix model)

⚠️ **PRICE CHANGE WARNING** — prot_matrix uses a percentage-of-cost markup formula.  
Slab model uses multiplicative slabs. These produce different prices.  
Example with anchor=40% vs STANDARD slab:
- $10 cost: prot_matrix → $10 / (1 - 0.40) = $16.67. Slab → $39.99 (4× slab, ≤$50).
- $130 cost: prot_matrix → $130 / 0.60 = $216.67. Slab → $259.99 (2× slab, ≤$200).

**David has accepted slab-as-canonical.** These price changes are expected when C callers migrate.

| File | Line(s) | Call | Risk |
|------|---------|------|------|
| `packages/ignition-os/modules/IgnitionCipher.jsx` | 35, 39 | `DataBridge.getActiveMargin('STANDARD')` + `DataBridge.calculateRetail(cost, margin)` | HIGH — DTC estimate prices will change significantly. Known and accepted. |
| `packages/ignition-os/OnboardingWizard.jsx` | 435 | `DataBridge.calculateRetail(totalCost, DataBridge.getActiveMargin('STANDARD'))` | MEDIUM — DIAGNOSE demo path only (one-time wizard, no customer-facing price) |
| `packages/ignition-os/DataBridge.js` | 907 | `DataBridge.getActiveMargin(tx.tier || 'STANDARD')` in `recordTransaction()` | MEDIUM — transaction history stamps old margin model; migration will change what `margin_at_time` field records |

**C migration steps (when ready — do IgnitionCipher last):**
1. OnboardingWizard DIAGNOSE path (line 435) — lowest risk (demo only):  
   Replace `DataBridge.calculateRetail(totalCost, DataBridge.getActiveMargin('STANDARD'))` with `calculateRetail(totalCost, shopConfig)` from shared engine
2. DataBridge.recordTransaction (line 907):  
   Replace `getActiveMargin` with slab model calculation for `margin_at_time`
3. IgnitionCipher (lines 35, 39) — do last, after price change communication:  
   Replace with `calculateRetail(base.partsCost + base.labor * activeRate, shopConfig, tx.tierName)`

---

### D Callers — `shopPolicy.markup_percent` flat percent fallback

| File | Line(s) | Call | Risk |
|------|---------|------|------|
| `packages/ignition-os/modules/IgnitionEstimate.jsx` | 97, 203 | `shopPolicy.markup_percent || 40` — used in estimate display and stored on estimate record | MEDIUM — estimate prices will change when migrated |

**D migration steps (when ready):**
1. Load slab config from `DataBridge.load('margin_config') || DEFAULT_MARGIN_CONFIG`
2. Replace markup_percent-based calculation with `calculateRetail(lineCost, config, tierName)`
3. `markup_percent` field on estimate record can remain for backward display, but derive it from slab at time of estimate

---

### E — `shops.margin_config` (display storage, not a pricing calc)

| File | Line(s) | Call | Risk |
|------|---------|------|------|
| `packages/ignition-os/modules/IgnitionOmni.jsx` | 516, 519, 574 | Reads/writes `shops.margin_config` `{ labor_rate, parts_markup }` from Supabase | LOW — display UI in dashboard settings; not wired to any pricing function |

**E note:** IgnitionOmni writes `margin_config` to Supabase `shops` table. `IgnitionProt.jsx` writes margin config to DataBridge. These are two separate storage paths for margin display. Neither feeds the pricing functions. Defer unification to Cost-to-Produce tile session (next in sequence).

---

## Migration Order (lowest risk first)

1. **B (stub + barrel)** — zero live callers, swap export in `index.ts`, delete stub file. No price change.
2. **A callers (all except SavingsReport)** — same slab model, import path swap only. No price change.
3. **SavingsReport in shared** — fixes broken `'../MarginEngine'` import at same time as Tech Debt #10 (rebuild ignition-os/modules/SavingsReport.jsx).
4. **C — DataBridge.recordTransaction** — internal-only, no customer price change.
5. **C — OnboardingWizard DIAGNOSE demo** — demo-only, price change acceptable.
6. **D — IgnitionEstimate markup_percent** — requires customer communication about estimate pricing.
7. **C — IgnitionCipher DTC estimates** — highest price delta; do last, after communicating to shop.
8. **E — IgnitionOmni shops.margin_config** — defer to Cost-to-Produce session.

---

## Overhead Wire — TD#16 Status

**Built:** `overheadPerUnit: number` is a first-class field in `MarginEngineConfig`. The engine adds it to vendor cost before slab selection.

**Seeded:** `DEFAULT_MARGIN_CONFIG.overheadPerUnit = 0` — zero overhead preserves exact Ignition behavior until a shop configures it.

**Upstream source:** `DataBridge.overhead_config.monthly` has `{ rent, electric, fuel, insurance, maintenance, other[] }`. The caller that loads config for a shop should compute:
```
overheadPerUnit = sum(monthly values) / avg_monthly_part_count
```
This calculation belongs in the caller (IgnitionProt settings → saves to margin_config DataBridge key), not in the engine. The engine just consumes the per-unit number.

**Status:** Engine slot is ready. No Supabase migration needed (no new table — config lives in `business_modules.config` for `module_key='margin_engine'` OR in DataBridge `margin_config` for Ignition). Overhead calculation wiring is the first step of the Cost-to-Produce tile session (next in agreed sequence).

---

## AC-1 Compliance Proof

The tier names `FLEET`, `LEGACY`, `FF`, `STANDARD` appear as:
- ✅ String values in `DEFAULT_MARGIN_CONFIG.pricingTiers[].name` (config data)
- ✅ String parameter `tierName?: string` passed by callers
- ✅ Matched via `config.pricingTiers.find(t => t.name === tierName)` (string equality)
- ❌ NOT TypeScript enum members
- ❌ NOT switch-case labels
- ❌ NOT imported constants

A Cultivar OS caller can pass `tierName: 'WHOLESALE'` with a config that has `{ name: 'WHOLESALE', discountPercent: 15 }` and the engine works correctly without any code change.
