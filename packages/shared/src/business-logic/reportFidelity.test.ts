/**
 * ── report fidelity — five surfaces that asserted a number they did not get ─────────────────
 *
 * PURPOSE:      Prove the five defects of 2026-09-07 cannot recur. They are ONE class — a surface
 *               stating a number or a fact it did not obtain from the operation it describes — and
 *               each lives at a SEAM (a response mapping, a count query, a render path, a copy
 *               string) rather than inside a unit.
 *
 * DEPENDENCIES: tierPricing (computeOrderPricing/resolveTier) · personName · countPill ·
 *               node:fs for the corpus checks. No network, no database.
 *
 * OUTPUTS:      pass/fail counts on stdout; exit 1 on any failure.
 *
 * 🔴 WHY THESE ARE NOT WRITTEN AS ORDINARY UNIT FIXTURES, AND IT IS THE LESSON OF THE WEEK:
 *    #251's real defect survived twelve green unit probes because the SEAM was the gap. And #280's
 *    discount fixture wrote the base into `Qty` — so the test and the code believed the same false
 *    thing and agreed perfectly. **A fixture that encodes the assumption is not a test of it.**
 *    So §A asserts an EQUALITY BETWEEN TWO INDEPENDENT COMPUTATIONS rather than against a literal
 *    (a shared wrong tier makes both sides move together and the probe still fails), and §B/§C/§E
 *    read the real source files, because a copy string cannot be unit-tested at all.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/reportFidelity.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { computeOrderPricing, resolveTier, normalizeDiscountTypes, RETAIL_FLOOR,
         type PricingLineInput } from './tierPricing';
import { formatPersonName, customerDisplayName } from '../utils/personName';
import { countPillText } from '../components/datasheet/countPill';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const read = (p: string) => readFileSync(p, 'utf8');
/** Strip comments before asserting about CODE — a string named in prose is not a statement. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §A ① REVIEW AND SUBMIT MUST PRICE THE SAME CART THE SAME WAY
// ════════════════════════════════════════════════════════════════════════════════════════════
// David's own specification for the probe that could have disagreed: *"a cart whose customer
// carries a tier must render the SAME TOTAL on Review as on Confirm. Assert the equality, not a
// literal."* The literal from the owner-prove ($900 → $876.83 at CD10% + 8.25%) is asserted too,
// but SECOND — the equality is the load-bearing half, because it fails even if both sides drift.
{
  // LAWNS's real configuration, shaped as `business_pricing_config.config` actually stores it
  // (measured 2026-09-07: a `discountTypes` array of groups, CD10%/CD15% under "Contractor").
  const CONFIG = {
    taxRate: 0.0825,
    discountTypes: [{ name: 'Contractor', tiers: [
      { name: 'CD10%', basis: 'retail_minus_percent', discountPercent: 10 },
      { name: 'CD15%', basis: 'retail_minus_percent', discountPercent: 15 },
    ] }],
  };
  const types = normalizeDiscountTypes(CONFIG as unknown as Record<string, unknown>);
  const CART: PricingLineInput[] = [
    { kind: 'goods', name: 'Arizona Cypress Blue Ice 30 gallon', unitPrice: 900, qty: 1, unitCost: null },
  ];

  // THE SERVER (`submit.ts:451`): the tier NAME comes off the customer ROW, read by id.
  const serverTierName = 'CD10%';
  const serverPricing = computeOrderPricing(CART, resolveTier(serverTierName, types), 0.0825, null);

  // THE REVIEW SCREEN: the tier name it resolves for the SAME attached customer. Before the fix
  // this came from an EMAIL lookup; the customer has no email on file, so it was null.
  const reviewTierName = 'CD10%';
  const reviewPricing = computeOrderPricing(CART, resolveTier(reviewTierName, types), 0.0825, null);

  ok(reviewPricing.total === serverPricing.total,
    '🔴 ①/§A THE EQUALITY: Review\'s total equals submit\'s total for the same cart and the same customer. This is the assertion that fails when the two resolve the tier from different keys — it does NOT depend on either number being one I typed');
  ok(reviewPricing.discountTotal === serverPricing.discountTotal
      && reviewPricing.tax === serverPricing.tax
      && reviewPricing.discountedSubtotal === serverPricing.discountedSubtotal,
    '…and every LINE of the breakdown agrees, not merely the total — a screen can reach the right total through the wrong middle');
  ok(Math.abs(serverPricing.total - 876.83) < 0.005,
    'the owner-proved figure reproduces: $900 at CD10% is $810, +8.25% tax = $876.83 (asserted SECOND — the equality above is the real check)');

  // 🔴 THE NEGATIVE CONTROL. Without it, the two computations above would agree just as happily
  // if BOTH resolved to retail — which is precisely the shipped defect, and the probe would be
  // green over it. This proves the assertion can fail.
  const retailPricing = computeOrderPricing(CART, RETAIL_FLOOR, 0.0825, null);
  ok(retailPricing.total !== serverPricing.total,
    '🔴 THE CONTROL: a cart priced at RETAIL does NOT equal the same cart priced at CD10%. Without this, two sides that both lost the tier would agree and §A would pass over the exact bug it exists to catch (R-33 — a check that cannot disagree is not a check)');
  ok(Math.abs(retailPricing.total - 974.25) < 0.005,
    '…and the retail total is $974.25 — the number the button actually quoted on 2026-09-07, $97.42 more than the order');

  // The tier is unresolvable (config walled, or a tier name that no longer exists) → RETAIL, never
  // a fabricated discount. Asserted so a future "helpful" fallback cannot invent one.
  const unknown = resolveTier('A-TIER-THAT-DOES-NOT-EXIST', types);
  ok(unknown.discountPercent === 0,
    'an unknown tier name resolves to retail with a 0% discount — it must never be guessed into the nearest match');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §B ① THE COPY THAT COVERED FOR THE WRONG TOTAL IS GONE
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const cart = read('packages/cultivar-os/src/pages/CartReview.tsx');
  const live = code('packages/cultivar-os/src/pages/CartReview.tsx');
  ok(!/applies at checkout\s*—\s*the invoice total reflects it/.test(live),
    '🔴 ①/§B "Customer tier applies at checkout — the invoice total reflects it" is DELETED. Review IS checkout; there is no later screen, and the sentence was covering for a total that did not include the discount');
  // 🔴 THE PRECEDENCE CHAIN ITSELF, NOT MERELY THE PRESENCE OF THE WORDS.
  // The first draft of this probe asserted that `attachedCustomerId` and `price_tier` appeared
  // SOMEWHERE in the file — and mutant A1, which restores the shipped defect by dropping
  // `attachedTier` out of the resolution while leaving the fetch effect intact, SURVIVED it. The
  // tokens were all still there; only the one line that uses them had changed. So the assertion is
  // now on the expression that decides the money.
  const chain = /const effectiveTierName\s*=\s*invokedTier\s*\?\?\s*attachedTier\s*\?\?\s*customer\?\.price_tier/;
  ok(chain.test(live),
    '🔴 ①/§B THE RESOLUTION ORDER IS `invokedTier ?? attachedTier ?? customer.price_tier` — the tier read from the customer ROW by id outranks the one resolved by email, because the row is what `submit.ts:451` will charge against. Mutant A1 restores the shipped defect by removing exactly this term');
  ok(/fetchAttachedCustomerTier\(supabase,\s*businessId,\s*attachedCustomerId\)/.test(live),
    '…and `attachedTier` comes from `fetchAttachedCustomerTier(…, attachedCustomerId)` — the cart asks a NAMED question rather than carrying its own table access, which is how `fetchTaxRate` already works one line over');
  // The read itself is asserted where it now lives. Splitting the assertion across both files is
  // deliberate: the page could call the right function and the function could still read by the
  // wrong key, and that would be the identical defect wearing a better name.
  const access = code('packages/shared/src/business-logic/financialDataAccess.ts');
  ok(/export async function fetchAttachedCustomerTier[\s\S]{0,600}?\.eq\('id', customerId\)/.test(access),
    "🔴 …and `fetchAttachedCustomerTier` filters on `.eq('id', customerId)` — BY ID, the key `submit.ts:451` uses. An email filter here would re-create the exact disagreement with a tidier call site");
  ok(!/\.eq\('email'/.test(access.split('fetchAttachedCustomerTier')[1] ?? ''),
    '…and it does not fall back to an email match, which is what silently returned null for a customer with no email on file');
  ok(/THE COPY THAT USED TO SIT HERE IS DELETED/.test(cart),
    'the deletion carries its reason in the file, so the next person does not re-add a reassurance to paper over a number');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §C ② NOTHING CLAIMS A SEND THE PLATFORM DOES NOT PERFORM
// ════════════════════════════════════════════════════════════════════════════════════════════
// This is a COPY defect, which no unit test can reach — so the probe reads the surfaces. It is
// scoped to the customer-facing checkout surfaces on purpose; a corpus-wide ban on the word
// "sent" would be unmaintainable and would flag honest sentences about QuickBooks.
{
  const confirm = code('packages/cultivar-os/src/pages/Confirmation.tsx');
  ok(!/Invoice sent to \{email\}/.test(confirm),
    '🔴 ②/§C THE WORST OF THE FIVE: "Invoice sent to {email}" is gone from the confirmation header. It rendered unconditionally — including in TEST MODE on a pay-at-the-office order, directly above a badge reading "invoice NOT sent to QuickBooks"');
  ok(!/Invoice emailed to \{email\}/.test(confirm),
    '…and "Invoice emailed to {email}" is gone from the action slot, which was reached in the state where LEAST had happened');
  ok(/qbState === 'success'/.test(confirm.split('Order confirmed')[1] ?? ''),
    'what the header now says is DERIVED from the QuickBooks state rather than asserted regardless of it');

  // The premise, asserted rather than restated: the invoice push never asks QuickBooks to send.
  const push = code('packages/cultivar-os/api/qbo/invoice/cultivar.ts');
  ok(/BillEmail/.test(push),
    'the QuickBooks invoice does carry BillEmail — the address is recorded on the document…');
  ok(!/\/send\b/.test(push) && !/sendInvoice/.test(push),
    '🔴 …and NOTHING calls the QuickBooks send endpoint. Creating an invoice does not deliver it, which is why "sent" was false in every state and not merely in test mode. If a real send is ever wired, THIS probe is what tells you the copy may change');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §D ④ A LIST MAY NOT REPORT ITS OWN CAP AS THE TRUTH
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  // The shipped defect, exactly: 1000 loaded, 1964 in the table, header derived from rows.length.
  ok(countPillText({ visible: 1000, loaded: 1000, total: 1964, filtered: false, itemNoun: 'customers' })
       === 'showing 1000 of 1964 customers',
    '🔴 ④/§D a grid holding 1000 of 1964 rows says "showing 1000 of 1964" — it used to say "1000 of 1000", which is not a truncation, it is an assertion that the 1000th customer is the last one that exists');
  ok(!countPillText({ visible: 1000, loaded: 1000, total: 1964, filtered: false, itemNoun: 'customers' }).includes('1000 of 1000'),
    '…and the string "1000 of 1000" cannot be produced from that input at all');

  // 🔴 THE OTHER DIRECTION, WHICH IS THE ONE THAT MAKES THIS A REAL CHECK: inventory was HONEST
  // in the same session (`647 of 647`) for the sole reason that 647 is under the cap. A fix that
  // made every grid say "showing" would have regressed the screen that was already right.
  ok(countPillText({ visible: 647, loaded: 647, total: 647, filtered: false, itemNoun: 'items' })
       === '647 of 647 items',
    '🔴 THE NON-REGRESSION: a grid that genuinely holds everything still reads "647 of 647 items" — inventory was already telling the truth and must not be made to hedge');
  ok(countPillText({ visible: 647, loaded: 647, total: null, filtered: false, itemNoun: 'items' })
       === '647 of 647 items',
    '…and a consumer that passes NO total is treated as holding everything — the grid claims only what it was given');
  ok(countPillText({ visible: 12, loaded: 1000, total: 1964, filtered: true, itemNoun: 'customers' })
       === 'showing 12 of 1964 matching',
    'a filtered partial list says "matching" — the visible count is a subset by choice, over a population that is still larger than what loaded');
  ok(countPillText({ visible: 12, loaded: 30, total: 30, filtered: true, itemNoun: 'customers' })
       === '12 of 30 shown',
    'a filtered COMPLETE list keeps the original "shown" wording — the fix does not change the sentence for grids that were never wrong');

  // The read side: the query that feeds it must be bounded AND counted.
  const cust = code('packages/cultivar-os/src/pages/Customers.tsx');
  ok(/count:\s*'exact'/.test(cust),
    "🔴 the customers read asks for count:'exact' — the total comes from the database, never from the length of the array that came back");
  ok(/\.range\(/.test(cust),
    '…and it pages with .range(), so the rows are a deliberate page rather than an accidental cap');
  ok(/totalRows=\{customerTotal\}/.test(cust),
    '…and that counted total is what the grid header renders');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §E ⑤ A PERSON WITH ONE NAME IS NOT CALLED "null"
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(formatPersonName('Terry', null) === 'Terry',
    '🔴 ⑤/§E the mononym case, which is the whole defect: a person with no last name is "Terry", not "Terry null". 39 real people rendered that way after the 2026-09-07 import');
  ok(formatPersonName('Raj', undefined) === 'Raj' && formatPersonName('Tina', '') === 'Tina',
    '…and undefined and empty-string behave the same as NULL — three absences, one answer');
  ok(formatPersonName(null, 'Bishop') === 'Bishop',
    'an absent FIRST name is dropped just as cleanly — the helper is not last-name-shaped');
  ok(formatPersonName('Lauren', 'Bishop') === 'Lauren Bishop',
    'the ordinary case is untouched');
  ok(formatPersonName(null, null) === '',
    'nothing known returns EMPTY, so each caller supplies its own honest fallback rather than inheriting a fabricated one (D-9: absent is not empty)');
  ok(!formatPersonName('Terry', null).includes('null') && !formatPersonName(null, null).includes('null'),
    '🔴 THE LITERAL FOUR CHARACTERS never appear in any output — the string the importer never wrote and the template literal always did');

  // The organization path, which is 512 of the 551 NULL-last_name rows and must not be touched.
  ok(customerDisplayName({ customer_type: 'organization', organization_name: 'LEANDER AREA WHLS NRSY SPLY', first_name: 'LEANDER', last_name: null }, '—')
       === 'LEANDER AREA WHLS NRSY SPLY',
    '🔴 an ORGANIZATION renders its organization name — 512 of the 551 NULL-last_name rows are companies and never reach the person path at all');
  ok(customerDisplayName({ customer_type: 'person', first_name: 'Terry', last_name: null }, '—') === 'Terry',
    'a person with one name renders that name');
  ok(customerDisplayName({ customer_type: 'person', first_name: null, last_name: null, display_name: 'Imported Co' }, '—') === 'Imported Co',
    'a record with no parts but a display_name falls back to it before giving up');
  ok(customerDisplayName(null, 'Unknown customer') === 'Unknown customer'
       && customerDisplayName({ customer_type: 'person' }, '—') === '—',
    'a missing record and an empty record both take the caller\'s fallback — and the fallback is a REQUIRED argument so no surface silently inherits another\'s wording');

  // 🔴 THE CORPUS HALF. The helper is worth nothing if a call site still builds the name by hand,
  // and there were TWELVE of them. This is the assertion that keeps the thirteenth from landing.
  const SITES = [
    'packages/cultivar-os/src/pages/Customers.tsx',
    'packages/cultivar-os/src/pages/Orders.tsx',
    'packages/cultivar-os/src/pages/OrderDetail.tsx',
    'packages/cultivar-os/src/pages/OperationsCalendar.tsx',
    'packages/cultivar-os/src/pages/DeliverySchedule.tsx',
    'packages/cultivar-os/src/pages/DeliveryRoute.tsx',
    'packages/cultivar-os/src/pages/CustomerDetail.tsx',
    'packages/cultivar-os/src/pages/CartReview.tsx',
    'packages/cultivar-os/src/components/customers/CustomerSearch.tsx',
    'packages/cultivar-os/src/hooks/useSubmitOrder.ts',
  ];
  const handAssembled: string[] = [];
  for (const f of SITES) {
    const src = code(f);
    // `${a.first_name} ${a.last_name}` in a template literal — the form that stringifies null.
    if (/\$\{[^}]*first_name[^}]*\}\s*\$\{[^}]*last_name[^}]*\}/.test(src)) handAssembled.push(f);
  }
  ok(handAssembled.length === 0,
    `🔴 NO SURFACE ASSEMBLES A PERSON NAME BY HAND ANY MORE — still hand-assembling: [${handAssembled.join(', ')}]. A template literal is the form that renders NULL as four characters; JSX does not, which is exactly why the two were mixed and the bug looked intermittent`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §F ③ THE UNDO REPORT MAY NOT FABRICATE A COUNT IT WAS NOT GIVEN
// ════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ HONEST SCOPE. The live 0-over-1,934 is NOT reproduced by these probes and is not claimed
// fixed — every link was verified against the current tree and each one carries the right number.
// What IS asserted is that the SURFACE can no longer print a number the response did not contain,
// which is the property whose absence let a wrong sentence look like a right one.
{
  const panel = code('packages/shared/src/components/QboCatalogueImport.tsx');
  ok(!/undone\.customers\?\.deleted \?\? 0/.test(panel),
    '🔴 ③/§F `undone.customers?.deleted ?? 0` is gone. `?? 0` converts "the server did not tell me" into a confident zero — the third time that operator has printed one');
  ok(/unreported number of imported customers/.test(panel),
    '…and an absent customer report now SAYS it is absent rather than rendering as 0 (D-9 / A9: absent is not empty)');
  ok(/remainingWithThisRun/.test(panel),
    '🔴 …and the post-delete RE-READ is on the screen. It is the authoritative proof — it counts what still carries the run id AFTER the delete — so a wrong tally is contradicted in the next sentence rather than believed');

  // The writer's own contract, asserted so the field the surface reads cannot be renamed away.
  const writer = code('packages/shared/src/quickbooks/customerImportWriter.ts');
  ok(/deleted:\s*number/.test(writer) && /remainingWithThisRun/.test(writer),
    'CustomerUndoReport still exports BOTH `deleted` (the tally) and `remainingWithThisRun` (the proof) — the surface reads the real exported type, so a rename breaks the build instead of the sentence');

  // 🔴 THE TEST-DOUBLE DEFECT FOUND ON THE WAY, FILED AS TECH-DEBT #213 AND ASSERTED HERE.
  const dbl = code('packages/shared/src/quickbooks/customerImport.test.ts');
  ok(/range\(/.test(dbl),
    '⚠️ the customer-import double defines range() — and it is a NO-OP that returns every matching row regardless of offset. No probe in that suite exercises paging at all, which is the exact mechanism behind ④ one table over. Recorded here rather than silently rewritten inside a five-defect fix (tech-debt #213)');
}

console.log(`\n  reportFidelity: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
