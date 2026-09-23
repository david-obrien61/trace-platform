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
// DEPENDENCIES: ./unitOfMeasure · ../production/basis · ../utils/sizeLabel (all zero-dep leaves). Nothing
//               else, deliberately — a client picker, a node seed script and the verify cap all
//               import this, and none of them may drag a transitive dep in.
// OUTPUTS:      Rung · Ladder · RungResolution · LadderConflict · foldLabel · numericKeysOf ·
//               resolveRung · rungsAbove · nextRung · validateLadder · handlingFor ·
//               sameSizeOnLadder · largestRung · activeRungs · LADDER_FIELDS · LADDER_SELECT ·
//               LadderRow · rungFromRow · ladderCoverage · LadderCoverage.
// NOT THIS MODULE: reading the ladder from the database (a caller does that and passes it in —
//               but the FIELD LIST and the row→Rung mapping live here, so the app's reader and the
//               server's import preview cannot map one row two ways; ledger #343) ·
//               writing a rung · the four-way split · the mix arithmetic · anything with a clock.
// AC-1:         generic. A "rung" is a container size; no vertical noun appears in any identifier.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { parseUnitOfMeasure, type UnitKind } from './unitOfMeasure';
import { normalizeSize, sameSizeLabel } from '../utils/sizeLabel';
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
  /**
   * T-posts to stake ONE tree of this size at install (ledger #343). The load list reads it; there
   * is no size threshold anywhere any more — David, 2026-09-16: *"no size thresholds."* 0 = none.
   */
  installTPostsPerTree: number;
  /** Where that post count came from. Required for the same reason `handlingBecause` is. */
  installTPostsBecause: string;
  /**
   * Trunk CALIPER of a tree in this size, in inches (ledger #356, David 2026-09-18): *"the trade
   * measure LAWNS buys and sells on, and the real graduation test."* Measured at the business's
   * `caliperMeasuredAtInches` above the soil. `null` min = not recorded (never a 0 that reads as a
   * measurement). A null max with a min = "and up"; max equal to min = one figure.
   */
  caliperMinInches: number | null;
  caliperMaxInches: number | null;
  /** Where the caliper figures came from. Required for the same reason `handlingBecause` is. */
  caliperBecause: string;
  /**
   * What it costs to install ONE tree of this size (ledger #386, R-171).
   *
   * 🔴 `null` IS A REAL ANSWER AND IS THE COMMON ONE. David ruled 2026-09-23: *"A RUNG WITH NO
   * PRICE: offer install and REQUIRE A TYPED AMOUNT with a reason — never $0, never a guess,
   * never refused."* A 0 here would put a FREE INSTALL on a screen, so an unpriced rung carries
   * null and the line says "not set" in those words (D-9, A9 — absent is not empty).
   *
   * ⚠️ THE NULL PATH IS THE ORDINARY ONE, NOT THE EDGE, and the figures come from the resolver
   * itself, not from a SQL join: of LAWNS's 632 live lots, 365 sit on a PRICED rung, 95 on a
   * rung carrying NO price (88 of them `3/5 gal`, 7 `200 gal`) and 172 reach no rung at all
   * (107 carry no size whatever) — 267 of 632 would ask for a typed amount today, and ONE price
   * on `3/5 gal` removes 88 of them. ✏️ An earlier count said 268 split differently; it was made
   * by joining on `volume_gallons`, which misses an alias match (100 gal → the 95/100 rung) and
   * mis-reads a range rung (3/5 gal claims BOTH 3 and 5) — the exact thing R-157 forbids doing
   * outside the resolver.
   */
  installPrice: number | null;
  /** Where that price came from — the billed median, Lauren's sheet, or nobody has set it. */
  installPriceBecause: string;
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

