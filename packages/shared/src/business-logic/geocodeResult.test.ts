// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the verdict is decided by `location_type` and never by `status` — the defect
//   that would have priced a delivery to a street that does not exist.
// DEPENDENCIES: geocodeResult (pure).
// OUTPUTS: assertions only.
//
// 🔴 EVERY FIXTURE BELOW IS A REAL RESPONSE SHAPE, PROBED LIVE 2026-09-23 against LAWNS's own
// addresses. Not one is invented from Google's documentation, which does not state the behaviour
// these encode. The four-line table in geocodeResult.ts is where they came from.
// ─────────────────────────────────────────────────────────────────────────────
import { classifyGeocodeResponse, verdictMessage } from './geocodeResult';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const res = (location_type: string, partial: boolean, formatted: string, lat = 30.5719542, lng = -97.9188683) =>
  ({ status: 'OK', results: [{ formatted_address: formatted, partial_match: partial,
      geometry: { location: { lat, lng }, location_type } }] });

// ── §A · 🔴 THE MEASURED TABLE, ROW BY ROW ───────────────────────────────────────────────────
{
  const o = classifyGeocodeResponse(res('ROOFTOP', false, '400 Honey Comb Mesa, Leander, TX 78641, USA'));
  ok(o.verdict === 'found', `A1 a real address with ROOFTOP is found (${o.verdict})`);
  ok(o.latitude === 30.5719542 && o.longitude === -97.9188683, 'A2 …and its coordinate comes through');
}
{
  // The street that does not exist. Google answered OK and gave the CENTRE OF LEANDER.
  const o = classifyGeocodeResponse(res('APPROXIMATE', true, 'Leander, TX, USA'));
  ok(o.verdict === 'not_found',
     `🔴 A3 "99999 NONEXISTENT FAKE ROAD" IS NOT FOUND — Google returned status OK with the TOWN CENTROID. Reading status instead of location_type marks it verified, stores a pin in the middle of Leander and PRICES A DELIVERY TO IT, with nothing erroring (${o.verdict})`);
  ok(o.latitude === null && o.longitude === null,
     '🔴 A4 …and NO COORDINATE is carried out of a not_found — a rejected verdict that still hands back a usable pin invites a caller to store it anyway');
}
{
  const o = classifyGeocodeResponse(res('GEOMETRIC_CENTER', false, 'Honey Comb Mesa, Leander, TX 78641, USA'));
  ok(o.verdict === 'not_found', `A5 a street with no house number is the middle of the street, not an address (${o.verdict})`);
  ok(/GEOMETRIC_CENTER/.test(o.reason), 'A6 …and the reason says which precision it got');
}
ok(classifyGeocodeResponse({ status: 'ZERO_RESULTS', results: [] }).verdict === 'not_found', 'A7 ZERO_RESULTS is not found');
{
  const o = classifyGeocodeResponse({ status: 'INVALID_REQUEST', results: [], error_message: "Invalid request. Missing the 'address'…" });
  ok(o.verdict === 'not_found' && /INVALID_REQUEST/.test(o.reason) && /Missing the/.test(o.reason),
     'A8 INVALID_REQUEST carries its error_message through — that one is OUR bug, not a bad address, and the failure list must be able to tell them apart');
}

// ── §B · 🔴 DAVID'S RULING: RANGE_INTERPOLATED IS CONFIRMED, NOT TRUSTED ─────────────────────
{
  const o = classifyGeocodeResponse(res('RANGE_INTERPOLATED', false, '8301 FM 487, Leander, TX, USA'));
  ok(o.verdict === 'confirm',
     `🔴 B1 RANGE_INTERPOLATED REQUIRES A TAP — it is an estimate BETWEEN two known house numbers, and on LAWNS's rural roads that can be far from the gate. David 2026-09-23: "a tap is cheap; a wrong pin sends a truck to the wrong place" (${o.verdict})`);
  ok(o.latitude !== null, 'B2 …but the coordinate is carried, because the person is about to be shown it');
}
{
  // The typo'd street: Google silently corrected "Hunnycom" to "Honey Comb" and found the building.
  const o = classifyGeocodeResponse(res('ROOFTOP', true, '400 Honey Comb Mesa, Leander, TX 78641, USA'));
  ok(o.verdict === 'confirm', `🔴 B3 A PARTIAL MATCH IS CONFIRMED EVEN AT ROOFTOP — Google changed what was typed, and the ruling is that the person chooses (${o.verdict})`);
  ok(o.suggestion === '400 Honey Comb Mesa, Leander, TX 78641, USA', 'B4 …and Google\'s text is carried so it can be SHOWN');
}

