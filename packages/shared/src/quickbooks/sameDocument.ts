// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: decide whether two invoices are the SAME DOCUMENT recorded twice — by comparing the
//   four things that make a document what it is: the CUSTOMER, the DATE, the LINE ITEMS and the
//   TOTAL. All four match = something worth an owner's eye. Any one differs = nothing to report.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow). Pure: no db, no network, no clock, no DOM.
// OUTPUTS: DocumentGroup · SameDocumentCensus · documentSignature · censusSameDocuments.
// STORY: *David rehearses the import on a saved copy* (`user_stories.md`, ARC: ocr-doc-routing).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THIS REPLACES A RULE THAT COMPARED ONE FIELD, AND THE OLD ONE WAS AN OBSERVATION WEARING A
//    RISK HEADING. DAVID'S RULING, 2026-09-08.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `duplicate-invoice-numbers` reported *"44 invoices share an invoice number — 22 numbers are used
// more than once"* under **Things worth knowing before they cause trouble**. It was accurate and
// it meant nothing: **Lauren confirmed the bookkeeper created those numbers deliberately, because
// the invoices had been renamed** — which is what the October-2025 cluster and the 5120s block
// are. A repeated `DocNumber` in these books is the FINGERPRINT OF A RENUMBERING, not of a
// duplicate, and a rule that compares one field can only ever produce noise.
//
// 🔴 THE NUMBERS THAT SETTLE IT [STATED — measured by a prior session against the 2026-09-03
// capture; this build could not re-measure, `SUPABASE_SERVICE_KEY` is empty and no capture file
// lives in this repository]: **all 22 repeated-number groups carry DIFFERENT totals**, and of the
// **29 same-customer-same-day groups exactly ONE has matching totals.** So the honest output of
// this question is **one pair worth her eye**, not 44 invoices under a risk heading.
//
// ⚠️ IT IS A NEW RULE ID, NOT A VERSION OF THE OLD ONE. Different question, different denominator:
// the old one's population was *numbered invoices*, this one's is *invoices that share a customer
// and a day*. Keeping the id alive with new arithmetic would leave the corpus with one id that has
// meant two things — which is precisely what `(rule_id, rule_version)` is stored to prevent.
//
// ⚠️ AND IT STILL DOES NOT ADJUDICATE. Two identical documents may be a genuine repeat order
// placed on one day. The census says the four things agree; what it MEANS is the owner's to say
// (R-54 — we surface, the owner decides).
// ─────────────────────────────────────────────────────────────────────────────
import type { QboInvoiceRow } from './invoiceList';

export interface DocumentGroup {
  /** The signature the members share. Opaque; never rendered. */
  signature: string;
  /** The invoice ids, ascending — a stable order so a re-render cannot re-shuffle them. */
  invoiceIds: string[];
  /** Their document numbers, in the same order. NOT part of the key — see `documentSignature`. */
  docNumbers: (string | null)[];
  customerId: string | null;
  txnDate: string | null;
  totalAmt: number | null;
}

export interface SameDocumentCensus {
  /** Invoices carrying BOTH a customer and a date — the only ones this question can be asked of. */
  comparable: number;
  /** Groups where the customer, the date, the lines AND the total all agree. */
  groups: DocumentGroup[];
  /** Records sitting in one of those groups. */
  recordsInvolved: number;
  /** Invoices that could not be compared because they carry no customer or no date. Declared,
   *  never silently dropped — "we did not look" and "we looked and found nothing" (D-9 / A9). */
  notComparable: number;
  /**
   * 🔴 THE RETIRED QUESTION, KEPT AS EVIDENCE RATHER THAN AS A FINDING. How many document numbers
   * are used more than once, and how many of those groups ALSO agree on their total. On LAWNS the
   * second figure is 0 of 22, which is what makes the first one an observation. It is reported in
   * this census so the replaced rule can SAY why repeated numbers are not counted, instead of the
   * reader wondering whether we simply stopped looking.
   */
  repeatedNumberGroups: number;
  repeatedNumberGroupsAgreeingOnTotal: number;
}

const cents = (n: number | null): string => (n === null ? 'null' : String(Math.round(n * 100)));

/**
 * The four things that make two invoices the same document.
 *
 * 🔴 `DocNumber` IS DELIBERATELY NOT IN IT, AND THAT IS THE WHOLE CORRECTION. It is the field the
 * old rule compared and the one field these books are known to reuse on purpose. Including it
 * would make a renumbered pair look like a duplicate and — worse in the other direction — would
 * make a genuinely duplicated document invisible the moment somebody renumbered one of the two.
 *
 * ⚠️ THE LINES ARE COMPARED AS A SORTED MULTISET, so two records of one document that list the
 * same lines in a different order still match. Sorting is on the rendered signature, which
 * includes the amount — so a line appearing twice is not collapsed into one.
 *
 * ⚠️ AND MONEY IS COMPARED IN WHOLE CENTS. Two amounts that agree to the penny must not read as
 * different because of floating point, which would silently empty this finding.
 */
export function documentSignature(inv: QboInvoiceRow): string {
  const lines = inv.lines
    .map(l => `${l.itemId ?? l.itemName ?? '-'}|${l.qty ?? ''}|${cents(l.unitPrice)}|${cents(l.amount)}`)
    .sort()
    .join('~');
  return `c:${inv.customerId ?? '-'}|d:${inv.txnDate ?? '-'}|t:${cents(inv.totalAmt)}|L:${lines}`;
}

/** Group by the signature; report the groups with more than one member. */
export function censusSameDocuments(invoices: QboInvoiceRow[]): SameDocumentCensus {
  const bySig = new Map<string, QboInvoiceRow[]>();
  let comparable = 0, notComparable = 0;
  for (const inv of invoices) {
    // Without a customer or a date there is no document to be the same AS. Counted, not dropped.
    if (!inv.customerId || !inv.txnDate) { notComparable++; continue; }
    comparable++;
    const sig = documentSignature(inv);
    const list = bySig.get(sig);
    if (list) list.push(inv); else bySig.set(sig, [inv]);
  }

  const groups: DocumentGroup[] = [];
  for (const [signature, members] of bySig) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    groups.push({
      signature,
      invoiceIds: sorted.map(m => m.id),
      docNumbers: sorted.map(m => m.docNumber),
      customerId: sorted[0].customerId,
      txnDate: sorted[0].txnDate,
      totalAmt: sorted[0].totalAmt,
    });
  }
  groups.sort((a, b) => b.invoiceIds.length - a.invoiceIds.length
                     || (a.invoiceIds[0] < b.invoiceIds[0] ? -1 : 1));

  // ── the retired question, measured so the replacement can cite it ──
  const byNumber = new Map<string, QboInvoiceRow[]>();
  for (const inv of invoices) {
    if (!inv.docNumber) continue;
    const list = byNumber.get(inv.docNumber);
    if (list) list.push(inv); else byNumber.set(inv.docNumber, [inv]);
  }
  let repeatedNumberGroups = 0, repeatedNumberGroupsAgreeingOnTotal = 0;
  for (const members of byNumber.values()) {
    if (members.length < 2) continue;
    repeatedNumberGroups++;
    const totals = new Set(members.map(m => cents(m.totalAmt)));
    if (totals.size === 1) repeatedNumberGroupsAgreeingOnTotal++;
  }

  return {
    comparable,
    groups,
    recordsInvolved: groups.reduce((n, g) => n + g.invoiceIds.length, 0),
    notComparable,
    repeatedNumberGroups,
    repeatedNumberGroupsAgreeingOnTotal,
  };
}
