/**
 * ── crewDayLink — the pure helpers behind the crew day link (ledger #347) ─────────────────────
 *
 * The end-to-end and security behaviour is proven in `scripts/path-tests/crew-day.paths.mts`
 * (run by `npm run verify:writer-registry`). This file holds the small decisions the two screens
 * make on their own: what counts as a token, what the schedule prints, and the Maps link.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/crewDayLink.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { tokenFromHash, stopActivity, mapsUrl, crewLinkUrl, isDeadLink, crewRefusalText, type StopEvent } from './crewDayLink';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const T = 'ab'.repeat(32);

// ══ §A THE TOKEN — only 64 hex characters, from the fragment ══════════════════════════════════
{
  ok(tokenFromHash(`#${T}`) === T, 'A1 a fragment token is read');
  ok(tokenFromHash(`#${T.toUpperCase()}`) === T, 'A2 upper case is folded (a text app may capitalise)');
  ok(tokenFromHash('') === null, 'A3 no fragment is no token');
  ok(tokenFromHash(`#${T.slice(1)}`) === null, 'A4 63 characters is not a token');
  ok(tokenFromHash(`#${T}x`) === null, 'A5 a trailing character is not a token');
  ok(tokenFromHash(`#${'g'.repeat(64)}`) === null, 'A6 non-hex is not a token');
  const url = crewLinkUrl('https://cultivar-os.app/', T);
  ok(url === `https://cultivar-os.app/crew#${T}`, `A7 the link carries the token in the fragment — ${url}`);
  ok(tokenFromHash(new URL(url).hash) === T, 'A8 round trip: the link a person is sent opens as the same token');
  ok(!new URL(url).search.includes(T) && !new URL(url).pathname.includes(T), 'A9 NEGATIVE CONTROL — the token is in no part of the URL a browser sends');
}

// ══ §B WHAT THE SCHEDULE PRINTS ═════════════════════════════════════════════════════════════════
{
  const ev = (action: StopEvent['action'], at: string, by = 'Mike', note: string | null = null): StopEvent =>
    ({ delivery_id: 's1', action, actor_name: by, note, occurred_at: at });
  const none = stopActivity([]);
  ok(none.started === null && none.done === null && none.notes.length === 0, 'B1 no events, nothing printed');
  const a = stopActivity([ev('start', '1'), ev('note', '2', 'Ana', 'gate locked'), ev('done', '3', 'Ana')]);
  ok(a.started?.by === 'Mike' && a.done?.by === 'Ana' && a.notes.length === 1 && a.notes[0].note === 'gate locked', 'B2 start, note, done');
  const u = stopActivity([ev('done', '1'), ev('undo_done', '2')]);
  ok(u.done === null, 'B3 🔴 an Undo cancels the Done — the schedule must not say done for a reopened stop');
  const r = stopActivity([ev('done', '1'), ev('undo_done', '2'), ev('done', '3', 'Ana')]);
  ok(r.done?.by === 'Ana' && r.done.at === '3', 'B4 done again after an undo shows the latest');
  ok(stopActivity([ev('note', '1', 'Mike', null)]).notes.length === 0, 'B5 a note event with no text prints nothing');
}

// ══ §C MAPS AND REFUSALS ════════════════════════════════════════════════════════════════════════
{
  const m = mapsUrl({ address_line1: '400 Honeycomb Mesa', city: 'Leander', state: 'TX', zip: '78641' });
  ok(m === 'https://www.google.com/maps/search/?api=1&query=400%20Honeycomb%20Mesa%2C%20Leander%2C%20TX%2078641', `C1 maps link — ${m}`);
  ok(mapsUrl({ address_line1: null, city: null, state: null, zip: null }) === null, 'C2 no address, no Maps button');
  ok(mapsUrl({ address_line1: '  ', city: 'Leander', state: null, zip: null })?.endsWith('query=Leander') === true, 'C3 blanks are dropped');
  ok(isDeadLink('expired') && isDeadLink('revoked') && isDeadLink('invalid'), 'C4 the three dead-link codes');
  ok(!isDeadLink('rate_limited') && !isDeadLink('network') && !isDeadLink('not_on_this_day'), 'C5 NEGATIVE CONTROL — a busy or offline link is not dead');
  ok(/Ask Lauren/.test(crewRefusalText('expired')) && /Ask Lauren/.test(crewRefusalText('revoked')), 'C6 a dead link says who to ask');
  ok(crewRefusalText('unknown_code', 'server said') === 'server said', 'C7 an unknown code falls back to the server message');
}

console.log(`  crewDayLink — ${passed} passed, ${failed} failed  (population: 3 sections, ${passed + failed} assertions)`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
