/**
 * ── duplicateParties — the union, the three axes, and the limit that is DECLARED ──────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not that grouping works — that is a disjoint-set and a Map. What
 * is under test is whether this file can UNDERSTATE the problem in a way that looks like an answer,
 * and there are exactly four ways it can:
 *   §A  the union collapses back into `max()` or inflates into a sum
 *   §B  the O(n) name bucketing stops agreeing with the canonical `personNamesMatch`
 *   §C  an empty or absent identifier merges records on nothing
 *   §D  a group forgets WHICH axis found it, so a merge decision is made blind
 * Every one of those produces a SMALLER, TIDIER, MORE CONFIDENT number than the truth — which is
 * precisely what `max(byEmail, byPhone)` produced for as long as anybody looked at it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/customers/duplicateParties.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  findDuplicateParties, tallyDuplicateParties, nameBucketKey, nameAxisAgreesWithMatcher,
  DUP_AXES, type PartyCandidate,
} from './duplicateParties';
import { personNamesMatch } from '../utils/personName';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const p = (id: string, name: string, email: string | null = null, phone: string | null = null): PartyCandidate =>
  ({ id, label: name, name, email, phone });

// ══ §A 🔴 THE UNION — AND THE TWO WRONG ANSWERS IT SITS BETWEEN ════════════════════════════
//
// This is the case the retired rule could not see, and no amount of asserting about `max()` could
// have caught it: the two axes find DIFFERENT records. Email says 2, phone says 2, and the truth
// is 4. `max()` reports 2 and `sum()` reports 4 by coincidence — so the fixture below adds a pair
// that shares BOTH, where the sum inflates and only the union is right.
{
  const rows = [
    p('1', 'Ann Spannaus', 'a@x.com'),
    p('2', 'A Spannaus',   'A@X.COM'),                      // email only
    p('3', 'Zach Mcgrath', null, '(512) 456-3632'),
    p('4', 'Zack Mcgrath', null, '512-456-3632'),           // phone only
    p('5', 'Joe Bloggs',   'joe@x.com', '5559998888'),
    p('6', 'Joe Bloggs',   'joe@x.com', '555-999-8888'),    // BOTH axes, one pair
    p('7', 'Someone Else', 'unique@x.com', '5551110000'),
  ];
  const t = tallyDuplicateParties(rows);
  ok(t.byAxis.email === 4, 'the email axis alone reaches 4 records');
  ok(t.byAxis.phone === 4, 'the phone axis alone reaches 4 records');
  ok(t.recordsInvolved === 6,
    '🔴 THE UNION IS 6. `max(4, 4)` = 4 silently discards the pair the other axis found; `4 + 4` = 8 counts the both-axes pair twice. Neither number can be reached from the two tallies, which is why this takes rows');
  ok(t.groups === 3, 'and it is three separate merge decisions, not one list of six');
  ok(t.largestGroup === 2, 'the worst cluster is two records');
}

// ══ §B 🔴 THE NAME AXIS IS EXACT TOKEN-SET EQUALITY, AND THE BUCKETING PROVES IT ═══════════
//
// The name axis buckets on a sorted-token key because comparing 1,953 records pairwise would build
// four million token sets. That is only legitimate if the key produces EXACTLY the same verdict as
// the canonical matcher — so the equivalence is asserted over a table of pairs rather than asserted
// in a comment. Half the table is pairs that must NOT match.
{
  const PAIRS: [string, string, boolean][] = [
    ["TERRENCE OBRIEN", "Terrence O'Brien", true],
    ['John Smith',      'Smith, John',      true],
    ['John A. Smith',   'John Smith',       true],
    ["Dave's Tree Svs", 'Daves Tree Svs',   true],
    ['Sarah Wilson',    'Sarah Wilson',     true],
    ['Ann Spannaus',    'Spannaus, Ann',    true],
    // ── the four David found by eye that this axis deliberately CANNOT see ──
    ['Nicholas Servin', 'Nicolas Servin',   false],
    ['Zach Mcgrath',    'Zack Mcgrath',     false],
    ['Rebeca Cedillos', 'Rebecca Cedillos', false],
    ['Turnstile Ranch', 'Turnstyle Ranch',  false],
    // ── and the ones it must never merge ──
    ['John Smith',      'John Smith Jr',    false],
    ["TERRENCE OBRIEN", "Andrew O'Brien",   false],
    ['Sarah Wilson',    'Sara Wilson',      false],
  ];
  for (const [a, b, expected] of PAIRS) {
    ok(personNamesMatch(a, b) === expected,
      `the canonical matcher says ${expected} for "${a}" vs "${b}"`);
    ok(nameAxisAgreesWithMatcher(a, b),
      `🔴 AND THE BUCKET KEY AGREES WITH IT for "${a}" vs "${b}" — the O(n) grouping is the same rule as the O(n²) comparison, or it is a SECOND identity rule nobody ruled on`);
  }

  // 🔴 THE FOUR ONE-LETTER PAIRS ARE THE DECLARED LIMIT, ASSERTED AS BEHAVIOUR SO NOBODY "FIXES"
  // IT QUIETLY. Widening this to edit distance would find them AND would merge `Sarah Wilson` with
  // `Sara Wilson`, who may be two people. A duplicate is fixable; a wrong merge is not.
  const nearMisses = findDuplicateParties([
    p('1', 'Nicholas Servin'), p('2', 'Nicolas Servin'),
    p('3', 'Turnstile Ranch'), p('4', 'Turnstyle Ranch'),
  ]);
  ok(nearMisses.length === 0,
    '🔴 A ONE-LETTER SPELLING DIFFERENCE IS NOT A MATCH HERE, AND THAT IS RULED RATHER THAN OVERLOOKED. Four of the six pairs David found by eye are invisible to this axis, the finding says so, and widening the identity rule is his decision and not a helper default');
}

// ══ §C 🔴 ABSENCE IS NOT AGREEMENT ═════════════════════════════════════════════════════════
{
  const blanks = findDuplicateParties([
    p('1', '', null, null), p('2', '', null, null), p('3', '   ', null, null),
  ]);
  ok(blanks.length === 0,
    '🔴 THREE NAMELESS RECORDS ARE NOT ONE PERSON. An empty token set equals another empty token set, and a bucket keyed on it would merge every unnamed record into one imaginary customer (D-9)');
  ok(nameBucketKey(null) === null && nameBucketKey('') === null && nameBucketKey('  ') === null,
    'and the key itself refuses to exist for a name with no identity tokens');

  const nullContacts = findDuplicateParties([
    p('1', 'Alice Adams', null, null), p('2', 'Bob Brown', null, null),
  ]);
  ok(nullContacts.length === 0,
    'two records with no email and no phone are not a match on the strength of both being blank');

  // a phone fragment is not a phone number — the normaliser's own guard, reached through here
  ok(findDuplicateParties([p('1', 'Alice Adams', null, '101'), p('2', 'Bob Brown', null, '101')]).length === 0,
    'a three-digit extension is not a phone number, so two of them are not a duplicate — overstating the problem is as misleading as missing it');
}

// ══ §D 🔴 A GROUP SAYS WHICH AXIS FOUND IT, AND THE CLUSTER STAYS WHOLE ════════════════════
{
  const g = findDuplicateParties([
    p('1', 'Ann Spannaus', 'a@x.com'),
    p('2', 'A Spannaus',   'a@x.com'),
  ]);
  ok(g[0].axes.length === 1 && g[0].axes[0] === 'email',
    'a pair found only by email says so');
  ok(DUP_AXES[g[0].axes[0]] === 'a shared email address',
    'and the axis has an owner-facing phrase rather than a field name');

  // TRANSITIVE: A~B on phone, B~C on name — all three are ONE decision.
  const chain = findDuplicateParties([
    p('1', 'Joe Bloggs',   null, '5124563632'),
    p('2', 'J Bloggs',     null, '512-456-3632'),
    p('3', 'J Bloggs',     'jb@x.com'),
  ]);
  ok(chain.length === 1 && chain[0].members.length === 3,
    '🔴 THE CLUSTER STAYS WHOLE. Showing an owner A+B and separately B+C asks her to make one decision twice with half the evidence each time — and the second time against a record the first decision may already have removed');
  ok(chain[0].axes.join(',') === 'phone,name',
    'and it names BOTH axes that built it, in the order the axes are declared');

  // the group key is stable, so a re-render cannot re-order the list
  const again = findDuplicateParties([
    p('3', 'J Bloggs',     'jb@x.com'),
    p('1', 'Joe Bloggs',   null, '5124563632'),
    p('2', 'J Bloggs',     null, '512-456-3632'),
  ]);
  ok(again[0].key === chain[0].key,
    'the key is the smallest member id, so shuffling the input does not shuffle the output');
}

// ══ §E NEGATIVE CONTROLS — it must be able to find NOTHING ═════════════════════════════════
{
  ok(findDuplicateParties([]).length === 0, 'no rows, no groups');
  ok(tallyDuplicateParties([]).recordsInvolved === 0 && tallyDuplicateParties([]).largestGroup === 0,
    'an empty list reports a largest group of 0 rather than a fabricated 1');
  const clean = [p('1', 'Alice Adams', 'a@x.com', '5551110000'),
                 p('2', 'Bob Brown',   'b@x.com', '5552220000')];
  ok(findDuplicateParties(clean).length === 0 && tallyDuplicateParties(clean).recordsInvolved === 0,
    'two genuinely different customers are not a duplicate — the detector can return nothing, which is what makes its findings mean anything');
}

console.log(`\n  duplicateParties — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
