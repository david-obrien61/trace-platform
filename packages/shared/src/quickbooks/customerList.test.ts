/**
 * ── customerList — sizing a pile of 1,900 real people without painting them on a screen ──
 *
 * The customer-specific half of the QuickBooks read: the row shape, the field coverage, the
 * duplicate sizing, and the preview cap.
 *
 * 🔴 WHAT MAKES THIS FILE DIFFERENT FROM itemList.test.ts. An item is a product. A customer is
 * a person, and there are roughly 1,900 of them in LAWNS's books with addresses, phones and
 * email. Two of the assertions here are therefore not about correctness at all — §E asserts
 * that the PREVIEW CAP CANNOT BE WIDENED BY A CALLER, because a limit that lives at the call
 * site is a limit one future call site forgets, and the failure mode is 1,900 people rendered
 * on a screen somebody screenshots.
 *
 * 🔴 THE NUMBERS THIS PRODUCES WILL SIZE A BUILD, so overstating them is as harmful as missing
 * them. §D is written both directions for that reason: a resolver scoped against "600 records
 * share a phone" when the truth is 40 is a project nobody needed.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/customerList.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  parseCustomerList, summariseCustomers, previewCustomers, CUSTOMER_PREVIEW_LIMIT,
} from './customerList';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const body = (rows: unknown[]) => JSON.stringify({ QueryResponse: { Customer: rows }, time: 'x' });

// ══ §A THE ROW — Intuit's nesting, read rather than assumed ═════════════════
{
  const r = parseCustomerList(body([{
    Id: '58', DisplayName: 'Bishop Landscaping', CompanyName: 'Bishop Landscaping LLC', Active: true,
    PrimaryEmailAddr: { Address: 'lauren@example.com' },
    PrimaryPhone: { FreeFormNumber: '(512) 456-3632' },
    BillAddr: { Line1: '400 Honeycomb Mesa', City: 'Leander', CountrySubDivisionCode: 'TX', PostalCode: '78641' },
  }]));
  ok(r.ok === true && r.customers.length === 1, 'a real customer row parses');
  const c = r.customers[0];
  ok(c.email === 'lauren@example.com', 'the email is read from PrimaryEmailAddr.Address, which is NESTED — a flat read returns undefined and every coverage number then reads 0');
  ok(c.phone === '(512) 456-3632', 'the phone is read from PrimaryPhone.FreeFormNumber and kept VERBATIM — normalisation happens for comparison only, never to the displayed value');
  ok(c.address !== null && c.address.includes('Leander'), 'the address is assembled from BillAddr');
  ok(c.companyName === 'Bishop Landscaping LLC', 'the company name is carried separately from the display name');

  const shipOnly = parseCustomerList(body([{ Id: '1', DisplayName: 'X', ShipAddr: { City: 'Austin' } }]));
  ok(shipOnly.customers[0].address !== null, 'a customer with only a ShipAddr still HAS an address — either one counts for coverage');

  const mobileOnly = parseCustomerList(body([{ Id: '2', DisplayName: 'Y', Mobile: { FreeFormNumber: '5551234567' } }]));
  ok(mobileOnly.customers[0].phone === '5551234567', 'a mobile-only customer HAS a phone — ignoring Mobile would undercount reachability');
}

// ══ §B MISSING IS MISSING — never invented, never coerced ═══════════════════
{
  const sparse = parseCustomerList(body([{ Id: '7', DisplayName: 'Bare' }]));
  const c = sparse.customers[0];
  ok(c.email === null, 'an absent email is null — never an empty string that a truthiness check would count differently');
  ok(c.phone === null, 'an absent phone is null');
  ok(c.address === null, 'an absent address is null');
  ok(c.active === null, 'an absent Active is null — NOT true. "We were not told" and "they are active" are different (D-9 / A9)');

  const blankEmail = parseCustomerList(body([{ Id: '8', DisplayName: 'Z', PrimaryEmailAddr: { Address: '   ' } }]));
  ok(blankEmail.customers[0].email === null,
    '🔴 a whitespace-only email is NOT an email. Counted as one it inflates the coverage number that decides whether an email-based import is viable');

  const emptyAddr = parseCustomerList(body([{ Id: '9', DisplayName: 'W', BillAddr: {} }]));
  ok(emptyAddr.customers[0].address === null, 'an address object with no lines in it is not an address');

  const noName = parseCustomerList(body([{ Id: '10' }]));
  ok(noName.customers[0].displayName === '(unnamed)', 'a nameless record renders as an explicit "(unnamed)" rather than a blank that reads as a rendering bug');

  const noId = parseCustomerList(body([{ DisplayName: 'Ghost' }, { Id: '11', DisplayName: 'Real' }]));
  ok(noId.customers.length === 1 && noId.customers[0].id === '11', 'a row with no Id is dropped — it cannot be a CustomerRef target');
}

// ══ §C EMPTY IS NOT UNREADABLE ══════════════════════════════════════════════
{
  const empty = parseCustomerList(JSON.stringify({ QueryResponse: {} }));
  ok(empty.ok === true && empty.customers.length === 0 && empty.parseError === null,
    'a company with no customers is a SUCCESSFUL read of an empty list');
  const broken = parseCustomerList('<html>502</html>');
  ok(broken.ok === false && broken.parseError !== null, 'an unreadable body says so');
  ok(empty.ok !== broken.ok, '🔴 and the two are distinguishable — a failed read must never render as "this company has no customers"');
}

// ══ §D DUPLICATE SIZING — both directions, because both directions mislead ══
{
  const rows = parseCustomerList(body([
    { Id: '1', DisplayName: 'A', PrimaryEmailAddr: { Address: 'terry@lawns.com' }, PrimaryPhone: { FreeFormNumber: '(512) 456-3632' } },
    { Id: '2', DisplayName: 'B', PrimaryEmailAddr: { Address: 'Terry@LAWNS.com' }, PrimaryPhone: { FreeFormNumber: '512-456-3632' } },
    { Id: '3', DisplayName: 'C', PrimaryEmailAddr: { Address: 'terry@lawns.com' }, PrimaryPhone: { FreeFormNumber: '+1 512 456 3632' } },
    { Id: '4', DisplayName: 'D', PrimaryEmailAddr: { Address: 'lauren@lawns.com' }, PrimaryPhone: { FreeFormNumber: '5125550000' } },
    { Id: '5', DisplayName: 'E' },
  ])).customers;
  const s = summariseCustomers(rows);

  ok(s.total === 5, 'the total is the row count');
  ok(s.withEmail === 4 && s.withPhone === 4, 'coverage counts records that HAVE the field');
  ok(s.withNoContactAtAll === 1,
    '🔴 a record with no email, no phone and no address is counted on its own — it is unreachable AND unmatchable, and it is the population an import silently drops');

  ok(s.byEmail.sharedValues === 1, 'three records on one mailbox is ONE shared address, not three');
  ok(s.byEmail.recordsInvolved === 3, 'and THREE records sit on it — that is the size of the pile somebody has to look through');
  ok(s.byEmail.largestCluster === 3, 'and the largest cluster is 3');
  ok(s.byEmail.sharedValues !== s.byEmail.recordsInvolved,
    '🔴 THE TWO NUMBERS ARE DIFFERENT AND BOTH MATTER. "40 duplicate emails" is ambiguous between 40 pairs and 40 records; reporting one as the other missizes the build in either direction');

  ok(s.byEmail.recordsInvolved === 3,
    '🔴 CASE-INSENSITIVE: Terry@LAWNS.com and terry@lawns.com are ONE mailbox. Treating them as two people is exactly how email-alone matching cross-billed nine real invoices (D-47 / tech-debt #53)');
  ok(s.byPhone.recordsInvolved === 3,
    '🔴 FORMAT-INSENSITIVE: (512) 456-3632, 512-456-3632 and +1 512 456 3632 are ONE number. Comparing raw strings would report zero duplicates against books full of them');

  // The other direction — overstating is equally wrong.
  const short = summariseCustomers(parseCustomerList(body([
    { Id: '1', DisplayName: 'A', PrimaryPhone: { FreeFormNumber: '101' } },
    { Id: '2', DisplayName: 'B', PrimaryPhone: { FreeFormNumber: '101' } },
  ])).customers);
  ok(short.byPhone.recordsInvolved === 0,
    '🔴 AND THE OTHER DIRECTION: two extensions both reading "101" are NOT a duplicate. Overstating the pile scopes a resolver nobody needed, which misleads exactly as much as missing one');
  ok(short.withPhone === 2, 'though both records still COUNT as having a phone — coverage and comparability are different questions');

  const none = summariseCustomers(parseCustomerList(body([{ Id: '1', DisplayName: 'A', PrimaryEmailAddr: { Address: 'a@b.com' } }])).customers);
  ok(none.byEmail.sharedValues === 0 && none.byEmail.recordsInvolved === 0, 'a list with no duplicates reports none');
  ok(none.byEmail.largestCluster === 1, 'and its largest cluster is 1 — every value held once');

  const empty = summariseCustomers([]);
  ok(empty.total === 0 && empty.byEmail.largestCluster === 0,
    'an EMPTY list has no cluster at all and reports 0 rather than a fabricated 1');
  ok(empty.withEmail === 0 && empty.withNoContactAtAll === 0, 'and every coverage count is zero without dividing by anything');
}

// ══ §E THE PREVIEW CAP — the clause that protects 1,900 people ══════════════
{
  const many = parseCustomerList(body(
    Array.from({ length: 50 }, (_, i) => ({ Id: String(i + 1), DisplayName: `Person ${i + 1}` })),
  )).customers;

  ok(previewCustomers(many).length === CUSTOMER_PREVIEW_LIMIT, 'the default preview is the cap');
  ok(CUSTOMER_PREVIEW_LIMIT <= 10, 'and the cap is small enough to be a SHAPE rather than a list');
  ok(previewCustomers(many, 2).length === 2, 'a caller may ask for FEWER');
  ok(previewCustomers(many, 1000).length === CUSTOMER_PREVIEW_LIMIT,
    '🔴 THE CLAUSE THAT MATTERS: a caller CANNOT ask for more. The cap is enforced here, not at the call site — a limit that lives in the caller is a limit one future caller forgets, and the failure mode is 1,900 real people painted on a screen');
  ok(previewCustomers(many, -1).length === CUSTOMER_PREVIEW_LIMIT, 'a negative limit falls back to the CAP — the one fallback a nonsense value must never take is "no limit"');
  ok(previewCustomers(many, NaN).length === CUSTOMER_PREVIEW_LIMIT, 'a nonsense limit falls back to the cap, never to "no limit"');
  ok(previewCustomers([]).length === 0, 'an empty list previews as empty');
  ok(previewCustomers(many)[0].id === '1', 'the preview is the FIRST rows, in the order the books returned them — not a sample somebody has to reason about');
}

console.log(`\ncustomerList: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
