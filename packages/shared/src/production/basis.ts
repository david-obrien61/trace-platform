// ============================================================
// basis — EVERY SUGGESTED NUMBER CARRIES HOW IT WAS ARRIVED AT (STD-011, D-9)
//
// PURPOSE:      David's ruling (2026-09-05, R-89): *"we can suggest hours since they have no clue
//               at the moment and suggest quantity because we can see inventory… they had a
//               feeling, we have facts."* — followed immediately by the correction that makes it
//               safe: **most of these are NOT facts.** A suggested number rendered like a measured
//               one is what destroys trust, and *"the first one Terry catches discredits the rest."*
//
// 🔴 THREE CLASSES, AND THE MIDDLE ONE IS THE WHOLE POINT.
//   · FACT       — measured from the customer's own data. 1,120 pots to clean; $30.88/yd landed
//                  bark; 447 rows at LAWNS. Nobody has to believe us; it is their number.
//   · SUGGESTION — a fact PLUS a named assumption. "62 hours AT 3 minutes a pot." The fact is the
//                  pot count; the assumption is the rate; the sentence carries both or it is a lie
//                  of omission. **The assumption is REQUIRED by the type** — see `assumption`.
//   · GUESS      — no evidence at all. Six productive hours a day. Every pot price. It renders as
//                  a guess and it invites correction, which is the only way it stops being one.
//
// 🔴 WHY A TYPE AND NOT A CONVENTION. `ui-control-standards.md` §6 records the same lesson about
//   read honesty: *"READ HONESTY IS A TYPE, NOT A DISCIPLINE… A rule enforced by the type system
//   cannot be forgotten by a tired author; a rule enforced by discipline can."* A basis a caller
//   may omit is a basis that will be omitted on the busiest screen. So `Estimate<T>` has no
//   constructor that produces an unlabelled number, and `suggestion()` will not compile without
//   the assumption it rests on.
//
// 🔴 ERR LONG, NOT SHORT — and the GAP is the instrument (R-90). David: *"if they finish early
//   great; if they find themselves going over it creates stress and a bad feeling that they missed
//   the mark."* So a range-valued estimate reports the CONSERVATIVE end as its plan value. And:
//   **a measured actual NEVER silently becomes the plan.** `compareToActual` returns the gap and
//   refuses to mutate anything — a human moves the plan, because collapsing the two destroys the
//   only signal that says the assumption was wrong.
//
// AC-1:         generic. Nothing here knows what is being estimated or what vertical asked. The
//               words "pot", "tree" and "nursery" do not appear in any identifier.
// DEPENDENCIES: none (zero-dep leaf — a client surface, a node seed script and the test all import
//               it, and none of them may drag a transitive dep in).
// OUTPUTS:      BasisKind · Estimate · fact · suggestion · guess · basisSentence · weakest ·
//               compareToActual · EstimateGap.
// NOT THIS MODULE: confidence in a STORED value (that is `cost_confidence`, a different axis — it
//               grades a number we hold; this grades a number we DERIVED and are about to show).
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================

/** How a number on screen was arrived at. Ordered weakest-last for `weakest()`. */
export type BasisKind = 'fact' | 'suggestion' | 'guess';

/** Rank used to fold many bases into one. A total is only as good as its worst input. */
const RANK: Record<BasisKind, number> = { fact: 0, suggestion: 1, guess: 2 };

export interface Estimate<T = number> {
  value: T;
  basis: BasisKind;
  /** What was MEASURED. Required for every class — a guess still says what it is a guess ABOUT. */
  because: string;
  /**
   * The named assumption a SUGGESTION rests on ("3 minutes a pot, which nobody has timed").
   * REQUIRED on `suggestion` and absent on the other two — that asymmetry is enforced by the
   * constructors, and it is the reason this is a type rather than a comment.
   */
  assumption?: string;
}

/** A number measured from the customer's own data. No assumption; if you need one, it is not a fact. */
export function fact<T>(value: T, because: string): Estimate<T> {
  return { value, basis: 'fact', because };
}

/**
 * A fact plus a named assumption. BOTH are required, and that is the load-bearing part of this
 * module: a suggestion whose assumption is unstated is indistinguishable on screen from a fact.
 */
export function suggestion<T>(value: T, because: string, assumption: string): Estimate<T> {
  return { value, basis: 'suggestion', because, assumption };
}

/** No evidence at all. It renders as a guess so the first correction makes it real. */
export function guess<T>(value: T, because: string): Estimate<T> {
  return { value, basis: 'guess', because };
}

/**
 * The sentence shown BESIDE the number — never in a tooltip, never behind a hover.
 *
 * D-9 applied to our own confidence: the basis travels with the value in the same breath, because
 * a basis the reader has to go looking for is a basis the reader never sees. Deliberately does NOT
 * include the value itself — the surface renders the number in its own type size and this beneath.
 */
export function basisSentence(e: Estimate<unknown>): string {
  if (e.basis === 'fact') return e.because;
  if (e.basis === 'suggestion') return `${e.because} — at ${e.assumption}`;
  return `${e.because} — nobody has measured this`;
}

/**
 * Fold many bases into one: a derived total is only as trustworthy as its WORST input.
 *
 * Hours = pots × minutes. The pot count is a fact and the rate is a guess, so the hours are a
 * guess — and reporting them as a suggestion because two of the three inputs were solid is exactly
 * the laundering this module exists to prevent. An EMPTY list is a `guess`, not a `fact`: nothing
 * was measured, and defaulting to the strongest class on no evidence is the same defect inverted.
 */
export function weakest(bases: readonly BasisKind[]): BasisKind {
  if (bases.length === 0) return 'guess';
  return bases.reduce((w, b) => (RANK[b] > RANK[w] ? b : w), 'fact' as BasisKind);
}

export interface EstimateGap {
  planned: number;
  actual: number;
  /** actual − planned. POSITIVE means the work ran over what was planned. */
  delta: number;
  /** delta as a share of planned. `null` when planned is 0 — a ratio against zero is not a number. */
  ratio: number | null;
  /** True when the actual came in at or under plan — the outcome David wants people to feel. */
  withinPlan: boolean;
}

/**
 * Compare a plan to what actually happened, and RETURN THE GAP WITHOUT TOUCHING THE PLAN.
 *
 * 🔴 This function deliberately has no write path and no "adopt" argument. David's ruling: *"NEVER
 * let the measured actual silently become the plan — a human moves the plan. The GAP between them
 * is the instrument; collapse the two and you lose it."* An auto-adopting version of this would
 * re-plan every batch to whatever the last one cost, which reads as learning and is actually the
 * loss of the only record that says the estimate was ever wrong.
 */
export function compareToActual(planned: number, actual: number): EstimateGap {
  const p = Number(planned ?? 0);
  const a = Number(actual ?? 0);
  const delta = a - p;
  return { planned: p, actual: a, delta, ratio: p === 0 ? null : delta / p, withinPlan: delta <= 0 };
}
