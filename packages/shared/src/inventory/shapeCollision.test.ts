/**
 * ── shapeCollision — one definition, or the screen and the import report disagree ──────────
 *
 * 🔴 THIS MODULE EXISTS BECAUSE ONE OPERATION HAD TWO IMPLEMENTATIONS AND THEY DISAGREED. The
 * import found eleven collisions in LAWNS's 685 items; the grid found none of them. David saw a
 * $150 price gap on two Brodie Juniper rows by eye and reasonably concluded the detector was
 * broken. It was not — there were two detectors.
 *
 * §A the key folds spelling, never meaning
 * §B 🔴 money at stake — the sort key, and a missing price is not a zero
 * §C the sentence names the product
 * §D grouping, ordering, and the negatives
 *
 * Run: node_modules/.bin/esbuild packages/shared/src/inventory/shapeCollision.test.ts \
 *        --bundle --platform=node --format=cjs | node
 */
import { shapeCollisionKey, findShapeCollisions, moneyAtStake, collisionReason } from './shapeCollision';

let passed = 0, failed = 0;
function ok(c: boolean, m: string): void { if (c) passed++; else { failed++; console.error('   ✗ ' + m); } }
const r = (name: string, size: string | null, price: number | null = null) => ({ name, size, price });

// ── §A the key ───────────────────────────────────────────────────────────────
{
  // 🔴 THE REAL PAIR. Different strings, one shelf. A key over the size TEXT misses it, and that
  // is exactly what the grid's `sizeGroupKey` did.
  ok(shapeCollisionKey('Brodie Juniper', '45G') === shapeCollisionKey('Brodie Juniper', '45 gallon'),
     '§A 🔴 `45G` and `45 gallon` produce the SAME key — the parsed unit, not the spelling');
  ok(shapeCollisionKey('Skyward Holly', '5G') === shapeCollisionKey('Skyward Holly', '5 gallon'),
     '§A the Skyward Holly pair too — $65 vs $60, invisible to a text key');
  ok(shapeCollisionKey('Lacey Oak', '30 gallon') === shapeCollisionKey('Lacey Oak', '30 Gallon'),
     '§A case folds');
  ok(shapeCollisionKey('lacey oak', '30 gallon') === shapeCollisionKey('Lacey  Oak', '30 gallon'),
     '§A the NAME folds through the shared slug — spacing and case');

  // 🔴 THE NEGATIVES. A key that merged these would invent collisions.
  ok(shapeCollisionKey('Live Oak', '15 gallon') !== shapeCollisionKey('Live Oak', '30 gallon'),
     '§A 🔴 two real sizes of one variety are NOT a collision');
  ok(shapeCollisionKey('Live Oak', '15 gallon') !== shapeCollisionKey('Lacey Oak', '15 gallon'),
     '§A two varieties at one size are NOT a collision');
  ok(shapeCollisionKey('X', '10/15 gallon') !== shapeCollisionKey('X', '15 gallon'),
     '§A 🔴 a RANGE is not the same shelf as its top end');
  ok(shapeCollisionKey('X', 'wibble') !== shapeCollisionKey('X', 'wobble'),
     '§A 🔴 two UNPARSEABLE sizes do not merge into one unknown bucket — that would invent a collision');
  ok(shapeCollisionKey('X', 'wibble') === shapeCollisionKey('X', ' WIBBLE '),
     '§A …but the same unparseable label, trimmed and cased, is the same row');
}

// ── §B money at stake ────────────────────────────────────────────────────────
{
  ok(moneyAtStake([r('a', '45', 1250), r('a', '45', 375)]) === 875, '§B the Lacey Oak gap is $875');
  ok(moneyAtStake([r('a', '45', 1000), r('a', '45', 1000)]) === 0, '§B agreeing prices are 0');
  ok(moneyAtStake([r('a', '45', 650), r('a', '45', 0)]) === 650, '§B a $0 price IS a price — Yaupon Holly');
  // 🔴 A MISSING PRICE IS NOT A ZERO. Treating null as 0 would report a $1,250 gap on a pair where
  // one side simply never published a price — a fabricated finding (itemList's own rule).
  ok(moneyAtStake([r('a', '45', 1250), r('a', '45', null)]) === 0,
     '§B 🔴 a row with NO price contributes nothing — absent is not $0');
  ok(moneyAtStake([r('a', '45', null), r('a', '45', null)]) === 0, '§B two missing prices are 0, not NaN');
  ok(moneyAtStake([r('a', '45', 500)]) === 0, '§B one row alone has no gap');
}

