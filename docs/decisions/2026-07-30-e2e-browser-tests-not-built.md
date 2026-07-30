# DECISION · Browser E2E automation is NOT built — the owner-test board is the executor

**Date:** 2026-07-30 · **Status:** ACCEPTED (David ruled in session) · **Class:** TESTING STRATEGY
**Applies to:** the 21 E2E-tier rows in the 2026-07-30 test inventory, and any future surface test
that would otherwise reach for Playwright / Cypress / Selenium.

---

## Decision

**We do not build browser-automation E2E, and the 21 E2E rows in the test inventory are NOT a gap.**
They are already covered by a working process: the standing owner-test boards in
`docs/owner-tests/`, executed by David under OP-14.

This is recorded as a DECISION and not left as a count so that **nobody later reads "0 of 21" as an
omission and starts building it.** That misreading is the specific outcome this file exists to
prevent — a future session seeing an empty column and inferring neglect.

---

## Reasoning

**1. The tests already exist; they have a human executor rather than a machine one.** Every one of
the 21 is already written as an owner-test card with SETUP, PASS, FAIL and a SIGNAL to look for.
They are not unwritten — 47 cards exist across five boards. What is absent is automation, not
acceptance criteria.

**2. OP-14 already says a machine may not close them.** *"Thunder never marks a card `covered` —
only David's live run does."* A Playwright suite could not flip a card to `covered` without
violating that rule, so it would run **beside** the existing process, never instead of it. **Two
systems answering one question is STD-011**, and the drift between them is what makes a test
unbelievable.

**3. Standard-by-value (§6 r10) — this is the SKIP direction, and it is explicit.** Browser E2E is
the industry-standard answer to "prove the screen works." Adopting it here buys us a second
maintained system (selectors, waits, fixtures, a flake budget, CI that does not exist — there is no
`.github` in this repo) to replace a process that currently works and that the owner runs anyway
before every close-out. **"It's the standard" is never sufficient justification on its own.**

**4. The machine/human split is real, not a compromise.** The harness ruling of the same day states
it: *a machine proves the POLICY is correct; a human proves a REAL MEMBER is configured correctly
and the SCREEN tells the truth.* The RLS harness (`scripts/lib/memberSession.mjs`) automates the
first because it is automatable. The second is a person reading a page — which is what an owner-test
card is. E2E automation would be an attempt to automate the half that is defined by human judgment.

---

## What this does NOT say

- **It does not say browser behaviour is unimportant.** It is the most important half — it is where
  the buyer stands. It says the proof belongs to David, not to a runner.
- **It does not say E2E is forbidden forever.** See the trigger below.
- **It does not cover the 48 DB-tier tests.** Those ARE being automated, on the RLS harness, and
  their absence IS a gap. The two tiers are decided differently and on different grounds.

---

## Trigger to revisit

Converge on browser automation when **any** of these becomes true — this is the "trigger to
converge back" §6 r10 requires of a below-standard divergence:

1. **A second person** runs owner-tests. The board scales to one committed executor; it does not
   scale to a team, and a shared manual checklist rots.
2. **A paying customer exists** and the DEPLOY-TO-LIVE bar (§9, currently DORMANT) activates. A
   promotion boundary with real customer data wants a mechanical pre-flight.
3. **A card regresses twice** on the same surface. Two regressions is the rule-of-three warning that
   a human pass is missing something a machine would catch every time.
4. **CI exists.** The economics change completely once something runs the suite without a person
   choosing to.

---

## Provenance

Thunder's recommendation in the 2026-07-30 test inventory; **ruled by David in session the same
day**, quoting the reasoning back: *"those 21 are the owner-test cards, they have a human executor
by OP-14, and Playwright would be a second system replacing a process that works."*

**Related:** OP-14 (owner-test coverage) · §6 r10 (standard-by-value) · STD-011 (one representation)
· `docs/owner-tests/*.md` (the executor) · the RLS harness decision of the same day (the DB tier,
decided the opposite way and for the opposite reason).
