# Margin-Aware Pricing Intelligence — point-of-entry, graceful degradation

**Type:** Concept / design capture. NO code, NO migration — this is the design brief the build reconciles against.
**Status:** Post-demo build. SCOPE: platform + cultivar.
**Last updated:** 2026-07-09
**Board card:** `user_stories.md` → `## NEEDED` → "Margin-aware pricing intelligence — traffic-light the price field, tell me WHY."
**Grounded in:** `business_inventory` (unit_cost / sell_price / created_at / received_at), `cultivar_plants` + `plant_events`, the shared `MarginEngine.ts`, the `cost_confidence` seam, and the OPEN overhead-allocation model ([[D-14]] carve-out / [[D-16]] Model B / residence-root).

---

## The idea in one line

**The price field IS the dashboard.** At the exact moment an owner types a `sell_price`, the field itself tells them — glanceably — whether that price is healthy, thin, or losing money, and one click deep tells them the math AND the *operational* reason why. It degrades gracefully: with no cost data it accepts the owner's price on trust; as cost, overhead, and operational data arrive, the intelligence lights up layer by layer. **Advisory, never blocking** — the owner always prices however they want (Surface Honesty + owner-authority, [[D-9]]).

This is the differentiator over a spreadsheet margin column: it doesn't just say *"you priced it wrong"* — it says *"this plant is bad business, and here's the operational evidence why."*

---

## LAYER 1 — AMBIENT SIGNAL (always visible, zero interaction)

The `sell_price` input's **background color** is a traffic light. No click, no modal, no hover — the color is just *on*, wherever a sell_price is edited (the inventory datasheet, the plant profile, the service editor).

| Color | Meaning | Condition |
|---|---|---|
| 🟢 **GREEN** | Healthy — above margin target | `sell_price` ≥ price-to-hit-target-margin |
| 🟡 **YELLOW** | Thin — below target, still above cost+overhead | cost+overhead < `sell_price` < target |
| 🔴 **RED** | Losing money — below true cost | `sell_price` ≤ (unit_cost + allocated overhead) |
| ⚪ **NEUTRAL** | Unpriced-for-margin — no cost basis to judge against | no unit_cost / no overhead → math can't run |

**Rules:**
- **Glanceable, always on.** The color is the whole point of Layer 1 — an owner scanning a list of 116 lots sees the red ones without touching anything.
- **Advisory only.** The color NEVER disables the save, never blocks, never nags. Red is information, not a wall. (Contrast with the required-field validation rule — *that* blocks because a blank required field is an error; a low price is a *choice*.)
- **NEUTRAL is honest, not broken.** No color when there's no cost basis is the correct Surface-Honesty state — the field is not pretending to know something it doesn't. A documented "unpriced-for-margin" state, not a silent grey.

---

## LAYER 2 — DRILL-IN (a small icon on the field → modal with the math)

A quantify/info icon sits on the field. Click it → a modal that shows the numbers behind the color. State-dependent:

- **🟢 GREEN modal — the good-news confirmation.** Quantified margin + profit-per-item.
  > *"42% margin · $53 profit each."*
  Confirms the owner is in good shape; nothing to fix.

- **🟡 YELLOW modal — the corrective nudge.** Margin % + a **suggested price** to reach green.
  > *"18% margin — suggest $145 to hit your target margin."*
  The suggestion is computed from the margin-target setting; it's a nudge, not an auto-apply.

- **🔴 RED modal — the intervention.** Negative margin % + a suggested price (or cost) to recover + **the LAYER 3 operational reasons** (below).
  > *"You're losing $8 on each of these — here's why, and here's what to do."*
  This is where pricing math meets operational reality: the modal explains not just *that* the number is red but *why the line is bad business*.

The modal is the "show me the math" surface. It presents; it does not silently mutate the price (owner clicks to accept a suggestion — capture is a separate concern, see margin-leakage below).

---

## LAYER 3 — OPERATIONAL "WHY" (the intelligence)

The signal isn't only margin arithmetic — it ties pricing health to **operational health**. A line can be red or yellow because of *business conditions*, not just a mispriced number, and those conditions are surfaced as identifying reasons inside the red/yellow modal.

Reasons (extensible list):
- **Too long in stock** — aging lot → carrying cost accumulating; the money tied up isn't turning. (time-in-stock)
- **Plants dying / declining** — this line is losing units to decline before sale. (reuse decline tracking)
- **Great losses / shrinkage on this line** — repeated loss events erode the effective margin far below the sticker margin. (reuse the loss/shrinkage concept)
- *(extensible: seasonal drag, oversupply vs demand, warranty-return rate, etc.)*

**Why this is the differentiator:** anyone can compute `(price − cost) / price`. Layer 3 says *"this plant is bad business"* and shows the operational evidence — the plant is aging, dying, and shrinking, so even a nominally-green margin is a lie. That's intelligence a margin column can't give.

---

## GRACEFUL DEGRADATION (core principle — mirrors `cost_confidence` + the fidelity tiers)

Intelligence appears as data arrives. It **NEVER blocks the floor case** — the price field always works, even with zero cost data.

| Data present | Signal available |
|---|---|
| **Nothing** (no cost, no overhead) | ⚪ NEUTRAL — accept the owner's price on trust; field fully works. No margin claim made. |
| **`unit_cost` only** | Partial signal — margin vs COST (pre-overhead). Can flag RED-below-cost, tentative green/yellow. |
| **`unit_cost` + overhead allocated** | Full traffic-light — the real green/yellow/red against true landed cost. |
| **+ operational data** (age / decline / loss) | Layer 3 reasons light up inside the modal. |

