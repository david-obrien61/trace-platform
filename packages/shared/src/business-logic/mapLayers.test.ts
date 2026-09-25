// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the Map page's arithmetic — above all that "near the route" measures to the
//   LINE and not to the stops, and that an unplaceable customer is never reported as a far one.
// DEPENDENCIES: mapLayers (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import {
  purchaseCutoff, WINDOW_PRESETS, distanceToPathMiles, customersNearPath,
  summariseCustomers, dotPasses, type MapCustomer, type DotFilter,
} from './mapLayers';
import { distanceMiles } from './deliveryRings';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

// ── §A · the date window ────────────────────────────────────────────────────────────────────
const NOW = new Date('2026-08-31T12:00:00Z');
{
  const six = purchaseCutoff('6m', NOW);
  ok(six !== null && six.getUTCMonth() === 1 && six.getUTCDate() === 28,
     `🔴 A1 SIX MONTHS BEFORE 31 AUGUST IS 28 FEBRUARY. A bare setMonth() gives 3 MARCH — JavaScript rolls 31 February forward — so the window would be SHORTER than the button says and would silently drop everyone who bought on 1–3 March. Found by this assertion, not by review (got ${six?.toISOString().slice(0, 10)})`);
  const jan31 = purchaseCutoff('1m' as never, new Date('2026-03-31T00:00:00Z'));
  ok(jan31 === null, 'A1b …and a preset nobody defined has no cutoff, rather than a guessed one');
  const feb = purchaseCutoff('12m', new Date('2028-02-29T00:00:00Z'));
  ok(feb !== null && feb.getUTCDate() === 28 && feb.getUTCMonth() === 1,
     `🔴 A1c A LEAP DAY A YEAR BACK IS 28 FEBRUARY, not 1 March (got ${feb?.toISOString().slice(0, 10)})`);
}
{
  const three = purchaseCutoff('3m', NOW);
  const twelve = purchaseCutoff('12m', NOW);
  const two = purchaseCutoff('24m', NOW);
  ok(three! > twelve! && twelve! > two!, 'A2 a shorter window has a later cutoff — the four presets are ordered');
  ok(two!.getUTCFullYear() === 2024, `A3 two years back from 2026 is 2024 (got ${two?.getUTCFullYear()})`);
}
{
  ok(purchaseCutoff('all', NOW) === null && purchaseCutoff('custom', NOW) === null,
     'A4 "all time" and a custom range have NO preset cutoff — null is the absence of a bound, never a very old date');
}
{
  ok(WINDOW_PRESETS.length === 6 && WINDOW_PRESETS[0].value === '3m' && WINDOW_PRESETS[3].value === '24m',
     'A5 the presets are the ones David named, in his order');
}
{
  // NEGATIVE CONTROL — the cutoff must depend on NOW, not be a constant.
  const a = purchaseCutoff('6m', new Date('2026-08-31T12:00:00Z'));
  const b = purchaseCutoff('6m', new Date('2025-08-31T12:00:00Z'));
  ok(a! > b!, '🔴 A6 NEGATIVE CONTROL: the same preset a year apart gives different cutoffs. A hardcoded date would pass A1 by accident');
}

// ── §B · distance to the driven line ────────────────────────────────────────────────────────
// A route running due east along latitude 30.5, from Leander towards Hutto.
const WEST = { latitude: 30.5, longitude: -97.9 };
const EAST = { latitude: 30.5, longitude: -97.5 };
const PATH = [WEST, EAST];
{
  const on = distanceToPathMiles({ latitude: 30.5, longitude: -97.7 }, PATH);
  ok(on !== null && on < 0.01, `B1 a point ON the line is zero miles from it (got ${on?.toFixed(4)})`);
}
{
  // Due north of the MIDDLE of the line — nowhere near either end.
  const p = { latitude: 30.55, longitude: -97.7 };
  const d = distanceToPathMiles(p, PATH);
  const toWestEnd = distanceMiles(p, WEST);
  const toEastEnd = distanceMiles(p, EAST);
  ok(d !== null && d > 3.3 && d < 3.6,
     `B2 0.05° of latitude is about 3.45 miles, measured square to the line (got ${d?.toFixed(2)})`);
  ok(d! < toWestEnd! && d! < toEastEnd!,
     '🔴 B3 IT MEASURES TO THE LINE, NOT TO THE STOPS — this point is 3.4 miles from the road and ~12 from either end of it. Measuring to the nearest STOP would answer a different and far less useful question, and would hide every customer the truck drives straight past');
}
{
  // 🔴 THE CLAMP. A point far off the EAST end, in line with the road.
  const beyond = { latitude: 30.5, longitude: -97.0 };
  const d = distanceToPathMiles(beyond, PATH);
  const toEnd = distanceMiles(beyond, EAST);
  ok(d !== null && Math.abs(d - toEnd!) < 0.05,
     `🔴 B4 PAST THE END OF THE ROUTE, THE DISTANCE IS TO THE END — not to the infinite line. Unclamped, this customer would read as ZERO miles from the route because they sit where the road WOULD go if it carried on (got ${d?.toFixed(2)} vs ${toEnd?.toFixed(2)} to the end)`);
}
{
  ok(distanceToPathMiles(WEST, []) === null, 'B5 no route, no distance — never 0');
  const one = distanceToPathMiles({ latitude: 30.55, longitude: -97.9 }, [WEST]);
  ok(one !== null && one > 3.3 && one < 3.6, 'B6 a one-stop route is a point, and measures as one');
  const degenerate = distanceToPathMiles({ latitude: 30.55, longitude: -97.9 }, [WEST, WEST]);
  ok(degenerate !== null && degenerate > 3.3 && degenerate < 3.6,
     'B7 a zero-length segment (the same stop twice — real routes contain these) does not divide by zero');
}
{
  // The projection is an approximation; this bounds it against the exact great-circle distance
  // for a point square to a short segment, which is the case the corridor filter actually uses.
  const p = { latitude: 30.53, longitude: -97.7 };
  const approx = distanceToPathMiles(p, PATH)!;
  const exact = distanceMiles(p, { latitude: 30.5, longitude: -97.7 })!;
  ok(Math.abs(approx - exact) < 0.02,
     `🔴 B8 THE FLAT-PLANE APPROXIMATION IS WITHIN 0.02 MILES OF THE EXACT ANSWER at this scale — the claim the header makes, measured rather than asserted (${approx.toFixed(4)} vs ${exact.toFixed(4)})`);
}

// ── §C · who is near the route ──────────────────────────────────────────────────────────────
const cust = (id: string, lat: number | null, lng: number | null): MapCustomer =>
  ({ id, name: id, latitude: lat, longitude: lng });
{
  const r = customersNearPath([
    cust('near', 30.51, -97.7),      // ~0.7 mi off the line
    cust('far', 30.9, -97.7),        // ~27 mi off
    cust('nowhere', null, null),
  ], PATH, 2);
  ok(r.rows.length === 1 && r.rows[0].customer.id === 'near', 'C1 only the customer inside the corridor is returned');
  ok(r.outside === 1, 'C2 …the far one is counted as outside');
  ok(r.unlocated === 1,
     '🔴 C3 AN UNPLACEABLE CUSTOMER IS NOT A FAR ONE. "Nobody lives near this route" and "we do not know where this customer is" are opposite conclusions, and dropping the row makes them look identical');
  ok(/can't be placed yet/.test(r.message), 'C4 …and the sentence says so, rather than a footnote');
}
{
  const r = customersNearPath([
    cust('a', 30.515, -97.7), cust('b', 30.505, -97.6), cust('c', 30.51, -97.65),
  ], PATH, 5);
  const miles = r.rows.map(x => x.miles);
  ok(miles.every((m, i) => i === 0 || m >= miles[i - 1]),
     'C5 nearest first — the order a person would work the list in');
}
{
  // 🔴 NEGATIVE CONTROL — the corridor WIDTH must matter.
  const people = [cust('a', 30.53, -97.7)];   // ~2.1 miles off the line
  const tight = customersNearPath(people, PATH, 1);
  const wide  = customersNearPath(people, PATH, 5);
  ok(tight.rows.length === 0 && wide.rows.length === 1,
     '🔴 C6 NEGATIVE CONTROL: the same customer and the same route, differing only in X, fall on opposite sides. An implementation that returned everyone located would pass C1 by accident');
}
{
  const r = customersNearPath([cust('a', 30.51, -97.7)], [], 2);
  ok(r.rows.length === 0 && /No route drawn yet/.test(r.message),
     'C7 with no route the answer is "pick a date and a crew", never an empty list that reads as "nobody"');
}

// ── §D · the three statuses ─────────────────────────────────────────────────────────────────
const ord = (customer_id: string, o: Partial<{ sale_date: string; created_at: string; status: string; transport_method: string; order_kind: string }> = {}) =>
  ({ customer_id, ...o });
const del = (customer_id: string, o: Partial<{ status: string; completed_at: string; service_type: string }> = {}) =>
  ({ customer_id, ...o });
{
  const m = summariseCustomers([ord('c1', { created_at: '2026-05-01' })], []);
  const s = m.get('c1')!;
  ok(s.bought && !s.delivered && !s.planted, 'D1 an order alone is "bought" and nothing more');
  ok(s.lastPurchase === '2026-05-01' && s.orderCount === 1, 'D2 …with its date and count');
}
{
  // 🔴 sale_date WINS. Without it every imported invoice dates to the day of the import, and two
  // years of LAWNS's history lands on one afternoon in September.
  const m = summariseCustomers([ord('c1', { sale_date: '2024-03-14', created_at: '2026-09-20' })], []);
  ok(m.get('c1')!.lastPurchase === '2024-03-14',
     `🔴 D3 THE INVOICE'S OWN DATE BEATS THE ROW'S CREATION DATE — otherwise every historical order imported from QuickBooks appears to have happened on import day (got ${m.get('c1')!.lastPurchase})`);
}
{
  const m = summariseCustomers([
    ord('c1', { created_at: '2026-05-01', status: 'cancelled' }),
    ord('c2', { created_at: '2026-05-01', order_kind: 'test' }),
    ord('c3', { created_at: '2026-05-01' }),
  ], []);
  ok(!m.has('c1'), '🔴 D4 A CANCELLED ORDER IS NOT A PURCHASE — a dot for it is a customer who did not buy');
  ok(!m.has('c2'), 'D5 a test order is not a customer at all');
  ok(m.has('c3'), 'D6 …and a real one still is (the negative control for D4/D5)');
}
{
  const done = summariseCustomers([ord('c1', { created_at: '2026-05-01' })], [del('c1', { status: 'fulfilled' })]);
  const open = summariseCustomers([ord('c2', { created_at: '2026-05-01' })], [del('c2', { status: 'scheduled' })]);
  ok(done.get('c1')!.delivered, 'D7 a fulfilled delivery is "delivered"');
  ok(!open.get('c2')!.delivered, 'D8 …a scheduled one is not — a stop nobody has driven is not a delivery');
  const stamped = summariseCustomers([ord('c3', { created_at: '2026-05-01' })], [del('c3', { completed_at: '2026-05-02T10:00:00Z' })]);
  ok(stamped.get('c3')!.delivered, 'D9 a completion stamp counts even when the status column never moved (measured: "scheduled" was the only value ever written on some tenants)');
}
{
  // 🔴 PLANTED IS INFERRED AND IT IS ANDed WITH COMPLETION.
  const soldNotDone = summariseCustomers([ord('c1', { created_at: '2026-05-01', transport_method: 'install' })],
                                         [del('c1', { status: 'scheduled' })]);
  const soldAndDone = summariseCustomers([ord('c2', { created_at: '2026-05-01', transport_method: 'install' })],
                                         [del('c2', { status: 'fulfilled' })]);
  ok(!soldNotDone.get('c1')!.planted,
     '🔴 D10 AN INSTALL SOLD AND NOT YET DONE IS NOT PLANTED. `transport_method = install` is an INTENT — a customer waiting for a crew, not a customer whose trees are in the ground');
  ok(soldAndDone.get('c2')!.planted, 'D11 …sold AND completed is planted');
  const byService = summariseCustomers([ord('c3', { created_at: '2026-05-01' })],
                                       [del('c3', { status: 'fulfilled', service_type: 'planting' })]);
  ok(byService.get('c3')!.planted, 'D12 a completed stop whose service_type is planting is planted, whatever the order said');
}
{
  // NEGATIVE CONTROL — planting must not follow from delivery alone.
  const plain = summariseCustomers([ord('c1', { created_at: '2026-05-01' })], [del('c1', { status: 'fulfilled' })]);
  ok(plain.get('c1')!.delivered && !plain.get('c1')!.planted,
     '🔴 D13 NEGATIVE CONTROL: a plain completed delivery is delivered and NOT planted. An implementation equating the two would pass D11 and D12 by accident, and would tell Lauren she planted trees she dropped at the kerb');
}

// ── §E · the filter ─────────────────────────────────────────────────────────────────────────
const NOW_E = new Date('2026-09-25T12:00:00Z');
const all: DotFilter = { window: 'all', statuses: [] };
{
  const twice = summariseCustomers([
    ord('c1', { created_at: '2026-03-01' }), ord('c1', { created_at: '2026-09-20' }),
  ], []).get('c1')!;
  ok(dotPasses(twice, { window: '3m', statuses: [] }, NOW_E), 'E1 a purchase inside 3 months shows');
  const older = summariseCustomers([ord('c2', { created_at: '2026-03-01' })], []).get('c2')!;
  ok(!dotPasses(older, { window: '3m', statuses: [] }, NOW_E), 'E2 …a purchase outside it does not');
  ok(dotPasses(older, { window: '12m', statuses: [] }, NOW_E), 'E3 …and widening the window brings it back');
}
{
  // ✏️ E4 CORRECTED — MY FIRST VERSION OF THIS ASSERTION COULD NOT FAIL, AND A MUTANT PROVED IT.
  // It claimed "any purchase, not the last one" and used a customer who bought in March AND last
  // week. But for a TRAILING window the two readings are **identical by construction**: if any
  // purchase is inside the last N months, the NEWEST one is too. Planting a mutant that read only
  // `lastPurchase` left all 46 assertions green. The distinction is real but it lives ONLY in a
  // range with an UPPER bound — see E4b, which is where the mutant dies.
  const both = summariseCustomers([
    ord('c1', { created_at: '2026-03-01' }), ord('c1', { created_at: '2026-09-20' }),
  ], []).get('c1')!;
  ok(dotPasses(both, { window: '12m', statuses: [] }, NOW_E) && dotPasses(both, { window: '3m', statuses: [] }, NOW_E),
     'E4 a customer who bought in March and again last week is on both the 3-month and the 12-month map');
}
{
  // 🔴 E4b THE CASE THAT ACTUALLY DISTINGUISHES THEM, and the reason `purchases` is an array.
  const then = summariseCustomers([
    ord('c1', { created_at: '2025-06-15' }),   // inside the range asked for
    ord('c1', { created_at: '2026-09-20' }),   // …and a later one, outside it
  ], []).get('c1')!;
  ok(dotPasses(then, { window: 'custom', from: '2025-01-01', to: '2025-12-31', statuses: [] }, NOW_E),
     '🔴 E4b "WHO BOUGHT DURING 2025" MUST INCLUDE SOMEBODY WHO ALSO BOUGHT IN 2026. Reading only the newest purchase answers a different question and silently empties every historical range — which is the whole point of offering from–to at all');
}
{
  const s = summariseCustomers([ord('c1', { created_at: '2025-06-15' })], []).get('c1')!;
  ok(dotPasses(s, { window: 'custom', from: '2025-01-01', to: '2025-12-31', statuses: [] }, NOW_E), 'E5 a from–to range admits a purchase inside it');
  ok(!dotPasses(s, { window: 'custom', from: '2026-01-01', to: null, statuses: [] }, NOW_E), 'E6 …and excludes one before the start');
  ok(dotPasses(s, { window: 'custom', from: null, to: null, statuses: [] }, NOW_E), 'E7 an empty range hides nobody — a control nobody has set must not filter');
}
{
  const bought = summariseCustomers([ord('c1', { created_at: '2026-09-20' })], []).get('c1')!;
  const planted = summariseCustomers([ord('c2', { created_at: '2026-09-20', transport_method: 'install' })],
                                     [del('c2', { status: 'fulfilled' })]).get('c2')!;
  ok(dotPasses(bought, { ...all, statuses: ['bought'] }, NOW_E) && !dotPasses(bought, { ...all, statuses: ['planted'] }, NOW_E),
     'E8 the status boxes select');
  // ✏️ E9's FIRST VERSION USED A CUSTOMER WHO WAS BOTH, so `every` and `some` agreed and the
  // AND-mutant survived. The case that separates them is a customer who is one and not the other.
  const deliveredOnly = summariseCustomers([ord('c9', { created_at: '2026-09-20' })],
                                           [del('c9', { status: 'fulfilled' })]).get('c9')!;
  ok(dotPasses(planted, { ...all, statuses: ['delivered', 'planted'] }, NOW_E)
     && dotPasses(deliveredOnly, { ...all, statuses: ['delivered', 'planted'] }, NOW_E),
     '🔴 E9 TWO BOXES MEAN EITHER, NOT BOTH — a customer who was DELIVERED and not planted still shows when both are ticked. Every planted customer is also delivered, so AND-ing them would make "planted" the only thing either box could ever mean, and a person ticking a second box on a map is widening what they can see');
  ok(dotPasses(bought, { ...all, statuses: [] }, NOW_E), 'E10 no box ticked hides nobody');
}

console.log(`\nmapLayers — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
