/**
 * ── teamRouteGate — "Route this team" never does nothing (ledger #405) ──────────────
 *
 * David, 2026-09-24: it routes that crew's stops, or says plainly why it can't. Lauren lost two
 * weekends to a button that did neither.
 *
 * Run: node_modules/.bin/esbuild packages/cultivar-os/src/lib/teamRouteGate.test.ts --bundle --platform=node --format=cjs | node
 */
import { teamRouteProblem, type GateStop } from './teamRouteGate';

let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); console.error('   ✗ ' + m); } };

const T1 = 't1', T2 = 't2';
const stop = (id: string, team: string | null, address = '1 Somewhere, Leander', who = `Customer ${id}`): GateStop =>
  ({ id, team_id: team, address, who });
const gate = (o: Partial<Parameters<typeof teamRouteProblem>[0]>) =>
  teamRouteProblem({ teamId: T1, teamName: 'Crew 1', stops: [], selected: new Set(), ...o });

// ══ §E THE EMPTY CASE — THE BRANCH THAT USED TO SAY NOTHING ════════════════════════
{
  const none = gate({ stops: [stop('a', T2)], selected: new Set() });
  ok(none !== null, '🔴 E1: a crew with no stops must NOT return null — that is the silent greyed button');
  ok(!!none && none.includes('No stops are assigned to Crew 1'),
    `🔴 E2: it names the CREW, not "cannot route" — got ${JSON.stringify(none)}`);

  const noAddr = gate({ stops: [stop('a', T1, ''), stop('b', T1, '')], selected: new Set() });
  ok(!!noAddr && noAddr.includes('2 stops') && noAddr.includes('no address that can be placed'),
    `🔴 E3: it says HOW MANY and WHY — got ${JSON.stringify(noAddr)}`);
  ok(!!noAddr && noAddr.includes('Customer a') && noAddr.includes('Customer b'),
    'E4: …and names them, so Lauren knows which stops to fix');

  const one = gate({ stops: [stop('a', T1, '')], selected: new Set() });
  ok(!!one && one.includes('1 stop,') && one.includes('it has'),
    `E5: singular reads correctly — got ${JSON.stringify(one)}`);

  // assigned WITH addresses but nothing ticked — a different sentence again
  const untick = gate({ stops: [stop('a', T1)], selected: new Set() });
  ok(!!untick && untick.includes('Nothing is selected for Crew 1'),
    `E6: an un-ticked selection says so — got ${JSON.stringify(untick)}`);
}

// ══ §P IT STILL PERMITS THE GOOD CASE ══════════════════════════════════════════════
{
  ok(gate({ stops: [stop('a', T1), stop('b', T1)], selected: new Set(['a', 'b']) }) === null,
    '🔴 P1: a clean single-team selection returns null — the gate must not block real work');
  ok(teamRouteProblem({ teamId: null, teamName: 'The whole day', stops: [stop('a', null)], selected: new Set() }) === null,
    '🔴 P2: the WHOLE-DAY view is never gated here — routing a day is untouched by this change');
}

// ══ §R THE REFUSALS THAT ALREADY EXISTED STILL FIRE, AND FIRST ═════════════════════
{
  const teamless = gate({ stops: [stop('a', T1), stop('b', null)], selected: new Set(['a', 'b']) });
  ok(!!teamless && teamless.includes('has no team'),
    `R1: a team-less stop in the set is still refused by name — got ${JSON.stringify(teamless)}`);
  const mixed = gate({ stops: [stop('a', T1), stop('b', T2)], selected: new Set(['a', 'b']) });
  ok(!!mixed && mixed.includes('Route one team at a time'),
    `R2: a mixed set is still refused — got ${JSON.stringify(mixed)}`);
  // 🔴 ORDER: a thing Lauren DID outranks the fallback.
  ok(!!teamless && !teamless.includes('Nothing is selected'),
    'R3: an actionable refusal is reported instead of the generic one');
}

console.log(`\nteamRouteGate: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
