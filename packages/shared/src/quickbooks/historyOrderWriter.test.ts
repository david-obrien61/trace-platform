/**
 * ── historyOrderWriter — what it writes, what it refuses, and the proof that stock did not move ──
 *
 * 🔴 §C AND §D ARE THE ACCEPTANCE CRITERIA IN CODE, AND THEY ARE THE REASON THIS FILE EXISTS.
 *   §C — the table set. "orders, order_items, and deliveries.order_id — and NOTHING else" is a
 *        claim about a set of tables and verbs, so a recording client captures every table this
 *        pass reaches and every verb it uses, and §C asserts the whole set. The file header
 *        states the same boundary in prose; [[R-26]] has fourteen instances of a prose boundary
 *        being false the day it was written.
 *   §D — the arithmetic. "Available to sell is byte-identical before and after" is CARD 8's own
 *        language, and it is proven here against a store that would show a movement if one
 *        happened, with a NEGATIVE CONTROL proving the fingerprint can differ at all.
 *
 * 🔴 §B IS THE THIRTY-EIGHT-ORDER TEST. Running this twice must write nineteen orders once.
 *
 * 🔴 §G REPRODUCES THE 2026-08-31 LIVE FAILURE. The stub carries the index as DATA and refuses
 *   exactly as Postgres does, because a double that cannot refuse is a rubber stamp ([[R-33]]) —
 *   the delivery ingest shipped past 87 green assertions, none of which COULD have caught it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/historyOrderWriter.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  previewOrderIngest, commitOrderIngest, availabilityFingerprint, matchPriorHistoryOrder,
} from './historyOrderWriter';
import type { QboShipmentRow } from './shipmentIngest';
import { parseInvoiceOrderLines } from './invoiceOrderLines';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

// ── fixtures shaped like Intuit's real bodies ────────────────────────────────
const salesLine = (name: string, desc: string, qty: number, unit: number, amt: number) => ({
  DetailType: 'SalesItemLineDetail', Amount: amt, Description: desc,
  SalesItemLineDetail: { ItemRef: { value: '99', name }, Qty: qty, UnitPrice: unit },
});
const subtotalLine = (amt: number) => ({ DetailType: 'SubTotalLineDetail', Amount: amt, SubTotalLineDetail: {} });
const noteLine = (d: string) => ({ DetailType: 'DescriptionOnly', Description: d });

/** One invoice, in the shape `parseShipmentList` produces. */
function inv(id: string, doc: string, txnDate: string, rawLines: any[], tax: number, total: number): QboShipmentRow {
  return {
    id, docNumber: doc, shipDate: '2026-09-05', txnDate, totalAmt: total,
    customerId: `QB${id}`, customerName: `Customer ${id}`,
    shipAddr: null, billAddr: null,
    lines: parseInvoiceOrderLines({ Line: rawLines }),
    totalTax: tax,
  };
}

/** #3648.640's real shape, reduced: two goods, a trip charge, a note, and the running total. */
const INV_A = inv('10587', '3648.640', '2026-08-29', [
  salesLine('Magnolia:LGM45', 'Little Gem Magnolia 45 gallon', 1, 1105, 1105),
  salesLine('TB', 'Tree Bubbler', 6, 65, 390),
  salesLine('TC', 'Trip Charge', 1, 50, 50),
  noteLine('1st Stop'),
  subtotalLine(1545),
], 127.46, 1672.46);

/** #3648.563 — the $0 invoice with two real warranty replacements on it. */
const INV_ZERO = inv('10208', '3648.563', '2026-07-23', [
  salesLine('BPJ30REP', 'Blue Point Juniper (Replacement)', 1, 0, 0),
  salesLine('Cypress:AZBI45', 'Arizona Cypress Blue Ice (Replacement)', 1, 0, 0),
  subtotalLine(0),
], 0, 0);

const stop = (id: string, invoiceId: string, over: any = {}) => ({
  id, business_id: BIZ, customer_id: `cust-${id}`, delivery_date: '2026-09-05',
  service_type: null, status: 'scheduled', qb_invoice_id: invoiceId, order_id: null, ...over,
});

// ── the recording stand-in ───────────────────────────────────────────────────
interface FakeIndex { table: string; columns: string[]; partial: boolean }
/** The CURRENT migration corpus, as 20260831c writes it: unique, two columns, NO predicate. */
const REAL_INDEXES: FakeIndex[] = [
  { table: 'orders', columns: ['business_id', 'qb_invoice_id'], partial: false },
];

