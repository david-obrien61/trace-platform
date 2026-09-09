/**
 * ── routeHandoff — what the driver receives is what the manager saw ──────────────────────────
 *
 * 🔴 §D IS THE ONE THAT MATTERS, AND IT IS THE ONLY SECTION THAT COULD HAVE CAUGHT THE SHIPPED
 *   DEFECT. §A-§C test a pure function that was never wrong. The bug lived in the WIRING: the URL
 *   was stored in state and built in `buildRoute()` from the entered order, while the screen read
 *   `routeSummary.orderedStops`. A perfect `buildRouteHandoff` wired to the wrong array ships the
 *   identical bug — so §D reads `DeliveryRoute.tsx` itself and asserts that the handoff is derived
 *   from `displayStops` and that `routeUrl` is not state again. (§6 r19: a check that cannot
 *   disagree is not a check; tech-debt #182: a probe that cannot REACH its target reports the same
 *   as one that passed.)
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/routeHandoff.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { buildRouteHandoff, buildMapsUrl, driverSmsBody, type HandoffStop } from './routeHandoff';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const stop = (label: string, address: string): HandoffStop => ({ label, address });
const FARM = '400 Honeycomb Mesa, Leander TX 78641';

/** Decode a maps URL back into the addresses it carries, in URL order. */
function addressesInUrl(url: string): string[] {
  const path = url.replace('https://www.google.com/maps/dir/', '').replace(/\/$/, '');
  return path.split('/').map(decodeURIComponent);
}

// ══ §A THE URL CARRIES THE ORDER IT WAS GIVEN, BOOKENDED AT THE FARM ══════════
{
  const a = stop('Alvarez', '1 Oak St, Leander TX');
  const b = stop('Bell',    '2 Elm St, Cedar Park TX');
  const c = stop('Cruz',    '3 Ash St, Georgetown TX');

  const h = buildRouteHandoff([a, b, c], FARM);
  ok(h.url !== null, 'A1 three drivable stops produce a URL');
  ok(addressesInUrl(h.url!).length === 5, 'A2 round-trip: farm + 3 stops + farm = 5 path segments');
  ok(addressesInUrl(h.url!)[0] === FARM, 'A3 the route starts at the farm');
  ok(addressesInUrl(h.url!)[4] === FARM, 'A4 …and returns to it');

  // 🔴 THE CORE ASSERTION. Google preserves the order it is handed — there is no `optimize`
  // parameter — so the sequence in the URL IS the sequence driven.
  ok(addressesInUrl(h.url!).slice(1, 4).join('|') === [a.address, b.address, c.address].join('|'),
     'A5 🔴 the stops appear in the URL in the ARRAY order given — this is the whole contract');

  // The same three stops in a DIFFERENT array order must produce a DIFFERENT URL. If they did
  // not, deriving from the optimised array would change nothing and this build would be theatre.
  const reordered = buildRouteHandoff([c, a, b], FARM);
  ok(reordered.url !== h.url,
     'A6 🔴 a different stop ORDER yields a different URL — the optimised array actually reaches the driver');
  ok(addressesInUrl(reordered.url!).slice(1, 4).join('|') === [c.address, a.address, b.address].join('|'),
     'A7 …and it is the new order, not a re-sort of its own');

  ok(h.url!.includes(encodeURIComponent('1 Oak St, Leander TX')),
     'A8 addresses are percent-encoded — a comma or space must not split a path segment');
  ok(!h.url!.includes(' '), 'A9 no raw space survives into the URL');

  const oneWay = buildRouteHandoff([a, b], FARM, 'one_way');
  ok(addressesInUrl(oneWay.url!).length === 3 && addressesInUrl(oneWay.url!)[0] === FARM,
     'A10 one_way starts at the farm and does NOT return — the endpoint mode is a real parameter');
}

// ══ §B NO ANCHOR, NO STOPS, BLANK ADDRESSES — THE HONEST EDGES ════════════════
{
  const a = stop('Alvarez', '1 Oak St, Leander TX');
  const b = stop('Bell',    '2 Elm St, Cedar Park TX');

  const noAnchor = buildRouteHandoff([a, b], '');
  ok(addressesInUrl(noAnchor.url!).length === 2,
     'B1 no business address → no bookends, just the stops (the pre-existing degradation, preserved)');

  ok(buildRouteHandoff([], FARM).url === null, 'B2 no stops → no URL, not a URL of the farm twice');
  ok(buildRouteHandoff([], FARM).stopCount === 0, 'B3 …and no stop count');
  ok(buildRouteHandoff([stop('Nobody', '')], FARM).url === null,
     'B4 🔴 a stop with a BLANK address is not drivable — a route of zero real stops is no route');
  ok(buildRouteHandoff([stop('Nobody', '   ')], FARM).url === null,
     'B5 …whitespace is blank too');
  ok(buildRouteHandoff([a], '   ').addresses.length === 1,
     'B6 a whitespace-only business address is not an anchor');
}

