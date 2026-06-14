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

---

## PERSONAL-FINANCIAL

> Not in this file by design — see **`decisions/PERSONAL-FINANCIAL.local.md`** (gitignored).
> Covers: David's draw model + cap, family contractor billing structure, Option C house-sale draw
> trigger, and the personal reconsider-triggers (OP-3 criteria).
