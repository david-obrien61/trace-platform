# THUNDER PROMPT — Project-Lens: group ordering + unknown-accounting honesty (one build)

STEP 0 — GATE: Read CLAUDE.md, confirm the 3 Session Starter checks. DISPLAY-layer fix to the
by-project tree (ProjectCostTree.tsx) + the top "unquantified costs" block on /costs. Engine/math
OWNER-PROVEN — do NOT touch computation (CostRollup / CountOnceSeam / analyze / ProjectLens math).
This fixes ORDER and the HONESTY of what's counted/displayed as "unknown" — not the numbers.

Two fixes, same surface, one owner-proof:

=== FIX 1 — Group ordering ===
1. OVERHEAD pinned to TOP — "Overhead" (the company-level group, parent_id null) is ALWAYS the first
   group, never sorted among projects. It's the base layer (costs serving the whole business), not a
   project competing alphabetically. (Note: a separate decision renames "Platform overhead"→"Overhead";
   if that rename isn't applied yet, pin whatever the company-level group is currently labeled — the
   PIN behavior is the ask here, the rename is separate.)
2. PROJECTS below overhead, sorted ALPHANUMERICALLY (A-Z) by name. Today: BuiltWithCAI, CoolRunnings,
   Farm.
3. OWNER-CONTROLLED ORDER via naming (no new UI): alphanumeric sort means an owner can prefix names
   with 1./2./3. or A./B./C. to force order — the prefix is the sort key. No drag-reorder, no order
   column. Falls out of alphanumeric sort + naming freedom.

=== FIX 2 — Unknown-accounting honesty (one consistent definition of "unknown" everywhere) ===
Problem: the top "N unquantified costs" block lists PROJECTS (CoolRunnings, Farm) as if they were
unknown costs — but projects aren't costs, and they're not even unknown (they have captured totals).
It double-represents (lists the project AND the unknown cost under it) and inflates the count.
Separately, Thunder flagged the group-level "unknown" pill does NOT count COST-typed null nodes
(Resend/Twilio) — so the top block OVER-counts (via projects) while group pills UNDER-count. They
disagree on what "unknown" means.

THE RULE — one honest definition, applied everywhere: "unknown" = a COST whose confidence is UNKNOWN
(genuinely no amount). NEVER a project. NEVER a non-unknown cost.

(a) TOP BLOCK lists only genuine UNKNOWN COSTS (e.g. HP ProDesk [if still unknown], Resend, Twilio),
    GROUPED BY PROJECT with the project as a LABEL, not as a listed cost:
      "CoolRunnings: HP ProDesk (unknown)"  /  "Company-level: Resend, Twilio (unknown)"
    The project name gives CONTEXT (where the unknown lives) but is never itself listed AS an unknown
    cost. Count = the real number of unknown COSTS (not projects).
(b) GROUP-LEVEL "unknown" pill counts the same set — including COST-typed null nodes (Resend/Twilio
    under Overhead). Top block and group pills must AGREE on the unknown set. (Display-layer count;
    do not change the engine — just count the COST nulls in the pill.)
(c) CLICK-TO-RESOLVE modal: clicking the top block opens a focused worklist of JUST the unknown costs,
    with the same columns (Cost · Confidence · Project · Amount) and the SAME coherent inline editing
    already built (UNKNOWN→other grade opens the amount field; can't save non-UNKNOWN without an
    amount). Resolving an unknown there drops it off the list and shrinks the block. This turns the
    warning into an actionable worklist — "here are the costs making your number incomplete, fix them."

=== CONSTRAINTS ===
- DISPLAY/INPUT layer only. No change to rollup math, amounts, or the count-once engine. The resolve
  modal reuses the existing coherent inline-edit component (don't build a second editor).
- "unknown" shows only for genuinely-unknown costs; never $0; never projects.
- [TRACE:PROJECTLENS] STAYS ON (standing decision — until Andrew's asset/inventory widget is online +
  tested; do NOT comment out).
- Two-bar: report BUILDER-COMPLETE + owner-proof steps.

OWNER-PROOF David runs on live /costs:
  Ordering: Overhead first → projects alphabetical (BuiltWithCAI, CoolRunnings, Farm) → rename a
    project with "1."/"A." prefix → re-sorts.
  Unknown-accounting: top block lists only unknown COSTS grouped by project-as-label (no project
    listed as a cost; count = real unknowns) → group pills count the same set (Resend/Twilio included)
    → click the block → resolve modal lists just the unknowns with the 4 columns → resolve one inline
    (set ESTIMATED + amount) → it drops off, block count shrinks, totals recompute → genuine unknowns
    still show "unknown" honestly.

Report at BUILDER-COMPLETE with these owner-proof steps. Display/input only — engine untouched.
