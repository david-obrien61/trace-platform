/**
 * ── sync/store — A LOCAL WRITE THAT DID NOT PERSIST MUST NOT REPORT SUCCESS · 2026-08-24 ──────
 *
 * PURPOSE:      RED-FIRST (STD-024) for the swallowed-storage defect. `store.ts:57` discarded a
 *               quota / disabled-storage exception, so `enqueue()` returned normally over a queue
 *               that had not grown and every caller above it reported success — under a banner
 *               reading *"counts are saved on this phone."*
 * DEPENDENCIES: ./store, ./offlineQueue, ./syncEngine. No DB, no browser — a stubbed
 *               `globalThis.localStorage` and a call-counting Supabase double.
 * OUTPUTS:      exit 0 / exit 1 + a per-probe line.
 *
 * 🔴 THE ONLINE CASE IS THE ONE THAT MATTERS AND IT WAS NOT IN THE RECON. Offline, the engine
 * said `queued` (bad). ONLINE it said **`applied`** — the strongest claim it can make — with a
 * drain of `applied:0 failed:0 remaining:0`, because the op was never persisted, so `list()` was
 * empty, the loop never ran, `stillQueued` was false, and `submit` concluded *"not in the queue,
 * so it landed."* Success inferred from an ABSENCE: A9/D-9 on the write path, R-12's class on the
 * client side of the wire. **E2 therefore counts DATABASE CALLS, not status strings** — a status
 * test would have passed against the defect.
 *
 * PROBES BOTH DIRECTIONS: S/Q/E prove the failure is reported; H proves a healthy store is
 * completely unaffected (a fix that made every save look broken would be as wrong in the lot).
 *
 * Run:  node scripts/run-tests.mjs storeDurability
 */
import { NamespacedStore, storageError, storageWarning } from './store';
import { OfflineQueue } from './offlineQueue';
import { SyncEngine } from './syncEngine';
import type { OfflineOp } from './types';

let passed = 0, failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else      { failed++; console.log(`  FAIL ${label}`); }
}

const QUOTA    = Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
const DISABLED = Object.assign(new Error('SecurityError: The operation is insecure.'), { name: 'SecurityError' });

/** A storage that is PRESENT but refuses every write — quota, Safari Private, site data off. */
function installThrowing(err: Error) {
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null, setItem: () => { throw err; }, removeItem: () => {},
  };
}
/** A storage that ACCEPTS writes and silently keeps nothing — the case a write-only probe misses. */
function installAmnesiac() {
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null, setItem: () => { /* accepted, discarded */ }, removeItem: () => {},
  };
}
function installWorking() {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };
}
function setOnline(v: boolean) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: v }, configurable: true });
}

let dbCalls = 0;
function db(reject?: string) {
  return {
    from: () => ({ insert: () => { dbCalls++; return Promise.resolve({ error: reject ? { code: '42501', message: reject } : null }); } }),
  } as unknown as Parameters<typeof SyncEngine.prototype.constructor>[0]['supabase'];
}
const OP = (id: string): OfflineOp => ({
  clientId: id, kind: 'insert', table: 'inventory_counts', payload: {},
  businessId: 'biz-1', userId: 'u1', clientTs: '', domain: 'inventory-count',
});