// ── §C the sentence ──────────────────────────────────────────────────────────
{
  const s = collisionReason([r('Lacey Oak', '45 Gallon', 1250), r('Lacey Oak', '45 Gallon', 375)]);
  ok(s.startsWith('Lacey Oak 45 Gallon'),
     '§C 🔴 it NAMES THE PRODUCT — its absence is why a correct detector was reported as missing a pair');
  ok(s.includes('$1250') && s.includes('$375'), '§C and both prices');
  ok(/neither was chosen for you/.test(s), '§C and says nothing was decided on her behalf');
  const same = collisionReason([r('Chinese Pistache', '95 gallon', 1000), r('Chinese Pistache', '95 gallon', 1000)]);
  ok(same.startsWith('Chinese Pistache 95 gallon'), '§C the same-price sentence names it too');
  ok(!same.includes('do not agree on price'), '§C 🔴 and does NOT claim a price disagreement that is not there');
  ok(collisionReason([r('X', null, 5), r('X', null, 5)]).startsWith('X —'),
     '§C a size-less product does not get a dangling space');
}

// ── §D grouping and ordering ─────────────────────────────────────────────────
{
  const rows = [
    r('Chinese Pistache', '95 gallon', 1000), r('Chinese Pistache', '95 gallon', 1000),
    r('Lacey Oak', '45 Gallon', 1250),        r('Lacey Oak', '45 Gallon', 375),
    r('Brodie Juniper', '45G', 1250),         r('Brodie Juniper', '45 gallon', 1400),
    r('Live Oak', '15 gallon', 200),          r('Live Oak', '30 gallon', 400),
  ];
  const c = findShapeCollisions(rows);
  ok(c.length === 3, `§D three groups — Live Oak's two SIZES are not one (got ${c.length})`);
  ok(c[0].moneyAtStake === 875, '§D 🔴 BIGGEST MONEY FIRST — Lacey Oak $875 leads (R-101 ①)');
  ok(c[1].moneyAtStake === 150, '§D then Brodie Juniper $150');
  ok(c[2].moneyAtStake === 0 && c[2].pricesDiffer === false, '§D and the tidy-up is last — but it IS still there');
  ok(c.every(g => g.members.length === 2), '§D every group has both members');
  ok(c.filter(g => g.pricesDiffer).length === 2, '§D two of the three disagree on price');

  // 🔴 STABLE ORDER — two runs over one catalogue must report identically, or a card quoting
  // "the first collision" means something different each time.
  const a1 = findShapeCollisions(rows).map(g => g.key).join('|');
  const a2 = findShapeCollisions([...rows].reverse()).map(g => g.key).join('|');
  ok(a1 === a2, '§D 🔴 the order does not depend on input order');

  // The negatives that matter: nothing invented on a clean catalogue.
  ok(findShapeCollisions([r('a', '15'), r('a', '30'), r('b', '15')]).length === 0,
     '§D 🔴 a catalogue with no duplicates yields NO groups — the finder can say no');
  ok(findShapeCollisions([]).length === 0, '§D and an empty list is empty, not a crash');
  ok(findShapeCollisions([r('a', '15', 9)]).length === 0, '§D a single row is never a collision');

  // Three-way.
  const three = findShapeCollisions([r('a', '45', 100), r('a', '45G', 300), r('a', '45 Gallon', 200)]);
  ok(three.length === 1 && three[0].members.length === 3, '§D three spellings of one shelf are ONE group of three');
  ok(three[0].moneyAtStake === 200, '§D and the gap is widest-to-narrowest across all three');
}

console.log(`\nshapeCollision — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
