// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the ONE step behaves — above all that a homeowner with a good saved address is
//   asked NOTHING, which is the regression Lauren would hate (David, 2026-09-24).
// DEPENDENCIES: addressStep (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { planAddressStep, applyGeocodeToStep, orderChoices, addressLine, mayPrice } from './addressStep';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const NOW = new Date('2026-09-24T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const saved = (over: Record<string, unknown> = {}) => ({
  id: 'a1', line1: '400 Honey Comb Mesa', city: 'Leander', state: 'TX', zip: '78641',
  kind: 'both', latitude: 30.5719542, longitude: -97.9188683,
  geocoded_at: daysAgo(3), geocode_status: 'found', ...over,
});
const goog = (location_type: string, partial: boolean, formatted: string) =>
  ({ status: 'OK', results: [{ formatted_address: formatted, partial_match: partial,
      geometry: { location: { lat: 30.5719542, lng: -97.9188683 }, location_type } }] });

// ── §A · 🔴 THE REGRESSION LAUREN WOULD HATE ────────────────────────────────────────────────
{
  const p = planAddressStep(saved(), NOW);
  ok(p.geocode === false,
     '🔴 A1 A GOOD SAVED ADDRESS IS NOT GEOCODED AT ALL — no request, no latency, and nothing that could produce a question. Checking freshness BEFORE fetching is what makes the ordinary case silent');
  ok(p.question.ask === 'none',
     '🔴 A2 …AND NOTHING IS ASKED. A homeowner whose address is already known sees no extra step — David 2026-09-24, and the thing to protect');
}
ok(planAddressStep(saved({ geocoded_at: daysAgo(29) }), NOW).question.ask === 'none', 'A3 29 days old — still silent');
{
  const p = planAddressStep(saved({ geocoded_at: daysAgo(31) }), NOW);
  ok(p.geocode === true && p.question.ask === 'none',
     'A4 past 30 days it is re-checked — but silently: expiry is our bookkeeping, not the customer\'s problem');
}
ok(planAddressStep(saved({ geocode_status: null, latitude: null, longitude: null, geocoded_at: null }), NOW).geocode === true,
   'A5 a never-geocoded address is checked');

// ── §B · never two questions for one address ─────────────────────────────────────────────────
{
  const p = planAddressStep(saved({ geocode_status: 'not_found', latitude: null, longitude: null, geocoded_at: null }), NOW);
  ok(p.geocode === false && p.question.ask === 'cannot-place',
     '🔴 B1 AN ADDRESS ALREADY KNOWN TO BE UNPLACEABLE IS NOT RE-ASKED OF GOOGLE — the same text gets the same answer, and re-asking the PERSON is exactly the second question this step exists to prevent');
}
{
  // Every path returns at most one question — the shape makes two impossible.
  const outs = [
    applyGeocodeToStep(goog('ROOFTOP', false, 'x'), 'x').question.ask,
    applyGeocodeToStep(goog('RANGE_INTERPOLATED', false, 'x'), 'x').question.ask,
    applyGeocodeToStep(goog('APPROXIMATE', true, 'Leander, TX'), 'x').question.ask,
    applyGeocodeToStep({ status: 'ZERO_RESULTS' }, 'x').question.ask,
  ];
  ok(outs.every(a => ['none', 'confirm', 'cannot-place'].includes(a)) && outs.length === 4,
     'B2 every outcome yields exactly one question kind — there is no shape in which two are returned');
}

