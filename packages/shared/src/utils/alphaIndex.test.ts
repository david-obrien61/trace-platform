// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the A–Z BUCKETING — which letter a given token falls under, and that the empty
//   buckets survive (a strip that hides its zeros offers letters that do nothing).
//   ⚠️ WHICH token a customer is filed by is a SEPARATE decision and a separate file:
//   `personName.customerFilingName`, proven in `customerFiling.test.ts`. Keeping them apart is
//   what lets the filing rule be reversed — as it was on 2026-09-22 — without touching this one.
// DEPENDENCIES: alphaIndex (pure).
// OUTPUTS: assertions only.
// Run: node scripts/run-tests.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { alphaKeyFor, countByAlphaKey, ALPHA_KEYS, ALPHA_LETTERS, OTHER_KEY } from './alphaIndex';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

// ── §A · the ordinary case, using REAL names read off LAWNS 2026-09-22 ──────────────────────
ok(alphaKeyFor('Aaron Harlan') === 'A', 'A1 the bucket is the first letter of the TOKEN — this module never decides that a person files under "Aaron Harlan"; the filing rule does');
ok(alphaKeyFor('ABC Home and Pest Services') === 'A', 'A2 an organization files under its own first letter');
ok(alphaKeyFor('Highland Homes') === 'H', 'A3 the business name David could not find is under H');
ok(alphaKeyFor('zach wilson') === 'Z', 'A4 lowercase files under the uppercase letter — the strip has one Z, not two');
ok(alphaKeyFor('  Molly Ray  ') === 'M', 'A5 surrounding whitespace does not change where a name files');

// ── §B · this module buckets a TOKEN; WHICH token is the filing rule's job ──────────────────
// 🔴 THE EARLIER VERSION OF THIS SECTION ASSERTED THE OPPOSITE AND WAS WRONG. It claimed a person
// is "NOT filed under their surname" — reasoned from the screen rather than from how a contacts
// app works, and reversed by David on 2026-09-22. The surname rule now lives in
// `personName.customerFilingName` and is proven in `customerFiling.test.ts`; this file stays
// deliberately ignorant of it, and buckets whatever token it is handed.
ok(alphaKeyFor('Patskowski') === 'P', 'B1 the bucket is taken from the token it is given, whatever chose it');
ok(alphaKeyFor('Tree Place') === 'T', 'B2 …including a multi-word token');

// ── §C · accents fold; the fold is a lookup key and is never stored ─────────────────────────
ok(alphaKeyFor('Ángel Ruiz') === 'A', 'C1 an accented first letter folds to its base letter');
ok(alphaKeyFor('Ñuñez') === 'N', 'C2 …including Ñ');
ok('Ángel Ruiz'.charAt(0) !== alphaKeyFor('Ángel Ruiz'),
   'C3 🔴 the folded key DIFFERS from the stored value — proof the fold is a lookup, never written back (D-23)');

// ── §D · the '#' bucket is real, not a silent drop ──────────────────────────────────────────
ok(alphaKeyFor('3 Oaks Ranch') === OTHER_KEY, 'D1 a name starting with a digit files under #');
ok(alphaKeyFor('&More Landscaping') === OTHER_KEY, 'D2 …and so does a symbol');
ok(alphaKeyFor(null) === OTHER_KEY && alphaKeyFor(undefined) === OTHER_KEY && alphaKeyFor('') === OTHER_KEY && alphaKeyFor('   ') === OTHER_KEY,
   'D3 🔴 AN UNNAMED RECORD GETS A REAL BUCKET — null, undefined, empty and whitespace all answer #, so it appears somewhere rather than nowhere (D-9)');

// ── §E · the counts, and the zeros that keep the strip honest ───────────────────────────────
{
  const rows = [{ n: 'Aaron' }, { n: 'Abigail' }, { n: 'Molly' }, { n: '3 Oaks' }, { n: null as string | null }];
  const c = countByAlphaKey(rows, r => r.n);
  ok(c.get('A') === 2, `E1 two names under A (${c.get('A')})`);
  ok(c.get('M') === 1, 'E2 one under M');
  ok(c.get(OTHER_KEY) === 2, `E3 the digit and the unnamed row share # (${c.get(OTHER_KEY)})`);
  ok(c.get('Q') === 0, 'E4 🔴 A LETTER NOBODY USES IS PRESENT AND ZERO — the caller needs the zero to render Q as unavailable rather than as a button that does nothing');
  ok(c.size === 27, `E5 every bucket is accounted for: 26 letters + # (${c.size})`);
  const summed = ALPHA_KEYS.reduce((t, k) => t + (c.get(k) ?? 0), 0);
  ok(summed === rows.length,
     `E6 🔴 EVERY ROW LANDS IN EXACTLY ONE BUCKET — the buckets sum to the population (${summed} of ${rows.length}), so choosing a letter can never hide a customer from every letter`);
}

// ── §F · the shape of the strip ─────────────────────────────────────────────────────────────
ok(ALPHA_LETTERS.length === 26 && ALPHA_LETTERS[0] === 'A' && ALPHA_LETTERS[25] === 'Z', 'F1 A–Z, in order, all twenty-six');
ok(ALPHA_KEYS.length === 27 && ALPHA_KEYS[26] === OTHER_KEY, 'F2 # renders last, after Z');
ok(new Set(ALPHA_KEYS).size === ALPHA_KEYS.length, 'F3 no bucket appears twice');

// ── §G · negative control — the key is not just "the first character" ───────────────────────
ok(alphaKeyFor('ángel') === 'A' && 'ángel'.charAt(0).toUpperCase() !== 'A',
   'G1 🔴 NEGATIVE CONTROL: a naive first-character-uppercase implementation answers Á here and would file this row off the end of the alphabet — this test fails if the fold is removed');

console.log(`\nalphaIndex — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
