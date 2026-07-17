# As-built recon — contractor / tier pricing (three layers)

**Date:** 2026-07-08 · **Type:** READ-ONLY recon (no code, no migration, no behavior change)
**Scope:** vertical:cultivar + platform · **Closes:** the Item-1 (D-35) AC-4 hold — "price_tier read but not applied; tier math undefined."

**Purpose.** Contractor pricing is being solved WHOLE (mechanism + tier config + program). This doc extracts the CURRENT state of all three layers from code (file:line), marks each missing piece `[GAP]`, and states the build delta (reuse vs. net-new vs. gated-migration). It grounds the user story added to `user_stories.md`. Nothing here is designed or applied.

**Decided going in (do not re-derive):** tier→discount = **PERCENT-OFF-BASELINE**, owner-set per tier, default 0%. `retail=0`, `contractor=10` (owner-editable), `wholesale=owner-set`. Matches the shared MarginEngine mechanism (below) and flow spec §3 (Tier 1 = 10%).

---

## Summary — here's what exists, here's the delta

The **plumbing is half-built and the pipe is capped.** The identity column (`customers.price_tier`) exists and checkout READS it, but the discount is deliberately never applied (an explicit AC-4 hold in `submit.ts`), there is no owner UI to set a tier or its percent, and the entire contractor *program* (register → verify → approve → notify) is net-new.