function makeDb(seed: {
  deliveries?: any[]; orders?: any[]; orderItems?: any[]; lots?: any[];
  hasColumn?: boolean; indexes?: FakeIndex[]; failOn?: { table: string; verb: string; message: string };
} = {}) {
  const indexes = seed.indexes ?? REAL_INDEXES;
  // 🔴 ROWS ARE COPIED, NOT SHARED — AND THIS WAS A REAL DEFECT IN THIS FILE, NOT A PRECAUTION.
  // `[...seed.orders]` copies the ARRAY and shares the OBJECTS, so an `update` in one test
  // mutated the fixture every later test spread from. §M's clash case built its order as
  // `{ ...OCR, total_amount: 9999 }` and silently inherited the `qb_invoice_id` an EARLIER commit
  // had written — so the ordinary key handled it, the prior-order guard never ran, and three
  // assertions failed against correct code. **A negative case that is secretly a positive one
  // proves nothing**, and here it very nearly reported a working guard as broken.
  const copy = (rows: any[] | undefined) => (rows ?? []).map(r => ({ ...r }));
  const store: Record<string, any[]> = {
    deliveries: copy(seed.deliveries),
    orders: copy(seed.orders),
    order_items: copy(seed.orderItems),
    business_inventory: copy(seed.lots),
  };
  const hasColumn = seed.hasColumn !== false;
  const touched: { table: string; verb: string }[] = [];
  const patches: { table: string; patch: any }[] = [];
  let nextId = 1;

  function from(table: string) {
    const q: any = {
      _table: table, _filters: [] as [string, any][], _embed: false,
      select(cols: string) {
        touched.push({ table, verb: 'select' });
        if (table === 'orders' && !hasColumn && /qb_invoice_id/.test(cols)) {
          q._error = { code: '42703', message: 'column orders.qb_invoice_id does not exist' };
        }
        if (/orders!inner/.test(cols)) q._embed = true;
        return q;
      },
      eq(col: string, val: any) { q._filters.push([col, val]); return q; },
      is(col: string, val: any) { q._filters.push(['__is:' + col, val]); return q; },
      not(col: string) { q._filters.push(['__notnull:' + col, true]); return q; },
      limit() { return q._resolve(); },
      insert(rows: any) {
        touched.push({ table, verb: 'insert' });
        if (seed.failOn?.table === table && seed.failOn.verb === 'insert') {
          q._error = { code: 'XX000', message: seed.failOn.message }; return q;
        }
        const arr = (Array.isArray(rows) ? rows : [rows]).map(r => ({ id: `${table}-${nextId++}`, ...r }));
        store[table].push(...arr);
        q._inserted = arr; return q;
      },
      upsert(row: any, opts: any) {
        touched.push({ table, verb: 'upsert' });
        if (seed.failOn?.table === table && seed.failOn.verb === 'upsert') {
          q._error = { code: 'XX000', message: seed.failOn.message }; return q;
        }
        // 🔴 INFERENCE, MODELLED. `onConflict` names columns; Postgres must find a unique index
        // on exactly those columns AND WITHOUT A PREDICATE, because a column list cannot repeat
        // one. No match → the exact error the delivery ingest returned live, 19 times.
        const named: string[] = String(opts?.onConflict ?? '').split(',').map((c: string) => c.trim()).filter(Boolean);
        if (named.length > 0) {
          const inferable = indexes.some(ix =>
            ix.table === table && !ix.partial &&
            ix.columns.length === named.length && ix.columns.every((c, i) => c === named[i]));
          if (!inferable) {
            q._error = { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' };
            return q;
          }
        }
        const dup = store[table].some(r =>
          r.business_id === row.business_id && r.qb_invoice_id === row.qb_invoice_id && row.qb_invoice_id != null);
        if (dup && opts?.ignoreDuplicates) { q._inserted = []; return q; }
        const withId = { id: `${table}-${nextId++}`, ...row };
        store[table].push(withId);
        q._inserted = [withId]; return q;
      },
      update(patch: any) {
        touched.push({ table, verb: 'update' });
        patches.push({ table, patch });
        q._patch = patch; return q;
      },
      delete() { touched.push({ table, verb: 'delete' }); q._delete = true; return q; },
      _resolve() {
        if (q._error) return { data: null, error: q._error };
        // The `orders!inner(business_id)` embed: order lines filtered by their ORDER's business.
        if (q._embed && q._table === 'order_items') {
          const wanted = q._filters.find(([c]: [string, any]) => c === 'orders.business_id')?.[1];
          const mine = new Set(store.orders.filter(o => o.business_id === wanted).map(o => o.id));
          return { data: store.order_items.filter(oi => mine.has(oi.order_id)), error: null };
        }
        let rows = store[q._table].filter(r => q._filters.every(([c, v]: [string, any]) => {
          if (c.startsWith('__notnull:')) return r[c.slice(10)] != null;
          if (c.startsWith('__is:')) return r[c.slice(5)] === v || (v === null && r[c.slice(5)] == null);
          return r[c] === v;
        }));
        if (q._patch) { rows.forEach(r => Object.assign(r, q._patch)); }
        if (q._delete) {
          const gone = new Set(rows.map((r: any) => r.id));
          store[q._table] = store[q._table].filter((r: any) => !gone.has(r.id));
          return { data: rows, error: null };   // PostgREST returns the rows it removed
        }
        if (q._inserted !== undefined) rows = q._inserted;
        return { data: rows, error: null };
      },
      then(res: any, rej: any) { return Promise.resolve(q._resolve()).then(res, rej); },
    };
    return q;
  }
  return { db: { from }, store, touched, patches };
}

const LOTS = [
  { id: 'lot-1', business_id: BIZ, qty: 12 },
  { id: 'lot-2', business_id: BIZ, qty: 0 },
  { id: 'lot-3', business_id: BIZ, qty: 447 },
];

async function run() {
// ══ §A THE HAPPY PATH ══════════════════════════════════════════════════════
{
  const { db, store } = makeDb({ deliveries: [stop('d1', '10587')], lots: LOTS });
  const r = await commitOrderIngest(db, BIZ, [INV_A]);
  ok(r.ok && r.ordersWritten === 1, 'A1 one stop with no order gets exactly one order');
  ok(r.lineItemsWritten === 3, 'A2 three lines — the note and the running total are NOT lines');
  ok(r.deliveriesLinked === 1, 'A3 and the stop is joined to it');

  const o = store.orders[0];
  ok(o.order_kind === 'history', 'A4 order_kind is history — the discriminator the QuickBooks re-push refuses on');
  ok(o.status === 'invoiced', 'A5 status follows the stop: scheduled → invoiced, a real paid sale not yet delivered');
  ok(o.sale_date === '2026-08-29', 'A6 sale_date is the invoice\'s own TxnDate, never today — nineteen backfilled sales must not report as one afternoon\'s revenue');
  ok(o.qb_invoice_id === '10587', 'A7 the Intuit invoice id is the idempotency key and it is stored');
  ok(o.qb_doc_number === '3648.640', 'A8 and the number a customer can quote is kept beside it');
  ok(o.source_document_number === '3648.640', 'A9 the seller\'s own document number lands in its own column');
  ok(o.receipt_id === null, 'A10 NO receipt — nobody photographed anything, and minting one would record a scan that never happened');
  ok(o.notes === '1st Stop', 'A11 the DescriptionOnly line becomes a NOTE on the order, never a line to load');
  ok(o.subtotal === 1545 && o.tax_amount === 127.46 && o.total_amount === 1672.46, 'A12 the money is the document\'s own');
  ok(o.transport_method === 'delivery', 'A13 transport falls back to the WEAKER claim — service_type was never inferred');

  ok(store.order_items.every(l => l.business_inventory_id === null),
     'A14 🔴 every written line carries a NULL lot id — asserted at the WRITE, not only in the type');
  ok(store.order_items.map(l => l.sku).join(',') === 'Magnolia:LGM45,TB,TC',
     'A15 the sku is the item\'s own qualified name — sub-item structure kept, not flattened');
  ok(store.deliveries[0].order_id === store.orders[0].id, 'A16 the join points at the order that was just written');
}

// ══ §B 🔴 IDEMPOTENCY — THE THIRTY-EIGHT-ORDER TEST ════════════════════════
{
  const { db, store } = makeDb({ deliveries: [stop('d1', '10587'), stop('d2', '10208')], lots: LOTS });
  const first = await commitOrderIngest(db, BIZ, [INV_A, INV_ZERO]);
  ok(first.ordersWritten === 2, 'B1 the first run writes two orders');
  const ordersAfterFirst = store.orders.length;
  const linesAfterFirst = store.order_items.length;

  const second = await commitOrderIngest(db, BIZ, [INV_A, INV_ZERO]);
  ok(second.ordersWritten === 0, 'B2 🔴 the SECOND run writes nothing — an invoice that already has an order gets nothing');
  ok(second.lineItemsWritten === 0, 'B3 and no second set of lines');
  ok(store.orders.length === ordersAfterFirst, 'B4 the order count did not move: two plus two is not four here');
  ok(store.order_items.length === linesAfterFirst, 'B5 nor did the line count');
  ok(second.alreadyOrdered.length === 2, 'B6 both are REPORTED as already done rather than silently skipped');
  ok(second.planned.length === 0, 'B7 and the plan is empty, so the button has nothing to offer');
  // 🔴 The second run must not even TRY — an upsert that gets refused is not the same as not writing.
  ok(second.alreadyOrdered.every(a => !a.linkRepaired), 'B8 nothing is left to repair either');
}

// ══ §C 🔴 THE TABLE SET — WHAT IT MAY TOUCH, EXHAUSTIVELY ═════════════════
{
  const { db, touched, patches } = makeDb({ deliveries: [stop('d1', '10587')], lots: LOTS });
  await commitOrderIngest(db, BIZ, [INV_A]);

  const writes = touched.filter(t => t.verb !== 'select');
  const writtenTables = [...new Set(writes.map(t => t.table))].sort();
  ok(writtenTables.join(',') === 'deliveries,order_items,orders',
     `C1 🔴 it writes exactly three tables — got: ${writtenTables.join(',') || '(none)'}`);
  ok(!writes.some(t => t.table === 'business_inventory'),
     'C2 🔴 NOT ONE WRITE to business_inventory — no lot, no qty, no cost, no ledger row');
  ok(touched.some(t => t.table === 'business_inventory' && t.verb === 'select'),
     'C2b it does READ business_inventory — that is the availability proof, and a read is not a write');

  const delPatches = patches.filter(p => p.table === 'deliveries');
  ok(delPatches.length > 0 && delPatches.every(p => Object.keys(p.patch).join(',') === 'order_id'),
     'C3 🔴 the ONLY column ever updated on a delivery is order_id — the date, address and customer are Lauren\'s');
  // 🔴 THE ONLY UPDATE THIS FILE EVER ISSUES AGAINST `orders` IS THE INVOICE-ID RECORDING, and on
  // a clean run there is none at all. §M10 pins its column set; this pins that a run with no
  // collision never touches an existing order in the first place.
  ok(patches.filter(p => p.table === 'orders').length === 0,
     'C3b and on a run with no prior-order collision, NO existing order is updated at all');
  ok(!writes.some(t => t.table === 'customers'),
     'C4 no customer is created or touched — that was the previous pass\'s job and it is done');
}

// ══ §D 🔴 AVAILABLE TO SELL DID NOT MOVE ═══════════════════════════════════
{
  const { db, store } = makeDb({ deliveries: [stop('d1', '10587'), stop('d2', '10208')], lots: LOTS });
  const before = await availabilityFingerprint(db, BIZ);
  const r = await commitOrderIngest(db, BIZ, [INV_A, INV_ZERO]);
  const after = await availabilityFingerprint(db, BIZ);

  ok(r.availabilityUnchanged === true, 'D1 🔴 the run reports available-to-sell unchanged');
  ok(r.availabilityBefore === r.availabilityAfter, 'D2 and its own two fingerprints are identical');
  ok(before === after, 'D3 and so are two taken independently of the run — proven twice, from outside');
  ok(r.ordersWritten === 2 && store.order_items.length === 5,
     'D4 while five real lines across two orders WERE written — the proof is not passing because nothing happened');

  // 🔴 THE NEGATIVE CONTROL. A fingerprint that cannot differ proves nothing (R-33).
  store.order_items.push({ id: 'sneak', order_id: store.orders[0].id, quantity: 3, business_inventory_id: 'lot-1' });
  const poisoned = await availabilityFingerprint(db, BIZ);
  ok(poisoned !== after, 'D5 🔴 the fingerprint DOES change when a line acquires a lot id — proven, so D1 is a measurement and not a tautology');
  ok(/lot-1:12:3/.test(poisoned), 'D6 and it names the lot and the quantity now claimed against it');
}

// ══ §E 🔴 THE PAYLOAD GUARD ════════════════════════════════════════════════
{
  // A hand-built line carrying a lot id: the type cannot see this, so the commit must.
  const { db, store } = makeDb({ deliveries: [stop('d1', '10587')], lots: LOTS });
  const report = await previewOrderIngest(db, BIZ, [INV_A]);
  ok(report.linesCarryingLot === 0, 'E1 a clean plan reports zero lines carrying a lot id');

  const poisoned = { ...report, linesCarryingLot: 2, ok: true };
  ok(poisoned.linesCarryingLot > 0, 'E2 (fixture) the guard\'s input can be non-zero');
  ok(store.orders.length === 0, 'E3 and the preview wrote nothing at all — it is a read');

  const srcTxt = readFileSync(join(process.cwd(), 'packages/shared/src/quickbooks/historyOrderWriter.ts'), 'utf8');
  const guardIdx = srcTxt.indexOf('report.linesCarryingLot > 0');
  const fingerprintIdx = srcTxt.indexOf('await availabilityFingerprint(db, businessId)');
  ok(guardIdx > 0 && fingerprintIdx > 0 && guardIdx < fingerprintIdx,
     'E4 🔴 the lot-id guard runs BEFORE the first read of the write path — it refuses rather than reporting afterwards');
}

// ══ §F THE MIGRATION PRECONDITION ══════════════════════════════════════════
{
  const { db, store } = makeDb({ deliveries: [stop('d1', '10587')], lots: LOTS, hasColumn: false });
  const r = await commitOrderIngest(db, BIZ, [INV_A]);
  ok(r.ok === false, 'F1 without orders.qb_invoice_id the pass REFUSES rather than degrading');
  ok(/20260831c_orders_qb_invoice_uidx/.test(r.blocker ?? ''), 'F2 and the refusal NAMES the migration, so the blocker is actionable');
  ok(store.orders.length === 0, 'F3 🔴 and NOTHING was written — an ingest with no idempotency run twice doubles every order');
}

// ══ §G 🔴 THE INDEX MUST BE INFERABLE — THE 2026-08-31 LIVE FAILURE ════════
{
  const PARTIAL: FakeIndex[] = [{ table: 'orders', columns: ['business_id', 'qb_invoice_id'], partial: true }];
  const { db, store } = makeDb({ deliveries: [stop('d1', '10587')], lots: LOTS, indexes: PARTIAL });
  const r = await commitOrderIngest(db, BIZ, [INV_A]);
  ok(r.ordersWritten === 0, 'G1 🔴 a PARTIAL unique index writes nothing — this is exactly what happened live on all 19 delivery rows');
  ok(r.errors.some(e => /ON CONFLICT specification/.test(e.message)),
     'G2 and the run REPORTS Postgres\'s own words rather than a green count over an empty table');
  ok(store.orders.length === 0, 'G3 the store confirms it: zero orders');

  // The negative control — the SAME fixture with the predicate dropped succeeds.
  const fixed = makeDb({ deliveries: [stop('d1', '10587')], lots: LOTS });
  const r2 = await commitOrderIngest(fixed.db, BIZ, [INV_A]);
  ok(r2.ordersWritten === 1,
     'G4 🔴 and dropping the predicate is what fixes it — so G1 is about the index and not about the fixture');
}

// ══ §H REFUSALS — TRACE WILL NOT INVENT A LOAD ═════════════════════════════
{
  // The invoice is gone from the books.
  const a = makeDb({ deliveries: [stop('d1', 'vanished')], lots: LOTS });
  const ra = await commitOrderIngest(a.db, BIZ, [INV_A]);
  ok(ra.refusals.length === 1 && /no longer in the books/.test(ra.refusals[0].reason),
     'H1 an invoice that is no longer in QuickBooks is refused with the reason, never invented');
  ok(a.store.orders.length === 0, 'H1b and nothing is written for it');

  // A stop with no customer.
  const b = makeDb({ deliveries: [stop('d1', '10587', { customer_id: null })], lots: LOTS });
  const rb = await commitOrderIngest(b.db, BIZ, [INV_A]);
  ok(rb.refusals.length === 1 && /nobody to belong to/.test(rb.refusals[0].reason), 'H2 a stop with no customer gets no order');

  // An invoice of pure notes — a real thing, and a zero-line order would assert nothing was sold.
  const NOTES_ONLY = inv('999', '3648.999', '2026-08-01', [noteLine('Call before arriving'), subtotalLine(0)], 0, 0);
  const c = makeDb({ deliveries: [stop('d1', '999')], lots: LOTS });
  const rc = await commitOrderIngest(c.db, BIZ, [NOTES_ONLY]);
  ok(rc.refusals.length === 1 && /nothing to load/.test(rc.refusals[0].reason), 'H3 an invoice with no billable lines is refused, not written as an empty sale');
  ok(c.store.orders.length === 0, 'H3b and no empty order exists');

  // A stop already joined to an order that did NOT come from this invoice.
  const d = makeDb({
    deliveries: [stop('d1', '10587', { order_id: 'other-order' })],
    orders: [{ id: 'other-order', business_id: BIZ, qb_invoice_id: null }], lots: LOTS,
  });
  const rd = await commitOrderIngest(d.db, BIZ, [INV_A]);
  ok(rd.refusals.length === 1 && /will not replace it/.test(rd.refusals[0].reason),
     'H4 a stop already joined to someone else\'s order is left completely alone');
  ok(d.store.deliveries[0].order_id === 'other-order', 'H4b and its existing join is untouched');
}

// ══ §I THE LINK REPAIR — A HALF-FINISHED PREVIOUS RUN ══════════════════════
{
  // The order exists (a previous run wrote it) and the stop was never joined.
  const { db, store } = makeDb({
    deliveries: [stop('d1', '10587')],
    orders: [{ id: 'ord-existing', business_id: BIZ, qb_invoice_id: '10587', order_kind: 'history' }],
    lots: LOTS,
  });
  const preview = await previewOrderIngest(db, BIZ, [INV_A]);
  ok(preview.alreadyOrdered.length === 1 && preview.alreadyOrdered[0].linkRepaired === true,
     'I1 the preview says the order exists and the JOIN is what is still owed');
  ok(preview.planned.length === 0, 'I2 and it does NOT plan a second order for that invoice');

  const r = await commitOrderIngest(db, BIZ, [INV_A]);
  ok(r.ordersWritten === 0 && r.deliveriesLinked === 1, 'I3 the commit repairs the join and writes no order');
  ok(store.deliveries[0].order_id === 'ord-existing', 'I4 and the stop now points at the order that already existed');
  ok(store.orders.length === 1, 'I5 🔴 still exactly one order — the repair path cannot mint a duplicate');
}

// ══ §J PER-ROW ISOLATION — ONE BAD ROW COSTS ONLY ITSELF ═══════════════════
{
  const { db, store } = makeDb({
    deliveries: [stop('d1', '10587'), stop('d2', '10208')], lots: LOTS,
    failOn: { table: 'order_items', verb: 'insert', message: 'lines exploded' },
  });
  const r = await commitOrderIngest(db, BIZ, [INV_A, INV_ZERO]);
  ok(r.errors.length === 2 && r.errors.every(e => e.step === 'order_items'),
     'J1 BOTH failures are reported with the step that failed (R-18), never swallowed');
  ok(store.order_items.length === 0, 'J2 the lines genuinely did not write');
  // 🔴 THE COMPENSATION. An order with no lines is a sale record the dashboard would report
  // revenue for, and idempotency would skip it FOREVER — so it is rolled back, not left.
  ok(store.orders.length === 0, 'J3 🔴 and NEITHER empty order survives — a line-less sale record is worse than no sale record');
  ok(r.ordersWritten === 0, 'J4 the count reports zero, matching what is actually in the table');
  ok(store.deliveries.every(d => d.order_id === null), 'J5 and no stop points at an order that was withdrawn');
  ok(r.errors.every(e => /retry this stop from the start/.test(e.message)),
     'J6 the message tells the operator the next run will pick it up, rather than leaving them to guess');
  ok(r.availabilityUnchanged === true, 'J7 🔴 and the availability proof still holds through a partial failure');

  // The other half: the rollback ITSELF failing must not read as a clean recovery.
  const stuck = makeDb({
    deliveries: [stop('d1', '10587')], lots: LOTS,
    failOn: { table: 'order_items', verb: 'insert', message: 'lines exploded' },
  });
  const origFrom = stuck.db.from;
  stuck.db.from = ((t: string) => {
    const q: any = origFrom(t);
    if (t === 'orders') { const d = q.delete.bind(q); q.delete = () => { d(); q._error = { code: 'XX000', message: 'delete refused' }; return q; }; }
    return q;
  }) as any;
  const rs = await commitOrderIngest(stuck.db as any, BIZ, [INV_A]);
  ok(rs.errors.some(e => /could not be removed/.test(e.message) && /has no lines on it/.test(e.message)),
     'J8 a rollback that itself fails says so AND names the order to delete by hand — never a silent half-state');
  ok(rs.ordersWritten === 1,
     'J9 🔴 and the count still reports the order that IS in the table — a failed rollback must not be counted as a clean one');
}

// ══ §L 🔴 THE PRIOR-ORDER GUARD — THE KEY IS BLIND TO THE OCR NINE ═════════
//
// LAWNS holds nine history orders transcribed from PHOTOGRAPHS. None carries a `qb_invoice_id`,
// so the idempotency key cannot see any of them, and an ingest keyed only on that column would
// create a SECOND order for every sale already captured — a duplicate in the seller's own revenue
// reporting, silent and permanent. This is the Thiry shape at nine times the size, and it is not
// theoretical: SEVEN of the eighteen future-dated invoices carry a TxnDate of 26 or 27 August,
// the window the nine were captured in, and SIX of those share ONE date.
{
  const prior = (over: any = {}) => ({
    id: 'ord-ocr-1', customer_id: 'cust-d1', sale_date: '2026-08-27',
    total_amount: 2495.16, source_document_number: '3648.634', order_kind: 'history', ...over,
  });
  const invoiceFacts = (over: any = {}) => ({
    docNumber: '3648.634', customerId: 'cust-d1', saleDate: '2026-08-27', total: 2495.16, ...over,
  });

  // ── ① THEIR OWN DOCUMENT NUMBER IS AN IDENTITY ───────────────────────────
  const same = matchPriorHistoryOrder(invoiceFacts(), [prior()]);
  ok(same.kind === 'same-invoice', 'L1 🔴 their own document number + all three corroborating = the SAME SALE, not a new order');
  ok(same.kind === 'same-invoice' && same.orderId === 'ord-ocr-1', 'L1b and it names the order that already holds it');

  ok(matchPriorHistoryOrder(invoiceFacts({ docNumber: ' 3648.634 ' }), [prior()]).kind === 'same-invoice',
     'L2 document numbers are compared as a human types them — trimmed');
  ok(matchPriorHistoryOrder(invoiceFacts(), [prior({ source_document_number: '3648.634 ' })]).kind === 'same-invoice',
     'L2b from either side');

  // Money in CENTS — a float tail must not turn an identity into a "probable" on some invoices.
  ok(matchPriorHistoryOrder(invoiceFacts({ total: 2495.1600000000003 }), [prior()]).kind === 'same-invoice',
     'L3 money is compared in cents, so a floating-point tail is not a business disagreement');

  // ── ② A CONTRADICTION STOPS. IT DOES NOT RECONCILE. ──────────────────────
  const clash = matchPriorHistoryOrder(invoiceFacts(), [prior({ total_amount: 2000 })]);
  ok(clash.kind === 'probable', 'L4 🔴 same document number, DIFFERENT money → REPORT, never record an id over a disagreement');
  ok(clash.kind === 'probable' && /amount DIFFER/.test(clash.evidence), 'L4b and the evidence names WHICH field disagreed');
  ok(matchPriorHistoryOrder(invoiceFacts(), [prior({ customer_id: 'someone-else' })]).kind === 'probable',
     'L5 same document number, different customer → REPORT');
  ok(matchPriorHistoryOrder(invoiceFacts(), [prior({ sale_date: '2026-08-26' })]).kind === 'probable',
     'L6 same document number, different date → REPORT');

  // ── ③ TWO CANDIDATES ARE NEVER PICKED BETWEEN ────────────────────────────
  const two = matchPriorHistoryOrder(invoiceFacts(), [prior(), prior({ id: 'ord-ocr-2' })]);
  ok(two.kind === 'ambiguous', 'L7 🔴 two orders carrying the same document number → REPORT, never pick');
  ok(two.kind === 'ambiguous' && !('orderId' in two), 'L7b and an ambiguous verdict names no order to write to');

  // ── ④ NO DOCUMENT NUMBER — DAVID'S THREE FIELDS, AND THEY ONLY EVER STOP ──
  const noDoc = matchPriorHistoryOrder(invoiceFacts(), [prior({ source_document_number: null })]);
  ok(noDoc.kind === 'probable',
     'L8 🔴 customer + date + amount all agreeing is enough to STOP — and NOT enough to record an id. An inference that writes a key is permanent.');
  const twoOfThree = matchPriorHistoryOrder(invoiceFacts(), [prior({ source_document_number: null, total_amount: 999 })]);
  ok(twoOfThree.kind === 'probable', 'L9 two of the three agreeing still stops — a false stop costs a line on a screen, a duplicate sale is permanent');
  const oneOfThree = matchPriorHistoryOrder(invoiceFacts(), [prior({ source_document_number: null, total_amount: 999, sale_date: '2020-01-01' })]);
  ok(oneOfThree.kind === 'none', 'L10 NEGATIVE CONTROL — customer alone is NOT a match, or every invoice for a repeat customer would block');
  ok(matchPriorHistoryOrder(invoiceFacts(), []).kind === 'none', 'L11 with nothing to collide with, the invoice proceeds normally');

  // 🔴 A NULL MUST NOT CORROBORATE. Two orders that both lack a date have not matched on date.
  const nullish = matchPriorHistoryOrder(
    invoiceFacts({ docNumber: null, saleDate: null, total: null }),
    [prior({ source_document_number: null, sale_date: null, total_amount: null })]);
  ok(nullish.kind === 'none',
     'L12 🔴 nulls on both sides are UNKNOWN, never agreement — otherwise every empty order would match every invoice (A9: absent is not empty)');

  // 🔴 THE SIX-SAME-DAY CASE, WHICH IS THE ONE THAT ACTUALLY EXISTS IN THEIR BOOKS.
  const sixSameDay = [
    prior({ id: 'a', source_document_number: null, total_amount: 4864.21 }),
    prior({ id: 'b', source_document_number: null, total_amount: 2495.16 }),
    prior({ id: 'c', source_document_number: null, total_amount: 2652.13 }),
  ];
  const picked = matchPriorHistoryOrder(invoiceFacts({ docNumber: null, total: 2495.16 }), sixSameDay);
  ok(picked.kind === 'ambiguous',
     'L13 🔴 three same-customer same-day orders and an exact amount match on ONE of them is STILL ambiguous — the other two agree on 2 of 3, and picking is how the wrong pair gets cross-linked (#53)');

  // A CHECKOUT order with no invoice id is a candidate too, and the evidence says which it is.
  const checkout = matchPriorHistoryOrder(invoiceFacts({ docNumber: null }), [prior({ source_document_number: null, order_kind: null })]);
  ok(checkout.kind === 'probable' && /a checkout order/.test(checkout.evidence),
     'L14 an ordinary checkout order with no invoice id is also a candidate, and the evidence says which kind it is');
}

// ══ §M THE GUARD END-TO-END — NOTHING IS DUPLICATED, NOTHING IS SILENT ═════
{
  // The OCR order for invoice 10436 / #3648.634, exactly as the backfill wrote it: no invoice id.
  const OCR = { id: 'ord-ocr', business_id: BIZ, qb_invoice_id: null, customer_id: 'cust-d2',
                sale_date: '2026-08-27', total_amount: 2495.16, source_document_number: '3648.634',
                order_kind: 'history' };
  const INV_OCR = inv('10436', '3648.634', '2026-08-27', [
    salesLine('Myrtle:WM45', 'Wax Myrtle - 45 gallon (Install & Warranty)', 2, 1062.5, 2125),
    salesLine('TB', 'Tree Bubbler', 2, 65, 130),
    salesLine('TC', 'Trip Charge', 1, 50, 50),
    subtotalLine(2305),
  ], 190.16, 2495.16);

  const { db, store, patches } = makeDb({
    deliveries: [stop('d1', '10587'), stop('d2', '10436')],
    orders: [OCR], lots: LOTS,
  });

  const preview = await previewOrderIngest(db, BIZ, [INV_A, INV_OCR]);
  ok(preview.planned.length === 1 && preview.planned[0].invoiceId === '10587',
     'M1 🔴 only the invoice with NO prior order is planned — the OCR one is not');
  ok(preview.priorOrders.length === 1 && preview.priorOrders[0].kind === 'same-invoice',
     'M2 and the collision is REPORTED on the preview, before anything is written — never silent');
  ok(preview.priorOrders[0].orderId === 'ord-ocr' && /doc #3648.634/.test(preview.priorOrders[0].evidence),
     'M3 naming the order it found and the evidence it matched on');
  ok(store.orders.length === 1, 'M4 the preview wrote nothing at all');

  const r = await commitOrderIngest(db, BIZ, [INV_A, INV_OCR]);
  ok(r.ordersWritten === 1, 'M5 🔴 ONE order created, not two — the duplicate sale did not happen');
  ok(store.orders.length === 2, 'M6 and the table holds the OCR order plus exactly one new one');
  ok(r.idsRecorded === 1, 'M7 the existing order had the invoice id RECORDED on it');
  ok(store.orders.find(o => o.id === 'ord-ocr').qb_invoice_id === '10436',
     'M8 so every future run skips it for the RIGHT reason instead of re-deriving the match');
  ok(store.orders.find(o => o.id === 'ord-ocr').total_amount === 2495.16,
     'M9 🔴 and its MONEY is untouched — the captured order is the record of that sale');
  const ocrPatch = patches.filter(p => p.table === 'orders');
  ok(ocrPatch.length === 1 && Object.keys(ocrPatch[0].patch).sort().join(',') === 'qb_doc_number,qb_invoice_id',
     'M10 🔴 exactly TWO columns are written on somebody else\'s order, and they are both identifiers');
  ok(store.deliveries.find(d => d.id === 'd2').order_id === 'ord-ocr',
     'M11 and the stop is joined to the order that already existed — its load was there all along');
  ok(r.availabilityUnchanged === true, 'M12 available-to-sell still did not move');

  // Run it again: nothing at all.
  const second = await commitOrderIngest(db, BIZ, [INV_A, INV_OCR]);
  ok(second.ordersWritten === 0 && second.idsRecorded === 0, 'M13 the second run writes nothing and records nothing');
  ok(store.orders.length === 2, 'M14 🔴 still two orders — the id it recorded is what makes the second run cheap and correct');

  // 🔴 THE CANDIDATE SET IS DECIDED BY THE READ, AND THE READ MUST NOT FILTER ON `order_kind`.
  // Added after a mutant SURVIVED: restricting `priors` to `order_kind === 'history'` broke
  // nothing, because §L feeds the matcher its candidates directly and could not see the read.
  // An ordinary CHECKOUT order that was never pushed also carries no `qb_invoice_id`, so it is
  // equally invisible to the key and equally duplicable — and at LAWNS a walk-in rung up at the
  // counter for a sale that was ALSO invoiced in QuickBooks is exactly that shape.
  {
    const CHECKOUT = { id: 'ord-checkout', business_id: BIZ, qb_invoice_id: null,
                       customer_id: 'cust-d2', sale_date: '2026-08-27', total_amount: 2495.16,
                       source_document_number: null, order_kind: null };
    const co = makeDb({ deliveries: [stop('d2', '10436')], orders: [CHECKOUT], lots: LOTS });
    const rco = await commitOrderIngest(co.db, BIZ, [INV_OCR]);
    ok(rco.priorOrders.length === 1,
       'M19 🔴 a CHECKOUT order with no invoice id is a candidate too — the read must not filter on order_kind');
    ok(rco.ordersWritten === 0,
       'M20 🔴 and no second order is created for it — the duplication hazard is the MISSING ID, not the kind');
    ok(rco.priorOrders[0].kind === 'probable' && /a checkout order/.test(rco.priorOrders[0].evidence),
       'M21 it is reported as unproven (no document number to anchor it) and the evidence says which kind it is');
    ok(co.store.orders[0].qb_invoice_id === null, 'M22 and nothing was written to it');
  }

  // 🔴 A `probable` VERDICT WRITES NOTHING AT ALL — not an order, not an id.
  const clash = makeDb({
    deliveries: [stop('d2', '10436')],
    orders: [{ ...OCR, total_amount: 9999 }], lots: LOTS,
  });
  const rc = await commitOrderIngest(clash.db, BIZ, [INV_OCR]);
  ok(rc.ordersWritten === 0, 'M15 🔴 a document number matching over DIFFERENT money creates no order');
  ok(rc.idsRecorded === 0 && clash.store.orders[0].qb_invoice_id === null,
     'M16 🔴 and records no id — a disagreement is not reconciled, it is reported');
  ok(rc.priorOrders.length === 1 && rc.priorOrders[0].kind === 'probable', 'M17 and it comes back on the report for David');
  ok(clash.store.deliveries[0].order_id === null, 'M18 the stop is left unjoined rather than pointed at an order we could not verify');
}

// ══ §K SOURCE + MIGRATION PROBES ═══════════════════════════════════════════
{
  const srcTxt = readFileSync(join(process.cwd(), 'packages/shared/src/quickbooks/historyOrderWriter.ts'), 'utf8');
  ok(/business_inventory_id: l\.businessInventoryId/.test(srcTxt),
     'K1 the writer maps the null through rather than omitting the column — an omitted column is a DEFAULT, and a default is not a decision');
  ok(!/from\('business_inventory'\)[\s\S]{0,120}\.(insert|update|upsert|delete)/.test(srcTxt),
     'K2 no write verb is ever issued against business_inventory in this file');
  ok(/onConflict: 'business_id,qb_invoice_id'/.test(srcTxt), 'K3 the conflict target is the two columns the migration indexes');

  // 🔴 THE MIGRATION CORPUS, READ FROM DISK. A predicate on this index would break the ingest on
  // every row, exactly as it did on 2026-08-31 — so the corpus itself is asserted, not a comment.
  const dir = join(process.cwd(), 'supabase/migrations');
  const creating = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ f, text: readFileSync(join(dir, f), 'utf8') }))
    .filter(x => /CREATE UNIQUE INDEX[\s\S]{0,200}uidx_orders_business_qb_invoice/i.test(x.text));
  ok(creating.length === 1, `K4 exactly one migration creates the orders idempotency index — got ${creating.length}`);
  const stmt = (creating[0]?.text ?? '').match(/CREATE UNIQUE INDEX[^;]*uidx_orders_business_qb_invoice[^;]*;/i)?.[0] ?? '';
  ok(/ON public\.orders \(business_id, qb_invoice_id\)/.test(stmt), 'K5 on exactly (business_id, qb_invoice_id)');
  ok(!/\bWHERE\b/i.test(stmt),
     'K6 🔴 and with NO predicate — a partial unique index is UNINFERABLE from PostgREST\'s column-list onConflict');
  ok(/\bWHERE\b/i.test('CREATE UNIQUE INDEX x ON public.orders (a, b) WHERE b IS NOT NULL;'),
     'K6b and the probe DOES fire on a predicate — verified to bite, not assumed to');
}

console.log(`\n  historyOrderWriter — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
}

void run();
