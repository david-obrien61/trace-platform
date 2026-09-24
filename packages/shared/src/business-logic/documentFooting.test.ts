/**
 * ── THE FOOTING GUARD, AND THE SOURCE FIX BENEATH IT · #395 ───────────────────
 *
 * RED-FIRST against the REAL LaPrime shape, taken verbatim from her live receipt
 * (f8dc9fa6, captured 2026-09-23): `line_items_original` carries 2 lines, `line_items`
 * carries the same 2 plus the tree and the tax. The order was built from the first and
 * went out 8 trees short for the next morning's delivery.
 *
 * 🔴 THE PROBE THAT MATTERS MOST IS C3 — a capture that ALREADY FOOTS must be completely
 * unaffected: no hold, no extra step, no message. A guard that makes Lauren confirm a good
 * invoice is a guard she will route around, and then it protects nothing.
 */
import { documentFooting, footingMessage, historyOrderLines } from './historyOrder';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── LaPrime's receipt, verbatim from live ────────────────────────────────────
const LAPRIME_ORIGINAL = [
  { sku: null, amount: -300, quantity: 8, unit_price: -37.5, description: 'Customer Discount' },
  { sku: null, amount: 200,  quantity: 1, unit_price: 200,   description: 'Backyard Delivery' },
];
const LAPRIME_CORRECTED = [
  ...LAPRIME_ORIGINAL,
  { sku: null, amount: 156.75, quantity: null, unit_price: null, description: 'Tax' },
  { sku: null, amount: 2000,   quantity: null, unit_price: null, description: 'Skyline Holly - 15 Gallon' },
];
const LAPRIME_SUBTOTAL = 1900.00;

// ── §A THE DEFECT, STATED AS ARITHMETIC ──────────────────────────────────────
const fromSnapshot = documentFooting(LAPRIME_ORIGINAL, LAPRIME_SUBTOTAL);
ok(fromSnapshot.balances === false,
  '🔴 A1 THE LIVE DEFECT — the WRITE-ONCE OCR SNAPSHOT does not foot: this is what built her order');
ok(Math.abs(fromSnapshot.missing - 2000) < 0.005,
  `🔴 A2 and it is short by exactly the eight trees — $2,000 (got ${fromSnapshot.missing})`);

// ── §B THE FIX — the corrected document foots ────────────────────────────────
// Tax is a line on the captured document but is NOT part of the subtotal, so the corrected
// set foots only once the tree is counted and the tax is not. That is the real arithmetic,
// not a convenient one: -300 + 200 + 2000 = 1900, and the 156.75 tax sits outside it.
const corrected = documentFooting(
  LAPRIME_CORRECTED.filter(l => l.description !== 'Tax'), LAPRIME_SUBTOTAL);
ok(corrected.balances === true,
  '🔴 B1 THE FIX — Lauren\'s CORRECTED lines foot to the document subtotal');
ok(corrected.missing === 0, `B2 nothing missing once the tree is counted (got ${corrected.missing})`);
ok(historyOrderLines(LAPRIME_CORRECTED).length === 4,
  'B3 the corrected set really is longer than the snapshot — 4 lines vs 2');

// ── §C THE REGRESSION LAUREN WOULD HATE ──────────────────────────────────────
const GOOD = [
  { sku: 'EHMP30BF', amount: 950, quantity: 1, unit_price: 950, description: 'Eagleston Holly' },
  { sku: 'DW15',     amount: 450, quantity: 1, unit_price: 450, description: 'Desert Willow' },
];
const good = documentFooting(GOOD, 1400.00);
ok(good.balances === true, '🔴 C1 a capture that ALREADY FOOTS is clean — nothing is held');
ok(good.missing === 0, 'C2 and there is nothing to report on it');
ok(good.balances === true && documentFooting(GOOD, 1400.004).balances === true,
  '🔴 C3 HALF-A-CENT TOLERANCE — numeric(10,2) rounding must not manufacture a hold on a good invoice');

// ── §D THE OTHER SIGN — lines EXCEEDING the document ─────────────────────────
// LEANDER AREA WHLS NRS: lines 1319.80 against a 1283.88 subtotal. A vendor invoice captured
// as a sale. It is held too, and the message must not say "missing" about extra money.
const over = documentFooting(
  [{ sku: null, amount: 1319.80, quantity: 1, unit_price: 1319.80, description: 'vendor total' }], 1283.88);
ok(over.balances === false, '🔴 D1 lines EXCEEDING the subtotal are held as well');
ok(over.missing < 0, `D2 and the sign says which mistake it is (got ${over.missing})`);
ok(footingMessage(over.missing).includes('more than the invoice total'),
  '🔴 D3 the message does not claim money is MISSING when there is too much of it');
ok(footingMessage(2000).includes('$2000.00 missing'),
  'D4 the short case names the amount Lauren has to find');

// ── §E THE GUARD CANNOT BE FOOLED BY AN EMPTY OR ABSENT SET ──────────────────
ok(documentFooting(null, 1900).balances === false,
  '🔴 E1 a null line set against a non-zero subtotal does NOT read as balanced');
ok(documentFooting([], 0).balances === true,
  'E2 genuinely nothing, against nothing, is balanced — not every empty is a fault');

console.log(`\ndocumentFooting — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
