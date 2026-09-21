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
