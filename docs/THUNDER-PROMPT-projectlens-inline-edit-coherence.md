# THUNDER PROMPT — Project-Lens inline edit + column headers + confidence↔amount coherence

STEP 0 — GATE: Read CLAUDE.md, confirm the 3 Session Starter checks. This is a DISPLAY/INPUT-layer
fix to the by-project tree (ProjectCostTree.tsx). The cost math + unified model are OWNER-PROVEN —
do NOT touch the engine (CostRollup, CountOnceSeam, the analyze/accumulate math). This fixes how the
tree DISPLAYS and EDITS, not what it computes.

CONTEXT — what David found in the live by-project tree (owner-proof passed; these are display/edit gaps):
1. The cost rows have NO column headers — four unlabeled columns (name, a confidence badge, a project
   picker, and a third column). User can't tell what each column is.
2. The third column shows "unknown" even on CONFIRMED rows (e.g. Claude Pro: CONFIRMED … unknown).
   That's a CONTRADICTION — a cost can't be CONFIRMED and unknown-amount at once. Root cause: the
   amount column isn't reading recurring_amount, so it shows "unknown" instead of the real value.
3. Edit is INCONSISTENT: confidence + project are inline-editable, but AMOUNT is not (David changed
   HP ProDesk UNKNOWN→ESTIMATED inline but couldn't set its cost from that screen). 2-of-3 editable.

DECISION (David, 2026-06-17): go FULL INLINE — all three fields (confidence, project, amount)
editable inline in the tree, with column headers, AND with confidence↔amount COHERENCE enforced so
the contradiction can never recur. (There is no modal today; inline-for-all is the slicker, correct
answer — "shows we know how to do business correctly." If inline-for-all were infeasible we'd fall
back to a modal for consistency, but it IS feasible — amount becomes an inline input like the others.)

=== THE FIX (display/input layer only) ===

A) COLUMN HEADERS on the cost rows: Cost · Confidence · Project · Amount. So the table explains itself.

B) AMOUNT column shows the REAL value and is inline-editable:
   - Known costs show their actual amount (e.g. Claude Pro "$110/mo", domains "$200/yr") — editable
     inline, same interaction pattern as the confidence + project pickers already use.
   - Show cadence with the amount where relevant ($/mo vs $/yr) so monthly vs annual is clear.
   - "unknown" appears ONLY when the cost is genuinely UNKNOWN (no amount) — never on a CONFIRMED/
     ESTIMATED/DERIVED row. This kills the contradiction at its source (the column now reads
     recurring_amount instead of defaulting to "unknown").
   - One-time/capex rows (CoolRunnings hardware, tractor) keep showing their one-time amount as today.

C) CONFIDENCE↔AMOUNT COHERENCE (the "do business correctly" part — enforce, don't just display):
   - UNKNOWN is the ONLY confidence allowed to have no amount. (UNKNOWN ⟺ amount empty/null.)
   - Any other confidence (CONFIRMED / DERIVED / ESTIMATED) REQUIRES an amount — cannot save without one.
   - Changing a cost FROM UNKNOWN to any other confidence inline → enable/prompt the amount field
     right there so the user supplies the number (this is exactly David's HP ProDesk flow: set
     ESTIMATED → amount field opens → enter the soft number). 
   - Setting an amount on an UNKNOWN cost → bump confidence to at least ESTIMATED (you now claim a
     number, so you're no longer "unknown").
   - This is the D-9 honesty contract enforced at INPUT: confidence flag and amount can't contradict.
     The CONFIRMED-but-unknown state becomes UNREACHABLE.

=== CONSTRAINTS ===
- DISPLAY/INPUT layer only. Do NOT change the cost math/engine (OWNER-PROVEN). Amount edits write
  recurring_amount (the existing column); confidence writes cost_confidence; project writes parent_id
  — all already wired from the step-7 write path; this surfaces amount inline like the others.
- Preserve project reassignment (the tree's core gesture — already working inline).
- Honesty: known amounts show real values; genuine UNKNOWN shows "unknown" (never $0); the
  coherence rule prevents fake-precision and prevents the contradiction.
- [TRACE:PROJECTLENS] STAYS ON (David's standing decision — until Andrew's asset/inventory add widget
  is online + tested; do NOT comment it out as part of this fix).
- Two-bar completion: report BUILDER-COMPLETE + owner-proof steps. David owner-proves the live UI.

OWNER-PROOF David will run: open /costs by-project tree → columns are labeled (Cost/Confidence/
Project/Amount) → every known cost shows its real amount (Claude Pro $110/mo etc.), no CONFIRMED-but-
unknown contradiction → edit an amount inline + save → recomputes → change a cost UNKNOWN→ESTIMATED
inline → amount field opens, enter value, saves coherently → genuine unknowns (Resend/Twilio) still
show "unknown" honestly → cannot save a non-UNKNOWN cost with no amount (coherence enforced).

Report at BUILDER-COMPLETE with these owner-proof steps. Display/input only — engine untouched.
