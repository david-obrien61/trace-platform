#!/usr/bin/env node
/**
 * Unit proof for toISODate (Wave 2 date-field fix). HTML <input type="date"> requires a
 * strict YYYY-MM-DD value; OCR returns dates "as printed" (LAWNS prints US MM/DD/YYYY),
 * which rendered the invoice Date / Due / Delivery fields EMPTY. Proves the normalizer
 * converts the formats LAWNS invoices actually use, passes ISO through, and leaves genuinely
 * absent/unreadable values empty (D-9 — never fabricate).
 *
 * Run: npx esbuild packages/cultivar-os/src/utils/dateParse.ts --bundle --platform=node \
 *        --format=esm --outfile=/tmp/dateParse.mjs && node scripts/verify-date-parse.mjs
 */
import { toISODate } from '/tmp/dateParse.mjs';

const cases = [
  ['06/22/2026', '2026-06-22'],            // LAWNS invoice date (the bug)
  ['06/25/2026', '2026-06-25'],            // LAWNS delivery date (the bug)
  ['6/2/2026',   '2026-06-02'],            // single-digit M/D
  ['06-22-2026', '2026-06-22'],            // dash separator
  ['06.22.2026', '2026-06-22'],            // dot separator
  ['06/22/26',   '2026-06-22'],            // 2-digit year
  ['2026-06-22', '2026-06-22'],            // already ISO → passthrough
  ['2026-06-22T00:00:00', '2026-06-22'],   // ISO with time
  ['June 22, 2026', '2026-06-22'],         // textual month
  ['Jun 22 2026', '2026-06-22'],           // abbreviated textual
  ['', ''],                                 // empty → empty (D-9)
  [null, ''],                               // null → empty
  ['not a date', ''],                       // unparseable → empty (no fabrication)
  ['13/45/2026', ''],                       // invalid M/D → empty
];

let pass = 0, fail = 0;
for (const [inp, want] of cases) {
  const got = toISODate(inp);
  const ok = got === want;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  toISODate(${JSON.stringify(inp)}) = ${JSON.stringify(got)}${ok ? '' : '  EXPECTED ' + JSON.stringify(want)}`);
  ok ? pass++ : fail++;
}
console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ ' + fail + ' FAILED'} (${pass}/${cases.length})`);
process.exit(fail === 0 ? 0 : 1);
