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
- **ARCHITECTURE-DECISION** — concrete schema / data-model / structural choices (table shape, FK behavior, edge modeling). Safe in repo.
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

### OP-8 · HAVE / NEED / WANT three-lens recon standard — `[CAPTURED]`
**Decision:** Every verify-before-build / decision recon reports in **three lenses**, and presents OPTIONS
spanning the spectrum between them — NOT one collapsed recommendation:
- **HAVE** — current state, with `file:line` evidence (what actually exists).
- **NEED** — the irreducible minimum to meet the requirement, stripped of all preference.
- **WANT** — the desired end-state / clean architecture, explicitly LABELED as a want.
The recon then lays out options spanning **NEED → WANT** (cheapest-meets-need → fullest-meets-want), so the
real trade space is visible. A recon that does not separate the three lenses is **incomplete** — bound as a
recon/LOOK gate in CLAUDE.md, same enforcement pattern as STD-003 (OP-4) and the widget-header gate ([[OP-4]]),
so it fires whether or not a prompt asks for it.
**Reasoning:** Collapsing NEED and WANT hides options and smuggles wants in as requirements — the recon
arrives pre-decided and the trade space never surfaces. Separating them forces the cheapest-meets-need option
onto the table next to the clean-architecture option, and makes "is this a need or a want?" an explicit,
testable question. **Proven by A/B test on the asset-node schema decision (2026-06-15):** the flat A/B/C first
run was re-run through HAVE/NEED/WANT and produced strictly more — two NEW options (D defer-rename, E
view-bridge), killed objections (B's data-migration cost, A's dominance), and an UPGRADED rationale (one-table
moved from a tidiness-WANT to a structural edge-NEED) — same final call (C), but firmer and wider. The three
lenses earned their keep on option-coverage and rationale, not by overturning the answer. Re-test on drift:
does a recon present HAVE/NEED/WANT with options across the spectrum, or a single pre-collapsed recommendation?
**Canonical home:** this entry · `CLAUDE.md` (recon/LOOK gate) · `docs/operating-doctrine/lightning-david-partnership.md`
§17 (doctrine). Worked exemplar: `docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md`.
**Date captured:** 2026-06-15 · **Status:** Active doctrine / enforced gate.

---

## ARCHITECTURE-DECISION

### D-1 · Schema approach C (rename-in-place) for cost-object node model — `[CAPTURED]`
**Decision:** `business_assets` renamed in place to `cost_objects`; node fields added in place.
**Reasoning:** §5.2 attribution edges are cross-node-type (ASSET→PROJECT→PRODUCT) → need ONE
FK-able id-space → "one table" is a structural NEED, not a preference. C dominates: no data
migration (`business_assets` ~0 rows beyond UI inserts), FK dependents auto-carry on rename, no
permanent-drift risk (vs bridge/view approaches). Confirmed catalog-proven at build: rename landed,
2 FK dependents auto-carried with CASCADE intact.
**Canonical home:** `docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md` (3-lens decision) ·
migration `supabase/migrations/20260615_cost_objects_rename_and_node_schema.sql` · design `COST-TO-PRODUCE-DESIGN.md` §5.2.
**Date captured:** 2026-06-15 · **Status:** Active / built (Core-1, BUILDER-COMPLETE).

### D-2 · FK child column stays `asset_id` (not renamed to `cost_object_id`) — `[CAPTURED]`
**Decision:** `business_pmi_schedule.asset_id` and `business_service_log.asset_id` keep the name
`asset_id` after the parent rename.
**Reasoning:** PMI and service-log are asset-maintenance tables that reference ASSET nodes
specifically — `asset_id` is semantically correct for them even though the parent table is now
node-general. Renaming would churn 8+ call sites for zero functional gain; parent rename is
transparent to the child column. Blast-radius minimization.
**Canonical home:** migration `20260615_cost_objects_rename_and_node_schema.sql` (FK column-name decision block).
**Date captured:** 2026-06-15 · **Status:** Active / built (Core-1).

