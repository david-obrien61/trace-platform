/**
 * ── vendorFoldAgreement — the two vendor folds must not drift apart ─────────────────────────────
 *
 * PURPOSE
 *   R-65 rules that the two vendor stores consolidate into `vendors`, and names the real obstacle:
 *   the two sides FOLD VENDOR NAMES DIFFERENTLY, so a backfill joining on the fold "drops or
 *   doubles whichever side disagrees". Its own status line says the guard is "⚠️ NONE MECHANICAL.
 *   Nothing reads two unmerged branches against each other."
 *
 *   🔴 THIS IS THAT GUARD, AND IT CAN EXIST NOW BECAUSE THEY ARE NO LONGER TWO UNMERGED BRANCHES:
 *   `vendorKey()` landed on main with #257/#258, so both folds are importable in one process and a
 *   disagreement is a BUILD FAILURE rather than a note in a ruling nobody re-runs.
 *
 * ⚠️ WHAT THIS FILE DOES NOT DO. It does not edit `vendorKey.ts` — that file belongs to another
 *   session's work and R-62 is explicit that a session edits only branches it owns. The
 *   reconciliation was done on THIS side, by rewriting `looseVendorKey` to their algorithm, and
 *   this probe is what stops the two drifting apart again.
 *
 * ✏️ AND IT RECORDS A CORRECTION TO R-65 ITSELF. R-65 states that `vendorKey()` folds
 *   "Sudderth Brothers Contracting, Inc." and "Sudderth Brothers" to ONE key. Measured: it does
 *   not — `contracting` is not in `VENDOR_SUFFIXES`, so they fold to `sudderth brothers
 *   contracting` and `sudderth brothers`, two keys. It was the OTHER fold that merged them, before
 *   this reconciliation. The stores did disagree; not in the direction the ruling records.
 *
 * DEPENDENCIES: `./vendorKey` (main) · `@trace/shared/business-logic` (looseVendorKey). Pure.
 * OUTPUTS: PASS/FAIL per case + a population line. Exit 1 on any disagreement.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/vendorFoldAgreement.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { vendorKey } from './vendorKey';
import { looseVendorKey } from '@trace/shared/business-logic';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   x ' + msg); }
}

/**
 * Every vendor string measured live 2026-09-02 (8 distinct across 3 tenants), plus the names on the
 * paper invoices David holds that are NOT yet in `receipts`, plus the adversarial cases that broke
 * the first version of `looseVendorKey`. A corpus of only the live strings would agree trivially —
 * the folds differ on punctuation and suffixes, and 6 of the 8 live strings exercise neither.
 */
const CORPUS: string[] = [
  // live, measured
  'LAWNS Tree Farm, LLC.', 'bwi', 'Bailey Bark Materials, Inc.',
  'Sudderth Brothers Contracting, Inc.', 'Circle K', 'H-E-B',
  'Williamson Tree Farm', 'TRACTOR SUPPLY CO',
  // on paper, not yet captured — the names the consolidation will actually meet
  'Sudderth Brothers', 'Athens Tree Farm', 'KBB Tree Farm LLC', 'KBE Trucking LLC',
  'Mcgill Farms', 'McGill', 'Top Notch ', 'Top Notch', 'Greenleaf', 'Enchanted Trees',
  'Hand Tree Farm', 'Backbone Valley', 'La Escondida', 'Just Trees', 'Liner Source',
  // adversarial — each one broke a real implementation
  'Co-op Gardens', 'Foo Co, Inc.', 'ACME  Double  Space', '', '   ',
];

// ══ §A THE FOLDS AGREE, STRING BY STRING ═════════════════════════════════════════════════════
{
  let agreed = 0;
  const diffs: string[] = [];
  for (const s of CORPUS) {
    const a = vendorKey(s);
    const b = looseVendorKey(s);
    if (a === b) agreed++; else diffs.push(`${JSON.stringify(s)}: vendorKey="${a}" looseVendorKey="${b}"`);
  }
  ok(diffs.length === 0,
    `🔴 A1: the two folds agree on all ${CORPUS.length} strings (agreed: ${agreed}) — a disagreement here is R-65's "drops or doubles whichever side disagrees", caught before a backfill rather than after. Diffs: ${diffs.join(' | ') || 'none'}`);
}

// ══ §B THE NEGATIVE CONTROLS — §A must be capable of failing ═════════════════════════════════
// A1 compares two functions. If both were identity, or both empty, it would pass and prove nothing.
{
  ok(vendorKey('Bailey Bark Materials, Inc.') === 'bailey bark materials',
    'B1 (control): vendorKey actually folds — it is not returning its input unchanged');
  ok(looseVendorKey('Bailey Bark Materials, Inc.') === 'bailey bark materials',
    'B2 (control): looseVendorKey actually folds');
  ok(vendorKey('Circle K') !== '' && looseVendorKey('Circle K') !== '',
    'B3 (control): neither fold returns empty for real input — two empty strings would agree vacuously');
  ok(vendorKey('Athens Tree Farm') !== vendorKey('KBB Tree Farm LLC'),
    '🔴 B4 (control): the fold DISTINGUISHES two genuinely different vendors. A fold that collapsed everything would make A1 pass and the consolidation catastrophic');
}

// ══ §C THE SPECIFIC PAIR R-65 NAMES ══════════════════════════════════════════════════════════
{
  const long = 'Sudderth Brothers Contracting, Inc.';
  const short = 'Sudderth Brothers';
  ok(vendorKey(long) !== vendorKey(short),
    '🔴 C1: measured — the Sudderth pair folds to TWO keys, not one. R-65 records this pair as folding to ONE; "Contracting" is not a corporate suffix, and the ruling should be corrected rather than built against');
  ok(looseVendorKey(long) !== looseVendorKey(short),
    'C2: …and both folds now say so, which is the agreement A1 asserts');
  ok(vendorKey(short) === 'sudderth brothers' && vendorKey(long).startsWith('sudderth brothers '),
    '🔴 C3: the short name is a strict PREFIX of the long one — which is how the resolver still surfaces this pair as a question, without either fold having to merge them');
}

console.log(`\nvendorFoldAgreement: ${passed} passed, ${failed} failed`);
console.log(`  populations — ${CORPUS.length} vendor strings compared through BOTH folds: 8 measured live 2026-09-02, 15 from the paper invoices not yet captured, 4 adversarial.`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
