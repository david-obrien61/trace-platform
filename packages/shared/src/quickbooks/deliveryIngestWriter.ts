// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the IO half of the ShipDate → delivery ingest. Reads what the tenant already has
//   (their customers, and the invoice ids already ingested), asks the pure planner what to do,
//   and — only on an explicit commit — writes `customers` through the ONE shared upsert and
//   `deliveries` through the ONE insert in this file.
// DEPENDENCIES: ./shipmentIngest (every decision) · ../business-logic/customerUpsert
//   (the ONE customer write path) · a supabase client passed in. No client constructed here.
// OUTPUTS: readIngestState · previewDeliveryIngest · commitDeliveryIngest · IngestReport.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT THIS FILE WRITES, EXHAUSTIVELY: `customers` (via findOrCreateCustomer, not here) and
//   `deliveries`. THAT IS THE WHOLE LIST, and it is the acceptance criterion that matters most.
//   NO `orders`. NO `order_items`. NO `business_inventory`. NO lot, no cost, no catalogue row.
//   `deliveryIngestWriter.test.ts` §E asserts it against a recording client rather than trusting
//   this paragraph — a comment claiming a boundary is a comment, and R-26 has thirteen instances
//   of one being false the day it was written.
//
// 🔴 AND NO `business_inventory_id`, WHICH IS THE SUBTLE HALF. Committed stock is DERIVED from
//   open orders, so a future-dated row pointing at a lot would silently reduce what LAWNS can
//   SELL — the D-52 landmine. There is no order line here to carry one, and there is no order
//   because we are not making one: both exits are taken, exactly as the August backfill took
//   them. Available-to-sell cannot move because nothing this file writes is an input to it.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THIS IS A ONE-TIME SEED, NOT A SYNC — LAUREN'S RULING, 2026-08-31:
//   **CULTIVAR OWNS THE DELIVERY DATE. QUICKBOOKS OWNS THE MONEY.**
//   So this ingest CREATES what does not exist and NEVER UPDATES A DELIVERY THAT DOES —
//   including, and especially, where the dates differ. There is no UPDATE verb against
//   `deliveries` anywhere in this file, and `deliveryIngestWriter.test.ts` §E asserts that the
//   only verbs it ever issues are reads and inserts.
//
//   THE CASE THAT PROVES IT MATTERS: Lauren moved **Ariel Thiry** to 19 September in the app and
//   did not touch the invoice, which still reads 2 September. HER VALUE IS THE CORRECT ONE. A
//   sync would have quietly restored the stale date overnight and she would have found her
//   correction gone with nothing to say why.
//
// 🔴 AND THE DUPLICATE IS THE REAL HAZARD, NOT THE OVERWRITE. Thiry's row was entered BY HAND,
//   so it carries NO `qb_invoice_id` — the idempotency key cannot see it, and an ingest keyed
//   only on that column would happily add a SECOND Thiry stop on 2 September beside her 19th.
//   So a stop is also skipped when the resolved CUSTOMER already has a live delivery. A stop
//   this refuses that Lauren then adds by hand costs her a minute; a duplicate stop is a second
//   truck. The asymmetry decides it, exactly as it does for the address parse.
//
// ⚠️ THE CONSEQUENCE OF HER MODEL, NAMED HERE AND NOT BUILT: because Cultivar now owns the date,
//   their QuickBooks invoices go stale every time she moves a stop. The write-back that would fix
//   that is a WRITE TO THEIR BOOKS — D-37 territory — and it needs its own ruling. It is not in
//   this build and nothing here should be read as a step toward it.
// ══════════════════════════════════════════════════════════════════════════════
//
// 🔴 THE MIGRATION IS A HARD PRECONDITION, NOT A DEGRADED MODE. Without
//   `deliveries.qb_invoice_id` the ingest has no idempotency, and an ingest with no idempotency
//   run twice gives Lauren thirty-six stops. So the commit REFUSES and names the migration,
//   rather than writing rows it cannot recognise on the next pass. This is the one place where
//   "integration failure never blocks" (§6 r6) does not apply: the failure mode of proceeding
//   is duplicated customer-facing work, not a missing convenience.
// ══════════════════════════════════════════════════════════════════════════════
import {
  buildDeliveryPlan, resolveIngestCustomer, deliveryNoteFor,
  DELIVERY_INGEST_SOURCE,
  type QboShipmentRow, type PlannedStop, type BlockedStop, type ExistingCustomer,
} from './shipmentIngest';
import { findOrCreateCustomer } from '../business-logic/customerUpsert';