### D-3 · `parent_id` ON DELETE SET NULL (orphan-to-root, never cascade-destroy) — `[CAPTURED]`
**Decision:** `cost_objects.parent_id` self-FK uses ON DELETE SET NULL.
**Reasoning:** cascade-destroy would mean deleting a project nukes its assets — but an asset
OUTLIVES the product/project it served (§5.9). SET NULL = asset falls back to root/domain when its
parent is removed, with no owner "revert" action required. This is graceful degradation ([[OP-6]])
expressed at the DB level: the honest fallback state is automatic.
**Canonical home:** migration `20260615_cost_objects_rename_and_node_schema.sql` (parent_id column) · design `COST-TO-PRODUCE-DESIGN.md` §5.9 · [[OP-6]].
**Date captured:** 2026-06-15 · **Status:** Active / built (Core-1).

### D-4 · Two edge tables: structural (`cost_object_edges`) vs temporal (`cost_object_assignments`) — `[CAPTURED]`
**Decision:** Attribution modeled as two tables — `cost_object_edges` (containment + contribution
DAG, carries `use_fraction` + basis) and `cost_object_assignments` (time-bounded, `start_at`/
`end_at`, `conversion_cost`).
**Reasoning:** Structural containment/contribution is a different axis from temporal assignment;
collapsing them into one table would force a single row to mean both "A is part of B" and "A was
assigned to B from T1 to T2." Separating them keeps each edge's semantics clean.
**Consequence for Core-2:** the rollup must traverse BOTH tables, and count-once enforcement (§14
slice-seam) must reason across both — the highest-risk seam inherits this split.
**Canonical home:** migration `20260615_cost_objects_rename_and_node_schema.sql` (§4a/§4b edge tables) · design `COST-TO-PRODUCE-DESIGN.md` §5.2 / §5.9 / §14.
**Date captured:** 2026-06-15 · **Status:** Active / built (Core-1).

### D-5 · Cost event is truth; receipt is a signal AND a substantiation marker; we surface, not reconcile — `[CAPTURED]`
**Decision:** The accumulator models the **COST EVENT** as the unit of truth. Receipts, vendor feeds,
QB lines, service-logs, asset-entries, and config-lines are **SIGNALS** that an event occurred — not the
event itself. Every cost carries **two independent axes**:
1. **amount confidence** — `CONFIRMED` / `DERIVED` / `ESTIMATED` / `UNKNOWN`
2. **substantiation** — `SUBSTANTIATED` (has a document) / `OWNER-ASSERTED` (typed, no proof)

**Count-once = count each EVENT once across N signals** (the same purchase arriving via card-feed *and* a
forwarded text is one event, two signals). Capex events accumulate on the node; recurring events flow to
the ÷N period pool. `receipt_id` is **demoted from key to one high-confidence / substantiating signal**.
**Reasoning:** In real owner-operator use the receipt is the *least* reliable element — forgotten, doubled,
or fed twice from a vendor channel under a different id for the same purchase. So count-once cannot key on
`receipt_id` alone. Separately: a real operating cost the owner incurred (e.g. a $50 fuel filter recalled
from memory) MUST be surfaced so he sees his true cost-to-operate — that is the hidden-cost problem we exist
to solve. But without a receipt that cost is unsubstantiated: his accountant likely cannot deduct it, a
tax-time dollar loss he'd otherwise eat silently. The platform **SURFACES** this (count the cost + flag
substantiation-at-risk + make capture the easy path) and explicitly does **NOT** do bookkeeping or assert
deductibility — that is the accountant's domain. This flips labor from owner to tool (anti-Nelson, [[OP-5]])
without crossing into accounting.

