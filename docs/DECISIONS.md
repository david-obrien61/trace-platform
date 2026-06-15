# TRACE — DECISIONS LEDGER
**Type:** Canonical home for business / policy / operating decisions — not strategy prose, not code
**Created:** 2026-06-14 (THUNDER SWEEP — capture undocumented decisions + lay the floor for this class)
**Status:** Active · append as decisions are made

---

## Why this file exists

Technical state has homes — `BUILT-INVENTORY.md`, `PLATFORM_STATE.md`, the architecture docs.
**Business, policy, strategy, and operating decisions did not.** They got *made* in conversation
and then evaporated — so they got re-litigated. This file is that missing home for the class.

**This is a drift-detection reference, not just a record.** When we suspect we're drifting from
core principles, we re-address the decisions here against current behavior: does what we are
actually building/charging/doing still match the decision and — more importantly — its *reasoning*?
That is why every entry carries its **reasoning**: a decision you can't re-test is a decision you
can't detect drift from.

**Companion files — read together:**
- `decisions/override-log.md` — append-only red-team override record (which seat objected, why overridden). Narrower scope: load-bearing decisions that survived a red-team pass.
- `docs/operating-doctrine/lightning-david-partnership.md` — *how* David + Lightning decide (the working-relationship doctrine). This ledger is *what* was decided.
- **`decisions/PERSONAL-FINANCIAL.local.md`** — ⚠️ **gitignored, local-only.** Personal-financial and personal-sensitive decisions (draw model, house-sale trigger, family billing figures, the personal reconsider-triggers) live there, NOT here, because this repo is read by the family/team. See "Sensitivity split" below.

## Tagging scheme

Every decision is tagged so it can be re-addressed by class:

- **BUSINESS-DOCTRINE** — how TRACE treats customers, money, data. Customer-facing policy. Safe in repo.
- **OPERATING-PRINCIPLE** — how the work itself is run (method, register, when-to-reconsider framework). Safe in repo.
- **PERSONAL-FINANCIAL** — David's draw, family compensation figures, personal triggers. **NOT in this file** — see local file.

## How to use (audit-wins rule)

When a fuller treatment exists in a canonical doc, this ledger **points** to it (cite + line) rather
than copying — the cited doc is authority; this is the index. CAPTURED entries hold the decision in
full because no other canonical home existed. On any behavior change, re-validate against the reasoning.

## Sensitivity split (flagged for David)

Personal-financial decisions and the personal reconsider-triggers (which name family members,
health, and the marriage) do **not** belong in a file the sons read. They are captured in
**`decisions/PERSONAL-FINANCIAL.local.md`**, which is **gitignored** (stays on David's machine,
never pushed). **Proposed, not final — David decides final placement** (gitignored local file vs.
the `~/.claude/.../memory/` store vs. somewhere off-repo entirely).
⚠️ **Pre-existing exposure, separate from this sweep:** `THOUGHTS.md` is git-tracked and already
contains the draw figures, house-sale context, VA amounts, and the Regina trigger. This sweep did
not put them there and does not remove them — flagging so David can decide whether THOUGHTS.md's
in-repo placement of that content is acceptable.

---

## BUSINESS-DOCTRINE

### BD-1 · Customer departure / data policy — `[POINTER]`
**Decision:** On departure the customer takes what they paid for (their data); TRACE removes its
identifiable copy; only aggregate patterns are retained.
**Reasoning:** Non-extractive default = a moat (lower churn, higher referral) + the honest treatment
the covenant promises. Already canonical, do not re-litigate.
**Canonical home:** `STANDARDS.md:539-540` (BENCH-C PII handling) · `docs/operating-doctrine/lightning-david-partnership.md:101` (decisions table, round 5).
**Date:** pre-2026-06-14 · **Status:** Active / canonical.

### BD-2 · Trial mechanic — `[POINTER]`
**Decision:** 2 weeks all-on (full Tier 2 / PREMIER). Trial ends → Core stays, Pro becomes "the
power layer you tried." Always framed as what they **KEEP**, never what we **TAKE**.
**Reasoning:** The capture capability (the necessity) is never paywalled; the intelligence layer is
the optional upside. Conversion is earned by experienced value, not by feature-gate coercion.
**Canonical home:** `docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md:594-601` · `MASTER_BRIEF.md:199-210` (Trial Engine day-by-day).
**Date:** pre-2026-06-14 · **Status:** Active / canonical.

### BD-3 · Fuzz mechanic (activation-value) — `[CAPTURED]`
**Decision:** Deactivated / unconfigured tiles still **display** on the dashboard, **fuzzed**, showing
an **aggregate dollar estimate** (real data, detail hidden) of what activating that tile is worth.
The tile is honest about its value *and* honest that it's currently off.
**Reasoning:** It's the non-extractive conversion mechanic. The customer is never lied to (the dollar
figure is real, computed from their own data) and never locked out (they can stay in fuzz mode
indefinitely). Honesty *is* the conversion path — the inverse of paywall coercion. Cousin mechanic:
the post-trial savings-widget fuzz for churned subscribers (`THOUGHTS.md:862-960`, `MASTER_BRIEF`
Trial Engine day-15 "data visible but blurred").
**Open / pending build:** exact computation of the per-tile aggregate estimate is a build-time detail
(the `LockedOverlay.tsx` + data-blur components already exist in `packages/shared`). Not yet spec'd.
**Date captured:** 2026-06-14 (decided earlier; only in THOUGHTS log until now) · **Status:** Doctrine locked, build pending.