/**
 * Every answer the resolver gives. ✏️ WIDENED 2026-09-16 (ledger #343): the refusal used to be
 * `blank | off_ladder`, which made a 50 lb bag and an unreadable scribble both read "off the ladder".
 * The load list has to tell them apart — a bag LOADS as goods, an off-ladder gallon size is a tree
 * nobody can stake — and David's ruling is that no consumer parses a size itself (*"no size parsed
 * outside the resolver"*). So the resolver says which of the four it was, and consumers only read.
 *   · `not_container` — it reads as a real unit that is not a container (`kind`/`unit` say which).
 *   · `off_ladder`    — it reads as a container size, and no rung claims it.
 *   · `unreadable`    — the parser declined it and no label or alias matched.
 */
export type RungResolution =
  | { ok: true; rung: Rung; how: 'label' | 'alias' | 'number' }
  | { ok: false; reason: 'blank' | 'off_ladder' | 'unreadable'; detail: string }
  | { ok: false; reason: 'not_container'; detail: string; kind: UnitKind; unit: string };

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
  if (!p) {
    return {
      ok: false,
      reason: 'unreadable',
      detail: `We could not read "${String(size).trim()}" as a size, and it is not one of this nursery's container sizes.`,
    };
  }
  if (p.kind !== 'container') {
    return {
      ok: false,
      reason: 'not_container',
      kind: p.kind,
      unit: p.unit,
      detail: `"${String(size).trim()}" is sold by ${p.unit}, not by container.`,
    };
  }
  if (p.value != null) {
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

/**
 * Do two stored sizes mean the same container? (ledger #343)
 *
 * 🔴 WITH A LADDER, THE LADDER DECIDES. "#3", "5 gal" and "3/5 Gallon" are ONE rung at LAWNS, and a
 * text fold can never know that — `normalizeSize` would call them three sizes and the count screen
 * would mint three rows for one bucket. So when BOTH sizes land on a rung, the answer is whether it
 * is the SAME rung.
 * ⚠️ OTHERWISE THE TEXT FOLD STANDS, AND THAT IS DELIBERATE, NOT A SECOND SIZE LIST. A tenant with no
 * ladder (Test Dave's today), a blank size, or an off-ladder size nobody has added yet still needs a
 * same-or-different answer, and the text fold is the one the platform already shares
 * (`sameSizeLabel`, STD-011). It compares two strings; it holds no sizes.
 */
export function sameSizeOnLadder(
  ladder: Ladder | null,
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (ladder && ladder.length > 0) {
    const ra = resolveRung(ladder, a);
    const rb = resolveRung(ladder, b);
    if (ra.ok && rb.ok) return ra.rung.label === rb.rung.label;
    if (ra.ok !== rb.ok) return false;
  }
  return sameSizeLabel(a, b);
}

/**
 * 🔴 WHAT THE TRADE STANDARD SAYS, AS A DEFAULT AND A REFERENCE — NEVER ENFORCED (David, 2026-09-18).
 * ANSI Z60.2-2025, the American Standard for Nursery Stock (approved 17 April 2025, superseding
 * Z60.1-2014), read from the document itself, §1.2.1:
 *   *"…caliper measurement is taken six inches above the ground level for field grown stock and from
 *   the soil line for container grown stock, which should be at or near the top of the root flare…
 *   up to and including the four-inch caliper size interval (i.e., from four inches up to, but not
 *   including, 4.5 inches). If the caliper measured at six inches is four and one-half inches or
 *   more, the caliper shall be measured at 12 inches above the ground level, soil line, or root
 *   flare, as appropriate."*
 * ⚠️ **THE THRESHOLD IS 4½ INCHES, NOT 4** — a summary of the standard says 4, and the standard does
 * not. And for CONTAINER stock the six inches is measured from the SOIL LINE, not from the ground.
 * The same section: *"Seldom are tree trunks perfectly round. The most accurate measurement will
 * result from the use of a diameter tape. Caliper measurements taken with manual or electronic
 * 'slot' or 'pincer' type caliper tools should be the average of the smallest and largest
 * measurements."*
 * 🔴 A NURSERY MAY DEPART FROM IT AND THE PLATFORM RECORDS THE DEPARTURE RATHER THAN CORRECTING IT.
 * LAWNS measures everything at 12 inches, including below 4½ where the standard says 6 — Terry has
 * forty years in the trade and knows the publication. The height the platform USES is the business's
 * own (`caliperMeasuredAtInches`); this is what it SHOWS beside it.
 */
export const CALIPER_STANDARD = {
  name: 'ANSI Z60.2-2025',
  smallHeightInches: 6,
  largeHeightInches: 12,
  /** At and above this reading (taken at six inches), the standard moves the measurement to 12 in. */
  switchAtInches: 4.5,
  sentence:
    'ANSI Z60.2-2025 measures at 6 in from the soil line for container stock, and at 12 in once the '
    + 'reading at 6 in is 4½ in or more. Change this if you measure differently.',
} as const;

/**
 * The height the STANDARD would measure this caliper at — 6 in, or 12 once the tree reads 4½ in or
 * more. `null` when the rung records no caliper, so a caller says nothing rather than guessing.
 * ⚠️ REFERENCE ONLY. What the platform uses is the business's `caliperMeasuredAtInches`.
 */
export function standardCaliperHeightInches(r: Pick<Rung, 'caliperMinInches' | 'caliperMaxInches'>): number | null {
  const reading = r.caliperMaxInches ?? r.caliperMinInches;
  if (reading == null) return null;
  return reading >= CALIPER_STANDARD.switchAtInches ? CALIPER_STANDARD.largeHeightInches : CALIPER_STANDARD.smallHeightInches;
}

/**
 * The caliper as a person reads it — "1.5–2.5 in", "1.25 in", "5 in and up" — or `null` when the
 * rung has none recorded, so a caller says "not recorded" rather than printing a blank (ledger #356).
 */
export function caliperText(r: Pick<Rung, 'caliperMinInches' | 'caliperMaxInches'>): string | null {
  const fmt = (n: number) => String(Number(n.toFixed(2)));
  if (r.caliperMinInches == null) return null;
  if (r.caliperMaxInches == null) return `${fmt(r.caliperMinInches)} in and up`;
  if (r.caliperMaxInches === r.caliperMinInches) return `${fmt(r.caliperMinInches)} in`;
  return `${fmt(r.caliperMinInches)}–${fmt(r.caliperMaxInches)} in`;
}

/** The rungs a picker OFFERS, in ladder order. Retired rungs never appear here (R-133). */
export function activeRungs(ladder: Ladder): Rung[] {
  return ladder.filter((r) => r.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The top ACTIVE rung — the one a NEW rung copies its install posts from (David, 2026-09-16: *"a new
 * rung's T-posts pre-fill from the largest existing rung"*). "Largest" is LADDER ORDER, never volume:
 * the ladder's own order is the only one it has (a slip and a 4" pot have no comparable volume).
 */
export function largestRung(ladder: Ladder): Rung | null {
  const offered = activeRungs(ladder);
  return offered.length ? offered[offered.length - 1] : null;
}

/**
 * Every column a reader needs from `container_ladder` — THE one list (ledger #343).
 * It was born in `cultivar-os/src/lib/containerLadderFields.ts` and moved here when the server's
 * import preview became a second reader: two lists for one table is the copy that drifts (#179).
 * That file re-exports this one, and its test replays the migrations against it.
 * 🔴 `caliper_*` (ledger #356) are the same gate one migration later: `20260918c_container_ladder_caliper.sql`
 * must be applied before a build selecting them merges.
 * 🔴 `install_t_posts_*` are asked for BEFORE `20260916_container_ladder_install_t_posts.sql` is
 * applied on a database that lacks it, every ladder read FAILS — which is why the branch carrying
 * this list must not merge before that migration runs.
 * 🔴 `install_price` / `install_price_because` (ledger #386) are the SAME GATE one migration later:
 * `20260923_container_ladder_install_price.sql` must be applied before a build selecting them
 * merges. This list is a SELECT list, so an unapplied column is not a missing feature — it is
 * every ladder read on the platform returning 42703. The load list, the uppot plan, the count
 * screen and the import preview all read through it.
 */
export const LADDER_FIELDS = [
  'id', 'label', 'aliases', 'sort_order', 'volume_gallons',
  'handling_minutes', 'handling_because',
  'install_t_posts_per_tree', 'install_t_posts_because',
  'caliper_min_inches', 'caliper_max_inches', 'caliper_because',
  'install_price', 'install_price_because',
  'active',
] as const;

/** DERIVED, never typed twice. */
export const LADDER_SELECT = LADDER_FIELDS.join(', ');

/** One row as PostgREST returns it — numerics may arrive as strings. */
export interface LadderRow {
  id: string; label: string; aliases: string[] | null; sort_order: number;
  volume_gallons: number | string | null; handling_minutes: number | string | null;
  handling_because: string | null;
  install_t_posts_per_tree: number | string | null; install_t_posts_because: string | null;
  caliper_min_inches: number | string | null; caliper_max_inches: number | string | null;
  caliper_because: string | null;
  install_price: number | string | null; install_price_because: string | null;
  active: boolean;
}

const numOrNull = (v: number | string | null): number | null =>
  v == null ? null : (Number.isFinite(Number(v)) ? Number(v) : null);

/** The ONE row→Rung mapping. */
export function rungFromRow(r: LadderRow): Rung {
  return {
    label: r.label,
    aliases: r.aliases ?? [],
    sortOrder: r.sort_order,
    volumeGallons: numOrNull(r.volume_gallons),
    handlingMinutes: numOrNull(r.handling_minutes),
    handlingBecause: r.handling_because ?? 'not timed',
    // NOT NULL DEFAULT 0 in the database — a null here means the row came back without it, and 0 is
    // what the database itself says for a rung nobody set. The reason says which.
    installTPostsPerTree: numOrNull(r.install_t_posts_per_tree) ?? 0,
    installTPostsBecause: r.install_t_posts_because ?? 'not set',
    caliperMinInches: numOrNull(r.caliper_min_inches),
    caliperMaxInches: numOrNull(r.caliper_max_inches),
    caliperBecause: r.caliper_because ?? 'not set',
    // 🔴 NO `?? 0` HERE, UNLIKE `installTPostsPerTree` ABOVE, AND THE DIFFERENCE IS THE DESIGN.
    // T-posts default to 0 in the database because zero posts is a real quantity. A price of 0 is
    // not a real price — it is a free install — so an absent one stays absent all the way to the
    // screen, which then asks for a number instead of charging nothing (R-171 (c)).
    installPrice: numOrNull(r.install_price),
    installPriceBecause: r.install_price_because ?? 'not set',
    active: r.active,
  };
}

/** How a list of sizes lands on a ladder — every size counted in exactly one bucket. */
export interface LadderCoverage {
  onLadder: number;
  notContainer: number;
  noSize: number;
  unreadable: number;
  /** Container sizes no rung claims — NAMED, with how many items carry each, most first. */
  offLadder: Array<{ size: string; count: number }>;
}

/**
 * Place every size in a list on the ladder (ledger #343 — the import preview's question: *"which of
 * these products are sizes this nursery grows?"*). Nothing is dropped: the five buckets sum to the
 * input length, and the off-ladder sizes are named rather than counted into an anonymous total.
 */
export function ladderCoverage(sizes: ReadonlyArray<string | null | undefined>, ladder: Ladder): LadderCoverage {
  const out: LadderCoverage = { onLadder: 0, notContainer: 0, noSize: 0, unreadable: 0, offLadder: [] };
  const off = new Map<string, { size: string; count: number }>();
  for (const size of sizes) {
    const r = resolveRung(ladder, size);
    if (r.ok) { out.onLadder++; continue; }
    if (r.reason === 'blank') out.noSize++;
    else if (r.reason === 'not_container') out.notContainer++;
    else if (r.reason === 'unreadable') out.unreadable++;
    else {
      // Two spellings of one off-ladder size ("7 gal", "7 gallon") are ONE finding — grouped by the
      // shared text fold, the same one `sameSizeOnLadder` falls back to.
      const k = normalizeSize(size).toLowerCase();
      const e = off.get(k) ?? { size: String(size).trim(), count: 0 };
      e.count++;
      off.set(k, e);
    }
  }
  out.offLadder = [...off.values()].sort((a, b) => b.count - a.count || a.size.localeCompare(b.size));
  return out;
}
