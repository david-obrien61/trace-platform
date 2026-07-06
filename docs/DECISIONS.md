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

### OP-9 · The Regina Principle — the surfacing engine (the product north star) — `[POINTER]`
**Decision:** The platform's job is to **surface owner-known business principles against existing data, so the
action becomes visible at the right moment and place** — moving the labor of *noticing what to do* off the
owner's head and onto the tool. The owner already HAS the data and KNOWS the principles; what they can't do is
visualize the action hiding inside their own data. Each principle = an owner head-rule + the data it runs on +
the action it surfaces (warranty-by-window, new-service-to-proven-buyer, consult-to-expand, proximity-to-route —
a GROWING list). The surfacing ENGINE is separate from the LENS that shows it (list/morning-briefing first, no
map; map is the north-star proximity lens, a Kind-2 vendor + API-neutrality call). Surfaced precision is shown
honestly on the [[D-9]] ladder (plant date is DERIVED from sale date, never false-CONFIRMED) — a human
follow-up prompt, not an automated legal deadline.
**Reasoning:** This is the anti-Nelson flip ([[OP-5]], [[OP-7]]) applied to customer relationships and revenue,
not just cost: labor comes OFF the owner. Anchor story — **Regina**: she bought trees, we planted them, the data
knows; months later the engine surfaces her when the owner is driving past, and one reminder compounds into three
services in one visit (courtesy check → soft upsell → free consult) → trust → repeat business → word of mouth.
The pitch is not "we schedule deliveries" but "a delivery run becomes three sales you'd otherwise have missed."
Key dependency: **services are UNMODELED** and are the spine the chain hangs on (open question: cost-ledger
object vs JOB-like object — resolve when services is built). Build path proves the thesis cheaply first:
principles → list (data we already hold) → services model + seed → principles → map.
**Companion principles:** [[OP-5]]/[[OP-7]] (anti-Nelson, labor off the owner); [[D-9]] (honesty ladder on
surfaced precision); [[OP-6]] (works when the owner does nothing).
**Canonical home:** `MASTER_BRIEF.md` PART 4 — THE SUGGESTION ENGINE (full doctrine + worked example + flywheel
+ principle set + dependency ledger + build path). The "Regina moment" is also cited in PART 1's Two Pitches.
**Date captured:** 2026-06-22 · **Status:** Active doctrine / product north star (build deferred; thesis durable).

