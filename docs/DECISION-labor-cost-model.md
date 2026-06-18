# DECISION — Labor Cost Model (robust schema now, UI depth incremental, intelligence deferred)
**Captured:** 2026-06-17
**Status:** Canonical model decision. Research-grounded (fully-burdened rate / cost-vs-bill /
Schedule C employee-vs-contractor). Build the MODEL robust now; populate to the depth each business
needs; defer the analysis/what-if intelligence until real data populates the spine.
Extends: small-business cost-accounting model, the category dimension, the three-layer mission frame.
Links forward to: DECISION-nested-projects-and-BI-whatif-blocker.md (margin-sensitivity IS a what-if).

---

## GOVERNING PRINCIPLE (David, 2026-06-17 — this governs the whole build)
Build the model ROBUST and FLEXIBLE **once**, aligned to the standard accounting format, so that:
- It serves ANY vertical at ANY depth — LAWNS may never populate labor; Ignition lives on it;
  Backbone Valley Nursery uses the nursery slice; TRACE needs the contractor case NOW (Connor/Andrew).
- Because it's built on the standard shape (Schedule C lines, fully-burdened rate, cost-vs-bill), the
  data TRANSFERS CLEANLY to QuickBooks and the accountant — export is a mapping, not a translation.
- Net: a big-corp capability (what a CFO + six-figure system provides) at solo-founder cost.

This is AC-4 at its purest: settle the model once, make variation live in DATA (AC-1), not schema.
Corollary (the discipline that prevents balloon): **robust SHAPE, sane defaults, honest nulls.** The
schema is capable of full standard depth; each business populates only the depth it needs; unused
fields are null/zero (never faked). Deepening a field (e.g. burden % → burden components) is a
refinement INSIDE the field, NOT a re-migration.

---

## THE STANDARD MODEL (research-grounded — do not reinvent)
Three established concepts, all standard accounting:

1. **Burden (unburdened vs fully-burdened cost rate).** Base wage is NOT the labor cost. A worker at
   $25/hr base typically COSTS $38–42/hr fully burdened (payroll taxes, workers' comp, benefits,
   overhead allocation). Estimating/bidding on unburdened rates guarantees losses.
2. **Cost rate vs bill rate.** Bill rate = fully-burdened cost rate + markup (profit + G&A). Margin is
   the spread ABOVE the BURDENED cost, not above base wage. The $35/$145 trap (David's own framing):
   "$45 charged / $25 paid" looks like $20 margin but burdened cost is $42 → real margin $3. Margin =
   bill_rate − burdened_cost_rate (then less overhead absorption).
3. **Contractor vs employee (Schedule C distinction).** Contract labor (1099-NEC, >$600/yr) is a
   DISTINCT Schedule C line from Wages. Cost-wise it's SIMPLER on your side: you pay only the
   contractor's rate (+ any pass-through expenses) — NO employer burden (they cover their own taxes/
   equipment). Contractors bill hourly OR per-task OR flat-fee per project.

---

## SCHEMA — robust shape, built now (capable of full depth; populated per need)

