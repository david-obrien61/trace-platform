# DECISION — Pricing Display Surfaces by Audience (and the estimator's role)
Status: ACCEPTED · Date: 2026-06-19 · Decider: David (owner)
Builds on: D-16 (pricing Model B), D-14.6 (estimator severed to read-only scratchpad), 2a (recovery_basis flag).

## Principle
The pricing engine (Model B: cost-to-serve ÷ N at margin + investment on a payback line) is ONE computation. WHERE its output displays depends on the audience. There are four surfaces, three audiences, and they must not be conflated — in particular, a prospect must never see the owner's cost-to-serve, labor, margin, or payback math.

## The four surfaces
1. /costs table — OWNER's authoritative READOUT. Real Model B numbers computed from the REAL cost record. "What it actually costs + suggested price." The sensitivity table over the N set. Internal. EXISTS; made honest by 2b/2c.

2. The estimator (severed Block 1, read-only to the cost model — D-14.6) — OWNER's WHAT-IF scratchpad. Same Model B math, fed by HYPOTHETICAL inputs the owner types (assumed costs, assumed N, assumed margin), NEVER written to the cost record. "What if I assume X." This is why read-only-to-the-model is correct, not a limitation: a scratchpad must not write to the books. This gives the severed estimator its defined role — it is the assumption-modeling surface, distinct from the /costs readout. EXISTS (read-only); its what-if computation is a future build.

3. Customer-facing price view — PROSPECT's view (e.g. LAWNS/Lauren, an Ignition buyer). Shows THEIR price and the value they get. MUST NOT show owner cost-to-serve, labor, margin, payback, or any internal economics. A distinct artifact. DOES NOT EXIST. Future build.

4. Decision record — the captured priced-decision ("BuiltWithCAI = $X/mo at target N"), dated and durable, revisitable — not re-derived from the table each time. DOES NOT EXIST. Future build.

## Separation in one line
/costs shows WHAT IS · the estimator explores WHAT IF · the customer view shows THEIR PRICE · the record captures WHAT WAS DECIDED. One engine, four surfaces, three audiences.

## Sequencing
Build nothing on this until 2b/2c makes the /costs engine compute honest Model B (cost-to-serve split + payback line). Surfaces are only worth designing once there is a correct number to display. Order after 2b/2c: (a) estimator what-if computation, (b) decision record, (c) customer-facing view — customer view last, as it needs a settled price to present.
