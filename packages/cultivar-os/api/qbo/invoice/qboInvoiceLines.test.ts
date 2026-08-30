/**
 * ── THE QUICKBOOKS INVOICE PAYLOAD — what we actually SEND, asserted line by line ──────────────
 *
 * WHAT THIS GUARDS: the bytes that reach a customer's ACCOUNTING SYSTEM. Two scars, both real:
 *
 *  (1) On 2026-08-24 QB invoice **txnId=436** (Cultivar order `2661dbe4-…`, dated 07/16/2026, QB
 *      status **"Opened"** — sent AND viewed) carried the line:
 *          Placement Service — price adjusted (reason: must be filled if discount applied cannot be EMPTY)
 *      An internal attribution field was interpolated into customer copy (tech-debt #104), and the
 *      string itself was a human's note-to-self typed to get past a gate that checks only that the
 *      field is non-empty (#105).
 *
 *  (2) Until 2026-08-30 every line pushed `ItemRef: { value: '1', name: 'Services' }` — twelve
 *      hardcoded literals. The read of the customer's own books settled the cost: item `1` EXISTS,
 *      is named **"Sales"**, and books to their GENERIC INCOME ACCOUNT. The push would not have
 *      failed; it would have SUCCEEDED and silently misfiled every tree into a bucket already
 *      holding $41,667 beside $1.52m of nursery stock.
 *
 * 🔴 WHY THIS ASSERTS THE PAYLOAD AND NEVER A STATUS CODE. QuickBooks returning 200 means the
 * invoice was ACCEPTED, not that it was CORRECT — invoice 436 was a 200. **A test that asks the
 * far end whether it liked what we sent inherits whatever we sent.** So every probe reads the
 * assembled payload object.
 *
 * THE FIXTURE IS INVOICE 436, RECONSTRUCTED FROM THE RENDERED DOCUMENT — not invented numbers:
 *     Shoal Creek Vitex — 30          4 × 124.00 =  496.00
 *     'Sierra' Mexican Red Oak — 15   3 × 133.00 =  399.00
 *     Delivery × 1                    1 × 125.00 =  125.00
 *     Placement Service × 7           7 × 225.00 = 1575.00
 *     Placement Service — price adjusted        =  -575.00
 *     Sales Tax (7.6%)                          =   153.52
 *     BALANCE DUE                                  2173.52
 *
 * ⚠️ THE 436 FIXTURE NOW APPEARS TWICE, AND THE PAIR IS THE POINT. `unmapped` is the LIVE state
 *    today — no table carries `qbo_item_id`, so every revenue line refuses. `mapped` is the same
 *    order with the ids the mapping pass will supply. Asserting BOTH proves the consumer is
 *    correct BEFORE the producer exists, and proves the refusal is real rather than incidental.
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/cultivar-os/api/qbo/invoice/qboInvoiceLines.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { buildQboInvoiceLines, type QboInvoicePayload } from './cultivar';

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
  Amount?: number;
  DetailType: string;
  SalesItemLineDetail?: { UnitPrice: number; Qty: number; ItemRef: { value: string; name?: string } };
  DiscountLineDetail?: { PercentBased: boolean };
  DescriptionLineDetail?: Record<string, unknown>;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;
/** Signed by CONSTRUCT — a native discount carries a positive Amount that QuickBooks subtracts. */
const netSum = (ls: Line[]): number =>
  round2(ls.reduce((s, l) => s + (l.DetailType === 'DiscountLineDetail' ? -1 : 1) * Number(l.Amount ?? 0), 0));
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

/** Two GOODS lines. `retail_unit` present with `discount_amt` 0 — a retail order, no tier
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

/**
 * The SAME order with the mapping the next pass will supply. `qbo_item_id` holds Intuit's Item
 * **Id** — not a SKU, not a name. Note the fixture keeps `sku` alongside it, because the two are
 * different facts and confusing them is what the id-vs-SKU correction was about.
 */
const MAP = {
  vitex:     { qbo_item_id: '47', qbo_item_name: 'Nursery Stock:Trees' },
  oak:       { qbo_item_id: '47', qbo_item_name: 'Nursery Stock:Trees' },
  delivery:  { qbo_item_id: '12', qbo_item_name: 'Delivery' },
  placement: { qbo_item_id: '19', qbo_item_name: 'Tree Placement' },
};

