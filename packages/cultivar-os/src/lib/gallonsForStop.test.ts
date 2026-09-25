// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove one stop's planting volume — and above all that a tree whose size cannot be
//   read is COUNTED rather than treated as zero gallons.
// DEPENDENCIES: lib/dayEstimate (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { gallonsForStop } from './dayEstimate';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const tree = (gallons: number | null, quantity: number) => ({ gallons, quantity });

{
  const r = gallonsForStop({ trees: [tree(30, 2), tree(15, 4)] });
  ok(r.gallons === 120 && r.treesSizeUnknown === 0, `A1 two 30gal and four 15gal is 120 gallons (got ${r.gallons})`);
}
{
  // 🔴 THE ONE THAT MATTERS. A stop of twelve trees with four unreadable must not read as a
  // LIGHT stop — it is an UNKNOWN one, and the planner marks the day "at least" because of this.
  const r = gallonsForStop({ trees: [tree(30, 8), tree(null, 4)] });
  ok(r.gallons === 240, 'A2 the trees that CAN be sized are still summed — discarding eight measurable trees because the ninth is unreadable throws the answer away to avoid rounding it');
  ok(r.treesSizeUnknown === 4,
     '🔴 A3 …AND THE FOUR TRAVEL BESIDE IT. Silently contributing 0 minutes would make an unknown stop look like a light one, and the crew split would be wrong in a way nobody could see');
}
{
  const r = gallonsForStop({ trees: [] });
  ok(r.gallons === 0 && r.treesSizeUnknown === 0, 'A4 a stop with no trees is zero of both, and does not throw');
}
{
  const r = gallonsForStop({ trees: [tree(NaN, 3), tree(30, NaN as unknown as number)] });
  ok(r.treesSizeUnknown === 3, 'A5 a NaN size is unreadable, not zero gallons');
  ok(r.gallons === 0, 'A6 …and a NaN quantity contributes nothing rather than NaN — one bad row must not make the whole day unanswerable');
}
{
  // NEGATIVE CONTROL — the sum must depend on the QUANTITY, not just the sizes present.
  const one = gallonsForStop({ trees: [tree(30, 1)] });
  const ten = gallonsForStop({ trees: [tree(30, 10)] });
  ok(one.gallons === 30 && ten.gallons === 300,
     '🔴 A7 NEGATIVE CONTROL: the same rung at ten times the quantity is ten times the gallons. An implementation ignoring quantity would pass A1 only by coincidence');
}

console.log(`\ngallonsForStop — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