void (async () => {

  // ── S — THE STORE REPORTS ITS OWN FAILURE, AND CLASSIFIES IT ──────────────────────────────
  installThrowing(QUOTA);
  const q = new NamespacedStore('biz-1', 'inventory-count').save('queue', [1]);
  ok(q.ok === false && q.reason === 'quota', 'S1 a quota exception → ok:false, reason "quota"');

  installThrowing(DISABLED);
  const d = new NamespacedStore('biz-1', 'inventory-count').save('queue', [1]);
  ok(d.ok === false && d.reason === 'unavailable', 'S2 a disabled-storage exception → reason "unavailable"');
  ok(d.ok === false && storageError(d) !== storageWarning(d),
    'S3 🔴 the FAILED sentence and the PREVENTIVE sentence are different text — one says work was lost, the other says it will be');
  ok(d.ok === false && !/saved/i.test(storageError(d).replace(/could NOT save/i, '')),
    'S4 the failure sentence never claims anything was saved');

  installWorking();
  ok(new NamespacedStore('biz-1', 'd').save('k', { a: 1 }).ok === true, 'S5 a healthy store still returns ok:true');

  // ── P — THE UP-FRONT PROBE ────────────────────────────────────────────────────────────────
  installWorking();
  ok(new NamespacedStore('biz-1', 'd').probe().ok === true, 'P1 probe passes on a healthy store');
  installThrowing(DISABLED);
  ok(new NamespacedStore('biz-1', 'd').probe().ok === false, 'P2 probe fails when setItem throws');
  installAmnesiac();
  const amn = new NamespacedStore('biz-1', 'd').probe();
  ok(amn.ok === false && amn.reason === 'unavailable',
    'P3 🔴 probe fails on a store that ACCEPTS the write and keeps nothing — a write-only probe would have passed');

  // ── Q — THE QUEUE PROPAGATES IT ───────────────────────────────────────────────────────────
  installThrowing(DISABLED);
  const queue = new OfflineQueue(new NamespacedStore('biz-1', 'inventory-count'));
  ok(queue.enqueue(OP('c1')).ok === false, 'Q1 enqueue reports the failed persist');
  ok(queue.size() === 0, 'Q2 …and the queue genuinely did NOT grow');
  installWorking();
  const wq = new OfflineQueue(new NamespacedStore('biz-1', 'inventory-count'));
  ok(wq.enqueue(OP('c2')).ok === true && wq.size() === 1, 'Q3 a healthy enqueue returns ok and grows the queue');
  ok(wq.enqueue(OP('c2')).ok === true && wq.size() === 1, 'Q4 re-enqueuing the same clientId is ok:true and still idempotent');

  // ── E — THE ENGINE TELLS THE TRUTH ────────────────────────────────────────────────────────
  installThrowing(DISABLED); setOnline(false);
  const offRes = await new SyncEngine({ supabase: db(), businessId: 'biz-1', userId: 'u1', domain: 'inventory-count' })
    .insert({ table: 'inventory_counts', row: { id: 'x1' } });
  ok(offRes.status === 'failed', 'E1 OFFLINE + unusable storage → "failed", NOT "queued"');
  ok(offRes.status === 'failed' && /Private|store anything/i.test(offRes.error ?? ''),
    'E2 …and the message names STORAGE, not the network');

  installThrowing(DISABLED); setOnline(true); dbCalls = 0;
  const onRes = await new SyncEngine({ supabase: db(), businessId: 'biz-1', userId: 'u1', domain: 'inventory-count' })
    .insert({ table: 'inventory_counts', row: { id: 'x2' } });
  ok(onRes.status === 'applied', 'E3 ONLINE + unusable storage → "applied"');
  ok(dbCalls === 1,
    'E4 🔴 …AND THE DATABASE WAS ACTUALLY CALLED. Before the fix this said "applied" with ZERO calls — the defect is invisible to a status-only assertion');

  installThrowing(DISABLED); setOnline(true); dbCalls = 0;
  const rejRes = await new SyncEngine({ supabase: db('permission denied'), businessId: 'biz-1', userId: 'u1', domain: 'inventory-count' })
    .insert({ table: 'inventory_counts', row: { id: 'x3' } });
  ok(rejRes.status === 'failed', 'E5 ONLINE + unusable storage + the server REFUSES → "failed", not a false applied');

  // ── H — A HEALTHY STORE IS COMPLETELY UNAFFECTED (the mirrored-defect guard) ───────────────
  installWorking(); setOnline(false); dbCalls = 0;
  const hOff = await new SyncEngine({ supabase: db(), businessId: 'biz-1', userId: 'u1', domain: 'inventory-count' })
    .insert({ table: 'inventory_counts', row: { id: 'y1' } });
  ok(hOff.status === 'queued', 'H1 🔴 healthy store, OFFLINE → still "queued" — the dead-zone promise is untouched');
  ok(dbCalls === 0, 'H2 …and it did NOT reach for the network while offline');

  installWorking(); setOnline(true); dbCalls = 0;
  const engine = new SyncEngine({ supabase: db(), businessId: 'biz-1', userId: 'u1', domain: 'inventory-count' });
  const hOn = await engine.insert({ table: 'inventory_counts', row: { id: 'y2' } });
  ok(hOn.status === 'applied' && dbCalls === 1, 'H3 healthy store, ONLINE → "applied" via the normal drain, one call');
  ok(engine.pendingCount() === 0, 'H4 …and the queue is empty afterwards');
  ok(engine.storageStatus().ok === true, 'H5 storageStatus() reports usable on a healthy store');

  // ── N — NEGATIVE CONTROLS ─────────────────────────────────────────────────────────────────
  ok(!(offRes.status === 'queued'), 'N1 negative control — the offline unusable-storage case must NOT report queued');
  ok(!(hOff.status === 'failed'),   'N2 negative control — a healthy offline save must NOT report failed');

  console.log(`\nstoreDurability — ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
