/**
 * ── sameDocument — four fields, not one ───────────────────────────────────────────────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. The rule this replaces compared ONE field and reported 44
 * invoices under a risk heading, all of which were a bookkeeper renumbering deliberately. So the
 * probes below are about the two ways this one can go back to being noise:
 *   §A  `DocNumber` creeps back into the key, and a renumbering reads as a duplicate again
 *   §B  one of the four stops being compared, and two different documents read as one
 * and the two ways it can go silent: §C an unreadable field absorbed, §D nothing comparable
 * reported as clean.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/sameDocument.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { censusSameDocuments, documentSignature } from './sameDocument';
import type { QboInvoiceRow, QboInvoiceLine } from './invoiceList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const line = (itemId: string, qty: number, unitPrice: number, amount: number): QboInvoiceLine => ({
  detailType: 'SalesItemLineDetail', itemId, itemName: itemId, qty, amount, unitPrice,
  discountInDescription: false, percentBased: null, discountPercent: null,
  installInDescription: false, itemAccountName: null, sizeFromDescription: null,
  replacementInDescription: false,
});
const inv = (id: string, o: Partial<QboInvoiceRow> = {}): QboInvoiceRow => ({
  id, docNumber: id, txnDate: '2025-10-01', totalAmt: 100, balance: 0, dueDate: null,
  customerId: 'c1', lines: [line('t', 1, 100, 100)], ...o,
});

// ══ §A 🔴 THE REUSED NUMBER IS NOT A DUPLICATE, AND THE NUMBER IS NOT IN THE KEY ═══════════
{
  const renumbered = censusSameDocuments([
    inv('a', { docNumber: '4000', totalAmt: 100 }),
    inv('b', { docNumber: '4000', totalAmt: 250, txnDate: '2025-11-02', lines: [line('t', 1, 250, 250)] }),
  ]);
  ok(renumbered.groups.length === 0,
    '🔴 A REUSED INVOICE NUMBER WITH DIFFERENT TOTALS IS NOT A FINDING. That is what a bookkeeper renumbering looks like, and the rule this replaces reported 44 of them');
  ok(renumbered.repeatedNumberGroups === 1 && renumbered.repeatedNumberGroupsAgreeingOnTotal === 0,
    'the retired question is still MEASURED, so the replacement can say why repeated numbers are not counted rather than leaving a reader to conclude we stopped looking');

  // ...and the opposite: the same document under two DIFFERENT numbers IS found.
  const twoNumbers = censusSameDocuments([inv('a', { docNumber: '5120' }), inv('b', { docNumber: '5121' })]);
  ok(twoNumbers.groups.length === 1 && twoNumbers.recordsInvolved === 2,
    '🔴 AND THE SAME DOCUMENT UNDER TWO DIFFERENT NUMBERS IS FOUND. Keying on the number would have made a genuinely duplicated document invisible the moment somebody renumbered one of the two — the error in the direction that costs money');
  ok(twoNumbers.groups[0].docNumbers.join(',') === '5120,5121',
    'and both numbers come back, because the number is what lets an owner find the record');
  ok(!documentSignature(inv('a', { docNumber: '5120' })).includes('5120'),
    'the signature itself does not contain the document number — asserted directly, so the key cannot quietly regain it');
}

// ══ §B 🔴 ALL FOUR, AND ANY ONE OF THEM IS ENOUGH TO SAY NOTHING ═══════════════════════════
{
  const base = () => [inv('a'), inv('b')];
  ok(censusSameDocuments(base()).groups.length === 1, 'the control: all four agree');

  const cases: [string, QboInvoiceRow[]][] = [
    ['a different CUSTOMER', [inv('a'), inv('b', { customerId: 'c2' })]],
    ['a different DATE',     [inv('a'), inv('b', { txnDate: '2025-10-02' })]],
    ['a different TOTAL',    [inv('a'), inv('b', { totalAmt: 101 })]],
    ['different LINES',      [inv('a'), inv('b', { lines: [line('u', 1, 100, 100)] })]],
    ['a different QUANTITY', [inv('a'), inv('b', { lines: [line('t', 2, 100, 100)] })]],
  ];
  for (const [what, rows] of cases) {
    ok(censusSameDocuments(rows).groups.length === 0,
      `🔴 ${what} IS ENOUGH TO REPORT NOTHING. All four must agree, or these are two documents and saying otherwise accuses an owner of a mistake they did not make`);
  }

  // the lines are a SORTED multiset — order is not identity, but a repeated line is not collapsed
  const reordered = censusSameDocuments([
    inv('a', { lines: [line('t', 1, 60, 60), line('u', 1, 40, 40)] }),
    inv('b', { lines: [line('u', 1, 40, 40), line('t', 1, 60, 60)] }),
  ]);
  ok(reordered.groups.length === 1,
    'the same lines listed in a different order are the same document — two records of one job need not agree about row order');
  const doubled = censusSameDocuments([
    inv('a', { lines: [line('t', 1, 50, 50), line('t', 1, 50, 50)] }),
    inv('b', { lines: [line('t', 1, 50, 50)], totalAmt: 100 }),
  ]);
  ok(doubled.groups.length === 0,
    '…and a line appearing TWICE is not collapsed into one, so two trees and one tree are not the same document');

  // money is compared in whole cents, not floats
  const pennies = censusSameDocuments([
    inv('a', { totalAmt: 0.1 + 0.2, lines: [line('t', 1, 0.30000000000000004, 0.1 + 0.2)] }),
    inv('b', { totalAmt: 0.3,       lines: [line('t', 1, 0.3, 0.3)] }),
  ]);
  ok(pennies.groups.length === 1,
    '🔴 TWO AMOUNTS THAT AGREE TO THE PENNY ARE ONE AMOUNT. Comparing floats would silently empty this finding on real money');
}

// ══ §C 🔴 AN INVOICE THAT CANNOT BE COMPARED IS DECLARED, NOT DROPPED ══════════════════════
{
  const c = censusSameDocuments([inv('a'), inv('b'), inv('x', { customerId: null }), inv('y', { txnDate: null })]);
  ok(c.comparable === 2 && c.notComparable === 2,
    '🔴 WITHOUT A CUSTOMER OR A DATE THERE IS NO DOCUMENT TO BE THE SAME AS. Those two are counted and named rather than silently swelling the clean population');
  ok(c.groups.length === 1, 'and the pair that could be compared still is');
}

// ══ §D NEGATIVE CONTROLS ═══════════════════════════════════════════════════════════════════
{
  ok(censusSameDocuments([]).comparable === 0 && censusSameDocuments([]).groups.length === 0,
    'an empty walk produces an empty census — and the runner turns a zero population into not-measured, never into a clean bill of health');
  const three = censusSameDocuments([inv('a'), inv('b'), inv('c')]);
  ok(three.groups.length === 1 && three.recordsInvolved === 3,
    'three identical records are ONE group of three, not three pairs — an owner makes one decision about the cluster');
}

console.log(`\n  sameDocument — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
