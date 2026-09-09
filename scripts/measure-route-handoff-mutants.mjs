/**
 * ── measure-route-handoff-mutants — can the driver be sent a different route again? ───────────
 *
 * PURPOSE:      The defect David and Lauren reported on 2026-09-08 was INVISIBLE from every screen
 *               in the building. The optimiser worked, the pins were right, the on-card list was
 *               right, the miles-and-minutes summary was right — and the link that left the
 *               building carried the stops in the order they were rung up. Nothing rendered wrong;
 *               nothing threw. The only way to see it was to open the artefact the driver receives,
 *               which the person who could spot the error never did. So every mutant below produces
 *               a route page that works perfectly and quietly hands over the wrong sequence.
 *
 * 🔴 S1 IS THE ONE THAT MATTERS: it restores the shipped defect exactly — the handoff derived from
 *               the built order instead of the array on screen. If S1 ever survives, this build has
 *               been undone and nobody would be able to tell from the app.
 *
 * 🔴 THE PROBES WERE WRITTEN ALONGSIDE THE CODE, SO THEIR FIRST GREEN RUN PROVED NOTHING (§6 r19).
 *               This is where they are made to refuse. §A–§C mutate the pure derivation; §S mutates
 *               the WIRING in the page, which is where the real bug lived and where a perfect pure
 *               function is no defence at all.
 *
 * ⚠️ S8 EXISTS TO PROVE THE PROBES REACH THE PAGE, NOT ONLY THE LIB (tech-debt #182 — "a harness
 *               that cannot reach its target reports the same as one that passed"). §A–§C would
 *               stay green through every single S-mutant if §D did not read the .tsx.
 *
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-route-handoff-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const LIB  = 'packages/cultivar-os/src/lib/routeHandoff.ts';
const PAGE = 'packages/cultivar-os/src/pages/DeliveryRoute.tsx';
const SUITE = 'packages/cultivar-os/src/lib/routeHandoff.test.ts';

function suiteIsGreen(suite) {
  try {
    execSync(`set -o pipefail; "${ESB}" "${suite}" --bundle --platform=node --format=cjs --log-level=error --external:node:fs | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ══ the derivation — order, bookends, encoding ════════════════════════════════════════
  { id: 'A1', target: LIB,
    why: '🔴 the stops are sorted alphabetically before the URL is built — a tidy-looking route that is nobody\'s optimisation, and the screen still shows the real one',
    from: '  const stopAddresses = stops\n    .map(s => s.address.trim())\n    .filter(a => a.length > 0);',
    to:   '  const stopAddresses = stops\n    .map(s => s.address.trim())\n    .filter(a => a.length > 0)\n    .sort();' },
  { id: 'A2', target: LIB,
    why: 'the route no longer returns to the farm — the driver finishes at the last customer and the day\'s mileage is wrong for everyone reading the summary',
    from: "    if (endpointMode === 'round_trip') addresses.push(anchor); // …and return to it",
    to:   '    // return leg dropped' },
  { id: 'A3', target: LIB,
    why: 'the route never starts at the farm — Google picks its own origin, usually the driver\'s current location, so the first leg is invented',
    from: '    addresses.unshift(anchor);                                // start at the farm',
    to:   '    // no anchor' },
  { id: 'A4', target: LIB,
    why: '🔴 addresses stop being percent-encoded — a comma in "1 Oak St, Leander TX" splits into two path segments and Google silently routes to a place nobody chose',
    from: '  const stops = addresses.map(a => encodeURIComponent(a)).join(\'/\');',
    to:   "  const stops = addresses.join('/');" },
  { id: 'A5', target: LIB,
    why: 'the endpoint mode is ignored and every route is a round trip — the declared seam becomes a weld, silently',
    from: "  const anchor = origin.trim();",
    to:   "  const anchor = origin.trim(); endpointMode = 'round_trip';" },

  // ══ the count — the second half of the same defect ════════════════════════════════════
  { id: 'B1', target: LIB,
    why: '🔴 THE COUNT DEFECT, RESTORED — the count returns every stop handed in, including the ones with no address, so the text promises stops the link does not contain',
    from: '    stopCount: stopAddresses.length,',
    to:   '    stopCount: stops.length,' },
  { id: 'B2', target: LIB,
    why: 'a stop with a blank address is treated as drivable — an empty path segment in the URL, and a count that over-promises',
    from: '    .filter(a => a.length > 0);',
    to:   '    ;' },
  { id: 'B3', target: LIB,
    why: 'whitespace stops being trimmed — "   " counts as an address, so a half-typed override inflates the route',
    from: '    .map(s => s.address.trim())',
    to:   '    .map(s => s.address)' },
  { id: 'B4', target: LIB,
    why: '🔴 a route with no drivable stop still produces a URL — the driver is sent a link that is just the farm, twice, with nothing saying so',
    from: '  if (stopAddresses.length === 0) {\n    return { url: null, stopCount: 0, addresses: [] };\n  }',
    to:   '  if (false) {\n    return { url: null, stopCount: 0, addresses: [] };\n  }' },

  // ══ the text ══════════════════════════════════════════════════════════════════════════
  { id: 'C1', target: LIB,
    why: '🔴 a text is sent even when there is no route — "Today\'s delivery route (0 stops):" followed by nothing, which reads as a system that worked',
    from: '  if (!handoff.url) return null;',
    to:   '  if (false) return null;' },
  { id: 'C2', target: LIB,
    why: 'the text drops the link entirely and the driver receives a stop count and no route',
    from: '  return `Today\'s delivery route (${n} stop${n !== 1 ? \'s\' : \'\'}):\\n${handoff.url}`;',
    to:   '  return `Today\'s delivery route (${n} stop${n !== 1 ? \'s\' : \'\'}):`;' },
  { id: 'C3', target: LIB,
    why: 'the count in the text is hardcoded away from the handoff — the exact shape of "(5 stops)" above a three-stop link, at a new address',
    from: '  const n = handoff.stopCount;',
    to:   '  const n = handoff.addresses.length;' },

  // ══ 🔴 §S THE WIRING — WHERE THE REPORTED DEFECT ACTUALLY LIVED ═══════════════════════
  { id: 'S1', target: PAGE,
    why: '🔴🔴 THE REPORTED DEFECT, RESTORED EXACTLY — the handoff derives from the BUILT order instead of the array on screen. Screen optimised, link un-optimised. This is what Lauren and David saw, and the page renders perfectly.',
    from: '    () => buildRouteHandoff(displayStops, routeOrigin),',
    to:   '    () => buildRouteHandoff(routeStops, routeOrigin),' },
  { id: 'S2', target: PAGE,
    why: '🔴 the URL goes back into state and is frozen in buildRoute() — the original mechanism: minted at an instant when the optimised order does not exist yet, and never revisited',
    from: '  const routeUrl = handoff.url;',
    to:   '  const [routeUrl] = useState<string | null>(handoff.url); setRouteUrl_unused();' },
  { id: 'S3', target: PAGE,
    why: '🔴 THE COUNT DEFECT AT ITS ORIGINAL SITE — the text computes the selection count itself instead of reading the handoff',
    from: '    const body = driverSmsBody(handoff);',
    to:   '    const count = selectedOrders.length;\n    const body = `Today\'s delivery route (${count} stop${count !== 1 ? \'s\' : \'\'}):\\n${handoff.url}`;' },
  { id: 'S4', target: PAGE,
    why: '🔴 the URL is built inside buildRoute() again — the one place in the file where the optimised order provably does not exist yet',
    from: '    setRouteSummary(null);           // cleared until RouteMap reports the new Directions result',
    to:   '    const _stale = buildRouteHandoff(stopModels, origin);\n    setRouteSummary(null);           // cleared until RouteMap reports the new Directions result' },
  { id: 'S5', target: PAGE,
    why: 'the clipboard is wired to something other than the derived URL — Copy and the button diverge, and only Copy is wrong',
    from: '    navigator.clipboard.writeText(routeUrl);',
    to:   '    navigator.clipboard.writeText(String(routeStops.map(s => s.address)));' },
  { id: 'S6', target: PAGE,
    why: '⚠️ the stale "optimization — deferred" comment returns — false since 420e0bc, and it is what told fourteen months of readers not to look at the URL',
    from: '    //   • endpointMode — future settable option:',
    to:   '    //   • stop-order OPTIMIZATION (reorder stops for shortest path) — deferred\n    //   • endpointMode — future settable option:' },
  { id: 'S7', target: PAGE,
    why: 'one of the three reset sites is inlined back to a partial clear — the selection changes, the stops go, the optimised summary stays, and the next route is built on a dead answer',
    from: '    // Clear route when selection changes\n    clearRoute();',
    to:   '    // Clear route when selection changes\n    setRouteStops([]);' },
  { id: 'S8', target: PAGE,
    why: '⚠️ REACH, NOT SUBJECT — the list stops rendering displayStops. §A–§C stay perfectly green through this and every S-mutant above, which is the whole reason §D reads the page (tech-debt #182).',
    from: '                  {displayStops.map((s, i) => (',
    to:   '                  {routeStops.map((s, i) => (' },
];

const files = [...new Set(MUTANTS.map(m => m.target))];
const originals = new Map(files.map(f => [f, readFileSync(ROOT + f, 'utf8')]));
let caught = 0, survived = 0, errored = 0;

try {
  process.stdout.write(`  CONTROL ${SUITE.split('/').pop().padEnd(24)} … `);
  if (!suiteIsGreen(SUITE)) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    const original = originals.get(m.target);
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in ${m.target.split('/').pop()} — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(ROOT + m.target, original.replace(m.from, m.to));
    const green = suiteIsGreen(SUITE);
    writeFileSync(ROOT + m.target, original);
    if (green) { console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); survived++; }
    else       { console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); caught++; }
  }
} finally {
  for (const [f, src] of originals) writeFileSync(ROOT + f, src);
}

console.log(`\n  ── ${caught}/${caught + survived} caught · ${survived} survived · ${errored} never applied ──\n`);
process.exit(survived > 0 || errored > 0 ? 1 : 0);