This is the same shape as the `cost_confidence` ladder (manual=CONFIRMED → receipt-linked=provable → derived) and the platform's fidelity-tier philosophy: **honest partial signal now, richer signal as the data spine fills** — never a fabricated number, never a blocked form.

---

## DATA DEPENDENCIES (each layer → what it needs)

**Layer 1 / Layer 2 (margin math):**
- `business_inventory.unit_cost` — EXISTS (what the grower paid). `business_inventory.sell_price` — EXISTS ([[D-35]]).
- **Margin-target setting** — NEW (open dependency #2). Where the green/yellow threshold lives.
- **Per-unit overhead allocation** — OPEN (open dependency #1). Gates the FULL traffic-light; partial (vs-cost) works without it.

**Layer 3 (operational reasons):**
- **Time-in-stock** — derivable TODAY from `business_inventory.created_at` / `received_at` (both exist on the table, `20260612`). No new column needed for age.
- **Decline / death** — tracked via **`plant_events`** (event-log): `event_type` includes `'lost'`, `'treated'`, `'returned'`, `'sold'` (`packages/cultivar-os/src/types/plant.ts`). Decline/death is an EVENT stream, not a status flag — the reason is derived by reading a lot's / variety's event history, not one column. (⚠️ confirm coverage: `plant_events` is per-specimen `cultivar_plants`; a stock-line lot with no specimen rows has no events yet — see open dependency #3.)
- **Losses / shrinkage** — the `'lost'` `plant_events` type is the live signal. NOTE: a bare `losses` table appears in the legacy live-table list (CLAUDE.md §2) but has **no migration and no code reference** — treat `plant_events['lost']` as the real source, not the orphan `losses` table, until proven otherwise.
- **Cost provenance** — the `cost_confidence` seam (manual=CONFIRMED, receipt-linked=provable) feeds how much to trust the cost the margin is computed against; the eventual cost-to-produce chain (receipt → seedling → grown plant) makes `unit_cost` a *derived* number rather than a typed one.

---

## REUSE (don't reinvent)

- **Margin math → the shared `MarginEngine`** (`packages/shared/src/business-logic/MarginEngine.ts`, already extracted from Ignition). It owns retail-from-cost, margin %, and tier discount (`tierDiscount`, `calculateRetail`). **Caveat (known from the tier-pricing thread):** MarginEngine derives price FROM cost via slabs, whereas cultivar stores an explicit `sell_price` — so the reuse for Layers 1/2 is the **margin-and-suggested-price math** (given cost + target → margin %, profit, price-to-hit-target), NOT the slab pricing model. Extract the small margin/suggestion helpers; don't force the whole slab engine onto the stored-price world.
- **Layer 3 reasons → existing `plant_events` + inventory timestamps.** Decline (`'lost'`/`'treated'`) and age (`created_at`/`received_at`) already exist as data; Layer 3 is a READ + summarize over them, not new capture.
- **Graceful-degradation shape → the `cost_confidence` ladder** already in the schema — same tiered-honesty pattern, applied to the price field.

---

## OPEN DEPENDENCIES (flag, don't solve)

1. **Per-unit overhead allocation** — how much of business overhead (labor, rent, subscriptions, capital) lands on ONE unit of ONE line. This is the [[D-14]] carve-out / [[D-16]] Model B (cost-to-serve ÷ N) / cost_objects + residence-root model — still OPEN platform-wide. **It gates the FULL traffic-light** (true green/yellow/red against landed cost). The partial signal (margin-vs-`unit_cost`, pre-overhead) works WITHOUT it, so the build ships the partial tier first and upgrades when the carve-out lands.
2. **Margin-target setting** — the owner sets a desired margin % (per business, maybe per category/line). This is where the green/yellow threshold LIVES. Likely rides the existing gated `business_pricing_config.config` jsonb (financialDataAccess.ts) as a `marginTarget` key — NO migration — but the surface (Settings / CostToProduceSettings) and granularity (one % vs per-category) are David's call.
3. **Confirm Layer-3 data coverage** — verify what decline/loss/age data actually exists per-lot TODAY: `plant_events` is per-`cultivar_plants` specimen, but the dominant order anchor is now the stock-line `business_inventory` lot ([[D-34]]/[[D-36]]) which may have NO specimen events. So "plants dying on this line" may be sparse until stock-line-level events exist. Age (created_at/received_at) is solid; decline/loss needs a coverage check before Layer 3 can promise those reasons.

---

## Build sequencing (suggested, not decided)

1. **Layer 1 partial** — NEUTRAL + RED-below-`unit_cost` only (no overhead, no target). Ships on data that exists today; proves the ambient-color mechanic.
2. **Margin-target setting** (open dep #2) → unlocks true green/yellow in Layer 1 + the suggested-price nudge in Layer 2.
3. **Overhead allocation** (open dep #1, platform-wide) → upgrades the traffic-light from vs-cost to vs-landed-cost. Same signal, truer threshold.
4. **Layer 3 reasons** — age first (data solid), then decline/loss once coverage (open dep #3) is confirmed.

Each step is independently shippable and never regresses the floor case — the field works at every tier.
