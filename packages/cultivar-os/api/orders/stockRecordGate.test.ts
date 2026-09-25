/**
 * ── IN TEST MODE, NO ORDER WRITES THE RECORD — asserted by COUNTING RPC CALLS ─────────────────
 *
 * WHAT THIS GUARDS (ledger #342, David's rulings of 2026-09-16):
 *   ① "A TEST ORDER NEVER CHANGES STOCK."
 *   ② "WE MUST NEVER ALLOW THEM TO WRITE TO THE ACTUAL RECORD DURING TESTING" — in test mode NO
 *      order of ANY origin (checkout or captured) moves qty or appends to business_inventory_ledger,
 *      at any step including fulfilment. Status still moves.
 *
 * 🔴 WHY IT COUNTS RPC CALLS. Both writes in `submit.ts` are RPCs (`adjust_inventory_qty` moves qty
 * AND appends the ledger row in one transaction; `record_order_event` appends a delta-0 row). A
 * withheld write is an RPC that was never issued, so the only honest observation is the call count.
 *
 * THE PATHS (`submit.ts`), each probed for a CHECKOUT test order and a CAPTURED (history) order:
 *   P1 walk-in sale decrement (handleCreate)      E1 order_created / order_committed / order_fulfilled
 *   P2 fulfilment decrement (handleStatus)        E2 order_<status>
 *   P3 un-fulfil restore (handleStatus)           E3 order_edited
 *   P4 fulfilled edit (handleUpdate)              E4 order_deleted
 *   P5 fulfilled delete restore (handleDelete)
 * The helpers are probed by behaviour (§A–§C); the WIRING of every path is probed at the source
 * (§D), because a helper that refuses correctly proves nothing about a call site that bypasses it.
 *
 * Run: node scripts/run-tests.mjs stockRecordGate
 */
import { readFileSync } from 'node:fs';
import {
  adjustLotQty, recordOrderEvent, readStockRecordGate, stockRecordGateFor, currentImportRunId,
} from './submit';
import { mayWriteStockRecord } from '../../../shared/src/business-logic/testMode';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// ── a PostgREST-shaped fake that records every RPC and answers the businesses read ────────────
function fakeDb(opts: { writesEnabled?: boolean | null; switchReadFails?: boolean; runRows?: any[]; runReadFails?: boolean } = {}) {
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const filters: string[] = [];
  const db = {
    rpcs, filters,
    rpc(fn: string, args: Record<string, unknown>) {
      rpcs.push({ fn, args });
      if (fn === 'adjust_inventory_qty') {
        return Promise.resolve({ data: [{ new_qty: 8, new_status: 'available', applied: true, reason: 'applied' }], error: null });
      }
      return Promise.resolve({ data: 'evt', error: null });
    },
    from(table: string) {
      const chain: any = {
        select() { return chain; },
        eq(c: string, v: unknown) { filters.push(`${table}.eq.${c}=${v}`); return chain; },
        is(c: string, v: unknown) { filters.push(`${table}.is.${c}=${v}`); return chain; },
        not(c: string, op: string, v: unknown) { filters.push(`${table}.not.${c}.${op}.${v}`); return chain; },
        order() { return chain; },
        limit() {
          if (opts.runReadFails) return Promise.resolve({ data: null, error: { message: 'boom' } });
          return Promise.resolve({ data: opts.runRows ?? [], error: null });
        },
        maybeSingle() {
          if (opts.switchReadFails) return Promise.resolve({ data: null, error: { message: 'timeout', code: '57014' } });
          const row = opts.writesEnabled === undefined ? null : { qbo_writes_enabled: opts.writesEnabled };
          return Promise.resolve({ data: row, error: null });
        },
      };
      return chain;
    },
  };
  return db;
}

const MV = { actorUserId: 'u1', kind: 'sale', orderId: 'o1', occurredAt: '2026-09-16T00:00:00Z' };
const TEST = false;   // qbo_writes_enabled = false  → test mode
const LIVE = true;

// ── §A — the predicate: both clauses, each alone ───────────────────────────────────────────────
ok(mayWriteStockRecord({ writesEnabled: TEST, orderKind: null }) === false, 'A1 test mode + checkout order → no write (ruling ②)');
ok(mayWriteStockRecord({ writesEnabled: TEST, orderKind: 'history' }) === false, 'A2 test mode + CAPTURED order → no write (ruling ②, any origin)');
ok(mayWriteStockRecord({ writesEnabled: TEST, orderKind: 'test' }) === false, 'A3 test mode + test order → no write');
ok(mayWriteStockRecord({ writesEnabled: LIVE, orderKind: 'test' }) === false, 'A4 LIVE + a test order → STILL no write (ruling ①, forever)');
ok(mayWriteStockRecord({ writesEnabled: LIVE, orderKind: null }) === true, 'A5 live + checkout order → writes, exactly as today');
ok(mayWriteStockRecord({ writesEnabled: LIVE, orderKind: 'history' }) === true, 'A6 live + captured order → unchanged from today');
ok(mayWriteStockRecord({ writesEnabled: undefined, orderKind: null }) === false, 'A7 an UNREAD switch → no write (safe direction)');
ok(mayWriteStockRecord({ writesEnabled: null, orderKind: null }) === false, 'A8 a null switch → no write');