### OP-10 · Structure-Last — the structure tax is paid by the MACHINE, not the human — `[CAPTURED]`
**Class:** OPERATING-PRINCIPLE / PLATFORM-PRINCIPLE (cross-cutting — governs every capture, schema, and onboarding surface).
**Decision:** The original sin of enterprise software is **"structure first, then we'll help"** — the human must pre-organize
reality into the machine's schema *before* the machine does anything useful. With an LLM as the parser, **invert it**: take
input **however it arrives** (voice, photo, typed, a scraped website, a QuickBooks export) and let **structure emerge on READ.**
The grower's "structured mess" already IS structure — it is just **latent**. The **structure tax is paid by the MACHINE, in the
backend, where it is cheap** — **never by the human, up front, where it is the wall that kept them out.**
**Reasoning (the economic spine):** arbitrage **the falling cost of machine-structuring against the flat cost of human-
structuring.** Asking the owner to pre-categorize is asking them to pay a tax that gets *more* expensive relative to the
alternative every year an LLM gets cheaper — and it is exactly what incumbents are structured against and cannot follow without
abandoning their data-entry-first products. This is the upstream principle behind the [[OP-5]] anti-Nelson flip (labor off the
owner), [[D-9]] (the system reasons about confidence so the human doesn't have to assert it), and the [[NORTH-STAR]] "dump the
stream, the system sorts it" core job. Re-test on drift: **does a new surface ask the owner to structure their world before it
helps? If so it has drifted — push the structuring into the backend.**
**THE SMALL-GROWER EXPRESSION (this principle, field-confirmed):** ~**88%** of scraped growers have **NO per-item structure**
(name-only, no SKU, no per-item URL — see the [grower-resolve recon](decisions/2026-06-26-grower-resolve-design.md): 12.4%
slug-capable / 87.6% name-only / 0% real SKU). **CONFIRMED in the field** at **Barryhill** (a 4.5★ full-service garden center):
*"no official inventory system,"* the POS is sales-only and does not decrement, *"QR is not even set up,"* buyers **track stock in
their heads.** We do **not** tell them they are wrong. We drive the **cost-of-feeding-the-system toward zero**: the system **builds
itself from work they already do** (the [walk-and-count](../user_stories.md) IS the catalog-building — ledger #61); capture meets
them **in their own words** ([[D-26]] dual lexicon); it **pays back before it asks for discipline** ([[OP-5]]/[[OP-6]]); and the
accumulated **fit becomes a switching cost THEY built**, not one we imposed.
**Companion principles:** [[OP-5]]/[[OP-6]]/[[OP-7]] (anti-Nelson — labor off the owner is the *consequence* of structure-last),
[[D-9]] (machine reasons about confidence), [[D-23]] (faithful view = their structured-mess preserved), [[D-24]] (rigid-spine /
flexible-edge = WHERE the machine pays the structure tax), [[D-26]] (dual lexicon — capture in their words), [[AC-1]] (variation
in data, not schema). Named alongside VERIFY-BEFORE-BUILD in `TRACE-SESSION-BOOTSTRAP.md` ⚡ OPERATING FACTS.
**Canonical home:** THIS entry · `TRACE-SESSION-BOOTSTRAP.md` ⚡ OPERATING FACTS (the named principle) · `NORTH-STAR.md` (the
"dump the stream" core job it implements). Origin: 27–29 June 2026 strategy session (master-banked 2026-06-29).
**Date captured:** 2026-06-29 · **Status:** Active doctrine / platform principle.

---

### OP-11 · Reconcile on both bars — OWNER-PROVEN triggers the flip — `[POINTER]`
**Class:** OPERATING-PRINCIPLE (close-out doctrine — governs how the canonical status surfaces stay honest).
**Decision:** The BUILDER-COMPLETE reconciliation gate keeps the docs from drifting behind what is BUILT; this is its sibling on
the second bar. **An OWNER-PROVEN report (single or batch) triggers an immediate 🟡→🟢 flip across ALL canonical surfaces** — ⚡
ACTIVE STATUS · 📋 24-board · `built-inventory.md` · 🧵 ARC-MAP · any mapped `user_story` — as the FIRST action that session, with
`Last updated:` bumped and the flipped caps named in the write-back. **A stale 🟡 on an owner-proven capability is DRIFT
(tech-debt #39 class), same force as the BUILDER-COMPLETE reconciliation gate.** The two gates are the two bars of the two-bar
rule made self-maintaining: BUILDER-COMPLETE reconciles *what exists*, OWNER-PROVEN reconciles *what's proven.*
**Reasoning:** owner-proof-owed 🟡s re-accumulated because nothing forced the flip when David reported a proof; binding it as a
gate on the OWNER-PROVEN bar closes that leak the same way the ledger gate closed the BUILDER-COMPLETE leak.
**Canonical home (full text lives there, NOT duplicated here):** `CLAUDE.md` §9 STANDING INSTRUCTION (owner-proven reconcile gate)
· `docs/operating-doctrine/end-of-session-protocol.md` → GATE — BUILT-INVENTORY RECONCILIATION (SIBLING GATE — OWNER-PROVEN
RECONCILIATION). Companion: the BUILDER-COMPLETE reconciliation gate (its first-bar sibling).
**Date captured:** 2026-07-03 · **Status:** Active doctrine (ratified by David 2026-07-03).

### OP-12 · Reference-first promotion — the live boundary is crossed only by promoting a reference-proven artifact — `[CAPTURED]`
**Class:** OPERATING-PRINCIPLE (release discipline — governs how code/schema reaches production once real customer data exists).
**Decision:** Once a paying customer exists, **no code or schema reaches production except by promotion of an artifact already OWNER-PROVEN on the REFERENCE environment** (the disposable break-freely duplicate; see the fourth completion bar). Two promotions, different risk: **CODE** promotes as a git / environment-target operation (reversible via revert + redeploy). **SCHEMA is the dangerous one** — the migration applied to LIVE must be **BYTE-IDENTICAL** to the one proven on reference, applied in order, with **NO hand-edits at the boundary.** The failure mode this guards against is DRIFT: proving migration N on reference, then hand-applying a subtly-different N to live under deadline pressure. Given David applies SQL by hand as `postgres`, the rule is explicit — **the reference-proven migration file is the artifact promoted verbatim; live is never hand-authored.** **DORMANT until the first paying customer; ratified now so the discipline predates the pressure.**
**Reasoning:** run-and-gun velocity is worth keeping right up to the live boundary — but the moment real customer data is at stake, an unproven or drifted change is expensive to undo. Binding promotion to a reference-proven artifact keeps the fast loop AND makes the live crossing deliberate and reversible. Byte-identical schema promotion closes the specific hole hand-applied SQL opens under pressure.
**Companion principles:** the fourth completion bar — **DEPLOY TO LIVE** (`CLAUDE.md` §9, its sibling in the completion/promotion discipline), [[OP-11]] (reconcile-on-both-bars — the status-honesty gate on the OWNER-PROVEN bar that precedes promotion), [[OP-4]] (the completion-bars model this extends). NOT a duplicate of OP-11.
**Canonical home:** `CLAUDE.md` §9 (the fourth completion bar — DEPLOY TO LIVE) · THIS entry (the promotion rule). **David action to stand up the reference environment:** `user_stories.md` → DAVID ACTIONS.
**Date captured:** 2026-07-03 · **Status:** CAPTURED doctrine — **DORMANT until the first paying customer** (no paying customer today).

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

### D-11 · Cost Category dimension is Schedule C–aligned / QBO-mappable (adopt the standard, don't invent) — `[POINTER]`
**Decision:** Every cost carries a **category** drawn from the standard small-business chart of accounts
(IRS Schedule C / QBO chart-of-accounts), NOT a TRACE-invented taxonomy. This is the dimension behind the
categorized P&L top block and the spreadsheet-grid view. Orthogonal to the existing axes — PROJECT
(`parent_id`, [[D-10]]) × NATURE (CapEx/COGS/OpEx) × SHAPE ([[D-8]]) × **CATEGORY** (this). Labor categories
(category=labor / contract-labor) live inside this dimension and hand off to [[D-12]].
**Why a pointer:** full taxonomy + QBO mapping + grid design live in the canonical doc; this entry exists so
the category dimension is discoverable from the ledger as next-build foundation.
**Canonical home:** [`docs/DECISION-cost-category-dimension.md`](DECISION-cost-category-dimension.md).
**Companion:** [[D-8]] (shape), [[D-10]] (project lens this categorizes), [[D-12]] (labor categories),
`DECISION-small-business-cost-accounting-model.md` (the CapEx/COGS/OpEx nature axis).
**Date captured:** 2026-06-17 · **Status:** Canonical — adopt the standard; next-build foundation (UNBUILT).

### D-12 · Labor Cost Model — robust schema now, UI depth incremental, intelligence deferred — `[POINTER]`
**Decision:** Build the labor MODEL **robust now** (fully-burdened rate, cost-vs-bill, Schedule C
employee-vs-contractor), **populate to the depth each business needs**, and **defer the analysis/what-if
intelligence** until real data populates the spine. Labor is a category inside the [[D-11]] dimension, not a
bolt-on. Margin-sensitivity is itself a what-if → links forward to the deferred BI wedge.
**Why a pointer:** research grounding + schema spine + the incremental-depth / deferred-intelligence staging
live in the canonical doc; this entry makes the labor model discoverable from the ledger.
**Canonical home:** [`docs/DECISION-labor-cost-model.md`](DECISION-labor-cost-model.md).
**Companion:** [[D-11]] (category dimension labor lives in), [[D-10]] (project lens), `DECISION-small-business-cost-accounting-model.md`,
`DECISION-nested-projects-and-BI-whatif-blocker.md` (margin-sensitivity = a what-if, deferred).
**Date captured:** 2026-06-17 · **Status:** Canonical model decision; next-build foundation (UNBUILT).

### D-13 · Unified margin store + cost/margin history — DEFERRED (future cross-vertical arc) — `[POINTER]`
**Decision:** The margin ENGINE is already shared and correct (`MarginEngine.ts` — stateless pure
calculator both verticals feed); the divergence is in STORAGE. Margin is stored in 4 fragmented places
(Cultivar's `config.margin` blob + Ignition's 3 stores, the DB one orphaned/display-only), and there is
**no DB-level cost/margin history anywhere** (last-write-wins). Target = ONE DB-backed RLS margin store
the engine reads + a history table, landed WITH/AFTER the BI what-if layer. Real debt, breaks nothing
today → **deferred**, not near-term.
**Why a pointer:** the full storage inventory + history finding live in the canonical doc; this entry
makes the deferred consolidation discoverable from the ledger.
**Canonical home:** [`docs/DECISION-unified-margin-store-and-history.md`](DECISION-unified-margin-store-and-history.md).
**Companion:** [[D-11]] (category dimension), [[D-12]] (labor model), `DECISION-nested-projects-and-BI-whatif-blocker.md`
(the BI wedge this sequences with).
**Date captured:** 2026-06-18 · **Status:** DEFERRED — future arc, sequenced with/after BI (UNBUILT).

### D-14 · Cost attribution follows consumption; shared cost flows by use-fraction carve-out — `[POINTER]`
**Decision:** Attribution follows CONSUMPTION, not design intent — a cost is vertical-specific only while
exactly ONE vertical consumes it; a 2nd adopter promotes it to shared (mirrors the code-sharing rule).
Shared (80%) cost reaches a vertical by a cross-branch **use_fraction carve-out** (the same primitive as
personal→business — the `cost_object_edges.use_fraction` of [[D-4]] / PATH A), conserved (carved +
BuiltWithCAI remainder ≤ 1.0, never multiplied).
**Cost truth ≠ price strategy** from the same data: a vertical's drill-in shows its ACTUAL burden (today
Cultivar is the sole consumer → its carved share ≈ 1.0, and the books must SHOW that — Surface Honesty),
while PRICING is its own 20% specific + amortized fair share of the 80% + margin (loading the full platform
burden on the sole customer is a pricing error, not a cost error). **Unrecovered platform investment**
(shared incurred − shared recovered) is a first-class surfaced number that dilutes as verticals onboard.
**Why a pointer:** the five sub-decisions, deferred basis knob, and build sequencing live in the canonical
doc; this entry makes the attribution/pricing model discoverable from the ledger.
**Canonical home:** [`docs/DECISION-cost-attribution-and-shared-cost.md`](DECISION-cost-attribution-and-shared-cost.md).
**Companion:** [[D-10]] (project lens — the cost cut this prices), [[D-11]] (category dimension), [[D-13]]
(unified margin store — Phase 2 pricing sequences with it), `DECISION-nested-projects-and-BI-whatif-blocker.md`.
**Date captured:** 2026-06-18 · **Status:** ACCEPTED. Phase 1 (cost-only drill-in) building now; Phase 2 (pricing) deferred.

---

### D-15 · Cost object is the COMPRESSED industry-standard cost record — adopt/deviate/add/skip, each logged — `[POINTER]`
**Decision:** Start from the industry-standard small-business cost record; deviate deliberately to solve OUR
problem; document every deviation. Build the 20% a two-person business needs — NOT full GAAP. Each field on
`cost_objects` is tagged: **ADOPTED** (spine: amount, name/description, type via [[D-1]] node_type; source-doc
ref = `receipt_id` ([[D-5]]); context tags `parent_id` ([[D-10]]) / `resource_id` ([[D-12]]) / nature / shape
([[D-8]])), **DEVIATED** (dedup = receipt_id + line identity, not receipt_id alone; `cost_category` Schedule
C–narrowed per [[D-11]]), **ADDED** (`cost_confidence` ladder — honest estimate over fake-precise zero,
[[OP-5]] / [[D-9]]), **SKIPPED** (double-entry debits/credits / trial balance — the bookkeeping engine, left
to QuickBooks). Mission frame: give a small business the cost capacity of a large company's accounting
department, at a scaled price, by replacing the department with AI + owner + builder.
**Why a pointer:** the field-by-field adopt/deviate/add/skip table + the standard-record reference live in the
canonical doc; this entry settles the cost object so future builds CONFORM rather than rediscover it.
**Canonical home:** [`docs/DECISION-cost-object-model-of-record.md`](DECISION-cost-object-model-of-record.md).
**Companion:** [[D-1]] (node model), [[D-5]] (receipt as signal + substantiation), [[D-8]] (shape), [[D-9]]
(honesty contract), [[D-10]] (project lens), [[D-11]] (category dimension), [[D-12]] (labor model), [[OP-5]]
(good-enough + AI-as-equalizer).
**Date captured:** 2026-06-18 · **Status:** ACCEPTED.

---

### D-16 · Pricing is set by COST-TO-SERVE + a separate payback line, NOT fully-loaded cost (Model B) — `[POINTER]`
**Decision:** Price = cost-to-serve ÷ N ÷ (1 − margin); founder/platform labor is INVESTMENT recovered on a
separate **payback line** ("at this price and N, the platform investment recovers in X months"), NEVER divided
into the per-unit price. Subscription shape (BuiltWithCAI/Cultivar — what TRACE charges) uses an N_customers
denominator; product shape (LAWNS — what the nursery charges) uses a per-item denominator. **Same MarginEngine,
same cost spine; only the DENOMINATOR and FEED vary by business shape — unit of production is config, not engine
branching ([[AC-1]]).** Model A (fully-loaded: divide the whole floor — mostly founder labor — by N) was
**rejected** — it makes low-N prices unsellable ($11,323 ÷ 10 ≈ $1,913/customer) and conflates investment with
cost-of-goods (the root of the untrustworthy old $149 guesstimate). Investment recovers over time across volume,
not per-unit. **Build dependency:** computing cost-to-serve requires separating, per cost object, COST-TO-SERVE
(marginal/per-tenant) from PLATFORM INVESTMENT (founder labor on the spine) — the honesty/confidence stack
([[D-9]]) is unchanged, a soft cost-to-serve yields a soft price.
**Why a pointer:** the model formulas, the Model-A rejection, and the build dependency live in the canonical doc.
**Canonical home:** [`docs/DECISION-pricing-model.md`](DECISION-pricing-model.md).
**Companion:** [[D-12]] (labor — the investment being recovered), [[D-13]] (margin store — where target_margin
will live), [[D-14]] (carve-out — fair-share of shared cost feeds cost-to-serve), [[D-15]] (cost-object model).
**Date captured:** 2026-06-19 · **Status:** ACCEPTED. Phase 2 (dials + payback line) deferred to post-recon.

---

### D-17 · One pricing engine, four display surfaces, three audiences — prospects never see owner economics — `[POINTER]`
**Decision:** The Model B engine ([[D-16]]) is ONE computation; WHERE its output displays depends on the
AUDIENCE. Four surfaces, three audiences, never conflated: (1) **/costs table** — OWNER's authoritative readout,
real numbers from the real cost record (EXISTS; made honest by 2b/2c); (2) **the estimator** (severed Block 1,
read-only to the cost model — [[D-14]].6) — OWNER's WHAT-IF scratchpad, same math fed by HYPOTHETICAL inputs,
NEVER written to the books (EXISTS read-only; what-if compute is a future build — read-only-to-the-model is the
correct role, not a limitation); (3) **customer-facing price view** — PROSPECT's view (LAWNS/Lauren, an Ignition
buyer), shows THEIR price + value, MUST NOT show cost-to-serve, labor, margin, or payback (does NOT exist —
future); (4) **decision record** — the captured, dated, durable priced-decision, not re-derived each time (does
NOT exist — future). One line: /costs shows WHAT IS · the estimator explores WHAT IF · the customer view shows
THEIR PRICE · the record captures WHAT WAS DECIDED.
**Why a pointer:** the surface-by-surface definitions + the audience-separation rule + the build sequencing live
in the canonical doc; this entry settles that the surfaces stay distinct so future builds CONFORM.
**Canonical home:** [`docs/DECISION-pricing-display-surfaces.md`](DECISION-pricing-display-surfaces.md).
**Companion:** [[D-16]] (the one engine these surfaces display), [[D-14]] (estimator sever — surface 2's role),
[[D-9]] (honesty contract — soft cost-to-serve yields a soft price on every surface).
**Sequencing:** build nothing until 2b/2c computes honest Model B; then (a) estimator what-if, (b) decision
record, (c) customer view last (needs a settled price to present).
**Date captured:** 2026-06-19 · **Status:** ACCEPTED.

---

### D-18 · Platform overhead is HAND-ALLOCATED across verticals; platform = computed remainder, guarded at 100% — `[POINTER]`
**Decision (amends [[D-14]]):** TRACE's shared-spine overhead (founder/platform labor $11,200/mo, shared
domains/APIs) is allocated across TRACE's OWN verticals (Farm, Real Estate, BuiltWithCAI, Cultivar, Ignition…) by
OWNER HAND-SET shares — NOT an automatic even or usage split — because the verticals are few and lopsided in
platform usage (Farm uses almost nothing; BuiltWithCAI is heavy). **Platform's share is the COMPUTED REMAINDER**
(100% − sum(vertical shares)), never typed; a large remainder is legitimate overhead the owner has consciously
chosen not to push onto a vertical yet. **Over-allocation guard is structural:** because platform = remainder,
sum > 100% computes a NEGATIVE remainder → RED, cannot save — TRACE can never claim >100% of any overhead pool.
On a NEW entrant the system SUGGESTS a default starting share (configurable, default 20%) and shows the impact,
but does NOT apply it and does NOT propose rebalancing existing shares (Option A over a rebalance-suggesting
Option B — auto-rebalance would creep back to the rejected auto-split); the owner rebalances by hand. **Suggested
vs CONFIRMED provenance mirrors the recovery_basis derived/explicit pattern** — a suggested share is visually
distinct until the owner accepts/edits it. A SOLE active vertical may be hand-set to 100% (remainder 0). Overhead
ALLOCATION (what % of the shared spine a vertical carries) is kept distinct from cost ATTRIBUTION (a specific cost
object that belongs to a vertical gets that vertical's parent_id) — two seams, not conflated.
**Why a pointer:** the seven rules, the hand-vs-auto rationale, the attribution/allocation distinction, the
LAWNS-out-of-scope note, and the sequencing live in the canonical doc.
**Canonical home:** [`docs/DECISION-platform-overhead-carveout.md`](DECISION-platform-overhead-carveout.md).
**Companion:** [[D-14]] (amended — fair-share of shared cost feeds cost-to-serve), [[D-16]] (Model B — per-vertical
price = vertical cost-to-serve ÷ N + carved fair-share of platform overhead).
**Out of scope:** a customer (LAWNS) allocates ITS overhead per-item (overhead ÷ units sold), not by hand-weighted
vertical shares — rides with the deferred [[D-16]] LAWNS per-item pricing feed; only the universal "never >100% of
any overhead pool" guard is shared.
**Sequencing:** build the carve-out engine BEFORE the per-vertical drill-in price (per-vertical price needs the
carved fair-share); until then the drill-in correctly footnotes "fair-share platform cost added next."
**Date captured:** 2026-06-19 · **Status:** ACCEPTED.

---

### D-19 · A priced service carries THREE cost layers; the hidden third is OPPORTUNITY COST (the cost of pulled labor) — `[CAPTURED]`
**Decision:** A priced service (LAWNS charges $400 to plant trees) carries **three cost layers**, not one. The
owner sees only the lump sum and so under-prices service work without knowing why they're busy-but-not-profitable.
The cost engine's scope is to surface all three:

1. **Direct cost** — what the JOB consumes: labor hours + materials (mulch, fertilizer) + the visit (fuel). This
   is what the cost-to-produce engine already models ([[D-10]] project lens, [[D-12]] labor). On a $400 install,
   ~$100.
2. **Decomposed price (legibility / trust)** — the same $400 shown as its parts: 2 hr labor + $45 mulch + $45
   fertilizer + $10 fuel + margin. **The number does not change; its LEGIBILITY does.** A lump "$400" reads as
   "too much"; the breakdown reads as fair. This is the customer-facing VIEW of layer 1 — **one source, many
   views**: the cost ledger is the source, the owner's margin view and the customer's justification view are two
   lenses (it IS [[D-17]] surface 3, the customer-facing price view). David's own reaction is the proof — he sees
   "$400" and balks until he sees it broken down; the customer does exactly the same.
3. **Opportunity cost — the cost of ABSENCE (the hidden, genuinely novel layer).** When crew (Juan) plants trees
   3 days a week, Juan is NOT at the farm those days. The farm work does not vanish — it goes undone or someone
   backfills it (overtime / an extra hire / the owner). Pull Juan AND Jose and the farm is short two people and
   someone scrambles. This cost is **real**, is **caused by the planting job**, and appears on **no invoice** —
   because an absence is not a line item. So a $400 install that looks profitable against $100 direct cost may be
   thin or negative once the farm's lost throughput during those crew-days is counted.

**Reasoning (the anti-Nelson thesis applied to opportunity cost):** the owner KNOWS intuitively that pulling crew
hurts the farm — they FEEL the scramble — but cannot QUANTIFY it, so they price as if it's free. That is the exact
[[OP-5]]/[[OP-7]] failure the platform exists to flip: the labor of *computing the absence* comes OFF the owner's
head and ONTO the tool. The platform can quantify it because it already models labor as a resource ([[D-12]]
`labor_resources`) and knows the job consumes crew-days. The surfaced insight: *"this $400 install consumes 2
crew-days; the farm loses ~$X of normal throughput during them; true job cost is ~$Y, not $100."* Same surfacing
spine as the customer-relations engine ([[OP-9]] Regina Principle) — make visible a cost the owner's own head
knows exists but cannot compute — pointed at COST instead of revenue. The point is not precision; it is making the
ABSENCE VISIBLE so service work stops being priced as if the farm runs itself while the crew is away.

**The new primitive this requires (a dependency, NOT a build here):** to cost an absence the model needs a notion
of a resource's **VALUE AT ITS PRIMARY WORK** — e.g. an owner-set *"a farm crew-day is worth ~$X to me."* Rough is
fine. The [[D-9]] confidence ladder carries it honestly: this is **ESTIMATED**, labeled as such (*"you told us a
farm crew-day is ~$300, so this install's true cost including pulled labor is ~$700"*) — never false-CONFIRMED. A
soft value-at-primary-work yields a soft opportunity cost, surfaced with its softness shown, same discipline as a
soft cost-to-serve yielding a soft price ([[D-16]]). The absence is attributable like any other cost — it is a
cost the JOB causes, so it attributes to the job's project ([[D-14]] attribution-follows-consumption).

**This RESOLVES the services-model open question** (`MASTER_BRIEF.md` PART 4, the "is a service a cost-ledger
object or a JOB-like object?" question, currently captured-not-resolved): the $400 decomposition answers it —
**PLANTING is JOB-LIKE** (labor + materials + visit, and it leaves a warranty clock ticking after the visit ends),
**a 30-gal Live Oak is a PRODUCT** (cost-to-produce + price). The **JOB-like service object is the single
structural foundation** that unlocks all three layers above AND the invoice-audit (missing-charge detection,
`MASTER_BRIEF.md` line 182) AND the Regina-chain relationship services ([[OP-9]]). **Settle it once, shared
([[AC-4]] structural design shared / [[AC-1]] unit-of-production is config, not a vertical noun)** — audit,
decomposition, opportunity-cost, and relationship-services all hang off the one object. (This SHARPENS, does not
replace, anything built: layers 1 and the labor substrate exist; layer 2 is [[D-17]] surface 3; layer 3 and the
value-at-primary-work primitive are net-new and deferred.)

**Companion principles:** [[OP-5]]/[[OP-7]] (anti-Nelson — labor of computing the absence comes off the owner),
[[OP-9]] (Regina Principle — same surfacing spine, pointed at cost), [[D-9]] (confidence ladder carries
value-at-primary-work as ESTIMATED), [[D-12]] (labor model — the resource substrate the absence is computed
against), [[D-14]] (attribution — the absence attributes to the job that caused it), [[D-16]] (soft input → soft
output; opportunity cost feeds true job cost feeds price), [[D-17]] (layer 2 = customer-facing price view, surface
3), [[D-10]] (project lens — where job cost rolls up).
**Canonical home:** this entry (no other doc held the three-layer / opportunity-cost thesis or the
value-at-primary-work primitive). The services-model resolution is cross-referenced FROM `MASTER_BRIEF.md` PART 4;
its open-question passage should gain a one-line "→ resolved, see D-19" pointer on a future MASTER_BRIEF edit (not
taken here, to honor the docs-only single-doc scope).
**Date captured:** 2026-06-25 · **Status:** CAPTURED doctrine. Layer 3 (opportunity cost) + the value-at-primary-work
primitive + the JOB-like service object are net-new and DEFERRED — built when the services model is built; demo-seedable.

---

### D-20 · Geocoder needs ZERO new serverless functions — two keys, fold into `ingest.ts`, stand up at front-door re-staging — `[CAPTURED]`
**Decision:** Enabling a geocoder (Google) for the three address-aware consumers — address-validation @ signup, the
customer map, and the geo-seeder — forces NO 13th serverless function and is NOT blocked on the Hobby 12-function
ceiling ([[tech-debt #41]]). The deployed surface stays **12/12**. The Vercel Pro upgrade is therefore **NOT a
prerequisite** for the geocoder. The real net-new infra is **env keys, not functions** — and there are **two distinct
keys**, one secret-server and one referrer-locked-browser, which must NOT be the same key.

**The three consumers and how each is wired (verified, file:line-grounded against the 2026-06-26 recon):**
- **Address-validation @ signup** → a new `action='validate-address'` branch on the EXISTING
  `api/discovery/ingest.ts` multiplexer (server-side). Same additive consolidation already used by
  `populate` / `compare` / `cost-apply` / `cost-discovery` / `send`. The entered address is already available in the
  `compare` branch (reads the `businesses` row via the service key). Returns `{valid, formatted, lat, lng, confidence}`
  for the reveal to raise. **ZERO new functions.**
- **Customer map** → client-side Google Maps JS in the browser (no map page exists today — `DeliveryRoute` only
  builds a string URL). Not a serverless function at all. **ZERO new functions.**
- **Geo-seeder** → a CLI/batch script under `scripts/` (not deployed, never counts toward the ceiling). If it ever needs
  to run on-demand, it becomes another `ingest.ts` action. **ZERO new functions.**

**The two keys (the only net-new infra):**
- A **secret server-side Geocoding key** (e.g. `GOOGLE_GEOCODING_API_KEY`) — read via `process.env` inside the
  `ingest.ts` branch, never bundled; same trust class as `ANTHROPIC_API_KEY` / `SUPABASE_SERVICE_KEY`.
- A **referrer-locked browser Maps-JS key** — exposed in the bundle by design (like the Supabase anon key), but it
  MUST be HTTP-referrer-restricted to `cultivar-os.vercel.app` (+ `.app`/`.com` if served there) and API-restricted to
  the Maps JavaScript API only.
- **Do NOT reuse the secret server key in the browser.** The owner sets a **daily quota cap** on the Google keys to
  control spend.

**Verdict:** function count stays **12/12**; the geocoder does NOT block on the Hobby ceiling.

**TIMING (when to stand it up):** **at the front-door re-staging build** — that's when the address-validation branch is
first exercised (the no-website path on screen 1). Standing the keys up earlier just parks an unused key. The customer
map is independent and can come whenever the visual lens is wanted. The current queue (nav fix, datasheet inventory
view) is geocoder-free and unaffected by this.

**Companion:** [[D-14]] / [[D-16]] (the address branch feeds the per-vertical/per-job cost & pricing surfaces), the
front-door arc (the address-conflict reveal where validation lands — ledger #47, [[deferred address→geocode branch]]).
**Canonical home:** this entry + the recon at
[`docs/decisions/2026-06-26-front-door-arc-recon.md`](decisions/2026-06-26-front-door-arc-recon.md).
**Date captured:** 2026-06-26 · **Status:** CAPTURED — DEFERRED. No code/keys this pass; stand up the two keys as part
of the front-door re-staging build.

---

### D-21 · DESIGN LAW — Screen real estate is sacred; direct access over scroll (platform-wide) — `[CAPTURED]`
**Class:** DESIGN-LAW (cross-cutting UX doctrine — governs every surface in every vertical, not a single-feature decision).
**Decision:** No surface forces the user to scroll to find or see what they're working on. **Density is the default, not
the polish.** This applies EVERYWHERE — onboarding, the discovery reveal, settings, admin, inventory, every vertical,
every tile, every future build — not only where it has been retrofitted. Four concrete rules:

1. **DIRECT ACCESS.** Where a menu/index exists, sections are reachable directly — the menu is the *table of contents*;
   clicking a section lands the user on JUST that section, not a long page they scroll through. Parent nav items (Admin,
   Settings, etc.) land on a short INDEX/landing, never a data wall.
2. **COLLAPSIBLE SECTIONS.** Where blocks must coexist on one screen, they are genuinely collapsible — with a VISIBLE
   collapse control the user can actually operate (not merely "default-open" with no affordance). Expand/collapse is
   FREE: opening one never force-closes another; multiple may be open; the user may expand all. **No forced accordion.**
3. **DENSE LISTS.** High-volume lists get a dense / datasheet / grid view, not an endless scroll-list (e.g. inventory at
   100+ items).
4. **COMPACT CHROME.** Navigation and chrome are compact and do not consume the page.

**Reasoning (why this exists — it names one principle that was being re-invented per surface):** the LAWNS-era scroll
problems were not separate UI bugs — they were ONE missing principle re-discovered on every screen: the onboarding /
discovery reveal scrolling ~3 pages of stacked conflict cards; the long single-page Settings (Business Profile +
Accounting + Services + Cost config stacked open); the 111-item inventory scroll-list; the loose / page-height nav
drawer. Naming the law ONCE stops the re-fight — a build prompt cites D-21 instead of re-arguing density from scratch,
and owner-prove checks against it instead of catching each scroll regression ad hoc.

**ENFORCEMENT — DOCTRINE, not (yet) an automated gate.** Cited in relevant build prompts and verified at OWNER-PROVE.
An automated "too-scrolly" check is hard to mechanize and would miss real cases; human owner-prove is the reliable check
today. Gate-level teeth may be added later if a mechanical check becomes feasible (deliberate divergence-below-standard
under [[OP-8]]/[[CLAUDE.md §6 rule 10]] — recorded, not silent: the lighter form suffices because owner-prove already
walks every surface).

**RETRO-APPLICATIONS OWED (tracked follow-ups, NOT built in this capture):**
- **Onboarding / discovery reveal** — the conflict cards (ledger #47) must become collapsible/sectioned so the user
  doesn't scroll ~3 pages past name/phone/address to reach services. Lands with the front-door re-staging build (the
  front-door arc, [[D-20]] timing).
- **Settings page** — sections were reported "collapsible" but render as stacked open cards with no visible collapse
  control (i.e. NOT actually collapsible to the user). Owed: genuine, user-operable collapse + the landing/index so
  Settings never dumps the full page. (Ledger #51 made Business Profile + Accounting direct destinations and added an
  independently-collapsible `SectionCard`; the *fuller* split — Services / Team / cost config / install price as their
  own direct destinations — is still owed, reported on #51.)
- Any other surface that still long-scrolls.

**Companion principles:** [[D-22]] (Admin-vs-Settings gating axis — the sibling principle flagged with this one at the
Admin/Settings split, ledger #51; D-22 is the *what-goes-where* axis, D-21 is the *how-it-is-presented* law);
[[OP-8]] (three-lens recon — a "WANT" density end-state is now a captured default, not re-derived per build);
[[CLAUDE.md §6 rule 10]] (standard-by-value — the gate-deferral is a recorded divergence-below-standard).
**Canonical home:** THIS entry. **D-21 is the canonical home for "direct access over scroll" (principle (ii) flagged on
ledger #51) — it is the SUPERSET / platform-wide promotion of that principle, folded in here as rules 1–4 above.** Origin
context: close-out ledger #51 (commit `2ee2853`).
**Date captured:** 2026-06-26 · **Status:** CAPTURED doctrine — platform-wide, ENFORCED by citation + owner-prove. Retro-
applications above are tracked, not built here. Build nothing.

---

### D-22 · Admin = business-entity config; Settings = user-self — the nav gating axis — `[CAPTURED]`
**Class:** DESIGN-LAW / OPERATING-PRINCIPLE (cross-cutting — the *what-goes-where* axis for every config surface).
**Decision:** Configuration splits on WHOSE thing it configures. **ADMIN** holds business-entity configuration —
settings that change the BUSINESS and require business authority (Business Profile, Accounting, Roles & Permissions,
Cost-to-Produce, Add Business). **SETTINGS** holds user-self configuration — settings about the signed-in PERSON
(Your Profile). The gate follows the axis: business-entity items gate on `manage_settings` (owner-default, delegable via
/roles) or `owner-only`; user-self items gate on `view_dashboard` (every authenticated user, including Staff). A Staff
member holding neither `manage_settings` nor `owner-only` therefore sees NO Admin item, but always sees their own
Settings.

**Reasoning:** the old grouping mixed the two axes — Roles and Your Profile both sat under SETTINGS — so a user-self
surface and a business-authority surface looked like peers, and the permission story read inconsistently. Splitting on
"whose thing is it" makes the gate self-evident from the location: if it changes the business it lives in Admin behind
business authority; if it changes you it lives in Settings and everyone has it. This is the gating axis; [[D-21]] is the
presentation law that says each of those destinations is reached directly, not by scrolling one long page.

**Companion principles:** [[D-21]] (direct-access-over-scroll design law — the sibling flagged together at ledger #51;
D-22 decides placement, D-21 decides presentation); [[OP-1]] (covenant — authority boundaries are honest, never a UI
accident).
**Canonical home:** THIS entry (principle (i) flagged for capture on ledger #51; no prior DECISIONS home existed).
Implementation + file:line evidence: close-out ledger #51 (commit `2ee2853`; `tileRegistry.ts` NAV_IA regroup,
`BusinessProvider.tsx:492` `can()`).
**Date captured:** 2026-06-26 · **Status:** CAPTURED doctrine. Implemented (ledger #51); a FULLER split (Services / Team /
cost config / install price as their own Admin destinations) is still owed, reported on #51.

---

### D-23 · FAITHFUL vs CONNECTED — one source, two renders, defaulting to faithful — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / product doctrine (the two-view contract for every grower's data).
**Decision:** A grower's data has **ONE source** (their data exactly as given — *faithful*, preserved, the trust anchor) and **TWO
RENDERS**, user-toggled, **defaulting to FAITHFUL**:
- **FAITHFUL** — their data, their colors, their meaning. The message is *"we got it, untouched."* Never call this view
  "disorganized" — it is the structured-mess that already works for them ([[OP-10]]).
- **CONNECTED** — the **same data** with **AI-computed relationships surfaced**: color driven by learned sell-rate / reorder
  point / season; cells become live links; the latent structure made visible.
Both renders use an **identical visual language** (so the toggle never feels like a different product). Migration faithful→connected
is **PULLED by benefit, never pushed** — the owner switches when the connected view earns it.
**Reasoning:** the relationships were **always latent** in the faithful data; CONNECTED reveals them, it does not replace the
source. Defaulting to faithful and never disparaging it is what makes the system a **trust anchor** instead of one more tool that
tells the owner their way is wrong ([[OP-10]] structure-last; [[BD-3]]/[[BD-4]] non-extractive honesty). Re-test on drift: does a
view ever **overwrite or hide** the owner's original data, or **default to the AI render** before the owner asks for it? Either is
a drift from faithful-is-the-source.
**Companion principles:** [[OP-10]] (structure-last — faithful = the latent structure preserved), [[D-26]] (the same faithful/
connected split applied to VOCABULARY), [[D-25]] (CONNECTED's relationships are Tier-2 learned patterns), [[D-9]] (CONNECTED
surfaces are honesty-laddered, never false-CONFIRMED).
**Canonical home:** THIS entry · `NORTH-STAR.md` §4 (reasoning-in-the-gap consumes the connected render). Origin: 27–29 June 2026
strategy session (master-banked 2026-06-29).
**Date captured:** 2026-06-29 · **Status:** CAPTURED doctrine (UNBUILT — the JSONB attribute bag [[D-24]] is the dependency).

### D-24 · RIGID SPINE / FLEXIBLE EDGE — the per-field decision rule (the blob, disciplined) — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION (the schema decision rule — make this citable; cite it instead of re-arguing blob-vs-column).
**Decision:** The data model is **NOT** "everything in a blob." It is a **RIGID SPINE** for what is invariant and universally
operated-on, plus a **FLEXIBLE BLOB** (a JSONB attribute bag) for what varies by grower. **THE RULE, per field:**
- **Will the system OPERATE on it** — count, query, group, reconcile, gate? → **RIGID COLUMN (spine).**
- **Is it DESCRIPTION that varies by grower**, that the AI reads to reason / suggest? → **BLOB (edge).**

**The worked example that defined the rule:** **SIZE** on `business_inventory` → a **rigid column** (you count per-size, query
"all 45-gal", group by variant — see ledger #62 `size`/`variant_group`) = **spine**. The Vitex page's **mature-size / hardiness /
foliage / flowers / growth-habit / tags / notes** → **blob** (description the AI reads; no operation runs on it). **Keep the spine
NARROW.**
**Reasoning:** a pure blob makes nothing queryable (you cannot count an attribute you cannot address); a fully-rigid schema forces
every grower's idiosyncratic description into columns that do not fit (the structure-first wall, [[OP-10]]). The operate-on-it test
is the clean cut: the machine pays the structure tax for the **few** fields it must compute on, and leaves the **many** descriptive
fields latent in the blob where the AI reads them. **AC-1 extended from cross-vertical to cross-GROWER:** variation lives in DATA
(the blob + per-grower size lists), not in schema. **Deterministic structured data (e.g. WooCommerce variants) is parsed
DETERMINISTICALLY, NOT by AI** (ledger #62 `extractSizeVariants`); AI is reserved for **genuinely-latent** structure.
**⚠️ NOTE — the JSONB attribute bag is NOT built yet.** It is the natural next architectural piece (likely lands with the
connected-view arc [[D-23]]). This decision defines **what goes in it when it is built** so the build conforms rather than
rediscovers the rule.
**Companion principles:** [[OP-10]] (structure-last — this is WHERE/HOW the machine pays the tax), [[D-23]] (faithful = the blob
preserved, connected = relationships computed off the spine + blob), [[AC-1]] (variation in data not schema, now cross-grower),
[[D-1]]/[[D-4]] (the existing rigid cost-object spine + edge tables are the same spine/edge instinct applied to cost).
**Canonical home:** THIS entry. Origin: 27–29 June 2026 strategy session (master-banked 2026-06-29).
**Date captured:** 2026-06-29 · **Status:** CAPTURED decision rule. Spine examples built (size variants, ledger #62); the JSONB
attribute-bag edge is UNBUILT (next architectural piece).

### D-25 · INTELLIGENCE TIERS — Tier 0 (world knowledge) gives day-one value before the owner's data exists — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / product doctrine (where a vertical's intelligence comes from, and in what order).
**Decision:** A vertical's intelligence comes in three tiers:
- **Tier 0 — location / world knowledge.** Available **day one, with NO owner input.** ZIP → USDA hardiness zone → local season →
  what is seasonal *here* → zone-appropriate plants → service-area demand. This is the **"how do you already know my business?"**
  hook.
- **Tier 1 — their faithful data** ([[D-23]] faithful view).
- **Tier 2 — their learned patterns** (sell-rate, quirks, microclimate) — compounds over seasons ([[D-23]] connected view).
**Reasoning:** day-one value **must not depend on the owner's data**, because at signup that data is **empty**. Tier 0 makes the
system useful before the owner has done anything — the inverse of the cold-start "set everything up first" wall ([[OP-10]]).
Suggestions stand on **authoritative facts** (a hardiness zone is a fact, not a guess) and are always a **strong prior the owner
overrides** — **SUGGEST, never command** ([[D-9]] honesty ladder; [[OP-7]] propose-not-commit). This explicitly includes
**suggesting the owner buy LESS** (margin-aware) — the one move a volume-optimizing big-box recommender structurally cannot make,
because its incentive is to sell more, not to be right.
**Companion principles:** [[D-23]] (Tiers 1/2 = faithful/connected), [[D-9]] (suggestions honesty-laddered + overridable),
[[OP-7]] (propose, owner disposes), [[OP-9]] (the Regina surfacing engine consumes all three tiers), the [domain knowledge
base](../docs/domain/) §5 climate/calendar (the Tier-0 data source).
**Canonical home:** THIS entry · `docs/domain/` §5 (the per-zone planting-window data Tier 0 runs on — first deepening candidate).
Origin: 27–29 June 2026 strategy session (master-banked 2026-06-29).
**Date captured:** 2026-06-29 · **Status:** CAPTURED doctrine (UNBUILT — Tier-0 needs the §5 zone/calendar domain data populated).

### D-26 · THE DUAL LEXICON ("Happy Hose") — speak both the trade's language and the owner's, and translate — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / product doctrine (vocabulary as a two-layer, AI-translated surface).
**Decision:** Domain knowledge has **two language layers**, and the system **speaks both and TRANSLATES** between them:
1. **Industry-standard** — ¾" black poly, ANSI #3, the botanical name. Lets the system talk to **suppliers and the trade**.
2. **Local-lexicon** — what **THIS grower** calls it (Lauren: *"Happy hose,"* the ¾" poly that "smiles" in its curves).
Neither is wrong; it is the **same object in two languages.** The **AI is the translator** — **her words on the front, the canonical
term underneath, supplier-speak when she reorders.** This is [[D-23]] faithful/connected applied to **VOCABULARY.** The lexicon has
**tiers** (private / regional / standard): the system **learns private terms** (accretion), **recognizes shared slang** (cross-grower
learning compounds), and **always maps to canonical** — the canonical term is the **join key** that enables sourcing suggestions
([[D-25]] Tier 0).
**⚠️ HONESTY CORRECTION FOR THE RECORD (do not overclaim):** dual-lexicon is currently **SINGLE-SOURCE (Lauren only).** The
Barryhill transcript *appeared* to confirm it cross-grower, but that capture had **no speaker separation** — the "Happy pipe"
mention there was **DAVID reflecting Lauren's term**, not the grower using it independently. **Do NOT record cross-grower
confirmation.** (Same correction applies to the "anti-Nelson accountant" story in that transcript: it was **David's own**, not the
grower's.) This is a flagged data-attribution caveat — the *concept* is durable; the *cross-grower evidence* is not yet real.
**Companion principles:** [[D-23]] (faithful/connected, applied to words), [[OP-10]] (capture in the owner's words = structure-last
for vocabulary), [[D-25]] (canonical term = the Tier-0 sourcing join key), the [domain ontology](../docs/domain/ontology.md) §2
naming + §1 size (the canonical layer the lexicon maps to).
**Canonical home:** THIS entry · `docs/domain/ontology.md` (the canonical trade vocabulary the local lexicon maps onto). Origin:
27–29 June 2026 strategy session (master-banked 2026-06-29).
**Date captured:** 2026-06-29 · **Status:** CAPTURED doctrine (UNBUILT; SINGLE-SOURCE evidence — cross-grower learning is the durable
intent, not yet observed).

---

### D-27 · Residence Product ("Kitchen Loop") is a residence-SCOPED VIEW of the one shared engine — BuiltWithCAI level, entry-point pointer not a separate app — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / product placement (cross-ref PLATFORM_STRATEGY.md).
**Decision:** The Residence Product (household operations; the residence treated as the smallest business) is the **residence-scoped view of the ONE shared engine** — same DB, same spine, same app, skinned at runtime for `business_type = residence`. It is **NOT a vertical, NOT platform-infra, NOT a separate app or instance** — it is "one source, many views," the view being a house. It sits at the **BuiltWithCAI level** (the general core), **sibling to CoolRunnings** (loosely coupled, standalone-capable — may optionally ride a CoolRunnings box but must never require one). Front door = **`home.builtwithcai.app`**, an **entry-point POINTER** into the one app (not a separate app), under the TLD principle: `.com` explains/markets, `.app` domains are entry points. **Wiring is DEFERRED** — `home.` is gated on `builtwithcai.app` (the core `.app` home) standing up first; build capability now, pointer last. Customer-zero = David running his own house.
**Reasoning:** Reuses the locked one-source-many-views architecture instead of spawning a parallel app; inherits shared auth/RLS + PIN gesture + Receipt Keeper for free ([[HOUSEHOLD-SHARING-DECISION]] treats multi-tenancy as inherited P0). Schema stays [[AC-1]]-clean: shared-core residence tables carry NO vertical noun (`receipts`); residence-specific tables carry the (not-yet-locked) residence prefix.
**Companion principles:** one-source-many-views (PLATFORM_STRATEGY.md), [[AC-1]] (no vertical noun in shared schema), [[OP-5]] (good-enough + AI-as-equalizer — the house is the smallest business).
**Canonical home:** `docs/residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md` §2 (full placement) · PLATFORM_STRATEGY.md (architecture cross-ref) · THIS entry.
**Date captured:** 2026-07-03 · **Status:** CAPTURED (design + prototype complete; UNBUILT; wiring deferred on core `.app`).

---

### D-28 · API NEUTRALITY — use any API that makes the answer more honest/effortless; refuse any whose price of admission is bias — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / connector-selection doctrine (ethical lineage [[OP-1]]).
**Decision:** Connector selection is governed by **neutrality**, classed **Green / Red / Amber**:
- **Green** — neutral utilities that make the answer more honest or effortless (Open Food Facts, USDA FoodData Central, Spoonacular/TheMealDB ontology, maps/distance). Use freely; swappable via `platform_config`.
- **Red** — single-retailer data whose price of admission is **buying loyalty** (a retailer's own price API that biases the answer toward them). **REFUSED.**
- **Amber** — retailer featuring/placement, allowed **LATER, from strength**, never as the spine.
The customer's own **`receipts` are the CONFIRMED, neutral price spine** — free, unbreakable, reflecting the real price paid incl. the deal. Deal-finders and external feeds are **optional enrichment, never load-bearing**: a scraper's "current" price is a guess; the receipt is truth.
**Reasoning:** Bias bought into the data layer corrupts every downstream recommendation ("cheaper where?" must never be sponsored). Anchoring on receipts keeps the moat customer-owned and provider-agnostic. Sibling to [[OP-1]] "any ethical means within the covenant," applied to data sourcing.
**Companion principles:** [[OP-1]] (covenant / ethical means), `MB_D-009` (OCR-commodity; connectors swappable via platform_config), [[D-20]] (connectors fold into existing endpoints, no bias-locked feeds welded in).
**Canonical home:** `docs/residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md` §6 / §6a (connector table + deal-finder classing) · THIS entry.
**Date captured:** 2026-07-03 · **Status:** CAPTURED doctrine (platform-wide; first applied in the residence connectors).

---

### D-29 · OFFLINE / LOCAL-FIRST CAPTURE is platform-wide, on an HONEST GRADIENT — capture always works, parsing populates on sync — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / platform capability (graceful-degradation lineage [[OP-6]]).
**Decision:** The app **works when the connection doesn't**, on an **honest gradient** (never a fake "done"):
- **CAPTURE works offline unconditionally** — snap receipt → save local → confirm **"Captured ✓"** → queue.
- **OWN DATA (list/inventory) works offline** — reads/writes durably queued.
- **OCR/parsing populates ON SYNC** — "Captured ✓ — will read items when back online," never a false "processed."
- **Live external data degrades gracefully** — absent, not faked.
Implementation applies the **local-first LOGIC proven in DataBridge** — **pull the pattern, make it shared; NOT a module extraction.** ✅ RECONCILED 2026-07-03: the shared foundation **already exists** — `packages/shared/src/sync/` (`SyncEngine` write-through-when-online / enqueue-when-offline + reconnect-drain; `OfflineQueue`; `NamespacedStore`; FIFO idempotent replay), built 2026-06-26 for Cultivar's walk-and-count loop (ledger #54), deliberately built NEW in shared rather than moving DataBridge (44 Ignition imports). DataBridge stays donor-reference. **Verticals build TOWARD this shared SyncEngine; the residence product inherits it, does not re-derive it.**
**Reasoning:** [[OP-6]] graceful degradation + [[D-9]] honesty ladder applied to connectivity — a queued/UNKNOWN state is surfaced honestly, never masked as complete. Real engineering investment, already begun, not a per-vertical rebuild.
**Companion principles:** [[OP-6]] (fidelity tiers / works-when-owner-does-nothing), [[D-9]] (honesty ladder — "Captured ✓, will read on sync" is the honest not-yet-CONFIRMED state), Surface Honesty (WORKS/LABELED/HIDDEN — nothing silently vanishes).
**Canonical home:** `packages/shared/src/sync/` (the built foundation) · `docs/residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md` §5 P6 · THIS entry.
**Date captured:** 2026-07-03 · **Status:** CAPTURED doctrine; shared foundation PARTIALLY BUILT (walk-and-count consumer live; platform-wide adoption ongoing).

---

### D-30 · Shared-device authentication — three flavors, face-swap preferred, face-recognition do-not-build — `[CAPTURED]`
**Class:** ARCHITECTURE-DECISION / auth design note (DESIGN, not a build — banks the 2026-07-06 thinking so it survives to when "Build B" comes up).
**Context:** Identity is **one-person / multi-device** (`member_devices`, shipped). Two device modes:
- **PERSONAL device ("Picture A")** — Lauren/Terry each unlock their OWN device. Email → real Supabase session, with **PIN/biometric as an UNLOCK gesture on top** (per the Auth Architecture Locked Rule — the gesture never replaces `auth.uid()`). **A is the foundation, built first.**
- **SHARED TERMINAL ("Picture B")** — many staff swap on ONE tablet (greasy-hands counter device). Additive on top of A.
**The three flavors of shared-terminal (B):**
1. **PIN-swap** — each staff taps their own 4-digit PIN on the shared tablet. NEEDS the orphaned `authenticateMember` (PIN-only, **no `auth.uid()`**) to establish a REAL Supabase session from a PIN — an **auth-architecture design pass**, not a code tweak. Real but **deferred**.
2. **FACE-SWAP (RECOMMENDED)** — the shared tablet holds **MULTIPLE WebAuthn passkeys** (one per staff account). Staff glances (device biometric confirms a real enrolled person is present), taps their name → their passkey authenticates them **as themselves**. Privacy-clean: **NO stored biometric data** (keys stay in the Secure Enclave), reuses the Build-2 biometric work, much smaller than a recognition system. The greasy-hands shared-device experience done safely.
3. **FACE-RECOGNITION (DO-NOT-BUILD)** — camera captures + **stores a face model** per staff, live-matches to identify who's present. Technically possible but converts the liability-free WebAuthn model into a **regulated BIOMETRIC DATABASE** (BIPA-style privacy law, consent, breach exposure) and discards WebAuthn's core safety property (TRACE never holds biometric data). **Do NOT build.** If a customer demands auto-identify, revisit **deliberately with legal review**.
**Decision:** Build **A now**. When **B** is needed, prefer **FACE-SWAP (flavor 2)**. PIN-swap (1) is a separate auth-architecture design pass. Face-recognition (3) is a do-not-build on liability grounds. **B is additive on top of A — choosing A now does not close B.**
**Grounds:** Ignition device recon 2026-07-06 (`member_devices` shipped, `authenticateMember` orphaned / PIN-only, `is_active` unenforced); WebAuthn's device-bound / identity-blind property; the PIN/face-unlock identity story.
**Companion principles:** Auth Architecture Locked Rule (CLAUDE.md — PIN/face are unlock gestures on a real session, never a replacement), [[OP-1]] (covenant — no biometric database held over the customer), [[OP-8]] (three-lens recon — three flavors spanning NEED→WANT, not one pre-collapsed pick), Surface Honesty.
**Canonical home:** THIS entry · the device-identity story in `user_stories.md`.
**Date captured:** 2026-07-06 · **Status:** CAPTURED design note (UNBUILT — Build A proceeds separately; Build B deferred, face-swap preferred when it comes up).

---

## PERSONAL-FINANCIAL

> Not in this file by design — see **`decisions/PERSONAL-FINANCIAL.local.md`** (gitignored).
> Covers: David's draw model + cap, family contractor billing structure, Option C house-sale draw
> trigger, and the personal reconsider-triggers (OP-3 criteria).