// ── §C · what the person is told ─────────────────────────────────────────────────────────────
{
  const typed = '400 Hunnycom Mesa, Leander, TX 78641';
  const o = classifyGeocodeResponse(res('ROOFTOP', true, '400 Honey Comb Mesa, Leander, TX 78641, USA'));
  const m = verdictMessage(o, typed) ?? '';
  ok(m.includes(typed) && m.includes('400 Honey Comb Mesa'),
     '🔴 C1 SUGGEST AND CONFIRM SHOWS BOTH — "you typed X, Google says Y" — so the person chooses rather than being corrected silently (David 2026-09-23)');
}
ok((verdictMessage(classifyGeocodeResponse({ status: 'ZERO_RESULTS' }), 'x') ?? '').includes("can't find this address"),
   'C2 an unplaceable address says so in words, and says the charge cannot be worked out');
ok(verdictMessage(classifyGeocodeResponse(res('ROOFTOP', false, 'anything')), 'anything') === null,
   'C3 the ordinary case is SILENT — a found address does not interrupt a sale');
{
  const m = verdictMessage(classifyGeocodeResponse(res('ROOFTOP', false, 'x')), 'x');
  ok(m === null, 'C4 …and in particular it never says "verified" or "correct"');
  const all = [verdictMessage(classifyGeocodeResponse({ status: 'ZERO_RESULTS' }), 'x'),
               verdictMessage(classifyGeocodeResponse(res('RANGE_INTERPOLATED', false, 'y')), 'x')].join(' ');
  ok(!/verified|correct address|confirmed correct/i.test(all),
     '🔴 C5 NO MESSAGE CLAIMS THE ADDRESS IS CORRECT. This check proves an address can be PLACED, not that it is the right one — 415 typed for 451 is a confident ROOFTOP pin on the neighbour\'s house, and no wording may imply otherwise (David 2026-09-23)');
}

// ── §D · an unreadable answer is never permission to price ───────────────────────────────────
ok(classifyGeocodeResponse(null).verdict === 'not_found', 'D1 no response at all');
ok(classifyGeocodeResponse({}).verdict === 'not_found', 'D2 an object with no status');
ok(classifyGeocodeResponse({ status: 'OK' }).verdict === 'not_found', 'D3 OK with no results array');
ok(classifyGeocodeResponse({ status: 'OK', results: [{ geometry: { location_type: 'ROOFTOP' } }] }).verdict === 'not_found',
   '🔴 D4 ROOFTOP WITH NO COORDINATE IS NOT FOUND — the one thing a "found" verdict promises is a usable pin');
ok(classifyGeocodeResponse({ status: 'OK', results: [{ geometry: { location: { lat: 'x', lng: 2 }, location_type: 'ROOFTOP' } }] }).verdict === 'not_found',
   'D5 …and a non-numeric coordinate is no coordinate');

// ── §E · 🔴 NEGATIVE CONTROL — the classifier must not be reading `status` ───────────────────
{
  const okStatusBadPlace = classifyGeocodeResponse(res('APPROXIMATE', true, 'Leander, TX, USA'));
  const okStatusGoodPlace = classifyGeocodeResponse(res('ROOFTOP', false, '400 Honey Comb Mesa'));
  ok(okStatusBadPlace.verdict === 'not_found' && okStatusGoodPlace.verdict === 'found',
     '🔴 E1 TWO RESPONSES WITH IDENTICAL `status: OK` GET OPPOSITE VERDICTS. If this function were reading status — the obvious implementation — both would be `found` and every assertion above would still pass except this one');
}

console.log(`\ngeocodeResult — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
