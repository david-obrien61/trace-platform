/**
 * ── tech-debt #301 — THE NINE TREES THE DESCRIPTION READER CANNOT REACH · RED-FIRST CASE ─────────
 *
 * 🔴 THIS FILE IS EXPECTED TO FAIL TODAY, AND IT IS DELIBERATELY NOT A `.test.ts`. `npm test` runs
 * every `*.test.ts` under `packages/`, so a red case there would fail every build. It lives here,
 * named so the runner does not pick it up, and is run by hand:
 *
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/__redfirst__/nineTrees301.redfirst.ts \
 *     --bundle --platform=node --format=cjs | node
 *
 * EXPECTED TODAY: 9 failed, exit 1. WHEN #301 IS FIXED: 9 passed, exit 0 — then move these cases
 * into `qboItemAdapter.test.ts` and delete the pin there (§P301), which will have gone red first.
 *
 * THE DEFECT (measured 2026-09-12 and again 2026-09-16 over every LAWNS `order_items` row naming a
 * gallon size): `readProductFromDescription` scans backward from the END of the line and stops at the
 * first size-shaped word. An UNBRACKETED trailing remark — "Install & Warranty", "15% Off" — sits
 * after the size, so the scan reports "no size stated" (or reads "15% Off" and gives up) and never
 * reaches "30 gallon". These are real trees, and the load list cannot stake or mix them.
 *
 * ⚠️ DO NOT FIX IT BY SCANNING HARDER (the file's own header says why: a scan that keeps looking finds
 * a size inside a fertiliser name). The fix #301 names is a vocabulary of REMARKS stripped the way the
 * bracketed ones already are — and the negative control below must still hold after it.
 */
import { readProductFromDescription } from '../qboItemAdapter';
import { NINE_301 } from './nineTrees301.cases';

{
  let passed = 0, failed = 0;
  for (const [d, name, size] of NINE_301) {
    const r = readProductFromDescription(d);
    if (r.state === 'sized' && r.size === size && r.name === name) passed++;
    else { failed++; console.error(`   ✗ "${d}" → ${r.state} ${JSON.stringify(r.size)} (want "${size}")`); }
  }
  // Negative control — must stay true whatever the fix is: a size inside a NAME is not the container.
  const control = readProductFromDescription('Hi-Yield 15-0-15 Fertilizer');
  if (control.state === 'sized') { failed++; console.error('   ✗ NEGATIVE CONTROL: a number inside a fertiliser name was read as a size'); }
  else passed++;
  console.log(`\ntech-debt #301 red-first: ${passed} passed, ${failed} failed (EXPECTED TODAY: 9 failed)`);
  process.exit(failed ? 1 : 0);
}
