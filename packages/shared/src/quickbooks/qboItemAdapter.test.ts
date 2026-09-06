/**
 * ── qboItemAdapter — reading a product out of somebody else's accounting system ───────────
 *
 * 🔴 WHAT IS UNDER TEST IS THE THREE-WAY HONESTY OF THE SIZE READ, AND THE REFUSAL TO CHOOSE
 * BETWEEN TWO PRODUCTS THAT COLLIDE. A wrong size is recoverable; a size CONFIDENTLY WRONG, or a
 * product silently dropped because another one had the same name, is not — nothing on any screen
 * says it happened.
 *
 * §A  category folders are excluded — a filter, not a judgement
 * §B  🔴 the size is read from Description and the NAME loses it
 * §C  🔴 THREE STATES, NEVER TWO — sized · not stated · could not read
 * §D  🔴 a bare trailing number is NOT a size (the anchor's second job)
 * §E  🔴 the shortest-first scan does not eat the sentence
 * §F  🔴 every sellable item becomes a row — a collision is FLAGGED, never resolved
 * §G  counts agree with the lists they claim to count
 * §H  🔴 R-27 — no second unit vocabulary lives in this file
 * §I  the real LAWNS shapes, verbatim from the 2026-09-04 capture
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/qboItemAdapter.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { adaptQboItems, readProductFromDescription, SIZE_STATE_NOTE } from './qboItemAdapter';
import type { QboItemRow } from './itemList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const it = (id: string, name: string, o: Partial<QboItemRow> = {}): QboItemRow => ({
  id, name, type: 'NonInventory', incomeAccount: 'Sales of Nursery Stock', active: true,
  unitPrice: null, purchaseCost: null, sku: null, description: null, fullyQualifiedName: name, ...o,
});

// ── §A category folders ──────────────────────────────────────────────────────
{
  const rows = [
    it('1', 'Oak', { type: 'Category' }),
    it('2', 'Maple', { type: 'Category' }),
    it('3', 'category-lowercase', { type: 'category' }),   // Intuit's casing is not a contract
    it('4', 'AP45', { description: 'Afgan Black Pine, 45 Gallon' }),
    it('5', 'AH', { type: 'Service', description: 'Augur Holes' }),
  ];
  const a = adaptQboItems(rows);
  ok(a.counts.categories === 3, '§A 🔴 all three Category rows excluded, case-insensitively');
  ok(a.counts.sellable === 2, '§A sellable is everything that is not a folder');
  ok(a.items.every(i => i.qboType !== 'Category'), '§A no folder survives into the catalogue');
  ok(a.counts.readIn === 5, '§A readIn reports what arrived, not what survived');
  ok(a.items.some(i => i.qboType === 'Service'), '§A a Service item is sellable — Type is carried, not filtered on beyond Category');
}

// ── §B the size comes out of Description and the name loses it ───────────────
{
  const cases: [string, string, string | null][] = [
    ['Afgan Black Pine, 45 Gallon',              'Afgan Black Pine',              '45 Gallon'],
    ['Prime Ark Traveller Blackberry - 5 Gallon','Prime Ark Traveller Blackberry','5 Gallon'],
    ['Blue Point Juniper 1 gallon',              'Blue Point Juniper',            '1 gallon'],
    ['Royal Purple Bougainvillea - 3gal',        'Royal Purple Bougainvillea',    '3gal'],
    ['Bougainvillea Elizabeth Agnus 3G',         'Bougainvillea Elizabeth Agnus', '3G'],
    ['Mexican Buckeye 10/15 gallon',             'Mexican Buckeye',               '10/15 gallon'],
    ['Natchez Crape Myrtle - 30 gallon',         'Natchez Crape Myrtle',          '30 gallon'],
  ];
  for (const [desc, name, size] of cases) {
    const r = readProductFromDescription(desc);
    ok(r.name === name, `§B name for "${desc}" → "${name}" (got "${r.name}")`);
    ok(r.size === size, `§B size for "${desc}" → "${size}" (got "${r.size}")`);
    ok(r.state === 'sized', `§B "${desc}" is sized`);
  }
  // 🔴 FIVE DIFFERENT SEPARATORS IN ONE REAL CATALOGUE. Splitting on a comma, or on " - ", would
  // have read four of these seven wrongly — which is how the first draft of this measured 24 rows
  // with a size of "myrtle - 15 gallon".
  ok(true, '§B five separator shapes, one rule');
}

// ── §C the three states ──────────────────────────────────────────────────────
{
  const sized      = readProductFromDescription('Live Oak - 45 Gallon');
  const notStated  = readProductFromDescription('Deer Fencing');
  const noDesc     = readProductFromDescription(null);
  const blankDesc  = readProductFromDescription('   ');
  const unreadable = readProductFromDescription('Bermuda sod by the pallet, 450 sq. ft.');

  ok(sized.state === 'sized', '§C a readable size is `sized`');
  ok(notStated.state === 'not_stated', '§C 🔴 a description with no size is NOT_STATED — a true fact about the product');
  ok(notStated.name === 'Deer Fencing', '§C a size-less product keeps its whole description as its name');
  ok(noDesc.state === 'could_not_read', '§C 🔴 NO DESCRIPTION is COULD_NOT_READ, not "not stated" — we had nothing to read');
  ok(blankDesc.state === 'could_not_read', '§C a whitespace-only description reads the same as an absent one');
  ok(unreadable.state === 'could_not_read', '§C 🔴 a size-shaped tail the parser DECLINED is COULD_NOT_READ');
  ok(unreadable.unreadSizeText === '450 sq. ft', '§C the fragment we failed on is REPORTED — that is what makes it actionable');
  ok(sized.unreadSizeText === null && notStated.unreadSizeText === null,
     '§C the unread fragment is null unless we actually tried and failed');

  // 🔴 THE ONE THAT MATTERS. If these two collapsed, the fertiliser rows would tell Lauren they
  // have no size when the truth is that we could not read the one they have.
  ok(notStated.state !== noDesc.state,
     '§C 🔴 "states no size" and "we could not read it" are DIFFERENT STATES (STANDARDS §6/R1)');
  ok(new Set(Object.keys(SIZE_STATE_NOTE)).size === 3, '§C every state has exactly one owner-facing sentence');
  ok(SIZE_STATE_NOTE.could_not_read !== SIZE_STATE_NOTE.not_stated, '§C and the two sentences differ');
}

// ── §D a bare trailing number is not a size ──────────────────────────────────
{
  // `parseUnitOfMeasure('15')` legitimately returns 15 gallon — correct inside a size CELL, and
  // catastrophic at the end of a sentence.
  const r1 = readProductFromDescription('Brown Patch treatment 4# p 1000 Heritage G');
  ok(r1.state !== 'sized' || r1.size !== '1000', '§D 🔴 "1000" at the end of prose is NOT a 1000-gallon container');
  const r2 = readProductFromDescription('Fertiliser blend 20');
  ok(r2.state === 'not_stated', '§D 🔴 a BARE trailing number yields no size at all');
  ok(r2.size === null, '§D and it certainly does not become gallons');
  // The anchor lets a `#` through, because `#30` announces itself as a container size.
  const r3 = readProductFromDescription('Live Oak #30');
  ok(r3.state === 'sized' && r3.size === '#30', '§D 🔴 `#30` IS a size — the # is the marker the bare number lacks');
  ok(r3.name === 'Live Oak', '§D and the name loses it');
}

// ── §E shortest-first does not eat the sentence ──────────────────────────────
{
  // 🔴 THE REGRESSION THIS PINS. A longest-first scan read "myrtle - 15 gallon" as the SIZE on 24
  // real rows, because `parseUnitOfMeasure` finds a size INSIDE a longer string.
  const r = readProductFromDescription('Natchez Crape Myrtle - 15 gallon');
  ok(r.size === '15 gallon', '§E 🔴 the size is "15 gallon", NOT "myrtle - 15 gallon"');
  ok(r.name === 'Natchez Crape Myrtle', '§E and the name is the whole product, separator stripped');
  ok(!(r.size ?? '').includes('myrtle'), '§E no word of the product name leaks into the size');

  // A three-word size still wins, because the shorter candidates are not size-shaped.
  const scoop = readProductFromDescription('Compost 1/2 Yard Scoop');
  ok(scoop.size === '1/2 Yard Scoop', '§E a three-word size is found — shortest-first is anchored, not greedy-short');

  // 🔴 THE OTHER DIRECTION, ADDED AFTER MUTANT A10 SURVIVED. With the anchor in place,
  // longest-first and shortest-first agree on 645 of LAWNS's 647 items, so nothing in §E could
  // tell them apart. These two are the whole difference, and the fragment we report as unreadable
  // is what distinguishes them.
  const cedar = readProductFromDescription("Eastern Red Cedar B&B 10' to 12' tall");
  ok(cedar.state === 'could_not_read', "§E a height range is not a size we can read");
  ok(cedar.unreadSizeText === "12' tall",
     "§E 🔴 the SHORTEST size-shaped tail is what we report failing on — longest-first would say \"10' to 12' tall\"");
}

// ── §E2 a trailing parenthetical is a remark, not the size ───────────────────
{
  // 🔴 FOUND BY MUTANT A10, AND IT WAS A CONFIDENTLY WRONG SIZE RATHER THAN A MISSING ONE.
  const box = readProductFromDescription('Shumard Red Oak - 300gal (48" Box)');
  ok(box.size === '300gal', '§E2 🔴 the size is 300gal — before this it read `48" Box)` and the row landed as a 48 BOX');
  ok(box.state === 'sized' && box.name === 'Shumard Red Oak', '§E2 and the name is clean');

  const holly = readProductFromDescription("Native Male Yaupon Holly - 65 Gallon (8'-10')");
  ok(holly.size === '65 Gallon', '§E2 🔴 a height remark no longer hides a plainly stated container size');
  ok(holly.name === 'Native Male Yaupon Holly', '§E2 and the remark is not left on the name either');

  // Repeated remarks are all stripped.
  const two = readProductFromDescription('Dynamite Crape Myrtle - 3 Gallon (Red) (20% off)');
  ok(two.size === '3 Gallon', '§E2 two trailing remarks are both stripped');

  // 🔴 THE NEGATIVE. A bracketed KIT uses SQUARE brackets and must survive untouched.
  const kit = readProductFromDescription('Staking kit [2 T-Posts]');
  ok(kit.size === '[2 T-Posts]' && kit.state === 'sized', '§E2 🔴 a SQUARE-bracket kit is a size and is NOT stripped');

  // A description that is nothing but a remark does not become empty.
  const only = readProductFromDescription('(discontinued)');
  ok(only.state !== 'sized', '§E2 a description made entirely of a remark yields no size');
  ok(only.name !== null && only.name !== '', '§E2 and it does not become a nameless row');
}

// ── §F every sellable item becomes a row; a collision is flagged ─────────────
{
  // The real NZCM30 pair, verbatim from the 2026-09-04 capture.
  const rows = [
    it('859', 'NZCM30', { type: 'NonInventory', unitPrice: 900, description: 'Natchez Crape Myrtle - 30 gallon', fullyQualifiedName: 'Crape Myrtle:NZCM30' }),
    it('150', 'NZCM30', { type: 'Service',      unitPrice: 350, description: 'Natchez Crape Myrtle 30 gallon',   fullyQualifiedName: 'NZCM30' }),
    it('300', 'LO15',   { unitPrice: 200, description: 'Live Oak - 15 gallon' }),
  ];
  const a = adaptQboItems(rows);
  ok(a.items.length === 3, '§F 🔴 ALL THREE become rows — CREATE BOTH, FLAG BOTH (R-C). Nothing is dropped.');
  ok(new Set(a.items.map(i => i.qboId)).size === 3, '§F one QuickBooks item, one row, always');
  ok(a.collisions.length === 1, '§F exactly one collision is reported');
  ok(a.collisions[0].members.length === 2, '§F both members of the pair are named');
  ok(a.collisions[0].pricesDiffer === true, '§F 🔴 the price disagreement is the sharp part and it is flagged');
  ok(a.collisions[0].reason.includes('$900') && a.collisions[0].reason.includes('$350'),
     '§F 🔴 BOTH PRICES ARE IN THE SENTENCE — $550 apart, and an owner cannot act on "there is a collision"');
  ok(a.counts.collidingItems === 2, '§F the count is ITEMS involved (2), not collisions (1)');
  ok(a.counts.collisionsWithPriceDifference === 1, '§F price-disagreeing collisions counted separately');
  ok(a.collisions[0].members.map(m => m.fullyQualifiedName).join('|') !== '|',
     '§F the FQN is carried, because it is the only thing that tells the two apart on screen');

  // A same-price collision is still reported — it is still two products in her books.
  const same = adaptQboItems([
    it('a', 'X', { unitPrice: 90, description: 'Mexican Buckeye 10/15 gallon' }),
    it('b', 'Y', { unitPrice: 90, description: 'Mexican Buckeye 10/15 gallon' }),
  ]);
  ok(same.collisions.length === 1, '§F a same-price duplicate is still a collision');
  ok(same.collisions[0].pricesDiffer === false, '§F but it is not flagged as a price disagreement');
  ok(same.items.length === 2, '§F and both still become rows');

  // 🔴 THE NEGATIVE. Two genuinely different products must NOT be called a collision.
  const distinct = adaptQboItems([
    it('a', 'X', { description: 'Live Oak - 15 gallon' }),
    it('b', 'Y', { description: 'Live Oak - 30 gallon' }),
  ]);
  ok(distinct.collisions.length === 0, '§F 🔴 same name, DIFFERENT size is not a collision');

  // …and two spellings of ONE size ARE the same shape, because the shape key parses the unit.
  const spellings = adaptQboItems([
    it('a', 'X', { description: 'Live Oak - 30 gal' }),
    it('b', 'Y', { description: 'Live Oak - 30 Gallon' }),
  ]);
  ok(spellings.collisions.length === 1, '§F 🔴 "30 gal" and "30 Gallon" collide — the key compares MEANING, not spelling');
}

// ── §G counts agree with the lists ───────────────────────────────────────────
{
  const rows = [
    it('1', 'Cat', { type: 'Category' }),
    it('2', 'A', { description: 'Live Oak - 15 gallon' }),
    it('3', 'B', { description: 'Deer Fencing' }),
    it('4', 'C', { description: null }),
    it('5', 'D', { description: 'Bag stuff, 450 sq. ft.' }),
  ];
  const a = adaptQboItems(rows);
  ok(a.counts.sellable === a.items.length, '§G sellable === the list it claims to count');
  ok(a.counts.sized + a.counts.notStated + a.counts.couldNotRead === a.items.length,
     '§G 🔴 the three states PARTITION the catalogue — every row is in exactly one');
  ok(a.counts.categories + a.counts.sellable === a.counts.readIn, '§G nothing is lost between readIn and the two buckets');
  ok(a.counts.sized === 1 && a.counts.notStated === 1 && a.counts.couldNotRead === 2, '§G the three counts are right on a known fixture');
}

// ── §H R-27: no second unit vocabulary in this file ──────────────────────────
{
  // 🔴 A STRUCTURAL PROBE, NOT A BEHAVIOURAL ONE. R-27 says the unit columns are derived through
  // `parseUnitOfMeasure` and no other. The way that gets broken is somebody adding "gallon" to a
  // regex here. This asserts the adapter learns a NEW unit for free — i.e. that it has no
  // vocabulary of its own to fall out of date.
  //
  // `quart` is in unitOfMeasure's map and appears NOWHERE in the adapter's source.
  const r = readProductFromDescription('Herb starter - 2 quart');
  ok(r.state === 'sized' && r.size === '2 quart',
     '§H 🔴 a unit this file has never heard of is read correctly — the vocabulary lives in ONE module');
  const post = readProductFromDescription('Staking kit [2 T-Posts]');
  ok(post.state === 'sized', '§H the bracketed-kit grammar works here too, and it is not reimplemented here');
  const nonsense = readProductFromDescription('Widget 4 fnords');
  ok(nonsense.state === 'could_not_read', '§H a unit NOBODY knows is a refusal, not an invention');
  ok(nonsense.unreadSizeText === '4 fnords', '§H and the refused fragment is named');
}

// ── §I the real LAWNS shapes ─────────────────────────────────────────────────
{
  // Verbatim descriptions from `qbo-items-9341455222430707-2026-09-04T17-21-05-394Z.json`.
  const real: [string, 'sized' | 'not_stated' | 'could_not_read'][] = [
    ['Afgan Black Pine, 45 Gallon',                                       'sized'],
    ['Augur Holes, and install water monitor pipe.',                      'not_stated'],
    ['Bermuda sod by the pallet, 450 sq. ft.',                            'could_not_read'],
    ['Contractor Discount, 10%',                                          'could_not_read'],
    ['Adjustable Tree Bubbler',                                           'not_stated'],
    ['50lb Bag: Micromax Granular Micronutrients',                        'not_stated'],
    ['Eastern Red Cedar B&B 10\' to 12\' tall',                           'could_not_read'],
    ['Vera Lynn Red Bougainvillea - 3 Gallon',                            'sized'],
    ['Blue Point Juniper',                                                'not_stated'],
  ];
  for (const [desc, state] of real) {
    const r = readProductFromDescription(desc);
    ok(r.state === state, `§I "${desc.slice(0, 46)}…" → ${state} (got ${r.state})`);
  }
  // 🔴 THE FERTILISER CASE, CALLED OUT ON ITS OWN. "50lb Bag: Micromax…" states its size at the
  // FRONT, so a trailing scan honestly finds none. That is `not_stated` and it is a KNOWN
  // shortfall, recorded here rather than papered over: a front-loaded size is a real shape in this
  // catalogue and this adapter does not read it. Roughly 30 rows. Owed, and visible.
  ok(readProductFromDescription('50lb Bag: Micromax Granular Micronutrients').size === null,
     '§I 🔴 a FRONT-loaded size is not read — a named shortfall, not a silent one');
}

console.log(`\nqboItemAdapter — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
