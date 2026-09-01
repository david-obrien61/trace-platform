/**
 * ── deliveryWindow — the date bound behind the delivery list ─────────────────────────────────
 *
 * 🔴 §B IS THE ONE THAT MATTERS. A selected day must reach the QUERY. The defect this file
 *   guards is not cosmetic: with 564 imported past stops, a client-side day filter over an
 *   unbounded `.limit(200)` read makes the calendar's drill-in report "Nothing scheduled on this
 *   day" for days that HAVE stops — absence asserted without being established.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/deliveryWindow.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { deliveryQueryBounds, isoDaysBefore, DELIVERY_LIST_PAST_DAYS } from './deliveryWindow';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
/** Local midnight, so a fixture date is the calendar day it reads as rather than a UTC instant. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 30);

// ══ §A THE ISO HELPER — LOCAL, AND CORRECT ACROSS EVERY BOUNDARY ═══════════
{
  ok(isoDaysBefore(at(2026, 9, 1), 0)  === '2026-09-01', 'A1 zero days back is today');
  ok(isoDaysBefore(at(2026, 9, 1), 30) === '2026-08-02', 'A2 thirty days back crosses a month');
  ok(isoDaysBefore(at(2026, 3, 1), 1)  === '2026-02-28', 'A3 crosses into February (2026 is not a leap year)');
  ok(isoDaysBefore(at(2024, 3, 1), 1)  === '2024-02-29', 'A4 🔴 and a LEAP day is a real day — 2024-02-29, not 2024-03-00');
  ok(isoDaysBefore(at(2026, 1, 5), 10) === '2025-12-26', 'A5 crosses a year boundary');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(isoDaysBefore(at(2026, 9, 7), 30)), 'A6 always zero-padded — 2026-9-7 would not compare as a string against a date column');
  ok(isoDaysBefore(at(2026, 10, 3), 3) === '2026-09-30', 'A7 single-digit month pads to 09');

  // 🔴 LOCAL, NOT UTC. At 09:30 local in a western timezone `toISOString()` is still the same
  // day, but late in the evening it is TOMORROW — so this asserts the construction, not the hour.
  const evening = new Date(2026, 8, 1, 23, 45);           // 1 Sep 2026, 23:45 local
  ok(isoDaysBefore(evening, 0) === '2026-09-01',
     'A8 🔴 a late-evening clock still yields TODAY — a UTC-built bound would say 2026-09-02 for every user west of UTC, which is all of them');
}

// ══ §B THE BOUND — A SELECTED DAY REACHES THE QUERY ════════════════════════
{
  const b = deliveryQueryBounds('2025-03-14', at(2026, 9, 1));
  ok(b.kind === 'day', 'B1 🔴 a selected day produces a DAY bound, so the read asks the database for that day rather than filtering whatever the first 200 rows happened to be');
  ok(b.kind === 'day' && b.date === '2025-03-14',
     'B2 🔴 and it is EIGHTEEN MONTHS in the past, unclamped — the calendar can reach March 2025 and the drill-in must not report absence it never established');

  const w = deliveryQueryBounds(null, at(2026, 9, 1));
  ok(w.kind === 'window', 'B3 no selected day produces a WINDOW bound');
  ok(w.kind === 'window' && w.from === '2026-08-02', 'B4 reaching thirty days back from today');
  ok(w.kind === 'window' && w.from <= '2026-08-29',
     'B5 🔴 which INCLUDES Saturday 2026-08-29 — the six real LAWNS stops David has to mark by hand must not fall off the working list');
  ok(deliveryQueryBounds(undefined, at(2026, 9, 1)).kind === 'window', 'B6 undefined behaves as null, not as a day named "undefined"');
  ok(deliveryQueryBounds('', at(2026, 9, 1)).kind === 'window', 'B7 an empty string is not a day');

  ok(w.kind === 'window' && w.pastDays === DELIVERY_LIST_PAST_DAYS,
     'B8 the window reports the reach it used, so the screen can SAY what it is showing rather than implying it holds everything');
  const custom = deliveryQueryBounds(null, at(2026, 9, 1), 7);
  ok(custom.kind === 'window' && custom.from === '2026-08-25' && custom.pastDays === 7,
     'B9 the reach is a parameter, so the boundary is provable at values other than the shipped one');
}

// ══ §C NEGATIVE CONTROL — THE BOUND ACTUALLY CHANGES WITH ITS INPUTS ═══════
{
  // Without this, every assertion above could be reading one constant that happens to match.
  const a = deliveryQueryBounds(null, at(2026, 9, 1));
  const b = deliveryQueryBounds(null, at(2026, 9, 2));
  ok(a.kind === 'window' && b.kind === 'window' && a.from !== b.from,
     'C1 NEGATIVE CONTROL — the window MOVES with the clock; a frozen bound would pass every test above and silently stop including today');
  ok(deliveryQueryBounds('2026-09-05', at(2026, 9, 1)).kind !== deliveryQueryBounds(null, at(2026, 9, 1)).kind,
     'C2 NEGATIVE CONTROL — the two branches genuinely differ, so §B is not asserting one shape twice');
}

console.log(`  deliveryWindow — ${passed} passed, ${failed} failed  (population: 3 sections, ${passed + failed} assertions over 8 clocks and 7 bounds)`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