**FOUNDING EVIDENCE (the real-world case this resolves):** the owner's actual workspace is a pile of
uncaptured paper, scattered email/SMS receipts, and curling thermal slips. Hidden operating costs (car wash,
small parts, fuel-filter-from-memory) evaporate not because the owner is negligent but because the only
capture path is after-the-fact reconciliation AT a desk — which is the Nelson model (labor pushed onto the
owner). **DIRECTION OF LABOR (corrects "make the owner capture"):** the signals already exist and are
abundant — email, SMS/text, card-statement feed, physical receipts. What's scarce is **frictionless capture
at the moment cost happens.** The platform intercepts the signal where it is born (point of purchase,
drag-from-email, forward-a-text, card-feed) so the pile never forms. This is *why* count-once must treat the
receipt as a SIGNAL not a spine: the same car wash may arrive as a card-feed line AND a forwarded text — two
signals, one event. NON-GOAL stands: surface cost + substantiation-at-risk; do not do the owner's bookkeeping
or claim deductibility.
**Consequence for Core-2:** Core-2a carries **both axes** through the seam (no UI yet). Core-2b: full
multi-signal event reconcile (AI-proposes / owner-confirms, [[OP-7]]) + the substantiation-at-risk surfacing.
The count-once enforcement at the §14 slice-seam keys on the EVENT, not on `receipt_id`.
**Companion principles:** [[OP-5]] (anti-Nelson — labor off the owner), [[OP-6]] (works when the owner does
nothing — unsubstantiated costs still surface, flagged), [[OP-7]] (multi-signal reconcile is infer→propose→confirm).
**Canonical home:** this entry · design `COST-TO-PRODUCE-DESIGN.md` §14 / §5.4 (the seam this resolves).
**NON-GOAL:** bookkeeping / tax filing / deductibility claims — accountant's domain, explicitly out of scope.
**Date captured:** 2026-06-15 · **Status:** Active doctrine / design (Core-2 pending build).

---

