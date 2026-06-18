# THUNDER PROMPT — D-11 + D-12: Category dimension + Labor model FOUNDATION (bounded) + Settings reorg
## STAGED, VERIFY-FIRST MIGRATION — do NOT one-shot this.

STEP 0 — GATE: Read CLAUDE.md in full. Confirm the 3 Session Starter checks (last session's handoff;
which shared modules this touches + that packages/shared/src/ was checked; current Off Limits / Part 7).
Read D-11 (docs/DECISION-cost-category-dimension.md) and D-12 (docs/DECISION-labor-cost-model.md) in
full — they are canonical for this build. Read the small-business cost-accounting model doc and D-8
(shape) for how nature/shape already work.

This is the first SCHEMA-touching build since the unified cost model. Same rigor: VERIFY-FIRST, then
STAGED migration gated on BYTE-IDENTICAL number proofs, two-bar completion. The
$12,279.67/mo-family numbers (floor $12,123 + estimated $156.67) MUST hold through every gate — labor
moving from config into cost_objects must NOT change any total.

=== BOUNDED SCOPE (decided — do NOT exceed) ===
IN THIS BUILD:
  1. Category dimension (D-11): add cost_category to cost_objects (Schedule C–aligned value set,
     ~15–20, per-business/customizable, honest null/"Other" allowed). Robust shape.
  2. Labor model FOUNDATION (D-12): the robust schema (resource table: EMPLOYEE|CONTRACTOR, rate_basis
     HOURLY|FLAT_FEE, employee base_wage+burden+cost_rate+bill_rate fields, contractor rate+
     pass_through_expenses) — built ROBUST even though only owner/contractor populate now.
  3. Pull OWNER LABOR out of config into cost_objects as a real labor cost (category=labor). Default:
     migrate the existing $75/hr × 160hr = $12,000/mo as ONE owner-labor cost_object (byte-identical;
     preserves the floor). (If David specifies the $12k splits into multiple real labor lines, seed
     those instead — confirm before migrating.)
  4. CONTRACTOR labor usable (Connor/Andrew case): enter a contractor (rate hourly|flat + pass-through
     expenses), category=contract-labor, projectable. TRACE's live need.
  5. Settings reorg into DISTINCT blocks (fixes David's "it's confusing" — labor/margin tangled):
     RECURRING & OPERATING COSTS | LABOR (its own block, the real labor-model UI) | MARGIN POLICY
     (its own block) | TARGET CUSTOMERS (its own block). Each visually distinct.

EXPLICITLY DEFERRED (robust schema fields exist so these are NOT future re-migrations — just later UI):
  - Employee BURDEN component breakdown (start burden as a single value; components later IN-field).
  - Bill-rate / margin ENGINE, margin-sensitivity / what-if (the BI wedge — needs real Ignition data).
  - Categorized P&L top block + revenue/reconcile (category makes it possible; display is a later pass).
  - Spreadsheet-grid Settings view (its own build).
  Do NOT build these. Lay the schema foundation only.

=== STAGE 1 — VERIFY-FIRST (report, do not migrate yet) ===
Report from the ACTUAL repo + live DB (not memory):
  - How is labor stored in config today? Exact shape ($75/hr, 160hr, where in config JSON).
  - What READS labor into the floor (the analyze/fromCostObject/CostRollup path) — trace it.
  - What WRITES labor (CostToProduceSettings) — the exact field.
  - Current cost_objects schema (columns, CHECKs) — confirm node_type=COST exists, parent_id self-FK,
    cost_confidence/cost_shape/cadence/recurring_amount/cost_nature/cost_source present.
  - The locked anchor: confirm the live floor/estimated/known numbers BEFORE any change.
  - Any load-bearing assumption that pulling labor out of config would break (like the bucket:'CAPEX'
    pivot we hit in the unified-model build). FIND IT before building.
STOP after Stage 1. Report. Wait for David's GO before schema changes.

=== STAGE 2 — schema migration (after GO; David applies SQL, you catalog-prove) ===
  - cost_category column (text; per-business value set; nullable/honest-null).
  - labor resource table (the robust D-12 shape) OR labor fields on cost_objects — RECOMMEND in Stage 1
    which is cleaner (separate resource table vs. fields on the labor cost_object) and why; David decides.
  - All RLS membership-scoped to business_id (AC-2). No vertical nouns in shared schema (AC-1).
  - Catalog-prove the migration (column/CHECK/RLS present) before any code reads it.

=== STAGE 3 — pull owner labor into cost_objects (gated on byte-identical) ===
  - Make the read path category/labor-aware so the migrated labor cost_object feeds the floor EXACTLY
    as the config line did. Equivalence must hold BY CONSTRUCTION (like the shape-aware fromCostObject
    fix). Prove floor/estimated/known UNCHANGED to the cent before flipping off the config labor read.
  - R1-safe guard: drop the config labor read only when the migrated labor cost_object exists for the
    business (un-migrated tenants stay byte-identical — flip never zeroes anyone).

=== STAGE 4 — Settings reorg + labor/contractor UI ===
  - Reorganize Settings into the 4 distinct blocks. LABOR block = the real labor-model UI (owner rate;
    add contractor with rate basis hourly|flat + pass-through expenses; category auto labor|contract-labor).
  - Preserve the truncation-guard intent (per-row INSERT/UPDATE/DELETE-by-id; failed read blocks save).
  - Category picker on costs: Schedule C value set, real values only (D-9 — no fake surface).
  - Confidence↔amount coherence still holds (UNKNOWN⟺no-amount; else amount required).

=== CONSTRAINTS ===
  - VERIFY-FIRST. STAGED. Byte-identical number proofs at each gate. Two-bar (BUILDER-COMPLETE →
    OWNER-PROVEN; service-key proof ≠ RLS/UI proof). The known-monthly total holds through every stage.
  - [TRACE:PROJECTLENS] STAYS ON (standing decision). [TRACE:COST]/[TRACE:SEAM] on through this build.
  - Robust shape, sane defaults, honest nulls (D-12 governing principle: build the model once, robust
    and standard-aligned, so Ignition/Backbone snap in without re-migration; QBO-mappable by construction).
  - Stay in scope. The deferred list is deferred. If something tempts scope-creep, NAME it as honest
    debt and move on.

REPORT at the end of STAGE 1 (verify-first) and HOLD for David's GO before touching schema.
