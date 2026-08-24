/**
 * ── THE QUICKBOOKS INVOICE PAYLOAD — what we actually SEND, asserted line by line ──────────────
 *
 * WHAT THIS GUARDS: the bytes that reach a customer. On 2026-08-24 QB invoice **txnId=436**
 * (Cultivar order `2661dbe4-e26d-486f-b65f-50e0f56716c3`, dated 07/16/2026, QB status **"Opened"**
 * — sent AND viewed) carried the line:
 *
 *     Placement Service — price adjusted (reason: must be filled if discount applied cannot be EMPTY)
 *
 * An internal attribution field was interpolated into customer copy (tech-debt #104), and the
 * string itself was a human's note-to-self typed to get past a gate that checks only that the
 * field is non-empty (#105). Nothing anywhere asserted what the payload said.
 *
 * 🔴 WHY THIS ASSERTS THE PAYLOAD AND NEVER A STATUS CODE. QuickBooks returning 200 means the
 * invoice was ACCEPTED, not that it was CORRECT — invoice 436 was a 200. **A test that asks the
 * far end whether it liked what we sent inherits whatever we sent.** Same discipline as
 * `moduleRoundTrip.test.ts` (the `4056de8` lesson): assert the observed artifact, never the
 * self-report. So every probe below reads the assembled `Line[]` object.
 *
 * THE FIXTURE IS INVOICE 436, RECONSTRUCTED FROM THE RENDERED DOCUMENT — not invented numbers:
 *     Shoal Creek Vitex — 30          4 × 124.00 =  496.00
 *     'Sierra' Mexican Red Oak — 15   3 × 133.00 =  399.00
 *     Delivery × 1                    1 × 125.00 =  125.00
 *     Placement Service × 7           7 × 225.00 = 1575.00
 *     Placement Service — price adjusted        =  -575.00
 *     Sales Tax (7.6%)                          =   153.52
 *     BALANCE DUE                                  2173.52
 * so a regression is measured against the document David is holding, not against a model of it.
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/cultivar-os/api/qbo/invoice/qboInvoiceLines.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { buildQboInvoiceLines } from './cultivar';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

/** The exact string invoice 436 printed. Nothing in a payload may contain it, or any part of it. */
const LEAKED_REASON = 'must be filled if discount applied cannot be EMPTY';

