/**
 * -- mutants-undo-ledger-gate -- can GATE 2 actually refuse? ------------------------------------
 *
 * PURPOSE:      R-33 / CLAUDE.md section 6 rule 19: a check that cannot disagree is not a check.
 *               GATE 2 stops the catalogue-import undo when a lot carries stock history. This
 *               breaks one guarantee at a time and requires the suite to go RED. A mutant that
 *               SURVIVES is a guarantee nobody is holding.
 * DEPENDENCIES: node_modules/.bin/esbuild; itemImportWriter.ts and its probe suite.
 * OUTPUTS:      CAUGHT / SURVIVED / NO-BUILD per mutant + a summary. Exit 1 if any mutant
 *               survives, or if the CONTROL is not green.
 *
 * 🔴 THREE VERDICTS, NOT TWO -- AND THE THIRD IS TECH-DEBT #293's FIX, APPLIED HERE ONLY.
 * With `set -o pipefail`, a mutant that does not COMPILE makes the pipeline fail, and a
 * two-verdict harness scores that CAUGHT. It is honestly not-survived, but "CAUGHT" claims a test
 * executed and disagreed, which nothing did. So the build and the run are SEPARATE steps here and
 * a compile failure reports `NO-BUILD` with esbuild's own stderr. #293 asks for this in ONE shared
 * helper across all 18 harnesses (section 6 r8); that refactor is not this build's, and doing it
 * in one place without doing it in eighteen is recorded rather than presented as the fix.
 *
 * Every mutation is applied to a COPY held in memory and written back byte-for-byte on exit,
 * including on a crash (try/finally).
 *
 * Run: node scripts/mutants-undo-ledger-gate.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MODULE = 'packages/shared/src/quickbooks/itemImportWriter.ts';
const SUITE  = 'packages/shared/src/quickbooks/itemImportWriter.test.ts';

const ORIGINAL = { [MODULE]: readFileSync(MODULE, 'utf8'), [SUITE]: readFileSync(SUITE, 'utf8') };

/**
 * Build, then run. Returns 'GREEN' | 'RED' | 'NO-BUILD'.
 * Keys off EXIT CODES, never on a grep for the word FAIL -- a suite that crashed would otherwise
 * read as a catch.
 */
