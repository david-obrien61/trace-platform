// Probes for navTiming (ledger #378). The property that matters is ONCE PER NAVIGATION: a list
// re-renders constantly, and a timer that logs on every render reports how long ago the move was,
// not how long it took.
import { markNavigation, reportScreenReady, lastNavigation, __resetNavTiming, NAV_TIMING_TAG } from './navTiming';
let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); } };
const sink = () => { const lines: Array<[string, unknown]> = []; return { lines, log: (m: string, d: unknown) => lines.push([m, d]) }; };

{ __resetNavTiming();
  ok(reportScreenReady('customers', {}, sink().log) === null,
     'A1 with no navigation marked, nothing is reported — a number with no move is meaningless'); }

{ __resetNavTiming(); markNavigation('/customers/abc'); markNavigation('/customers');
  const s = sink();
  const ms = reportScreenReady('customers', { rows: 2005 }, s.log);
  ok(typeof ms === 'number' && ms >= 0, `A2 a marked navigation reports a number (got ${ms})`);
  ok(s.lines.length === 1, 'A3 exactly one line is logged');
  ok(s.lines[0][0].startsWith(NAV_TIMING_TAG), 'A4 tagged so it can be grepped');
  ok(s.lines[0][0].includes('/customers/abc → /customers'),
     'A5 🔴 it names the MOVE, not just the destination — profile → list is the thing being measured');
  ok((s.lines[0][1] as any).rows === 2005, 'A6 the row count rides along — 200ms and 2000ms differ by what was rendered'); }

{ __resetNavTiming(); markNavigation('/customers');
  const s = sink();
  reportScreenReady('customers', {}, s.log);
  const second = reportScreenReady('customers', {}, s.log);
  ok(second === null && s.lines.length === 1,
     '🔴 A7 THE LOAD-BEARING ONE: a second report for one navigation is IGNORED. A filter or an '
     + 'inline edit re-renders the grid; without this it would log a number measured from a move '
     + 'that finished minutes ago, and the number would look like a regression'); }

{ __resetNavTiming(); markNavigation('/a'); reportScreenReady('x', {}, sink().log);
  markNavigation('/b');
  const s = sink();
  ok(reportScreenReady('x', {}, s.log) !== null && s.lines.length === 1,
     'A8 but the NEXT navigation reports again — the flag is per-move, not once ever'); }

{ __resetNavTiming(); markNavigation('/customers', '/dashboard');
  ok(lastNavigation()?.from === '/dashboard' && lastNavigation()?.to === '/customers',
     'A9 the move is readable without reporting it'); }

{ __resetNavTiming();
  ok(lastNavigation() === null, 'A10 and it is null before anything is marked — no invented move'); }

console.log(`\n  navTiming — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
