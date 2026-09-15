// ============================================================
// containerLadder — A CONTAINER SIZE IS A RUNG ON A LADDER, NOT A NUMBER (STD-011)
//
// PURPOSE:      A grower's container sizes are a short, ordered, per-tenant list of REAL TRADE
//               RUNGS — LAWNS runs slip · 4" · 3/5 gal · 15 · 30 · 45 · 65 · 95/100 · 200 — and the
//               gaps between them are not uniform, not numeric, and not even all the same unit.
//               This module reads a ladder (passed IN as data) and answers the only three questions
//               anybody asks of it: WHICH RUNG is this lot on, WHICH RUNGS can it go to, and IS
//               this size on the ladder at all.
//
// 🔴 ADDING A RUNG IS ADDING A ROW. David, 2026-09-14: *"If Terry starts running 7 gallon it must
//   appear EVERYWHERE immediately — the uppot picker offers it, the SIZE RESOLVER RECOGNISES IT,
//   the BOM can attach to it, the count screen and load list read it. A migration to add a
//   container size is the failure this exists to prevent."* So the ladder is DATA, and this module
//   is the only thing that interprets it. ⚠️ **It was not hypothetical when it was written: 21 rows
//   at LAWNS already carried `7 gal`, and NONE of the four hardcoded size lists in the repo
//   contained it** (`constants.ts` ×2 — both with zero importers — `api/orders/submit.ts:13`, which
//   is a separate hand copy and the only live one, and a prose list in `discovery/verticals`).
//
// 🔴 PER TENANT. David's ruling, 2026-09-14: *"The ladder is PER TENANT. Different growers run
//   different sizes."* This is the one place this module DIVERGES from its own precedent: the
//   channel vocabulary (R-152, ledger #310) is a single GLOBAL list with no `business_id` and no
//   write policy at all — *"adding a channel is a migration."* The one-list half carries over; the
//   write path does not, and the reason is that "Terry runs 7 gallon" is a fact about LAWNS.
//
// 🔴 THE NUMERIC KEYS OF A RUNG ARE DERIVED, NEVER DECLARED. A rung claims every number that
//   `parseUnitOfMeasure` reads out of its own label and its own aliases. So the `3/5 gal` rung
//   claims BOTH 3 and 5 — which is Terry's actual position (*the difference between #3 and #5 is
//   only pot height*, R-71 clause ③) — and the `95/100` rung claims both 95 and 100, because they
//   are one pot named two ways (quarts, not gallons). **Nobody types out `15`/`15 gal`/`#15`/`15G`
//   as aliases**: the parser already folds those to 15 and the rung claims 15. A declared list of
//   spellings is the copy that drifts (tech-debt #73's lesson, one field over).
//
// 🔴 RETIRE, NEVER DELETE (R-133's shape). Past lots and past orders reference a rung. A retired
//   rung STILL RESOLVES — `resolveRung` ignores `active` entirely — it is simply never OFFERED.
//   `rungsAbove` is the offer list and it filters on `active`; `resolveRung` is the read path and
//   it does not. Those two facts are the whole retirement model and they are asserted in both
//   directions.
//
// 🔴 A RUNG CHANGE MUST NOT RE-COST HISTORY (D-41). This module NEVER writes and NEVER mutates a
//   rung. A caller that persists a plan snapshots the VALUES it costed with — which is what
//   `production_plan_lines` already does, storing `from_unit_value`/`to_unit_value` as numerics
//   rather than a rung reference. A foreign key to a rung would re-cost every past plan the day
//   somebody corrected a volume. Verified live 2026-09-14: those columns are `numeric`.
//
// ⚠️ MINUTES PER POT ARE NOT MEASURED AND THE TYPE SAYS SO. David: they have never timed this, and
//   Terry's figure is a forty-year grower's estimate of his own speed. Every rung's handling time
//   is an `Estimate` from `../production/basis`, which has NO constructor that produces an
//   unlabelled number — so a rung cannot carry a bare minute count that renders like a measurement.
//   ✅ THIS DOES NOT MOVE R-89. R-89 kills the FLAT CONFLATED per-pot rate (mutant P1 restores it);
//   it does not say handling is one number for every rung. `setup + n × handling` is untouched —
//   setup stays per RUN, handling becomes per RUNG. A rung with no handling figure returns null and
//   the caller falls back to the global, so R-89's own 3-minute figure still reproduces §B exactly.
//
// DEPENDENCIES: ./unitOfMeasure (a zero-dep leaf) · ../production/basis (a zero-dep leaf). Nothing
//               else, deliberately — a client picker, a node seed script and the verify cap all
//               import this, and none of them may drag a transitive dep in.
// OUTPUTS:      Rung · Ladder · RungResolution · LadderConflict · foldLabel · numericKeysOf ·
//               resolveRung · rungsAbove · nextRung · validateLadder · handlingFor.
// NOT THIS MODULE: reading the ladder from the database (a caller does that and passes it in) ·
//               writing a rung · the four-way split · the mix arithmetic · anything with a clock.
// AC-1:         generic. A "rung" is a container size; no vertical noun appears in any identifier.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { parseUnitOfMeasure } from './unitOfMeasure';
import { type Estimate, suggestion } from '../production/basis';

