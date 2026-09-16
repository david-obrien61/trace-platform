/**
 * transactionList — probes for the five transaction reads added in #341, and for the custom-field
 * count that lets an empty `CustomField` array mean "none" once the request asks for them.
 *
 * Run: node scripts/run-tests.mjs transactionList
 */
import { summariseTransactions, countWithCustomFields } from './transactionList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const page = (entity: string, rows: unknown[]) => JSON.stringify({ QueryResponse: { [entity]: rows } });

// ── §A money, dates and links ────────────────────────────────────────────────
{
  const b = summariseTransactions([
    page('RefundReceipt', [
      { Id: '1', TxnDate: '2026-09-04', TotalAmt: 8183.7, Line: [] },
      { Id: '2', TxnDate: '2026-01-02T00:00:00', TotalAmt: 10 },
      { Id: '3', TotalAmt: 'n/a' },
    ]),
    page('RefundReceipt', [{ Id: '4', TxnDate: '2026-03-03', TotalAmt: 0, LinkedTxn: [{ TxnId: '7', TxnType: 'Invoice' }] }]),
  ], 'RefundReceipt');
  ok(b.entity === 'RefundReceipt' && b.total === 4, 'every record across every page is counted');
  ok(b.withAmount === 3 && b.amountTotal === 8193.7,
    '🔴 an unreadable TotalAmt is not $0 — it is left out of the sum and out of withAmount, and a real $0 is kept');
  ok(b.dateRange.earliest === '2026-01-02' && b.dateRange.latest === '2026-09-04' && b.dateRange.undated === 1,
    'the date range is read from TxnDate, a timestamp is cut to its date, and an undated record is counted as undated');
  ok(b.linkedToAnInvoice === 1, 'a top-level link to an Invoice counts');
}

// ── §B links on a line (how a Payment records what it paid) ──────────────────
{
  const b = summariseTransactions([page('Payment', [
    { Id: '1', Line: [{ LinkedTxn: [{ TxnId: '9', TxnType: 'Invoice' }] }] },
    { Id: '2', Line: [{ LinkedTxn: [{ TxnId: '9', TxnType: 'CreditMemo' }] }] },
    { Id: '3' },
  ])], 'Payment');
  ok(b.linkedToAnInvoice === 1, 'a line-level link to an Invoice counts; a link to anything else does not');
}

// ── §C 🔴 custom fields — a DEFINED-BUT-EMPTY field is not data ──────────────
{
  const bodies = [page('Invoice', [
    { Id: '1', CustomField: [] },
    { Id: '2', CustomField: [{ DefinitionId: '1', Name: 'Crew', Type: 'StringType' }] },
    { Id: '3', CustomField: [{ DefinitionId: '1', Name: 'Crew', Type: 'StringType', StringValue: '' }] },
    { Id: '4', CustomField: [{ DefinitionId: '1', Name: 'Crew', Type: 'StringType', StringValue: 'M' }] },
    { Id: '5', CustomField: [{ DefinitionId: '2', Name: 'Paid', BooleanValue: false }] },
    { Id: '6' },
  ])];
  ok(countWithCustomFields(bodies, 'Invoice') === 2,
    '🔴 only records with a VALUE count — an empty string or a bare definition is a field nobody filled in (false is a value)');
  ok(countWithCustomFields(bodies, 'Estimate') === 0, 'the entity key is honoured — invoice rows are not read as estimates');
  ok(countWithCustomFields(['{not json'], 'Invoice') === 0, 'an unreadable page contributes nothing rather than throwing');
}

// ── §D an empty read is an empty breakdown, never a fabricated range ─────────
{
  const b = summariseTransactions([JSON.stringify({ QueryResponse: {} })], 'Estimate');
  ok(b.total === 0 && b.amountTotal === 0 && b.dateRange.earliest === null && b.dateRange.latest === null,
    'no records → no dates, not a made-up range');
}

console.log(`\n  transactionList — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
