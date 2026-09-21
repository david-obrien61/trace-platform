// Probes for planCaptureRelink (ledger #372). The risk is NOT arithmetic — it is moving a sale
// onto the wrong customer, which no screen would ever say out loud.
import { planCaptureRelink, type CaptureRow, type InvoiceRow } from './captureRelink';
let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); } };

const cap = (o: Partial<CaptureRow> = {}): CaptureRow =>
  ({ id: 'cap1', customerId: 'twin', documentNumber: '3648.679', saleDate: '2026-09-15', totalAmount: 3464, ...o });
const inv = (o: Partial<InvoiceRow> = {}): InvoiceRow =>
  ({ id: 'i1', docNumber: '3648.679', txnDate: '2026-09-15', totalAmt: 3464, qbCustomerId: '2760', ...o });
const plan = (captures: CaptureRow[], invoices: InvoiceRow[], map = new Map([['2760', 'imported']]), load = new Set(['imported'])) =>
  planCaptureRelink({ captures, invoices, customerIdByQbId: map, loadCustomerIds: load });

// ─── A · THE MATCH
{
  const p = plan([cap()], [inv()]);
  ok(p.matches.length === 1, 'A1 a capture whose invoice agrees is linked');
  ok(p.matches[0]?.fromCustomerId === 'twin' && p.matches[0]?.toCustomerId === 'imported',
     'A2 it moves from the twin to the imported customer');
  ok(p.matches[0]?.corroboratedOn.join(',') === 'sale_date,total_amount',
     'A3 and it records WHAT agreed — both, here');
  ok(p.capturesRead === 1, 'A4 the denominator is reported');
}
// ─── B · ONE FIELD IS ENOUGH; ZERO IS NOT
{
  ok(plan([cap({ totalAmount: 9999 })], [inv()]).matches[0]?.corroboratedOn.join() === 'sale_date',
     'B1 date alone corroborates');
  ok(plan([cap({ saleDate: '2020-01-01' })], [inv()]).matches[0]?.corroboratedOn.join() === 'total_amount',
     'B2 amount alone corroborates');
  const none = plan([cap({ saleDate: '2020-01-01', totalAmount: 9999 })], [inv()]);
  ok(none.matches.length === 0 && none.refusalCounts['no-corroboration'] === 1,
     'B3 🔴 the number ALONE never links — an anchor is not an identity (#250)');
  ok(/anchor, not an identity/.test(none.refusals[0]?.detail ?? ''), 'B3b and the refusal SAYS why');
}
// ─── C · MONEY IS COMPARED TO THE CENT, NOT APPROXIMATELY
{
  ok(plan([cap({ saleDate: null, totalAmount: 3464.00 })], [inv({ txnDate: null, totalAmt: 3464.009 })]).matches.length === 1,
     'C1 a rounding hair still matches — two records of ONE invoice');
  ok(plan([cap({ saleDate: null, totalAmount: 3464 })], [inv({ txnDate: null, totalAmt: 3465 })]).matches.length === 0,
     'C2 a dollar apart does NOT — that is a different sale');
}
// ─── D · THE DUPLICATE DOCUMENT NUMBER, WHICH IS THE WHOLE REASON FOR CORROBORATION
{
  // #250's real finding: 22 numbers used twice at LAWNS, each pair a different customer AND amount.
  const two = [inv({ id: 'a', qbCustomerId: '2760', totalAmt: 811.88 }),
               inv({ id: 'b', qbCustomerId: '9999', totalAmt: 4717.50 })];
  const map = new Map([['2760', 'imported'], ['9999', 'other']]);
  const p = plan([cap({ saleDate: null, totalAmount: 811.88 })], two, map);
  ok(p.matches.length === 1 && p.matches[0]?.toCustomerId === 'imported',
     'D1 🔴 two invoices share the number and the MONEY separates them — it still resolves');
  const both = plan([cap({ saleDate: null, totalAmount: null })], two, map);
  ok(both.matches.length === 0 && both.refusalCounts['no-corroboration'] === 1,
     'D2 with nothing to corroborate on, neither is chosen');
  const amb = plan([cap({ saleDate: '2026-09-15', totalAmount: null })],
                   [inv({ id: 'a', qbCustomerId: '2760' }), inv({ id: 'b', qbCustomerId: '9999' })], map);
  ok(amb.matches.length === 0 && amb.refusalCounts['ambiguous-invoice'] === 1,
     'D3 🔴 when BOTH still agree it REFUSES — it never picks one');
}
// ─── E · THE REFUSALS THAT PROTECT A STRANGER'S RECORD
{
  ok(plan([cap({ documentNumber: null })], [inv()]).refusalCounts['no-document-number'] === 1, 'E1 no number, no anchor');
  ok(plan([cap()], []).refusalCounts['no-invoice'] === 1, 'E2 no invoice carries it');
  ok(plan([cap()], [inv({ qbCustomerId: 'nope' })]).refusalCounts['no-customer-row'] === 1,
     'E3 🔴 a QuickBooks customer with no row here is REFUSED — this pass never mints a customer');
  ok(plan([cap({ customerId: 'imported' })], [inv()]).refusalCounts['already-linked'] === 1,
     'E4 a capture already on a load customer is left alone');
  ok(plan([cap({ customerId: 'twin' })], [inv()], new Map([['2760','twin']]), new Set(['twin'])).refusalCounts['already-linked'] === 1,
     'E4b and one already on its destination is not moved onto itself');
}
// ─── F · NOTHING IS MUTATED
{
  const c = cap(); const i = inv(); const before = JSON.stringify([c, i]);
  plan([c], [i]);
  ok(JSON.stringify([c, i]) === before, 'F1 the planner is pure — its inputs are untouched');
}
console.log(`\n  captureRelink — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
