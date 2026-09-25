// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the ONE step behaves — above all that a homeowner with a good saved address is
//   asked NOTHING, which is the regression Lauren would hate (David, 2026-09-24).
// DEPENDENCIES: addressStep (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { planAddressStep, applyGeocodeToStep, orderChoices, addressLine, mayPrice, resolveAddressCheck } from './addressStep';

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
  // ✏️ THIS FIXTURE GAINED A DATE (2026-09-24, ruling 1). It used to carry `geocoded_at: null`,
  // because nothing wrote the answer back and an undated row was the only kind there was. Now
  // every verdict is dated when it is recorded, and the date is what stops the re-ask.
  const p = planAddressStep(saved({ geocode_status: 'not_found', latitude: null, longitude: null, geocoded_at: daysAgo(3) }), NOW);
  ok(p.geocode === false && p.question.ask === 'cannot-place',
     '🔴 B1 AN ADDRESS ALREADY KNOWN TO BE UNPLACEABLE IS NOT RE-ASKED OF GOOGLE — the same text gets the same answer, and re-asking the PERSON is exactly the second question this step exists to prevent');
}
{
  const legacy = planAddressStep(saved({ geocode_status: 'not_found', latitude: null, longitude: null, geocoded_at: null }), NOW);
  ok(legacy.geocode === true,
     "🔴 B1b AN UNDATED VERDICT IS RE-CHECKED, AND THIS IS A DELIBERATE CHANGE. If we cannot say WHEN we learned an address was unplaceable, we cannot claim to be inside the 30-day window — the same rule that makes an undated COORDINATE expired. It also rescues the rows the first version wrote without a date");
  const old = planAddressStep(saved({ geocode_status: 'not_found', latitude: null, longitude: null, geocoded_at: daysAgo(400) }), NOW);
  ok(old.geocode === true,
     '🔴 B1c AND UNPLACEABLE IS NOT A LIFE SENTENCE — after 30 days we look again. 35% of Liberty Hill is new enough that the maps have not caught up, and those streets DO get built. An address refused forever on a January answer is wrong by construction in Lauren\'s own town');
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

// ── §G · RULING 1 — THE RESULT IS WRITTEN BACK, SO NOBODY IS ASKED TWICE ────────────────────
// David, 2026-09-24. Before this, the check ran and its answer was thrown away: a customer with a
// nonsense address was asked about it on EVERY visit, because nothing recorded that they had
// already been asked.
{
  const before = applyGeocodeToStep(goog('ROOFTOP', true, '400 Honey Comb Mesa, Leander, TX 78641, USA'), '400 Hunnycom Mesa');
  ok(before.store === null,
     '🔴 G1 STILL NOTHING IS STORED WHILE THE QUESTION IS PENDING — §C3 is unchanged. The write happens AFTER the answer, which is what makes ruling 1 and ruling 2 agree rather than collide');
  const kept = resolveAddressCheck(before.outcome, 'mine', NOW);
  ok(kept.geocode_status === 'confirm',
     'G2 she kept HER version → the row records that the question was asked and answered');
  ok(kept.latitude === null && kept.longitude === null,
     "🔴 G3 …AND TAKES NO COORDINATE. Google's pin belongs to GOOGLE'S text; attaching it to the street she kept is exactly how a truck arrives at the house next door");
  const took = resolveAddressCheck(before.outcome, 'google', NOW);
  ok(took.geocode_status === 'found' && typeof took.latitude === 'number',
     "G4 she took Google's version → it is verified, and the coordinate comes with it");
  ok(took.latitude !== kept.latitude,
     '🔴 G5 NEGATIVE CONTROL: the two answers to the SAME question produce different rows. An implementation that ignored the choice would pass G2 and G4 by accident');
}
{
  // The whole point, end to end: asked once, never asked again.
  const answered = resolveAddressCheck(
    applyGeocodeToStep(goog('RANGE_INTERPOLATED', false, '1 Odd St'), '1 Odd St').outcome, 'mine', NOW);
  const next = planAddressStep(saved({ geocode_status: answered.geocode_status, geocoded_at: answered.geocoded_at,
                                       latitude: null, longitude: null }), NOW);
  ok(next.geocode === false && next.question.ask === 'none',
     '🔴 G6 THE NEXT VISIT ASKS NOTHING — the answer is on the record, so the customer standing at the counter is not re-litigating an address they settled last month');
  ok(mayPrice(saved({ geocode_status: 'confirm', latitude: null, longitude: null, geocoded_at: daysAgo(1) }), NOW) === false,
     '🔴 G7 …BUT IT IS STILL NOT PRICED. "Asked and answered" is not "verified": nothing confirmed where this is, so a delivery to it is never priced from a guess');
}
{
  const nf = resolveAddressCheck(applyGeocodeToStep({ status: 'ZERO_RESULTS' }, 'qqqq').outcome, 'mine', NOW);
  ok(nf.geocode_status === 'not_found' && nf.latitude === null,
     'G8 an unplaceable address records that, with no coordinate');
  ok(typeof nf.geocoded_at === 'string' && nf.geocoded_at.length > 0,
     '🔴 G9 …AND IS DATED. Without the date the 30-day clock cannot start, so it would be re-checked on every single visit — the cost this ruling exists to stop');
  ok(planAddressStep(saved({ geocode_status: 'not_found', latitude: null, longitude: null, geocoded_at: nf.geocoded_at }), NOW).geocode === false,
     'G10 and the next visit does not call Google about it again');
}
{
  const stale = planAddressStep(saved({ geocode_status: 'confirm', geocoded_at: daysAgo(31), latitude: null, longitude: null }), NOW);
  ok(stale.geocode === true,
     '🔴 G11 AN ANSWER EXPIRES LIKE ANY OTHER — past thirty days it is re-checked (Google ToS §6.3.1). A permanent "asked once" would outlive the street being built');
}

console.log(`\naddressStep — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
