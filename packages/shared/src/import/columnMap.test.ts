/**
 * ── columnMap — the four-rung ladder · CSV catalog import · 2026-07-23 ──
 *
 * RED-first. Every assertion is the fixture's own headers, so the owner-test cards (mapping
 * rung visible, L3 never auto-applies, Wholesale flagged, overrides) have a proven engine.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/import/columnMap.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { mapColumns, duplicateSpineTargets, SYNONYMS } from './columnMap';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// The fixture's headers + column-wise sample values.
const HEADERS = ['Item #', 'Botanical Name', 'Cont.', 'Ready', 'Retail', 'Wholesale', 'Sun', 'Height', 'Spread', 'Notes', 'Zone'];
const SAMPLE: string[][] = [
  ['DISC-1101', 'DISC-1104', 'DISC-1200', 'DISC-1301'],          // Item #
  ["Basham's Party Pink Crape Myrtle", "'Sierra' Mexican Red Oak"], // Botanical Name
  ['30 gal', '15 gal', '45 gal', '30 gal'],                       // Cont.
  ['12', '8', '5', '20', '99', '30'],                            // Ready
  ['$189.00', '$95.00', '$0.00', '$45.00', '$65.00'],           // Retail
  ['$120.00', '$60.00', '$0.00', '$30.00', '$50.00', '$40.00'], // Wholesale
  ['Full Sun', 'Full sun, part shade', 'Sun'],                  // Sun
  ['25 ft', '20 ft', '40 ft', '15 ft', '50 ft'],               // Height
  ['15 ft', '25 ft', '30 ft', '12 ft'],                         // Spread
  ['Fast grower', 'Native', 'Blooms summer', 'Loves water'],    // Notes
  ['7', '6', '8', '7', '7', '8'],                               // Zone
];

const m = mapColumns(HEADERS, SAMPLE);
const by = (h: string) => m.find(x => x.header === h)!;

// ── L2 synonym, rung visible ────────────────────────────────────────────────────
ok(by('Item #').target === 'sku' && by('Item #').rung === 'synonym', 'Item # → sku by synonym');
ok(by('Botanical Name').target === 'name' && by('Botanical Name').rung === 'synonym', 'Botanical Name → name by synonym');
ok(by('Cont.').target === 'size' && by('Cont.').rung === 'synonym', 'Cont. → size by synonym (card 2)');
ok(by('Retail').target === 'sell_price' && by('Retail').rung === 'synonym', 'Retail → sell_price by synonym');

// ── L3 shape — proposes qty for `Ready`, and it does NOT auto-apply (card 1) ─────
ok(by('Ready').target === 'qty', 'Ready → qty candidate from its integer VALUES');
ok(by('Ready').rung === 'shape', 'Ready is L3 (shape), not a synonym');
ok(by('Ready').proposed === true, 'L3 NEVER auto-applies — Ready is proposed, pending confirm (card 1)');
ok(!SYNONYMS.qty.includes('ready'), '`ready` is deliberately NOT a qty synonym (else card 1 is un-provable)');

// ── 🔴 Wholesale — currency, unmapped, FLAGGED load-bearing (card 5) ─────────────
ok(by('Wholesale').target === 'attribute', 'Wholesale is NOT mapped to a spine field (sell_price is taken by Retail)');
ok(by('Wholesale').loadBearing === true, '🔴 Wholesale flagged load-bearing — held in the bag, nothing computes on it');
ok(by('Wholesale').proposed === false, 'a load-bearing money column is not a silent qty/price proposal');

// ── L4 — the descriptive columns land as attributes, unflagged ───────────────────
for (const h of ['Sun', 'Height', 'Spread', 'Notes', 'Zone']) {
  ok(by(h).target === 'attribute' && !by(h).loadBearing, `${h} → attribute, not load-bearing`);
}
ok(by('Zone').loadBearing === false, 'Zone (small integers) is NOT flagged — qty is already claimed, and it is not money');

// ── override / duplicate detection ──────────────────────────────────────────────
{
  // The owner overrides Wholesale → sell_price (their call): now two columns claim sell_price.
  const overridden = m.map(x => x.header === 'Wholesale'
    ? { ...x, target: 'sell_price' as const, rung: 'exact' as const, proposed: false } : x);
  ok(duplicateSpineTargets(overridden).includes('sell_price'), 'two columns → one spine field is a detectable conflict');
  ok(duplicateSpineTargets(m).length === 0, 'the initial mapping has no duplicate spine targets');
}
// A proposed (unconfirmed) column does not create a conflict until confirmed.
ok(duplicateSpineTargets(m.filter(x => x.header === 'Ready')).length === 0, 'an unconfirmed L3 proposal is not a claim yet');

console.log(`\ncolumnMap — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
