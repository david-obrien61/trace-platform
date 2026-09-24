/**
 * ── THE ORDERS LIST DESCRIBES THE RIGHT ROW · #403 ───────────────────────────
 * Shapes taken from LAWNS's live orders: the discount and the trip charge are ordinary
 * lines and frequently sort first, so `order_items[0]` printed "8× Customer Discount".
 */
import { primaryOrderLine } from './primaryOrderLine';
let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); console.error('   ✗ ' + m); } };

// Lindsey LaPrime, live: discount first, then the delivery, then the trees
const LAPRIME = [
  { description: 'Customer Discount', quantity: 8, unit_price: -37.5 },
  { description: 'Backyard Delivery', quantity: 1, unit_price: 200 },
  { description: 'Skyline Holly - 15 Gallon', quantity: 8, unit_price: 250 },
];
// Duy Le, live: discount, trip charge, then the tree
const DUY = [
  { description: 'Customer Discount 15%', sku: 'Customer Discount', quantity: 1, unit_price: -67.5 },
  { description: 'Trip Charge', sku: 'TC', quantity: 1, unit_price: 50 },
  { description: 'Desert Willow 15 Gallon', quantity: 1, unit_price: 450 },
];

ok(primaryOrderLine(LAPRIME)?.description === 'Skyline Holly - 15 Gallon',
   '🔴 A1 LaPrime summarises as the TREE, not "8× Customer Discount"');
ok(primaryOrderLine(DUY)?.description === 'Desert Willow 15 Gallon',
   '🔴 A2 Duy Le summarises as the TREE, not "1× Customer Discount 15%"');
ok((LAPRIME[0] as any).description === 'Customer Discount',
   'A3 …and the ORDER is untouched — this only chooses which line to show');

// the mutant: the old behaviour
ok(LAPRIME[0].description !== primaryOrderLine(LAPRIME)?.description,
   '🔴 A4 THE MUTANT — items[0] is NOT what this returns; that is the whole change');

// trip charge alone, by SKU rather than description
ok(primaryOrderLine([{ description: 'Trip Charge', sku: 'TC', quantity: 1, unit_price: 50 },
                     { description: 'Live Oak 95 Gallon', quantity: 1, unit_price: 2125 }])?.description
   === 'Live Oak 95 Gallon', 'B1 a trip charge is skipped whether matched by text or SKU');

// 🔴 the fallbacks — an order must still summarise as SOMETHING
ok(primaryOrderLine([{ description: 'Customer Discount', quantity: 1, unit_price: -50 }])?.description
   === 'Customer Discount',
   '🔴 C1 an order that is ONLY a discount still summarises as that line, not "No items"');
ok(primaryOrderLine([]) === null, 'C2 an order with no lines is null — an empty order is a real state');
ok(primaryOrderLine(null) === null, 'C3 …and so is a missing list');
ok(primaryOrderLine([{ description: 'Eagleston Holly', quantity: 1, unit_price: 950 }])?.description
   === 'Eagleston Holly', 'C4 NEGATIVE CONTROL — a normal order is unaffected');
ok(primaryOrderLine([{ description: 'Replacement tree', quantity: 1, unit_price: 0 }])?.description
   === 'Replacement tree',
   '🔴 C5 a ZERO-priced warranty replacement is still a product — Gillespie’s two replacements are $0.00');

// 🔴 THE REGRESSION THE ANCHORING EXISTS FOR — Wong's real lines carry "(Install & Warranty)"
ok(primaryOrderLine([
  { description: 'Customer Discount', quantity: 2, unit_price: -270 },
  { description: 'Texas Red Oak - 30 Gallon (Install & Warranty)', quantity: 2, unit_price: 900 },
])?.description === 'Texas Red Oak - 30 Gallon (Install & Warranty)',
  '🔴 D1 a product whose NAME contains "Install" is NOT mistaken for a service line');
ok(primaryOrderLine([{ description: 'Backyard Delivery', quantity: 1, unit_price: 200 },
                     { description: 'Skyline Holly - 15 Gallon', quantity: 8, unit_price: 250 }])?.description
   === 'Skyline Holly - 15 Gallon', '🔴 D2 "Backyard Delivery" is a service, and the tree wins');

console.log(`\nprimaryOrderLine — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
