// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: a PHOTOGRAPHED invoice finds the customer the reload created. R-165 says captures
//   survive a wipe AND RE-LINK after reload; the surviving half was built, this is the re-link.
//   PURE — no database, no clock. The writer is `commitCaptureRelink`.
// DEPENDENCIES: none. It is handed captures, invoices and customers and decides.
// OUTPUTS: planCaptureRelink · RelinkPlan · RelinkMatch · RelinkRefusal · CORROBORATION_FIELDS.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE DEFECT THIS EXISTS FOR, MEASURED 2026-09-21 ON LAWNS.
//   16 customers show NOTHING while a twin row holds their order. An OCR capture creates its own
//   customer row; the books import then creates a SECOND row for the same person carrying
//   `qb_customer_id`; Lauren opens the QuickBooks one and it is empty. Chris Dubec, Ariel Thiry,
//   Humberto Garza and thirteen others.
//
// 🔴 MATCH BY INVOICE, NEVER BY NAME (David, 2026-09-21).
//   capture.source_document_number → the QuickBooks invoice with that DocNumber → its
//   `CustomerRef.value` → `customers.qb_customer_id`. Name matching would ALREADY have failed on
//   two of the sixteen: `David Ferrara`/`david ferraro` and `Luis Candanoza`/`luis gomez
//   candanoza`. A name is how a person is addressed; an invoice number is what the sale IS.
//
// 🔴 AND A DOCUMENT NUMBER IS AN ANCHOR, NOT AN IDENTITY — #250 measured 22 numbers used by TWO
//   different invoices each in LAWNS's own books. So a number alone never links: the invoice must
//   also CORROBORATE on the date or the amount. Where it does not, the capture is REPORTED and
//   left exactly where it is. An order moved onto the wrong customer is worse than one not moved:
//   it is a sale attributed to a stranger, and nothing on any screen would say so.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** What a capture must agree with its invoice on, beyond the number. ONE is enough; zero is not. */
export const CORROBORATION_FIELDS = ['sale_date', 'total_amount'] as const;

/** Money agrees within a cent — these are two records of ONE invoice, not an estimate of it. */
const CENT = 0.011;

export interface CaptureRow {
  id: string;
  customerId: string | null;
  documentNumber: string | null;
  saleDate: string | null;
  totalAmount: number | null;
}
export interface InvoiceRow {
  id: string;
  docNumber: string | null;
  txnDate: string | null;
  totalAmt: number | null;
  qbCustomerId: string | null;
}
export interface RelinkMatch {
  captureId: string;
  documentNumber: string;
  fromCustomerId: string | null;
  toCustomerId: string;
  qbCustomerId: string;
  /** Which fields agreed. Never empty — an empty list is a refusal, not a match. */
  corroboratedOn: string[];
}
export type RefusalReason =
  | 'no-document-number' | 'no-invoice' | 'ambiguous-invoice'
  | 'no-corroboration' | 'no-customer-row' | 'already-linked';
export interface RelinkRefusal {
  captureId: string;
  documentNumber: string | null;
  reason: RefusalReason;
  detail: string;
}
export interface RelinkPlan {
  matches: RelinkMatch[];
  refusals: RelinkRefusal[];
  refusalCounts: Record<RefusalReason, number>;
  capturesRead: number;
}

const money = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) < CENT;
const sameDay = (a: string | null, b: string | null) =>
  !!a && !!b && a.slice(0, 10) === b.slice(0, 10);

/**
 * Decide, for every capture, whether it can be re-linked.
 *
 * ⚠️ `customerIdByQbId` IS THE RELOADED POPULATION. A capture whose invoice points at a QuickBooks
 * customer the reload did not bring across is REFUSED, not created — this pass moves orders, it
 * does not mint customers.
 */