| Layer | State | Delta |
|---|---|---|
| **1 — Mechanism** (tier → discount at checkout) | Column exists; `submit.ts` reads tier, applies **nothing** (AC-4 hold). Proven percent-off arithmetic already in shared MarginEngine. | **Small.** Reuse MarginEngine's percent-off step against the stored `sell_price`; flip the `submit.ts` hold. NO migration. |
| **2 — Config** (where the % lives + who's which tier) | `business_pricing_config.config` (jsonb, gated) exists as the home; MarginEngine's `pricingTiers[]` shape exists but cultivar hardcodes a single `default` 0% tier. No owner UI. Assignment UI is a `[GAP]` (`price_tier` is display-only). | **Medium, NO migration.** Add a `pricingTiers` key to the existing jsonb config (rides `readPricingConfig`/`writePricingConfig`); build the set-%-and-assign-tier UI. |
| **3 — Program** (register → verify → approve → notify → paid) | **Nothing in code** (grep-empty). | **All net-new.** Per flow spec §3/§4. Not demo-critical. |

**One likely gated migration? — NO.** The config layer rides the existing `business_pricing_config.config` jsonb additively (AC-4). A tiers-in-their-own-table design is possible but not required and not recommended here. The program layer *may* eventually want a `contractor_applications`-style table, but that is downstream of a build decision, not this recon. **No migration is flagged for the mechanism or config layers.**

---

## LAYER 1 — THE MECHANISM (price_tier → discount at checkout)

### R1 — `customers.price_tier`

- **Exists.** `supabase/migrations/20260625_person_spine.sql:105-106` — `ADD COLUMN IF NOT EXISTS price_tier text NOT NULL DEFAULT 'retail'`. **No CHECK** (AC-4: value-set grows without a migration). Values in use per the migration comment (`:100`): `retail | wholesale | contractor`.
- **Where it is SET — `[GAP]` there is no UI.**
  - `packages/cultivar-os/src/pages/Customers.tsx:141-142` renders the Tier column **display-only** — a `<span>{r.price_tier ?? 'retail'}</span>`, with **no `onCommit`/inline editor**, unlike every other column on that datasheet (first/last/phone/email/address all use `TextCell … onCommit={v => onText(...)}`, `:126-140`).
  - The Add-Customer form payload (`Customers.tsx:160-171`) **omits `price_tier`** → every manually-created customer defaults to `'retail'`.
  - `CustomerCapture.tsx` / `CartReview.tsx` never reference tier (grep-empty) → tier is not chosen or shown at browse/capture time.
  - **Net: a tier can only be set today by a direct DB edit.** Even the config story's "assign a contractor to a tier" has no surface (see R5).
- **`submit.ts` reads-but-doesn't-apply — CONFIRMED (the AC-4 hold).**
  - `packages/cultivar-os/api/orders/submit.ts:72-77` reads `price_tier` and logs `[TRACE:PRICE] price_tier adjustment (order-level)` with `adjustmentApplied: false, note: 'tier math undefined — AC-4 hold'`.
  - `submit.ts:137` — `const unitPrice = serverSellPrice; // tier HOLD: no adjustment (AC-4)`. The stored, server-authoritative `sell_price` is charged verbatim; the tier is observed and dropped.
- **What EXACTLY is missing to make the percent come off:**
  1. A source for the tier→percent map (Layer 2 / R3).
  2. Apply the percent at `submit.ts:137` — `unitPrice = serverSellPrice × (1 − discountPercent/100)` (order-level, server-side, after customer resolve — matches the existing "order-level" comment).
  3. (Optional, later) Show the discounted price *before* submit. Today the customer isn't known until `CustomerCapture`, and price is displayed from `sell_price` upstream of that, so pre-submit display of a tier price is a separate, larger piece — the mechanism itself is a clean server-side application at submit.

### R2 — MarginEngine (shared) — the proven percent-off mechanism

- `packages/shared/src/business-logic/MarginEngine.ts`:
  - `tierDiscount(tierName, config)` (`:100-107`) — looks up `config.pricingTiers[].discountPercent` by name; returns `0` for the default/unknown tier. **This is the percent-off lookup the decision calls for.**
  - `calculateRetail(vendorCost, config, tierName)` (`:120-135`) — applies `retail = baseRetail × (1 − discount/100)` (`:132`). The `PricingTier` shape is `{ name, discountPercent, isDefault }` (`:28-33`).
- **Directly reusable? PARTIALLY — cite the mismatch.** `calculateRetail` derives a price **from vendor COST via markup slabs**. Cultivar checkout charges a **STORED `sell_price`** (D-35) and never recomputes from cost — so calling `calculateRetail` as-is would ignore `sell_price` and re-derive a different number. **The reusable piece is the tier arithmetic, not the whole engine:** the `tierDiscount` lookup (`:100-107`) + the `× (1 − discount/100)` step (`:132`), applied against `sell_price`.
- **Build delta:** extract a tiny shared `applyTierDiscount(price, tierName, tiers)` (lookup + multiply, one place — rule of three, since MarginEngine already owns this for cost-derived prices) and call it in `submit.ts`. Do NOT reach `calculateRetail` from the cultivar order path.

---

## LAYER 2 — THE TIER CONFIG (where the % lives)

### R3 — per-business store for tier→percent

- **A gated, per-business config table already exists:** `business_pricing_config` (`supabase/migrations/20260621_financial_wall_phase2.sql:111-116`) — `business_id` PK, `config jsonb NOT NULL DEFAULT '{}'`, one row per business, owner + `view_pricing_config` RLS. Today it holds the cost-to-produce pricing recipe (margin/denominators/labor).
- **Accessor is ready:** `packages/shared/src/business-logic/financialDataAccess.ts` — `readPricingConfig` (`:171`) / `writePricingConfig` (`:199`) read/write `business_pricing_config` (`:176`, `:205`).
- **The MarginEngine `pricingTiers` shape exists but cultivar never populates real tiers.** `packages/shared/src/business-logic/CostToProduce.ts:330` hardcodes `pricingTiers: [{ name: 'default', discountPercent: 0, isDefault: true }]` in `marginConfigForTarget` — a single default, not owner-configurable, not persisted. (Confirms the standing "pricingTiers[] is empty in cultivar" note.)
- **Where would an owner SET `contractor = 10%`? `[GAP]` — no UI.** The natural home is Settings / `CostToProduceSettings.tsx` (which already reads/writes `business_pricing_config` via the accessor above).
- **Gated migration? NO.** A `pricingTiers` key added to `business_pricing_config.config` (jsonb) is additive and needs no DDL (AC-4). **Flagged, not designed.**

---

## LAYER 3 — THE PROGRAM (registration → approve → assign)

### R4 — does any §3 flow exist?

Grep across `packages/` + `api/` for `become a contractor`, `contractor_verify`, `contractor_notify`, `tier_assign`, contractor-approval — **empty**. Per §3 step:

| §3 step | State |
|---|---|
| 1-2. "Become a Contractor" CTA/entry | `[GAP]` net-new |
| 3. Registration form (biz name, contact, address, phone, email, biz type, verification docs) | `[GAP]` net-new |
| 4-5. Submission → owner review/verify | `[GAP]` net-new (no review surface) |
| 6. Owner approves + **assigns a tier** | `[GAP]` net-new (no assignment UI — R5) |
| 7. Approval notification (SMS/email) | `[GAP]` net-new (a `notifications/send.ts` system exists, but no contractor template) |
| 8. Contractor sees contractor pricing on subsequent orders | depends on Layer 1 mechanism (unbuilt) |

**All of §3 is net-new.** Monetization (§4): Options A/B/C — ship **A (free)** first per the spec's own recommendation.

### R5 — how does an owner assign a tier today?

**`[GAP]` — nothing.** Not even editing `customers.price_tier` in the UI: the Customers datasheet Tier column is display-only (R1, `Customers.tsx:141-142`), and the Add-Customer form omits it. The only path today is a direct DB edit. **This is the smallest, most immediate program gap** — it blocks even the reduced "owner manually tags a known contractor" path, independent of the full registration flow.

---

## Build delta — reuse vs. net-new vs. gated-migration

- **Reuse:** the MarginEngine percent-off arithmetic (`tierDiscount` + `×(1−d/100)`); the `PricingTier` config shape; the `business_pricing_config` table + `read/writePricingConfig` accessor; `CostToProduceSettings.tsx` as the config-UI host; `notifications/send.ts` for the program notify.
- **Net-new:** `applyTierDiscount` shared helper + the `submit.ts:137` application (mechanism); the set-per-tier-% + assign-tier-to-customer UI (config); the entire "Become a Contractor" register→verify→approve→notify→paid flow (program).
- **Gated migration:** **none required** for mechanism or config (both ride existing schema additively). The program layer *may* want a contractor-application table later — a downstream build decision, not flagged here.

**Sequencing (separable, cheapest→fullest):** (1) mechanism — decided, flip the hold, tiny; (2) config — set-% + assign-tier UI on existing schema; (3) program — net-new, not demo-critical.

**Cross-refs:** `submit.ts` AC-4 hold · `MarginEngine.ts` · `business_pricing_config` · flow spec `docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md` §3 (onboarding) + §4 (monetization) · board 3.7 (tiers) + 2.1 (checkout).
