/**
 * ── teams — the one decision the Teams editor makes before the writer sees it (ledger #362) ────
 *
 * Every RULE about a team is in the database and is proven end to end in
 * scripts/path-tests/teams.paths.mts (5 paths, 9 guards). This file holds the single step that
 * happens BEFORE the writer is called and that the path test therefore cannot see: turning what
 * Lauren typed into a textarea into a list of names.
 *
 * 🔴 It is tested because it is a CAPTURE step (§6 r21): a name typed and not sent is a value
 *    entered and not saved, which is a defect — and the writer can only refuse what reaches it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/teamsMembers.test.ts --bundle --platform=node --format=cjs | node
 */
import { splitMemberNames } from './teams';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const eq = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

// §A WHAT PEOPLE ACTUALLY TYPE
ok(eq(splitMemberNames('Mauro\nJose'), ['Mauro', 'Jose']), 'A1 one name per line is the documented form');
ok(eq(splitMemberNames('Mauro, Jose'), ['Mauro', 'Jose']), 'A2 commas are accepted, because people type those too');
ok(eq(splitMemberNames('Mauro,Jose\nHector'), ['Mauro', 'Jose', 'Hector']), 'A3 a mix of both is still three people');
ok(eq(splitMemberNames('  Mauro  \n  Jose  '), ['Mauro', 'Jose']), 'A4 spaces around a name are not part of the name');

// §B NOTHING IS INVENTED AND NOTHING IS DROPPED
ok(eq(splitMemberNames(''), []), 'B1 an empty box is nobody, not one blank person');
ok(eq(splitMemberNames('\n\n  \n'), []), '🔴 B2 blank lines are dropped — a trailing Enter must not send a nameless member');
ok(eq(splitMemberNames('Mauro\n\n\nJose'), ['Mauro', 'Jose']), 'B3 blank lines BETWEEN names are dropped, and the two names survive');
ok(splitMemberNames('Mauro De La Cruz').length === 1, '🔴 B4 a space inside a name is NOT a separator — a two-word name is one person');
ok(eq(splitMemberNames('Mauro De La Cruz'), ['Mauro De La Cruz']), 'B5 …and it arrives whole');

// §C ORDER IS THE TYPED ORDER — the writer stores sort_order from it
ok(eq(splitMemberNames('Charlie\nAlice\nBob'), ['Charlie', 'Alice', 'Bob']), '🔴 C1 the list is NOT sorted — Lauren types the crew in the order she thinks of them');

// §D NEGATIVE CONTROL — this could have failed
ok(!eq(splitMemberNames('Mauro\nJose'), ['Jose', 'Mauro']), 'D1 NEGATIVE CONTROL — the comparison genuinely distinguishes order');
ok(splitMemberNames('Mauro;Jose').length === 1, '🔴 D2 NEGATIVE CONTROL — a semicolon is NOT a separator, so "accepts anything" would fail here');

console.log(`  teams/splitMemberNames — ${passed} passed, ${failed} failed  (population: 4 sections, ${passed + failed} assertions)`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
