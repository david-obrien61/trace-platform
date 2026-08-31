/**
 * ── deliveryIngestWriter — what it writes, and the very short list of what it may touch ──
 *
 * 🔴 §E IS THE SECTION THIS FILE EXISTS FOR, AND IT IS THE ACCEPTANCE CRITERION IN CODE.
 * "Zero orders, zero order_items, zero inventory rows touched" and "available-to-sell is
 * byte-identical before and after" are both claims about a TABLE SET. A recording client
 * captures every table the ingest reaches and every verb it uses, and §E asserts the whole set
 * — so the claim is measured rather than reasoned about. The file header states the same
 * boundary in prose; R-26 has thirteen instances of a prose boundary being false the day it was
 * written, and this is the check that a fourteenth would fail.
 *
 * 🔴 §B IS THE THIRTY-SIX-STOP TEST. Running the ingest twice must write eighteen rows once.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/deliveryIngestWriter.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { previewDeliveryIngest, commitDeliveryIngest } from './deliveryIngestWriter';
import type { QboShipmentRow, QboAddr } from './shipmentIngest';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

const freeform = (l1: string, l2: string, l3: string, l4: string): QboAddr =>
  ({ line1: l1, line2: l2, line3: l3, line4: l4, line5: null, city: null, state: null, zip: null });

const inv = (id: string, name: string, date: string, street: string): QboShipmentRow => ({
  id, docNumber: `D${id}`, shipDate: date, txnDate: '2026-08-01', totalAmt: 6600,
  customerId: `QB${id}`, customerName: name,
  shipAddr: freeform(name, '(512) 555-0100', street, 'Leander, TX 78641'), billAddr: null,
});

/**
 * A recording Supabase stand-in. It answers reads from `tables` and RECORDS every touch, so a
 * test can assert not only what was written but what was REACHED — including a table nobody
 * expected the ingest to open.
 */
/**
 * 🔴 THE INDEX MODEL — ADDED 2026-08-31 AFTER THE INGEST FAILED ON ALL 19 ROWS LIVE.
 *
 * The first version of this stub accepted ANY `onConflict` string unconditionally, so it was
 * strictly more forgiving than Postgres and **no test in this file could have caught the defect
 * that actually shipped**: the unique index was created PARTIAL (`WHERE qb_invoice_id IS NOT
 * NULL`), and Postgres can only infer a partial index when the ON CONFLICT clause repeats the
 * predicate — which PostgREST's column-list `onConflict` cannot express. Every row died with
 * *"there is no unique or exclusion constraint matching the ON CONFLICT specification"*.
 *
 * A fake that cannot fail the way the real thing fails is not a test double, it is a rubber
 * stamp. So the stub now carries the index as DATA and refuses exactly as Postgres would.
 * `indexes` is the shape of the CURRENT migration corpus; flipping `partial` to true reproduces
 * the live failure, which is what §K asserts.
 */
interface FakeIndex { table: string; columns: string[]; partial: boolean }
const REAL_INDEXES: FakeIndex[] = [
  // 20260831_deliveries_qb_invoice_id.sql, as CORRECTED by 20260831b (predicate dropped).
  { table: 'deliveries', columns: ['business_id', 'qb_invoice_id'], partial: false },
];

