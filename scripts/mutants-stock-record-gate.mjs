/**
 * -- mutants-stock-record-gate -- can the test-mode stock guard actually refuse? (ledger #342) --
 *
 * PURPOSE:      R-33 / CLAUDE.md §6 r19: a check that cannot disagree is not a check. David's
 *               rulings of 2026-09-16 (① a test order never changes stock; ② in test mode no order
 *               of any origin writes the record) are held by ONE predicate, TWO chokepoints and
 *               ELEVEN call sites in submit.ts. This breaks one of them at a time — including each
 *               path's wiring — and requires stockRecordGate.test.ts to go RED.
 * DEPENDENCIES: node_modules/.bin/esbuild; submit.ts, testMode.ts and the probe suite.
 * OUTPUTS:      CAUGHT / SURVIVED / NO-BUILD per mutant + a summary. Exit 1 if any mutant
 *               survives, if an anchor no longer matches, or if the CONTROL is not green.
 *
 * Three verdicts, carried over from mutants-undo-ledger-gate.mjs (tech-debt #293): a mutant that
 * does not compile is NOT scored CAUGHT, because no test executed against it.
 * Every mutation is applied to an in-memory copy and written back byte-for-byte (try/finally).
 *
 * Run: node scripts/mutants-stock-record-gate.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SUBMIT = 'packages/cultivar-os/api/orders/submit.ts';
const MODE   = 'packages/shared/src/business-logic/testMode.ts';
const SUITE  = 'packages/cultivar-os/api/orders/stockRecordGate.test.ts';
// The test-mode seed (ruling ② for the seed) — its own suite.
const PLAN   = 'packages/shared/src/quickbooks/openingStock.ts';
const WRITE  = 'packages/shared/src/quickbooks/openingStockTestWrite.ts';
const SCREEN = 'packages/shared/src/components/OpeningStockSeed.tsx';
const SEED_SUITE = 'packages/shared/src/quickbooks/openingStockTestWrite.test.ts';

const ORIGINAL = Object.fromEntries([SUBMIT, MODE, PLAN, WRITE, SCREEN].map(f => [f, readFileSync(f, 'utf8')]));

function runSuite(suite = SUITE) {
  let bundle;
  try {
    bundle = execFileSync('node_modules/.bin/esbuild',
      [suite, '--bundle', '--platform=node', '--format=cjs', '--external:@supabase/supabase-js'],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return { verdict: 'NO-BUILD', why: (e.stderr?.toString() ?? '').trim().split('\n').slice(0, 3).join(' | ') };
  }
  try {
    execFileSync(process.execPath, ['-'], { input: bundle, stdio: ['pipe', 'ignore', 'ignore'] });
    return { verdict: 'GREEN', why: '' };
  } catch {
    return { verdict: 'RED', why: '' };
  }
}

const MUTANTS = [
  [SUBMIT, "  if (!gate.writable) {\n    console.log('[TRACE:TESTMODE] stock record NOT written",
           "  if (false) {\n    console.log('[TRACE:TESTMODE] stock record NOT written",
   'the qty chokepoint ignores the gate — every test sale decrements again (the 6a60a0ca defect)'],
  [SUBMIT, "  if (!gate.writable) {\n    console.log('[TRACE:TESTMODE] order event NOT written",
           "  if (false) {\n    console.log('[TRACE:TESTMODE] order event NOT written",
   'the event chokepoint ignores the gate — a status tap on a CAPTURED order appends to the ledger in test mode'],
  [MODE, "  return !isTestMode(x.writesEnabled) && x.orderKind !== TEST_ORDER_KIND;",
         "  return !isTestMode(x.writesEnabled);",
   'ruling ① dropped — after go-live a practice order can restore stock it never took'],
  [MODE, "  return !isTestMode(x.writesEnabled) && x.orderKind !== TEST_ORDER_KIND;",
         "  return x.orderKind !== TEST_ORDER_KIND;",
   'ruling ② dropped — in test mode a captured order writes the record'],
  [SUBMIT, "    return { applied: false, newQty: null, reason: 'test_mode' };",
           "    return { applied: true, newQty: null, reason: 'noop' };",
   'a withheld decrement reports success — the trail says a sale moved stock when nothing did'],
  [SUBMIT, "        await adjustLotQty(db, stockGate, businessId, lotId, -rl.quantity, 'walk-in sale decrement",
           "        await adjustLotQty(db, stockRecordGateFor(true, null), businessId, lotId, -rl.quantity, 'walk-in sale decrement",
   'P1 wiring — the walk-in decrement passes an always-open gate'],
  [SUBMIT, "          await adjustLotQty(db, stockGate, businessId, it.business_inventory_id, -Number(it.quantity), 'fulfillment sale decrement'",
           "          await adjustLotQty(db, stockRecordGateFor(true, null), businessId, it.business_inventory_id, -Number(it.quantity), 'fulfillment sale decrement'",
   'P2 wiring — the fulfilment decrement passes an always-open gate'],
  [SUBMIT, "          await adjustLotQty(db, stockGate, businessId, it.business_inventory_id, Number(it.quantity), 'un-fulfill restore'",
           "          await adjustLotQty(db, stockRecordGateFor(true, null), businessId, it.business_inventory_id, Number(it.quantity), 'un-fulfill restore'",
   'P3 wiring — the un-fulfil restore passes an always-open gate'],
  [SUBMIT, "      await adjustLotQty(db, stockGate, businessId, lotId, delta, 'order edit",
           "      await adjustLotQty(db, stockRecordGateFor(true, null), businessId, lotId, delta, 'order edit",
   'P4 wiring — the fulfilled edit passes an always-open gate'],
  [SUBMIT, "        await adjustLotQty(db, stockGate, businessId, it.business_inventory_id, Number(it.quantity), 'order delete restore",
           "        await adjustLotQty(db, stockRecordGateFor(true, null), businessId, it.business_inventory_id, Number(it.quantity), 'order delete restore",
   'P5 wiring — the delete restore passes an always-open gate'],
  [SUBMIT, "    await recordOrderEvent(db, stockGate, businessId, orderId, `order_${status}`",
           "    await recordOrderEvent(db, stockRecordGateFor(true, null), businessId, orderId, `order_${status}`",
   'E2 wiring — the status event (the captured-order tap) passes an always-open gate'],
  [SUBMIT, "exactly as before.\n    const stockGate = await readStockRecordGate(db, businessId, (order as any).order_kind);",
           "exactly as before.\n    const stockGate = await readStockRecordGate(db, businessId, null);",
   "handleStatus gates on a null kind instead of THIS order's — a practice order is live after go-live"],
  [SUBMIT, "    const stockGate = stockRecordGateFor(writesEnabled, bornKind);",
           "    const stockGate = stockRecordGateFor(writesEnabled, null);",
   "checkout ignores the kind it just stamped"],
  [SUBMIT, "      .from('orders').select('*').eq('id', orderId).eq('business_id', businessId).maybeSingle();\n    if (!order) return res.status(404).json({ error: 'Order not found' });\n    // select('*'), not a named list",
           "      .from('orders').select('id, status').eq('id', orderId).eq('business_id', businessId).maybeSingle();\n    if (!order) return res.status(404).json({ error: 'Order not found' });\n    // select('*'), not a named list",
   'handleDelete reads the order without order_kind — the kind the gate reads is always undefined'],
  [SUBMIT, "  const writesEnabled = (data as { qbo_writes_enabled?: boolean } | null)?.qbo_writes_enabled ?? null;\n  return stockRecordGateFor",
           "  const writesEnabled = (data as { qbo_writes_enabled?: boolean } | null)?.qbo_writes_enabled ?? true;\n  return stockRecordGateFor",
   'an UNREAD switch is treated as live — a failed read writes the record'],
  [SUBMIT, "    const practiceRunId = bornKind === TEST_ORDER_KIND ? await currentImportRunId(db, businessId) : null;",
           "    const practiceRunId = await currentImportRunId(db, businessId);",
   'a LIVE order is stamped with a run id — the undo could remove real business'],
  [SUBMIT, "    .is('retired_at', null)\n    .not('import_run_id', 'is', null)\n    .order('created_at', { ascending: false })",
           "    .not('import_run_id', 'is', null)\n    .order('created_at', { ascending: false })",
   'the current run is read across RETIRED rows — a practice order can be tagged to a run already replaced'],
  [SUBMIT, "      delete gatedCols.import_run_id;",
           "      /* narrow retry removed */",
   'the narrow retry is removed — before 20260916c lands, a practice order falls to the strip-all fallback and is born LIVE'],
  [SUBMIT, "    // Captured (history) orders arrive here too",
           "    await db.rpc('record_order_event', { p_order_id: orderId });\n    // Captured (history) orders arrive here too",
   'a SECOND, ungated ledger call is added beside the chokepoint'],

  // ── the test-mode seed ──────────────────────────────────────────────────────────────────────
  [PLAN, "    if (mode === 'test' && c.imported !== true) { notImported++; continue; }", "",
   'SEED: test mode seeds hand-made rows too', SEED_SUITE],
  [PLAN, "      writesLedger: mode === 'live',", "      writesLedger: true,",
   'SEED: a test-mode step is marked as writing the ledger', SEED_SUITE],
  [PLAN, "  return qboWritesEnabled === true ? 'live' : 'test';", "  return qboWritesEnabled === false ? 'test' : 'live';",
   'SEED: an UNREAD switch seeds through the ledger', SEED_SUITE],
  [PLAN, "  const refusal = seedRefusal(qty);\n  if (refusal !== null) return { ok: false, error: refusal };\n\n  let withStock = 0, withHistory = 0, notImported = 0;",
         "  const refusal = mode === 'live' ? seedRefusal(qty) : null;\n  if (refusal !== null) return { ok: false, error: refusal };\n\n  let withStock = 0, withHistory = 0, notImported = 0;",
   'SEED: SEED_CAP is skipped in test mode', SEED_SUITE],
  [WRITE, "      .not('import_run_id', 'is', null)\n", "",
   'SEED: the writer can set qty on a row with import_run_id NULL', SEED_SUITE],
  [WRITE, "      .eq('qty', 0)\n", "",
   'SEED: the writer overwrites a row that gained stock since the plan', SEED_SUITE],
  [WRITE, "      .eq('business_id', businessId)\n      .in('id', ids)", "      .in('id', ids)",
   'SEED: the writer is not tenant-scoped (AC-3)', SEED_SUITE],
  [WRITE, "  if (written !== planned) {", "  if (written < 0) {",
   'SEED: a shortfall is reported as success', SEED_SUITE],
  [SCREEN, "      setPhase({ k: 'done', seeded: r.written, qty, skipped: plan.skipped });\n      return;\n",
           "      setPhase({ k: 'done', seeded: r.written, qty, skipped: plan.skipped });\n",
   'SEED: the test branch falls through to the ledger RPC loop', SEED_SUITE],
  [SCREEN, "  const mode = seedModeFor(business?.qbo_writes_enabled);", "  const mode = seedModeFor(true);",
   'SEED: the screen ignores the stored switch', SEED_SUITE],
];