/** One rung. `label` is what a person sees and what a grower typed; everything else describes it. */
export interface Rung {
  /** The canonical display label — "15 gal", "3/5 gal", "slip", "4 in". Shown, never re-spelled. */
  label: string;
  /** Extra spellings the PARSER cannot fold to this rung's numbers. "slip" needs one; "15" does not. */
  aliases: readonly string[];
  /** Position on the ladder. Ascending = bigger. The ONLY ordering; never sort by volume. */
  sortOrder: number;
  /**
   * Volume in trade gallons, for costing. `null` is a legal, meaningful answer: a SLIP is a rooted
   * cutting whose volume rounds to nothing, and a caller must handle that rather than receive a 0
   * that reads like a measurement (A9 — absent is not empty).
   */
  volumeGallons: number | null;
  /** Crew-minutes to handle ONE pot at this rung, or null to fall back to the global rate. */
  handlingMinutes: number | null;
  /** Why that minute figure is what it is. Required by the type — an unlabelled number cannot exist. */
  handlingBecause: string;
  /** False = retired. Still resolves for history; never offered. */
  active: boolean;
}

export type Ladder = readonly Rung[];

/**
 * Fold a label for COMPARISON only. The stored `size` is never rewritten (D-23 / R-50) — this is a
 * read of the owner's string, exactly as `unitOfMeasure`'s header says of the unit projection.
 *
 * Deliberately minimal: lowercase, collapse whitespace, drop a leading `#` and surrounding spaces
 * around a slash. It does NOT try to equate `15` with `15 gal` — that is the PARSER's job and doing
 * it here too would be a second representation of one fact.
 */
export function foldLabel(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^#\s*/, '')
    .replace(/\s*\/\s*/g, '/');
}

/**
 * Every number this rung answers to, DERIVED by running the parser over its own label and aliases.
 *
 * A label that parses as a RANGE contributes BOTH ends, and that is the mechanism that makes
 * "3/5 gal" one rung rather than a refusal: the rung claims 3 and 5, so a lot sized "#3" and a lot
 * sized "5 gallon" land on the same rung — Terry's position, not an inference.
 *
 * Non-container parses contribute nothing. A "4 in" rung parses as LENGTH, so it has no numeric key
 * and is reachable only by label/alias — which is correct: 4 is not a gallon count.
 */
export function numericKeysOf(rung: Rung): number[] {
  const keys = new Set<number>();
  for (const label of [rung.label, ...rung.aliases]) {
    const p = parseUnitOfMeasure(label);
    if (!p || p.kind !== 'container') continue;
    if (p.value != null && Number.isFinite(p.value)) keys.add(p.value);
    if (p.valueMax != null && Number.isFinite(p.valueMax)) keys.add(p.valueMax);
  }
  return [...keys].sort((a, b) => a - b);
}

export type RungResolution =
  | { ok: true; rung: Rung; how: 'label' | 'alias' | 'number' }
  | { ok: false; reason: 'blank' | 'off_ladder'; detail: string };

/**
 * WHICH RUNG is this size on?
 *
 * 🔴 LABEL AND ALIAS ARE TRIED BEFORE THE NUMBER, AND THE ORDER IS THE SPECIFICATION. It is what
 * lets a ladder recognise sizes the PARSER refuses or mis-kinds without touching the parser:
 *   · "slip"  — the parser REFUSES it outright (measured). The ladder matches it by label.
 *   · "4 in"  — the parser reads LENGTH (measured), so it has no container number. Matched by label.
 *   · "95/100" — the parser reads a RANGE 95→100 (measured), so the alias Terry actually says would
 *                otherwise produce a refusal. Matched by label.
 * Only when no label or alias matches does the numeric key run, which is what makes an unremarkable
 * "30 gallon" resolve without anybody declaring that spelling anywhere.
 *
 * ⚠️ `active` IS NOT CONSULTED. A retired rung still resolves, because a past lot still points at
 * it (R-133: retire never means delete). Offering is `rungsAbove`'s job and it filters there.
 */
