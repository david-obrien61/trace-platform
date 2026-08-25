/**
 * ── CHECKOUT WRITES A SCHEDULED DELIVERY — asserted by COUNTING ROWS ──────────────────────────
 *
 * WHAT THIS GUARDS: that an order taken at the counter for delivery next Thursday actually
 * BECOMES a stop. Before 2026-08-25 `orders` and `deliveries` were unconnected: every row on
 * `/delivery-schedule` arrived through the OCR-invoice door, so a real order placed today
 * appeared on neither delivery screen. Measured on order
 * `9a3cbc8b-db56-49d6-bdd5-c07c9bcd2888` (transport_method `install`, delivery_date 2026-09-04):
 * present in `orders`, absent from every delivery surface.
 *
 * 🔴 WHY THIS COUNTS ROWS AND NEVER READS A STATUS. R-12 (2026-08-23): a PostgREST write that
 * matches ZERO rows returns SUCCESS WITH NO ERROR, so `!error` proves nothing. Every probe below
 * reads `db.rows.deliveries.length` — the observed artifact — before and after the call, and
 * asserts the row's CONTENT. Same discipline as `qboInvoiceLines.test.ts`: assert what landed,
 * never the self-report.
 *
 * THE FOUR CASES THE BUILD PROMISED, each a row count:
 *     delivery                     → exactly ONE new row, service_type 'delivery_only'
 *     install                      → exactly ONE new row, service_type 'planting'
 *     self                         → ZERO new rows
 *     the write forced to fail     → ZERO new rows AND the call returns rather than throwing
 *                                    (the order completes; a scheduling row may never kill a sale)
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/cultivar-os/api/orders/checkoutDelivery.test.ts \
 *     --bundle --platform=node --format=cjs --external:@supabase/supabase-js | node
 */

import { scheduleCheckoutDelivery, deliveryServiceType } from './submit';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// ── THE FAKE DATABASE ────────────────────────────────────────────────────────────────────────
// A minimal PostgREST-shaped stub whose ONLY job is to let a test count rows. `mode` reproduces
// the three real failure shapes: an error object, a zero-row success (the R-12 case — the shape
// PostgREST returns for a write RLS refused), and a thrown exception (a dead network).
type Mode = 'ok' | 'error' | 'zero_rows' | 'two_rows' | 'throws' | 'null_data';

function fakeDb(mode: Mode = 'ok') {
  const rows: Record<string, any[]> = { deliveries: [] };
  let inserts = 0;
  let nextId = 1;
  return {
    rows,
    get inserts() { return inserts; },
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          return {
            select(_cols: string) {
              inserts++;
              if (mode === 'throws') throw new Error('fetch failed');
              if (mode === 'error')  return Promise.resolve({ data: null, error: { message: 'permission denied for table deliveries', code: '42501' } });
              // 🔴 THE R-12 CASE — success, no error, and NOTHING WAS WRITTEN.
              if (mode === 'zero_rows') return Promise.resolve({ data: [], error: null });
              if (mode === 'null_data') return Promise.resolve({ data: null, error: null });
              // Not a hypothetical shape — it is the OTHER half of the count check. `rows[0].id`
              // exists here, so a build that only guards "is there a first row?" reports SUCCESS
              // over a write that affected more rows than it intended.
              if (mode === 'two_rows') return Promise.resolve({ data: [{ id: 'del-a' }, { id: 'del-b' }], error: null });
              const stored = { ...row, id: `del-${nextId++}` };
              (rows[table] ||= []).push(stored);
              return Promise.resolve({ data: [{ id: stored.id }], error: null });
            },
          };
        },
      };
    },
  };
}

/** A customer carrying BOTH column families — canonical `billing_*` and the legacy mirror (D-41). */
const CUSTOMER_FULL = {
  billing_line1: '400 Honeycomb Mesa', billing_city: 'Leander', billing_state: 'TX', billing_zip: '78641',
  address_line1: '400 Honeycomb Mesa', city: 'Leander', state: 'TX', zip: '78641',
};
/** A customer whose address exists ONLY in the legacy mirror (never backfilled). */
const CUSTOMER_LEGACY_ONLY = {
  billing_line1: null, billing_city: null, billing_state: null, billing_zip: null,
  address_line1: '1100 Ranch Rd', city: 'Georgetown', state: 'TX', zip: '78626',
};

const BASE = {
  businessId: 'biz-1',
  customerId: 'cust-1',
  deliveryDate: '2026-09-04',
  invoiceNumber: 'CLV-20260825-1693',
  customerRow: CUSTOMER_FULL as Record<string, any>,
};