let caught = 0;
const survivors = [];
const noBuild = [];
try {
  process.stdout.write('\n-- CONTROL (unmutated) ... ');
  const control = runSuite();
  const seedControl = runSuite(SEED_SUITE);
  console.log(`${control.verdict} / seed suite ${seedControl.verdict}`);
  if (control.verdict !== 'GREEN' || seedControl.verdict !== 'GREEN') {
    console.error(`\nCONTROL IS ${control.verdict}. Every "CAUGHT" below would be meaningless.`);
    if (control.why) console.error(control.why);
    process.exit(1);
  }
  console.log(`\n-- ${MUTANTS.length} MUTANTS --\n`);
  for (const [file, find, replace, meaning, suite] of MUTANTS) {
    const src = ORIGINAL[file];
    if (!src.includes(find)) {
      survivors.push(`NOT APPLIED (anchor text not found in ${file}): ${meaning}`);
      console.log(`  ??  NOT APPLIED  ${meaning}`);
      continue;
    }
    writeFileSync(file, src.replace(find, replace));
    const r = runSuite(suite ?? SUITE);
    writeFileSync(file, src);
    if (r.verdict === 'GREEN')         { survivors.push(meaning); console.log(`  !!  SURVIVED    ${meaning}`); }
    else if (r.verdict === 'NO-BUILD') { noBuild.push(meaning);  console.log(`  --  NO-BUILD    ${meaning}\n        ${r.why}`); }
    else                               { caught++;               console.log(`  ok  CAUGHT      ${meaning}`); }
  }
} finally {
  for (const [f, s] of Object.entries(ORIGINAL)) writeFileSync(f, s);
}
console.log(`\n-- ${caught} of ${MUTANTS.length} caught · ${survivors.length} survived · ${noBuild.length} did not build --`);
if (noBuild.length) console.log('\nNO-BUILD:\n' + noBuild.map(s => '  · ' + s).join('\n'));
if (survivors.length) {
  console.error('\nSURVIVORS -- each is a guarantee nobody is holding:\n' + survivors.map(s => '  · ' + s).join('\n'));
  process.exit(1);
}
console.log('   Every mutation that compiled was caught. Files restored byte-for-byte.\n');