### BD-4 · Anti-exploitation stance — `[POINTER]`
**Decision:** Charge for value delivered (real AI / engine / maintenance cost, not arbitrary markup);
give away the necessity (capture). The exploiter paywalls capture — TRACE makes the necessity cheap
and the upside optional.
**Reasoning:** Locked-rate covenant + cheap necessity is structurally un-copyable by a VC-funded
extractive competitor. Re-test against any future pricing change: are we charging for value, or
gating a necessity?
**Canonical home:** `docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md:606-610`.
**Date:** pre-2026-06-14 · **Status:** Active / canonical.

---

## OPERATING-PRINCIPLE

### OP-1 · "Any ethical means within the covenant" — `[CAPTURED]`
**Decision:** Objective is a wildly successful business that crushes competition. Method is **any
*ethical* means within the covenant** — not Scott Morrison's "any means." The covenant is load-bearing.
**Reasoning:** Ethics is the *competitive method*, not a constraint on it: covenant principles are
inherently good **and** produce better commercial outcomes (better relationships → lower churn →
higher referral → lower CAC), and non-extractive defaults are a moat no VC-funded competitor can
copy without changing their whole model. Legacy goal attached: a multi-generational O'Brien business
where each generation **operates** (inheriting an operating structure produces operators, not
beneficiaries) — structures must survive David and Regina with operational capability intact.
**Canonical home before now:** `THOUGHTS.md:705-712` only (chronological log, not a reference).
**Date captured:** 2026-06-14 · **Status:** Active doctrine.