### D-6 · Surface the decision-changing few, not the complete many (the data ceiling) — `[CAPTURED]`
**Decision:** The platform's job is to surface the **SMALL** number of hidden costs that **change an
owner's decision** — not to show everything the data can see. The split is asymmetric by design:
**catch-everything (capture), surface-almost-nothing (display)** — only what moves a decision reaches the
owner.
**Reasoning:** More data improves decisions only up to the point the owner can act on it; past that ceiling
it causes paralysis, false confidence, and signal-drowning. This is the wargaming finding — perfect
battlefield information still produces wrong decisions, because **data quality and decision quality are
different axes.** Dumping N categorized transactions on the owner rebuilds the perfect-information /
wrong-decision failure mode. The value is in surfacing the **surprising few** (e.g. "6 car washes, $90,
never counted"), then **stopping.** This DISCIPLINES every "should we show them X?" question — the default
is **no** unless X changes a decision.
**Companion principles:** [[OP-5]] (good-enough — build to the point of owner action, not past it). Sets the
display-side discipline that pairs with [[D-5]]'s capture-side abundance (catch all signals, surface few costs).
**Canonical home:** this entry.
**Date captured:** 2026-06-15 · **Status:** Active doctrine.

---

### D-7 · Card is not the unit of truth, and not a proxy for business-vs-personal — `[CAPTURED]`
**Decision:** Cost classification is by **EVENT** (what was bought, for what purpose) — **never** by which
card or account paid. A charge's card tells you almost nothing about business-vs-personal.
**Reasoning (founding reality, David's actual finances):** the personal card carries mixed business +
personal; the business card is clean EXCEPT when maxed → business costs then fall back onto the personal
card; the spouse's points card is mostly personal but **recently carries business purchases the accountant
doesn't yet know about.** No card cleanly maps to business-vs-personal. This is the strongest case for
[[D-5]] (event-is-truth): the card and the receipt are **signals, not keys.**
**Consequence:** AI-proposes / owner-confirms classification ([[OP-7]]) is **load-bearing, not optional** —
the owner is the only one who knows a given charge's purpose. It also names a strong hidden-cost surface:
**business costs sitting on cards the books don't reflect.**
**Companion principles:** [[D-5]] (card/receipt are signals not keys), [[OP-7]] (classification = infer →
propose → confirm, because only the owner knows purpose).
**Canonical home:** this entry.
**Date captured:** 2026-06-15 · **Status:** Active doctrine.

---

### D-8 · Cost carries a usage-coupling shape: RECURRING-FIXED vs PER-OCCASION — `[CAPTURED]`
**Decision:** Every cost carries a **shape**. **RECURRING-FIXED** = subscription, **usage-decoupled**, paid
on a cadence regardless of use (→ ÷N monthly pool). **PER-OCCASION** = a discrete event (a one-off purchase
or service). The same merchant category can be **either** — the shape, not the category, decides where the
cost belongs.
**Reasoning (founding case — David's car-wash subscriptions):** $9.99/month per vehicle, billed whether or
not the car is washed, whether or not the owner travels for a month. Usage is **decoupled** from cost —
which is exactly why it hides: small, automatic, paid without being felt. The recurring-fixed subscription
is the hidden-cost **ARCHETYPE** (the [[D-6]] decision-changing few). A one-off cash wash at $15 is
per-occasion — **different shape, same category.** The engine must distinguish them, because one belongs in
the monthly pool and one is a discrete event.
**Companion principles:** [[D-5]] (cost event is truth — the shape is a property of the event), [[D-6]]
(recurring-fixed is the archetype of the surprising few worth surfacing).
**Canonical home:** this entry.
**Date captured:** 2026-06-15 · **Status:** Active doctrine.

---

### D-9 · The honesty contract: KNOW / THINK / REASON / NEED-CLARIFICATION, and acceptance is the pivot — `[CAPTURED]`
**Decision:** Every output the cost engine surfaces is **labeled by epistemic state** — **KNOW**
(substantiated + certain; stated flat), **THINK** (inferred, labeled as inference), **REASON** (the
derivation shown, not just the verdict), **NEED-CLARIFICATION** (data-unresolvable ambiguity → a real
question with a **SUGGESTED disposition** + candidate interpretations; a first-class outcome, not a
failure). The platform **NEVER** auto-categorizes ambiguous costs as if certain. A cost moves **SUGGESTED →
owner disposes (ACCEPTED / REJECTED / EDITED) → counted.** **NOTHING counts as business cost until
ACCEPTED.**
**Reasoning:** Auto-categorizing wrong is worse than asking — one confident error poisons trust in every
number, including the correct ones (**credibility is fragile, not additive**). Asking BUILDS credibility: it
shows the system knows the limits of what it knows. The AI's job is to make acceptance **CHEAP** — surface a
hidden cost AND propose a plausible home ("car wash often = vehicle maintenance; business or personal?") so
the owner accepts with one tap instead of constructing the answer himself (labor flip; a blank "what is
this?" is the Nelson model). Acceptance is the **capture of owner INTENT** — business-vs-personal,
which-asset, why — the one signal no receipt, feed, or AI can supply ([[D-7]]: owner is sole source). This
RESOLVES the [[D-6]] tension: surface **GENEROUSLY** as suggestions (wide discovery net, zero credibility
cost because a suggestion makes no claim) but **COUNT** nothing until accepted. Disposition is also a
**learning signal** — it teaches the system this owner's cost reality, sharpening later suggestions. This is
surface-honesty applied to **CONFIDENCE itself**, and it is the differentiator vs auto-categorizing
competitors (QB/Dext/Expensify) whose buried uncertainty surfaces as silent error at tax time. Governs
**ALL** engine output, not just `sameCost()`.
**Companion principles:** [[D-5]] (event is truth), [[D-6]] (surface the decision-changing few), [[D-7]]
(owner is sole source of intent), [[D-8]] (cost shape is one of the things proposed and accepted), [[OP-5]]
(good-enough + AI-as-equalizer), [[OP-6]] (graceful degradation), [[OP-7]] (AI infers → proposes → owner
confirms — the mechanism acceptance rides on).
**Canonical home:** this entry.
**Date captured:** 2026-06-15 · **Status:** Active doctrine.

---

### D-10 · Cost-to-Produce primary lens is BY PROJECT, not flat business pool — `[CAPTURED]`
**Decision:** The lens David actually thinks in — and the one the `/costs` surface should make
**primary** — is **Company (TRACE) → Project (CoolRunnings / BuiltWithCAI / each vertical) → the costs
associated to that project**, with cost entry able to **ASSIGN an item to a project**. The current
`/costs` tile shows a correct but **FLAT business-level pool (÷N)**; that is the **company-total** cut and
stays as the top-line. The project-grouped cut is **added**, not substituted. **Both cuts are valid** — flat
= company total, rollup = per-project — and this surfaces an existing capability rather than introducing new
architecture.
**Reasoning (already-built bones — this is surfacing, not new architecture):** (1) `cost_objects.node_type`
already includes **PROJECT** and the `parent_id` self-FK already exists ([[D-1]] Core-1) → a PROJECT node
with cost children via `parent_id` **IS** "a project with its costs." (2) `CostRollup.ts` (Core-2b SUB-2)
already traverses **both** edge tables ([[D-4]]) for a per-node rollup → "CoolRunnings + all under it" already
computes; it simply isn't surfaced as a grouped view. (3) Core-2b deliberately kept the **business level
FLAT (count-once)** because rollup-sum **double-counts** parent+child at business scope ([[D-7]] flat
top-line) — so the flat feed is the company-total view (**keep**) and rollup is the **per-project** surface
(**surface it**). Adding the project cut does **not** alter the honesty engine ([[D-9]]), which is
**OWNER-PROVEN correct as-is**.
**Verify-first finding (this session, read-only):** **CONFIRMED FLAT.** The **only** insert path into
`cost_objects` is the asset form in `packages/cultivar-os/src/pages/BusinessAssets.tsx:173-194`, which
hardcodes `node_type:'ASSET'` and **never writes `parent_id`** → every UI-created row is a **flat, parentless
ASSET node**. No UI creates `PROJECT` nodes and no UI sets `parent_id`. The schema axes (PROJECT node_type +
`parent_id` self-FK) exist but are **unpopulated** by any cost-entry path. `CostToProduce.tsx:96` reads
`node_type` but selects no `parent_id` and does no grouping. David's Image-3 read (everything flat) is
correct — that is the scope of the gap below.
**Companion principles:** [[D-1]] (one node table, PROJECT node_type + parent_id), [[D-4]] (dual-edge rollup
the project cut reads through), [[D-7]] (flat business top-line is the count-once truth — rollup is the
per-node cut, not a replacement), [[D-9]] (honesty engine unchanged — OWNER-PROVEN).
**Canonical home:** this entry · NAMED GAP in `docs/built-inventory.md` (project-grouped cost view +
parent-picker on cost entry — UNBUILT) · `CostRollup.ts` (per-node rollup the project view reads through).
**Full UI design:** [`docs/DECISION-project-lens-ui-design.md`](DECISION-project-lens-ui-design.md) — extends
this decision with the tree / tenant-as-root / single-parent / overhead / click-to-edit / reassignment design.
**Cost model that reshapes the lens:** [`docs/DECISION-small-business-cost-accounting-model.md`](DECISION-small-business-cost-accounting-model.md)
— the small-business cost-accounting model (CapEx / COGS / OpEx + payback & margin) that the project lens
groups and rolls up; supersedes/absorbs the narrower [`DECISION-unified-cost-model-option2.md`](DECISION-unified-cost-model-option2.md) framing.
**Nested projects + the deferred BI insight wedge:** [`docs/DECISION-nested-projects-and-BI-whatif-blocker.md`](DECISION-nested-projects-and-BI-whatif-blocker.md)
— projects nest (single-parent holds, no migration; rollup recurses); "Platform overhead" → "Overhead";
the BI-Claude what-if / blocker insight layer is the deferred wedge until the cost spine is rich enough.
**Date captured:** 2026-06-16 · **Status:** Active decision — surfacing UNBUILT (verify-first done).

---

## PERSONAL-FINANCIAL

> Not in this file by design — see **`decisions/PERSONAL-FINANCIAL.local.md`** (gitignored).
> Covers: David's draw model + cap, family contractor billing structure, Option C house-sale draw
> trigger, and the personal reconsider-triggers (OP-3 criteria).
