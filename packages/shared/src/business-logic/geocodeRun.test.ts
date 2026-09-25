// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the bulk run cannot double-bill, cannot decide a question meant for a person,
//   and cannot turn our outage into a customer's permanently unpriced address.
// DEPENDENCIES: geocodeRun (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { planGeocodeRun, applyOneResult, runSummary, EMPTY_RUN, BATCH, googlePayloadOrThrow } from './geocodeRun';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };
const NOW = new Date('2026-09-25T00:00:00Z');
const goog = (location_type: string, partial = false) =>
  ({ status: 'OK', results: [{ formatted_address: 'x', partial_match: partial,
      geometry: { location: { lat: 30.57, lng: -97.91 }, location_type } }] });

// ── §A · what one result writes ──────────────────────────────────────────────────────────────
{
  const r = applyOneResult(goog('ROOFTOP'), NOW);
  ok(r.patch?.geocode_status === 'found' && r.patch.latitude === 30.57, 'A1 a ROOFTOP address is located and stored');
  ok(!r.review, 'A2 …and needs nobody to look at it');
}
{
  const r = applyOneResult(goog('RANGE_INTERPOLATED'), NOW);
  ok(r.patch === null,
     "🔴 A3 AN INTERPOLATED ADDRESS IS NOT DECIDED BY THE BATCH — nothing is written. A bulk run has NOBODY TO ASK, and storing Google's guess would be the machine answering a question designed for a person. David: a tap is cheap, a wrong pin sends a truck to the wrong place");
  ok(r.review, 'A4 …it goes on Lauren\'s list instead');
}
{
  const r = applyOneResult(goog('ROOFTOP', true), NOW);
  ok(r.patch === null && r.review, 'A5 a CORRECTED address is a question too, however confident the pin');
}
{
  const r = applyOneResult({ status: 'ZERO_RESULTS' }, NOW);
  ok(r.patch?.geocode_status === 'not_found' && r.patch.latitude === null, 'A6 an unplaceable address records that, with no coordinate');
  ok(typeof r.patch?.geocoded_at === 'string' && r.patch.geocoded_at.length > 0,
     '🔴 A7 …AND IS DATED, or the 30-day clock cannot start and it is re-checked on every run for ever');
  ok(!r.review, 'A8 it is not a question — it is an answer, and the answer is "we cannot place it"');
}

// ── §B · 🔴 OUR OUTAGE IS NOT THE CUSTOMER'S PROBLEM ────────────────────────────────────────
{
  const r = applyOneResult(null, NOW, false);
  ok(r.patch === null,
     "🔴 B1 A ROW WE COULD NOT REACH KEEPS ITS NULL — nothing is written. Writing not_found on a network failure would turn OUR outage into an address that can never be priced, and nobody would ever know why. It is simply retried");
  ok(!r.review, 'B2 …and it is not a question for Lauren either — there is nothing for her to decide');
}

// ── §C · resumable, and therefore never billed twice ────────────────────────────────────────
{
  const p = planGeocodeRun({ ...EMPTY_RUN, remaining: 1499 }, false);
  ok(p.more && p.take === BATCH, `C1 it works in small batches (${BATCH}), so stopping costs at most one batch`);
  ok(/1499 addresses left/.test(p.message), 'C2 …and says how much is left');
}
ok(planGeocodeRun({ ...EMPTY_RUN, remaining: 0 }, false).more === false,
   '🔴 C3 NOTHING LEFT MEANS NOTHING ASKED. The work remaining is counted from rows with NO verdict, so a second press re-spends nothing — the database is the progress, not a cursor file that can go stale');
{
  const p = planGeocodeRun({ ...EMPTY_RUN, remaining: 900 }, true);
  ok(!p.more && /Nothing is lost/.test(p.message),
     'C4 stopping is safe and says so — every row already answered stays answered');
}
ok(planGeocodeRun({ ...EMPTY_RUN, remaining: 7 }, false).take === 7, 'C5 the last batch is short, not padded');

// ── §D · what the owner reads ────────────────────────────────────────────────────────────────
ok(runSummary({ ...EMPTY_RUN, located: 1200, needALook: 40, cannotPlace: 259 }) === '1200 located · 299 need a look',
   "🔴 D1 DAVID'S SENTENCE, AND 'need a look' COUNTS BOTH the ones a person must confirm AND the ones that cannot be placed — both are work for a human and neither can be priced. Splitting them in the headline invites reading the smaller number as the whole problem");
ok(/could not be reached/.test(runSummary({ ...EMPTY_RUN, located: 10, unreachable: 3 })),
   'D2 unreachable rows are named separately, because they are not a result — they are a retry');
ok(!/could not be reached/.test(runSummary({ ...EMPTY_RUN, located: 10 })),
   'D3 …and are silent when there are none, rather than a permanent "0 could not be reached"');

// ── §E · negative control ────────────────────────────────────────────────────────────────────
{
  const found = applyOneResult(goog('ROOFTOP'), NOW);
  const confirm = applyOneResult(goog('RANGE_INTERPOLATED'), NOW);
  ok(found.patch !== null && confirm.patch === null,
     '🔴 E1 NEGATIVE CONTROL: two responses identical but for location_type are written differently. An implementation keying on `status: OK` — which BOTH carry — would store them the same way, which is the single measurement this whole build rests on');
}

// ── §F · 🔴 A FAILED REQUEST IS NOT AN EMPTY ANSWER (§6 r24) — THE LIVE DEFECT ──────────────
// David found this at the counter on 2026-09-25: "We can't find this address" for 770 County
// Road 284, Liberty Hill — which Google finds instantly. The cause was not Google.
{
  let threw = false;
  try { googlePayloadOrThrow({ ok: false, status: 503 }, { error: 'geocoding is not configured on this deployment' }); }
  catch { threw = true; }
  ok(threw,
     '🔴 F1 THE EXACT PRODUCTION 503 THROWS. Measured live: the proxy returns HTTP 503 because the Google key is missing from Vercel. The old code read the body anyway and the classifier returned not_found — our misconfiguration, told to Lauren as her customer having a bad address');
}
{
  // The proof that the old path was wrong, kept as a probe so it cannot come back.
  const asVerdict = applyOneResult({ error: 'geocoding is not configured on this deployment' }, new Date());
  ok(asVerdict.patch?.geocode_status === 'not_found',
     "🔴 F2 …AND THIS IS WHY IT MATTERS: fed straight to the classifier, that same 503 body IS a 'not_found' verdict — dated, stored, and reused for thirty days. The throw is the only thing standing between a missing env var and 1,499 addresses marked unplaceable");
}
{
  let threw = false;
  try { googlePayloadOrThrow({ ok: true, status: 200 }, { nothing: true }); } catch { threw = true; }
  ok(threw, 'F3 a 200 carrying no Google payload throws too — the same lie with a friendlier status code');
}
{
  const payload = googlePayloadOrThrow({ ok: true, status: 200 }, { google: { status: 'ZERO_RESULTS' } });
  ok((payload as any).status === 'ZERO_RESULTS',
     '🔴 F4 NEGATIVE CONTROL — A REAL "WE LOOKED AND FOUND NOTHING" PASSES THROUGH UNTOUCHED. ZERO_RESULTS is Google answering, and it must still reach the classifier as a genuine cannot-place. A guard that threw on this would have swapped one lie for another');
  ok(applyOneResult(payload, new Date()).patch?.geocode_status === 'not_found',
     'F5 …and it still lands as not_found, which is correct: that address really cannot be placed');
}

console.log(`\ngeocodeRun — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