// ── §C · suggest and confirm — and what is STORED ────────────────────────────────────────────
{
  const typed = '400 Hunnycom Mesa, Leander, TX 78641';
  const r = applyGeocodeToStep(goog('ROOFTOP', true, '400 Honey Comb Mesa, Leander, TX 78641, USA'), typed);
  ok(r.question.ask === 'confirm', 'C1 a correction asks once');
  ok(r.question.ask === 'confirm' && r.question.mine === typed && r.question.google.includes('Honey Comb'),
     'C2 …showing BOTH — what she has and what Google has — so she chooses');
  ok(r.store === null,
     "🔴 C3 NOTHING IS STORED WHILE A CONFIRM IS PENDING — not even the coordinate. Storing Google's answer here would silently accept a correction the person is in the middle of being asked about, which is David's ruling 2 inverted");
}
{
  const r = applyGeocodeToStep(goog('ROOFTOP', false, '400 Honey Comb Mesa'), '400 Honey Comb Mesa');
  ok(r.question.ask === 'none' && r.store !== null && (r.store as Record<string, unknown>).geocode_status === 'found',
     'C4 a clean ROOFTOP stores the coordinate and says nothing');
  const s = r.store as Record<string, unknown>;
  ok(!('formatted_address' in s) && !('line1' in s) && !('city' in s),
     "🔴 C5 WHAT IS STORED CONTAINS NO ADDRESS TEXT AT ALL — only the coordinate and the clock. Google's wording never reaches the database unless a person picked it");
}
{
  const r = applyGeocodeToStep({ status: 'ZERO_RESULTS' }, 'qqqq');
  ok(r.question.ask === 'cannot-place' && (r.store as Record<string, unknown>)?.geocode_status === 'not_found',
     'C6 an unplaceable address records THAT — so the next visit does not ask again (B1)');
  ok(r.question.ask === 'cannot-place' && /can't find this address/.test(r.question.message),
     'C7 …and says so in words');
}

// ── §D · the bill-to is first and unlabelled (David 2026-09-09) ──────────────────────────────
{
  const list = [
    { id: 's', line1: '1 Site Rd', kind: 'shipping' },
    { id: 'b', line1: '2 Bill St', kind: 'billing' },
    { id: 'x', line1: '3 Both Ave', kind: 'both' },
  ];
  const o = orderChoices(list);
  ok(o[0].kind === 'billing' || o[0].kind === 'both', 'D1 a bill-to address is offered first');
  ok(o[o.length - 1].kind === 'shipping', 'D2 delivery-only sites come after it');
  ok(o.length === list.length, '🔴 D3 NOTHING IS HIDDEN OR FLAGGED — for most homeowners the billing address IS where the trees go; only TEN LAWNS customers have a genuinely different delivery street, so labelling a billing-only address as suspect would flag most customers\' ONLY address');
}

// ── §E · pricing follows the same fact, not a second one ────────────────────────────────────
ok(mayPrice(saved(), NOW) === true, 'E1 a found, fresh address may be priced');
ok(mayPrice(saved({ geocode_status: 'not_found', latitude: null, longitude: null, geocoded_at: null }), NOW) === false,
   '🔴 E2 AN UNPLACEABLE ADDRESS IS NEVER PRICED — 2026-09-18: surfaced, never priced, never guessed, no silent fallback');
ok(mayPrice(saved({ geocoded_at: daysAgo(40) }), NOW) === false,
   'E3 an expired coordinate may not be priced until it is re-checked — the 30-day clock is a permission, not a hint');
ok(mayPrice(null, NOW) === false, 'E4 no address, no price');

// ── §F · negative control — the silent path must depend on the DATA ─────────────────────────
{
  const good = planAddressStep(saved(), NOW);
  const stale = planAddressStep(saved({ geocoded_at: daysAgo(90) }), NOW);
  ok(good.geocode === false && stale.geocode === true,
     '🔴 F1 NEGATIVE CONTROL: the SAME address, differing only in when it was geocoded, gets opposite plans. If this function ignored the stored coordinate — the obvious "just always geocode" implementation — A1/A2 would pass for the wrong reason and every checkout would hit Google');
}
ok(addressLine({ line1: '400 Honey Comb Mesa', city: 'Leander', state: 'TX', zip: '78641' }) === '400 Honey Comb Mesa, Leander, TX, 78641',
   'F2 the address reads as one line, the way a person says it');

console.log(`\naddressStep — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
