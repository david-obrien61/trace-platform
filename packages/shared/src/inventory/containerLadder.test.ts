/**
 * ── containerLadder — a container size is a RUNG, not a number · 2026-09-14 (ledger #326) ──────
 *
 * RED-first against DAVID'S OWN LADDER, transcribed verbatim from the build prompt:
 *   slip · 4" · 3/5 gal · 15 · 30 · 45 · 65 · 95/100 · 200
 * and against the REAL LIVE POPULATIONS measured the same day (LAWNS 647 live rows, Test Dave's
 * 130). No invented sizes: every string below is either David's own or a value read out of the
 * live `business_inventory.size` column.
 *
 * PROBES BOTH DIRECTIONS (STD-022). The positive half proves a rung resolves. The negative half is
 * the half that matters here, because a ladder that matches everything is the same as no ladder:
 *   · an off-ladder size must REFUSE with its own reason, not be snapped to the nearest rung
 *   · a range spanning two rungs must NOT collapse onto one end (tech-debt #125's laundering)
 *   · a retired rung must still RESOLVE but must never be OFFERED — both directions asserted
 *   · a ladder whose rungs collide must be REPORTED, never silently first-wins
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/inventory/containerLadder.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import {
  foldLabel, numericKeysOf, resolveRung, rungsAbove, nextRung, validateLadder, handlingFor,
  sameSizeOnLadder, largestRung, activeRungs, rungFromRow, ladderCoverage, LADDER_FIELDS, LADDER_SELECT,
  type Rung, type Ladder,
} from './containerLadder';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const rung = (p: Partial<Rung> & { label: string; sortOrder: number }): Rung => ({
  aliases: [], volumeGallons: null, handlingMinutes: null,
  handlingBecause: 'untimed', installTPostsPerTree: 0, installTPostsBecause: 'not set', active: true, ...p,
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DAVID'S LADDER, VERBATIM. "3/5 gal" is ONE rung; 95 and 100 are ONE container.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const LAWNS: Ladder = [
  rung({ label: 'slip',    sortOrder: 10, aliases: ['slips', 'cutting'], volumeGallons: null }),
  rung({ label: '4 in',    sortOrder: 20, aliases: ['4"', '4 inch'],     volumeGallons: 0.05 }),
  rung({ label: '3/5 gal', sortOrder: 30, aliases: ['#3/5'],             volumeGallons: 4 }),
  rung({ label: '15 gal',  sortOrder: 40, volumeGallons: 15 }),
  rung({ label: '30 gal',  sortOrder: 50, volumeGallons: 30 }),
  rung({ label: '45 gal',  sortOrder: 60, volumeGallons: 45 }),
  rung({ label: '65 gal',  sortOrder: 70, volumeGallons: 65 }),
  rung({ label: '95/100',  sortOrder: 80, aliases: ['95 gal', '100 gal'], volumeGallons: 95 }),
  rung({ label: '200 gal', sortOrder: 90, volumeGallons: 200 }),
];

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §A  THE NUMERIC KEYS ARE DERIVED, NEVER DECLARED
// ══════════════════════════════════════════════════════════════════════════════════════════════
ok(JSON.stringify(numericKeysOf(LAWNS[3])) === '[15]', '§A the 15 rung claims 15, derived from its own label');
ok(JSON.stringify(numericKeysOf(LAWNS[2])) === '[3,5]',
  '🔴 §A the 3/5 rung claims BOTH 3 and 5 — Terry: the difference is only pot height (R-71 ③)');
ok(JSON.stringify(numericKeysOf(LAWNS[7])) === '[95,100]',
  '🔴 §A the 95/100 rung claims BOTH — one container, two names (quarts, not gallons)');
ok(numericKeysOf(LAWNS[0]).length === 0, '§A a slip has NO numeric key — its volume rounds to nothing');
ok(numericKeysOf(LAWNS[1]).length === 0,
  '🔴 §A a 4" rung has NO numeric key — 4 is inches, not a gallon count, so it must never match "4 gal"');

// ⚠️ SELF-CATCH: these would pass trivially if numericKeysOf returned everything it saw.
ok(!numericKeysOf(LAWNS[3]).includes(30), '§A the 15 rung does NOT claim 30 — the derive is per-rung, not global');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §B  RESOLUTION — label, alias, then number. The order is the specification.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const r = (size: string) => resolveRung(LAWNS, size);
ok(r('15 gal').ok && (r('15 gal') as any).rung.label === '15 gal', '§B exact label resolves');
ok(r('15').ok && (r('15') as any).rung.label === '15 gal',
  '🔴 §B a BARE trade number resolves by the derived key — nobody declares "15" as an alias');
ok(r('#15').ok && (r('#15') as any).rung.label === '15 gal', '§B "#15" resolves — the parser folds it');
ok(r('30 Gallon').ok && (r('30 Gallon') as any).rung.label === '30 gal', '§B spelling and case fold');

// 🔴 THE THREE THE PARSER ALONE CANNOT DO — measured 2026-09-14 against the real parser.
ok(r('slip').ok && (r('slip') as any).how === 'label',
  '🔴 §B "slip" resolves BY LABEL — parseUnitOfMeasure REFUSES it outright (measured)');
ok(r('4"').ok && (r('4"') as any).rung.label === '4 in',
  '🔴 §B a 4" pot resolves BY ALIAS — the parser reads it as LENGTH, so it has no container number');
ok(r('95/100').ok && (r('95/100') as any).rung.label === '95/100',
  '🔴 §B "95/100" resolves BY LABEL — the parser reads it as a RANGE 95→100, i.e. a refusal');

// 🔴 THE 3/5 CASE, WHICH IS WHY ALIASES EXIST AT ALL.
ok(r('3/5 Gallon').ok && (r('3/5 Gallon') as any).rung.label === '3/5 gal', '🔴 §B "3/5 Gallon" — the live LAWNS spelling — is ONE rung');
ok(r('#3').ok && (r('#3') as any).rung.label === '3/5 gal', '🔴 §B "#3" lands on the 3/5 rung');
ok(r('5 gal').ok && (r('5 gal') as any).rung.label === '3/5 gal', '🔴 §B "5 gal" lands on the SAME rung as "#3" — one bucket');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §C  THE NEGATIVE HALF — what must NOT resolve
// ══════════════════════════════════════════════════════════════════════════════════════════════
const off = r('7 gal');
ok(!off.ok && (off as any).reason === 'off_ladder',
  '🔴 §C 7 gal is OFF this ladder and says so — 21 such rows are live at LAWNS and none of the four hardcoded lists contains it');
ok(!off.ok && /not one of this nursery/.test((off as any).detail), '§C the off-ladder reason names what to do about it');

const ten15 = r('10/15 gallon');
ok(!ten15.ok && (ten15 as any).reason === 'off_ladder',
  '🔴 §C "10/15 gallon" must NOT collapse onto the 15 rung — it spans two, and laundering it is tech-debt #125s defect');

ok(!r('').ok && (r('') as any).reason === 'blank', '§C an empty size is BLANK, not off-ladder — a different question with a different answer');
ok(!r('   ').ok && (r('   ') as any).reason === 'blank', '§C whitespace is blank too');
ok(!r('3GP').ok, '§C an unknown trade code does not resolve — guessing is the fabrication D-9 forbids');
ok(!r('50lb').ok, '🔴 §C a WEIGHT never lands on a container ladder (R-99)');
ok(!r('1 Yard').ok, '§C a volume never lands on a container ladder');

// ⚠️ SELF-CATCH: the suite would be worthless if resolveRung returned ok for everything.
ok(!r('999 gal').ok, '§C a plausible but absent gallon size refuses — the ladder is a closed list, not a number parser');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §D  RETIRE, NEVER DELETE (R-133) — both directions, because one alone proves nothing
// ══════════════════════════════════════════════════════════════════════════════════════════════
const WITH_RETIRED: Ladder = [...LAWNS, rung({ label: '10 gal', sortOrder: 35, active: false })];
const retired = resolveRung(WITH_RETIRED, '10 gal');
ok(retired.ok, '🔴 §D a RETIRED rung STILL RESOLVES — a past lot and a past order still point at it');
ok(!rungsAbove(WITH_RETIRED, WITH_RETIRED[2]).some((x) => x.label === '10 gal'),
  '🔴 §D …and is NEVER OFFERED — retire means "stop offering", never "delete"');
ok(rungsAbove(WITH_RETIRED, WITH_RETIRED[2]).some((x) => x.label === '15 gal'),
  '§D …while a live rung above IS offered (the pair is what proves the filter is on `active`, not on everything)');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E  THE OFFER LIST AND THE NEXT RUNG
// ══════════════════════════════════════════════════════════════════════════════════════════════
ok(nextRung(LAWNS, LAWNS[3])?.label === '30 gal', '§E next rung above 15 is 30');
ok(nextRung(LAWNS, LAWNS[6])?.label === '95/100', '🔴 §E next above 65 is 95/100 — NOT 95, because the ladder is ordered, not arithmetic');
ok(nextRung(LAWNS, LAWNS[8]) === null, '§E the top rung has no next — null, not a wrap-around');
ok(rungsAbove(LAWNS, LAWNS[0]).length === 8, '§E everything is above a slip');
ok(rungsAbove(LAWNS, LAWNS[8]).length === 0, '§E nothing is above the top');
ok(rungsAbove(LAWNS, LAWNS[3])[0].label === '30 gal', '§E the offer list is ASCENDING');
// 🔴 the defect this replaces: a stepper could land on 47, a container nobody sells.
ok(!rungsAbove(LAWNS, LAWNS[3]).some((x) => x.label === '47 gal'),
  '🔴 §E 47 is not offered — the whole point: a plan cannot land on a pot that does not exist');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §F  A COLLIDING LADDER IS REPORTED, NEVER SILENTLY FIRST-WINS (R-96's shape)
// ══════════════════════════════════════════════════════════════════════════════════════════════
ok(validateLadder(LAWNS).length === 0, '🔴 §F DAVID\'S OWN LADDER IS CLEAN — the negative control, and it must be, or every probe below is noise');

const COLLIDE: Ladder = [...LAWNS, rung({ label: '5 gal', sortOrder: 35 })];
const conflicts = validateLadder(COLLIDE);
ok(conflicts.some((c) => c.kind === 'duplicate_number'),
  '🔴 §F a separate "5 gal" rung beside "3/5 gal" CLAIMS 5 TWICE and is reported — otherwise which rung wins is an accident of row order');
ok(conflicts.some((c) => /both claim the number 5/.test(c.detail)), '§F …and the report NAMES the number and both rungs');

ok(validateLadder([rung({ label: '15 gal', sortOrder: 1 }), rung({ label: '15 GAL', sortOrder: 2 })])
  .some((c) => c.kind === 'duplicate_label'), '§F two spellings of one label collide');
ok(validateLadder([rung({ label: 'a', sortOrder: 1 }), rung({ label: 'b', sortOrder: 1 })])
  .some((c) => c.kind === 'duplicate_sort'), '§F two rungs at one sort position make "next rung up" undefined');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §G  MINUTES CARRY THEIR BASIS — they are estimates and the type will not let them pretend
// ══════════════════════════════════════════════════════════════════════════════════════════════
const timed = handlingFor(rung({ label: '45 gal', sortOrder: 1, handlingMinutes: 5, handlingBecause: "Terry's estimate for a 45" }), 3);
ok(timed.value === 5, '§G a rung with its own figure uses it');
ok(timed.basis === 'suggestion', '🔴 §G …as a SUGGESTION, never a fact — nobody has timed this (David, 2026-09-14)');
ok((timed as any).assumption === "Terry's estimate for a 45", '§G …and it carries WHY, which the type requires');

const untimed = handlingFor(rung({ label: 'slip', sortOrder: 1 }), 3);
ok(untimed.value === 3, '🔴 §G an untimed rung falls back to the global rate — so R-89s four figures still reproduce');
ok(/nobody has timed/.test((untimed as any).assumption) && /stands in/.test((untimed as any).assumption),
  '🔴 §G …and its assumption says BOTH that nobody timed this rung AND that the global rate is standing in — either half alone reads as a measurement');
ok(/slip/.test((untimed as any).assumption),
  '§G …and it NAMES the rung it could not time, so the sentence is about this pot and not boilerplate');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §H  foldLabel — comparison only; the stored string is never rewritten (D-23 / R-50)
// ══════════════════════════════════════════════════════════════════════════════════════════════
ok(foldLabel('  15 GAL  ') === '15 gal', '§H trims, lowercases, collapses');
ok(foldLabel('#3 / 5') === '3/5', '§H drops a leading # and tightens the slash');
ok(foldLabel(null) === '' && foldLabel(undefined) === '', '§H null and undefined fold to empty, never to "null"');
ok(foldLabel('15') !== foldLabel('15 gal'),
  '🔴 §H fold does NOT equate "15" with "15 gal" — that is the PARSERs job, and doing it here too would be a second copy of one fact');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §I  THE FOUR HOLES THE MUTANTS FOUND. Each of these existed because the probe above it could
//     pass for the wrong reason — the §6 r19 question ("could this have failed?") answered by
//     making it fail. Every one of these was written AFTER a mutant survived.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ── R6: a WEIGHT must not land on a rung that happens to claim the same number ────────────────
// The earlier probe used "50lb", which no rung claims — so it passed even with the container test
// removed. 15 IS claimed by a rung, so this one can only pass if the KIND is actually checked.
ok(!resolveRung(LAWNS, '15 lb').ok,
  '🔴 §I a 15 POUND bag must not land on the 15 GALLON rung — the number matches and the kind does not (R-99)');
ok(!resolveRung(LAWNS, '30 lb').ok, '§I …nor 30 lb on the 30 gal rung');
ok(!resolveRung(LAWNS, '200 lb').ok, '§I …nor 200 lb on the 200 gal rung');

// ── K1: a numeric key that comes ONLY from an alias ───────────────────────────────────────────
// Every rung above happens to have a label that parses, so keys-from-label-only passed. This rung's
// label is a word; its number exists only in the alias.
const ALIAS_ONLY: Ladder = [rung({ label: 'liner', sortOrder: 10, aliases: ['2 gal'] })];
ok(JSON.stringify(numericKeysOf(ALIAS_ONLY[0])) === '[2]',
  '🔴 §I a rung whose LABEL does not parse still claims the number in its ALIAS — keys are derived from both');
ok(resolveRung(ALIAS_ONLY, '2 gallon').ok,
  '🔴 §I …so a lot spelled "2 gallon" resolves to a rung called "liner", which nothing declared');

// ── D2: a retired rung must resolve BY LABEL, not merely by number ────────────────────────────
// "10 gal" resolved by its number even with the label pass filtered, so the earlier probe could not
// see the difference. A retired rung whose label does NOT parse can only be found by label.
const RETIRED_WORD: Ladder = [...LAWNS, rung({ label: 'band pot', sortOrder: 15, active: false })];
const rw = resolveRung(RETIRED_WORD, 'band pot');
ok(rw.ok, '🔴 §I a RETIRED rung whose label is a WORD still resolves — history points at it and must stay readable (R-133)');
ok(rw.ok && (rw as any).how === 'label', '🔴 §I …and it resolved BY LABEL, so the retired-still-resolves path is genuinely exercised');
ok(!rungsAbove(RETIRED_WORD, RETIRED_WORD[0]).some((x) => x.label === 'band pot'), '§I …and it is still never offered');

// ── D4: the offer list must SORT, not merely preserve input order ─────────────────────────────
// Every ladder above is already in ascending order, so `.sort(() => 0)` was indistinguishable from
// a real sort. This one is deliberately shuffled.
const SHUFFLED: Ladder = [
  rung({ label: 'c', sortOrder: 30 }), rung({ label: 'a', sortOrder: 10 }), rung({ label: 'd', sortOrder: 40 }), rung({ label: 'b', sortOrder: 20 }),
];
ok(rungsAbove(SHUFFLED, SHUFFLED[1]).map((x) => x.label).join('') === 'bcd',
  '🔴 §I the offer list is SORTED from a shuffled ladder — row order must not decide what "the next rung up" means');
ok(nextRung(SHUFFLED, SHUFFLED[1])?.label === 'b', '🔴 §I …and the next rung is the lowest above, not the first row returned');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §J  THE RESOLVER SAYS WHICH REFUSAL IT IS (ledger #343)
//     The load list must not parse a size itself (David, 2026-09-16), so the resolver has to tell a
//     bag, an off-ladder container and a scribble apart. Before this build all three said off_ladder.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const bag = resolveRung(LAWNS, '40 lb');
ok(!bag.ok && bag.reason === 'not_container' && bag.kind === 'weight' && bag.unit.length > 0,
  '🔴 §J a 40 lb bag is NOT_CONTAINER, carrying its kind and unit — goods, not an off-ladder tree');
ok(!resolveRung(LAWNS, '15 lb').ok && (resolveRung(LAWNS, '15 lb') as any).reason === 'not_container',
  '🔴 §J a 15 lb bag is not_container even though 15 is a rung number');
ok((resolveRung(LAWNS, '3GP') as any).reason === 'unreadable', '🔴 §J a trade code nobody can read is UNREADABLE');
ok((resolveRung(LAWNS, '7 gallon') as any).reason === 'off_ladder', '§J a readable container size no rung claims is still OFF_LADDER');
ok((resolveRung(LAWNS, '100 gal') as any).rung?.label === '95/100', '🔴 §J "100 gal" lands on 95/100');
ok((resolveRung(LAWNS, '#3/5') as any).rung?.label === '3/5 gal', '🔴 §J "#3/5" lands on 3/5 gal by alias');
ok(resolveRung([], '15 gal').ok === false && (resolveRung([], '15 gal') as any).reason === 'off_ladder',
  '§J an EMPTY ladder places nothing — a container size is off it');

// §K  SAME SIZE, ON THE LADDER — the count screen's comparison
ok(sameSizeOnLadder(LAWNS, '#3', '5 gal'), '🔴 §K "#3" and "5 gal" are the SAME size at LAWNS — one rung');
ok(!sameSizeOnLadder(null, '#3', '5 gal'), '§K (negative control) without a ladder they are two sizes');
ok(sameSizeOnLadder(LAWNS, '45 Gallon', '45 gal'), '§K two spellings of one rung are one size');
ok(!sameSizeOnLadder(LAWNS, '15 gal', '7 gal'), '🔴 §K a rung and an off-ladder size are NOT the same');
ok(sameSizeOnLadder(LAWNS, '7 gal', '7 gallon'), '§K two off-ladder spellings of one size still match by the text fold');
ok(sameSizeOnLadder(LAWNS, null, null), '§K two blanks match — the count promote\'s stub branch depends on it');

// §L  THE NEW-RUNG COPY SOURCE AND THE OFFER LIST
const POSTED: Ladder = [rung({ label: 'a', sortOrder: 10, installTPostsPerTree: 2 }),
  rung({ label: 'b', sortOrder: 30, installTPostsPerTree: 4 }), rung({ label: 'c', sortOrder: 40, installTPostsPerTree: 9, active: false })];
ok(largestRung(POSTED)?.label === 'b', '🔴 §L the LARGEST rung is the top ACTIVE one in ladder order — a retired top rung is skipped');
ok(largestRung([]) === null, '§L an empty ladder has no largest rung');
ok(activeRungs(POSTED).map((x) => x.label).join('') === 'ab', '§L the offer list drops retired rungs and keeps ladder order');

// §M  THE ONE ROW→RUNG MAPPING
const mapped = rungFromRow({ id: 'x', label: '3/5 gal', aliases: null, sort_order: 30, volume_gallons: '4',
  handling_minutes: null, handling_because: null, install_t_posts_per_tree: '0', install_t_posts_because: 'LAWNS, David 2026-09-12', active: true });
ok(mapped.volumeGallons === 4 && mapped.installTPostsPerTree === 0 && mapped.aliases.length === 0,
  '§M a PostgREST row maps to a Rung — string numerics become numbers, a null alias list becomes []');
ok(rungFromRow({ ...({} as any), label: 'x', sort_order: 1, active: true, install_t_posts_per_tree: null }).installTPostsPerTree === 0,
  '§M a row without the posts column reads 0 — what the database default says');
ok(LADDER_SELECT === LADDER_FIELDS.join(', ') && LADDER_FIELDS.includes('install_t_posts_per_tree'),
  '§M the select is derived from the ONE field list, which includes the install posts');

// §N  COVERAGE — every size lands in exactly one bucket, and the off-ladder ones are named
const cov = ladderCoverage(['15 gal', '15 Gallon', '7 gal', '7 gallon', '1 gal', '50 lb', null, '', '3GP', '#3/5'], LAWNS);
ok(cov.onLadder === 3 && cov.notContainer === 1 && cov.noSize === 2 && cov.unreadable === 1,
  `🔴 §N the buckets are right (got ${JSON.stringify(cov)})`);
ok(cov.offLadder.length === 2 && cov.offLadder[0].size === '7 gal' && cov.offLadder[0].count === 2 && cov.offLadder[1].size === '1 gal',
  '🔴 §N off-ladder sizes are NAMED with their counts, most first — "7 gal" twice, "1 gal" once');
ok(cov.onLadder + cov.notContainer + cov.noSize + cov.unreadable + cov.offLadder.reduce((n, o) => n + o.count, 0) === 10,
  '🔴 §N nothing is dropped — the buckets sum to the input');

console.log(`\n── containerLadder: ${passed} passed, ${failed} failed ──`);
if (failed) { failures.forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }
