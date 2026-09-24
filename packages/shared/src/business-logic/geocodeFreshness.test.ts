// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the 30-day rule holds at its boundaries — it is a COMPLIANCE limit (Google ToS
//   §6.3.1), so "roughly a month" is not good enough, and the interesting cases are all edges.
// DEPENDENCIES: geocodeFreshness (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { coordinateState, needsRefresh, isUsable, forgetCoordinatePatch, CACHE_DAYS } from './geocodeFreshness';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const NOW = new Date('2026-09-22T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
const at = (iso: string | null) => ({ latitude: 30.5788, longitude: -97.8531, geocoded_at: iso });

// ── §A · the ordinary lifetime ───────────────────────────────────────────────────────────────
ok(coordinateState(at(daysAgo(0)), NOW) === 'fresh', 'A1 fetched just now — fresh');
ok(coordinateState(at(daysAgo(29)), NOW) === 'fresh', 'A2 29 days old — still fresh');
ok(coordinateState(at(daysAgo(31)), NOW) === 'expired', 'A3 31 days old — expired');
ok(CACHE_DAYS === 30, 'A4 the limit is 30 days, from Google ToS §6.3.1');

// ── §B · 🔴 THE BOUNDARY ITSELF, WHICH IS THE WHOLE POINT OF A COMPLIANCE LIMIT ──────────────
ok(coordinateState(at(daysAgo(30)), NOW) === 'expired',
   '🔴 B1 EXACTLY 30 DAYS OLD IS EXPIRED, NOT FRESH — the terms permit storage FOR 30 days, so day 30 is the first day we may no longer rely on it. An off-by-one here is a compliance breach that no screen would ever show');
{
  const justUnder = new Date(NOW.getTime() - (30 * 24 * 60 * 60 * 1000 - 1000)).toISOString();
  ok(coordinateState(at(justUnder), NOW) === 'fresh', 'B2 one second under thirty days — still fresh');
}

// ── §C · 🔴 AN UNKNOWN AGE IS NOT A FRESH ONE ────────────────────────────────────────────────
ok(coordinateState({ latitude: 30.5, longitude: -97.8, geocoded_at: null }, NOW) === 'expired',
   '🔴 C1 A COORDINATE WITH NO TIMESTAMP IS EXPIRED — if we cannot say WHEN we obtained it, we cannot say we are inside the 30 days. Treating unknown as fresh is how a cache rule quietly becomes optional');
ok(coordinateState({ latitude: 30.5, longitude: -97.8, geocoded_at: 'not a date' }, NOW) === 'expired',
   'C2 …and an unparseable timestamp is treated the same way');
{
  const future = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  ok(coordinateState(at(future), NOW) === 'expired',
     '🔴 C3 A TIMESTAMP IN THE FUTURE IS EXPIRED — it means a clock disagreed somewhere, and trusting it would hold the coordinate past 30 REAL days');
}

// ── §D · absent is not expired — they lead to different behaviour ────────────────────────────
ok(coordinateState({ latitude: null, longitude: null, geocoded_at: daysAgo(1) }, NOW) === 'absent',
   'D1 no coordinate at all is `absent`, not `expired` — there is nothing to refresh, only something to look up');
ok(coordinateState({ latitude: 30.5, longitude: null, geocoded_at: daysAgo(1) }, NOW) === 'absent',
   '🔴 D2 HALF A COORDINATE IS ABSENT — a latitude with no longitude locates nothing, and the database CHECK refuses to store it, so the reader must agree');
ok(coordinateState({}, NOW) === 'absent', 'D3 an empty row is absent');
ok(coordinateState({ latitude: Number.NaN, longitude: -97.8, geocoded_at: daysAgo(1) }, NOW) === 'absent',
   'D4 NaN is not a latitude');

// ── §E · the two helpers say the same thing as the state ─────────────────────────────────────
ok(isUsable(at(daysAgo(1)), NOW) && !needsRefresh(at(daysAgo(1)), NOW), 'E1 fresh is usable and needs no refresh');
ok(!isUsable(at(daysAgo(40)), NOW) && needsRefresh(at(daysAgo(40)), NOW), 'E2 expired is not usable and needs a refresh');
ok(!isUsable({}, NOW) && needsRefresh({}, NOW),
   '🔴 E3 ABSENT IS ALSO "NOT USABLE" — the one thing a caller must never do is read a coordinate that is not there, and `isUsable` is the single question that answers it for all three states');

// ── §F · forgetting keeps the fact that the address was unfindable ───────────────────────────
{
  const patch = forgetCoordinatePatch() as Record<string, unknown>;
  ok(patch.latitude === null && patch.longitude === null && patch.geocoded_at === null,
     'F1 forgetting clears the coordinate and its clock');
  ok(!('geocode_status' in patch),
     '🔴 F2 FORGETTING DOES NOT CLEAR `geocode_status` — whether the address was ever findable is a fact about the ADDRESS, not about the coordinate\'s age. Clearing it would make a known-bad address look merely un-geocoded, and checkout would go back to pricing a delivery to a place nobody can find');
}

// ── §G · negative control — the function must actually read `now` ────────────────────────────
{
  const LATER = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000);
  const row = at(daysAgo(1));
  ok(coordinateState(row, NOW) === 'fresh' && coordinateState(row, LATER) === 'expired',
     '🔴 G1 NEGATIVE CONTROL: the SAME row is fresh now and expired two months later. If this function ignored `now` — or read the clock itself — both would agree and every assertion above would pass for the wrong reason');
}

console.log(`\ngeocodeFreshness — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
