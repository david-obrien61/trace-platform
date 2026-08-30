/**
 * ── THE QUICKBOOKS CONSTRUCT VOCABULARY, ASSERTED ─────────────────────────────────────────────
 *
 * WHAT THIS GUARDS: the three shapes a QuickBooks invoice line can take, and the ONE rule that
 * decides which. Its sibling `qboInvoiceLines.test.ts` asserts the assembled payload for a real
 * order; this file asserts the primitives underneath it, and covers the two things that file
 * structurally cannot reach:
 *
 *   · `signedLineAmount` — used ONLY by the live reconcile guard in `pushQboInvoice`, which is
 *     not a pure function and has no unit test. It is the single most dangerous function in the
 *     module: get it wrong and the reconcile says an invoice BALANCES when it does not.
 *   · `qboItemMappingOf` — the reader of a column THAT DOES NOT EXIST YET. Testing it now is how
 *     the mapping pass gets a contract instead of a guess.
 *
 * Run: node_modules/.bin/esbuild packages/shared/src/quickbooks/invoiceLineShapes.test.ts \
 *        --bundle --platform=node --format=cjs | node
 */

import {
  QBO_DETAIL_TYPE,
  isDocumentationAmount,
  descriptionOnlyLine,
  discountLine,
  salesItemLine,
  txnTaxDetail,
  signedLineAmount,
  qboItemMappingOf,
  resolveQboItemRef,
} from './invoiceLineShapes';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// A · qboItemMappingOf — THE CONTRACT THE MAPPING PASS MUST SATISFY
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function mappingReader(): void {
  // 🔴 A1 — THE LIVE STATE. No row carries the column today, so every read is null. This is not a
  // placeholder assertion; it is the fact that makes every revenue line refuse right now.
  ok(qboItemMappingOf({ name: 'Shoal Creek Vitex', size: '30', sku: 'SCV-30' }) === null,
     'A1 🔴 a row without the column maps to NOTHING — the honest state today');

  // A2 — the happy path, once the column exists.
  const m = qboItemMappingOf({ qbo_item_id: '47', qbo_item_name: 'Nursery Stock:Trees' });
  ok(m?.qboItemId === '47' && m?.qboItemName === 'Nursery Stock:Trees',
     'A2 a row carrying the Intuit Id maps to it');

  // A3 — the name is optional and non-authoritative.
  ok(qboItemMappingOf({ qbo_item_id: '47' })?.qboItemName === null,
     'A3 the name is optional — an id alone is a complete mapping');

  // 🔴 A4 — A BLANK IS NOT AN ID. An empty or whitespace value would push `ItemRef:{value:""}` to
  // a customer's books, which is worse than refusing because it looks like it worked.
  ok(qboItemMappingOf({ qbo_item_id: '' }) === null,   'A4 an empty id is NOT a mapping');
  ok(qboItemMappingOf({ qbo_item_id: '   ' }) === null, 'A4b whitespace is NOT a mapping');
  ok(qboItemMappingOf({ qbo_item_id: null }) === null,  'A4c null is NOT a mapping');

  // A5 — a numeric id from the driver is coerced, not rejected. Intuit ids are numeric strings and
  // a JSON round-trip can hand back either.
  ok(qboItemMappingOf({ qbo_item_id: 47 })?.qboItemId === '47', 'A5 a numeric id coerces to its string form');

  // A6 — junk in, null out. Never a throw: this runs inside invoice assembly.
  ok(qboItemMappingOf(null) === null && qboItemMappingOf(undefined) === null
     && qboItemMappingOf('nope') === null && qboItemMappingOf(7) === null,
     'A6 a null/absent/non-object row maps to null and never throws');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// B · resolveQboItemRef — THERE IS NO FALLBACK BRANCH, AND THAT IS THE FEATURE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function resolution(): void {
  const r = resolveQboItemRef({
    label: 'Shoal Creek Vitex — 30', source: 'business_inventory', amount: 496,
    mapping: { qboItemId: '47', qboItemName: 'Nursery Stock:Trees' },
  });
  ok(r.ok && r.itemRef.value === '47', 'B1 a mapped line resolves to its Intuit Id');
  ok(r.ok && r.itemRef.name === 'Nursery Stock:Trees', 'B1b and carries the readable name when present');

  // B2 — no name on the row → no name in the payload. Omit, never invent (D-9).
  const noName = resolveQboItemRef({ label: 'x', source: 'addons', amount: 1, mapping: { qboItemId: '9' } });
  ok(noName.ok && noName.itemRef.name === undefined, 'B2 no cached name → the ref carries value alone');

  // 🔴 B3 — THE REFUSAL, AND WHAT IT CARRIES. It names the line, the table that owes the mapping,
  // and the money — so the owner gets a place to go, not a mystery.
  const refused = resolveQboItemRef({
    label: "'Sierra' Mexican Red Oak — 15", source: 'business_inventory', amount: 399, mapping: null,
  });
  ok(!refused.ok, 'B3 🔴 an unmapped line REFUSES — there is no default branch');
  ok(!refused.ok && refused.unmapped.label === "'Sierra' Mexican Red Oak — 15"
     && refused.unmapped.source === 'business_inventory' && refused.unmapped.amount === 399,
     'B3b the refusal names the line, the table that owes the mapping, and the amount at stake');

  // 🔴 B4 — THE LITERAL CANNOT COME OUT OF THIS FUNCTION AT ALL. Asserted over the serialized
  // result rather than a field, because a default could be reintroduced anywhere in the shape.
  ok(!JSON.stringify(refused).includes('Services') && !/"value"/.test(JSON.stringify(refused)),
     'B4 🔴 a refusal produces NO itemRef of any kind — not even an empty one');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// C · THE $0 RULE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function documentationRule(): void {
  ok(isDocumentationAmount(0),      'C1 zero is a documentation amount');
  ok(isDocumentationAmount(0.004),  'C1b float dust below half a cent is still zero');
  ok(!isDocumentationAmount(0.01),  'C1c a penny is money');
  ok(!isDocumentationAmount(-575),  'C1d a negative amount is money too — it is not a $0 note');
  // 🔴 C2 — AN UNPRICED LEGACY ROW READS AS A NOTE, NOT AS A CRASH. `null`/`undefined`/NaN reach
  // here from rows that predate a pricing column; treating them as money would push `Amount: NaN`.
  ok(isDocumentationAmount(null) && isDocumentationAmount(undefined) && isDocumentationAmount('abc'),
     'C2 🔴 a null/absent/unparseable amount is a NOTE — never a NaN pushed to a customer');

  const note = descriptionOnlyLine('Protective travel netting — DECLINED by customer');
  ok(note.DetailType === QBO_DETAIL_TYPE.description, 'C3 a note is DescriptionOnly');
  ok(!('SalesItemLineDetail' in note), 'C3b 🔴 and carries NO ItemRef — a note is not a $0 sale');
  ok(note.Amount === 0, 'C3c it is explicitly $0');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// D · THE DISCOUNT — NATIVE, FIXED-AMOUNT, POSITIVE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function discount(): void {
  const d = discountLine('Discount (10% off)', 49.60);
  ok(d.DetailType === QBO_DETAIL_TYPE.discount, 'D1 the native construct');
  ok(d.Amount === 49.60, 'D1b a POSITIVE amount — QuickBooks subtracts it');
  ok((d.DiscountLineDetail as { PercentBased: boolean }).PercentBased === false,
     'D1c 🔴 PercentBased:false — the percent form would sweep in the SERVICE lines, which D-39 forbids');
  ok(!('SalesItemLineDetail' in d), 'D1d a discount is not a sale');
  ok(!JSON.stringify(d).includes('DiscountAccountRef'),
     'D1e 🔴 no account id is fabricated — QuickBooks uses the company default');

  // D2 — defensive: a caller handing a negative slips through as its magnitude rather than
  // emitting a negative discount QuickBooks has no concept of. The CALLER is what routes a
  // surcharge to the revenue path; this is the second line of defence, not the first.
  ok(discountLine('x', -49.60).Amount === 49.60, 'D2 a negative handed in becomes its magnitude, never a negative discount');
  ok(discountLine('x', 49.605).Amount === 49.61, 'D2b rounds to cents');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// E · TAX — QUICKBOOKS' OWN OBJECT, OR NOTHING
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function tax(): void {
  ok(txnTaxDetail(153.52)?.TotalTax === 153.52, 'E1 tax rides TotalTax');
  // ⚠️ ROUNDED WITH THE REPO'S STANDARD round2, WHICH IS FLOAT-EXACT, NOT DECIMAL-EXACT.
  // `153.515 * 100` is 15351.4999… in IEEE-754, so it rounds DOWN to 153.51 — measured, not
  // assumed (this assertion was written expecting .52 and the run corrected it). Harmless
  // here: `orders.tax_amount` is a 2-dp numeric, so a half-cent input never arrives.
  ok(txnTaxDetail(153.516)?.TotalTax === 153.52, 'E1b rounded to cents');
  ok(txnTaxDetail(153.515)?.TotalTax === 153.51,
     'E1c 🔴 and a half-cent rounds by FLOAT, not by decimal — pinned so it is a known fact, not a surprise');
  // 🔴 E2 — OMIT, NEVER AN EXPLICIT ZERO (D-9). An exempt or untaxed order carries no tax object.
  ok(txnTaxDetail(0) === null && txnTaxDetail(null) === null && txnTaxDetail(undefined) === null
     && txnTaxDetail('') === null,
     'E2 🔴 no tax → NO tax object at all, never TotalTax:0');
  ok(txnTaxDetail(-5) === null, 'E2b a negative tax is not a tax — omitted rather than pushed');
  // E3 — no fabricated ids. A TaxLine wants a tax-rate Id we do not hold.
  ok(!JSON.stringify(txnTaxDetail(153.52)).includes('TaxRateRef'),
     'E3 no TaxRateRef is invented — TotalTax alone is the honest minimum');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// F · 🔴 signedLineAmount — THE FUNCTION THAT CAN MAKE A BROKEN INVOICE LOOK BALANCED
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function signing(): void {
  const goods = salesItemLine({ description: 'Vitex', amount: 496, unitPrice: 124, qty: 4, itemRef: { value: '47' } });
  const disc  = discountLine('Discount', 575);
  const note  = descriptionOnlyLine('DECLINED');

  ok(signedLineAmount(goods) === 496,  'F1 a sale contributes its amount');
  ok(signedLineAmount(disc) === -575,  'F1b 🔴 a DISCOUNT contributes NEGATIVE its amount — the sign flip');
  ok(signedLineAmount(note) === 0,     'F1c a note contributes nothing');

  // 🔴 F2 — THE WHOLE REASON THIS FUNCTION EXISTS, STATED AS ARITHMETIC. The 436 order: a naive
  // sum reads 3170 and a signed sum reads 2020 — a $1,150 difference, in the direction that says
  // the invoice reconciles when it does not.
  const lines = [goods, salesItemLine({ description: 'Oak', amount: 399, unitPrice: 133, qty: 3, itemRef: { value: '47' } }),
                 salesItemLine({ description: 'Delivery', amount: 125, unitPrice: 125, qty: 1, itemRef: { value: '12' } }),
                 salesItemLine({ description: 'Placement', amount: 1575, unitPrice: 225, qty: 7, itemRef: { value: '19' } }),
                 disc];
  const signed = lines.reduce((s, l) => s + signedLineAmount(l), 0);
  const naive  = lines.reduce((s, l) => s + Number(l.Amount ?? 0), 0);
  ok(signed === 2020, `F2 🔴 the signed sum is the charged subtotal 2020 — got ${signed}`);
  ok(naive === 3170 && naive - signed === 1150,
     `F2b 🔴 a naive sum reads ${naive} — wrong by TWICE the discount, in the safe-looking direction`);

  // F3 — a malformed Amount contributes zero rather than NaN. One NaN poisons the entire
  // reconcile into "does not reconcile" for an invoice that is fine — or worse, silently passes
  // a comparison against another NaN.
  ok(signedLineAmount({ DetailType: QBO_DETAIL_TYPE.sales, Amount: 'oops' }) === 0,
     'F3 an unparseable Amount contributes 0, never NaN');
  ok(signedLineAmount({ DetailType: QBO_DETAIL_TYPE.sales }) === 0, 'F3b a missing Amount contributes 0');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// G · salesItemLine — THE 6070 INVARIANT
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function sale(): void {
  const l = salesItemLine({ description: 'Placement × 7', amount: 1575, unitPrice: 225, qty: 7,
                            itemRef: { value: '19', name: 'Tree Placement' } });
  ok(l.DetailType === QBO_DETAIL_TYPE.sales, 'G1 a sale is a SalesItemLine');
  const d = l.SalesItemLineDetail as { UnitPrice: number; Qty: number; ItemRef: { value: string } };
  ok(d.UnitPrice * d.Qty === l.Amount,
     'G1b 🔴 Amount === UnitPrice × Qty — the QBO 6070 invariant that 400d a whole invoice once');
  ok(d.ItemRef.value === '19', 'G1c and it carries the resolved ref, never one it chose itself');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// H · RED-FIRST (STD-024) — the assertions can fail
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function probesCanFail(): void {
  // H1 — negative control for C3b/D1d: prove "no SalesItemLineDetail" is checking a key that CAN
  // be present, so the `in` assertions are not vacuously true on every object.
  ok('SalesItemLineDetail' in salesItemLine({ description: 'x', amount: 1, unitPrice: 1, qty: 1, itemRef: { value: '9' } }),
     'H1 the key the note/discount assertions check for IS present on a real sale');

  // 🔴 H2 — negative control for B4/D1e: build the exact forbidden shapes by hand and confirm the
  // string searches catch them. A grep for something that can no longer be produced passes forever.
  ok(JSON.stringify({ itemRef: { value: '1', name: 'Services' } }).includes('Services'),
     'H2 🔴 the "Services" detector fires on the literal it is watching for');
  ok(JSON.stringify({ DiscountLineDetail: { DiscountAccountRef: { value: '86' } } }).includes('DiscountAccountRef'),
     'H2b the DiscountAccountRef detector fires when one is present');

  // H3 — negative control for F1b: if the discount sign were NOT flipped, F2 would read 3170.
  const notFlipped = [496, 399, 125, 1575, 575].reduce((a, b) => a + b, 0);
  ok(notFlipped === 3170 && notFlipped !== 2020, 'H3 the unsigned arithmetic really is different — F2 can fail');

  // H4 — negative control for E2: a real amount must NOT be omitted, or E2 would pass by a
  // function that returns null for everything.
  ok(txnTaxDetail(0.01) !== null, 'H4 a one-cent tax is NOT omitted — E2 is about zero, not about everything');
}

function main(): void {
  mappingReader(); resolution(); documentationRule(); discount(); tax(); signing(); sale(); probesCanFail();
  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  FAILURES:');
    for (const f of failures) console.log(`   ✗ ${f}`);
    process.exit(1);
  }
}

main();
