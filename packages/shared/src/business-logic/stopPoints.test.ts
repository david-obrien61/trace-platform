// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove a stop is placed from its own customer's matching address — and above all that
//   a customer with several sites is REFUSED rather than given one of their other pins.
// DEPENDENCIES: stopPoints (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { resolveStopPoints, type AddressLike } from './stopPoints';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const addr = (customerId: string, line1: string, lat: number, lng: number): AddressLike =>
  ({ customerId, line1, latitude: lat, longitude: lng });
const stop = (id: string, customer_id: string | null, address_line1: string | null) =>
  ({ id, customer_id, address_line1 });

{
  const r = resolveStopPoints([stop('s1', 'c1', '153 Twin Creekview Ln')],
                              [addr('c1', '153 Twin Creekview Ln', 30.65, -97.72)]);
  ok(r.placed.length === 1 && r.placed[0].basis === 'street-match', 'A1 the matching street places the stop');
  ok(r.placed[0].point.latitude === 30.65, 'A2 …with that address\'s coordinate');
}
{
  // Case, punctuation and spacing are not a difference — the shared normaliser decides.
  const r = resolveStopPoints([stop('s1', 'c1', '153 TWIN CREEKVIEW LN.')],
                              [addr('c1', '153 Twin Creekview Ln', 30.65, -97.72)]);
  ok(r.placed.length === 1, 'A3 case and punctuation are not a mismatch');
}
{
  const r = resolveStopPoints([stop('s1', 'c1', '999 Somewhere Else')],
                              [addr('c1', '153 Twin Creekview Ln', 30.65, -97.72)]);
  ok(r.placed.length === 1 && r.placed[0].basis === 'only-address',
     'A4 one located address and no street match still places it — and SAYS which basis it used');
}
{
  // 🔴 THE ONE THAT MATTERS. Dave's Tree Service, three job sites, a stop matching none of them.
  const r = resolveStopPoints([stop('s1', 'c1', '77 Brand New Rd')], [
    addr('c1', '1 Leander St', 30.57, -97.91),
    addr('c1', '2 Georgetown Way', 30.65, -97.72),
  ]);
  ok(r.placed.length === 0 && r.unplaceable.length === 1,
     '🔴 A5 SEVERAL SITES AND NONE MATCHES IS REFUSED, NOT GUESSED. Handing a contractor\'s Leander pin to a Dripping Springs stop produces a day plan that is wrong and looks perfectly reasonable — the worst shape of wrong there is');
  // `?.` deliberately: with A5's defect planted, `unplaceable[0]` is undefined and a bare index
  // CRASHED the whole file with a TypeError — caught, but reported as a stack trace instead of a
  // named failing assertion. A test that can only fail by exploding tells you less than one that
  // fails by name.
  ok(/2 located addresses/.test(r.unplaceable[0]?.why ?? ''), 'A6 …and the reason says how many it had to choose between');
}
{
  const r = resolveStopPoints([stop('s1', 'c1', '1 A St'), stop('s2', null, '2 B St')], [addr('c1', '1 A St', 30.5, -97.9)]);
  ok(r.placed.length === 1 && r.unplaceable.length === 1 && /no customer/.test(r.unplaceable[0].why),
     'A7 a stop with no customer is named, not dropped');
}
{
  const r = resolveStopPoints([stop('s1', 'c9', '1 A St')], [addr('c1', '1 A St', 30.5, -97.9)]);
  ok(r.placed.length === 0 && /hasn't been located yet/.test(r.unplaceable[0].why),
     "🔴 A8 ANOTHER CUSTOMER'S ADDRESS AT THE SAME STREET DOES NOT COUNT. Matching on text alone across customers would place a stop on a stranger's house that happens to share an address line");
}
{
  // 🔴 A8b THE CASE A8 COULD NOT REACH, AND A MUTANT FOUND IT. A8 uses a customer with NO
  // addresses, so the function returns before the street match ever runs — a mutant that matched
  // across EVERY customer survived it untouched. This customer HAS an address of their own, and a
  // DIFFERENT customer has one whose street line is identical.
  const r = resolveStopPoints([stop('s1', 'c1', '500 Shared Name Dr')], [
    addr('c1', '1 Their Own St', 30.50, -97.90),
    addr('c2', '500 Shared Name Dr', 31.99, -96.00),
  ]);
  ok(r.placed.length === 1 && r.placed[0].point.latitude === 30.50,
     `🔴 A8b A STREET LINE MATCHING ANOTHER CUSTOMER'S ADDRESS IS NOT A MATCH. "500 Shared Name Dr" exists in two customers' books; matching on text across the whole business would put this stop on a stranger's house 100 miles away (got ${r.placed[0]?.point.latitude})`);
}
{
  // NEGATIVE CONTROL — placement must depend on the ADDRESS DATA, not merely on having a stop.
  const withData = resolveStopPoints([stop('s1', 'c1', '1 A St')], [addr('c1', '1 A St', 30.5, -97.9)]);
  const without  = resolveStopPoints([stop('s1', 'c1', '1 A St')], []);
  ok(withData.placed.length === 1 && without.placed.length === 0,
     '🔴 A9 NEGATIVE CONTROL: the same stop with and without a located address resolves differently. An implementation that invented a coordinate would pass A1 by accident');
}

console.log(`\nstopPoints — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
