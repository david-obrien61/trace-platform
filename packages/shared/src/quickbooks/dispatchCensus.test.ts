/**
 * ── dispatchCensus — a collection is not a missing delivery date ──────────────────────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. The rule this replaces told an owner that 881 of her 1,469
 * invoices had no record of when the job happened. [STATED — a prior session's measurement: 639 of
 * those are orders the customer collected, and there is nothing to date on them.] So the probes are
 * about the two ways the separation can quietly stop working:
 *   §A  the predicate narrows and planted trees start reading as collections (crushing the finding)
 *   §B  the predicate widens and collections read as gaps again (restoring the false alarm)
 * plus §C the walk-coverage distinction, which is the difference between "we did not look" and
 * "there is nothing there".
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/dispatchCensus.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { censusDispatchDates, invoiceLeftTheYard } from './dispatchCensus';
import type { QboInvoiceRow, QboInvoiceLine } from './invoiceList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const line = (o: Partial<QboInvoiceLine> = {}): QboInvoiceLine => ({
  detailType: 'SalesItemLineDetail', itemId: 't', itemName: 'Tree', qty: 1, amount: 900, unitPrice: 900,
  discountInDescription: false, percentBased: null, discountPercent: null,
  installInDescription: false, itemAccountName: null, sizeFromDescription: null,
  replacementInDescription: false, ...o,
});
const inv = (id: string, lines: QboInvoiceLine[], totalAmt = 900): QboInvoiceRow =>
  ({ id, docNumber: id, txnDate: '2026-01-01', totalAmt, balance: 0, dueDate: null, customerId: 'c1', lines });

const BARE     = line();
const CARRIAGE = line({ itemId: 'd', itemName: 'TC', amount: 125, unitPrice: 125, itemAccountName: 'Delivery Income' });
const PLANTED  = line({ installInDescription: true });

// ══ §A 🔴 BOTH CLAUSES OF THE PREDICATE, AND NEITHER IS REDUNDANT ══════════════════════════
{
  ok(invoiceLeftTheYard(inv('i', [CARRIAGE])) === true,
    'a line booked to a CARRIAGE account is evidence a truck moved');
  ok(invoiceLeftTheYard(inv('i', [PLANTED])) === true,
    '🔴 AND SO IS A PLANTED LINE WITH NO CARRIAGE CHARGE AT ALL. These books weld the planting into the tree\'s price, so 909 planted lines carry no delivery item — reading only the account would call every one of them a collection and crush the finding to nothing');
  ok(invoiceLeftTheYard(inv('i', [BARE])) === false,
    'and an invoice with neither is a collection');

  // the account axis, not the item name (R-112 / R-50)
  ok(invoiceLeftTheYard(inv('i', [line({ itemName: 'Delivery', itemAccountName: null })])) === false,
    '🔴 AN ITEM NAMED "Delivery" WITH NO CARRIAGE ACCOUNT IS NOT EVIDENCE. The NAME is the shorthand an office types; the INCOME ACCOUNT is the owner\'s own word for what the money is, and guessing from names is the retro-classification R-50 forbids');
  ok(invoiceLeftTheYard(inv('i', [line({ itemName: 'TC', itemAccountName: 'Freight & Shipping' })])) === true,
    '…while a coded item name booked to a carriage account IS, which is the direction that works without a guess');
}

// ══ §B 🔴 THE SEPARATION, AND THE MONEY ON BOTH SIDES OF IT ════════════════════════════════
{
  const invoices = [
    inv('i1', [BARE],     900),   // collected, no date
    inv('i2', [BARE],     900),   // collected, no date
    inv('i3', [CARRIAGE], 125),   // delivered, no date
    inv('i4', [PLANTED],  900),   // planted,   no date
    inv('i5', [CARRIAGE], 125),   // delivered, HAS a date
  ];
  const shipDates = new Map<string, string | null>([
    ['i1', null], ['i2', null], ['i3', null], ['i4', null], ['i5', '2026-01-02'],
  ]);
  const c = censusDispatchDates(invoices, shipDates);
  ok(c.seen === 5 && c.withDate === 1, 'the walk covered five and one of them records a date');
  ok(c.collectedWithoutDate === 2 && c.collectedAmount === 1800,
    '🔴 TWO COLLECTIONS, $1,800, AND THEY ARE NOT A GAP. The old rule counted them among the broken ones, which told an owner most of her history was wrong when it was right');
  ok(c.dispatchedWithoutDate === 2 && c.dispatchedAmount === 1025,
    'and two that genuinely left with no date recorded — the finding, with what it is worth');
  ok(c.collectedWithoutDate + c.dispatchedWithoutDate + c.withDate === c.seen,
    'the three add up to what was seen, so nothing falls between the buckets');

  // a null total contributes to the COUNT and not to the money
  const nullTotal = censusDispatchDates(
    [{ ...inv('i1', [CARRIAGE]), totalAmt: null }],
    new Map<string, string | null>([['i1', null]]));
  ok(nullTotal.dispatchedWithoutDate === 1 && nullTotal.dispatchedAmount === 0,
    'an invoice with no readable total is still counted and adds nothing to the money — the same treatment the receivables rule gives an unreadable balance');
}

// ══ §C 🔴 OUTSIDE THE WALK IS NOT UNDATED ══════════════════════════════════════════════════
{
  const c = censusDispatchDates(
    [inv('i1', [CARRIAGE]), inv('i2', [CARRIAGE]), inv('i3', [CARRIAGE])],
    new Map<string, string | null>([['i1', null]]));
  ok(c.seen === 1 && c.dispatchedWithoutDate === 1,
    '🔴 THE TWO INVOICES THE DISPATCH WALK NEVER COVERED ARE EXCLUDED, NOT COUNTED AS UNDATED. "We did not look" and "there is nothing there" are the two answers a reader cannot tell apart unless the code refuses to conflate them (D-9)');
}

// ══ §D NEGATIVE CONTROLS ═══════════════════════════════════════════════════════════════════
{
  const allDated = censusDispatchDates([inv('i1', [CARRIAGE])],
    new Map<string, string | null>([['i1', '2026-01-02']]));
  ok(allDated.dispatchedWithoutDate === 0 && allDated.collectedWithoutDate === 0 && allDated.withDate === 1,
    'a history where everything is dated reports nothing undated — the census can come back clean');
  ok(censusDispatchDates([], new Map()).seen === 0,
    'and an empty walk produces an empty census, which the runner turns into not-measured rather than a clean bill of health');
}

console.log(`\n  dispatchCensus — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