async function main(): Promise<void> {
  // ── §B — the two chokepoints issue NO RPC when the gate is closed ───────────────────────────
  for (const [label, kind] of [['checkout test order', 'test'], ['captured order', 'history']] as const) {
    const gate = stockRecordGateFor(TEST, kind);
    const db = fakeDb();
    // P1–P5 all reach the same chokepoint with a signed delta; both signs are probed.
    const dec = await adjustLotQty(db, gate, 'b1', 'lot1', -2, 'P1/P2/P4 decrement', MV);
    const inc = await adjustLotQty(db, gate, 'b1', 'lot1', +2, 'P3/P4/P5 restore', { ...MV, kind: 'sale_reversal' });
    ok(db.rpcs.length === 0, `B1 ${label}: decrement + restore issued ${db.rpcs.length} RPCs in test mode (expected 0)`);
    ok(dec.applied === false && dec.reason === 'test_mode', `B2 ${label}: a withheld decrement reports reason test_mode, not a silent success`);
    ok(inc.applied === false && inc.reason === 'test_mode', `B3 ${label}: a withheld restore reports reason test_mode`);
    for (const ev of ['order_created', 'order_committed', 'order_fulfilled', 'order_invoiced', 'order_edited', 'order_deleted']) {
      const wrote = await recordOrderEvent(db, gate, 'b1', 'o1', ev, 'u1', MV.occurredAt);
      ok(wrote === false, `B4 ${label}: ${ev} reported as written in test mode`);
    }
    ok(db.rpcs.length === 0, `B5 ${label}: order events issued ${db.rpcs.length} ledger RPCs in test mode (expected 0)`);
  }

  // ── §C — out of test mode, today's behaviour; and the gate reader's failure direction ───────
  {
    const db = fakeDb();
    await adjustLotQty(db, stockRecordGateFor(LIVE, null), 'b1', 'lot1', -2, 'live sale', MV);
    await recordOrderEvent(db, stockRecordGateFor(LIVE, null), 'b1', 'o1', 'order_created', 'u1', MV.occurredAt);
    ok(db.rpcs.map(r => r.fn).join(',') === 'adjust_inventory_qty,record_order_event',
      `C1 a live checkout order writes exactly as today (got ${db.rpcs.map(r => r.fn).join(',')})`);
    ok(db.rpcs[0].args.p_delta === -2 && db.rpcs[0].args.p_source_type === 'order', 'C2 the live call carries the same arguments as before');
  }
  {
    const db = fakeDb();
    await adjustLotQty(db, stockRecordGateFor(LIVE, 'test'), 'b1', 'lot1', +2, 'un-fulfil after go-live', MV);
    ok(db.rpcs.length === 0, 'C3 after go-live, a PRACTICE order still cannot restore stock it never took (ruling ①)');
  }
  {
    const db = fakeDb();
    await adjustLotQty(db, stockRecordGateFor(LIVE, 'history'), 'b1', 'lot1', -1, 'captured, live', MV);
    ok(db.rpcs.length === 1, 'C4 a captured order out of test mode is unchanged from today');
  }
  ok((await readStockRecordGate(fakeDb({ writesEnabled: TEST }), 'b1', 'history')).writable === false, 'C5 reader: test mode → closed for a captured order');
  ok((await readStockRecordGate(fakeDb({ writesEnabled: LIVE }), 'b1', null)).writable === true, 'C6 reader: live + checkout → open');
  ok((await readStockRecordGate(fakeDb({ switchReadFails: true }), 'b1', null)).writable === false, 'C7 reader: a FAILED switch read → closed');
  ok((await readStockRecordGate(fakeDb({ writesEnabled: undefined }), 'b1', null)).writable === false, 'C8 reader: no business row → closed');

  // ── §C9 — the practice order's run id ────────────────────────────────────────────────────────
  {
    const db = fakeDb({ runRows: [{ import_run_id: 'run-7' }] });
    ok((await currentImportRunId(db, 'b1')) === 'run-7', 'C9 the current run id is read from the live catalogue');
    ok(db.filters.includes('business_inventory.is.retired_at=null'), 'C10 the run is read from LIVE rows only (a retired run is not current)');
    ok(db.filters.includes('business_inventory.not.import_run_id.is.null'), 'C11 rows with no run id are excluded from the answer');
    ok(db.filters.includes('business_inventory.eq.business_id=b1'), 'C12 the run read is tenant-scoped (AC-3)');
    ok((await currentImportRunId(fakeDb({ runRows: [] }), 'b1')) === null, 'C13 never imported → no run id');
    ok((await currentImportRunId(fakeDb({ runReadFails: true }), 'b1')) === null, 'C14 a failed read → no run id, not a guess');
  }

  // ── §D — THE WIRING. Every write site in submit.ts passes a gate built for ITS order ─────────
  const src = readFileSync('packages/cultivar-os/api/orders/submit.ts', 'utf8');
  const rpcAdjust = (src.match(/\.rpc\('adjust_inventory_qty'/g) ?? []).length;
  const rpcEvent  = (src.match(/\.rpc\('record_order_event'/g) ?? []).length;
  ok(rpcAdjust === 1, `D1 exactly ONE adjust_inventory_qty call site (the gated chokepoint) — found ${rpcAdjust}`);
  ok(rpcEvent === 1, `D2 exactly ONE record_order_event call site (the gated chokepoint) — found ${rpcEvent}`);
  for (const rpc of ['adjust_inventory_manual', 'count_reconcile_inventory', 'emit_inventory_movement', 'soft_delete_inventory']) {
    ok(!src.includes(`'${rpc}'`), `D3 submit.ts must not call ${rpc} (an ungated ledger writer)`);
  }
  ok(!/from\('business_inventory_ledger'\)\s*\.\s*insert/.test(src), 'D4 no direct ledger insert in submit.ts');
  ok(!/from\('business_inventory'\)[^;]*\.update\([^)]*qty/.test(src), 'D5 no direct qty update in submit.ts');

  const adjustCalls = src.match(/await adjustLotQty\(([^,]+),\s*([^,]+),/g) ?? [];
  const eventCalls  = src.match(/await recordOrderEvent\(([^,]+),\s*([^,]+),/g) ?? [];
  // 5 decrement/restore sites (P1–P5) and 7 event sites: created, committed, fulfilled, edited,
  // deleted, status, and — added 2026-09-25 (ledger #418) — CANCELLED.
  // ⚠️ WHY CANCEL EARNED ITS OWN SITE RATHER THAN RIDING THE GENERIC `order_${status}` ONE: the
  // cancel transition now goes through `cancel_order_with_stops`, which retires the order's
  // delivery stops in the SAME transaction, and it returns BEFORE the generic status path. Its
  // event carries what the generic one cannot — how many stops went with the order.
  // 🔴 THE RUNTIME COUNT DID NOT CHANGE: a cancel emits ONE event either way. This is a seventh
  // call SITE, not a seventh event. The number is a tripwire so a new writer gets noticed — which
  // is exactly what it just did — so it is raised deliberately and the new site is named, never
  // loosened to `>= 6`.
  ok(adjustCalls.length === 5, `D6 five adjustLotQty call sites (P1–P5) — found ${adjustCalls.length}`);
  ok(eventCalls.length === 7, `D7 seven recordOrderEvent call sites (the 7th is the cancel branch, #418) — found ${eventCalls.length}`);
  ok(adjustCalls.every(c => /,\s*stockGate,$/.test(c)), 'D8 every adjustLotQty call passes stockGate');
  ok(eventCalls.every(c => /,\s*stockGate,$/.test(c)), 'D9 every recordOrderEvent call passes stockGate');

  // Each handler builds its gate from ITS OWN order — not a hard-coded "writable", not a stale one.
  const handler = (name: string): string => {
    const i = src.indexOf(`async function ${name}(`);
    const j = src.indexOf('\nasync function ', i + 10);
    return src.slice(i, j < 0 ? undefined : j);
  };
  const create = handler('handleCreate');
  ok(/const stockGate = stockRecordGateFor\(writesEnabled, bornKind\);/.test(create), 'D10 P1/E1: checkout gates on the switch it read AND the kind it stamped');
  for (const [name, paths] of [['handleUpdate', 'P4/E3'], ['handleDelete', 'P5/E4'], ['handleStatus', 'P2/P3/E2']] as const) {
    const body = handler(name);
    ok(/const stockGate = await readStockRecordGate\(db, businessId, \(order as any\)\.order_kind\);/.test(body),
      `D11 ${paths}: ${name} gates on the stored switch AND this order's own kind`);
    ok(/\.from\('orders'\)\.select\('\*'\)/.test(body), `D12 ${paths}: ${name} reads the order with select('*') so order_kind is in hand`);
    const gateAt = body.indexOf('const stockGate');
    const firstWrite = Math.min(...['await adjustLotQty(', 'await recordOrderEvent(']
      .map(k => body.indexOf(k)).filter(n => n >= 0));
    ok(gateAt >= 0 && gateAt < firstWrite, `D13 ${paths}: ${name} builds its gate before its first write`);
  }
  ok(!/writable:\s*true/.test(src), 'D14 no hard-coded open gate anywhere in submit.ts');

  // ── §E — the practice order carries its run id; a live order never does ─────────────────────
  ok(/const practiceRunId = bornKind === TEST_ORDER_KIND \? await currentImportRunId\(db, businessId\) : null;/.test(create),
    'E1 the run id is read ONLY for a test order');
  ok(/if \(practiceRunId !== null\) gatedCols\.import_run_id = practiceRunId;/.test(create), 'E2 it is stamped only when there is one');
  ok(/delete gatedCols\.import_run_id;/.test(create) && create.indexOf('delete gatedCols.import_run_id;') < create.indexOf('Missing-column fallback'),
    'E3 a missing run-id column is retried on its OWN, before the strip-all fallback that would drop order_kind');
}

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log(failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
}).catch(e => { console.error(e); process.exit(1); });
