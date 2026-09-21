/**
 * ── THE OPENING STOCK SEED IN TEST MODE WRITES NO LEDGER ROW (ledger #342) ─────────────────────
 *
 * David, 2026-09-16, ruling ②: *"in test mode … the opening-stock seed sets qty ONLY on rows with
 * import_run_id IS NOT NULL and writes NO ledger rows; the opening ledger entry is written once,
 * after the switch."* Out of test mode, unchanged. SEED_CAP holds in both.
 *
 *   §S1 the planner, both modes
 *   §S2 the qty-only writer, against a double that APPLIES every filter it is given — so a
 *       dropped filter changes what is written instead of being invisible (§6 r19a)
 *   §S3 the screen's wiring: the test branch never reaches the ledger RPC
 *
 * Run: node scripts/run-tests.mjs openingStockTestWrite
 */
import { readFileSync } from 'node:fs';
import { planOpeningStockSeed, seedModeFor, SEED_CAP, type SeedCandidate } from './openingStock';
import { seedQtyWithoutLedger, SEED_TEST_CHUNK } from './openingStockTestWrite';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const RUN = 'eab7fbd2-04cd-45e5-b771-cbb07f662f6f';

// ── a double with an inventory store and a ledger store ──────────────────────────────────────
function fakeDb(rows: any[], opts: { refuse?: boolean; failAt?: number; readFails?: boolean } = {}) {
  const inventory = rows.map(r => ({ ...r }));
  const ledger: any[] = [];
  const calls: { verb: string; filters: [string, string, any][]; payload?: any }[] = [];
  let updates = 0;
  const db = {
    rpc() { calls.push({ verb: 'rpc', filters: [] }); throw new Error('the test-mode writer must not call any RPC'); },
    from(table: string) {
      if (table !== 'business_inventory') throw new Error(`unexpected table ${table}`);
      return {
        // 🔴 THE DOUBLE CAN NOW BE READ, because the writer reads (#366): on a refused chunk it
        // asks whether those ids are still there, so it can say WHICH refusal it hit instead of
        // naming two causes and letting the owner pick. A double that cannot answer that read
        // cannot test the message (§6 r19 — model what the real client does, or prove nothing).
        select(_cols?: string) {
          const filters: [string, string, any][] = [];
          calls.push({ verb: 'select', filters });
          const b: any = {
            eq(c: string, v: any) { filters.push([c, 'eq', v]); return b; },
            in(c: string, v: any[]) { filters.push([c, 'in', v]); return b; },
            then(res: any) {
              if (opts.readFails) return Promise.resolve({ data: null, error: { message: 'read refused' } }).then(res);
              const hits = inventory.filter(r => filters.every(([c, op, v]) =>
                op === 'eq' ? String(r[c]) === String(v)
                : op === 'in' ? (v as any[]).map(String).includes(String(r[c]))
                : false));
              return Promise.resolve({ data: hits.map(r => ({ id: r.id })), error: null }).then(res);
            },
          };
          return b;
        },
        update(payload: any) {
          const filters: [string, string, any][] = [];
          calls.push({ verb: 'update', filters, payload });
          const b: any = {
            eq(c: string, v: any) { filters.push([c, 'eq', v]); return b; },
            in(c: string, v: any[]) { filters.push([c, 'in', v]); return b; },
            is(c: string, v: any) { filters.push([c, 'is', v]); return b; },
            not(c: string, op: string, v: any) { filters.push([c, `not.${op}`, v]); return b; },
            select() {
              updates++;
              if (opts.failAt === updates) return Promise.resolve({ data: null, error: { message: 'simulated chunk failure' } });
              if (opts.refuse) return Promise.resolve({ data: [], error: null });
              const hits = inventory.filter(r => filters.every(([c, op, v]) => {
                if (op === 'eq') return String(r[c]) === String(v);
                if (op === 'in') return (v as any[]).map(String).includes(String(r[c]));
                if (op === 'is') return v === null ? r[c] == null : r[c] === v;
                if (op === 'not.is') return v === null ? r[c] != null : r[c] !== v;
                return false;
              }));
              for (const h of hits) Object.assign(h, payload);
              return Promise.resolve({ data: hits.map(h => ({ id: h.id })), error: null });
            },
          };
          return b;
        },
      };
    },
  };
  return { db, inventory, ledger, calls };
}

