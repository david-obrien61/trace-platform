/**
 * ── invoiceGrid — the wrong answer a user would never see coming ──────────────────────
 *
 * 🔴 WHAT IS UNDER TEST IS A LIE THE PAGE TELLS WHILE LOOKING COMPLETELY NORMAL. A grid whose
 * search filters over the rows it was handed will answer *"when did I last invoice this job"*
 * with NOTHING FOUND for an invoice that exists, and every pixel of that screen is correct:
 * the table is real, the count is real, the search box works, the result is empty. There is no
 * error state, no spinner, no red. Observing the surface cannot find this class — which is
 * exactly why David asked for it PROVOKED rather than observed:
 *
 *   *"Observing it at 37 rows proves nothing, and this is the defect I would never see coming
 *    as a user."*
 *
 * So §B builds a set LARGER THAN THE CEILING and asks for a row that fell off the bottom. The
 * receipts surface could never do this — it has 37 rows and the failure begins above 100.
 *
 * ⚠️ AND NOTHING MECHANICAL GUARDS THIS SURFACE. The UI divergence cap scans
 * `packages/cultivar-os/src`; this module and its consumer are both in `packages/shared`, so
 * the conversion is invisible to `npm run verify` in both directions. These probes and the
 * owner-test cards are the only guard there is.
 *
 * §A  ordering and the uncapped case — the search really can see everything
 * §B  🔴 THE CAP PROVOKED — a row above the ceiling, and the sentence that must accompany it
 * §C  the count pill's denominator, and the caption it must not contradict
 * §D  red is only what she can act on — and flags are facts about the BOOKS, not about the page
 * §E  🔴 no buyer name is searchable, and it cannot become searchable
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/invoiceGrid.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { buildInvoiceGrid, invoiceSearchText, INVOICE_RENDER_CEILING } from './invoiceGrid';
import type { QboInvoiceRow } from './invoiceList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

/** A day offset from 2020-01-01, so a large set spans real, ordered, distinct dates. */
function dayStr(n: number): string {
  return new Date(Date.UTC(2020, 0, 1 + n)).toISOString().slice(0, 10);
}

const inv = (o: Partial<QboInvoiceRow> & { id: string }): QboInvoiceRow => ({
  docNumber: `D-${o.id}`, txnDate: '2026-05-01', totalAmt: 100, balance: 0,
  dueDate: '2026-06-01', customerId: `c-${o.id}`,
  lines: [{ detailType: 'SalesItemLineDetail', itemId: '1', itemName: 'Live Oak',
            qty: 1, amount: 100, unitPrice: 100 }],
  ...o,
});

/** N invoices, oldest first by construction, one per day, each with a distinct number. */
const many = (n: number): QboInvoiceRow[] =>
  Array.from({ length: n }, (_, i) => inv({ id: String(i), txnDate: dayStr(i), docNumber: `INV-${i}` }));

/** The screen's own search: the grid's text, filtered the way `<DataSheet>` filters (G6). */
const search = (m: ReturnType<typeof buildInvoiceGrid>, q: string) =>
  m.rows.filter(r => invoiceSearchText(r.row).toLowerCase().includes(q.toLowerCase()));

// ══════════════════════════════════════════════════════════════════════════════════════════
// §A THE UNCAPPED CASE — AND THE POINT IS THAT LAWNS IS IN IT
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const LAWNS = 1480;                       // their live invoice count, measured 2026-09-04
  const m = buildInvoiceGrid(many(LAWNS));

  ok(m.total === LAWNS, `all ${LAWNS} invoices are counted`);
  ok(m.capped === false,
    `🔴 at LAWNS's real 1,480 the grid is NOT capped — the ceiling is ${INVOICE_RENDER_CEILING}, and the old 100 is what made a correct-looking page wrong`);
  ok(m.rows.length === LAWNS, 'and every one of them is rendered, so the client-side search is exact');

  // The row that the predecessor cap dropped: oldest of 1,480, far below the newest 100.
  const oldest = search(m, 'INV-0');
  ok(oldest.length === 1,
    '🔴 THE 2020 INVOICE IS FINDABLE — under the old 100-row cap this returned NOTHING FOUND for an invoice that exists, and the page looked completely normal');
  ok(m.searchScope === 'Searching all 1,480 invoices.',
    'and the search box states its scope positively rather than saying nothing');

  // G9 — most recent DOCUMENT date first.
  ok(m.rows[0].row.txnDate === dayStr(LAWNS - 1) && m.rows[LAWNS - 1].row.txnDate === dayStr(0),
    'newest document date first, oldest last (G9)');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// §B 🔴 THE CAP, PROVOKED — THIS IS THE SECTION DAVID ASKED FOR