const MAPPED_ITEMS = [
  { ...ORDER_ITEMS[0], business_inventory: { ...ORDER_ITEMS[0].business_inventory, ...MAP.vitex } },
  { ...ORDER_ITEMS[1], business_inventory: { ...ORDER_ITEMS[1].business_inventory, ...MAP.oak } },
];
const MAPPED_SERVICES = [
  { ...SERVICE_SELECTIONS[0], service_offerings: { ...SERVICE_SELECTIONS[0].service_offerings, ...MAP.delivery } },
  { ...SERVICE_SELECTIONS[1], service_offerings: { ...SERVICE_SELECTIONS[1].service_offerings, ...MAP.placement } },
];

function build(over: Partial<Parameters<typeof buildQboInvoiceLines>[0]> = {}): QboInvoicePayload {
  return buildQboInvoiceLines({
    order: ORDER, business: BUSINESS,
    orderItems: ORDER_ITEMS, serviceSelections: SERVICE_SELECTIONS, orderAddons: [],
    useNewModel: true, order_id: '2661dbe4-e26d-486f-b65f-50e0f56716c3',
    ...over,
  });
}
/** The 436 order WITH the mapping — the shape the push will send once the ids exist. */
function buildMapped(over: Partial<Parameters<typeof buildQboInvoiceLines>[0]> = {}): QboInvoicePayload {
  return build({ orderItems: MAPPED_ITEMS, serviceSelections: MAPPED_SERVICES, ...over });
}
/** Narrow to the success arm, or blow up loudly — a probe must never silently read `undefined`. */
function linesOf(p: QboInvoicePayload): Line[] {
  if (!p.ok) throw new Error(`expected a built payload, got a refusal: ${JSON.stringify(p.unmapped)}`);
  return p.lines as Line[];
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// A · THE FIX — THE REASON DOES NOT REACH THE PAYLOAD
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function reasonIsGone(): void {
  const payload = buildMapped();
  const lines = linesOf(payload);

  // 🔴 A1 — THE WHOLE POINT, AND IT SEARCHES THE ENTIRE PAYLOAD, NOT THE ONE LINE WE FIXED.
  const serialized = JSON.stringify(payload);
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
// B · THE CONCESSION SURVIVES — NOW AS QUICKBOOKS' OWN DISCOUNT CONSTRUCT
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function shapeSurvives(): void {
  const lines = linesOf(buildMapped());

  // 🔴 B1 — BOTH HALVES PRESENT. The concession is only auditable because the invoice carries the
  // baseline AND the give-away as separate lines. Collapsing to a net 1000 loses the $575 forever.
  const retail = find(lines, 'Placement Service × 7');
  const adj    = find(lines, 'price adjusted');
  ok(!!retail && !!adj, 'B1 🔴 BOTH lines survive — the retail baseline AND its own discount line');

  // B2 — the baseline is untouched retail and internally consistent. This is the exact property
  // QBO error 6070 rejected before D-48: Amount must equal UnitPrice × Qty.
  ok(retail?.Amount === 1575.00 && retail?.SalesItemLineDetail?.UnitPrice === 225.00
     && retail?.SalesItemLineDetail?.Qty === 7,
     'B2 the baseline line is 225.00 × 7 = 1575.00 — internally consistent (QBO 6070)');
  ok(round2(retail!.SalesItemLineDetail!.UnitPrice * retail!.SalesItemLineDetail!.Qty) === retail!.Amount,
     'B2b Amount === UnitPrice × Qty on the baseline line — the 6070 invariant, asserted directly');

  // 🔴 B3 — THE NATIVE CONSTRUCT, AND THE SIGN FLIP THAT COMES WITH IT. Under the old shape this
  // was a SalesItemLine of −575 against a revenue item. It is now QuickBooks' own discount line
  // carrying a POSITIVE 575 that QuickBooks SUBTRACTS. Both facts are asserted, because getting
  // the construct right with the wrong sign would double the discount.
  ok(adj?.DetailType === 'DiscountLineDetail',
     `B3 🔴 the concession is a native DiscountLineDetail — got "${adj?.DetailType}"`);
  ok(adj?.Amount === 575.00, `B3b 🔴 positive 575.00, the amount QuickBooks subtracts — got ${adj?.Amount}`);
  ok(adj?.DiscountLineDetail?.PercentBased === false,
     'B3c 🔴 PercentBased:false — the percent form would discount the SERVICE lines too, which D-39 forbids');
  ok(adj?.SalesItemLineDetail === undefined,
     'B3d a discount is not a sale — it carries no SalesItemLineDetail and no ItemRef');

  // B4 — the two together net to what was actually charged.
  ok(round2(retail!.Amount! - adj!.Amount!) === 1000.00,
     'B4 baseline − discount === 1000.00, the amount the order charged');

  // B5 — NO DiscountAccountRef is invented. We hold no account id; QuickBooks falls back to the
  // company default. Inventing one here would be the "Sales" mistake, one field to the left.
  ok(!JSON.stringify(adj).includes('DiscountAccountRef'),
     'B5 no DiscountAccountRef is fabricated — QuickBooks uses the company default');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// C · THE ARITHMETIC — AND THE TWO WAYS IT COULD NOW LIE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function arithmeticReconciles(): void {
  const payload = buildMapped();
  const lines = linesOf(payload);

  // C1 — goods land at their net, untouched.
  ok(find(lines, 'Shoal Creek Vitex')?.Amount === 496.00, 'C1 the vitex line is 496.00');
  ok(find(lines, 'Mexican Red Oak')?.Amount === 399.00,   'C1b the oak line is 399.00');
  ok(find(lines, 'Delivery × 1')?.Amount === 125.00,      'C1c the delivery line is 125.00');

  // 🔴 C2 — THE LINES NET TO THE ORDER'S SUBTOTAL, SIGNED BY CONSTRUCT. A naive sum of Amount now
  // reads 3170.00 — wrong by TWICE the discount, and wrong in the direction that says it balances.
  ok(netSum(lines) === 2020.00, `C2 🔴 the lines net to the order subtotal 2020.00 — got ${netSum(lines)}`);
  const naive = round2(lines.reduce((s, l) => s + Number(l.Amount ?? 0), 0));
  ok(naive === 3170.00 && naive !== 2020.00,
     `C2b 🔴 and a NAIVE sum would read ${naive} — proving the signing is load-bearing, not cosmetic`);

  // 🔴 C3 — TAX HAS LEFT THE LINE LIST. It is QuickBooks' own object now. Booking tax as a revenue
  // line inflated the business's revenue by the tax amount — money held for the state, recorded
  // as income.
  ok(!lines.some(l => /Sales Tax/.test(l.Description)),
     'C3 🔴 there is NO "Sales Tax" revenue line — tax is not a sale');
  ok(payload.ok && payload.txnTaxDetail?.TotalTax === 153.52,
     `C3b 🔴 tax rides TxnTaxDetail.TotalTax = 153.52 — got ${payload.ok ? payload.txnTaxDetail?.TotalTax : 'refused'}`);
  ok(round2(2020.00 * 0.076) === 153.52, 'C3c 2020.00 × 7.6% === 153.52 — the amount and the rate agree');
  ok(!JSON.stringify(payload).includes('TaxRateRef') && !JSON.stringify(payload).includes('TaxLine'),
     'C3d no TaxRateRef and no TaxLine — we hold no tax-rate id and do not fabricate one');

  // 🔴 C4 — THE WHOLE PAYLOAD RECONCILES TO THE ORDER TOTAL: lines net + tax === total. This is
  // the assertion the live guard makes before pushing; proving it here means the guard is never
  // the thing that discovers a regression, in front of a customer.
  ok(round2(netSum(lines) + 153.52) === ORDER.total_amount,
     `C4 🔴 lines net (${netSum(lines)}) + tax (153.52) === 2173.52, the order total`);

  // C5 — five lines now, not six: the tax line left.
  ok(lines.length === 5, `C5 five lines — the tax line is gone — got ${lines.length}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// D · 🔴 THE ITEM ID — RESOLVED FROM THE ROW, OR THE PUSH REFUSES. NEVER A DEFAULT.
//
// ⚠️ THIS SECTION REPLACES THE FOUR "KNOWN DEBT #106" PROBES THAT PINNED `ItemRef.value === '1'`
//    AS THE CURRENT TRUTH. Those probes said, in their own comment, that the day someone fixed
//    the defect they would FAIL and have to be updated deliberately. This is that update, and it
//    is deliberate: the assertions are INVERTED, not deleted.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function itemRefComesFromTheRow(): void {
  const lines = linesOf(buildMapped());

  // 🔴 D1 — THE LITERAL IS GONE FROM THE ENTIRE PAYLOAD. Searching the serialized object rather
  // than each line, because an id can reappear in a field nobody thought about.
  const serialized = JSON.stringify(buildMapped());
  ok(!/"value"\s*:\s*"1"/.test(serialized),
     'D1 🔴 no line points at hardcoded QB item "1" anywhere in the payload');
  ok(!serialized.includes('Services'),
     'D1b 🔴 and the name "Services" — which was never even item 1\'s real name — is gone too');

  // 🔴 D2 — THE ID COMES FROM THE ROW, and a PLANT no longer books as a service. This is the
  // whole point: item 1 books to a generic income account, so trees and placement landed in one
  // bucket. They now land in two, because two different rows carried two different ids.
  const vitex = find(lines, 'Shoal Creek Vitex');
  const place = find(lines, 'Placement Service × 7');
  ok(vitex?.SalesItemLineDetail?.ItemRef.value === '47',
     `D2 the tree line takes its id from its business_inventory row — got ${vitex?.SalesItemLineDetail?.ItemRef.value}`);
  ok(place?.SalesItemLineDetail?.ItemRef.value === '19',
     `D2b the service line takes its id from its service_offerings row — got ${place?.SalesItemLineDetail?.ItemRef.value}`);
  ok(vitex!.SalesItemLineDetail!.ItemRef.value !== place!.SalesItemLineDetail!.ItemRef.value,
     'D2c 🔴 a TREE and a SERVICE no longer book to the same item — the split the cost model rests on');

  // D3 — the readable half is carried when the row has it, and it is never authoritative.
  ok(vitex?.SalesItemLineDetail?.ItemRef.name === 'Nursery Stock:Trees',
     'D3 the item NAME rides along for readability when the row carries one');
}

function noRowNoIdRefuses(): void {
  // 🔴 D4 — THE LIVE STATE TODAY. No table carries `qbo_item_id`, so the 436 order REFUSES. This
  // probe is the honest state of the platform as of this build, not a hypothetical.
  const payload = build();
  ok(!payload.ok, 'D4 🔴 with no mapping on any row, the payload REFUSES rather than defaulting');
  if (payload.ok) return;

  // D5 — the refusal names every line, not just the first. Being sent back four times to fix one
  // row each is its own defect.
  ok(payload.unmapped.length === 4,
     `D5 all four revenue lines are named at once — got ${payload.unmapped.length}`);
  ok(payload.unmapped.some(u => u.source === 'business_inventory')
     && payload.unmapped.some(u => u.source === 'service_offerings'),
     'D5b and each names the TABLE that owes the mapping — so the fix is a place, not a hunt');
  ok(round2(payload.unmapped.reduce((s, u) => s + u.amount, 0)) === 2595.00,
     `D5c the refusal carries the money at stake (496+399+125+1575) — got ${round2(payload.unmapped.reduce((s, u) => s + u.amount, 0))}`);

  // 🔴 D6 — A PARTIAL MAPPING STILL REFUSES. This is the probe that matters most: mapping three of
  // four rows must NOT produce an invoice that is three-quarters right and silently wrong on the
  // fourth. One unmapped revenue line refuses the WHOLE push.
  const partial = build({ orderItems: MAPPED_ITEMS });   // goods mapped, services not
  ok(!partial.ok, 'D6 🔴 a PARTIALLY mapped order still refuses — no invoice is three-quarters right');
  ok(!partial.ok && partial.unmapped.length === 2,
     'D6b and it names exactly the two that are still unmapped');

  // D7 — a BLANK id is not an id. An empty string would push `ItemRef: { value: "" }` to a
  // customer's books, which is worse than refusing because it looks like it worked.
  const blank = build({
    orderItems: [{ ...ORDER_ITEMS[0], business_inventory: { ...ORDER_ITEMS[0].business_inventory, qbo_item_id: '   ' } },
                 ORDER_ITEMS[1]],
    serviceSelections: MAPPED_SERVICES,
  });
  ok(!blank.ok && blank.unmapped.some(u => u.label.includes('Shoal Creek Vitex')),
     'D7 a blank/whitespace qbo_item_id refuses exactly like a missing one');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// E · 🔴 THE $0 DOCUMENTATION LINES — A NOTE IS NOT A SALE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function zeroLinesAreNotes(): void {
  // E1 — netting DECLINED. Under the old shape this booked against a revenue item, so a customer's
  // books recorded a $0 SALE of a service they explicitly refused.
  const declined = linesOf(buildMapped({
    order: { ...ORDER, netting_declined: true },
    serviceSelections: [
      ...MAPPED_SERVICES,
      { quantity: 1, unit_price_at_time: 10, subtotal: 10, is_manual_override: false, override_reason: null,
        service_offerings: { name: 'Netting', category: 'addon', transport_mode: null,
                             trigger_transport_mode: 'self', qbo_item_id: '55' } },
    ],
  }));
  const note = find(declined, 'DECLINED by customer');
  ok(note?.DetailType === 'DescriptionOnly',
     `E1 🔴 a declined add-on is a DescriptionOnly note — got "${note?.DetailType}"`);
  ok(note?.SalesItemLineDetail === undefined,
     'E1b 🔴 and it carries NO ItemRef — a refusal is not a $0 service sale');
  ok(note?.Amount === 0, 'E1c the note is $0');

  // E2 — $0 transport included. Same class.
  const freeTransport = linesOf(buildMapped({
    serviceSelections: [
      { quantity: 1, unit_price_at_time: 0, subtotal: 0, is_manual_override: false, override_reason: null,
        service_offerings: { name: 'Delivery', category: 'transport', transport_mode: 'staff',
                             trigger_transport_mode: null, qbo_item_id: '12' } },
    ],
  }));
  ok(find(freeTransport, 'Delivery')?.DetailType === 'DescriptionOnly',
     'E2 $0 included transport is a note, not a $0 sale of transport');

  // 🔴 E3 — THE TAX-EXEMPT NOTE. A $0 line documenting WHY no tax was charged, and no tax object.
  const exempt = buildMapped({
    order: { ...ORDER, tax_amount: 0, total_amount: 2020.00, tax_exempt_applied: true,
             tax_exempt_reason: 'resale', tax_exempt_cert_ref: 'TX-12345' },
  });
  const exemptLines = linesOf(exempt);
  const exemptNote = find(exemptLines, 'Tax exempt');
  ok(exemptNote?.DetailType === 'DescriptionOnly',
     `E3 the tax-exemption note is DescriptionOnly — got "${exemptNote?.DetailType}"`);
  ok(exemptNote?.Description.includes('TX-12345'),
     'E3b it still carries the certificate reference — the documentation value is not lost');
  ok(exempt.ok && exempt.txnTaxDetail === null,
     'E3c 🔴 and an exempt order carries NO TxnTaxDetail at all — omit, never an explicit zero (D-9)');

  // E4 — legacy staff transport, the order_addons path.
  const legacy = linesOf(build({
    useNewModel: false, serviceSelections: [], orderItems: MAPPED_ITEMS,
    orderAddons: [],
    order: { ...ORDER, transport_method: 'delivery' },
  }));
  ok(find(legacy, 'staff transport')?.DetailType === 'DescriptionOnly',
     'E4 the legacy staff-transport line is a note too');

  // 🔴 E5 — THE LEGACY INSTALLATION LINE IS GONE, AND THIS IS THE REGRESSION GUARD (#239).
  // It used to assert the opposite: that `Installation service · N plant(s)` rendered as a $0 note.
  // It was removed on measurement, not preference — unreachable from checkout by construction
  // (submit.ts:799's `{transport_mode:'self'}` fallback forces a service-selection row onto every
  // 'install' order, so useNewModel is true and this branch is never entered), refused outright on
  // history orders, and ZERO occurrences across LAWNS's 1,469 captured invoices / 5,371 lines.
  // A $0 revenue line backed by NO ROW is a path that looks live to the next reader; this assertion
  // is what stops it being re-added by someone reading `transport_method === 'install'` and
  // assuming a line is owed.
  const install = linesOf(build({
    useNewModel: false, serviceSelections: [], orderItems: MAPPED_ITEMS, orderAddons: [],
    order: { ...ORDER, transport_method: 'install' },
  }));
  ok(find(install, 'Installation service') === undefined,
     'E5 🔴 an install order emits NO installation line at all — the branch is gone, not re-shaped');
  ok(find(install, 'staff transport')?.DetailType === 'DescriptionOnly',
     'E5b it takes the staff-transport note instead — the weaker TRUE claim, never a fabricated sale');
  ok(install.every(l => l.DetailType !== 'SalesItemLineDetail' || Number(l.Amount) !== 0),
     'E5c and no $0 revenue line survives anywhere on that order');

  // 🔴 E6 — THE LEGACY ADDON PATH (which STAYS — see tech-debt #128): a PRICED legacy line becomes
  // revenue and REFUSES, naming `addons` as the table that owes the mapping. `order_addons` holds
  // zero rows platform-wide today, so this path is dead by DATA rather than by code — a weaker
  // guarantee than E5's, which is exactly why the code is still asserted and still here.
  const pricedInstall = build({
    useNewModel: false, serviceSelections: [], orderItems: MAPPED_ITEMS, orderAddons: [
      { quantity: 1, unit_price: 250, subtotal: 250, addons: { name: 'Installation', trigger_rule: null } },
    ],
    order: { ...ORDER, transport_method: 'install' },
  });
  ok(!pricedInstall.ok && pricedInstall.unmapped.some(u => u.source === 'addons'),
     'E6 🔴 a PRICED legacy line becomes revenue and refuses, naming the table that owes the mapping');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// F · 🔴 A SURCHARGE IS NOT A DISCOUNT — the distinction the native construct forces
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function surchargeIsRevenue(): void {
  // The owner charged $1800 against a $1575 baseline — an override ABOVE baseline. Under the old
  // shape this flipped a sign on a "discount" line. QuickBooks has no negative discount, and an
  // upcharge IS revenue, so it takes the revenue path.
  const over = [
    MAPPED_SERVICES[0],
    { ...MAPPED_SERVICES[1], subtotal: 1800.00 },
  ];
  const lines = linesOf(buildMapped({
    serviceSelections: over,
    order: { ...ORDER, subtotal: 2820.00, tax_amount: 214.32, total_amount: 3034.32 },
  }));
  const adj = find(lines, 'price adjusted');
  ok(adj?.DetailType === 'SalesItemLineDetail',
     `F1 🔴 a surcharge is a SALE, not a discount — got "${adj?.DetailType}"`);
  ok(adj?.Amount === 225.00, `F1b it is a positive 225.00 of revenue — got ${adj?.Amount}`);
  ok(adj?.SalesItemLineDetail?.ItemRef.value === '19',
     'F1c and it resolves an item id like any other revenue line');
  ok(netSum(lines) === 2820.00, `F1d the payload still nets to the charged subtotal — got ${netSum(lines)}`);

  // 🔴 F2 — AND AN UNMAPPED SURCHARGE REFUSES. The direction must not become a back door around
  // the item rule.
  const unmappedSurcharge = build({
    orderItems: MAPPED_ITEMS,
    serviceSelections: [ MAPPED_SERVICES[0], { ...SERVICE_SELECTIONS[1], subtotal: 1800.00 } ],
    order: { ...ORDER, subtotal: 2820.00, tax_amount: 214.32, total_amount: 3034.32 },
  });
  ok(!unmappedSurcharge.ok, 'F2 🔴 an unmapped surcharge refuses — the sign is not a back door');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// G · THE TIER DISCOUNT — the other caller of the same construct
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function tierDiscountIsNative(): void {
  const discounted = linesOf(buildMapped({
    orderItems: [
      { ...MAPPED_ITEMS[0], unit_price: 111.60, subtotal: 446.40, retail_unit: 124.00, discount_pct: 10, discount_amt: 49.60 },
    ],
    serviceSelections: [],
    order: { ...ORDER, subtotal: 446.40, tax_amount: 33.93, total_amount: 480.33 },
  }));
  const disc = find(discounted, 'Discount (10% off)');
  ok(disc?.DetailType === 'DiscountLineDetail', 'G1 the tier discount is native too — ONE helper, both callers');
  ok(disc?.Amount === 49.60, `G1b positive 49.60 — got ${disc?.Amount}`);
  // Goods push at RETAIL so the discount is visible rather than baked into a net rate (D-43).
  ok(find(discounted, 'Shoal Creek Vitex')?.Amount === 496.00, 'G1c goods at RETAIL 496.00, discount shown separately');
  ok(netSum(discounted) === 446.40, `G1d and it nets to the charged 446.40 — got ${netSum(discounted)}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// H · RED-FIRST (STD-024) — PROVE THE PROBES CAN FAIL
// ═════════════════════════════════════════════════════════════════════════════════════════════════

function probesCanFail(): void {
  // H1 — a NEGATIVE CONTROL for A1/A2. Re-interpolate the reason by hand, exactly as the old code
  // did, and confirm the leak detector fires. Without this, A1 passing proves nothing.
  const leaked = linesOf(buildMapped());
  leaked[4] = { ...leaked[4], Description: `Placement Service — price adjusted (reason: ${LEAKED_REASON})` };
  ok(JSON.stringify(leaked).includes(LEAKED_REASON),
     'H1 🔴 the leak detector DOES fire on the old shape — A1 is a real assertion, not a vacuous one');

  // 🔴 H2 — A NEGATIVE CONTROL FOR D1, AND IT IS THE ONE THAT MATTERS. Re-introduce the exact
  // literal this build removed and confirm the detector catches it. A search for a string that
  // can no longer be produced "passes" forever; this proves it is still watching.
  const relapsed = linesOf(buildMapped());
  relapsed[0] = { ...relapsed[0],
    SalesItemLineDetail: { UnitPrice: 124, Qty: 4, ItemRef: { value: '1', name: 'Services' } } };
  ok(/"value"\s*:\s*"1"/.test(JSON.stringify(relapsed)) && JSON.stringify(relapsed).includes('Services'),
     'H2 🔴 the hardcoded-literal detector DOES fire when the literal comes back — D1 can fail');

  // H3 — a negative control for C2: break one amount and confirm the signed reconcile notices.
  const broken = linesOf(buildMapped());
  broken[1] = { ...broken[1], Amount: 400.00 };   // 399 → 400
  ok(netSum(broken) !== 2020.00, 'H3 the signed reconcile notices a one-dollar error — C2 can fail');

  // 🔴 H4 — a negative control for the SIGN. Flip the discount to a SalesItemLine (the old shape)
  // and confirm the net changes — proving `netSum` genuinely reads the construct rather than
  // happening to agree.
  const unsigned = linesOf(buildMapped());
  unsigned[4] = { ...unsigned[4], DetailType: 'SalesItemLineDetail' };
  ok(netSum(unsigned) === 3170.00,
     `H4 🔴 mis-typing the discount line swings the net by twice the discount — got ${netSum(unsigned)}`);

  // H5 — a negative control for D4: the refusal must not be something that fires unconditionally.
  // The mapped build SUCCEEDS, which is what makes D4's refusal meaningful.
  ok(buildMapped().ok, 'H5 the mapped order BUILDS — so D4\'s refusal is about the mapping, not a stuck gate');

  // H6 — a negative control for E1: confirm a note WOULD carry an ItemRef if the code regressed.
  const noteRegressed = { Description: 'x', Amount: 0, DetailType: 'SalesItemLineDetail',
                          SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1' } } };
  ok(noteRegressed.SalesItemLineDetail !== undefined,
     'H6 the "no SalesItemLineDetail" assertion in E1b is checking a field that CAN be present');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════

function main(): void {
  reasonIsGone();
  shapeSurvives();
  arithmeticReconciles();
  itemRefComesFromTheRow();
  noRowNoIdRefuses();
  zeroLinesAreNotes();
  surchargeIsRevenue();
  tierDiscountIsNative();
  probesCanFail();
  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  FAILURES:');
    for (const f of failures) console.log(`   ✗ ${f}`);
    process.exit(1);
  }
}

main();
