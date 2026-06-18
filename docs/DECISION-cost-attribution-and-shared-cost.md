# DECISION — Cost Attribution & Shared-Cost Flow (D-14)
Status: ACCEPTED · Date: 2026-06-18 · Decider: David (owner)

## Context
Costing and pricing the platform (TRACE → BuiltWithCAI → verticals). Resolves recurring relitigation. Builds on: carve-out / use-fraction cost-flow (residence-root, red-teamed 2026-06-15); "one source, many views" + the 80/20 "shared structure, vertical content" principle; "the 80% is a customer" (BuiltWithCAI = the horizontal small-business product); AC-1, AC-4; PATH A (use_fraction edges already in cost_object_edges).

## Decisions
D-14.1 — Attribution follows consumption, not design intent.
A cost is vertical-specific only while exactly ONE vertical consumes it. When a second vertical adopts the same capability it promotes to shared. The shared/vertical boundary is set by adoption — mirroring the code-sharing rule (code is vertical-specific until a 2nd vertical uses it, then shared).

D-14.2 — Shared cost flows by use-fraction carve-out, not top-down allocation.
Shared (80%) cost reaches a vertical via a use_fraction edge — the same carve-out primitive as personal→business, here applied cross-branch (platform→vertical). Conservation: use_fractions carved to verticals + remainder retained by BuiltWithCAI sum to ≤ 1.0 of the shared cost — never multiplied across verticals. The un-carved remainder is BuiltWithCAI's own product cost.

D-14.3 — Cost truth and price strategy are separate, from the same data.
Cost truth (honest books): a vertical's drill-in shows its ACTUAL current burden. Today Cultivar/LAWNS is the only live consumer, so its current carved fraction of shared cost is ≈ 1.0 — and the books must SHOW that (Surface Honesty), not pretend it is spread across empty lanes.
Price strategy: a vertical is PRICED at its own 20% specific cost + its AMORTIZED fair share of shared cost + margin — NOT the full platform burden. Loading the entire shared cost onto the sole customer is a pricing error, not a cost error.

D-14.4 — Unrecovered platform investment is a first-class, surfaced number.
= shared cost incurred − shared cost recovered by live verticals. It is investment running ahead of revenue. Surfaced, not buried. Dilutes automatically as verticals onboard (today's carved fraction ≈ 1.0 → drops toward fair share as real consumers are added).

D-14.5 — A vertical fully owns its 20% specific cost; carries a fair slice of the 80% shared cost.
The 20% specific is genuinely the vertical's. The 80% is carried fractionally per D-14.2.

## Deferred / NOT decided here
- Default BASIS for the platform→vertical use_fraction (even split / usage-weighted / hand-set): ship as a SETTABLE variable (AC-4); default simply; defer any weighted/usage engine until real multi-vertical data justifies it.
- "Cost today (full burden) vs amortized fair share" side-by-side comparison: BI-adjacent — deferred (relates to D-13 + BI what-if). Principle captured; build later.
- Per-project N, per-project margin baseline, per-project platform-share fraction (the schema knobs) = Phase 2 of the drill-in build.

## Build sequencing
- Phase 1 (now): per-project cost-to-produce drill-in, COST-ONLY, zero schema — reuses the existing per-group rollup. Shows one project's cost in isolation (labor / recurring / capital + confidence mix).
- Phase 2 (next): pricing layer — settable knobs (N, margin) + cross-branch use_fraction carve-out for shared cost; surfaces fair-share price + unrecovered-investment gap. Requires staged migration + cross-branch-edge verify-first.
