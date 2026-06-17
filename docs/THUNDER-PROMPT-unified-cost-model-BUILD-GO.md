# THUNDER PROMPT — Unified Cost Model · BUILD-GO (staged, after verify-first)

STEP 0 — GATE: Read CLAUDE.md in full. Confirm the 3 Session Starter checks. Then RE-READ these
NOW-COMMITTED docs (some are newer than your verify-first run — the model GREW since then):
- DECISION-small-business-cost-accounting-model.md  ← NEWEST / CANONICAL. You have NOT seen this; it
  reshapes the model. Read it fully before anything.
- DECISION-unified-cost-model-option2.md (has a "SUPERSEDED FRAMING" banner pointing to the above).
- Your own verify-first findings (Reports 1-4 + migration plan) — still valid, this builds on them.
- D-10 (project lens, OWNER-PROVEN), D-8 (cost shapes), D-9 (honesty engine), D-5 (confidence+substantiation).
Echo back: the THREE cost NATURES (CapEx/COGS/OpEx) and how nature differs from shape and node_type.
Then proceed — this is BUILD-GO but STAGED (see below): you build steps 0-3, then STOP for confirm.

WHAT CHANGED SINCE YOUR VERIFY-FIRST (the one real addition):
Your report knew cost SHAPES (the six). The model now ALSO has cost NATURE — CapEx / COGS / OpEx —
a THIRD orthogonal dimension. Every cost is tagged by: PROJECT (parent_id, exists) × NATURE
(CapEx/COGS/OpEx, NEW) × SHAPE (the six, planned). Nature drives the three business views
(build-cost / operating-cost / COGS) + computed payback & margin. node_type = what kind of thing;
cost_shape = how money behaves over time; cost_nature = how it's recovered (capital / per-sale / ongoing).

MISSION FRAME (so this build is not mistaken for the finished product):
This build is the SPINE — the structured cost model. It sits in a three-layer architecture serving
the mission (affordable, scalable, connect-don't-replace, surface hidden costs, show real margin):
  - RAW COST DATA (connect, don't rebuild) — QuickBooks / bank / receipts / subscriptions. The
    connect-via-API layer. NOT built this pass; the cost_source field is its attachment hook.
  - COST MODEL (THIS BUILD) — cost_objects tagged nature × shape × project. The destination
    connectors feed and the source the insight layer reads. Build the spine first: connectors need a
    destination, insight needs a structured model.
  - INSIGHT LAYER (the product value, the wedge) — hidden costs surfaced, real margin, payback. The
    gap no existing tool fills for small business. Computed from the spine.
EXPLICIT NEXT LAYERS (named so they aren't forgotten, NOT built now): (1) API connectors that import
costs from the tools businesses already use (provenance via cost_source); (2) AI-assisted
classification (manual-first works without it; AI is the intelligence underneath — David's principle).
Works-without-the-connection / degrades-gracefully is a requirement: the model + manual entry function
fully with zero connectors; connection adds insight, its absence doesn't break the app.

=== DECISIONS (confirmed by David 2026-06-17) ===
(a) Decision docs committed (4b14dd7 + the small-business model doc). Read them as canonical.
(b) SCHEMA = Option B + node_type='COST' + ADD cost_nature + ADD cost_source. Schema delta now:
    - cost_shape text CHECK(6 values)
    - cadence text CHECK(5 values)
    - recurring_amount numeric(10,2)  [distinct from acquisition_cost — never overload capex/recurring]
    - extend node_type CHECK with 'COST'
    - cost_nature text CHECK('CAPEX','COGS','OPEX')   ← NEW (drives the three views + payback/margin)
    - cost_source text DEFAULT 'MANUAL'   ← NEW: provenance hook. Where a cost came from (MANUAL now;
      later QUICKBOOKS / BANK / RECEIPT / etc.). Has an IMMEDIATE writer (every cost today = MANUAL,
      a real value not null) and a known near-future consumer (the connect-via-API layer). This is a
      SEAM the next layer attaches to — NOT a speculative null-pile column. Stamping it during this
      ALTER (one column) avoids re-altering live cost data later (unnecessary risk). Keep the CHECK
      open/loose enough to add sources without a migration, OR document the value-set is expected to grow.
    Shapes 4-5 columns (amortize_term/start, increment_size) + shape-6 scales_with STILL DEFERRED
    (honest-debt, no writer yet). cost_nature + cost_source land NOW (both have immediate writers).
(c) Labor: DEFER — keep in config this pass, flag as follow-up, do NOT force into a row.
(d) Plan: your staged migration plan stands. Backfill assigns nature: migrated recurring costs →
    'OPEX' (Claude Pro, domains, APIs are operating costs); existing capex rows (CoolRunnings
    hardware) → 'CAPEX'. cost_source → 'MANUAL' on all backfilled rows (they were hand-entered in
    config — true provenance, not a placeholder). COGS comes via entry/classification later (resale +
    grown — grown ties to the deferred stage-cost-ladder).

=== STAGED EXECUTION — build steps 0-3 ONLY, then STOP ===
Per your own plan, do the SAFE foundation now; the data-move waits for David's fresh confirm:
0. Capture the BEFORE-NUMBER per tenant (snapshot config; record analyze().knownMonthly +
   floorMonthly; TRACE = the owner-proven $12,239.67/mo). This is the trust-but-verify anchor.
1. Schema delta (append-only, Option B+COST+nature above). Manual-apply gated, then catalog-prove
   via extended verify-cost-objects.mjs (live information_schema/pg_catalog, not memory).
2. Make fromCostObject SHAPE-AWARE (the $0-collapse pivot): RECURRING_FIXED/PER_OCCASION →
   MONTHLY_POOL (normalize recurring_amount by cadence); ONE_TIME → CAPEX (unchanged). No data moved
   yet → flat total must be BYTE-IDENTICAL. This is pure safety.
3. Report: confirm flat total byte-identical after step 2, schema catalog-proven. STOP.

THEN (David confirms fresh before you proceed): step 4 backfill → step 5 verify match → step 6 flip
read source → step 7 re-point write path (shape selector + project picker + nature picker +
substantiation; preserve truncation-guard intent) → step 8 owner-prove.

=== GUARDRAILS (honor all) ===
- Honesty engine (D-9) + flat top-line stay correct/unbroken. Flat total after migration MUST match
  the step-0 before-number per tenant (the gate — mismatch = STOP).
- Lossless backfill; UNKNOWN/null amounts migrate as UNKNOWN never $0; catalog-prove counts.
- R1-R7 from your verify-first all apply (esp. R1 $0-collapse via read-first; R5 capex rows stay
  excluded; R3 labor-defer flagged not dropped).
- Design cost_shape to ALLOW variable-scales-with-N; do NOT build that behavior.
- [TRACE:*] ON for new/changed paths until owner-proven. Two-bar completion. Nav-reachable.
- NOTE: pricing/packaging (core vs premium) is a LATER business decision — does NOT affect this
  build. Build the capability; packaging is a flag added whenever David decides.

Build steps 0-3. Report byte-identical confirmation + catalog proof. STOP for David's confirm on backfill.
