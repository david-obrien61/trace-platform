# THUNDER PROMPT — Project-Lens small fixes: stale unknown-count + unify-on-resolve-modal + clickable section titles

STEP 0 — GATE: Read CLAUDE.md, confirm the 3 Session Starter checks. DISPLAY/INPUT-layer fixes.
Engine/math OWNER-PROVEN — do NOT touch computation. These are three independent small fixes from
David's live owner-proof of the ordering + unknown-accounting build (3252c1d). The big model work
(category dimension, labor model) is SEPARATE and NOT in this prompt — these are the ready-now wins.

CONTEXT — David owner-proved 3252c1d. Working: alphabetical reorder ✓, new cost shows as unknown ✓,
click-block-to-resolve ✓, inline resolve edits ✓, genuine unknowns honest ✓. Three issues found:

=== FIX 1 — Stale unknown-count at the top after inline resolve (REAL BUG) ===
When David resolves an unknown via the inline modal, the BOTTOM updates immediately but the TOP block
count stays stale (top showed 3, bottom showed 2) until a manual page refresh. Everything else is
immediate/no-refresh, so this lag is inconsistent and wrong. The top count must recompute from the
SAME live canonical unknown set the instant a resolve happens — no refresh.

=== FIX 2 — Unify the top block onto the SAME resolve modal (David's call; also the structural fix for FIX 1) ===
David: "if we have the resolve modal, why not use it at the top too — it's the same info." Correct.
The top "N unquantified costs" block should open the SAME resolve modal (the one already built and
proven for the per-group resolve), reading the SAME canonical unknown set. Reachable from top OR
bottom; edit inline; Done to save. Because both surfaces then read one canonical set, the top CANNOT
go stale — so unifying on the one modal is ALSO the clean fix for FIX 1 (single source of truth, no
second copy of the count to drift). Do NOT build a second modal — reuse the existing CostRow/resolve
component.

=== FIX 3 — Clickable section titles → the edit / list surface for that section ===
Section titles should navigate to where you edit that section's data:
- "Cost & Price by Target Customers" (the margin table) title → the edit surface for that data
  (where the inputs behind it — target N, baseline margin, reference price — are edited; that's
  Settings today). Make the title a link to that edit surface.
- "Material Costs (Inventory)" title → the inventory edit/list page (EVEN IF blank/empty — so David
  can navigate there and hand-jam test data). If no inventory page/route exists yet, create a minimal
  list/placeholder route the title links to (empty-state "No inventory rows yet" + a way to add) —
  enough to land on and enter test rows. Don't build a full inventory system here; just the
  navigable list surface the title points to.

=== CONSTRAINTS ===
- DISPLAY/INPUT layer only. No engine/math change. Reuse the existing resolve modal + CostRow (no
  second editor). The $12,279.67-family numbers and the unknown-set DEFINITION (isUnknownCost) are
  unchanged — FIX 1/2 are about the count staying LIVE and one resolve surface, not redefining unknown.
- [TRACE:PROJECTLENS] STAYS ON (standing decision — until Andrew's asset/inventory widget online +
  tested; do NOT comment out).
- Two-bar: report BUILDER-COMPLETE + owner-proof steps.

OWNER-PROOF David runs on live /costs under RLS:
  FIX 1/2: open the top block → it opens the same resolve modal as the per-group resolve → resolve an
    unknown (set ESTIMATED + amount) → it drops off AND the top count decrements IMMEDIATELY (no
    refresh) → top and bottom agree at all times.
  FIX 3: click "Cost & Price by Target Customers" title → lands on the edit surface for those inputs.
    Click "Material Costs (Inventory)" title → lands on the inventory list/edit page (blank is fine) →
    David can add a hand-jammed test row.

Report at BUILDER-COMPLETE with these owner-proof steps. Display/input only — engine untouched.