const lot = (id: string, o: any = {}) => ({
  id, business_id: BIZ, name: id, qty: 0, status: 'available', retired_at: null, import_run_id: RUN, ...o,
});

async function main(): Promise<void> {
  // ── §S1 the planner ───────────────────────────────────────────────────────────────────────
  const cands: SeedCandidate[] = [
    { id: 'imp',   name: 'Desert Willow 30', qty: 0,  hasHistory: false, imported: true },
    { id: 'hand',  name: 'Hand-made row',    qty: 0,  hasHistory: false, imported: false },
    { id: 'bare',  name: 'No flag given',    qty: 0,  hasHistory: false },
    { id: 'full',  name: 'Seeded already',   qty: 10, hasHistory: false, imported: true },
    { id: 'sold',  name: 'Sold out',         qty: 0,  hasHistory: true,  imported: true },
  ];
  const t = planOpeningStockSeed(cands, 5, 'test');
  ok(t.ok === true, 'S1a a test-mode plan is produced');
  if (t.ok) {
    ok(t.mode === 'test', 'S1b the plan says which mode it is in');
    ok(t.steps.map(s => s.lotId).join(',') === 'imp', `S1c 🔴 TEST MODE SEEDS ONLY THE IMPORTED ROW (got ${t.steps.map(s => s.lotId).join(',')})`);
    ok(t.steps.every(s => s.writesLedger === false), 'S1d 🔴 and every test step writes NO ledger row');
    ok(t.skipped.notImported === 2, 'S1e 🔴 a hand-made row AND a row with no import flag are both left alone, and counted');
    ok(t.skipped.withStock === 1 && t.skipped.withHistory === 1, 'S1f the existing exclusions still hold in test mode');
  }
  const l = planOpeningStockSeed(cands, 5, 'live');
  ok(l.ok === true && l.steps.map(s => s.lotId).join(',') === 'imp,hand,bare',
    'S1g writes ON → today\'s behaviour: every empty, history-free row is seeded, imported or not');
  ok(l.ok === true && l.steps.every(s => s.writesLedger === true), 'S1h and every live step goes through the ledger');
  ok(l.ok === true && l.skipped.notImported === 0, 'S1i live mode never skips a row for not being imported');
  ok(planOpeningStockSeed(cands, SEED_CAP + 1, 'test').ok === false, 'S1j 🔴 SEED_CAP holds in TEST mode');
  ok(planOpeningStockSeed(cands, SEED_CAP + 1, 'live').ok === false, 'S1k SEED_CAP holds in live mode');
  ok(planOpeningStockSeed(cands, SEED_CAP, 'test').ok === true, 'S1l the cap itself is allowed');
  const onlyHand = planOpeningStockSeed([{ id: 'hand', name: 'H', qty: 0, hasHistory: false, imported: false }], 5, 'test');
  ok(onlyHand.ok === false && /only products your QuickBooks import created/.test(onlyHand.ok ? '' : onlyHand.error),
    'S1m nothing imported to seed → a refusal that says why, in test-mode words');
  ok(seedModeFor(false) === 'test' && seedModeFor(true) === 'live', 'S1n the mode follows the stored switch');
  ok(seedModeFor(undefined) === 'test' && seedModeFor(null) === 'test', 'S1o 🔴 an UNREAD switch is test mode — no ledger write');

  // ── §S2 the writer ────────────────────────────────────────────────────────────────────────
  {
    const rows = [lot('imp'), lot('hand', { import_run_id: null }), lot('other')];
    const { db, inventory, ledger, calls } = fakeDb(rows);
    const plan = planOpeningStockSeed(rows.map(r => ({ id: r.id, name: r.name, qty: 0, hasHistory: false, imported: r.import_run_id != null })), 7, 'test');
    if (!plan.ok) throw new Error('fixture');
    const ledgerBefore = ledger.length;
    const r = await seedQtyWithoutLedger(db as any, BIZ, plan.steps);
    ok(r.ok === true && r.written === 2, `S2a both imported rows were set (written ${r.written}, error ${r.error})`);
    ok(inventory.find(x => x.id === 'imp')?.qty === 7 && inventory.find(x => x.id === 'other')?.qty === 7, 'S2b 🔴 qty IS set');
    ok(ledger.length === ledgerBefore, 'S2c 🔴 THE LEDGER COUNT IS UNCHANGED');
    ok(calls.every(c => c.verb === 'update'), 'S2d 🔴 not one RPC — the only write is the qty UPDATE');
    ok(inventory.find(x => x.id === 'hand')?.qty === 0, 'S2e 🔴 the row with import_run_id NULL is untouched');
    ok(inventory.find(x => x.id === 'imp')?.status === 'available', 'S2f status reads available, as the RPC would derive');
  }
  {
    // A hand-made row whose id is FORCED into the steps is still not written — the filter is at the database.
    const { db, inventory } = fakeDb([lot('hand', { import_run_id: null })]);
    const r = await seedQtyWithoutLedger(db as any, BIZ, [
      { lotId: 'hand', name: 'hand', newQty: 5, kind: 'opening_stock_seed', reason: 'x', writesLedger: false },
    ]);
    ok(inventory[0].qty === 0, 'S2g 🔴 a row with import_run_id NULL is NEVER touched, even when a step names it');
    ok(r.ok === false && r.written === 0 && /Set 0 of 1/.test(r.error ?? ''), 'S2h and the shortfall is reported, not rounded up');
  }
  {
    // Rows that moved since the plan: stocked, retired, a human status, another tenant.
    const { db, inventory } = fakeDb([
      lot('stocked', { qty: 3 }), lot('retired', { retired_at: '2026-09-10' }),
      lot('damaged', { status: 'damaged' }), lot('foreign', { business_id: 'someone-else' }),
    ]);
    const steps = ['stocked', 'retired', 'damaged', 'foreign'].map(id => (
      { lotId: id, name: id, newQty: 5, kind: 'opening_stock_seed' as const, reason: 'x', writesLedger: false }));
    const r = await seedQtyWithoutLedger(db as any, BIZ, steps);
    ok(inventory.find(x => x.id === 'stocked')?.qty === 3, 'S2i 🔴 a row that gained stock since the plan is not overwritten');
    ok(inventory.find(x => x.id === 'retired')?.qty === 0, 'S2j a retired row is not given stock');
    ok(inventory.find(x => x.id === 'damaged')?.qty === 0, 'S2k a human status (damaged) is left alone');
    ok(inventory.find(x => x.id === 'foreign')?.qty === 0, 'S2l 🔴 another tenant\'s row is never written (AC-3)');
    ok(r.ok === false && r.written === 0, 'S2m and none of it is reported as success');
  }
  {
    // A PARTIAL chunk: one row writes, one has gained stock. Not zero, so the chunk does not stop —
    // the END-OF-RUN shortfall check is the only thing that can refuse this.
    const { db } = fakeDb([lot('p1'), lot('p2', { qty: 4 })]);
    const r = await seedQtyWithoutLedger(db as any, BIZ, ['p1', 'p2'].map(id => (
      { lotId: id, name: id, newQty: 5, kind: 'opening_stock_seed' as const, reason: 'x', writesLedger: false })));
    ok(r.ok === false && r.written === 1 && /Set 1 of 2/.test(r.error ?? ''),
      `S2t 🔴 a PARTIAL chunk (1 of 2) is a failure with both numbers, not a success (got ${JSON.stringify(r)})`);
  }
  {
    const { db } = fakeDb([lot('a')], { refuse: true });
    const r = await seedQtyWithoutLedger(db as any, BIZ, [{ lotId: 'a', name: 'a', newQty: 5, kind: 'opening_stock_seed', reason: 'x', writesLedger: false }]);
    ok(r.ok === false && r.written === 0, 'S2n 🔴 an RLS refusal (no error, zero rows) is a failure');
  }
  {
    const { db, calls } = fakeDb([lot('a')]);
    const r = await seedQtyWithoutLedger(db as any, BIZ, [{ lotId: 'a', name: 'a', newQty: 5, kind: 'opening_stock_seed', reason: 'x', writesLedger: true }]);
    ok(r.ok === false && calls.length === 0, 'S2o a LIVE step handed to the test writer is refused before any write');
  }
  {
    const many = Array.from({ length: SEED_TEST_CHUNK + 5 }, (_, i) => lot(`m${i}`));
    const { db, inventory } = fakeDb(many, { failAt: 2 });
    const plan = planOpeningStockSeed(many.map(r => ({ id: r.id, name: r.name, qty: 0, hasHistory: false, imported: true })), 4, 'test');
    if (!plan.ok) throw new Error('fixture');
    const r = await seedQtyWithoutLedger(db as any, BIZ, plan.steps);
    ok(r.ok === false && r.written === SEED_TEST_CHUNK, 'S2p a failure on chunk 2 reports exactly what chunk 1 wrote');
    ok(/Nothing was written to your stock record/.test(r.error ?? ''), 'S2q and says the record was not touched');
    ok(inventory.filter(x => x.qty === 4).length === SEED_TEST_CHUNK, 'S2r and that is what the table holds');
  }
  {
    const { db } = fakeDb([lot('a'), lot('b')]);
    const r = await seedQtyWithoutLedger(db as any, BIZ, [
      { lotId: 'a', name: 'a', newQty: 5, kind: 'opening_stock_seed', reason: 'x', writesLedger: false },
      { lotId: 'b', name: 'b', newQty: 6, kind: 'opening_stock_seed', reason: 'x', writesLedger: false },
    ]);
    ok(r.ok === false && r.written === 0, 'S2s two different numbers in one seed are refused');
  }

  // ── §S3 the screen's wiring ───────────────────────────────────────────────────────────────
  const src = readFileSync('packages/shared/src/components/OpeningStockSeed.tsx', 'utf8');
  ok(/const mode = seedModeFor\(business\?\.qbo_writes_enabled\);/.test(src), 'S3a the screen reads its mode from the stored switch');
  ok(/planOpeningStockSeed\(candidates, qty, mode\)/.test(src), 'S3b and plans with it');
  const testAt = src.indexOf("if (plan.mode === 'test') {");
  const rpcAt = src.indexOf("supabase.rpc('adjust_inventory_manual'");
  const testBlock = src.slice(testAt, rpcAt);
  ok(testAt > 0 && rpcAt > testAt, 'S3c 🔴 the test branch comes BEFORE the ledger RPC loop');
  ok(/seedQtyWithoutLedger\(supabase, businessId, plan\.steps\)/.test(testBlock)
     && /setPhase\(\{ k: 'done', seeded: r\.written, qty, skipped: plan\.skipped \}\);\s*\n\s*return;\s*\n\s*\}/.test(testBlock),
    'S3d 🔴 and it calls the qty-only writer and RETURNS after success — it cannot fall through to the RPC');
  ok((src.match(/supabase\.rpc\(/g) ?? []).length === 1, 'S3e the live path is unchanged: one RPC call site, adjust_inventory_manual');
  // ✏️ WINDOW WIDENED 120 → 500 (ledger #361). The claim is unchanged and still true — the screen
  // reads `import_run_id` in the query that loads the candidates. What broke it was #352 adding
  // `qb_item_type` / `qb_income_account` to the same select and a comment above it, which pushed
  // the field past a byte distance that was never the point. A probe pinned to a character count
  // fails on formatting rather than on behaviour (#182's class: it stopped reaching its target).
  ok(/import_run_id/.test(src.slice(src.indexOf(".from('business_inventory')"), src.indexOf(".from('business_inventory')") + 500)),
    'S3f the screen reads import_run_id, so `imported` is a measurement, not a default');
  ok(!/import_run_id/.test(src.slice(0, src.indexOf(".from('business_inventory')"))),
    'S3f2 🔴 NEGATIVE CONTROL — the match comes from the query, not from prose earlier in the file');
  ok(/You are in test mode\./.test(src) && /Nothing is written to your stock record/.test(src),
    'S3g the screen SAYS which mode it is in and what that means');

  // ── §S4 · #366 — A REFUSED WRITE SAYS WHICH REFUSAL IT WAS ─────────────────────────────────
  // David, 2026-09-21: he pressed Undo, then Set starting numbers, and was told "your permissions
  // refused it, or those products changed since this screen loaded". The rows had been DELETED by
  // his own Undo. The message named two causes and sent him to the wrong one.
  {
    const r4 = [lot('a'), lot('b')];
    const p4 = planOpeningStockSeed(r4.map(x => ({ id: x.id, name: x.name, qty: 0, hasHistory: false, imported: true })), 10, 'test');
    if (!p4.ok) throw new Error('fixture');

    // ① the rows are GONE — what an Undo leaves behind
    const gone = fakeDb(r4, { refuse: true });
    gone.inventory.length = 0;
    const rg = await seedQtyWithoutLedger(gone.db as any, BIZ, p4.steps);
    ok(rg.ok === false, 'S4a a refused write is still a refusal');
    ok(/no longer in your catalogue/.test(rg.error ?? ''),
       `S4b 🔴 IT SAYS THE CATALOGUE MOVED, because it looked: the ids are not there (${rg.error})`);
    ok(!/permissions/.test(rg.error ?? ''),
       'S4c 🔴 …and it does NOT also blame permissions — naming both is what sent David to the wrong one');

    // ② the rows are still there — then it really is the policy
    const kept = fakeDb(r4, { refuse: true });
    const rk = await seedQtyWithoutLedger(kept.db as any, BIZ, p4.steps);
    ok(/permissions refusing the change/.test(rk.error ?? ''),
       `S4d the rows ARE there, so it names the permissions — the opposite branch, proven separately (${rk.error})`);
    ok(/still there/.test(rk.error ?? ''), 'S4e …and says how many it found, so the claim is checkable');

    // ③ 🔴 NEGATIVE CONTROL — when it cannot tell, it says so rather than guessing either way
    const blind = fakeDb(r4, { refuse: true, readFails: true });
    const rb = await seedQtyWithoutLedger(blind.db as any, BIZ, p4.steps);
    ok(/could not tell/.test(rb.error ?? ''),
       `S4f an unreadable check reports that it could not tell, rather than falling back to a guess (${rb.error})`);
  }


  // ── §S5 · #366 — THE PANEL IS TOLD WHEN THE CATALOGUE MOVES, AND CLEARS BEFORE IT RE-READS ──
  // The defect had three parts and this asserts all three: the panel never re-read, it showed the
  // old counts while it did, and the import panel never told it anything. Source-level, because
  // these are wiring facts — but each one carries a NEGATIVE CONTROL, because a probe that greps
  // for prose passes on a comment (#182: a check that cannot reach its target reports success).
  {
    const seed = readFileSync('packages/shared/src/components/OpeningStockSeed.tsx', 'utf8');
    const imp  = readFileSync('packages/shared/src/components/QboCatalogueImport.tsx', 'utf8');
    const set  = readFileSync('packages/shared/src/pages/Settings.tsx', 'utf8');

    ok(/catalogueVersion\s*=\s*0\s*}\s*:/.test(seed) || /catalogueVersion\s*=\s*0/.test(seed),
       'S5a the panel accepts a catalogueVersion');
    const effect = seed.slice(seed.indexOf('firstSignal'), seed.indexOf('async function apply'));
    ok(/setPhase\(\{ k: 'loading' \}\)/.test(effect) && /setCandidates\(\[\]\)/.test(effect),
       'S5b 🔴 IT CLEARS FIRST — the stale "44 of your 631" is what David acted on, so re-reading alone is not the fix');
    ok(/void load\(\)/.test(effect), 'S5c …and then re-reads');
    ok(/\[catalogueVersion, load\]/.test(effect), 'S5d …driven by the signal, not by a timer or a focus event');
    ok(/firstSignal\.current/.test(effect),
       'S5e and it does NOT fire on mount, which would double every first read');

    const call = imp.slice(imp.indexOf("async function call("), imp.indexOf('finally'));
    ok(/onCatalogueChanged\?\.\(\)/.test(call), 'S5f the import panel tells the page when something lands');
    ok(/step === 'import' \|\| step === 'undo'/.test(call) && /body\.ok/.test(call),
       'S5g 🔴 ON IMPORT AND UNDO, AND ONLY WHEN IT LANDED — an undo that refused changed nothing');
    ok(!/step === 'preview'[^)]*onCatalogueChanged/.test(call),
       'S5h 🔴 NEGATIVE CONTROL — preview does not fire it: preview changes no product row');

    ok(/onCatalogueChanged=\{\(\) => setCatalogueVersion/.test(set) && /<OpeningStockSeed catalogueVersion=/.test(set),
       'S5i the page wires the two together');
    ok(!/<OpeningStockSeed \/>/.test(set),
       'S5j 🔴 NEGATIVE CONTROL — the unwired mount is gone, so the fix cannot be half-applied');
  }

}

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log(failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
}).catch(e => { console.error(e); process.exit(1); });
