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
import { normalizeSize, sameSizeLabel } from './sizeLabel';

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

console.log(`\nsizeLabel — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