### OP-2 · Composite working register — `[POINTER]`
**Decision:** Lightning operates in a composite voice — Doug (verification), Darren (directness),
Binder (synthesis), Scott Morrison (prepared British-sarcasm / dry edge when David's about to do
something dumb or Lightning's about to drift to safe synthesis). David invited the Scott Morrison
register. The conversation is the corrector, not either party.
**Reasoning:** Calibrated pushback — not deferential, not contrarian — produces better output than
either sycophancy or contrarianism. The register is the mechanism that keeps the covenant honest.
**Canonical home:** `docs/operating-doctrine/lightning-david-partnership.md` §2 (covenant / "conversation is the corrector") + §3 (the registers) + §4 (failure modes).
**Date:** 2026-06-03 · **Status:** Active / canonical.

### OP-3 · "This isn't working" reconsider-framework — `[CAPTURED — framework here; criteria in local file]`
**Decision:** There is a defined set of triggers (five hard + one soft) for when to stop and
reconsider. They are **decision points, not failure points** — at each the question is "what
specifically *changes*?" not "do we quit?"
**Reasoning:** The framework keeps decision-making rational under pressure — pre-committing the
questions prevents a trigger firing from becoming a panic or a sunk-cost spiral. It is the explicit
check on the "keep moving / don't second-guess" operating principle.
**⚠️ The actual criteria are personal-sensitive** (they name family disengagement, the marriage, and
health) → captured in **`decisions/PERSONAL-FINANCIAL.local.md`**, NOT here. The criteria ARE
recoverable from the repo (`THOUGHTS.md:764-790`, restated `1555-1575`) — not invented.
**Date captured:** 2026-06-14 (established 2026-06-02) · **Status:** Active framework.

### OP-4 · STD-003 instrumentation-as-gate + two completion bars — `[CAPTURED]`
**Decision:** Instrumentation (`[TRACE:area]`) is born ON and stays ON by default on every build that
adds/changes a capability — never flagged-off, never silent, never deleted — and is COMMENTED OUT only
after **owner-proof**. A build has two completion bars: **BUILDER-COMPLETE** (Thunder: builds pass,
verified vs data / service-key round-trip) and **OWNER-PROVEN** (David: used through the real UI under
real RLS). Debug stays on between the bars; builder-complete does NOT authorize removing it — only
owner-proof does. Bound as an enforced gate in CLAUDE.md §9 + Session Starter and partnership doc §16,
with the same force as the widget-header gate.
**Reasoning:** Instrumentation is born-on so the thing it was added to catch stays visible while the
feature is unproven; silencing it before proof defeats the instrument. Owner-proof through the real UI
is the only bar that retires debug, because a builder test can pass while the RLS/UI path still fails —
demonstrated 2026-06-14 by the Cost-to-Produce service-key round-trip passing while UI-save under RLS
stayed unproven. STD-003 was written in STANDARDS.md but went unenforced (applied only when a prompt
remembered it) — the same-session Cost-to-Produce build shipped without it. Making it a gate, not a
memory, is the fix: written ≠ enforced. Re-test on drift: are new builds shipping debug ON until David
proves them, or is debug being stripped/silenced at builder-complete?
**Canonical home:** `STANDARDS.md` STD-003 (the standard) · `CLAUDE.md` §9 + §10 (the gate) ·
`docs/operating-doctrine/lightning-david-partnership.md` §16 (the doctrine).
**Date captured:** 2026-06-14 · **Status:** Active doctrine / enforced gate.

### OP-5 · Good-enough model + AI-as-equalizer (the design north star) — `[CAPTURED]`
**Decision:** Build the **good-enough** model and let AI close the gap to precision. Do NOT engineer the
perfect mousetrap that demands meticulous labor the owner will never give. When choosing between an
elaborate-but-precise build and a simple-but-AI-assisted one, the tiebreaker **defaults to simple + AI
equalizer** unless the elaborate path is proven necessary.
**Reasoning:** A model that requires meticulous owner bookkeeping turns the platform INTO the accountant —
the exact anti-Nelson failure the platform exists to avoid (we pull labor off the owner, we do not push it
on). AI is what makes "good enough" actually good: cheap signals the owner already generates + inference
close the precision gap that manual data entry would otherwise demand. Re-test on drift: is a new build
asking the owner to maintain records they won't maintain? If so, it has drifted from good-enough toward
perfect-mousetrap — flip it to simple + AI.
**Companion principles:** [[OP-6]] is the floor this must hold to (it must work when the owner does
nothing); [[OP-7]] is the mechanism (AI does the bookkeeping labor as one-tap proposals).
**Canonical home:** this entry (design discussion 2026-06-15) · applied in `COST-TO-PRODUCE-DESIGN.md` §5.9.
**Date captured:** 2026-06-15 · **Status:** Active doctrine / design north star.

### OP-6 · Graceful degradation / fidelity tiers — `[CAPTURED]`
**Decision:** Every model MUST produce honest value when the owner does **nothing**. Three fidelity tiers:
- **(a) owner maintains it** — rare; clean records, full precision.
- **(b) owner confirms inferred transitions** — achievable; system proposes, owner taps once (see OP-7).
- **(c) owner does nothing** — default/common; cost sits at its last-known state, **flagged unconfirmed**,
  honest-but-imprecise.
The model MUST work at tier (c). A model that only works at tier (a) is a product that fails its own customer.
**Reasoning:** The owner-does-nothing case is not the edge case — it is the common case. A model that lies
when unmaintained (false precision) or blocks when unmaintained (demands data entry) fails the actual user.
Honest-but-imprecise (cost held at last-known, confidence-tagged) is always available and never lies. Re-test
on drift: does the feature still return an honest number when the owner ignores it for a month?
**Companion principles:** the floor that [[OP-5]] builds to; tier (b) is achievable only because of [[OP-7]] —
without AI-propose, the middle tier collapses to manual reassignment the owner won't do.
**Canonical home:** this entry · applied in `COST-TO-PRODUCE-DESIGN.md` §5.9 (cost_confidence on allocations,
fallback-to-domain).
**Date captured:** 2026-06-15 · **Status:** Active doctrine.

### OP-7 · AI infers → proposes → owner confirms (BuiltwithCAI earning its keep) — `[CAPTURED]`
**Decision:** AI reads the cheap signals the owner ALREADY generates (receipts, activity shifts, feed
purchases) and **PROPOSES** the expensive records they'd never hand-keep (asset reassignment, cost
allocation, receipt↔item reconciliation, project transitions) as **one-tap confirmations**. AI does the
bookkeeping labor; the owner does one tap. AI **NEVER auto-commits a structural change** — it surfaces with
a confidence tag, the owner is the authority, and anything unconfirmed stays in the honest-degraded state
(OP-6 tier c), confidence-tagged.
**Reasoning:** This is the MECHANISM that makes OP-6's middle tier (b) achievable — without AI-propose,
tier (b) collapses to manual reassignment, which the owner won't do, so the system falls to tier (c) for
everything. A confident-wrong auto-committed record is WORSE than no record (a silent data lie — the failure
mode this project has repeatedly bled from), so AI proposes and never commits structure on its own. This is
the anti-Nelson flip operationalized: labor comes OFF the owner, not onto them. It generalizes across the
platform — reconciliation, allocation, and lifecycle transitions all use this same infer→propose→confirm move.
**Companion principles:** the mechanism behind [[OP-5]] (AI closes the precision gap) and [[OP-6]] (makes
tier b real).
**Canonical home:** this entry · applied in `COST-TO-PRODUCE-DESIGN.md` §5.9 (AI-inferred reassignment,
allocation confidence).
**Date captured:** 2026-06-15 · **Status:** Active doctrine.

---

## PERSONAL-FINANCIAL

> Not in this file by design — see **`decisions/PERSONAL-FINANCIAL.local.md`** (gitignored).
> Covers: David's draw model + cap, family contractor billing structure, Option C house-sale draw
> trigger, and the personal reconsider-triggers (OP-3 criteria).