// ══ §C THE COUNT IS THE STOPS IN THE LINK — THE SECOND HALF OF THE DEFECT ═════
{
  const withAddr  = stop('Alvarez', '1 Oak St, Leander TX');
  const withAddr2 = stop('Bell',    '2 Elm St, Cedar Park TX');
  const blank1    = stop('Cruz',    '');
  const blank2    = stop('Diaz',    '');

  // The live shape: five selected orders, two with no address. The old SMS said "(5 stops)".
  const h = buildRouteHandoff([withAddr, blank1, withAddr2, blank2, stop('Eng', '5 Fir St, Liberty Hill TX')], FARM);
  ok(h.stopCount === 3,
     'C1 🔴 five stops selected, two blank → the count is THREE, the number actually in the link');
  ok(addressesInUrl(h.url!).length === 5, 'C2 …and the URL carries 3 stops plus 2 farm bookends');
  ok(h.stopCount === h.addresses.filter(a => a !== FARM).length,
     'C3 🔴 the count is derived from the SAME array as the URL — it cannot drift');

  const body = driverSmsBody(h);
  ok(body !== null, 'C4 a real route produces a text');
  ok(body!.includes('(3 stops)'),
     'C5 🔴 the TEXT says 3 — this is the exact line that read "(5 stops)" above a three-stop link');
  ok(body!.includes(h.url!), 'C6 the text carries the same URL the button opens');
  ok(!body!.includes('(5 stops)'), 'C7 negative control — the selection count appears nowhere');

  const one = buildRouteHandoff([withAddr], FARM);
  ok(driverSmsBody(one)!.includes('(1 stop)') && !driverSmsBody(one)!.includes('(1 stops)'),
     'C8 singular reads "1 stop", not "1 stops"');

  ok(driverSmsBody(buildRouteHandoff([], FARM)) === null,
     'C9 🔴 no route → no text at all, rather than a message promising a link that is not there');

  ok(buildMapsUrl(['a', 'b']) === 'https://www.google.com/maps/dir/a/b/',
     'C10 the URL shape itself is the documented directions path form');
}

// ══ §D 🔴 THE WIRING — THE ONLY SECTION THAT COULD HAVE CAUGHT THE REAL BUG ═══
// A pure function is not the defect. Being wired to the wrong array is. These probes read the
// page source, so restoring the shipped defect in the .tsx turns them red.
{
  const SRC = 'packages/cultivar-os/src/pages/DeliveryRoute.tsx';
  const src = readFileSync(SRC, 'utf8');
  // Comments carry the words we assert on ("displayStops", "routeUrl"), so a comment could satisfy
  // a naive grep. Strip them first — #182: a probe must reach the code, not the prose about it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  ok(code.includes('buildRouteHandoff(displayStops'),
     'D1 🔴 the handoff is derived from `displayStops` — the array the numbered list renders');
  ok(!/setRouteUrl/.test(code),
     'D2 🔴 `setRouteUrl` is GONE — the URL is not state, so it cannot be frozen before the optimiser runs');
  ok(!/useState<string \| null>\(null\)[\s\S]{0,40}routeUrl/.test(code) && !/\[routeUrl, /.test(code),
     'D3 🔴 …and `routeUrl` is not re-declared as a state pair');
  ok(/const routeUrl = handoff\.url/.test(code),
     'D4 the link reads the derived handoff, nothing else');

  // The URL must NOT be built inside buildRoute(): that is the exact instant the optimised order
  // does not exist yet. Slice the function body and assert the absence there specifically.
  const bodyStart = code.indexOf('function buildRoute()');
  const bodyEnd   = code.indexOf('function clearRoute()');
  ok(bodyStart > 0 && bodyEnd > bodyStart, 'D5 buildRoute() and clearRoute() both located in source');
  const buildBody = code.slice(bodyStart, bodyEnd);
  ok(!buildBody.includes('buildMapsUrl') && !buildBody.includes('buildRouteHandoff'),
     'D6 🔴 buildRoute() builds NO url — it publishes the stop model and nothing else');
  ok(buildBody.includes('setRouteStops') && buildBody.includes('setRouteSummary(null)'),
     'D7 …it still publishes the model and clears the stale optimisation');

  // The three outbound surfaces must all read the one derivation.
  const textStart = code.indexOf('function textDriver()');
  const textBody  = code.slice(textStart, code.indexOf('}', code.indexOf('window.open', textStart)));
  ok(textStart > 0 && textBody.includes('driverSmsBody(handoff)'),
     'D8 🔴 the SMS body comes from the shared derivation');
  ok(!textBody.includes('selectedOrders.length'),
     'D9 🔴 the SMS count is NOT the selection count — the defect that texted "(5 stops)" for 3');
  ok(!/const count = /.test(textBody),
     'D10 …and the text computes no count of its own at all');

  ok(code.includes('navigator.clipboard.writeText(routeUrl)'),
     'D11 Copy writes the derived URL, the same one the link opens');

  // The stale seam comment (R-26): it told fourteen months of readers that optimisation was not
  // wired here, which is why nobody looked at the URL when it was.
  ok(!src.includes('stop-order OPTIMIZATION (reorder stops for shortest path) — deferred'),
     'D12 🔴 the stale "optimization — deferred" comment is deleted — it was false from 420e0bc onward');

  // The screen's own source of truth is unchanged: the list still renders displayStops.
  ok(code.includes('displayStops.map('),
     'D13 the numbered list still renders displayStops — link and list read one array');
  ok(code.includes('const displayStops = routeSummary?.orderedStops ?? routeStops'),
     'D14 …and displayStops is still optimised-when-available, built-order otherwise');

  // A route is "built" from the stop model, not from a URL string.
  ok(code.includes('const routeBuilt = routeStops.length > 0'),
     'D15 the build gate reads the stop model, not a stored URL');
  ok((code.match(/clearRoute\(\)/g) || []).length >= 3,
     'D16 all three reset sites (selection · address typed · Rebuild) call the one clearRoute helper');

  // NEGATIVE CONTROL on the harness itself: prove this section is actually reading the file and
  // could go red. A string that must NOT be present, and one that must.
  ok(code.length > 5000, 'D17 negative control — the source was really read (non-trivial length)');
  ok(!code.includes('__handoff_probe_never_present__'),
     'D18 negative control — an absent-string assertion is capable of being true');
}

console.log(`\nrouteHandoff: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
