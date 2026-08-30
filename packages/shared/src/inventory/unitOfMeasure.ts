// ============================================================
// unitOfMeasure — the ONE parse of `business_inventory.size` into a unit (STD-011)
//
// PURPOSE:      `size` is free text and was built for ONE unit family — container gallons; its own
//               migration (20260628) says so: *"container gallons / caliper inches / height"*. LAWNS's
//               real catalogue carries at least SIX: container, volume (yard scoops), weight (bags,
//               bottles), length (by the roll), and each/kit (T-posts). A quantity of 300 is
//               meaningless until the row says whether that is 300 buckets, 300 yards or 300 bags.
//               This module reads a size label and reports the unit it denotes — kind, value,
//               optional range end, and unit name — or REFUSES.
//
// 🔴 THIS IS A PROJECTION OF `size`, NEVER A PARALLEL TRUTH. Read this before touching anything:
//   · `size` remains THE stored value. D-23 / faithful-before-connected: we never rewrite what the
//     grower typed. `sizeLabel.ts`'s own header says the same thing about normalizeSize, and the
//     rule is identical here — this is a READ of the owner's string, not a correction of it.
//   · The unit columns are DERIVED from `size` on every write, through THIS function and no other.
//   · They are NEVER independently editable. No field, no cell, no API, no grid. They are registered
//     in `systemManagedFields.ts` so the day one is rendered it locks with an explanation.
//   · `unit_parsed_from` carries the EXACT string the parse was computed from. That is what lets the
//     projection prove itself: `unit_parsed_from = size` means these columns describe THIS label.
//     A DB CHECK asserts it and a BEFORE-write trigger NULLs the projection when `size` moves
//     without a fresh derive — so the columns are either right or absent, never stale-and-wrong.
//     (`20260830_inventory_unit_of_measure.sql`.)
//   A second materialisation of one fact is the defect this shape exists to make unreachable.
//
// 🔴 UNPARSEABLE IS A LEGAL OUTCOME AND IT IS RECORDED, NOT GUESSED (§1.6 item 3, D-9). A refusal
//   returns kind/value/unit NULL with `unit_parsed_from` SET — which is how "the parser ran and
//   declined" stays distinguishable from "the parser has not run here yet" (all-NULL). The backfill
//   report LISTS every refusal rather than reporting a clean number over a guess.
//
// 🔴 A RANGE IS A RANGE OR IT IS A REFUSAL — it is never silently collapsed. `normalizeSize` today
//   turns "10/15 gallon" into "15 Gallon" and "#3/5" into "3 Gallon", discarding the other end with
//   no trace (measured 2026-08-30). Those four container defects are PRE-EXISTING, logged as
//   tech-debt #125, and DELIBERATELY NOT FIXED here — but they are also NOT REPRODUCED: a new column
//   carrying a laundered range would be worse than the old one, which at least has a known bug.
//
// DEPENDENCIES: none (zero-dep leaf, deliberately — a client grid, a node backfill script and the
//               verify cap all import it, and none of them may drag a transitive dep in).
// OUTPUTS:      UnitKind · UnitParse · UNIT_COLUMNS · parseUnitOfMeasure · unitColumnsFor ·
//               findMultiUnitGroups.
// NOT THIS MODULE: conversion between units · product grouping · stock in a base unit. The first is
//               the per-size unit-multiplier hook named in InventoryCount.tsx:59-62 and in the
//               *Count promotes size + qty* story; it is still owed there. Conversion additionally
//               needs a fact nobody has — whether compost is STOCKED in yards or in buckets — and
//               that is Lauren's answer, not a default we pick.
// STORY:        user_stories.md → *A quantity that means something — the unit of measure behind
//               `size`* (2.3, asset-inventory-pmi). Ledger #234.
// ============================================================

/** The CLOSED unit taxonomy. Five kinds, and the set does not grow without a migration — the
 *  DB carries a NAMED CHECK constraint over exactly these values (`..._unit_kind_check`; named
 *  rather than inline so a future sweep can find it by `conname` — tech-debt #91's lesson). */
export type UnitKind = 'container' | 'volume' | 'weight' | 'length' | 'each';

