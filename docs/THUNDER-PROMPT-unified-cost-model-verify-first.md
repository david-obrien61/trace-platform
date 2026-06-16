# THUNDER PROMPT — Unified Cost Model (Option 2) — VERIFY-FIRST (read-only, no build)

STEP 0 — GATE: Read CLAUDE.md in full. Confirm the 3 Session Starter checks. Then read:
- DECISION-unified-cost-model-option2.md (the locked decision + the six cost shapes + the AI-cost
  examples). [David: commit this doc + the other pending docs when convenient.]
- D-10 (project lens, OWNER-PROVEN), D-8 (cost shapes RECURRING-FIXED vs PER-OCCASION), D-9 (honesty
  engine), D-5 (cost_confidence + substantiation axes).
Echo back: the decision (recurring costs become first-class cost_objects), and the six cost shapes
the model must hold. Then proceed to the verify-first below.

THIS IS VERIFY-FIRST ONLY — READ-ONLY. Build NOTHING. Report, propose, then STOP for David's confirm.
This is the meaty migration; David reviews the plan before any code or schema change runs.

WHY: Recurring costs live in business_modules.config and are NOT projectable (no parent_id) and
can't hold non-fixed shapes (prepaid, variable, incremental). Option 2 unifies all costs into
cost_objects so they get parent_id (projectable) + a cost-shape dimension + the D-5 axes. But the
migration touches the read path the OWNER-PROVEN flat total ($12,239.67/mo) depends on — so we look
before we leap.

REPORT THESE FOUR (read-only):
1. Exact current schema of business_modules.config recurring lines — every field a recurring cost
   carries today (name, amount, cadence, confidence, any others). This is what migrates.
2. Every read path that consumes config recurring lines — especially the flat /costs tile
   (CostToProduce.tsx) and the seam feed. Identify what must keep working unchanged so the flat
   top-line stays honest during/after migration.
3. cost_objects current columns vs what the unified model needs. Propose the MINIMAL schema delta:
   - a cost-shape enum/field? proposed values covering the six shapes:
     one-time/capex · recurring-fixed · prepaid-multi-year · incremental-prepaid(auto-refill) ·
     variable(designed to allow scales-with-N, not built) · (absent categories are just data, not a shape)
   - cadence column? amortize basis/term columns (for prepaid-multi-year)? increment-size (for
     incremental-prepaid)?
   - is node_type='PRODUCT' the right home for recurring, or is cost-shape an independent field?
4. How the Settings entry UI writes config today (the recurring form) — what it takes to re-point it
   to write cost_objects and gain a cost-shape selector + project picker + the honest confidence
   handling (ESTIMATED vs UNKNOWN per the doc).

THEN: propose a migration PLAN (steps, order, how the flat total stays verifiably unbroken,
lossless migration of existing config lines, catalog-proof approach). Flag risks. STOP.

GUARDRAILS for when the build is later approved (state them now so the plan honors them):
- Honesty engine (D-9) + flat top-line stay correct/unbroken — trust-but-verify: flat total after
  migration must MATCH pre-migration (capture the before-number).
- Lossless migration: every current recurring cost survives, same amount/confidence. Catalog-prove.
- Design the cost-shape field to ALLOW variable-scaling-with-N; do NOT build that behavior now.
- [TRACE:*] ON for new/changed paths until owner-proven. Two-bar completion.
- This also makes cadence a real cost_objects column → closes the deferred cadence-edit gap.

Report the four + the plan. Build nothing. Stop for David's confirm.
