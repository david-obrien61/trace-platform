# DECISION — The Small-Business Cost-Accounting Model (reshapes Option 2)
**Captured:** 2026-06-16
**Status:** DECISION — the cost model TRACE implements. Supersedes/absorbs the narrower
"unified cost model (Option 2)" framing: Option 2's unification is still right, but the model gains
a cost-NATURE dimension (CapEx/COGS/OpEx) that produces the three business views David needs.
Build NOT started — this is the spec the unified-cost-model build executes against.

---

## What this is (and isn't)

We are NOT inventing a cost model. The model is standard managerial cost accounting (GAAP-grounded):
CapEx / COGS / OpEx + computed payback & margin. **What we're building is making that model usable
by a small-business owner who doesn't know the terms and can't afford a CFO** — at a cost-effective
build depth. The "Built with CAI" thesis applied to cost accounting: the owner enters costs in plain
language; the system classifies, groups, and computes what a CFO would.

Why it's a real wedge: >50% of small businesses struggle with cash flow / cost classification
(US Chamber). Big firms have accountants to sort CapEx/COGS/OpEx and compute payback/margin; small
businesses fly blind on exactly the questions that kill them (am I pricing to cover cost? when does
this investment pay back? what's my real margin?). We automate the hard part (classification + the
math). That's worth $149/mo.

---

## The model — three cost natures (the new dimension)

Every cost has a NATURE — how the money behaves and how it's recovered:

| Nature | What it is | Recovery mechanic | David's examples |
|---|---|---|---|
| **CapEx** (build) | capital to CREATE capacity/a product; lasts >1yr | depreciate/amortize over useful life → computed payback | greenhouse structure $20k; platform dev (100h × $75 + build-phase costs) = $40k |
| **COGS** (cost of sale) | direct cost of each UNIT sold | recovered per-sale, in price/margin | the trees ($10k inventory); per-customer API cost directly attributable to serving them |
| **OpEx** (operate) | ongoing cost to RUN, regardless of sales | covered by gross margin, monthly | utilities, water, hosting, Claude/Gemini subscriptions, labor-to-run |

The greenhouse example has ALL THREE (this is the clarifying insight): structure $20k = CapEx;
trees $10k = COGS; monthly water/utilities/labor = OpEx. "$30k total" was mushy because it mixed
CapEx + COGS — two different recovery clocks (greenhouse depreciates over years; trees recovered as
each sells).

**COGS has two sub-behaviors (LAWNS is hybrid — resell AND grow):**
- **Resale COGS** — cost = purchase price (known at acquisition; simple).
- **Grown COGS** — cost ACCRUES over grow-time (soil, water, labor, time) ÷ count. Uses the lot
  model (lot = SKU, qty = count, per-unit = lot accrued cost ÷ qty). This is where the deferred
  STAGE-COST LADDER gap lives (verify against a real plant before building grower-stage inventory).
  Same thread as the accumulator work.

---

## Computed views (fall out of the tagged data — not stored)

With every cost tagged by PROJECT (parent_id — already built) × NATURE (CapEx/COGS/OpEx — new)
× SHAPE (the six shapes — prior decision), three views + metrics compute automatically:

1. **Build cost per project** = Σ CapEx under the project (greenhouse = $20k; platform = $40k).
2. **Operating cost per project / per customer** = Σ OpEx (÷ N for unit price — the current flat
   tile, but now correctly labeled OpEx not "produce").
3. **COGS per unit** = direct cost of each unit sold (resale price, or grown accrued ÷ count).
4. **Payback period** (computed) = CapEx ÷ (monthly net after OpEx) → "2 years to recover the
   greenhouse." This is the number David couldn't relate to because the tile never computed it.
5. **Gross margin** (computed) = price − COGS. **Break-even** (computed) from the above.

This is the thing David was circling all evening: separate "what did it cost to build" (CapEx) from
"what does it cost to run" (OpEx) from "what does each sale cost" (COGS), then COMPUTE payback and
margin. The current tile mashed build + operate into one "Cost-to-Produce" and never computed payback.

---

## Build principles

**MANUAL FIRST, AI AS UNDERLYING BUSINESS INTELLIGENCE (David's principle).** The system WORKS with
manual classification — owner picks (or accepts a default) the nature of each cost. The AI is the
intelligence UNDERNEATH that makes it easier over time (suggest the nature, learn patterns, eventually
pre-classify) — but the tool is correct and functional WITHOUT the AI being right. Manual = the floor;
AI = the lift. Matches the architecture ethos: deterministic path works, AI augments, never
load-bearing for correctness. → Build the manual nature-picker + the three views + payback math FIRST;
AI-assisted classification is the next layer (fast-follow), not in the first build.

**COST-EFFECTIVE DEPTH (don't over-build).** Deliver DECISION-useful, not accounting-compliance-deep.
Build: classify into CapEx/COGS/OpEx, group by project, compute payback + margin + break-even. DEFER
(honest-debt, add only on real need): deep GAAP depreciation schedules, asset useful-life tables,
tax-basis treatment — that's the owner's accountant's job at tax time, not this tool's job. The 20% of
the model that gives 80% of the decision value.

---

## How this reshapes the unified-cost-model build (Option 2)

Option 2's unification into cost_objects is STILL the foundation. It now also needs:
- a **cost_nature** field: CapEx / COGS / OpEx (the new orthogonal dimension).
- COGS handling for both resale (price-at-acquisition) and grown (accrued-lot ÷ count) — the grown
  path ties to the stage-cost-ladder/accumulator gap.
- the computed views (build / operate / COGS / payback / margin) reading from
  project × nature × shape tagged rows.
- manual nature-picker in entry now; AI-classify deferred to fast-follow.

Three orthogonal tags on every cost: **project** (parent_id) × **nature** (CapEx/COGS/OpEx)
× **shape** (one-time / recurring-fixed / prepaid-amortized / incremental-prepaid / variable / etc.).

The verify-first Thunder already ran (config schema, read paths, the fromCostObject/$0-collapse pivot,
Option B+COST schema) STILL HOLDS — this adds cost_nature to that schema delta. The migration plan
(read-first, before-number anchor, dual-source, staged) is unchanged; the schema delta grows by the
nature field.

---

## Open / to confirm before build
- Schema: prior choice was Option B + node_type='COST'. Now ALSO add cost_nature (CapEx/COGS/OpEx).
  Re-confirm the schema delta with Thunder including nature.
- Grown-COGS / stage-cost-ladder: still needs the deferred real-plant verification before building
  LAWNS grower-stage inventory. Resale-COGS is simpler and can come first.
- Sequencing vs the in-flight migration: fold cost_nature into the same schema delta, or stage it?
  (Lightning lean: fold it in — it's the same migration, and building the views without nature would
  just need redo.)