export function resolveRung(ladder: Ladder, size: string | null | undefined): RungResolution {
  const folded = foldLabel(size);
  if (folded === '') {
    return { ok: false, reason: 'blank', detail: 'No size recorded, so there is no rung to place it on.' };
  }

  for (const rung of ladder) if (foldLabel(rung.label) === folded) return { ok: true, rung, how: 'label' };
  for (const rung of ladder) {
    for (const a of rung.aliases) if (foldLabel(a) === folded) return { ok: true, rung, how: 'alias' };
  }

  const p = parseUnitOfMeasure(size);
  if (p && p.kind === 'container' && p.value != null) {
    // A single value matches a rung claiming it. A RANGE matches only a rung claiming BOTH ends —
    // otherwise "10/15 gallon" would silently collapse onto the 15 rung, which is the laundering
    // `unitOfMeasure`'s own header refuses to reproduce (tech-debt #125).
    for (const rung of ladder) {
      const keys = numericKeysOf(rung);
      if (p.valueMax != null && p.valueMax !== p.value) {
        if (keys.includes(p.value) && keys.includes(p.valueMax)) return { ok: true, rung, how: 'number' };
      } else if (keys.includes(p.value)) {
        return { ok: true, rung, how: 'number' };
      }
    }
  }

  return {
    ok: false,
    reason: 'off_ladder',
    detail: `"${String(size).trim()}" reads as a size, but it is not one of this nursery's container sizes. Add it to the ladder, or correct the row.`,
  };
}

/** The rungs a lot at `rung` could move UP to — the offer list. Retired rungs are never offered. */
export function rungsAbove(ladder: Ladder, rung: Rung): Rung[] {
  return ladder
    .filter((r) => r.active && r.sortOrder > rung.sortOrder)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The very next rung up, or null at the top. The default a picker opens on. */
export function nextRung(ladder: Ladder, rung: Rung): Rung | null {
  return rungsAbove(ladder, rung)[0] ?? null;
}

/**
 * Crew-minutes per pot at this rung, as an Estimate that carries its own basis.
 *
 * Falls back to the global rate when the rung states none — so a ladder nobody has timed behaves
 * exactly as R-89 does today, and §B's four figures still reproduce.
 */
export function handlingFor(rung: Rung, globalMinutesPerPot: number): Estimate<number> {
  return rung.handlingMinutes == null
    ? suggestion(
        globalMinutesPerPot,
        `${globalMinutesPerPot} min a pot — the yard-wide rate`,
        `nobody has timed "${rung.label}" specifically, so the global rate stands in for it`,
      )
    : suggestion(
        rung.handlingMinutes,
        `${rung.handlingMinutes} min a pot at ${rung.label}`,
        rung.handlingBecause,
      );
}

export interface LadderConflict {
  kind: 'duplicate_label' | 'duplicate_number' | 'duplicate_sort';
  detail: string;
}

/**
 * Is this ladder self-consistent?
 *
 * 🔴 TWO RUNGS CLAIMING ONE NUMBER IS A REAL CONFIGURATION DEFECT AND IT MUST NOT RESOLVE
 * FIRST-WINS. If a tenant keeps a `3/5 gal` rung AND a separate `5 gal` rung, the number 5 is
 * claimed twice and which one a lot lands on becomes an accident of row order — the silent,
 * order-dependent wrong answer this whole module exists to remove. Surfaced, never auto-resolved
 * (R-96's shape: two things that collide both get flagged).
 */
export function validateLadder(ladder: Ladder): LadderConflict[] {
  const out: LadderConflict[] = [];

  const byLabel = new Map<string, string[]>();
  for (const r of ladder) {
    const k = foldLabel(r.label);
    byLabel.set(k, [...(byLabel.get(k) ?? []), r.label]);
  }
  for (const [, labels] of byLabel) {
    if (labels.length > 1) out.push({ kind: 'duplicate_label', detail: `Two rungs share the label "${labels[0]}".` });
  }

  const byNumber = new Map<number, string[]>();
  for (const r of ladder) {
    for (const n of numericKeysOf(r)) byNumber.set(n, [...(byNumber.get(n) ?? []), r.label]);
  }
  for (const [n, labels] of byNumber) {
    if (labels.length > 1) {
      out.push({ kind: 'duplicate_number', detail: `${labels.join(' and ')} both claim the number ${n}, so a lot of that size has no single rung.` });
    }
  }

  const bySort = new Map<number, string[]>();
  for (const r of ladder) bySort.set(r.sortOrder, [...(bySort.get(r.sortOrder) ?? []), r.label]);
  for (const [s, labels] of bySort) {
    if (labels.length > 1) out.push({ kind: 'duplicate_sort', detail: `${labels.join(' and ')} share sort position ${s}, so "next rung up" is undefined between them.` });
  }

  return out;
}
