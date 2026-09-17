/**
 * -- mutants-undo-ledger-gate -- can GATE 2 actually refuse? ------------------------------------
 *
 * PURPOSE:      R-33 / CLAUDE.md section 6 rule 19: a check that cannot disagree is not a check.
 *               GATE 2 stops the catalogue-import undo when a lot carries stock history. This
 *               breaks one guarantee at a time and requires the suite to go RED. A mutant that
 *               SURVIVES is a guarantee nobody is holding.
 *               ✏️ LEDGER #342 extended it to the one-unit undo (`undo_import_run`, 20260916c) and
 *               ruling ④ — removability by origin — mutating the migration's SQL as well as the TS.
 *               ⚠️ The SQL mutants are caught by SHAPE probes (§L10): no test executes the function.
 *               Its behaviour is proven by the migration's V3 block, run by David.
 * DEPENDENCIES: node_modules/.bin/esbuild; itemImportWriter.ts, its probe suite, and 20260916c.
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
// ✏️ LEDGER #342 — the undo's writes moved into one plpgsql function; its SQL is mutated too.
const UNIT   = 'supabase/migrations/20260916c_practice_orders_and_one_unit_undo.sql';

const ORIGINAL = {
  [MODULE]: readFileSync(MODULE, 'utf8'), [SUITE]: readFileSync(SUITE, 'utf8'), [UNIT]: readFileSync(UNIT, 'utf8'),
};

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

  // ── ledger #342: the one-unit undo, and ruling ④ (removability by origin) ──────────────────
  [MODULE, '    if (u.refused === true) {', '    if (false) {',
   '#342 the DATABASE pre-flight refusal is ignored -- a captured order on an imported customer no longer stops the undo'],
  [MODULE, '      && deliveriesAfter === deliveriesBefore - practiceDeliveriesDeleted;',
           '      && deliveriesAfter === deliveriesBefore;',
   '#342 the after-count forgets the practice stops it removed -- every clean undo with a practice delivery reports failure'],
  [MODULE, "        return { ...empty, refused: true, error: UNDO_FUNCTION_ABSENT };",
           "        return { ...empty, refused: false, ok: true, error: null };",
   '#342 a MISSING one-unit function reads as a successful undo -- the owner is told it worked and nothing happened'],
  [MODULE, "    const practiceDeliveriesDeleted = Number(u.practice_deliveries_deleted ?? 0);",
           "    const practiceDeliveriesDeleted = 0;",
   '#342 the practice-stop count is dropped from the report'],
  [UNIT, "              WHERE business_id = p_business_id AND order_kind = 'test' AND import_run_id = p_run_id\n             RETURNING 1)\n    SELECT count(*) INTO v_p_orders FROM d;",
         "              WHERE business_id = p_business_id AND order_kind = 'test'\n             RETURNING 1)\n    SELECT count(*) INTO v_p_orders FROM d;",
   '#342 SQL: the order delete forgets the run id -- EVERY test order is removed by any run\'s undo'],
  [UNIT, "  IF v_held + v_live_orders + v_live_lines + v_live_stops + v_other_total > 0 THEN",
         "  IF v_held + v_live_orders + v_live_lines + v_live_stops > 0 THEN",
   '#342 SQL: a saved address / count / plan line (any other FK) no longer refuses'],
  [UNIT, "     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);\n\n  SELECT count(*) INTO v_live_lines",
         "     ;\n\n  SELECT count(*) INTO v_live_lines",
   '#342 SQL: the live-order count stops excluding practice orders -- every run with a practice order refuses'],
  [UNIT, "  -- ② products, ③ customers",
         "  DELETE FROM public.receipts WHERE business_id = p_business_id;\n  -- ② products, ③ customers",
   '#342 SQL: the undo deletes receipts -- Lauren\'s daily capture, the one thing ruling ④ names first'],
  [UNIT, "GRANT EXECUTE ON FUNCTION public.undo_import_run(uuid, uuid) TO service_role;",
         "GRANT EXECUTE ON FUNCTION public.undo_import_run(uuid, uuid) TO service_role, authenticated;",
   '#342 SQL: any signed-in member can run another tenant\'s undo (AC-3)'],
  [UNIT, "       AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass",
         "       AND false AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass",
   '#342 SQL: the derived FK read is switched off -- the model says refused, the SQL would not (a SQL-shape probe must see it)'],
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