type Line = {
  Description: string;
  Amount: number;
  DetailType: string;
  SalesItemLineDetail: { UnitPrice: number; Qty: number; ItemRef: { value: string; name: string } };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;
const sum = (ls: Line[]): number => round2(ls.reduce((s, l) => s + Number(l.Amount ?? 0), 0));
const find = (ls: Line[], frag: string): Line | undefined => ls.find(l => l.Description.includes(frag));

// ── THE FIXTURE — invoice 436 ────────────────────────────────────────────────────────────────────

const ORDER = {
  subtotal:           2020.00,   // 496 + 399 + 125 + 1000 (the placement line NET, after the give)
  tax_amount:          153.52,
  total_amount:       2173.52,
  netting_declined:    false,
  transport_method:   'delivery',
  tax_exempt_applied:  false,
  tax_exempt_reason:   null,
  tax_exempt_cert_ref: null,
};
const BUSINESS = { name: 'LAWNS Tree Farm, LLC' };

/** Two GOODS lines. `retail_unit` is present with `discount_amt` 0 — a retail order, no tier
 *  discount — which is what 436 was: it carries no "Discount (x% off)" line. */
const ORDER_ITEMS = [
  { quantity: 4, unit_price: 124.00, subtotal: 496.00, retail_unit: 124.00, discount_pct: 0, discount_amt: 0,
    business_inventory_id: 'lot-vitex',  business_inventory: { name: 'Shoal Creek Vitex', size: '30', sku: 'SCV-30' } },
  { quantity: 3, unit_price: 133.00, subtotal: 399.00, retail_unit: 133.00, discount_pct: 0, discount_amt: 0,
    business_inventory_id: 'lot-oak',    business_inventory: { name: "'Sierra' Mexican Red Oak", size: '15', sku: 'SMR-15' } },
];

/** One ordinary service line and one OVERRIDDEN service line (225 × 7 = 1575 retail, charged 1000). */
const SERVICE_SELECTIONS = [
  { quantity: 1, unit_price_at_time: 125.00, subtotal:  125.00, is_manual_override: false, override_reason: null,
    service_offerings: { name: 'Delivery',          category: 'transport', transport_mode: 'staff', trigger_transport_mode: null } },
  { quantity: 7, unit_price_at_time: 225.00, subtotal: 1000.00, is_manual_override: true,  override_reason: LEAKED_REASON,
    service_offerings: { name: 'Placement Service', category: 'transport', transport_mode: 'staff', trigger_transport_mode: null } },
];

function build(): Line[] {
  return buildQboInvoiceLines({
    order: ORDER, business: BUSINESS,
    orderItems: ORDER_ITEMS, serviceSelections: SERVICE_SELECTIONS, orderAddons: [],
    useNewModel: true, order_id: '2661dbe4-e26d-486f-b65f-50e0f56716c3',
  }) as Line[];
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// A · THE FIX — THE REASON DOES NOT REACH THE PAYLOAD
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function reasonIsGone(): void {
  const lines = build();

  // 🔴 A1 — THE WHOLE POINT, AND IT SEARCHES THE ENTIRE PAYLOAD, NOT THE ONE LINE WE FIXED.
  // A description is not the only place a string can end up; asserting on the serialized payload
  // catches a reason that reappears in a field nobody thought about.
  const serialized = JSON.stringify(lines);
  ok(!serialized.includes(LEAKED_REASON),
     'A1 🔴 the override reason from invoice 436 appears NOWHERE in the built payload');

  // A2 — and not a fragment of it either. A partial leak is a leak.
  ok(!/reason/i.test(serialized),
     'A2 the word "reason" does not appear anywhere in the payload — no field carries one');

  // A3 — the adjustment line still NAMES the thing it adjusted, so the invoice stays readable.
  const adj = find(lines, 'price adjusted');
  ok(adj?.Description === 'Placement Service — price adjusted',
     `A3 the adjustment line names WHAT but not WHY — got "${adj?.Description}"`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// B · WHAT MUST NOT BREAK — THE NEGATIVE-ADJUSTMENT SHAPE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function shapeSurvives(): void {
  const lines = build();

  // 🔴 B1 — BOTH HALVES PRESENT. The concession is only auditable because the invoice carries the
  // baseline AND the give-away as separate lines. Collapsing to a net 1000 loses the $575 forever.
  const retail = find(lines, 'Placement Service × 7');
  const adj    = find(lines, 'price adjusted');
  ok(!!retail && !!adj, 'B1 🔴 BOTH lines survive — the retail baseline AND its own negative line');

  // B2 — the baseline is the untouched retail, and it is internally consistent. This is the exact
  // property QBO error 6070 rejected before D-48: Amount must equal UnitPrice × Qty.
  ok(retail?.Amount === 1575.00 && retail?.SalesItemLineDetail.UnitPrice === 225.00
     && retail?.SalesItemLineDetail.Qty === 7,
     'B2 the baseline line is 225.00 × 7 = 1575.00 — internally consistent (QBO 6070)');
  ok(round2((retail!.SalesItemLineDetail.UnitPrice * retail!.SalesItemLineDetail.Qty)) === retail!.Amount,
     'B2b Amount === UnitPrice × Qty on the baseline line — the 6070 invariant, asserted directly');

  // 🔴 B3 — THE RIGHT AMOUNT, SIGNED THE RIGHT WAY. 1575 − 1000 = 575 given away, pushed negative.
  ok(adj?.Amount === -575.00, `B3 🔴 the adjustment is exactly -575.00 — got ${adj?.Amount}`);
  ok(adj?.SalesItemLineDetail.UnitPrice === -575.00 && adj?.SalesItemLineDetail.Qty === 1,
     'B3b the negative line is also internally consistent (-575.00 × 1)');

  // B4 — the two together net to what was actually charged.
  ok(round2(retail!.Amount + adj!.Amount) === 1000.00,
     'B4 baseline + adjustment === 1000.00, the amount the order charged');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// C · THE ARITHMETIC — UNCHANGED FROM WHAT SHIPPED
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function arithmeticReconciles(): void {
  const lines = build();

  // C1 — goods land at their net, untouched by the fix.
  ok(find(lines, 'Shoal Creek Vitex')?.Amount === 496.00, 'C1 the vitex line is 496.00');
  ok(find(lines, 'Mexican Red Oak')?.Amount === 399.00,   'C1b the oak line is 399.00');
  ok(find(lines, 'Delivery × 1')?.Amount === 125.00,      'C1c the delivery line is 125.00');

  // 🔴 C2 — THE LINES NET TO THE ORDER'S SUBTOTAL. This is the half that the negative line makes
  // fragile: represent one concession twice and this is where it shows.
  const goodsAndServices = lines.filter(l => !l.Description.startsWith('Sales Tax'));
  ok(sum(goodsAndServices) === 2020.00,
     `C2 🔴 every non-tax line sums to the order subtotal 2020.00 — got ${sum(goodsAndServices)}`);

  // C3 — tax is computed on that net subtotal, and the % is DERIVED, never fabricated.
  const tax = find(lines, 'Sales Tax');
  ok(tax?.Amount === 153.52, `C3 the tax line is 153.52 — got ${tax?.Amount}`);
  ok(tax?.Description === 'Sales Tax (7.6%)',
     `C3b the rate is derived from amount ÷ subtotal — got "${tax?.Description}"`);
  ok(round2(2020.00 * 0.076) === 153.52, 'C3c 2020.00 × 7.6% === 153.52 — the rate and the amount agree');

  // 🔴 C4 — THE WHOLE PAYLOAD RECONCILES TO THE ORDER TOTAL. This is the assertion the live
  // reconcile guard (cultivar.ts, "Invoice does not reconcile") makes before pushing; proving it
  // here means the guard is never the thing that discovers a regression, in front of a customer.
  ok(sum(lines) === ORDER.total_amount,
     `C4 🔴 the assembled payload sums to 2173.52, the order total — got ${sum(lines)}`);

  // C5 — the shape is unchanged: six lines, exactly as invoice 436 rendered.
  ok(lines.length === 6, `C5 six lines, as 436 rendered — got ${lines.length}`);
  ok(lines.every(l => l.DetailType === 'SalesItemLineDetail'),
     'C5b every line is a SalesItemLine — the convention the negative line rides');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// D · THE GATE THAT STOPPED FIX 2 — PINNED AS KNOWN DEBT, NOT AS APPROVAL
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function itemRefIsStillTheKnownDefect(): void {
  const lines = build();

  // ⚠️ D1 — THIS PROBE ASSERTS A DEFECT ON PURPOSE, AND SAYS SO. Tech-debt #106: every line books
  // to one hardcoded QB item, so a nursery's books show 100% service revenue and no COGS. FIX 2
  // was STOPPED AT ITS GATE this build — we hold no second QuickBooks item id, and inventing one
  // would push an invoice QuickBooks rejects. Pinning the CURRENT truth means the day someone
  // fixes it, this probe FAILS and has to be updated deliberately — the defect cannot be quietly
  // resolved or quietly re-introduced. It is NOT a statement that this behaviour is correct.
  ok(lines.every(l => l.SalesItemLineDetail.ItemRef.value === '1'),
     'D1 ⚠️ KNOWN DEBT #106 — every line still points at hardcoded QB item "1"');
  ok(lines.every(l => l.SalesItemLineDetail.ItemRef.name === 'Services'),
     'D1b ⚠️ KNOWN DEBT #106 — including the two PLANT lines, which are not services');

  // 🔴 D2 — THE EVIDENCE THAT THE FIX IS CHEAP WHEN THE ID EXISTS: the payload already distinguishes
  // goods from services in its DESCRIPTIONS, because the assembly loops the two tables separately.
  // The information is present at the moment the ItemRef is written; only the id is missing.
  const goods = lines.filter(l => /Vitex|Red Oak/.test(l.Description));
  const svc   = lines.filter(l => /Delivery|Placement/.test(l.Description));
  ok(goods.length === 2, 'D2 the two GOODS lines came from the order_items loop');
  ok(svc.length === 3,
     'D2b the three SERVICE lines came from the order_service_selections loop (delivery + baseline + adjustment)');
  ok(goods.every(g => !svc.includes(g)),
     'D2c 🔴 the two sets do not overlap — goods and services stay distinguishable all the way to the push, '
     + 'so #106 is a missing ITEM ID, not missing information');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// E · RED-FIRST (STD-024) — PROVE THE PROBES CAN FAIL
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function probesCanFail(): void {
  // E1 — a NEGATIVE CONTROL for A1/A2. Re-run the real assembly with the reason re-interpolated by
  // hand, exactly as the old code did, and confirm the leak detector fires. Without this, A1
  // passing proves nothing — a search that can never match always "passes".
  const leaked = build();
  leaked[4] = { ...leaked[4], Description: `Placement Service — price adjusted (reason: ${LEAKED_REASON})` };
  ok(JSON.stringify(leaked).includes(LEAKED_REASON),
     'E1 🔴 the leak detector DOES fire on the old shape — A1 is a real assertion, not a vacuous one');

  // E2 — a negative control for C4: break one amount and confirm the reconcile assertion notices.
  const broken = build();
  broken[1] = { ...broken[1], Amount: 400.00 };   // 399 → 400
  ok(sum(broken) !== ORDER.total_amount,
     'E2 the reconcile assertion notices a one-dollar error — C4 can fail');

  // E3 — a negative control for B1: drop the negative line and confirm the pair-check would catch it.
  const collapsed = build().filter(l => !l.Description.includes('price adjusted'));
  ok(!find(collapsed, 'price adjusted') && sum(collapsed) !== ORDER.total_amount,
     'E3 removing the negative line breaks BOTH the pair check and the reconcile — B1/C4 can fail');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════

function main(): void {
  reasonIsGone();
  shapeSurvives();
  arithmeticReconciles();
  itemRefIsStillTheKnownDefect();
  probesCanFail();
  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  FAILURES:');
    for (const f of failures) console.log(`   ✗ ${f}`);
    process.exit(1);
  }
}

main();