async function main(): Promise<void> {
  // ══ A. THE VOCABULARY — two words, and no third is invented ═══════════════════════════════════

  ok(deliveryServiceType('install')  === 'planting',      'A1 install → planting');
  ok(deliveryServiceType('delivery') === 'delivery_only', 'A2 delivery → delivery_only');
  ok(deliveryServiceType('self')     === null,            'A3 self → null (no stop)');
  ok(deliveryServiceType('')         === null,            'A4 an empty transport_method schedules nothing');
  ok(deliveryServiceType('DELIVERY') === null,            'A5 the match is exact — no case-folded near-miss silently schedules');
  {
    const words = new Set(['install', 'delivery', 'self', 'pickup', 'courier', 'freight']
      .map(deliveryServiceType).filter(Boolean));
    ok(words.size === 2 && words.has('planting') && words.has('delivery_only'),
      `A6 the whole vocabulary is exactly {planting, delivery_only} — got ${[...words].join(',')}`);
  }

  // ══ B. delivery → EXACTLY ONE NEW ROW ════════════════════════════════════════════════════════
  {
    const db = fakeDb();
    const before = db.rows.deliveries.length;
    ok(before === 0, 'B0 the fixture starts empty');

    const out = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'delivery' });
    const after = db.rows.deliveries.length;

    ok(after - before === 1, `B1 delivery → exactly ONE new row (got ${after - before})`);
    const r = db.rows.deliveries[0] ?? {};
    ok(r.service_type === 'delivery_only', `B2 service_type is 'delivery_only' (got ${r.service_type})`);
    ok(r.delivery_date === '2026-09-04',   `B3 the order's delivery_date lands verbatim (got ${r.delivery_date})`);
    ok(r.status === 'scheduled',           `B4 status is 'scheduled' (got ${r.status})`);
    ok(r.source === 'checkout',            `B5 source is 'checkout' — distinguishable from 'ocr-invoice' (got ${r.source})`);
    ok(r.notes === 'CLV-20260825-1693',    `B6 notes carries the invoice number (got ${r.notes})`);
    ok(r.business_id === 'biz-1' && r.customer_id === 'cust-1', 'B7 scoped to the order\'s business + customer');
    ok(r.address_line1 === '400 Honeycomb Mesa' && r.city === 'Leander' && r.state === 'TX' && r.zip === '78641',
      'B8 city/state/zip are SEPARATE columns, matching the seeded row shape');
    ok(out.scheduled === true && !!(out as any).deliveryId, 'B9 the outcome reports the id it was handed back');
  }

  // ══ C. install → EXACTLY ONE NEW ROW, service_type 'planting' ════════════════════════════════
  {
    const db = fakeDb();
    const out = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'install' });
    ok(db.rows.deliveries.length === 1, `C1 install → exactly ONE new row (got ${db.rows.deliveries.length})`);
    ok(db.rows.deliveries[0]?.service_type === 'planting',
      `C2 service_type is 'planting' (got ${db.rows.deliveries[0]?.service_type})`);
    ok(out.scheduled === true, 'C3 the outcome says scheduled');
  }

  // ══ D. self → ZERO NEW ROWS, AND THE DATABASE IS NEVER TOUCHED ═══════════════════════════════
  {
    const db = fakeDb();
    const out = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'self' });
    ok(db.rows.deliveries.length === 0, `D1 self → ZERO new rows (got ${db.rows.deliveries.length})`);
    // Stronger than counting rows: the insert is never ATTEMPTED. A no-op that still round-trips
    // would pass D1 and still be wrong.
    ok(db.inserts === 0, `D2 self → the insert is never attempted (attempts: ${db.inserts})`);
    ok(out.scheduled === false && (out as any).reason === 'self_transport', 'D3 the outcome names WHY, rather than reporting a failure');
  }

  // ══ E. THE WRITE FORCED TO FAIL — ZERO ROWS, NO THROW, THE ORDER SURVIVES ════════════════════
  // Each probe proves the SAME contract through a different failure shape. If any of these threw,
  // the exception would reach handleCreate's catch and the customer would lose a completed sale.
  for (const [mode, label] of [['error', 'a database error'], ['throws', 'a thrown exception'],
                               ['zero_rows', 'success with ZERO rows (the R-12 case)'],
                               ['null_data', 'success with null data']] as [Mode, string][]) {
    const db = fakeDb(mode);
    let threw = false;
    let out: any = null;
    try {
      out = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'delivery' });
    } catch { threw = true; }
    ok(!threw, `E:${mode} — ${label} must NOT throw (a scheduling row may never kill a checkout)`);
    ok(db.rows.deliveries.length === 0, `E:${mode} — ZERO rows landed (got ${db.rows.deliveries.length})`);
    ok(out && out.scheduled === false, `E:${mode} — the outcome reports failure honestly`);
    ok(typeof out?.error === 'string' && out.error.length > 0, `E:${mode} — the failure carries a reason a human can read`);
  }

  // ══ F. R-12 — THE COUNT IS CHECKED IN BOTH DIRECTIONS, NOT JUST "did anything come back" ═════
  // The whole point of the ruling: PostgREST answers a refused write with `{data: [], error: null}`.
  // Without the count check this is INDISTINGUISHABLE from a landed row.
  {
    const db = fakeDb('zero_rows');
    const out: any = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'install' });
    ok(out.scheduled === false, 'F1 a zero-row insert with NO ERROR is a FAILURE, not a success');
    ok(out.reason === 'zero_rows', `F2 and it is named as its own outcome, not folded into write_failed (got ${out.reason})`);
    ok(db.rows.deliveries.length === 0, 'F3 nothing landed — the count is the proof');
  }
  {
    // 🔴 THE OTHER DIRECTION, and it is what makes the check a COUNT rather than a null-guard:
    // two rows come back, `rows[0].id` is perfectly present, and `!error` is true. Only
    // `rows.length !== 1` can refuse this — which is the ruling's actual wording.
    const db = fakeDb('two_rows');
    const out: any = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'delivery' });
    ok(out.scheduled === false, 'F4 an insert returning TWO rows is NOT reported as one scheduled stop');
    ok(out.reason === 'zero_rows', `F5 it lands on the count outcome, not on write_failed (got ${out.reason})`);
    ok(typeof out.error === 'string' && out.error.includes('2'),
      `F6 and the message NAMES how many rows came back (got "${out.error}")`);
  }

  // ══ G. THE ADDRESS — canonical first, legacy mirror as the fallback, absent stays NULL (D-41/A9) ══
  {
    const db = fakeDb();
    await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'delivery', customerRow: CUSTOMER_LEGACY_ONLY });
    const r = db.rows.deliveries[0] ?? {};
    ok(r.address_line1 === '1100 Ranch Rd' && r.city === 'Georgetown' && r.zip === '78626',
      'G1 a legacy-only address is still found (the billing_* backfill is not assumed)');
  }
  {
    const db = fakeDb();
    await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'delivery', customerRow: null });
    const r = db.rows.deliveries[0] ?? {};
    ok(db.rows.deliveries.length === 1, 'G2 a customer we hold no address for STILL gets a stop — the truck still goes out');
    ok(r.address_line1 === null && r.city === null && r.state === null && r.zip === null,
      'G3 an absent address is NULL, never an empty string — absent is not empty (A9)');
  }
  {
    const db = fakeDb();
    await scheduleCheckoutDelivery(db, {
      ...BASE, transportMethod: 'delivery',
      customerRow: { billing_line1: '   ', address_line1: '9 Oak Ln', billing_city: '', city: 'Kyle' },
    });
    const r = db.rows.deliveries[0] ?? {};
    ok(r.address_line1 === '9 Oak Ln' && r.city === 'Kyle',
      'G4 a WHITESPACE-only canonical value does not shadow a real legacy one');
  }

  // ══ H. THE UNDATED ORDER — a stop with no date is still a stop ═══════════════════════════════
  {
    const db = fakeDb();
    const out = await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'install', deliveryDate: null });
    ok(db.rows.deliveries.length === 1, 'H1 no delivery date → the row is still written');
    ok(db.rows.deliveries[0]?.delivery_date === null, 'H2 the date is NULL, not fabricated as today');
    ok(out.scheduled === true, 'H3 and it reports as scheduled');
  }

  // ══ I. NEGATIVE CONTROLS — the fixture can fail, so a green run means something ══════════════
  {
    const db = fakeDb();
    await scheduleCheckoutDelivery(db, { ...BASE, transportMethod: 'delivery' });
    ok(db.rows.deliveries.length !== 2, 'I1 the counter does not double-count one insert');
    ok(db.rows.deliveries[0]?.service_type !== 'planting',
      'I2 the service_type mapping is not constant — a delivery is NOT tagged planting');
    ok((db.rows.deliveries[0] as any)?.order_id === undefined,
      'I3 no order_id is written — the column does not exist and this build adds none (zero migrations)');
  }
  {
    // The stub itself must be capable of reporting a miss, or every count above is meaningless.
    const db = fakeDb();
    ok(db.rows.deliveries.length === 0, 'I4 an untouched fixture counts zero (the stub can say "nothing happened")');
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────────────────────────
  console.log(`\ncheckoutDelivery: ${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
}

void main();