export const UNIT_KINDS: readonly UnitKind[] = ['container', 'volume', 'weight', 'length', 'each'];

/** The parse of one size label. `value` is the single value OR the LOW end of a range; `valueMax`
 *  is the HIGH end and is null when the label names one size. `value` may be null when the label
 *  names a unit but states no quantity ("by the yard" — sold by the yard, how many unstated). */
export interface UnitParse {
  kind:     UnitKind;
  value:    number | null;
  valueMax: number | null;
  unit:     string;
}

/** The five DB columns this module owns, in one place so the backfill script and the verify cap
 *  cannot drift from the writers (the shape of every STD-011 defect we have paid for). */
export const UNIT_COLUMNS = ['unit_kind', 'unit_value', 'unit_value_max', 'unit_name', 'unit_parsed_from'] as const;

/** The DB row shape. A refusal is `kind/value/valueMax/name` NULL with `parsed_from` SET; a size
 *  that is blank or absent is ALL NULL (nothing was parsed, and nothing claims to have been). */
export interface UnitColumns {
  unit_kind:        UnitKind | null;
  unit_value:       number | null;
  unit_value_max:   number | null;
  unit_name:        string | null;
  unit_parsed_from: string | null;
}

// ── THE UNIT VOCABULARY ────────────────────────────────────────────────────────────────────────
// Canonical unit name → its kind. A unit NOT in this map is a REFUSAL, which is the safe direction:
// an unknown unit produces an honest null rather than a plausible wrong kind. Every entry below is
// justified by a string in LAWNS's live corpus or by vocabulary already in this codebase —
// `flat` and `tray` come from InventoryCount.tsx's own size placeholder and from the documented
// unit-multiplier hook, not from imagination.
const UNIT_KIND_OF: Record<string, UnitKind> = {
  gallon: 'container', quart: 'container', box: 'container',
  yard:   'volume',
  lb:     'weight',    oz: 'weight',
  inch:   'length',    foot: 'length', roll: 'length',
  post:   'each',      flat: 'each',   tray: 'each', each: 'each',
};

const N = String.raw`\d+(?:\.\d+)?`;

/** Parse a numeric token. Handles integers and decimals; "5.0" → 5. */
function num(raw: string): number { return Number(raw); }

function mk(kind: UnitKind, value: number | null, unit: string, valueMax: number | null = null): UnitParse {
  // A range is stored low→high regardless of the order it was written in.
  if (value != null && valueMax != null && valueMax < value) return { kind, value: valueMax, valueMax: value, unit };
  return { kind, value, valueMax, unit };
}

/**
 * Read a size label and report the unit it denotes, or null when it cannot be read.
 *
 * FIRST MATCH WINS, and the LADDER ORDER IS THE SPECIFICATION — it is what keeps "1/2 Yard Scoop"
 * a fraction while "10/15 gallon" is a range, and what stops the rope's 5/8" diameter being read
 * as its sale size. Read the rungs in order; do not reorder without re-running the corpus.
 */