/** One row as the operator reads it on the preview, before anything is written. */
export interface PreviewStop {
  invoiceId: string;
  docNumber: string | null;
  deliveryDate: string;
  totalAmt: number | null;
  customerName: string | null;
  qbCustomerId: string | null;
  customerType: 'person' | 'organization';
  address: string;
  phone: string | null;
  cityStateZipFrom: string;
  /** Billing town disagrees with the ship-to town — surfaced, never a refusal. */
  note: string | null;
  /** What will happen to the customer row: link an existing one, or create one. */
  customerAction: 'link' | 'create';
  customerRule: string;
  /** Already in `deliveries` from a previous run — this row will be SKIPPED, not rewritten. */
  alreadyIngested: boolean;
}

/**
 * A stop the ingest DECLINED TO CREATE because the customer already has one, and what the two
 * records say. Nothing about this is changed by the ingest — it is reported so a stale invoice
 * is visible rather than silent.
 */
export interface DateConflict {
  invoiceId: string;
  docNumber: string | null;
  customerName: string | null;
  /** What Cultivar says — the human decision, and the one that stands. */
  appDate: string | null;
  /** What the invoice says — a record that has not caught up. */
  quickbooksDate: string;
  /** true when the two differ; false when the stop simply already exists on the same day. */
  differs: boolean;
}

/** A row that will NOT be written, and the reason in words Lauren can act on. */
export interface PreviewRefusal {
  invoiceId: string;
  docNumber: string | null;
  deliveryDate: string;
  customerName: string | null;
  reason: string;
  lines: string[];
}

export interface IngestReport {
  ok: boolean;
  /** Set when the whole ingest refuses — the migration precondition is the only current case. */
  blocker: string | null;
  invoicesRead: number;
  futureShipDates: number;
  alreadyIngested: number;
  /** Rows that WOULD be written (preview) or WERE written (commit). */
  stops: PreviewStop[];
  refusals: PreviewRefusal[];
  /** Existing stops this ingest left completely alone. Reported; never reconciled. */
  conflicts: DateConflict[];
  /** Commit only. */
  written: number;
  customersCreated: number;
  customersLinked: number;
  /** Commit only — a step that failed after earlier steps landed. Never silently swallowed. */
  errors: { invoiceId: string; step: string; message: string }[];
}

const SELECT_EXISTING = 'id, qb_customer_id, first_name, last_name';

/**
 * Does `deliveries.qb_invoice_id` exist yet?
 *
 * Asked by SELECTING the column rather than by reading a catalog view, because the ingest runs
 * under the service key through PostgREST and PostgREST is what will reject the write. Testing
 * the thing that will actually fail beats testing a proxy for it.
 */
export async function qbInvoiceIdColumnExists(db: any): Promise<boolean> {
  const { error } = await db.from('deliveries').select('qb_invoice_id').limit(1);
  if (!error) return true;
  const s = `${error.code} ${error.message}`;
  if (/42703|PGRST204|PGRST200/.test(s) || /qb_invoice_id/i.test(s)) return false;
  // Any OTHER error is not an answer to this question — do not report "absent" for a network
  // blip and then refuse with the wrong reason (D-9: an unknown must not read as a known).
  throw new Error(`Could not determine whether deliveries.qb_invoice_id exists: ${error.message}`);
}

/** The tenant's current state: who they already have, and what was already ingested. */
/** A delivery already on the calendar. Read ONLY to decide not to touch it. */
export interface ExistingDelivery {
  id: string;
  customer_id: string | null;
  delivery_date: string | null;
  qb_invoice_id: string | null;
}

