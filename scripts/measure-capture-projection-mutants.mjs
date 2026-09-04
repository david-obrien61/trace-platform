/**
 * ── measure-capture-projection-mutants — can the two doors quietly stop matching? ─────
 *
 * PURPOSE:      The harness's whole promise is "David sees exactly what Lauren will see." That
 *               holds only while the projected payload has the same shape as the live one. Every
 *               mutant here makes the file path render a DIFFERENT screen than production — and
 *               none of them looks wrong, because a preview of the wrong thing is still a
 *               preview. Two of them are also privacy regressions.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-capture-projection-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/quickbooks/captureProjection.ts';
const SUITE  = 'packages/shared/src/quickbooks/captureProjection.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'P1', why: '🔴 Customer projects the full 1,900 records alongside the preview — a privacy regression AND a different screen',
    from: '    return { ...base, breakdown: summariseCustomers(customers), preview: previewCustomers(customers) };',
    to:   '    return { ...base, items: customers as never, breakdown: summariseCustomers(customers), preview: previewCustomers(customers) };' },
  { id: 'P2', why: '🔴 Invoice gains a preview the live payload does not have — invoices name the human who bought',
    from: '  return { ...base, breakdown: summariseInvoices(invoices) };',
    to:   '  return { ...base, preview: invoices as never, breakdown: summariseInvoices(invoices) };' },
  { id: 'P3', why: '🔴 `pages_fetched` subtracts the count page a SECOND time — off-by-one, and silent',
    from: '    pages_fetched: replay.rowPageCount,',
    to:   '    pages_fetched: replay.rowPageCount - 1,' },
  { id: 'P4', why: '🔴 the file is NOT stamped as a file — a screen can no longer refuse to call it a live pull',
    from: '    source: replay.source,',
    to:   '    source: undefined as never,' },
  { id: 'P5', why: 'the customer preview becomes the whole list — five rows silently becomes forty',
    from: '    return { ...base, breakdown: summariseCustomers(customers), preview: previewCustomers(customers) };',
    to:   '    return { ...base, breakdown: summariseCustomers(customers), preview: customers };' },
  { id: 'P6', why: 'Item stops projecting its rows — the one entity whose records legitimately ship',
    from: '    return { ...base, items, breakdown: summariseItems(items) };',
    to:   '    return { ...base, breakdown: summariseItems(items) };' },
  { id: 'P7', why: 'the payload claims the read was stored',
    from: '    stored: false as const,',
    to:   '    stored: true as never,' },
  // 🔴 PROVEN EQUIVALENT, NOT EXCUSED. `readCaptureFile` refuses any capture where expected and
  // retrieved differ, so on a `CaptureReplay` the two fields hold the same number and this
  // substitution is unobservable by construction. The equivalence is a property of THAT GATE,
  // not a law — so it is guarded by an explicit invariant probe (captureReplay.test.ts §F),
  // which goes red the moment the completeness refusal is relaxed. If §F ever fails, this
  // entry stops being equivalent and becomes a real survivor.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // P9-P11 — THE DEFECT THAT ACTUALLY SHIPPED, AND THE TWO NEAR-MISSES BESIDE IT.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // P9 IS NOT A HYPOTHETICAL. It restores the code exactly as it ran in production for two days:
  // `capture` absent from the projection, so a saved read rendered no invoice table and 13 of 16
  // findings reported "could not work this out" over a file that held every invoice they needed.
  // 🔴 THIS HARNESS PASSED THROUGHOUT. Every mutant above it changes a line some probe reads;
  // the shipped defect changed a line NO probe reached, and a mutation score says nothing about
  // an unreached seam. P9 exists so the harness now measures the thing it previously could not.
  { id: 'P9', why: '🔴 THE SHIPPED DEFECT, RESTORED — `capture` is dropped, so the file door renders no invoice table and 13 of 16 findings go dark on a complete file',
    from: '      pages: replay.rowBodies.map(body => ({ body })),',
    to:   '      pages: [] as { body: string }[],' },
  { id: 'P10', why: 'the capture carries the row bodies EMPTY-STRINGED — present, well-shaped, and parses to nothing (a key check that only tests presence would pass this)',
    from: '      pages: replay.rowBodies.map(body => ({ body })),',
    to:   '      pages: replay.rowBodies.map(() => ({ body: \'\' })),' },
  { id: 'P11', why: '🔴 the capture reports a retrieved_total its own bodies do not support — completeness claimed over rows it is not carrying',
    from: '      retrieved_total: replay.retrievedTotal,\n      complete: true as const,',
    to:   '      retrieved_total: replay.retrievedTotal + 1,\n      complete: true as const,' },
  { id: 'P8', equivalent: 'guarded by captureReplay.test.ts §F — the gate makes expected !== retrieved unreachable',
    why: 'the retrieved count is taken from the expected count rather than from the rows',
    from: '    retrieved_total: replay.retrievedTotal,',
    to:   '    retrieved_total: replay.expectedTotal,' },
];

const original = readFileSync(TARGET, 'utf8');
let caught = 0, survived = 0, errored = 0, equivalent = 0;
try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(TARGET, original.replace(m.from, m.to));
    const green = suiteIsGreen();
    if (m.equivalent) {
      // An equivalent mutant MUST survive. If it is caught, the equivalence reasoning was wrong
      // and that is itself a finding — reported, never quietly counted as a win.
      if (green) { equivalent++; console.log(`  ${m.id.padEnd(4)} EQUIV    =   ${m.why}\n       └─ ${m.equivalent}`); }
      else       { caught++;    console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}  (declared equivalent — the declaration was WRONG)`); }
      continue;
    }
    if (green) { survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); }
    else       { caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); }
  }
} finally {
  writeFileSync(TARGET, original);
}

const real = MUTANTS.length - equivalent;
console.log(`\n  ── ${caught}/${real} real mutants caught · ${equivalent} proven equivalent · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
