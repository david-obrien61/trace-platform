/**
 * ── dashboardWindows — the boundaries, and what the banner is allowed to say ──
 *
 * Written from two live defects on the same screen:
 *   · "Installs this week" filtered `gte(weekStart)` with NO end bound, so a September planting
 *     counted as done this week — and it counted ORDERS, so it could not see the OCR door at all.
 *   · The add-on banner had two states and needed four: with zero sales it rendered a green check
 *     reading "Every large-container sale included an add-on" over an empty set.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/dashboardWindows.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { ymd, dayWindow, weekWindow, addOnBannerState } from './dashboardWindows';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
/** Local-time construction — the whole point is that these are calendar dates, not UTC instants. */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

// ══ §A THE WEEK HAS A FAR EDGE ══════════════════════════════════════════════
{
  const w = weekWindow(at(2026, 8, 27));           // a Thursday
  ok(w.startDate === '2026-08-23', 'week starts Sunday 08-23');
  ok(w.endDate === '2026-08-30', 'THE END BOUND EXISTS — 08-30, the next Sunday');
  ok(w.startDate < '2026-08-26' && '2026-08-26' < w.endDate, "Lauren Frazier's 08-26 planting is inside");
  ok(w.startDate < '2026-08-29' && '2026-08-29' < w.endDate, "Saturday's 08-29 plantings are inside");
  ok(!('2026-09-12' < w.endDate),
    "🔴 THE DEFECT: Josh Phelps's 09-12 planting is OUTSIDE. Under the old unbounded query it counted as an install done THIS week");
}
{
  const w = weekWindow(at(2026, 8, 23));           // on the Sunday itself
  ok(w.startDate === '2026-08-23', 'on Sunday the week starts today, not seven days ago');
  ok(w.endDate === '2026-08-30', 'and still ends the following Sunday');
}
{
  const a = weekWindow(at(2026, 8, 29, 23));       // Saturday night
  const b = weekWindow(at(2026, 8, 30, 1));        // Sunday small hours
  ok(a.endDate === b.startDate,
    'HALF-OPEN, SO NO DOUBLE COUNT AND NO GAP: one week ends exactly where the next begins, and a delivery dated 08-30 belongs to exactly one of them');
}
{
  const w = weekWindow(at(2026, 12, 31));          // year boundary
  ok(w.startDate === '2026-12-27' && w.endDate === '2027-01-03', 'the week spans the year end without breaking');
}
{
  const w = weekWindow(at(2026, 3, 8));            // US DST spring-forward Sunday
  ok(w.startDate === '2026-03-08' && w.endDate === '2026-03-15',
    'a 23-hour day does not shorten the week — the dates are calendar dates, not 7×24h of milliseconds');
}

// ══ §B TODAY ════════════════════════════════════════════════════════════════
{
  const d = dayWindow(at(2026, 8, 27));
  ok(d.startDate === '2026-08-27' && d.endDate === '2026-08-28', 'today is half-open [today, tomorrow)');
  ok(!('2026-08-26' >= d.startDate),
    "🔴 THE RED-TEAM HIT: Paul Christ's sale is dated 08-26 and must NOT count as today's revenue. Six invoices backfilled in one afternoon reported $14,370.21 as today's sales before this fix");
  ok(ymd(at(2026, 8, 27, 23)) === '2026-08-27',
    'a late-evening sale stays on its own local date — toISOString() would have rolled it into tomorrow');
  ok(ymd(at(2026, 1, 5)) === '2026-01-05', 'single-digit month and day are zero-padded (string comparison depends on it)');
}

// ══ §C THE BANNER MAY NOT CLAIM MORE THAN IT MEASURED ═══════════════════════
{
  const s = (o: any) => addOnBannerState({ readFailed: false, salesInWindow: 0, assessableSales: 0, leakingSales: 0, ...o });
  ok(s({}) === 'no-sales',
    '🔴 THE OLD DEFECT: zero sales used to render "Every large-container sale included an add-on" — a universal positive over an EMPTY SET. It now says there is nothing to report');
  ok(s({ salesInWindow: 4, assessableSales: 0 }) === 'none-assessable',
    '🔴 THE NEW ONE THIS BUILD WOULD HAVE CREATED: four real captured sales, none of them assessable, must NOT read as four clean ones');
  ok(s({ salesInWindow: 4, assessableSales: 4, leakingSales: 2 }) === 'leaking', 'a genuine miss still raises the alert');
  ok(s({ salesInWindow: 4, assessableSales: 4, leakingSales: 0 }) === 'clean', 'and a genuinely clean week still gets its green check');
  ok(s({ salesInWindow: 6, assessableSales: 2, leakingSales: 0 }) === 'clean',
    'a MIXED week is clean on what was checked — the copy is then obliged to name how many were not');
  ok(s({ readFailed: true, salesInWindow: 4, assessableSales: 4, leakingSales: 0 }) === 'error',
    'a FAILED READ outranks everything: it must never fall through to the green branch');
  ok(s({ readFailed: true }) === 'error',
    'and a failed read that also happens to have counted zero is still an error, not "no sales" — EMPTY IS NOT ERROR');
  ok(s({ salesInWindow: 4, assessableSales: 4, leakingSales: 4 }) === 'leaking', 'all-leaking is still just leaking');
}
{
  // Every state is reachable — a branch nothing can select is a branch nobody maintains.
  const reached = new Set([
    addOnBannerState({ readFailed: true, salesInWindow: 0, assessableSales: 0, leakingSales: 0 }),
    addOnBannerState({ readFailed: false, salesInWindow: 0, assessableSales: 0, leakingSales: 0 }),
    addOnBannerState({ readFailed: false, salesInWindow: 3, assessableSales: 0, leakingSales: 0 }),
    addOnBannerState({ readFailed: false, salesInWindow: 3, assessableSales: 3, leakingSales: 1 }),
    addOnBannerState({ readFailed: false, salesInWindow: 3, assessableSales: 3, leakingSales: 0 }),
  ]);
  ok(reached.size === 5, 'all five states are reachable');
}

console.log(`\n  dashboardWindows: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