export async function readIngestState(db: any, businessId: string):
  Promise<{ customers: ExistingCustomer[]; ingestedInvoiceIds: Set<string>; deliveries: ExistingDelivery[] }> {
  const { data: custRows, error: custErr } = await db
    .from('customers').select(SELECT_EXISTING).eq('business_id', businessId);
  if (custErr) throw new Error(`Could not read this business's customers: ${custErr.message}`);

  // EVERY live delivery, not only the ingested ones — because the row that must not be
  // duplicated (Thiry) is precisely the one with no `qb_invoice_id` on it. A cancelled stop is
  // excluded: it is not work on the calendar and must not block a real stop from being created.
  const { data: delRows, error: delErr } = await db
    .from('deliveries').select('id, customer_id, delivery_date, qb_invoice_id')
    .eq('business_id', businessId).neq('status', 'cancelled');
  if (delErr) throw new Error(`Could not read the deliveries already on the calendar: ${delErr.message}`);

  const deliveries = (delRows ?? []) as ExistingDelivery[];
  return {
    customers: (custRows ?? []) as ExistingCustomer[],
    ingestedInvoiceIds: new Set(deliveries.filter(d => d.qb_invoice_id).map(d => String(d.qb_invoice_id))),
    deliveries,
  };
}

function toPreview(stop: PlannedStop, action: 'link' | 'create', rule: string): PreviewStop {
  return {
    invoiceId: stop.invoiceId, docNumber: stop.docNumber, deliveryDate: stop.deliveryDate,
    totalAmt: stop.totalAmt, customerName: stop.customerName, qbCustomerId: stop.qbCustomerId,
    customerType: stop.customerType,
    address: `${stop.shipTo.addressLine1}, ${stop.shipTo.city}, ${stop.shipTo.state} ${stop.shipTo.zip}`,
    phone: stop.shipTo.phone,
    cityStateZipFrom: stop.shipTo.cityStateZipFrom,
    note: stop.shipTo.note,
    customerAction: action, customerRule: rule,
    alreadyIngested: stop.alreadyIngested,
  };
}

function toRefusal(b: BlockedStop): PreviewRefusal {
  return { invoiceId: b.invoiceId, docNumber: b.docNumber, deliveryDate: b.deliveryDate,
           customerName: b.customerName, reason: b.reason, lines: b.lines };
}

/**
 * PLAN ONLY. Reads; writes nothing; returns exactly what a commit would do.
 *
 * The commit re-runs this same planner against a fresh read rather than trusting a plan the
 * browser hands back — a plan that travelled through a client is a plan a client could edit,
 * and the addresses in it are where a truck goes.
 */
