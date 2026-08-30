/**
 * ── unitOfMeasure — the unit behind `size` · 2026-08-30 (ledger #234) ──────────────────────────
 *
 * RED-first, and the RED is DAVID'S CORPUS, not an invented one. Every string below is a real
 * value from LAWNS's live inventory, their QuickBooks descriptions or their vendor invoices,
 * transcribed verbatim from the Stage 0 build prompt. The acceptance bar is stated there and it is
 * binary: **every one of the 30 strings either parses to the right kind and value, or is refused
 * and listed. No third outcome.**
 *
 * PROBES BOTH DIRECTIONS (STD-022). The positive half is the corpus. The negative half is the
 * half that catches a parser which has become too eager — a range collapsing, an unknown trade
 * code guessed into a gallon, a rope's diameter read as its size. Those are the four PRE-EXISTING
 * `normalizeSize` defects (tech-debt #125); this suite exists partly to prove they are NOT
 * reproduced here.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/inventory/unitOfMeasure.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import {
  parseUnitOfMeasure, unitColumnsFor, findMultiUnitGroups, summariseUnits, UNIT_COLUMNS, UNIT_KINDS,
  type UnitKind,
} from './unitOfMeasure';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE CORPUS — 30 real strings. `null` in the expectation column means REFUSE (and be listed).
// ══════════════════════════════════════════════════════════════════════════════════════════════
type Expect = { kind: UnitKind; value: number | null; max?: number | null; unit: string } | null;
const CORPUS: Array<[string, Expect]> = [
  // ── CONTAINER ────────────────────────────────────────────────────────────────────────────
  ['15 gallon',            { kind: 'container', value: 15,  unit: 'gallon' }],
  ['30 Gallon',            { kind: 'container', value: 30,  unit: 'gallon' }],
  ['45 gal',               { kind: 'container', value: 45,  unit: 'gallon' }],
  ['7 gal',                { kind: 'container', value: 7,   unit: 'gallon' }],
  ['#30',                  { kind: 'container', value: 30,  unit: 'gallon' }],
  ['15#',                  { kind: 'container', value: 15,  unit: 'gallon' }],
  ['#3/5',                 { kind: 'container', value: 3,   max: 5,  unit: 'gallon' }],
  ['25/30',                { kind: 'container', value: 25,  max: 30, unit: 'gallon' }],
  ['10/15 gallon',         { kind: 'container', value: 10,  max: 15, unit: 'gallon' }],
  ['3GP',                  null],   // unknown trade code — Lauren/Joel to name it
  ['1DP',                  null],   // unknown trade code
  ['2DP',                  null],   // unknown trade code
  ['10.0 Qt',              { kind: 'container', value: 10,  unit: 'quart' }],
  ['QT',                   { kind: 'container', value: 1,   unit: 'quart' }],
  ['24 box',               { kind: 'container', value: 24,  unit: 'box' }],
  ['95 gallon container',  { kind: 'container', value: 95,  unit: 'gallon' }],
  // ── VOLUME ───────────────────────────────────────────────────────────────────────────────
  ['1/2 Yard Scoop',       { kind: 'volume', value: 0.5, unit: 'yard' }],
  ['1 Yard Scoop',         { kind: 'volume', value: 1,   unit: 'yard' }],
  ['1 Yard',               { kind: 'volume', value: 1,   unit: 'yard' }],
  ['by the yard',          { kind: 'volume', value: null, unit: 'yard' }],   // unit named, quantity not stated
  // ── WEIGHT ───────────────────────────────────────────────────────────────────────────────
  ['50lb Bag',             { kind: 'weight', value: 50,  unit: 'lb' }],
  ['40lb Bag',             { kind: 'weight', value: 40,  unit: 'lb' }],
  ['4lb Bottle',           { kind: 'weight', value: 4,   unit: 'lb' }],
  ['3lb Bag',              { kind: 'weight', value: 3,   unit: 'lb' }],
  ['1.5lb Bottle',         { kind: 'weight', value: 1.5, unit: 'lb' }],
  ['5lb Bottle',           { kind: 'weight', value: 5,   unit: 'lb' }],
  // ── LENGTH ───────────────────────────────────────────────────────────────────────────────
  // 🔴 The 5/8" is the rope's DIAMETER, not how much you get. "by the roll" is the sale unit and
  //    the quantity is not stated. `skuSizeSuffix` reads this string as "8IN" today — a diameter
  //    laundered into a container size (tech-debt #125, defect 4). It is NOT repeated here.
  ['5/8" flat Rope by the roll', { kind: 'length', value: null, unit: 'roll' }],
  // ── EACH / KIT ───────────────────────────────────────────────────────────────────────────
  ['[2 T-Posts]',          { kind: 'each', value: 2, unit: 'post' }],
  ['[3 T-Posts]',          { kind: 'each', value: 3, unit: 'post' }],
  ['[4 T-Posts]',          { kind: 'each', value: 4, unit: 'post' }],
];

ok(CORPUS.length === 30, `the corpus is all 30 strings from the prompt (got ${CORPUS.length})`);

const refused: string[] = [];
for (const [raw, exp] of CORPUS) {
  const got = parseUnitOfMeasure(raw);
  if (exp === null) {
    ok(got === null, `REFUSE "${raw}" — an unknown code is null, never guessed (got ${JSON.stringify(got)})`);
    if (got === null) refused.push(raw);
    continue;
  }
  if (!got) { ok(false, `"${raw}" → expected ${exp.kind}/${exp.value}/${exp.unit}, got REFUSE`); continue; }
  ok(got.kind === exp.kind,                    `"${raw}" → kind ${exp.kind} (got ${got.kind})`);
  ok(got.value === exp.value,                  `"${raw}" → value ${exp.value} (got ${got.value})`);
  ok(got.unit === exp.unit,                    `"${raw}" → unit ${exp.unit} (got ${got.unit})`);
  ok(got.valueMax === (exp.max ?? null),       `"${raw}" → valueMax ${exp.max ?? null} (got ${got.valueMax})`);
}
ok(refused.length === 3, `exactly 3 corpus strings refuse, and they are listed: ${refused.join(' · ')}`);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NEGATIVE CONTROLS — the mutants a too-eager parser would produce. Each of these PASSING is
// what distinguishes this parser from the one that already exists.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ── 🔴 A RANGE IS NEVER COLLAPSED. `normalizeSize` returns "15 Gallon" for the first and
//    "3 Gallon" for the second, discarding the other end with no trace (measured 2026-08-30).
ok(parseUnitOfMeasure('10/15 gallon')?.valueMax === 15, 'range: "10/15 gallon" KEEPS 15 as the high end');
ok(parseUnitOfMeasure('10/15 gallon')?.value === 10,    'range: "10/15 gallon" KEEPS 10 — the end normalizeSize discards');
ok(parseUnitOfMeasure('#3/5')?.value === 3 && parseUnitOfMeasure('#3/5')?.valueMax === 5,
   'range: "#3/5" is 3-to-5, not 3 (normalizeSize returns "3 Gallon" and loses the 5)');
ok(parseUnitOfMeasure('45 gal')?.valueMax === null, 'a NON-range carries valueMax null — a range is not manufactured');

// ── 🔴 THE TWO TRADE-NUMBER FORMS AGREE. normalizeSize reads "#15" and not "15#", so the two do
//    not compare equal to it. Not fixed there (out of scope); not repeated here.
const hashBefore = parseUnitOfMeasure('#15'), hashAfter = parseUnitOfMeasure('15#');
ok(hashBefore?.value === 15 && hashAfter?.value === 15 && hashBefore?.unit === hashAfter?.unit,
   '"#15" and "15#" are the same size to this parser (they are not to normalizeSize — tech-debt #125)');

// ── 🔴 A DIAMETER IS NOT A SIZE. If this ever returns inch/0.625 the rope defect has been
//    laundered into a new column, which is the outcome ruled out for this pass.
const rope = parseUnitOfMeasure('5/8" flat Rope by the roll');
ok(rope?.unit === 'roll' && rope?.value === null, 'the rope reports its SALE unit (roll), never its 5/8" diameter');

// ── 🔴 AN UNKNOWN UNIT REFUSES rather than defaulting to the biggest family.
ok(parseUnitOfMeasure('3GP') === null,        'an unknown code does not fall through to gallon');
ok(parseUnitOfMeasure('widget') === null,     'an unknown word is refused, not typed');
ok(parseUnitOfMeasure('5 furlongs') === null, 'a real unit we do not carry is refused, not coerced');

// ── 🔴 A BARE DECIMAL IS NOT A GALLON — sizeLabel.ts's own reasoning, kept: "1.5" is far more
//    likely a caliper inch than a fractional gallon. Only a bare INTEGER is gallon-class.
ok(parseUnitOfMeasure('15')?.unit === 'gallon', 'a bare INTEGER is gallon-class (the trade convention)');
ok(parseUnitOfMeasure('1.5') === null,          'a bare DECIMAL is NOT forced into a gallon — refused instead');

// ── 🔴 A WEIGHT IS NOT READ AS A CONTAINER. "50lb Bag" must never become a 50-gallon pot: that
//    is the single most expensive confusion this whole story exists to prevent.
for (const w of ['50lb Bag', '40lb Bag', '3lb Bag', '5lb Bottle']) {
  ok(parseUnitOfMeasure(w)?.kind === 'weight', `"${w}" is WEIGHT, never container`);
}
ok(parseUnitOfMeasure('1 Yard Scoop')?.kind === 'volume', 'a yard scoop is VOLUME, never container');

// ── 🔴 THE FRACTION / RANGE SPLIT — the one genuinely subtle rule in the ladder.
ok(parseUnitOfMeasure('1/2 Yard Scoop')?.value === 0.5, 'a/b before a VOLUME unit is a FRACTION (half a yard)');
ok(parseUnitOfMeasure('25/30')?.valueMax === 30,        'a/b as bare trade numbers is a RANGE (a 25-or-30 pot)');

// ── empty / absent
ok(parseUnitOfMeasure(null) === null && parseUnitOfMeasure('') === null && parseUnitOfMeasure('   ') === null,
   'blank, empty and null all refuse');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// unitColumnsFor — the DB shape, and the three states it must keep DISTINGUISHABLE
// ══════════════════════════════════════════════════════════════════════════════════════════════
ok(UNIT_COLUMNS.length === 5, 'UNIT_COLUMNS names all five columns (the backfill and the cap share it)');
ok(UNIT_KINDS.length === 5,   'the taxonomy is CLOSED at five kinds');

const parsed = unitColumnsFor('45 gal');
ok(parsed.unit_kind === 'container' && parsed.unit_value === 45 && parsed.unit_name === 'gallon',
   'unitColumnsFor: a parse fills the four value columns');
ok(parsed.unit_parsed_from === '45 gal', 'unitColumnsFor: parsed_from is the size VERBATIM (the projection proof)');

const refusedCols = unitColumnsFor('3GP');
ok(refusedCols.unit_kind === null && refusedCols.unit_value === null && refusedCols.unit_name === null,
   'unitColumnsFor: a REFUSAL writes nulls — never a guess');
ok(refusedCols.unit_parsed_from === '3GP',
   '🔴 a REFUSAL still stamps parsed_from — "read it and declined" must stay distinguishable from "never read"');

const absent = unitColumnsFor(null);
ok(absent.unit_parsed_from === null && absent.unit_kind === null,
   '🔴 a BLANK size leaves parsed_from NULL — nothing was parsed and nothing claims to have been');
ok(unitColumnsFor('  ').unit_parsed_from === null, 'a whitespace-only size is treated as blank, not as a refusal');

// verbatim, not folded — the DB check compares parsed_from to size with IS NOT DISTINCT FROM, so
// any folding here would make the projection invalidate itself on a stray space.
ok(unitColumnsFor(' 45 GAL ').unit_parsed_from === ' 45 GAL ', 'parsed_from is NOT trimmed or folded');
ok(unitColumnsFor(' 45 GAL ').unit_value === 45, '…but the PARSE still tolerates the stray space and case');

// ── 🔴 THE RE-PARSE PROPERTY — the invariant the DB check and the backfill --verify mode both
//    assert. Re-deriving from `unit_parsed_from` must reproduce the stored columns EXACTLY, or the
//    columns are a second materialisation rather than a projection.
let reparseMismatches = 0;
for (const [raw] of CORPUS) {
  const a = unitColumnsFor(raw);
  const b = unitColumnsFor(a.unit_parsed_from ?? raw);
  if (JSON.stringify(a) !== JSON.stringify(b)) { reparseMismatches++; console.error('   ✗ re-parse drift on ' + raw); }
}
ok(reparseMismatches === 0, 'RE-PARSE: deriving again from parsed_from reproduces every corpus row exactly');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE MULTI-UNIT FAMILY FLAG — the case that defines the story
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Fertile Compost Mix: three bucket sizes and two scoop sizes. One pile, five sale units, TWO kinds.
const COMPOST = [
  { sku: 'FCMB15', name: 'Fertile Compost Mix, 15gal bucket',   size: '15 gallon' },
  { sku: 'FCMB30', name: 'Fertile Compost Mix, 30gal bucket',   size: '30 gallon' },
  { sku: 'FCMB45', name: 'Fertile Compost Mix, 45gal bucket',   size: '45 gallon' },
  { sku: 'SFCM1',  name: 'Fertile Compost Mix, 1/2 Yard Scoop', size: '1/2 Yard Scoop' },
  { sku: 'SFCM2',  name: 'Fertile Compost Mix, 1 Yard Scoop',   size: '1 Yard Scoop' },
].map(r => ({ name: r.name, variant_group: 'fertile-compost-mix', unit_kind: unitColumnsFor(r.size).unit_kind }));

const flagged = findMultiUnitGroups(COMPOST);
ok(flagged.length === 1, 'the five compost SKUs flag as ONE multi-unit family');
ok(flagged[0]?.variantGroup === 'fertile-compost-mix', 'the flag names the family');
ok(JSON.stringify(flagged[0]?.kinds) === JSON.stringify(['container', 'volume']),
   'the flag reports BOTH kinds present — container (buckets) and volume (scoops)');
ok(flagged[0]?.rowCount === 5, 'all five rows are counted in the family');
ok(flagged[0]?.names.length === 5, 'the flag NAMES the rows so a report can say which, not just how many');

// negative controls on the flag — the half that stops it crying wolf
const oneKind = ['15 gallon', '30 Gallon', '45 gal'].map((s, i) => ({
  name: `Vitex ${i}`, variant_group: 'shoal-creek-vitex', unit_kind: unitColumnsFor(s).unit_kind,
}));
ok(findMultiUnitGroups(oneKind).length === 0, 'a normal size family (three gallon sizes) does NOT flag');

const withUnparsed = [
  { name: 'A', variant_group: 'g', unit_kind: unitColumnsFor('15 gallon').unit_kind },
  { name: 'B', variant_group: 'g', unit_kind: unitColumnsFor('3GP').unit_kind },   // refused → null
];
ok(findMultiUnitGroups(withUnparsed).length === 0,
   '🔴 an UNPARSED row is not evidence of a second kind — a refusal must not manufacture a flag');

const noGroup = [
  { name: 'A', variant_group: null, unit_kind: unitColumnsFor('15 gallon').unit_kind },
  { name: 'B', variant_group: '  ', unit_kind: unitColumnsFor('1 Yard').unit_kind },
];
ok(findMultiUnitGroups(noGroup).length === 0, 'ungrouped rows cannot form a family');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// summariseUnits — THE PER-TENANT REPORT. This is the acceptance criterion *"report per tenant:
// parsed, unparsed, and the unparsed values listed"* made provable HERE, rather than owed until
// someone with a service key runs the backfill.
// ══════════════════════════════════════════════════════════════════════════════════════════════
// A tenant shaped like the one this build is for: real container sizes, the compost family in two
// unit kinds, two unknown trade codes (one of them twice), and a row with no size at all.
const TENANT = [
  { name: 'Shoal Creek Vitex',                  size: '15 gallon',      variant_group: 'shoal-creek-vitex' },
  { name: 'Shoal Creek Vitex',                  size: '45 gal',         variant_group: 'shoal-creek-vitex' },
  { name: 'Fertile Compost Mix, 15gal bucket',  size: '15 gallon',      variant_group: 'fertile-compost-mix' },
  { name: 'Fertile Compost Mix, 30gal bucket',  size: '30 Gallon',      variant_group: 'fertile-compost-mix' },
  { name: 'Fertile Compost Mix, 45gal bucket',  size: '45 gal',         variant_group: 'fertile-compost-mix' },
  { name: 'Fertile Compost Mix, 1/2 Yard Scoop',size: '1/2 Yard Scoop', variant_group: 'fertile-compost-mix' },
  { name: 'Fertile Compost Mix, 1 Yard Scoop',  size: '1 Yard Scoop',   variant_group: 'fertile-compost-mix' },
  { name: 'Liner tray A',                       size: '3GP',            variant_group: null },
  { name: 'Liner tray B',                       size: '3GP',            variant_group: null },
  { name: 'Liner tray C',                       size: '1DP',            variant_group: null },
  { name: 'Netting (a service, not a pot)',     size: null,             variant_group: null },
].map(r => ({ ...r, unit_parsed_from: null, unit_kind: null }));

const sum = summariseUnits(TENANT);
ok(sum.rows === 11,   'summary: every row counted');
ok(sum.parsed === 7,  `summary: 7 parsed (got ${sum.parsed})`);
ok(sum.refused === 3, `summary: 3 refused (got ${sum.refused})`);
ok(sum.noSize === 1,  'summary: the size-less row is counted as noSize, NOT as a failure');
ok(sum.parsed + sum.refused + sum.noSize === sum.rows,
   '🔴 the three buckets are EXHAUSTIVE — every row is parsed, refused, or has no size. No third outcome.');
ok(sum.notYetParsed === 10, 'summary: 10 rows carry no stored projection yet (the backfill has work to do)');
ok(sum.disagreements === 0, 'summary: nothing DISAGREES — an all-null projection is absent, not wrong');

// 🔴 REFUSALS ARE LISTED AND DE-DUPLICATED, most frequent first — a count alone would let an
//    unreadable vocabulary hide inside a percentage.
ok(sum.refusedValues.length === 2, `summary: 2 DISTINCT unparsed values (got ${sum.refusedValues.length})`);
ok(sum.refusedValues[0].value === '3GP' && sum.refusedValues[0].count === 2,
   'summary: the most frequent unparsed value is listed first, with its count');
ok(sum.refusedValues.some(v => v.value === '1DP'), 'summary: every distinct unparsed value appears, not just the top one');

// the compost family is flagged, the vitex family is not
ok(sum.families.length === 1 && sum.families[0].variantGroup === 'fertile-compost-mix',
   '🔴 summary: the compost family is flagged as multi-unit; the two-size vitex family is not');
ok(JSON.stringify(sum.families[0].kinds) === JSON.stringify(['container', 'volume']),
   'summary: the flag names both kinds — buckets AND scoops');

// ── disagreement detection: a row whose stored projection describes a DIFFERENT string.
//    The DB trigger should make this unreachable; the report exists to say so if it is not.
const drifted = summariseUnits([
  { name: 'moved', size: '1 Yard Scoop', unit_parsed_from: '45 gal', unit_kind: 'container' },
]);
ok(drifted.disagreements === 1, '🔴 a projection describing an OLD size is reported as a DISAGREEMENT');
const consistent = summariseUnits([
  { name: 'fine', size: '45 gal', unit_parsed_from: '45 gal', unit_kind: 'container' },
]);
ok(consistent.disagreements === 0 && consistent.notYetParsed === 0,
   'a correctly-projected row is neither a disagreement nor unparsed work');
const refusedStored = summariseUnits([
  { name: 'declined', size: '3GP', unit_parsed_from: '3GP', unit_kind: null },
]);
ok(refusedStored.disagreements === 0,
   '🔴 a stored REFUSAL (parsed_from set, kind null) is not a disagreement — it is a recorded answer');

console.log(`\n${passed} passed / ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