// ══════════════════════════════════════════════════════════════════════════════════════════
// A ceiling is passed explicitly so the case is reachable without building 5,001 rows. The
// ceiling is a PARAMETER precisely so this failure can be exercised at a size a test can hold —
// a defect that only occurs at a scale no probe can reach is a defect no probe will ever catch.
{
  const CEIL = 100;
  const m = buildInvoiceGrid(many(1480), CEIL);

  ok(m.capped === true, 'over the ceiling, the model KNOWS it is capped');
  ok(m.rows.length === CEIL, `and renders exactly ${CEIL} rows`);
  ok(m.total === 1480, 'while still counting all 1,480 — the denominator never shrinks to the page');

  // ── the wrong answer, reproduced ────────────────────────────────────────────────────
  const missing = search(m, 'INV-0');
  ok(missing.length === 0,
    '🔴 THE DEFECT REPRODUCED: a search for a real 2020 invoice returns ZERO rows, because it fell below the cap');

  // ── and the sentence that must accompany it ─────────────────────────────────────────
  ok(m.searchScope.includes('100') && m.searchScope.includes('1,480'),
    '🔴 …so the SEARCH BOX names both the slice and the whole — R-75: a search that cannot see the whole set says so');
  ok(/will not be found here/i.test(m.searchScope),
    '🔴 and it says the consequence in words, not merely the arithmetic — "older ones are not on this page and will not be found here"');
  ok(m.searchScope.indexOf('all ') === -1,
    'and it never claims to be searching "all" of anything while capped');

  // ── NEGATIVE CONTROL (R-33): could these have failed? ───────────────────────────────
  // The same query against the same data with the ceiling lifted must FIND the row. If it did
  // not, §B would be passing because the fixture is broken rather than because the cap bites.
  const lifted = buildInvoiceGrid(many(1480), 5000);
  ok(search(lifted, 'INV-0').length === 1,
    '🔴 NEGATIVE CONTROL — the identical query finds the identical row once the ceiling is lifted: the cap is what hid it, not the fixture');
  ok(lifted.searchScope !== m.searchScope,
    'and the two scopes read differently, so the sentence is derived from the state rather than hardcoded');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// §C THE COUNT PILL'S DENOMINATOR, AND THE CAPTION IT MUST NOT CONTRADICT
// ══════════════════════════════════════════════════════════════════════════════════════════
// `<DataSheet>` renders `{view.length} of {rows.length}` — it counts what it was HANDED and
// cannot know about a cap applied before it. Handed 100 of 1,480 it says "100 of 100 invoices",
// one line under a caption correctly saying 1,480. David: *"It contradicts its own page."*
// The pill is not changed here (that is a change to eight consumers); what is asserted is that
// this model never hands the engine a slice while telling the reader it is the whole.
{
  const uncapped = buildInvoiceGrid(many(1480));
  ok(uncapped.rows.length === uncapped.total,
    '🔴 uncapped, the engine is handed EVERY row — so its own "N of N" pill is true without the engine being taught anything');
  ok(uncapped.caption === 'Showing all 1,480 invoices, newest first.',
    'and the caption agrees with the pill instead of contradicting it');

  const capped = buildInvoiceGrid(many(1480), 100);
  ok(capped.caption.includes('100') && capped.caption.includes('1,480'),
    'capped, the caption carries BOTH numbers — the pill will say "100 of 100" and the caption is what disambiguates it');
  ok(capped.rows.length !== capped.total,
    '🔴 and the model can tell the two apart, which is the fact the engine structurally cannot');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// §D RED IS ONLY WHAT SHE CAN ACT ON — AND A FLAG IS A FACT ABOUT THE BOOKS
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const rows = [
    inv({ id: '1', docNumber: 'A-1', txnDate: '2026-05-01', customerId: 'c1' }),
    inv({ id: '2', docNumber: 'A-1', txnDate: '2026-05-02', customerId: 'c2' }),  // dup number
    inv({ id: '3', docNumber: 'A-3', txnDate: '2026-05-03', customerId: 'c9' }),  // dup cust/day
    inv({ id: '4', docNumber: 'A-4', txnDate: '2026-05-03', customerId: 'c9' }),  // "
    inv({ id: '5', docNumber: null,  txnDate: '2026-05-04', customerId: 'c5' }),  // unreadable
    inv({ id: '6', docNumber: 'A-6', txnDate: '2026-05-05', customerId: 'c6', totalAmt: 999999 }),
    inv({ id: '7', docNumber: 'A-7', txnDate: null,         customerId: 'c7' }),
  ];
  const m = buildInvoiceGrid(rows);
  const flagOf = (id: string) => m.rows.find(r => r.row.id === id)?.flag;

  ok(flagOf('1') === 'duplicate-number' && flagOf('2') === 'duplicate-number',
    'BOTH halves of a reused invoice number are flagged — flagging one would make the other look correct');
  ok(flagOf('3') === 'duplicate-customer-same-day' && flagOf('4') === 'duplicate-customer-same-day',
    'a customer billed twice on one day is flagged, on both rows');
  ok(flagOf('5') === 'unreadable',
    'a row we could not read is flagged as unreadable — never silently dropped, never rendered as a real one');
  ok(flagOf('6') === null,
    '🔴 A LARGE AMOUNT IS NOT RED. It is true, it is not actionable at this table, and red spent on it is red she stops reading');
  ok(flagOf('7') === null,
    '🔴 AND A MISSING DATE IS NOT RED EITHER — the cell says "No date recorded" (D-9), which is the honest rendering; it is not a defect she can act on here');
  ok(m.flaggedCount === 5, 'five flagged rows out of seven — the count is over the set, not a guess');

  // ── the flag is a fact about the BOOKS, not about the page ──────────────────────────
  // One twin above the ceiling, one below. The visible twin is still a duplicate.
  const split = buildInvoiceGrid([
    inv({ id: 'old', docNumber: 'SAME', txnDate: '2020-01-01', customerId: 'cA' }),
    inv({ id: 'new', docNumber: 'SAME', txnDate: '2026-01-01', customerId: 'cB' }),
  ], 1);
  ok(split.rows.length === 1 && split.rows[0].row.id === 'new',
    'with a ceiling of 1 only the newest survives');
  ok(split.rows[0].flag === 'duplicate-number',
    '🔴 and it is STILL RED — a duplicate is a fact about their books, so a flag computed over the visible page would make redness depend on where the ceiling happened to fall');
  ok(split.flaggedCount === 2,
    'and the banner counts BOTH, including the one the cap is hiding');

  // ── the ordering decision, asserted rather than assumed ─────────────────────────────
  const both = buildInvoiceGrid([
    inv({ id: 'x', docNumber: null, txnDate: '2026-05-01', customerId: 'cz' }),
    inv({ id: 'y', docNumber: null, txnDate: '2026-05-01', customerId: 'cz' }),
  ]);
  ok(both.rows.every(r => r.flag === 'unreadable'),
    '🔴 unreadable OUTRANKS duplicate — a row we failed to parse has an UNKNOWN duplicate status, and calling it a duplicate asserts something about bytes we could not read');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// §E 🔴 NOTHING SEARCHABLE NAMES A PERSON, AND IT CANNOT COME TO
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const r = inv({ id: '1', docNumber: 'A-77', txnDate: '2026-05-01', customerId: 'cust-9' });
  const text = invoiceSearchText(r);

  ok(text.includes('A-77'), 'the invoice NUMBER is searchable — R-77: a document identifier is not personal data');
  ok(text.includes('Live Oak'), 'and so is the ITEM NAME — R-77 permits items in full, and it is what recognition runs on');
  ok(text.includes('2026-05-01') && text.includes('100'), 'with the date and the total');
  ok(text.indexOf('cust-9') === -1,
    '🔴 the customer reference is NOT searchable — searching by it would be a route to a person via a field that exists only to link rows');

  // The structural half, asserted so a future author cannot quietly widen it.
  ok(!('customerName' in r) && !('customerEmail' in r) && !('billAddress' in r),
    '🔴 and there is no name, email or address ON THE ROW TO SEARCH — R-77 holds by the shape of the type, not by this function staying careful');
  ok(Object.keys(r).filter(k => /name|email|phone|addr/i.test(k)).length === 0,
    'no field on an invoice row matches name/email/phone/address at all');
}

console.log(`\n  invoiceGrid — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