export function parseUnitOfMeasure(raw: string | null | undefined): UnitParse | null {
  const t = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (t === '') return null;
  const s = t.toLowerCase();

  // ── 1. BRACKETED KIT — "[2 T-Posts]" → 2 posts. The bracket is LAWNS's own convention for a
  //       kit of N countable things, and it is unambiguous, so it goes first.
  const kit = s.match(new RegExp(String.raw`^\[\s*(${N})\s+([a-z][a-z-]*?)s?\s*\]$`));
  if (kit) {
    const word = kit[2].replace(/^t-/, '');           // "t-posts" → "post"
    const kind = UNIT_KIND_OF[word];
    if (kind) return mk(kind, num(kit[1]), word);
  }

  // ── 2. "BY THE <unit>" — the sale unit is named and the QUANTITY IS NOT STATED. This rung is
  //       ABOVE every measurement rung on purpose: it is what makes
  //       `5/8" flat Rope by the roll` report *sold by the roll, length unstated* instead of
  //       reading the rope's DIAMETER as its size. Reproducing that diameter in a new column is
  //       exactly the laundered defect ruled out for this pass (tech-debt #125, defect 4).
  const bythe = s.match(/\bby the ([a-z]+)\b/);
  if (bythe) {
    const kind = UNIT_KIND_OF[bythe[1]];
    if (kind) return mk(kind, null, bythe[1]);
  }

  // ── 3. WEIGHT — "50lb Bag", "1.5lb Bottle". The vessel word (bag/bottle) is decoration; the
  //       measure is the pounds. Above the container rungs so a bare number in "50lb" is never
  //       read as a gallon-class trade number.
  const wt = s.match(new RegExp(String.raw`(${N})\s*(?:lbs?|pounds?)\b`));
  if (wt) return mk('weight', num(wt[1]), 'lb');
  const oz = s.match(new RegExp(String.raw`(${N})\s*(?:oz|ounces?)\b`));
  if (oz) return mk('weight', num(oz[1]), 'oz');

  // ── 4. VOLUME — "1/2 Yard Scoop", "1 Yard Scoop", "1 Yard". A FRACTION here is a real fractional
  //       quantity: you buy half a yard of compost. (You do not buy a "10-or-15 yard" scoop, which
  //       is why the range rung below is scoped to CONTAINER labels and not to this one.)
  const ydFrac = s.match(new RegExp(String.raw`(${N})\s*/\s*(${N})\s*(?:yards?|yds?)\b`));
  if (ydFrac) return mk('volume', num(ydFrac[1]) / num(ydFrac[2]), 'yard');
  const yd = s.match(new RegExp(String.raw`(${N})\s*(?:yards?|yds?)\b`));
  if (yd) return mk('volume', num(yd[1]), 'yard');

  // ── 5. LENGTH — an explicit foot/inch measure that is the sale size (a 6ft tree). The rope case
  //       never reaches here; rung 2 took it.
  const ft = s.match(new RegExp(String.raw`(${N})\s*(?:ft|foot|feet)\b`));
  if (ft) return mk('length', num(ft[1]), 'foot');
  const inch = s.match(new RegExp(String.raw`(${N})\s*(?:"|in\b|inch(?:es)?\b)`));
  if (inch) return mk('length', num(inch[1]), 'inch');

  // ── 6. CONTAINER · QUART — "10.0 Qt", and a bare "QT" meaning a one-quart pot.
  const qt = s.match(new RegExp(String.raw`(${N})\s*(?:qts?|quarts?)\b`));
  if (qt) return mk('container', num(qt[1]), 'quart');
  if (/^(?:qt|quart)s?$/.test(s)) return mk('container', 1, 'quart');

  // ── 7. CONTAINER · BOX — "24 box" (a 24-inch box tree; recorded as written, 24 box, rather than
  //       reinterpreted into inches — faithful-before-connected).
  const box = s.match(new RegExp(String.raw`(${N})\s*box(?:es)?\b`));
  if (box) return mk('container', num(box[1]), 'box');

  // ── 8. CONTAINER · GALLON RANGE — "#3/5", "10/15 gallon", "25/30". A RANGE IS KEPT AS A RANGE.
  //       This is the rung that exists because `normalizeSize` collapses these three today and
  //       discards the other end with no trace. Both ends land; nothing is invented.
  const galRange =
    s.match(new RegExp(String.raw`^#\s*(${N})\s*/\s*(${N})$`)) ||                          // #3/5
    s.match(new RegExp(String.raw`^(${N})\s*/\s*(${N})\s*-?\s*gal(?:lon)?s?\b`)) ||        // 10/15 gallon
    s.match(new RegExp(String.raw`^(\d+)\s*/\s*(\d+)$`));                                  // 25/30 (bare trade numbers)
  if (galRange) return mk('container', num(galRange[1]), 'gallon', num(galRange[2]));

  // ── 9. CONTAINER · GALLON — the family sizeLabel.ts already documents as gallon-class under
  //       ANSI Z60.1: "15 gallon" / "45 gal" / "7gal" / "45G" / "#30" / "15#" / bare "15".
  //       ⚠️ BOTH `#N` AND `N#` are read here. `normalizeSize` handles only the first, so "15#"
  //       and "#15" do not compare equal to it (tech-debt #125, defect 3). That defect is left
  //       standing in `normalizeSize` as instructed; it is simply not REPEATED here.
  //       A bare DECIMAL is NOT gallon-class — sizeLabel.ts's own reasoning, kept: "1.5" is far
  //       more likely a caliper inch than a fractional gallon, so only a bare INTEGER folds.
  const gal =
    s.match(new RegExp(String.raw`(${N})\s*-?\s*gal(?:lon)?s?\b`)) ||   // 15 gallon / 45-gallon / 7gal
    s.match(new RegExp(String.raw`^(${N})\s*g$`)) ||                    // 45G / 45 g
    s.match(new RegExp(String.raw`^#\s*(${N})$`)) ||                    // #30
    s.match(new RegExp(String.raw`^(${N})\s*#$`)) ||                    // 15#
    s.match(/^(\d+)$/);                                                 // bare INTEGER
  if (gal) return mk('container', num(gal[1]), 'gallon');

  // ── 10. REFUSE. An unknown trade code ("3GP", "1DP", "2DP") stops here and says so. Guessing a
  //        gallon out of "3GP" would be exactly the fabrication D-9 forbids, and the string is
  //        preserved in `size` so the refusal costs nothing but a question for Lauren.
  return null;
}

