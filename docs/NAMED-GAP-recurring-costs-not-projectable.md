# NAMED GAP — Recurring Costs Are Not Projectable Yet (config vs cost_objects split)
**Captured:** 2026-06-16
**Status:** GAP identified during project-lens owner-proof. The project-lens (D-10) is OWNER-PROVEN
and works — this is the NEXT gap it surfaces, not a bug in it. Build NOT started; decision needed.

---

## What happened (owner-proof outcome)

The project-lens passed owner-proof:
- Tree shows TRACE Enterprises as named root, "Platform overhead" $10,000 one-time, CoolRunnings
  $417.31 one-time (= NSPanel 259.80 + MINI Duo-L 65.70 + meross 91.81 — exactly as predicted).
- Reassignment proven live: moving each asset into CoolRunnings dropped the root and raised
  CoolRunnings in lockstep (10417.31→10157.51→10091.81→10000 at root; 259.80→325.50→417.31 at
  CoolRunnings). MOVE-not-copy + honest re-derive through the seam confirmed — totals conserved.
- LAWNS tenant isolation holds.

Then David hit the gap: the costs on the **Settings page** (Claude Pro, Gemini Advanced, TX sales
tax, Infrastructure, Claude API usage, domains) **cannot be associated to a project.** He asked: are
they orphaned, and how do I assign them (e.g. domains/Gemini → BuiltWithCAI)?

---

## The distinction (why this happens)

There are TWO different kinds of cost in two different tables:

1. **Assets / capex → `cost_objects`** (NSPanel, meross, ProDesk, tractor). These HAVE `parent_id`,
   so the project-lens tree's parent-picker can reassign them. **This works.**
2. **Recurring / monthly costs → `business_modules.config`** (Claude Pro, Gemini, domains, TX tax,
   API usage). These are NOT `cost_objects` rows. They have **no `parent_id`** — so the project-lens
   (which operates only on `cost_objects`) cannot reach them.

**They are NOT orphaned — they live in a different system the project-lens doesn't read yet.** This
is the same split Thunder flagged when it deferred cadence-edit: "recurring lives in
business_modules.config, not cost_objects."

**Consequence:** the costs David most wants to assign to projects (domains, Gemini, Anthropic API →
BuiltWithCAI) are exactly the recurring ones — which aren't projectable yet. The project-lens today
groups only the capex/asset costs. The recurring costs remain in the flat config pool (which is why
the top-line $12,239.67/mo is still flat / not broken out by project).

---

## The decision needed (architectural fork — decide deliberately)

How to make recurring costs projectable:

**Option 1 — add a project field to the recurring config lines.**
Add a project/parent reference to `business_modules.config` cost lines; teach the project-lens to
read recurring costs from config (grouped by project) alongside capex from cost_objects.
- Pro: cheaper near-term; recurring stays where it is.
- Con: two representations of "a cost" persist (config lines + cost_objects); the lens has to merge
  two sources.

**Option 2 — migrate recurring costs into `cost_objects`.**
Make recurring costs first-class cost_objects rows (node_type PRODUCT or a recurring flag; cadence as
a real column), so they get parent_id for free and the existing project-lens just works on them.
- Pro: one cost engine (D-10 spirit — "one cost engine, honest at boundary"); retires the parallel
  config representation; cadence-edit becomes real (closes that deferred item too).
- Con: bigger change; migration of existing config lines; touches the recurring-cost read path the
  flat tile depends on (must stay honest/unbroken during).

**Lightning's lean (for the fresh-session decision, not locked):** Option 2 is the "one cost engine"
endgame and also closes the deferred cadence-edit gap — but Option 1 is the cheaper near-term unblock
if the goal is just "see recurring costs by project soon." Decide based on appetite: unify now (2) or
unblock cheap (1).

---

## Sequencing

- Project-lens (capex/assets by project) is DONE + owner-proven. This gap is the *recurring* half.
- Decide Option 1 vs 2 fresh (not at the end of a long sprint).
- Whichever: the honesty engine (D-9) and the flat top-line must stay correct/unbroken — recurring
  costs feed the flat /mo pool the per-customer price depends on.
- The QBO /api/qbo/status 500 (tech-debt #34) is still firing in the console — unrelated, not
  blocking, still open.