function makeDb(seed: { customers?: any[]; deliveries?: any[]; hasColumn?: boolean; indexes?: FakeIndex[] } = {}) {
  const indexes = seed.indexes ?? REAL_INDEXES;
  const store: Record<string, any[]> = {
    customers:  [...(seed.customers ?? [])],
    deliveries: [...(seed.deliveries ?? [])],
    people:     [],
  };
  const hasColumn = seed.hasColumn !== false;
  const touched: { table: string; verb: string }[] = [];
  let nextId = 1;

  function from(table: string) {
    const q: any = {
      _table: table, _filters: [] as [string, any][], _rows: null as any,
      select(cols: string) {
        touched.push({ table, verb: 'select' });
        if (table === 'deliveries' && !hasColumn && /qb_invoice_id/.test(cols)) {
          q._error = { code: '42703', message: 'column deliveries.qb_invoice_id does not exist' };
        }
        return q;
      },
      eq(col: string, val: any) { q._filters.push([col, val]); return q; },
      neq(col: string, val: any) { q._filters.push(['__neq:' + col, val]); return q; },
      not() { q._filters.push(['__notnull', true]); return q; },
      limit() { return q._resolve(); },
      maybeSingle() { const r = q._resolve(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      single() { const r = q._resolve(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      insert(row: any) {
        touched.push({ table, verb: 'insert' });
        const withId = { id: `${table}-${nextId++}`, ...row };
        store[table].push(withId);
        q._inserted = withId; return q;
      },
      upsert(row: any, opts: any) {
        touched.push({ table, verb: 'upsert' });
        // 🔴 INFERENCE, MODELLED. `onConflict` names columns; Postgres must find a unique index
        // on exactly those columns AND WITHOUT A PREDICATE, because a column list cannot repeat
        // one. No match → the exact error the live run returned, 19 times.
        const named: string[] = String(opts?.onConflict ?? '').split(',').map((c: string) => c.trim()).filter(Boolean);
        if (named.length > 0) {
          const inferable = indexes.some(ix =>
            ix.table === table && !ix.partial &&
            ix.columns.length === named.length && ix.columns.every((c, i) => c === named[i]));
          if (!inferable) {
            q._error = { code: '42P10',
              message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' };
            return q;
          }
        }
        const dup = store[table].some(r =>
          r.business_id === row.business_id && r.qb_invoice_id === row.qb_invoice_id && row.qb_invoice_id != null);
        if (dup && opts?.ignoreDuplicates) { q._inserted = null; return q; }
        const withId = { id: `${table}-${nextId++}`, ...row };
        store[table].push(withId);
        q._inserted = withId; return q;
      },
      update(patch: any) {
        touched.push({ table, verb: 'update' });
        q._patch = patch; return q;
      },
      _resolve() {
        if (q._error) return { data: null, error: q._error };
        let rows = store[table].filter(r => q._filters.every(([c, v]: [string, any]) => {
          if (c === '__notnull') return r.qb_invoice_id != null;
          if (c.startsWith('__neq:')) return r[c.slice(6)] !== v;
          return r[c] === v;
        }));
        if (q._patch) { rows.forEach(r => Object.assign(r, q._patch)); }
        if (q._inserted !== undefined) rows = q._inserted ? [q._inserted] : [];
        return { data: rows, error: null };
      },
      then(res: any, rej: any) { return Promise.resolve(q._resolve()).then(res, rej); },
    };
    return q;
  }
  return { db: { from }, store, touched };
}

const TODAY = '2026-08-31';
const THREE = [
  inv('1', 'Lydia Yustman', '2026-10-17', '105 Out Crop View Lane'),
  inv('2', 'Robert Dees',   '2026-10-03', '900 Bagdad Rd'),
  inv('3', 'Inez Vance',    '2026-09-05', '77 Cypress Cove'),
];

// The runner bundles to CJS (scripts/run-tests.mjs), where top-level await is unavailable —
// so every section lives inside one async main rather than each becoming its own IIFE.
async function main() {
// ══ §A PREVIEW WRITES NOTHING ══════════════════════════════════════════════
{
  const { db, store, touched } = makeDb();
  const r = await previewDeliveryIngest(db, BIZ, THREE, TODAY);
  ok(r.ok, 'with the column present, the preview is ready');
  ok(r.stops.length === 3 && r.refusals.length === 0, 'all three plan cleanly');
  ok(r.written === 0 && store.deliveries.length === 0 && store.customers.length === 0,
     '🔴 THE PREVIEW WRITES NOTHING — not a delivery, not a customer');
  ok(!touched.some(t => t.verb === 'insert' || t.verb === 'upsert' || t.verb === 'update'),
     'and it issues no write VERB of any kind, on any table');
  ok(r.invoicesRead === 3 && r.futureShipDates === 3, 'the denominator and the selection are both reported');
  ok(r.stops.every(s => s.customerAction === 'create'), 'against an empty tenant every customer is new');
}

// ══ §B RUN IT TWICE ════════════════════════════════════════════════════════
{
  const { db, store, touched } = makeDb();
  const first = await commitDeliveryIngest(db, BIZ, THREE, TODAY);
  ok(first.written === 3, 'the first run writes three stops');
  ok(store.deliveries.length === 3, 'and three rows exist');
  ok(first.customersCreated === 3, 'with three new customers');

  // 🔴 THE SECOND RUN MUST NOT EVEN TRY. Found by a mutant: with the `alreadyIngested` skip
  // deleted, `written` was STILL 0 — because the unique index caught every duplicate. The
  // guarantee held, but the TEST could not tell the code from the index, and the index does not
  // exist until David applies the migration. So the attempt itself is what gets asserted.
  const beforeSecond = touched.filter(t => t.table === 'deliveries' && t.verb === 'upsert').length;
  const second = await commitDeliveryIngest(db, BIZ, THREE, TODAY);
  const afterSecond = touched.filter(t => t.table === 'deliveries' && t.verb === 'upsert').length;
  ok(afterSecond === beforeSecond,
     '🔴 THE SECOND RUN ISSUES NO WRITE AT ALL — not one refused by the index, but none attempted. The code must carry this on its own, because the index does not exist until the migration is applied');
  ok(second.written === 0,
     '🔴 THE SECOND RUN WRITES NOTHING. Without this Lauren has thirty-six stops for eighteen invoices');
  ok(store.deliveries.length === 3, 'the row count is unchanged — this is the acceptance criterion, measured');
  ok(store.customers.length === 3, 'and no duplicate customers either');
  ok(second.alreadyIngested === 3, 'and the report SAYS all three were already there rather than silently doing nothing');

  // A fourth invoice appears later: the ingest picks up only the new one.
  const four = [...THREE, inv('4', 'Sam Ortiz', '2026-09-20', '12 Quarry Path')];
  const third = await commitDeliveryIngest(db, BIZ, four, TODAY);
  ok(third.written === 1 && store.deliveries.length === 4,
     'a later run writes ONLY what is new — the ingest is re-runnable forever, not a one-shot script');
}

// ══ §C WHAT A DELIVERY ROW GETS ════════════════════════════════════════════
{
  const { db, store } = makeDb();
  await commitDeliveryIngest(db, BIZ, [THREE[0]], TODAY);
  const row = store.deliveries[0];
  ok(row.delivery_date === '2026-10-17', 'delivery_date is the ShipDate');
  ok(row.address_line1 === '105 Out Crop View Lane' && row.city === 'Leander' && row.state === 'TX' && row.zip === '78641',
     'the parsed ship-to lands in the four address columns');
  ok(row.status === 'scheduled', 'status is scheduled');
  ok(row.source === 'qbo-shipdate', 'source names this ingest, so these rows stay distinguishable from Lauren\'s own');
  ok(row.qb_invoice_id === '1', 'and it carries the QuickBooks invoice id — the whole idempotency key');
  ok(/D1/.test(row.notes), 'the note names the invoice it came from');
  ok(row.customer_id === store.customers[0].id, 'it is attached to the resolved customer');

  // 🔴 THE FOUR ABSENCES, EACH ASSERTED BY NAME.
  ok(!('order_id' in row), '🔴 NO order_id — there is no order and we are not making one');
  ok(!('business_inventory_id' in row),
     '🔴 NO business_inventory_id — committed stock is DERIVED from open orders, so a future-dated row pointing at a lot would silently reduce what LAWNS can sell (the D-52 landmine)');
  ok(!('service_type' in row),
     '🔴 NO service_type — an invoice does not say whether a stop is a planting or a drop-off, and a guessed crew is worse than an unset field (D-9)');
  ok(store.customers[0].phone === '(512) 555-0100',
     '🔴 THE PHONE IS CARRIED ONTO THE CUSTOMER — it is the call-ahead number and it came free with the address');
  ok(store.customers[0].qb_customer_id === 'QB1', 'and the QuickBooks customer id is stored, so the next run links instead of guessing');
  ok(!('address_line1' in store.customers[0]) || store.customers[0].address_line1 === undefined,
     '⚠️ the SHIP-TO is NOT written onto the customer — that column is the BILLING address, and a ship-to varies per job site');
}

// ══ §D THE MIGRATION PRECONDITION ══════════════════════════════════════════
{
  const { db, store } = makeDb({ hasColumn: false });
  const r = await commitDeliveryIngest(db, BIZ, THREE, TODAY);
  ok(!r.ok && !!r.blocker, '🔴 without the migration the ingest REFUSES rather than writing rows it cannot recognise next time');
  ok(/20260831_deliveries_qb_invoice_id/.test(r.blocker!), 'and the refusal NAMES the migration, so the blocker is actionable rather than mysterious');
  ok(store.deliveries.length === 0 && store.customers.length === 0, 'and nothing at all was written');
  ok(r.written === 0, 'the report agrees with the store');
}

// ══ §E 🔴 THE TABLE BOUNDARY — the acceptance criterion, measured ═══════════
{
  const { db, touched } = makeDb();
  await commitDeliveryIngest(db, BIZ, THREE, TODAY);
  const written = [...new Set(touched.filter(t => t.verb !== 'select').map(t => t.table))].sort();
  const read    = [...new Set(touched.map(t => t.table))].sort();

  ok(JSON.stringify(written) === JSON.stringify(['customers', 'deliveries']),
     `🔴 EXACTLY TWO TABLES ARE WRITTEN — customers and deliveries. Got: ${written.join(', ')}`);

  const FORBIDDEN = ['orders', 'order_items', 'order_addons', 'order_service_selections',
                     'business_inventory', 'inventory_counts', 'inventory_ledger', 'plants',
                     'plant_events', 'lots', 'cost_objects', 'business_pricing_config'];
  for (const t of FORBIDDEN) {
    ok(!read.includes(t),
       `🔴 ${t} is never even READ, let alone written — available-to-sell cannot move because nothing this ingest touches is an input to it`);
  }
  // The people table is reached by the shared customer upsert's person spine, which is correct
  // and is named here so the boundary above reads as EXHAUSTIVE rather than as an oversight.
  ok(read.includes('customers') && read.includes('deliveries'), 'the two it does write, it also reads first');
}

// ══ §F CUSTOMER RESOLUTION THROUGH THE SHARED PATH ═════════════════════════
{
  const existing = [{ id: 'cust-existing', business_id: BIZ, qb_customer_id: 'QB1',
                      first_name: 'Lydia', last_name: 'Yustman', phone: '(512) 111-2222' }];
  const { db, store } = makeDb({ customers: existing });
  const r = await commitDeliveryIngest(db, BIZ, [THREE[0]], TODAY);
  ok(r.customersLinked === 1 && r.customersCreated === 0,
     '🔴 a customer already carrying the QuickBooks id is LINKED, not duplicated');
  ok(store.customers.length === 1, 'and no second row appears');
  ok(store.deliveries[0].customer_id === 'cust-existing', 'the stop attaches to the existing customer');
  ok(store.customers[0].phone === '(512) 111-2222',
     '🔴 FILL, NEVER CLOBBER — a phone already on the record survives the ingest; the ship-to number does not overwrite a curated one');
}

// ══ §G AMBIGUITY IS REPORTED, NOT MERGED ═══════════════════════════════════
{
  const twins = [
    { id: 'a', business_id: BIZ, qb_customer_id: null, first_name: 'Lydia', last_name: 'Yustman' },
    { id: 'b', business_id: BIZ, qb_customer_id: null, first_name: 'Lydia', last_name: 'Yustman' },
  ];
  const { db, store } = makeDb({ customers: twins });
  const r = await commitDeliveryIngest(db, BIZ, [THREE[0]], TODAY);
  ok(r.refusals.some(x => /matches 2 existing customers/.test(x.reason)),
     '🔴 two customers of the same name → REPORTED for Lauren, never merged. A wrong merge is silent and permanent');
  ok(store.deliveries.length === 0, 'and the stop is NOT written on a guess');
  ok(store.customers.length === 2, 'and no third row is created either — refusing means refusing');
}

// ══ §H A BAD ROW COSTS ONLY ITSELF ═════════════════════════════════════════
{
  const bad = { ...inv('9', 'Nobody', '2026-09-09', 'x'), shipAddr: freeform('Nobody', '(512) 555-0100', 'Attn: back gate', 'Leander, TX 78641') };
  const { db, store } = makeDb();
  const r = await commitDeliveryIngest(db, BIZ, [...THREE, bad], TODAY);
  ok(r.written === 3, '🔴 one unreadable row does not cost Lauren the other three');
  ok(r.refusals.length === 1 && r.refusals[0].invoiceId === '9', 'and the one that failed is named, with its reason');
  ok(store.deliveries.length === 3, 'three stops are on the calendar');
}
}

// ══ §I 🔴 ONE-TIME SEED, NOT A SYNC — THE THIRY CASE ═══════════════════════
// Lauren moved Ariel Thiry to 19 September in the app and did not touch the invoice, which
// still reads 2 September. HER VALUE IS THE CORRECT ONE. Two things must both hold: her row is
// not rewritten, AND no second Thiry stop appears beside it.
async function thiry() {
  const thiryInvoice = inv('622', 'Ariel Thiry', '2026-09-02', '4 Cedar Elm Way');
  const existingCustomer = { id: 'cust-thiry', business_id: BIZ, qb_customer_id: 'QB622',
                             first_name: 'Ariel', last_name: 'Thiry' };
  // 🔴 HAND-ENTERED: no qb_invoice_id. The idempotency key CANNOT see this row.
  const herRow = { id: 'del-thiry', business_id: BIZ, customer_id: 'cust-thiry',
                   delivery_date: '2026-09-19', status: 'scheduled', qb_invoice_id: null };
  const { db, store, touched } = makeDb({ customers: [existingCustomer], deliveries: [herRow] });

  const r = await commitDeliveryIngest(db, BIZ, [thiryInvoice], TODAY);
  ok(store.deliveries.length === 1,
     '🔴 NO SECOND THIRY STOP. Her row carries no invoice id, so the key cannot see it — the customer check is what stops the duplicate, and a duplicate stop is a second truck');
  ok(store.deliveries[0].delivery_date === '2026-09-19',
     '🔴 HER DATE STANDS. 19 September, not the invoice\'s 2 September — Cultivar owns the delivery date, QuickBooks owns the money');
  ok(!touched.some(t => t.table === 'deliveries' && t.verb === 'update'),
     '🔴 NO UPDATE VERB IS EVER ISSUED AGAINST deliveries — this is a seed, not a sync, asserted rather than described');
  ok(r.written === 0, 'and nothing was written on this run');

  ok(r.conflicts.length === 1, 'the untouched stop is REPORTED rather than silently skipped');
  const c = r.conflicts[0];
  ok(c.customerName === 'Ariel Thiry' && c.appDate === '2026-09-19' && c.quickbooksDate === '2026-09-02',
     'and the report carries BOTH dates — the app value and the stale invoice value, side by side');
  ok(c.differs === true, 'flagged as a difference, so it is not lost among the stops that simply already exist');

  // The same customer with an AGREEING date: still left alone, still reported, `differs` false.
  const agree = { ...herRow, delivery_date: '2026-09-02' };
  const two = makeDb({ customers: [existingCustomer], deliveries: [agree] });
  const r2 = await commitDeliveryIngest(two.db, BIZ, [thiryInvoice], TODAY);
  ok(r2.written === 0 && two.store.deliveries.length === 1, 'an existing stop on the SAME day is also left alone rather than doubled');
  ok(r2.conflicts.length === 1 && r2.conflicts[0].differs === false,
     'and it is reported with differs:false — a stop that already exists is not a disagreement');

  // A cancelled stop must NOT block a real one — it is not work on the calendar.
  const cancelled = { ...herRow, status: 'cancelled' };
  const three = makeDb({ customers: [existingCustomer], deliveries: [cancelled] });
  const r3 = await commitDeliveryIngest(three.db, BIZ, [thiryInvoice], TODAY);
  ok(r3.written === 1,
     'a CANCELLED stop does not block the ingest — it is not work on the calendar, and treating it as one would silently drop a real delivery');
}


// ══ §J 🔴 THE RETRY AFTER A PARTIAL RUN — 19 CUSTOMERS, 0 STOPS ════════════
// The live failure left the tenant in exactly this state: every customer created, not one
// delivery written. David's first question is the right one — does the retry MATCH those
// nineteen, or mint a second set? A second set would be worse than the original failure.
async function retryAfterPartialRun() {
  const invoices = Array.from({ length: 19 }, (_, i) =>
    inv(String(100 + i), `Customer ${i}`, '2026-09-05', `${100 + i} Test Road`));

  // The tenant as the failed run left it: 19 customers each carrying their QuickBooks id,
  // and ZERO deliveries.
  const strandedCustomers = invoices.map((iv, i) => ({
    id: `cust-${i}`, business_id: BIZ, qb_customer_id: iv.customerId,
    first_name: `Customer`, last_name: String(i),
  }));
  const { db, store } = makeDb({ customers: strandedCustomers, deliveries: [] });

  ok(store.customers.length === 19, 'precondition: 19 stranded customers, no stops');
  ok(store.deliveries.length === 0, 'precondition: zero deliveries');

  const r = await commitDeliveryIngest(db, BIZ, invoices, TODAY);

  ok(r.customersCreated === 0,
     '🔴 THE RETRY CREATES NO CUSTOMERS. Not one. A second set of 19 would be worse than the failure that stranded the first');
  ok(r.customersLinked === 19,
     '🔴 ALL NINETEEN ARE MATCHED — on qb_customer_id, the id QuickBooks itself assigned, which is why the match is not an inference');
  ok(store.customers.length === 19, 'the customer table is the same size it was before the retry');
  ok(r.written === 19, 'and the nineteen stops that never landed now land');
  ok(store.deliveries.length === 19, 'nineteen deliveries exist');
  ok(store.deliveries.every(d => strandedCustomers.some(c => c.id === d.customer_id)),
     'every stop is attached to one of the EXISTING customer rows, not to a new one');

  // And the Thiry guard must NOT fire here: a stranded customer holds no live stop, so there is
  // nothing to protect and the stop must be written rather than reported as a conflict.
  ok(r.conflicts.length === 0,
     '🔴 the already-on-your-calendar guard does NOT misfire on a stranded customer — they hold no stop, so there is nothing to leave alone');

  // Idempotency still holds on the run AFTER the repair.
  const again = await commitDeliveryIngest(db, BIZ, invoices, TODAY);
  ok(again.written === 0 && store.deliveries.length === 19,
     'and the run after the repair writes nothing — the recovery did not cost idempotency');
}

// ══ §K 🔴 THE PARTIAL INDEX — the defect that shipped, now reproducible ════
// This section exists because NOTHING here could fail the way production failed. The stub was
// more forgiving than Postgres; it stamped any onConflict. Both directions are asserted.
async function partialIndexIsUninferable() {
  const PARTIAL = [{ table: 'deliveries', columns: ['business_id', 'qb_invoice_id'], partial: true }];
  const { db, store } = makeDb({ indexes: PARTIAL });
  const r = await commitDeliveryIngest(db, BIZ, THREE, TODAY);

  ok(r.written === 0 && store.deliveries.length === 0,
     '🔴 THE LIVE DEFECT, REPRODUCED: with the index PARTIAL, not one stop is written');
  ok(r.errors.length === 3,
     'and every row reports its own failure rather than one row failing silently for all');
  ok(r.errors.every(e => /ON CONFLICT specification/.test(e.message)),
     'the reported message is the one Postgres actually returns, not a paraphrase');
  ok(r.errors.every(e => e.step === 'delivery'),
     'attributed to the DELIVERY step — the customer step succeeded, which is exactly why the live run stranded 19 customers');

  // 🔴 THE NEGATIVE CONTROL. Same everything, predicate dropped → the run succeeds. Without this
  // the section above would pass for any reason at all, including a broken stub.
  const fixed = makeDb({ indexes: [{ table: 'deliveries', columns: ['business_id', 'qb_invoice_id'], partial: false }] });
  const ok2 = await commitDeliveryIngest(fixed.db, BIZ, THREE, TODAY);
  ok(ok2.written === 3 && ok2.errors.length === 0,
     '🔴 NEGATIVE CONTROL — dropping the predicate is what fixes it, and nothing else changed');

  // And an onConflict naming columns no index covers is refused too — the general rule, not a
  // special case carved for this one index.
  const wrong = makeDb({ indexes: [{ table: 'deliveries', columns: ['id'], partial: false }] });
  const r3 = await commitDeliveryIngest(wrong.db, BIZ, THREE, TODAY);
  ok(r3.written === 0, 'an onConflict that names columns no unique index covers is refused as well');
}


// ══ §L 🔴 THE CORPUS ITSELF — the predicate must not come back ═════════════
// §K proves the stub refuses a partial index. This asserts the REAL migration corpus does not
// declare one, because the stub's `REAL_INDEXES` is a hand-kept model and a hand-kept model of
// a schema is the thing that drifts. Read from disk, not from memory.
function corpusHasNoPartialPredicate() {
  const dir = 'supabase/migrations';
  let files: string[];
  try { files = readdirSync(dir).filter(f => f.endsWith('.sql')); }
  catch { ok(false, 'the migration corpus could not be read — this assertion must never silently pass'); return; }

  // Every CREATE ... INDEX statement mentioning our index name, in application order.
  const statements: { file: string; text: string }[] = [];
  for (const f of files.sort()) {
    const src = readFileSync(`${dir}/${f}`, 'utf8')
      .split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');   // comments are not schema
    for (const m of src.matchAll(/CREATE[^;]*?INDEX[^;]*?deliveries_business_qb_invoice_uidx[^;]*;/gis)) {
      statements.push({ file: f, text: m[0] });
    }
  }
  ok(statements.length >= 1, 'the corpus declares the delivery idempotency index at least once');

  // The LAST one wins — migrations apply in filename order and 20260831b drops-and-recreates.
  const winner = statements[statements.length - 1];
  ok(/20260831b/.test(winner.file),
     `the last word on this index comes from the corrective migration (got ${winner.file})`);
  ok(!/\bWHERE\b/i.test(winner.text),
     '🔴 THE INDEX THAT ACTUALLY APPLIES HAS NO WHERE PREDICATE. A partial one cannot be inferred by PostgREST\'s column-list onConflict, and re-introducing it fails every write on the ingest path');
  ok(/UNIQUE/i.test(winner.text) && /business_id/.test(winner.text) && /qb_invoice_id/.test(winner.text),
     'and it is still UNIQUE on exactly (business_id, qb_invoice_id) — the guarantee is unchanged, only the predicate is gone');

  // The original IS still partial, and that is correct: migrations are append-only and history
  // is not rewritten (§6 r1). Asserting it keeps the pair readable as the history it is.
  const first = statements[0];
  ok(/WHERE/i.test(first.text) && /20260831_/.test(first.file),
     'the ORIGINAL migration still carries its predicate — history is appended to, never edited');
}

main().then(thiry).then(retryAfterPartialRun).then(partialIndexIsUninferable).then(corpusHasNoPartialPredicate).then(() => {
  console.log(`\ndeliveryIngestWriter: ${passed} passed, ${failed} failed`);
  if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
}).catch((e) => { console.error('deliveryIngestWriter: threw —', e); process.exit(1); });
