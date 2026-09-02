/**
 * ── measure-order-kind-mutants — does the orderKind suite CATCH anything? ────────────
 *
 * PURPOSE:      A green suite is a claim until something proves it can go red. This harness
 *               makes one deliberate edit to `orderKind.ts` at a time, re-runs the suite, and
 *               reports CAUGHT (the suite went red) or SURVIVED (the suite stayed green while
 *               the module was wrong). R-33 / CLAUDE.md §6 r19.
 * DEPENDENCIES: node_modules/.bin/esbuild. Touches nothing but a temp copy of one source file,
 *               which is restored in a `finally` even on a throw or a Ctrl-C.
 * OUTPUTS:      One line per mutant + a CAUGHT/TOTAL summary. Exit 1 if ANY mutant survived.
 *
 * 🔴 IT ASSERTS A GREEN CONTROL FIRST. Without that, every "CAUGHT" could be a suite that was
 *    already red for an unrelated reason — a harness that cannot tell those apart is itself a
 *    check that cannot fail.
 * 🔴 IT KEYS OFF THE EXIT CODE, never a grep for the word FAIL. A suite that crashes before
 *    printing anything is red, and a grep would read it as green.
 * 🔴 EVERY MUTANT IS VERIFIED TO HAVE ACTUALLY APPLIED. A `from`-string that no longer matches
 *    the source (a rename, a reformat) would silently run the UNMUTATED module and report a
 *    triumphant CAUGHT=0/0. That is reported as an ERROR, not skipped.
 *
 * Run: node scripts/measure-order-kind-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/business-logic/orderKind.ts';
const SUITE  = 'packages/shared/src/business-logic/orderKind.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

/** Run the suite. Returns true when GREEN — decided by the exit code and nothing else. */
function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'M1', why: 'a test order counts as real business',
    from: 'const NOT_REAL_BUSINESS: readonly string[] = [TEST_ORDER_KIND];',
    to:   'const NOT_REAL_BUSINESS: readonly string[] = [];' },
  { id: 'M2', why: 'a captured invoice stops counting as revenue',
    from: 'const NOT_REAL_BUSINESS: readonly string[] = [TEST_ORDER_KIND];',
    to:   'const NOT_REAL_BUSINESS: readonly string[] = [TEST_ORDER_KIND, HISTORY_ORDER_KIND];' },
  { id: 'M3', why: 'an unassessed captured invoice proves a clean bill of health',
    from: 'const NOT_ASSESSABLE: readonly string[] = [HISTORY_ORDER_KIND, TEST_ORDER_KIND];',
    to:   'const NOT_ASSESSABLE: readonly string[] = [TEST_ORDER_KIND];' },
  { id: 'M4', why: 'THE NULL TRAP — the filter drops every ordinary checkout order',
    from: "return ['order_kind.is.null', `order_kind.not.in.(${kinds.join(',')})`].join(',');",
    to:   'return `order_kind.neq.${kinds[0]}`;' },
  { id: 'M5', why: 'the filter keeps NULLs but stops excluding anything at all',
    from: "return ['order_kind.is.null', `order_kind.not.in.(${kinds.join(',')})`].join(',');",
    to:   "return 'order_kind.is.null,order_kind.not.in.(__nothing__)';" },
  { id: 'M6', why: 'a test order may be pushed into a real company’s QuickBooks',
    from: "return kind !== HISTORY_ORDER_KIND && kind !== TEST_ORDER_KIND;",
    to:   'return kind !== HISTORY_ORDER_KIND;' },
  { id: 'M7', why: 'a captured invoice may be pushed, duplicating a settled sale',
    from: "return kind !== HISTORY_ORDER_KIND && kind !== TEST_ORDER_KIND;",
    to:   'return kind !== TEST_ORDER_KIND;' },
  { id: 'M8', why: 'an unrecognised order kind vanishes from every report (allow-list flip)',
    from: "return !NOT_REAL_BUSINESS.includes(String(orderKind ?? ''));",
    to:   "return String(orderKind ?? '') === '' || String(orderKind ?? '') === HISTORY_ORDER_KIND;" },
  { id: 'M9', why: 'an unknown kind is relabelled as a checkout order instead of naming itself',
    from: '  return kind;\n}',
    to:   "  return 'Checkout order';\n}" },
];

const original = readFileSync(TARGET, 'utf8');
let caught = 0, survived = 0, errored = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) {
    console.log('RED — aborting. Every CAUGHT below would be meaningless.');
    process.exit(2);
  }
  console.log('GREEN ✓  every result below is measured against this.\n');

  for (const m of MUTANTS) {
    if (!original.includes(m.from)) {
      console.log(`  ${m.id}  ERROR    the from-string is not in the source — mutant never applied`);
      errored++;
      continue;
    }
    writeFileSync(TARGET, original.replace(m.from, m.to));
    const green = suiteIsGreen();
    if (green) { survived++; console.log(`  ${m.id}  SURVIVED 🔴  ${m.why}`); }
    else       { caught++;  console.log(`  ${m.id}  CAUGHT   ✓   ${m.why}`); }
  }
} finally {
  writeFileSync(TARGET, original);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
