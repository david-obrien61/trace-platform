/**
 * ── measure-findings-report-mutants — can the six new census modules be made to understate? ──
 *
 * PURPOSE:      The books review grew six pure measurement modules on 2026-09-08, and every one of
 *               them can fail in the SAME direction: a smaller, tidier, more confident number than
 *               the truth. `max()` instead of a union. A collection counted as a missing delivery
 *               date. A discount counted as a product whose size we could not read. A retail total
 *               printed as a cost. None of those looks wrong on a screen, which is why they have to
 *               be caught by something other than looking at one.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file at a time; every target
 *               is restored in `finally`, including on a throw.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 WHY THIS ONE SCRIPT COVERS SIX TARGETS, WHERE EVERY OTHER MEASURE SCRIPT COVERS ONE.
 *    The six were built in one pass, they answer one question between them — *what is actually in
 *    these books* — and each has a single small suite. Six near-identical scripts would be six
 *    copies of the same runner (§6 r8), and the copy that drifts is never the one you are looking
 *    at. The cost is stated rather than hidden: a mutant here names its TARGET FILE, so a failure
 *    still says which module was weakened.
 *
 * 🔴 GREEN CONTROL FIRST, PER TARGET, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *    A control run before each target's mutants means a suite that is already red cannot be read as
 *    a wall of CAUGHTs — which is the same green-that-cannot-disagree this whole harness exists for.
 *
 * Run: node scripts/measure-findings-report-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen(suite) {
  try {
    execSync(`${ESB} ${suite} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const T = {
  dup:     'packages/shared/src/customers/duplicateParties.ts',
  give:    'packages/shared/src/quickbooks/giveawayLines.ts',
  samedoc: 'packages/shared/src/quickbooks/sameDocument.ts',
  cat:     'packages/shared/src/quickbooks/catalogueCensus.ts',
  disp:    'packages/shared/src/quickbooks/dispatchCensus.ts',
  store:   'packages/shared/src/quickbooks/booksRunStore.ts',
};
const S = {
  dup:     'packages/shared/src/customers/duplicateParties.test.ts',
  give:    'packages/shared/src/quickbooks/giveawayLines.test.ts',
  samedoc: 'packages/shared/src/quickbooks/sameDocument.test.ts',
  cat:     'packages/shared/src/quickbooks/catalogueCensus.test.ts',
  disp:    'packages/shared/src/quickbooks/dispatchCensus.test.ts',
  store:   'packages/shared/src/quickbooks/booksRunStore.test.ts',
};

const MUTANTS = [
  // ── duplicateParties: the union, the axes, and the identity guard ──
  { id: 'D1', t: 'dup', why: '🔴 THE NAME AXIS IS DROPPED — the six pairs that share neither an email nor a phone become invisible, which is the state the retired rule was in',
    from: "  bucketBy('name',  r => nameBucketKey(r.name ?? null));", to: '' },
  { id: 'D2', t: 'dup', why: '🔴 an EMPTY name matches another empty name — every unnamed record merged into one imaginary customer (D-9: absence is not agreement)',
    from: '  if (set.size === 0) return null;', to: "  if (set.size === 0) return '';" },
  { id: 'D3', t: 'dup', why: '🔴 the bucket key stops SORTING its tokens, so "Smith, John" and "John Smith" become two people and the axis silently halves',
    from: '  return [...set].sort().join(\' \');', to: "  return [...set].join(' ');" },
  { id: 'D4', t: 'dup', why: '🔴 a group forgets WHICH AXIS found it — a merge decision made without knowing whether the evidence was an email or a spelling',
    from: '    const axes = order.filter(a => axesOfRoot.get(root)?.has(a));', to: '    const axes = [] as DuplicateAxis[];' },
  { id: 'D5', t: 'dup', why: '🔴 the cluster is broken into pairs — an owner asked to make one decision twice, the second time against a record the first may already have removed',
    from: '    if (idxs.length < 2) continue;', to: '    if (idxs.length !== 2) continue;' },
  { id: 'D6', t: 'dup', why: '🔴 the phone normaliser\'s short-string guard is bypassed here, so a three-digit extension matching another one reports a duplicate that is not one',
    from: "  bucketBy('phone', r => normPhone(r.phone ?? null));", to: "  bucketBy('phone', r => (r.phone ?? null));" },
  { id: 'D7', t: 'dup', why: '🔴 the single-axis tallies are reported as the UNION — the exact arithmetic that gave 52 where the answer was 72',
    from: '    recordsInvolved: groups.reduce((n, g) => n + g.members.length, 0),',
    to:   '    recordsInvolved: Math.max(byAxis.email, byAxis.phone, byAxis.name),' },
  { id: 'D8', t: 'dup', why: '🔴 the group KEY stops being the smallest member id, so a re-render can re-order the list under the owner\'s cursor',
    from: '      key: members.map(m => m.id).sort()[0],', to: '      key: members[0].id,' },

  // ── giveawayLines: the population, the shapes, and the cost refusal ──
  { id: 'G1', t: 'give', why: '🔴 NOTES AND SUBTOTALS COUNT AS GIVEAWAYS — a finding inflated with lines nobody decided anything about',
    from: '      if (l.itemId === null) continue;', to: '      if (false) continue;' },
  { id: 'G2', t: 'give', why: '🔴 a line whose amount we COULD NOT READ is counted as free — asserting somebody gave something away on the strength of an unreadable field',
    from: '      if (l.amount === null || l.amount !== 0) continue;', to: '      if (l.amount !== 0 && l.amount !== null) continue;' },
  { id: 'G3', t: 'give', why: '🔴 the WORDING shape is checked before the ITEM, so every line the item already names is reclassified and "recorded three ways" collapses',
    from: "  if (mentionsReplacement(itemName) || mentionsReplacement(itemDescription)) return 'item-names-it';\n  if (wordingSaysSo) return 'wording-names-it';",
    to:   "  if (wordingSaysSo) return 'wording-names-it';\n  if (mentionsReplacement(itemName) || mentionsReplacement(itemDescription)) return 'item-names-it';" },
  { id: 'G4', t: 'give', why: '🔴 the line NOTHING explains is silently dropped instead of counted — and that is precisely where a fourth or fifth way of recording this would hide',
    from: "  return 'nothing-names-it';", to: "  return 'wording-names-it';" },
  { id: 'G5', t: 'give', why: '🔴 A PARTIAL COST TOTAL IS REPORTED AS THE COST — a different number wearing the same label, and nobody reading it knows which lines it covers',
    from: '    costTotal: lines > 0 && linesWithoutCost === 0 ? costSum : null,', to: '    costTotal: lines > 0 ? costSum : null,' },
  { id: 'G6', t: 'give', why: '🔴 a purchase cost of ZERO is read as "it cost nothing" rather than "nobody filled it in" — the understatement mirror of the retail overstatement',
    from: '    if (cost !== null && cost > 0) costSum += cost; else linesWithoutCost++;',
    to:   '    if (cost !== null) costSum += cost; else linesWithoutCost++;' },
  { id: 'G7', t: 'give', why: '🔴 `shapesInUse` counts the vocabulary instead of what is actually used, so "recorded three different ways" is printed for a business that records it one way',
    from: '    shapesInUse: (Object.values(byShape) as number[]).filter(n => n > 0).length,',
    to:   '    shapesInUse: Object.keys(byShape).length,' },

  // ── sameDocument: four fields, not one ──
  { id: 'S1', t: 'samedoc', why: '🔴 THE DOCUMENT NUMBER RETURNS TO THE KEY — a bookkeeper\'s renumbering reads as a duplicate again, and a genuinely duplicated document goes invisible the moment one of the two is renumbered',
    from: '  return `c:${inv.customerId ?? \'-\'}|d:${inv.txnDate ?? \'-\'}|t:${cents(inv.totalAmt)}|L:${lines}`;',
    to:   '  return `n:${inv.docNumber ?? \'-\'}|c:${inv.customerId ?? \'-\'}|d:${inv.txnDate ?? \'-\'}|t:${cents(inv.totalAmt)}|L:${lines}`;' },
  { id: 'S2', t: 'samedoc', why: '🔴 the TOTAL leaves the key, so two invoices for the same customer on the same day with different money read as one document',
    from: '|t:${cents(inv.totalAmt)}|L:', to: '|L:' },
  { id: 'S3', t: 'samedoc', why: '🔴 the LINES leave the key — same customer, same day, same total, entirely different goods, reported as one job billed twice',
    from: '|L:${lines}`;', to: '`;' },
  { id: 'S4', t: 'samedoc', why: '🔴 money is compared as a FLOAT, so two amounts that agree to the penny read as different and the finding silently empties on real money',
    from: 'const cents = (n: number | null): string => (n === null ? \'null\' : String(Math.round(n * 100)));',
    to:   'const cents = (n: number | null): string => (n === null ? \'null\' : String(n));' },
  { id: 'S5', t: 'samedoc', why: '🔴 the lines stop being SORTED, so one record of a job listing its rows in a different order is not recognised as the same document',
    from: '    .sort()\n    .join(\'~\');', to: "    .join('~');" },
  { id: 'S6', t: 'samedoc', why: '🔴 an invoice with no customer or no date is silently counted as comparable, swelling the clean population with rows the question could never be asked of',
    from: '    if (!inv.customerId || !inv.txnDate) { notComparable++; continue; }',
    to:   '    if (false) { notComparable++; continue; }' },
  { id: 'S7', t: 'samedoc', why: '🔴 the retired repeated-number question stops being measured, so the replacement can no longer say WHY repeated numbers are not counted and a reader concludes we stopped looking',
    from: '    const totals = new Set(members.map(m => cents(m.totalAmt)));\n    if (totals.size === 1) repeatedNumberGroupsAgreeingOnTotal++;',
    to:   '    repeatedNumberGroupsAgreeingOnTotal++;' },

  // ── catalogueCensus: the denominator that decides whether 33 can ever become 13 ──
  { id: 'C1', t: 'cat', why: '🔴 EVERY UNREADABLE ROW IS COUNTED AS A PRODUCT — the 33 that are 15, and a count that can never reach zero because 18 of them are unfixable',
    from: "    if (dest === DESTINATIONS.product) {", to: '    if (true) {' },
  { id: 'C2', t: 'cat', why: '🔴 the not-applicable rows are silently dropped instead of named, so a number that shrank has no explanation and nobody trusts it',
    from: '      notApplicable[dest as Exclude<Destination, \'product\'>]++;', to: '      void dest;' },
  { id: 'C3', t: 'cat', why: '🔴 a FOLDER is counted as an unreadable size — the filing cabinet reported as a product needing work',
    from: '    const state = stateById.get(row.id);', to: "    const state = stateById.get(row.id) ?? 'could_not_read';" },
  { id: 'C4', t: 'cat', why: '🔴 "states no size" is folded into "could not read" — a product that legitimately has no size reported as a defect',
    from: "      if (state === 'could_not_read') productsUnreadable++;\n      else if (state === 'sized') productsSized++;\n      else if (state === 'not_stated') productsNotStated++;",
    to:   "      if (state !== 'sized') productsUnreadable++;\n      else productsSized++;" },
  { id: 'C5', t: 'cat', why: '🔴 the collision census re-keys on the raw size TEXT, so `45G` and `45 gallon` are two products again — the pairs with a spelling difference AND a price gap, which is the combination that costs money',
    from: '  const c = adapted.collisions;', to: '  const c = adapted.collisions.filter(g => new Set(g.members.map(m => m.size)).size === 1);' },
  // ⚠️ C6 STOOD HERE AND IS DELETED, NOT WEAKENED — IT SURVIVED, AND SURVIVING WAS THE FINDING.
  //    It swapped `censusCollisions`'s reduce-for-the-widest-gap for `c[0]`, and nothing changed,
  //    because `findShapeCollisions` ALREADY orders its groups by money at stake. The reduce was a
  //    second implementation of an ordering rule that has one home (§6 r8) and it was doing no
  //    work; the module now reads the shared sort, and `shapeCollision.test.ts` §B is where that
  //    ordering is asserted. A mutant with nothing left to mutate is an ERROR here, so deleting it
  //    is the only honest outcome — keeping it would be a permanent red on a fixed defect.

  // ── dispatchCensus: the separation, and the predicate that makes it ──
  { id: 'P1', t: 'disp', why: '🔴 A PLANTED TREE READS AS A COLLECTION — these books weld the planting into the price, so 909 planted lines carry no delivery item and the finding crushes to nothing',
    from: '  return inv.lines.some(l => isCarriageAccount(l.itemAccountName) || l.installInDescription);',
    to:   '  return inv.lines.some(l => isCarriageAccount(l.itemAccountName));' },
  { id: 'P2', t: 'disp', why: '🔴 the predicate reads the ITEM NAME instead of the income account — R-50\'s retro-classification arriving as a helpful default, and it fires on an item named "Delivery" that books to something else entirely',
    from: '  return inv.lines.some(l => isCarriageAccount(l.itemAccountName) || l.installInDescription);',
    to:   "  return inv.lines.some(l => /delivery|freight|shipping/i.test(l.itemName ?? '') || l.installInDescription);" },
  { id: 'P3', t: 'disp', why: '🔴 COLLECTIONS ARE COUNTED AS GAPS AGAIN — three-fifths of her history reported as broken when it is a correct record of a customer collecting their own order',
    from: '    if (invoiceLeftTheYard(inv)) { dispatchedWithoutDate++; dispatchedAmount += amount; }\n    else { collectedWithoutDate++; collectedAmount += amount; }',
    to:   '    dispatchedWithoutDate++; dispatchedAmount += amount;' },
  { id: 'P4', t: 'disp', why: '🔴 an invoice the dispatch walk NEVER COVERED is counted as undated — "we did not look" rendered as "there is nothing there"',
    from: '    if (!shipDates.has(inv.id)) continue;', to: '    if (false) continue;' },
  { id: 'P5', t: 'disp', why: '🔴 a NULL total is skipped entirely rather than counted with no money — an invoice disappearing from the count because one of its fields was unreadable',
    from: '    const amount = inv.totalAmt ?? 0;', to: '    const amount = inv.totalAmt; if (amount === null) continue;' },

  // ── booksRunStore: the save that looks identical whether or not it happened ──
  { id: 'B1', t: 'store', why: '🔴 A REFUSED RUN INSERT IS REPORTED AS SAVED — zero rows and no error is what BOTH an RLS refusal and a table that does not exist look like, and David applies this migration by hand',
    from: '    if (!run.data || run.data.length !== 1) return { saved: false, reason: REFUSED_RUN };', to: '    if (run.data === undefined) return { saved: false, reason: REFUSED_RUN };' },
  { id: 'B2', t: 'store', why: '🔴 a PARTIAL result insert passes — a run whose findings are half stored, and a comparison that still runs and is silently wrong',
    from: '    if (!res.data || res.data.length !== plan.results.length) {', to: '    if (!res.data) {' },
  { id: 'B3', t: 'store', why: '🔴 findings that COULD NOT RUN are dropped from the stored results — a rule that failed this month becomes indistinguishable from one that was fixed, so a broken walk reads as an improvement',
    from: '    results: findings.map(f => ({', to: '    results: findings.filter(f => f.measured).map(f => ({' },
  { id: 'B4', t: 'store', why: '🔴 a run with one INCOMPLETE walk is stored as complete — comparing a partial read against a whole one reports a business improving when it only read less',
    from: '    complete: walks.length > 0 && walks.every(w => w.read && w.complete),', to: '    complete: walks.length > 0,' },
  { id: 'B5', t: 'store', why: '🔴 the RECORDS behind a finding are persisted — a customer\'s book of customers stored on the strength of a bookkeeping row, which is a ruling nobody has made (R-23 b)',
    from: '      measured: f.measured,\n    })),', to: '      measured: f.measured, rows: f.rows,\n    })),' },
  { id: 'B6', t: 'store', why: '🔴 a THROW escapes and takes the report screen with it, over a bookkeeping row, immediately after the document was rendered for a customer',
    from: '  } catch (e: unknown) {', to: '  } catch (e: never) { if (e) throw e;' },
];

const originals = new Map();
let caught = 0, survived = 0, errored = 0;
try {
  for (const key of Object.keys(T)) originals.set(key, readFileSync(ROOT + T[key], 'utf8'));

  for (const key of Object.keys(T)) {
    const mine = MUTANTS.filter(m => m.t === key);
    if (mine.length === 0) continue;
    process.stdout.write(`  CONTROL ${T[key].replace('packages/shared/src/', '')} … `);
    if (!suiteIsGreen(S[key])) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
    console.log('GREEN ✓');
    const original = originals.get(key);
    for (const m of mine) {
      if (!original.includes(m.from)) {
        console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in ${T[key]} — mutant never applied`);
        errored++; continue;
      }
      writeFileSync(ROOT + T[key], original.replace(m.from, m.to));
      if (suiteIsGreen(S[key])) { survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); }
      else                      { caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); }
      writeFileSync(ROOT + T[key], original);
    }
    console.log('');
  }
} finally {
  for (const [key, text] of originals) writeFileSync(ROOT + T[key], text);
}

console.log(`  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