export async function previewDeliveryIngest(
  db: any, businessId: string, shipments: QboShipmentRow[], today: string,
): Promise<IngestReport> {
  const hasColumn = await qbInvoiceIdColumnExists(db);
  // ONE shape, always — the earlier ternary produced a UNION whose second arm was missing
  // `deliveries`, so the Thiry guard below type-checked only by accident of which branch ran.
  // Without the column there is nothing to read back, so the sets are simply empty and the plan
  // reports every stop as new, which is the honest picture on a database that cannot store the key.
  const state: { customers: ExistingCustomer[]; ingestedInvoiceIds: Set<string>; deliveries: ExistingDelivery[] } =
    hasColumn
      ? await readIngestState(db, businessId)
      : { customers: [], ingestedInvoiceIds: new Set<string>(), deliveries: [] };

  const plan = buildDeliveryPlan(shipments, today, state.ingestedInvoiceIds);
  const stops: PreviewStop[] = [];
  const refusals: PreviewRefusal[] = plan.blocked.map(toRefusal);
  const conflicts: DateConflict[] = [];

  for (const stop of plan.stops) {
    const verdict = resolveIngestCustomer(stop, state.customers);
    if (verdict.action === 'surface') {
      refusals.push({
        invoiceId: stop.invoiceId, docNumber: stop.docNumber, deliveryDate: stop.deliveryDate,
        customerName: stop.customerName, reason: verdict.reason, lines: [],
      });
      continue;
    }
    // 🔴 THE THIRY GUARD. A customer we can already identify who already has a live stop does
    // NOT get a second one. The existing row is reported and left EXACTLY as it is — its date is
    // a human decision and the invoice's is a record that has not caught up.
    if (verdict.action === 'link' && !stop.alreadyIngested) {
      const held = state.deliveries.find(d => d.customer_id === verdict.customerId);
      if (held) {
        conflicts.push({
          invoiceId: stop.invoiceId, docNumber: stop.docNumber, customerName: stop.customerName,
          appDate: held.delivery_date, quickbooksDate: stop.deliveryDate,
          differs: held.delivery_date !== stop.deliveryDate,
        });
        continue;
      }
    }
    stops.push(toPreview(stop, verdict.action, verdict.rule));
  }

  console.log('[TRACE:QBDELIVERY] preview', {
    businessId, invoicesRead: plan.invoicesRead, futureShipDates: plan.futureShipDates,
    toWrite: stops.filter(s => !s.alreadyIngested).length,
    alreadyIngested: stops.filter(s => s.alreadyIngested).length,
    conflictsLeftAlone: conflicts.length, datesThatDiffer: conflicts.filter(c => c.differs).length,
    refusals: refusals.length, hasColumn,
  });

  return {
    ok: hasColumn,
    blocker: hasColumn ? null
      : 'The migration 20260831_deliveries_qb_invoice_id.sql has not been applied yet. Until it is, an ingest cannot recognise its own previous work and running it twice would duplicate every stop. Apply it in the Supabase SQL editor, then ingest.',
    invoicesRead: plan.invoicesRead, futureShipDates: plan.futureShipDates,
    alreadyIngested: stops.filter(s => s.alreadyIngested).length,
    stops, refusals, conflicts,
    written: 0, customersCreated: 0, customersLinked: 0, errors: [],
  };
}

/**
 * WRITE. Customers first (each through the shared upsert), then one delivery per stop.
 *
 * 🔴 PER-ROW FAILURE IS ISOLATED AND REPORTED, NEVER FATAL AND NEVER SILENT. Eighteen stops are
 * eighteen independent facts; one unreadable row must not cost Lauren the other seventeen. Each
 * failure lands in `errors` with the invoice it belongs to (R-18: every incident that does not
 * complete the intended action is logged and reviewable), and the SECOND run picks up exactly
 * what the first one missed — which is what the idempotency key buys beyond de-duplication.
 */