/**
 * The DB column values for a size label — the ONE derive every writer calls. Total: it always
 * returns all five columns, so a write can never leave half a projection behind.
 *
 * · size blank/absent → ALL NULL. Nothing was parsed and nothing claims to have been.
 * · parse refused     → kind/value/max/name NULL, `unit_parsed_from` SET. "We read this exact
 *                       string and could not name its unit" — an honest, queryable state that is
 *                       distinguishable from "not yet parsed".
 * · parse succeeded   → the four values, `unit_parsed_from` SET to the size VERBATIM.
 *
 * `unit_parsed_from` is stored EXACTLY as given (not trimmed, not folded) because the DB check and
 * the trigger compare it to `size` with `IS NOT DISTINCT FROM`. Fold it and the projection would
 * invalidate itself on every write of a size with a stray space.
 */
export function unitColumnsFor(size: string | null | undefined): UnitColumns {
  if (size == null || size.trim() === '') {
    return { unit_kind: null, unit_value: null, unit_value_max: null, unit_name: null, unit_parsed_from: null };
  }
  const p = parseUnitOfMeasure(size);
  if (!p) {
    return { unit_kind: null, unit_value: null, unit_value_max: null, unit_name: null, unit_parsed_from: size };
  }
  return {
    unit_kind:        p.kind,
    unit_value:       p.value,
    unit_value_max:   p.valueMax,
    unit_name:        p.unit,
    unit_parsed_from: size,
  };
}

/**
 * 🔴 THE ONE PLACE THE RULE "IF YOU WRITE `size`, YOU WRITE ITS PROJECTION" LIVES.
 *
 * Every writer of `business_inventory.size` spreads this over its patch/insert values, so the
 * projection cannot be forgotten at one site and remembered at another — which is how a derived
 * column quietly becomes a parallel truth. A patch that does NOT carry `size` is returned
 * untouched: it is not this function's business to re-derive a column nobody is moving.
 *
 * The DB trigger (`20260830_inventory_unit_of_measure.sql` §4) is the backstop, not the mechanism:
 * a writer that forgets this call produces an UNPARSED row, never a stale one.
 */
export function withUnitColumns<T extends Record<string, unknown>>(patch: T): T {
  if (!('size' in patch)) return patch;
  return { ...patch, ...unitColumnsFor(patch.size as string | null | undefined) };
}

// ── THE MULTI-UNIT FAMILY FLAG ─────────────────────────────────────────────────────────────────
// Fertile Compost Mix sells as a 15/30/45 gallon BUCKET and as a half-yard and full-yard SCOOP —
// one pile of compost, five sale units, two unit KINDS. That family is the case this whole story
// exists for, and the honest thing to do about it in this pass is to SAY SO. Detection only:
// never merge, never convert, never offer a picker. Whether compost is stocked in yards or in
// buckets is Lauren's answer and it is a later pass.

/** The structural minimum the flag reads. A live grid row and a freshly-parsed row both satisfy it. */
export interface MultiUnitCandidate {
  name:           string;
  variant_group?: string | null;
  unit_kind?:     UnitKind | null;
}

