/**
 * ── sizeLabel — the ONE size vocabulary · 2026-07-23 (ledger #150 · tech-debt #56) ──
 *
 * RED-first. The failing case that motivated it: a catalog size stored as bare "45" and a CSV size
 * "45 gal" MUST be the same size, so the import resolves to the existing lot instead of minting a
 * duplicate. Same discipline as canonicalName's nameTokenSet — fold before comparing.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/utils/sizeLabel.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { normalizeSize, sameSizeLabel, formatSize, sizeIsRecorded, SIZE_ABSENT } from './sizeLabel';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── the gallon family folds to ONE form (David's required equivalence set) ────────
const FORTY_FIVE = ['45', '45 gal', '45gal', '45 gallon', '45-gallon', '45G', '45 g', '#45', ' 45 GAL '];
for (const a of FORTY_FIVE) {
  ok(normalizeSize(a) === '45 Gallon', `normalizeSize("${a}") → "45 Gallon"`);
  ok(sameSizeLabel(a, '45 gal'), `sameSizeLabel("${a}", "45 gal") — the whole family is one size`);
}

// ── the RED case, stated directly ────────────────────────────────────────────────
ok(sameSizeLabel('30', '30 gal'), '🔴 bare "30" == "30 gal" — the live import defect (catalog stored "30", CSV said "30 gal")');
ok(sameSizeLabel('15', '15 gal'), '🔴 bare "15" == "15 gal" — the tech-debt #56 case, now closed');

// ── whitespace / case fold ────────────────────────────────────────────────────────
ok(sameSizeLabel(' 30 GAL ', '30gal'), 'case + whitespace fold');

// ── NOT folded — a bare decimal is likely caliper, not a fractional gallon ─────────
ok(normalizeSize('1.5') === '1.5', 'a bare decimal ("1.5") is NOT forced into a gallon — passed through');
ok(!sameSizeLabel('1.5', '1.5 gal'), 'bare "1.5" != "1.5 gal" — only bare INTEGERS are read as gallon-class');

// ── NON-gallon units pass through untouched (size spans measurement systems) ───────
ok(normalizeSize('2" caliper') === '2" caliper', 'a caliper size is free text — never a gallon');
ok(normalizeSize('6 ft') === '6 ft', 'a height size is free text — never a gallon');
ok(!sameSizeLabel('2" caliper', '2 gal'), 'a caliper 2 is not a 2 gallon');

// ── the null/blank contract (load-bearing at the count stub branch) ───────────────
ok(normalizeSize(null) === '' && normalizeSize('') === '' && normalizeSize('   ') === '', 'null / blank / whitespace → "" ');
ok(sameSizeLabel(null, null) && sameSizeLabel('', '   '), 'two "no size" values are the same size (stub branch depends on this)');
ok(!sameSizeLabel(null, '15 gal'), 'a blank size is NOT a 15 gal');

// ── faithful-before-connected (D-23): the fold is a COMPARISON KEY, not what we store ──
// (normalizeSize is never written back — this test just documents the two forms stay distinct on disk;
//  they are only equated in memory. Nothing here writes.)
ok('30' !== normalizeSize('30') && normalizeSize('30') === '30 Gallon', 'the canonical form differs from the stored value — proof we do NOT write it back');


// ══ THE DISPLAY HALF — added 2026-09-26 (ledger #420, tech-debt #339) ══════════════════════════
// PROBES BOTH DIRECTIONS (STD-022). The negative half is the point: `formatSize` must NEVER return an
// empty string, because nine surfaces were printing blank for a missing size and blank is
// indistinguishable from "this lot has no size".
{
  // ── what the source wrote is what prints (D-23) ────────────────────────────────────────────
  for (const v of ['15 gallon', '30 Gallon', '45 gal', '#30', '15#', '#3/5', '3/5 gal', 'slip', '4 in', '95/100', '200 gal']) {
    ok(formatSize(v) === v,
      `F: "${v}" prints exactly as written — formatSize does NOT fold a spelling; that is normalizeSize's job, for COMPARING (D-23)`);
  }
  ok(formatSize('30  gal ') === '30 gal',
    'F12 whitespace a CSV or an invoice brings is collapsed — "30  gal " and "30 gal" are one thing typed twice, not two sizes');
  ok(formatSize('\t45 gal\n') === '45 gal', 'F13 tabs and newlines too');

  // ── 🔴 IT NEVER RETURNS AN EMPTY STRING ────────────────────────────────────────────────────
  for (const [label, v] of [['null', null], ['undefined', undefined], ['empty string', ''],
                            ['a single space', ' '], ['tabs and spaces', '\t  \n']] as const) {
    ok(formatSize(v as string | null | undefined) !== '',
      `🔴 F-${label}: does NOT render as blank — nine surfaces printed '' for a missing size, and blank reads as "this lot has no size" when it means "nobody recorded one" (D-9 / A9)`);
    ok(formatSize(v as string | null | undefined) === 'no size recorded',
      `F-${label}b: it renders the sentence by default`);
  }
  ok(formatSize(null, 'dash') === '—', 'F14 a dense grid may ask for the short form');
  ok(formatSize(null, 'dash') !== '', 'F15 …and even the short form is not blank');
  ok(Object.values(SIZE_ABSENT).every(v => v.trim() !== ''),
    '🔴 F16 there is NO absence rendering that is empty — the type offers only `dash` and `sentence`, so a screen cannot choose blank');

  // ── the predicate, and the whitespace trap it exists for ───────────────────────────────────
  ok(sizeIsRecorded('30 gal') === true, 'F17 a real size is recorded');
  ok(sizeIsRecorded(null) === false && sizeIsRecorded(undefined) === false && sizeIsRecorded('') === false,
    'F18 null, undefined and empty are not');
  ok(sizeIsRecorded(' ') === false,
    '🔴 F19 A STRING OF SPACES IS NOT A RECORDED SIZE — `!!" "` is TRUE, which is exactly how a whitespace-only value passes every check and then renders blank');
  ok(sizeIsRecorded('  30 gal  ') === true, 'F20 padding does not make a real size absent');

  // ── negative controls: it must not invent, borrow or drop anything ─────────────────────────
  ok(formatSize('0 gal') === '0 gal',
    '🔴 F21 "0 gal" is a RECORDED size and prints as itself — a falsy-looking string must not fall through to the absence text');
  ok(formatSize('0') === '0', 'F22 and so does a bare "0"');
  ok(formatSize('slip') === 'slip',
    'F23 a rung with no VOLUME still has a size LABEL — "slip" prints, because unsized is not unnamed');
  const long = "Male Yaupon Holly 10' to 12' tall";
  ok(formatSize(long) === long, 'F24 a long descriptive size is not truncated here — truncation is a layout decision');
  ok(formatSize('30 gal') !== SIZE_ABSENT.sentence && formatSize('30 gal') !== SIZE_ABSENT.dash,
    'F25 a real size never renders as either absence string');

  // 🔴 THE TWO HALVES MUST AGREE ABOUT ABSENCE. normalizeSize folds an absent size to ''; formatSize
  //    must never print that '' — this probe is the seam between the comparison half and the display
  //    half, and it is the reason both live in one file.
  ok(normalizeSize(null) === '' && formatSize(null) !== '',
    '🔴 F26 THE SEAM: normalizeSize folds an absent size to "" for COMPARISON, and formatSize never shows that "" to a person');
}

console.log(`\nsizeLabel — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