export async function commitDeliveryIngest(
  db: any, businessId: string, shipments: QboShipmentRow[], today: string,
): Promise<IngestReport> {
  const report = await previewDeliveryIngest(db, businessId, shipments, today);
  if (!report.ok) {
    console.log('[TRACE:QBDELIVERY] commit REFUSED — precondition not met', { businessId, blocker: report.blocker });
    return report;
  }

  const state = await readIngestState(db, businessId);
  let written = 0, created = 0, linked = 0;
  const errors: IngestReport['errors'] = [];
  const plan = buildDeliveryPlan(shipments, today, state.ingestedInvoiceIds);

  // Every invoice the preview declined to write, by id. The commit does not re-derive the
  // decision — it OBEYS the one the operator just read. Two answers to one question is how a
  // preview and a commit drift apart, and this is the question "will you touch Thiry's row?".
  const declined = new Set(report.conflicts.map(c => c.invoiceId));

  for (const stop of plan.stops) {
    if (stop.alreadyIngested) continue;   // the whole point of the key — silent, correct, cheap
    if (declined.has(stop.invoiceId)) continue;   // 🔴 an existing stop is NEVER touched
    const verdict = resolveIngestCustomer(stop, state.customers);
    if (verdict.action === 'surface') continue;   // already reported in `report.refusals`

    let customerId: string;
    try {
      const res = await findOrCreateCustomer(db, businessId, {
        first_name: stop.firstName,
        last_name: stop.lastName,
        customer_type: stop.customerType,
        // 🔴 THE PHONE IS THE GIFT — it is the ship-to contact number on a customer record that
        // may carry none, and Lauren's call-ahead depends on it. `findOrCreateCustomer` fills it
        // ONLY where the stored value is blank, so a curated number is never overwritten.
        phone: stop.shipTo.phone,
        // ⚠️ NOT the address. `address_line1`/`city`/… on `customers` is the BILLING address and
        // its canonical `billing_*` twin; a ship-to varies per job site (customerUpsert says so
        // in its own org-dedup comment) and writing one into the billing home is how a
        // contractor's invoices start going to their last delivery.
        qb_customer_id: stop.qbCustomerId,
      }, DELIVERY_INGEST_SOURCE, {
        resolvedCustomerId: verdict.action === 'link' ? verdict.customerId : null,
      });
      customerId = res.customerId;
      if (res.created) created++; else linked++;
      // Keep the in-memory candidate set current so two invoices for the SAME new customer in
      // one run resolve to one row rather than racing each other into two.
      if (res.created) {
        state.customers.push({ id: customerId, qb_customer_id: stop.qbCustomerId,
                               first_name: stop.firstName, last_name: stop.lastName });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[TRACE:QBDELIVERY] customer step FAILED — stop skipped, others continue', { invoiceId: stop.invoiceId, message });
      errors.push({ invoiceId: stop.invoiceId, step: 'customer', message });
      continue;
    }

    // ⚠️ EVERY COLUMN THIS ROW GETS IS LISTED HERE AND NOWHERE ELSE. `order_id` is absent
    // because there is no order; `business_inventory_id` is absent because there is no order
    // LINE to carry one; `service_type` is absent because an invoice does not say whether a
    // stop is a planting or a drop-off, and a guessed crew is worse than an unset field (D-9).
    const row = {
      business_id:   businessId,
      customer_id:   customerId,
      delivery_date: stop.deliveryDate,
      address_line1: stop.shipTo.addressLine1,
      city:          stop.shipTo.city,
      state:         stop.shipTo.state,
      zip:           stop.shipTo.zip,
      status:        'scheduled',
      source:        DELIVERY_INGEST_SOURCE,
      notes:         deliveryNoteFor({ id: stop.invoiceId, docNumber: stop.docNumber, shipDate: stop.deliveryDate } as QboShipmentRow),
      qb_invoice_id: stop.invoiceId,
    };
    // 🔴 UPSERT-IGNORE, NOT INSERT. The unique index is the guarantee; this is how the code
    // cooperates with it instead of racing it. A second operator pressing Ingest at the same
    // moment loses the race harmlessly rather than raising a 23505 that reads like a defect.
    const { data, error } = await db
      .from('deliveries')
      .upsert(row, { onConflict: 'business_id,qb_invoice_id', ignoreDuplicates: true })
      .select('id');
    if (error) {
      console.log('[TRACE:QBDELIVERY] delivery insert FAILED', { invoiceId: stop.invoiceId, message: error.message });
      errors.push({ invoiceId: stop.invoiceId, step: 'delivery', message: error.message });
      continue;
    }
    // R-12 — A WRITE MUST PROVE IT WROTE, AND THE PROOF IS THE COUNT. This site could have been
    // DECLARED as an allowed exception (`ignoreDuplicates` returns zero rows on a duplicate, which
    // is success rather than failure) — but a declaration says "do not look here", and the zero
    // case is worth looking at: it means another operator, or another tab, won the race for this
    // exact invoice a moment ago. So both outcomes are inspected and the interesting one is said
    // out loud. Counting a zero as a write would report eighteen stops over a run that wrote none.
    if ((data ?? []).length !== 1) {
      console.log('[TRACE:QBDELIVERY] stop already existed at write time — the unique index refused a duplicate, which is the index doing its job', { invoiceId: stop.invoiceId });
    } else {
      written++;
    }
  }

  console.log('[TRACE:QBDELIVERY] commit COMPLETE', {
    businessId, written, customersCreated: created, customersLinked: linked,
    skippedAlreadyIngested: report.alreadyIngested,
    // Named `leftAlone` rather than `skipped` on purpose: these are rows the ingest deliberately
    // did not touch, which is a different fact from rows it had already done.
    existingStopsLeftAlone: report.conflicts.length,
    refusals: report.refusals.length, errors: errors.length,
  });

  return { ...report, written, customersCreated: created, customersLinked: linked, errors };
}