LABOR RESOURCE / ROLE (per business, RLS-scoped; roles are DATA not hardcoded — AC-1)
  resource_type:   EMPLOYEE | CONTRACTOR
  name/role label: e.g. "Sr Tech", "Tech", "Jr Tech" (Ignition), "Owner" (TRACE), "Connor (contract)"
  rate_basis:      HOURLY | FLAT_FEE                 ← CONFIRMED: support BOTH
  -- EMPLOYEE fields:
     base_wage         ($/hr)
     burden            ← CONFIRMED: model as a single burden value NOW (% or $/hr add-on);
                          detailed components (payroll tax / workers' comp / benefits / overhead share)
                          are a later refinement INSIDE this field, NOT a re-migration. Robust shape,
                          shallow population now.
     cost_rate         = base_wage + burden  (derived; the TRUE cost to you)
     bill_rate         ($/hr charged to customer; margin lives above cost_rate)
  -- CONTRACTOR fields:
     rate              (hourly OR flat-fee; already includes THEIR burden — you add none)
     pass_through_expenses  (materials/travel the contractor bills you, SEPARATE from rate)
     -- no employer burden, no bill_rate markup on your side (you pay what they bill)

APPLIED LABOR (a cost_object; category = labor [employee] | contract-labor [1099])
  resource-ref × hours (or flat-fee) × project (parent_id)
  billable?:  YES → revenue at bill_rate ; FREE → $0 revenue, COST STILL INCURRED (drags margin)
  → cost flows into cost-to-produce as a categorized, projectable cost line (uniform with all costs)
  → margin (when computed) = revenue − burdened_cost − overhead_absorption

Standard-alignment: category=labor → Schedule C Wages; category=contract-labor → Schedule C Contract
Labor (1099-NEC). Burden components map to standard payroll-burden lines. QBO export = field mapping.

---

## WHAT BUILDS WHEN

### MODEL / SCHEMA — robust, NOW (cheap to get right once; expensive to migrate later)
The full shape above. Pull owner labor OUT of config (the $75×160 special-case) INTO the cost model as
category=labor. Contractor case fully supported (Connor/Andrew — TRACE's live need: "can I afford
their terms"). Employee burden+bill_rate FIELDS exist (robust) even if only Ignition populates them.

### UI DEPTH — incremental (don't build every screen at once)
- NOW: enough UI for TRACE's real need — enter a contractor (rate hourly|flat + pass-through expenses)
  and an owner rate; see them as categorized labor costs in cost-to-produce. Replaces the $75 config
  line with a real, projectable labor cost.
- LATER (Ignition, real trades data): full employee burden entry, bill-rate + margin display,
  estimation screens, workforce-mix. Built against REAL jobs (like the stage-cost ladder needs a real
  plant — the burden/bill/margin engine needs real trades data to be designed right).

### INTELLIGENCE — DEFERRED (until real data populates the spine)
- Margin sensitivity / what-if: "tech needs $37 — still profitable, or what's the blocker?";
  "profitable at Jr Tech rate, blocked at Sr Tech rate — THAT's the blocker." Burden-recalc triggers
  (research: recalc burden quarterly / on insurance/benefit/mix changes).
- This IS the BI what-if/blocker wedge (see DECISION-nested-projects-and-BI-whatif-blocker.md). Same
  reasoning for deferral: can't scope the what-if until the spine is rich AND POPULATED with real data
  to reason over. The robust schema NOW is precisely what MAKES this intelligence buildable later.

---

## NAMED USES (why this is real, not speculative)
- TRACE / David: cost-to-produce + pricing + "can I afford to contract Connor/Andrew" (contractor case
  — the live need driving build-now).
- Connor & Andrew (building apps): "when is it self-sustaining?" = labor cost (their hours/fee) vs
  revenue → payback.
- Ignition (trades, reference vertical): job estimation by burdened cost + bill rate + margin per role
  (Sr/Tech/Jr). The margin engine's home.
- Backbone Valley Nursery: the nursery slice of the same model.
- LAWNS: may not populate labor at all — and that's FINE (robust shape, honest nulls).

## DEFERRED / NAMED (honest debt)
- Per-PERSON pay (vs per-role rate): start role-based; a person can override a role rate later. NOT
  payroll — don't build HR. Named, not built.
- Detailed burden components (taxes/comp/benefits/overhead breakdown): refinement inside the burden
  field; not a migration.
- Effective margin across billable+free hours (unbilled drags real margin): part of the margin engine.
- Workforce mix / role counts (Jr→Sr promotion changes blended cost): margin-engine layer.

---

## ADDENDUM (2026-06-18) — origin of the $12k line + Ignition as the labor exemplar

**The current $12,000/mo labor figure ($75/hr × 160hr) is a SINGLE OWNER-LABOR line, in an ESTIMATION
context.** It was David estimating his OWN time to cost the platform build — not a fully-burdened rate,
not contractor. So the D-12 migration moves exactly ONE owner-labor cost_object (category=labor),
byte-identical. Contractor/burden/bill-rate were not yet considered when that figure was set; they are
the robust-schema fields that exist but aren't populated by this line.

**Ignition is the REFERENCE IMPLEMENTATION / exemplar for the labor model.** David's framing: "labor
would be pulled in from Ignition as an example." The labor primitive lives in the shared spine (built
once, robust — D-12 governing principle), and IGNITION is where it gets populated MOST FULLY — the
real Sr Tech / Tech / Jr Tech roles, real burden, real bill rates, real billable-vs-free — because
trades is where fully-burdened multi-role labor economics are essential. Other contexts (the
platform-costing exercise, Cultivar, Backbone Valley) pull from / learn from the same shared primitive
at whatever depth they need. This is the SAME role Ignition already plays as "the reference vertical
and prototype of the shared spine" — labor is another instance of it.

Implication (reinforces, does not change, the build): build the labor SCHEMA robust NOW even though
only owner/contractor populate it in TRACE — because Ignition WILL populate the full depth (burden,
bill rate, roles), and the schema must already be shaped for it so Ignition snaps in without
re-migration. The full employee burden/bill/margin ENGINE is still deferred and is expected to be
designed AGAINST REAL IGNITION DATA (like the stage-cost ladder needs a real plant).
