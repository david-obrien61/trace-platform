/**
 * ── routeOrder — what every surface says about the day's plan (ledger #351) ──────────────────
 *
 * The save itself is proven end to end in scripts/path-tests/crew-day.paths.mts (route.save and
 * two guards). This file holds the two pure decisions the screens make on their own.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/routeOrder.test.ts --bundle --platform=node --format=cjs | node
 */
import { routeOrderLine, dayRoutedAt } from './routeOrder';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// §A THE LINE
ok(routeOrderLine(null) === 'Not routed yet — follow the order in Lauren’s text.', 'A1 an unplanned day says so, in the words on main');
ok(routeOrderLine(undefined) === routeOrderLine(null), 'A2 undefined reads as unplanned, never as a plan');
ok(routeOrderLine('') === routeOrderLine(null), 'A3 an empty stamp is not a plan');
ok(/^route order · planned \d{1,2}:\d{2}\s?(AM|PM)$/.test(routeOrderLine('2026-09-19T12:12:00Z')), `A4 a planned day names the time — "${routeOrderLine('2026-09-19T12:12:00Z')}"`);
ok(routeOrderLine(null) !== routeOrderLine('2026-09-19T12:12:00Z'), 'A5 NEGATIVE CONTROL — the two sentences differ');

// §B WHEN WAS THE DAY PLANNED
ok(dayRoutedAt([]) === null, 'B1 no stops, no plan');
ok(dayRoutedAt([{ route_position: null, routed_at: null }, { }]) === null, 'B2 stops outside the plan are no plan');
ok(dayRoutedAt([{ route_position: 1, routed_at: '2026-09-19T12:00:00Z' }, { route_position: 2, routed_at: '2026-09-19T12:00:00Z' }]) === '2026-09-19T12:00:00Z', 'B3 a planned day reports its stamp');
ok(dayRoutedAt([{ route_position: null, routed_at: '2026-09-19T13:00:00Z' }, { route_position: 1, routed_at: '2026-09-19T12:00:00Z' }]) === '2026-09-19T12:00:00Z',
   '🔴 B4 a stamp on a stop OUTSIDE the plan is ignored — a dropped stop must not make an old plan look newer');
ok(dayRoutedAt([{ route_position: 1, routed_at: '2026-09-19T12:00:00Z' }, { route_position: 2, routed_at: '2026-09-19T12:40:00Z' }]) === '2026-09-19T12:40:00Z', 'B5 the latest stamp wins');

console.log(`  routeOrder — ${passed} passed, ${failed} failed  (population: 2 sections, ${passed + failed} assertions)`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
