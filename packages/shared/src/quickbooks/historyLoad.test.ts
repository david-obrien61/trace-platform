// Probes for `planHistoryLoad` — the whole-history planner (ledger #363).
// The risk here is not arithmetic, it is WHICH INVOICES ARE SKIPPED AND WHY: a wrong skip loses a
// real sale, a missing skip doubles one on the owner's books.
import { planHistoryLoad } from './historyLoad';

let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); } };

const BIZ = 'b0000000-0000-0000-0000-000000000000';
const RUN = 'r0000000-0000-0000-0000-000000000000';
const inv = (over: Record<string, unknown> = {}) => ({
  Id: '100', DocNumber: '3648.500', TxnDate: '2026-05-15', TotalAmt: 300,
  CustomerRef: { value: '2535', name: 'Regina & David O Brien' },
  Line: [
    { Id: '1', DetailType: 'SalesItemLineDetail', Amount: 300, Description: 'Monterrey Oak 95',
      SalesItemLineDetail: { ItemRef: { value: '77', name: 'Oak:MO95' }, Qty: 3, UnitPrice: 100 } },
    { Id: '2', DetailType: 'SubTotalLineDetail', Amount: 300, SubTotalLineDetail: {} },
  ],
  ...over,
});
const plan = (invoices: any[], over: Record<string, unknown> = {}) => planHistoryLoad({
  invoices, businessId: BIZ, runId: RUN,
  customerIdByQbId: new Map([['2535', 'c-regina']]),
  existingQbInvoiceIds: new Set<string>(),
  excludedDocNumbers: new Set<string>(),
  ...over,
} as any);

// ─── A · THE HAPPY PATH
{
  const p = plan([inv()]);
  ok(p.planned.length === 1, 'A1 an ordinary invoice is planned');
  ok(p.invoicesRead === 1, 'A2 the denominator is reported — a pass over an empty set is not a pass');
  ok(p.planned[0].customerId === 'c-regina', 'A3 resolved to the customer by QuickBooks id');
  ok(p.planned[0].draft.order.qb_invoice_id === '100', 'A4 the idempotency key is carried');
  ok(p.planned[0].draft.order.order_kind === 'history', 'A5 it is a history order');
  ok(p.lineCount === 1, 'A6 ONE line — the running total is not one of them');
  ok(p.runningTotalsDropped === 1, 'A7 and the dropped running total is COUNTED, not silent');
  ok(p.planned[0].draft.items.every(l => l.businessInventoryId === null),
     'A8 🔴 no line carries a lot id — D-52, the one mistake that would be invisible');
  ok(p.planned[0].draft.items[0].qboItemId === '77',
     'A9 the catalogue link is the QuickBooks item id — a VALUE, so it survives a reload');
}

// ─── B · THE THREE SKIPS, AND THEY ARE NOT THE SAME SKIP
{
  const p = plan([inv()], { existingQbInvoiceIds: new Set(['100']) });
  ok(p.planned.length === 0 && p.skipCounts['already-ordered'] === 1,
     'B1 an invoice that already has an order is skipped — the index holds');
}
{
  const p = plan([inv()], { excludedDocNumbers: new Set(['3648.500']) });
  ok(p.planned.length === 0 && p.skipCounts['captured-by-hand'] === 1,
     'B2 🔴 a document number Lauren captured by hand is skipped — it would DOUBLE the sale');
  ok(/double/.test(p.skipped[0]?.detail ?? ''), 'B2b and the reason SAYS why, not just that');
}
{
  const p = plan([inv({ CustomerRef: { value: '9999' } })]);
  ok(p.planned.length === 0 && p.skipCounts['no-customer'] === 1,
     'B3 an unresolvable customer is REPORTED, never guessed at');
}
{
  const p = plan([inv({ CustomerRef: undefined })]);
  ok(p.skipCounts['no-customer'] === 1, 'B4 and an invoice with no CustomerRef at all is the same skip');
}

// ─── C · THE SKIPS ARE ORDERED, AND THE ORDER IS THE SAFETY ARGUMENT
{
  // An invoice that is BOTH already ordered AND doc-number-excluded must report the KEY, because
  // that is the structural fact; the doc-number rule is the blunt instrument standing in for it.
  const p = plan([inv()], {
    existingQbInvoiceIds: new Set(['100']), excludedDocNumbers: new Set(['3648.500']),
  });
  ok(p.skipCounts['already-ordered'] === 1 && p.skipCounts['captured-by-hand'] === 0,
     'C1 the structural key wins over the blunt instrument, and each invoice is counted ONCE');
  ok(p.skipped.length === 1, 'C1b — counted once, not twice');
}
{
  // A doc-number-excluded invoice must NOT be probed for a customer first: the skip is cheaper
  // and the customer may legitimately be absent.
  const p = plan([inv({ CustomerRef: { value: '9999' } })], { excludedDocNumbers: new Set(['3648.500']) });
  ok(p.skipCounts['captured-by-hand'] === 1 && p.skipCounts['no-customer'] === 0,
     'C2 the hand-capture skip is decided before the customer lookup');
}

// ─── D · AN INVOICE WITH NO DOCUMENT NUMBER CANNOT BE EXCLUDED BY ONE
// ⚠️ THE `docNumber !== null` GUARD IS DEFENSIVE, NOT BEHAVIOURAL, AND THIS SAYS SO RATHER THAN
// CLAIMING A SCORE IT DID NOT EARN. Mutating it to `excludedDocNumbers.has(String(docNumber))`
// SURVIVES D1 — `String(null)` is `"null"`, and `str()` maps the empty string to null, so
// docNumber is never `''`. The two forms differ only if an exclusion set literally holds the text
// "null". PROVEN EQUIVALENT by that reasoning, not by the probe; D1 documents the intent.
{
  const p = plan([inv({ DocNumber: null })], { excludedDocNumbers: new Set(['3648.500']) });
  ok(p.planned.length === 1,
     'D1 a null document number matches NO exclusion — it must not collide with the empty string');
}

// ─── E · VOLUME AND THE RUN ID
{
  const many = Array.from({ length: 50 }, (_, i) => inv({ Id: String(1000 + i), DocNumber: `D${i}` }));
  const p = plan(many);
  ok(p.planned.length === 50 && p.lineCount === 50, 'E1 fifty invoices plan fifty orders and fifty lines');
  ok(p.runningTotalsDropped === 50, 'E2 and fifty running totals are dropped, counted');
  ok(p.runId === RUN, 'E3 🔴 the plan carries the LOAD\'S run id — one load, one id, one undo (R-165)');
}
console.log(`\n  historyLoad — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