export function planCaptureRelink(input: {
  captures: CaptureRow[];
  invoices: InvoiceRow[];
  customerIdByQbId: Map<string, string>;
  /** Customer rows that belong to the load. A capture already on one of these needs nothing. */
  loadCustomerIds: Set<string>;
}): RelinkPlan {
  const { captures, invoices, customerIdByQbId, loadCustomerIds } = input;
  const byDoc = new Map<string, InvoiceRow[]>();
  for (const inv of invoices) {
    if (!inv.docNumber) continue;
    const k = String(inv.docNumber);
    (byDoc.get(k) ?? byDoc.set(k, []).get(k)!).push(inv);
  }

  const matches: RelinkMatch[] = [];
  const refusals: RelinkRefusal[] = [];
  const refusalCounts = {
    'no-document-number': 0, 'no-invoice': 0, 'ambiguous-invoice': 0,
    'no-corroboration': 0, 'no-customer-row': 0, 'already-linked': 0,
  } as Record<RefusalReason, number>;
  const refuse = (c: CaptureRow, reason: RefusalReason, detail: string) => {
    refusals.push({ captureId: c.id, documentNumber: c.documentNumber, reason, detail });
    refusalCounts[reason]++;
  };

  for (const c of captures) {
    if (c.customerId && loadCustomerIds.has(c.customerId)) {
      refuse(c, 'already-linked', 'this capture already sits on a customer from the load'); continue;
    }
    if (!c.documentNumber) {
      refuse(c, 'no-document-number', 'nothing to match on — a capture with no document number cannot be anchored'); continue;
    }
    const candidates = byDoc.get(String(c.documentNumber)) ?? [];
    if (candidates.length === 0) {
      refuse(c, 'no-invoice', `no QuickBooks invoice carries document #${c.documentNumber}`); continue;
    }

    // 🔴 CORROBORATE FIRST, THEN COUNT WHAT SURVIVED. Narrowing by agreement BEFORE testing for
    // ambiguity is what lets a genuinely duplicated document number still resolve — two invoices
    // share #3274 at LAWNS and they are a different customer AND a different amount (#250), so
    // the money separates them. Counting first would have refused both.
    const corroborated = candidates.map(inv => ({
      inv,
      on: [
        sameDay(c.saleDate, inv.txnDate) ? 'sale_date' : null,
        money(c.totalAmount, inv.totalAmt) ? 'total_amount' : null,
      ].filter(Boolean) as string[],
    })).filter(x => x.on.length > 0);

    if (corroborated.length === 0) {
      refuse(c, 'no-corroboration',
        `document #${c.documentNumber} exists in QuickBooks but agrees on neither date nor amount `
        + `(capture: ${c.saleDate ?? 'no date'} / ${c.totalAmount ?? 'no amount'}) — a number alone is an anchor, not an identity`);
      continue;
    }
    if (corroborated.length > 1) {
      refuse(c, 'ambiguous-invoice',
        `${corroborated.length} QuickBooks invoices carry document #${c.documentNumber} and more than one agrees — `
        + 'reported rather than picking one');
      continue;
    }
    const { inv, on } = corroborated[0];
    if (!inv.qbCustomerId) {
      refuse(c, 'no-customer-row', `invoice #${c.documentNumber} names no customer`); continue;
    }
    const toCustomerId = customerIdByQbId.get(String(inv.qbCustomerId));
    if (!toCustomerId) {
      refuse(c, 'no-customer-row',
        `QuickBooks customer ${inv.qbCustomerId} has no row here — this pass moves orders, it never mints customers`);
      continue;
    }
    if (toCustomerId === c.customerId) {
      refuse(c, 'already-linked', 'the capture is already on that customer'); continue;
    }
    matches.push({
      captureId: c.id, documentNumber: String(c.documentNumber),
      fromCustomerId: c.customerId, toCustomerId,
      qbCustomerId: String(inv.qbCustomerId), corroboratedOn: on,
    });
  }
  return { matches, refusals, refusalCounts, capturesRead: captures.length };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// THE WRITER. Everything above is pure; this is the only part that touches a database.
// ═════════════════════════════════════════════════════════════════════════════════════════════

export interface RelinkResult extends RelinkPlan {
  ok: boolean;
  blocker: string | null;
  runId: string | null;
  linked: number;
}

/**
 * Re-link this tenant's captures to the customers the load brought in.
 *
 * 🔴 EACH MATCH IS ITS OWN UPDATE, GUARDED. Not one bulk statement: the guard
 * (`relinked_from_customer_id IS NULL`) is what makes a second run a no-op instead of a
 * corruption — without it a re-run would record the CURRENT customer as the twin and the wipe
 * would then "put it back" onto the row it is already on, losing the way home forever.
 *
 * 🔴 IT WRITES THREE COLUMNS AND NO OTHERS: `customer_id`, `import_run_id`,
 * `relinked_from_customer_id`. It never touches the sale — not the money, not the lines, not the
 * document number. Moving a sale between customers is already the most dangerous thing this
 * module does; doing anything else in the same statement would make it unreviewable.
 */
export async function commitCaptureRelink(
  db: any, businessId: string, invoices: InvoiceRow[], opts: { dryRun?: boolean } = {},
): Promise<RelinkResult> {
  const page = async (table: string, select: string, filter: (q: any) => any) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await filter(
        db.from(table).select(select).eq('business_id', businessId).range(from, from + 999));
      if (error) throw new Error(`Could not read ${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    return rows;
  };

  const customers = await page('customers', 'id, qb_customer_id, import_run_id',
    (q: any) => q);
  const customerIdByQbId = new Map<string, string>();
  const runTally = new Map<string, number>();
  for (const c of customers) {
    if (c.qb_customer_id) customerIdByQbId.set(String(c.qb_customer_id), String(c.id));
    if (c.import_run_id) runTally.set(String(c.import_run_id), (runTally.get(String(c.import_run_id)) ?? 0) + 1);
  }
  let runId: string | null = null, best = 0;
  for (const [id, n] of runTally) if (n > best) { best = n; runId = id; }
  const loadCustomerIds = new Set(
    customers.filter(c => c.import_run_id && String(c.import_run_id) === runId).map(c => String(c.id)));

  const empty: RelinkPlan = {
    matches: [], refusals: [], capturesRead: 0,
    refusalCounts: { 'no-document-number': 0, 'no-invoice': 0, 'ambiguous-invoice': 0,
                     'no-corroboration': 0, 'no-customer-row': 0, 'already-linked': 0 },
  };
  if (!runId) {
    return { ...empty, ok: false, runId: null, linked: 0,
      blocker: 'This business has no imported customers, so there is no load to re-link to.' };
  }

  // A CAPTURE is a history order with no QuickBooks invoice id — the OCR and backfill doors. An
  // order the API door wrote already carries `qb_invoice_id` and was never on a twin.
  const capRows = await page('orders',
    'id, customer_id, source_document_number, sale_date, total_amount, relinked_from_customer_id',
    (q: any) => q.eq('order_kind', 'history').is('qb_invoice_id', null));
  const captures: CaptureRow[] = capRows
    .filter(o => !o.relinked_from_customer_id)   // already re-linked: leave it entirely alone
    .map(o => ({
      id: String(o.id), customerId: o.customer_id ? String(o.customer_id) : null,
      documentNumber: o.source_document_number ? String(o.source_document_number) : null,
      saleDate: o.sale_date ?? null,
      totalAmount: o.total_amount === null || o.total_amount === undefined ? null : Number(o.total_amount),
    }));

  const plan = planCaptureRelink({ captures, invoices, customerIdByQbId, loadCustomerIds });
  if (opts.dryRun) return { ...plan, ok: true, blocker: null, runId, linked: 0 };

  let linked = 0;
  for (const m of plan.matches) {
    const { data, error } = await db.from('orders')
      .update({
        customer_id: m.toCustomerId,
        import_run_id: runId,
        relinked_from_customer_id: m.fromCustomerId,
      })
      .eq('id', m.captureId)
      .eq('business_id', businessId)
      .is('relinked_from_customer_id', null)    // the guard — a re-run must not re-point the way home
      .select('id');
    if (error) {
      return { ...plan, ok: false, runId, linked,
        blocker: `Re-link failed on document #${m.documentNumber}: ${error.message}` };
    }
    // 🔴 THE VERDICT IS READ, NEVER ASSUMED. PostgREST returns NO ERROR when RLS refuses an
    // update — zero rows, `error: null` — so a refused write is indistinguishable from a
    // successful one unless the row count is checked (A8).
    if ((data ?? []).length === 1) linked++;
  }
  console.log('[TRACE:RELINK] re-link complete', {
    businessId, runId, capturesRead: plan.capturesRead,
    matched: plan.matches.length, linked, refusals: plan.refusalCounts,
  });
  return { ...plan, ok: true, blocker: null, runId, linked };
}
