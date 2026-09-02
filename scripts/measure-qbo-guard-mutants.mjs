/**
 * ── measure-qbo-guard-mutants — can the guard probes still REFUSE? ──────────────────
 *
 * PURPOSE:      Two source probes assert that `pushQboInvoice` refuses a history order and a
 *               test order BEFORE it creates a QuickBooks customer and BEFORE it POSTs an
 *               invoice. Both were repaired on 2026-09-02 (they were indexing prose, not
 *               code). A repaired check is a CLAIM until it has been watched to fail, and
 *               this is the one guard whose failure is unrecoverable: a QuickBooks customer
 *               created by a test order is a real row in a real chart of customers.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of ONE source file and restores
 *               it in a `finally`, even on a throw.
 * OUTPUTS:      One line per mutant + CAUGHT/TOTAL. Exit 1 if any mutant SURVIVED.
 *
 * 🔴 M5 AND M6 ARE THE POINT OF THE FILE. They delete a guard's CODE while leaving its COMMENT
 *    in place — the exact state in which the pre-repair probes returned green. If either one
 *    survives, the repair did not work and the probes are still reading prose.
 *
 * Run: node scripts/measure-qbo-guard-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/cultivar-os/api/qbo/invoice/cultivar.ts';
const SUITES = [
  'packages/shared/src/business-logic/historyOrder.test.ts',
  'packages/shared/src/business-logic/testMode.test.ts',
];
const ESB = ROOT + 'node_modules/.bin/esbuild';

/** GREEN only if EVERY suite exits 0. Decided by exit code, never by grepping for 'FAIL'. */
function suitesGreen() {
  return SUITES.every(s => {
    try {
      execSync(`${ESB} ${s} --bundle --platform=node --format=cjs 2>/dev/null | node`,
        { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
      return true;
    } catch { return false; }
  });
}

const src = readFileSync(TARGET, 'utf8');

/** Everything from an `if (order.order_kind === X)` through its closing `    }`. */
function guardBlock(kindConst) {
  const start = src.indexOf(`    if (order.order_kind === ${kindConst}) {`);
  if (start === -1) return null;
  const end = src.indexOf('\n    }\n', start);
  return end === -1 ? null : src.slice(start, end + 7);
}
const TEST_GUARD = guardBlock('TEST_ORDER_KIND');
const HIST_GUARD = guardBlock('HISTORY_ORDER_KIND');

const MUTANTS = [
  { id: 'M1', why: 'the TEST guard is deleted outright',
    from: TEST_GUARD, to: '' },
  { id: 'M2', why: 'the HISTORY guard is deleted outright',
    from: HIST_GUARD, to: '' },
  // ⚠️ M3 AND M7 ARE RECORDED AS WRITTEN-WRONG-FIRST, because the correction is the useful part.
  // M3 originally appended an eslint pragma and changed no behaviour at all; it SURVIVED, and a
  // survivor that is really a broken mutant is worse than no mutant — it reads as a hole in the
  // suite and sends the next person to add assertions that were never missing. M7 concatenated
  // the two guard blocks and matched nothing, because a comment block sits between them; it was
  // reported as ERROR rather than skipped, which is the only reason it was noticed.
  { id: 'M3', why: 'the TEST guard survives but returns 403 — sends someone hunting a permission that would never have helped',
    from: "      return { status: 422, body: {\n        error: 'This is a test order.",
    to:   "      return { status: 403, body: {\n        error: 'This is a test order." },
  { id: 'M4', why: 'the TEST guard re-types the literal instead of importing the constant',
    from: "if (order.order_kind === TEST_ORDER_KIND) {", to: "if (order.order_kind === 'test') {" },
  { id: 'M5', why: '🔴 the TEST guard\'s CODE is deleted but its COMMENT stays — the prose-reading state',
    from: TEST_GUARD, to: TEST_GUARD ? TEST_GUARD.split('\n').filter(l => l.trim().startsWith('//')).join('\n') + '\n' : null },
  { id: 'M6', why: '🔴 the HISTORY guard\'s CODE is deleted but its COMMENT stays — same state',
    from: HIST_GUARD, to: HIST_GUARD ? HIST_GUARD.split('\n').filter(l => l.trim().startsWith('//')).join('\n') + '\n' : null },
  { id: 'M7', why: '🔴 the TEST guard is PRESENT but runs AFTER the QuickBooks customer is created — too late to help',
    from: TEST_GUARD,
    to:   TEST_GUARD ? '' : null, mv: true },
];

let caught = 0, survived = 0, errored = 0;
try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suitesGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    // 🔴 A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A SKIP. Silently running the unmutated
    // module and reporting a triumphant 0/0 is the failure this whole harness exists to avoid.
    if (m.from === null || m.to === null || !src.includes(m.from)) {
      console.log(`  ${m.id}  ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    let mutated = src.replace(m.from, m.to);
    // `mv` RE-INSERTS the block after the customer create instead of deleting it — the guard
    // still exists and still returns 422; it simply runs once the write has already happened.
    // A probe that only checked EXISTENCE would call this correct.
    if (m.mv) {
      const anchor = 'qbCustomerId = await findOrCreateQBCustomer';
      const at = mutated.indexOf(anchor);
      if (at === -1) { console.log(`  ${m.id}  ERROR    move anchor not found`); errored++; continue; }
      const eol = mutated.indexOf('\n', at) + 1;
      mutated = mutated.slice(0, eol) + m.from + mutated.slice(eol);
    }
    writeFileSync(TARGET, mutated);
    if (suitesGreen()) { survived++; console.log(`  ${m.id}  SURVIVED 🔴  ${m.why}`); }
    else               { caught++;  console.log(`  ${m.id}  CAUGHT   ✓   ${m.why}`); }
  }
} finally {
  writeFileSync(TARGET, src);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
