/**
 * ── sizeLabel — one way to render a size, and one way to render its absence · 2026-09-26 (#420) ──
 *
 * PROBES BOTH DIRECTIONS (STD-022). The corpus is LAWNS's real spellings, taken from the same live
 * values `unitOfMeasure.test.ts` uses. The negative half is the point: **`formatSize` must never
 * return an empty string**, because nine surfaces were printing blank for a missing size and blank is
 * indistinguishable from "this lot has no size".
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/utils/sizeLabel.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { formatSize, sizeIsRecorded, SIZE_ABSENT } from './sizeLabel';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── A · WHAT THE SOURCE WROTE IS WHAT PRINTS (D-23) ───────────────────────────────────────────
{
  for (const s of ['15 gallon', '30 Gallon', '45 gal', '#30', '15#', '#3/5', '3/5 gal', 'slip', '4 in', '95/100', '200 gal']) {
    ok(formatSize(s) === s, `A: "${s}" prints exactly as written — formatSize does not normalise a spelling (that is normalizeSize's job, for COMPARING)`);
  }
  ok(formatSize('30  gal ') === '30 gal',
    'A12 whitespace a CSV or an invoice brings is collapsed — "30  gal " and "30 gal" are the same thing typed twice, not two sizes');
  ok(formatSize('\t45 gal\n') === '45 gal', 'A13 tabs and newlines too');
}

// ── B · 🔴 IT NEVER RETURNS AN EMPTY STRING. THIS IS THE WHOLE POINT. ──────────────────────────
{
  for (const [label, v] of [['null', null], ['undefined', undefined], ['empty string', ''],
                            ['a single space', ' '], ['tabs and spaces', '\t  \n']] as const) {
    ok(formatSize(v as string | null | undefined) !== '',
      `🔴 B-${label}: ${label} does NOT render as blank — nine surfaces were printing '' for a missing size, and blank reads as "this lot has no size" when it means "nobody recorded one" (D-9 / A9)`);
    ok(formatSize(v as string | null | undefined) === 'no size recorded',
      `B-${label}b: it renders the sentence by default`);
  }
  ok(formatSize(null, 'dash') === '—', 'B6 a dense grid may ask for the short form');
  ok(formatSize(null, 'dash') !== '', 'B7 …and even the short form is not blank');
  ok(Object.values(SIZE_ABSENT).every(v => v.trim() !== ''),
    '🔴 B8 there is NO absence rendering that is empty — the type offers only `dash` and `sentence`, so a screen cannot choose blank');
}

// ── C · THE PREDICATE, AND THE WHITESPACE TRAP IT EXISTS FOR ───────────────────────────────────
{
  ok(sizeIsRecorded('30 gal') === true, 'C1 a real size is recorded');
  ok(sizeIsRecorded(null) === false && sizeIsRecorded(undefined) === false && sizeIsRecorded('') === false,
    'C2 null, undefined and empty are not');
  ok(sizeIsRecorded(' ') === false,
    '🔴 C3 A STRING OF SPACES IS NOT A RECORDED SIZE — `!!" "` is TRUE, which is exactly how a whitespace-only value passes every check and then renders blank');
  ok(sizeIsRecorded('  30 gal  ') === true, 'C4 padding does not make a real size absent');
}

// ── D · NEGATIVE CONTROLS — it must not invent, borrow or drop anything ───────────────────────
{
  ok(formatSize('0 gal') === '0 gal',
    '🔴 D1 "0 gal" is a RECORDED size and prints as itself — a falsy-looking string must not fall through to the absence text');
  ok(formatSize('0') === '0', 'D2 and so does a bare "0"');
  ok(formatSize('slip') === 'slip',
    'D3 a rung with no VOLUME still has a size LABEL — "slip" prints, because unsized is not the same as unnamed');
  const long = 'Male Yaupon Holly 10\' to 12\' tall';
  ok(formatSize(long) === long, 'D4 a long descriptive size is not truncated here — truncation is a layout decision, not a formatting one');
  ok(formatSize('30 gal') !== SIZE_ABSENT.sentence && formatSize('30 gal') !== SIZE_ABSENT.dash,
    'D5 a real size never renders as either absence string');
}

console.log(`\nsizeLabel: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