export interface MultiUnitGroup {
  variantGroup: string;
  kinds:        UnitKind[];   // the distinct kinds present, sorted — ≥2 by construction
  rowCount:     number;       // rows in the group carrying a parsed kind
  names:        string[];     // the row names, so a report can NAME the family rather than count it
}

// ── THE PER-TENANT REPORT ──────────────────────────────────────────────────────────────────────
// Extracted from the backfill script and made PURE so the acceptance criterion — *report per tenant:
// parsed, unparsed, and the unparsed values listed* — is provable in `npm run verify` instead of
// being owed until someone with a service key runs the script. The script formats this; it does not
// compute it. (The alternative was a number nobody could check until the day it mattered.)

export interface UnitSummaryRow {
  name:              string;
  size:              string | null;
  variant_group?:    string | null;
  unit_kind?:        UnitKind | null;
  unit_parsed_from?: string | null;
}

export interface UnitSummary {
  rows:           number;
  parsed:         number;                    // size present AND the parser named a unit
  refused:        number;                    // size present AND the parser declined — listed below
  noSize:         number;                    // no size at all: nothing to parse, not a failure
  notYetParsed:   number;                    // stored projection absent — the RPC paths mint these
  disagreements:  number;                    // 🔴 stored projection ≠ a fresh parse of the row's size
  refusedValues:  Array<{ value: string; count: number }>;   // DISTINCT, most frequent first
  families:       MultiUnitGroup[];
}

/**
 * Summarise one tenant's rows. Pure — no DB, no formatting, no side effects.
 *
 * `disagreements` is the live half of the re-parse check: a row whose STORED unit columns do not
 * equal a fresh `unitColumnsFor(row.size)` while claiming to have been parsed. The DB trigger is
 * meant to make that unreachable, so a non-zero count means the guard is not applied — which is
 * exactly the thing worth being told, rather than quietly corrected.
 */
export function summariseUnits(rows: UnitSummaryRow[]): UnitSummary {
  const refusedValues = new Map<string, number>();
  let parsed = 0, refused = 0, noSize = 0, notYetParsed = 0, disagreements = 0;

  for (const r of rows) {
    const want = unitColumnsFor(r.size);
    if (r.size == null || r.size.trim() === '') noSize++;
    else if (want.unit_kind != null) parsed++;
    else { refused++; refusedValues.set(r.size, (refusedValues.get(r.size) ?? 0) + 1); }

    if (r.unit_parsed_from == null) { if (r.size != null && r.size.trim() !== '') notYetParsed++; }
    else if (r.unit_parsed_from !== r.size || (r.unit_kind ?? null) !== want.unit_kind) disagreements++;
  }

  return {
    rows: rows.length, parsed, refused, noSize, notYetParsed, disagreements,
    refusedValues: [...refusedValues.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    families: findMultiUnitGroups(
      rows.map(r => ({ name: r.name, variant_group: r.variant_group, unit_kind: unitColumnsFor(r.size).unit_kind })),
    ),
  };
}

/**
 * Find variant_groups carrying MORE THAN ONE unit_kind. Pure. Rows with a blank group or an
 * unparsed kind cannot participate — an unparsed row is not evidence of a second kind, and
 * treating it as one would manufacture a flag out of a refusal.
 */
export function findMultiUnitGroups(rows: MultiUnitCandidate[]): MultiUnitGroup[] {
  const groups = new Map<string, { kinds: Set<UnitKind>; names: string[]; rowCount: number }>();
  for (const r of rows) {
    const vg = (r.variant_group ?? '').trim();
    if (!vg || !r.unit_kind) continue;
    const g = groups.get(vg) ?? { kinds: new Set<UnitKind>(), names: [], rowCount: 0 };
    g.kinds.add(r.unit_kind);
    g.names.push(r.name);
    g.rowCount += 1;
    groups.set(vg, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.kinds.size > 1)
    .map(([variantGroup, g]) => ({
      variantGroup,
      kinds:    [...g.kinds].sort(),
      rowCount: g.rowCount,
      names:    g.names,
    }));
}
