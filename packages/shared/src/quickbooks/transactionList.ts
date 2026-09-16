// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: size the five QuickBooks transaction types the preview had never read — Estimate,
//   Payment, SalesReceipt, CreditMemo, RefundReceipt — as COUNTS, MONEY and DATES, and count the
//   records of ANY entity that carry a custom field. Nothing here interprets a transaction as a
//   sale, a refund of a sale, or a correction to a finding: that is a ruling about what these
//   records MEAN, and it is not taken here (#341).
// DEPENDENCIES: ./qboRead (parseRows · QboEntity). Pure: no db, no network, no env, no DOM.
// OUTPUTS: TransactionBreakdown · summariseTransactions · countWithCustomFields.
//
// 🔴 COUNTS ONLY, FOR THE INVOICE'S REASON. A refund receipt names the person refunded and what
//   they were paid back; a payment names who paid. The breakdown carries no name, no memo, no
//   address and no note — the verbatim bodies reach the operator once, in the capture file.
//
// 🔴 A READ THAT RETURNED NOTHING IS NOT A BUSINESS THAT HAS NONE, UNTIL IT WAS ASKED PROPERLY.
//   `withCustomFields` exists because LAWNS's 1,496 invoices all carried an empty `CustomField`
//   array under a request that never asked for the newer custom fields. That count is only
//   evidence of "none" once the request carries `include=enhancedAllCustomFields`, which is why
//   the capture page now records the parameters it was sent with.
// ─────────────────────────────────────────────────────────────────────────────
import { parseRows, type QboEntity } from './qboRead';

export interface TransactionBreakdown {
  entity: QboEntity;
  total: number;
  /** Records whose `TotalAmt` we could read. Money is summed over these only. */
  withAmount: number;
  /** Sum of `TotalAmt` over `withAmount`. A record with no readable amount adds nothing — and is counted in `total - withAmount`, never as $0. */
  amountTotal: number;
  dateRange: { earliest: string | null; latest: string | null; undated: number };
  /** Records whose `LinkedTxn` (top level or on any line) points at an Invoice. */
  linkedToAnInvoice: number;
  /** Records carrying at least one custom field with a value. */
  withCustomFields: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function linksToInvoice(row: Record<string, unknown>): boolean {
  const links: unknown[] = [];
  if (Array.isArray(row.LinkedTxn)) links.push(...row.LinkedTxn);
  if (Array.isArray(row.Line)) {
    for (const l of row.Line) if (isObj(l) && Array.isArray(l.LinkedTxn)) links.push(...l.LinkedTxn);
  }
  return links.some(t => isObj(t) && t.TxnType === 'Invoice');
}

/**
 * A custom field counts only when it holds a value. Intuit returns defined-but-empty fields as
 * `{ DefinitionId, Name, Type }` with no `StringValue`, and counting those would report a field
 * nobody ever filled in as data.
 */
function hasCustomField(row: Record<string, unknown>): boolean {
  if (!Array.isArray(row.CustomField)) return false;
  return row.CustomField.some(f => {
    if (!isObj(f)) return false;
    for (const k of ['StringValue', 'NumberValue', 'DateValue', 'BooleanValue']) {
      const v = f[k];
      if (v !== undefined && v !== null && v !== '') return true;
    }
    return false;
  });
}

/** Records of `entity` across `rawBodies` that carry a filled custom field. */
export function countWithCustomFields(rawBodies: string[], entity: QboEntity): number {
  let n = 0;
  for (const body of rawBodies) {
    const page = parseRows(body, entity);
    if (!page.ok) continue;
    for (const r of page.rows) if (isObj(r) && hasCustomField(r)) n++;
  }
  return n;
}

/**
 * Size one transaction list. Unreadable pages are the walk's business (it refuses them before
 * this runs), so a page that fails to parse here contributes nothing rather than throwing.
 */
export function summariseTransactions(rawBodies: string[], entity: QboEntity): TransactionBreakdown {
  let total = 0, withAmount = 0, amountTotal = 0, undated = 0, linkedToAnInvoice = 0, withCustomFields = 0;
  let earliest: string | null = null, latest: string | null = null;
  for (const body of rawBodies) {
    const page = parseRows(body, entity);
    if (!page.ok) continue;
    for (const r of page.rows) {
      if (!isObj(r)) continue;
      total++;
      const amt = typeof r.TotalAmt === 'number' ? r.TotalAmt : Number.NaN;
      if (Number.isFinite(amt)) { withAmount++; amountTotal += amt; }
      const d = typeof r.TxnDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.TxnDate) ? r.TxnDate.slice(0, 10) : null;
      if (d === null) undated++;
      else {
        if (earliest === null || d < earliest) earliest = d;
        if (latest === null || d > latest) latest = d;
      }
      if (linksToInvoice(r)) linkedToAnInvoice++;
      if (hasCustomField(r)) withCustomFields++;
    }
  }
  return {
    entity, total, withAmount,
    amountTotal: Math.round(amountTotal * 100) / 100,
    dateRange: { earliest, latest, undated },
    linkedToAnInvoice, withCustomFields,
  };
}