function runSuite() {
  let bundle;
  try {
    bundle = execFileSync('node_modules/.bin/esbuild',
      [SUITE, '--bundle', '--platform=node', '--format=cjs'],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // 🔴 esbuild's stderr is KEPT, not discarded to /dev/null. 16 of 18 harnesses throw it away,
    // so they cannot say WHY a mutant did not build (#293).
    return { verdict: 'NO-BUILD', why: (e.stderr?.toString() ?? '').trim().split('\n').slice(0, 3).join(' | ') };
  }
  try {
    execFileSync(process.execPath, ['-'], { input: bundle, stdio: ['pipe', 'ignore', 'ignore'] });
    return { verdict: 'GREEN', why: '' };
  } catch {
    return { verdict: 'RED', why: '' };
  }
}

// file, find, replace, and what the mutation MEANS if it survives.
const MUTANTS = [
  [MODULE,
   '  const ledger = await ledgerHeldRows(db, businessId, runId);\n  if (ledger.held !== 0) {',
   '  const ledger = await ledgerHeldRows(db, businessId, runId);\n  if (false) {',
   'GATE 2 IS REMOVED ENTIRELY -- the undo half-wipes the tenant again, which is the whole defect'],

  [MODULE,
   '  if (ledger.held !== 0) {',
   '  if (ledger.held > 1) {',
   'ONE held lot no longer refuses -- and one test order against one imported lot is exactly how this arrived live'],

  [MODULE,
   '  if (ledger.held !== 0) {',
   '  if (ledger.held > 0) {',
   'a pre-flight that could not be READ (-1) falls through and DELETES -- "we could not check" treated as "nothing to check" (#182)'],

  [MODULE,
   "    .eq('import_run_id', runId)\n    .limit(LEDGER_NAMES_SHOWN);",
   '    .limit(LEDGER_NAMES_SHOWN);',
   "the gate is not scoped to THIS RUN -- another run's history refuses an unrelated undo"],

  [MODULE,
   "    .select('id, name, size, business_inventory_ledger!inner(id)', { count: 'exact' })",
   "    .select('id, name, size, business_inventory_ledger(id)', { count: 'exact' })",
   'the join stops being INNER -- every row of the run comes back and every undo refuses (a gate that cannot pass)'],

  [MODULE,
   '  return { held: count ?? rows.length, names };',
   '  return { held: rows.length, names };',
   'the TOTAL becomes the PAGE -- a seeded catalogue of 647 reports 5, and the owner acts on a number two orders of magnitude too small'],

  [MODULE,
   "      businessId, runId, message: (error as { message?: string }).message,\n    });\n    return { held: -1, names: [] };",
   "      businessId, runId, message: (error as { message?: string }).message,\n    });\n    return { held: 0, names: [] };",
   'a FAILED pre-flight read reports "nothing held" and the undo proceeds -- the unrecoverable direction'],

  [MODULE,
   "    return { ...empty, refused: true, ledgerHeld: ledger.held,\n      error: ledgerRefusalSentence(ledger.held, ledger.names) };",
   "    return { ...empty, refused: false, ledgerHeld: ledger.held,\n      error: ledgerRefusalSentence(ledger.held, ledger.names) };",
   'the refusal is not flagged as one -- the router returns 500 instead of 409 and handleBooksUndo goes on to delete the customers anyway'],

  [MODULE,
   '  const more = held - shown.length;',
   '  const more = 0;',
   'the sentence names five and silently drops the rest -- the number on screen stops being the whole number'],

  [MODULE,
   "  const { data, error, count } = await db.from('business_inventory')",
   "  const { data, error, count } = await db.from('business_inventory').is('retired_at', null)",
   'the gate looks only at LIVE rows -- a retired row this run made still has history and still refuses, so the gate waves through the exact rows that will fail'],
];

let caught = 0;
const survivors = [];
const noBuild = [];

try {
  process.stdout.write('\n-- CONTROL (unmutated) ... ');
  const control = runSuite();
  console.log(control.verdict);
  if (control.verdict !== 'GREEN') {
    console.error(`\nCONTROL IS ${control.verdict}. Every "CAUGHT" below would be meaningless.`);
    if (control.why) console.error(control.why);
    process.exit(1);
  }

  console.log(`\n-- ${MUTANTS.length} MUTANTS --\n`);
  for (const [file, find, replace, meaning] of MUTANTS) {
    const src = ORIGINAL[file];
    // 🔴 AN ANCHOR THAT NO LONGER MATCHES IS A FAILURE, NOT A SKIP. A harness whose mutations
    // silently stop applying reports a clean sweep over nothing (#182).
    if (!src.includes(find)) {
      survivors.push(`NOT APPLIED (anchor text not found in ${file}): ${meaning}`);
      console.log(`  ??  NOT APPLIED  ${meaning}`);
      continue;
    }
    writeFileSync(file, src.replace(find, replace));
    const r = runSuite();
    writeFileSync(file, src);            // restore immediately, before anything else can fail
    if (r.verdict === 'GREEN')        { survivors.push(meaning); console.log(`  !!  SURVIVED    ${meaning}`); }
    else if (r.verdict === 'NO-BUILD') { noBuild.push(meaning);  console.log(`  --  NO-BUILD    ${meaning}\n        ${r.why}`); }
    else                               { caught++;               console.log(`  ok  CAUGHT      ${meaning}`); }
  }
} finally {
  for (const [f, s] of Object.entries(ORIGINAL)) writeFileSync(f, s);
}

console.log(`\n-- ${caught} of ${MUTANTS.length} caught · ${survivors.length} survived · ${noBuild.length} did not build --`);
if (noBuild.length) {
  console.log('\nNO-BUILD -- honestly not survived, but no test executed them, so they are not CAUGHT either:\n'
    + noBuild.map(s => '  · ' + s).join('\n'));
}
if (survivors.length) {
  console.error('\nSURVIVORS -- each is a guarantee nobody is holding:\n' + survivors.map(s => '  · ' + s).join('\n'));
  process.exit(1);
}
console.log('   Every mutation that compiled was caught. Files restored byte-for-byte.\n');
