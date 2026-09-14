/**
 * ── loadList — the yard person's copy of the day ───────────────────────────────────
 *
 * 🔴 EVERY FIXTURE IN §D IS THE REAL SATURDAY 2026-08-29 LAWNS DELIVERY DAY, read out of the
 * live database on 2026-09-12 (six stops, fifteen `order_items` rows, every one unanchored
 * because all six orders are `order_kind='history'` from the QuickBooks ingest). Nothing here is
 * invented, which is the only reason the numbers below can be compared against what actually
 * went on the trailer.
 *
 * PROBES BOTH DIRECTIONS (STD-022): every rule is asserted by a case that must pass AND a case
 * that must fail. The negatives matter more than usual here — the whole point of the page is
 * that it refuses to print a blank where it could not compute, so most of the risk is in the
 * refusals, not the sums.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/loadList.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BOM_RULES, GALLONS_PER_CUBIC_YARD, LOAD_LIST_COPY, RING_ANCHORS,
  buildLoadList, resolveLoadItem, tPostsFor, ringDiameterFeet, ringCircumferenceFeet,
  type LoadStopInput,
} from './loadList';
import type { StopOrderItem } from './stopLoad';

const SELF = join(process.cwd(), 'packages/cultivar-os/src/lib/loadList.ts');
const src = readFileSync(SELF, 'utf8');

/**
 * The source with comments removed. 🔴 EVERY "this must NOT appear" CHECK RUNS AGAINST THIS, NOT
 * AGAINST `src` — and this file earned that the hard way within an hour of the rulings landing.
 *
 * The [[R-155]] probes went RED against correct code, because the ruling's own explanation names
 * the very strings it forbids (*"there is no `mixRatioCosting` and no `mixRatioLoading`"*,
 * *"`tradeGallonFactor` is a DIFFERENT fact"*). The probe was reading its subject's PROSE as its
 * subject — **tech-debt #146**, and the sibling `loadListPage.test.ts` carries the identical scar
 * from the identical cause. **Documenting a defect is a reliable way to commit it.**
 *
 * ⚠️ Deliberately crude: block and line comments and nothing else. Not a parser, and never used
 * for a POSITIVE assertion, where a false negative would silently pass.
 * ⚠️ **ELEVENTH COPY OF THIS FIVE-LINE IDIOM IN THE REPO** — five test files and five `scripts/`
 * caps carry their own. Matching the sibling in this directory rather than minting an eleventh
 * shape; the class is filed as **tech-debt #302** (§6 r8), not fixed inside a rulings pass.
 */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/** One line as the stop read returns it. Unanchored unless a lot is given. */
const line = (quantity: number, description: string | null, sku: string | null = null,
              lot?: { name: string; size: string | null }): StopOrderItem => ({
  order_id: 'o1', quantity, description, sku,
  business_inventory_id: lot ? 'lot-1' : null,
  business_inventory: lot ? { name: lot.name, size: lot.size } : null,
});

const stop = (stopId: string, customerName: string, items: StopOrderItem[],
              over: Partial<LoadStopInput> = {}): LoadStopInput => ({
  stopId, customerName, address: '1 Somewhere', serviceType: 'planting',
  orderId: 'o1', canReadLines: true, linesRead: true, items, ...over,
});

// ══ §A THE BILL OF MATERIALS IS DAVID'S, AND TWO RULINGS HAVE CORRECTED IT ════════
{
  // A1 — 🔴 [[R-155]]: ONE mix ratio, and it is 1.0. *"1 gal of mix per 1 gal of container. One
  // ratio, not two — for loading AND for costing."* If this ever silently becomes 0.7, every load
  // is short and every install cost is understated by ~30%.
  ok(BOM_RULES.mixContainerVolumesPerTree === 1.0,
    '🔴 A1: the mix ratio is 1.0 container volumes per tree, for loading AND costing ([[R-155]])');

  // A1b (negative) — 🔴 THE RULING REMOVES A KEY RATHER THAN ADDING ONE. The live proposal was to
  // split this into `mixRatioCosting` and `mixRatioLoading`; David: *"One key or none."* Asserted
  // over the SOURCE because the regression is a SHAPE — a second ratio — not a wrong number, and
  // two representations of one fact drift apart silently (STD-011).
  ok(!/mixRatioCosting|mixRatioLoading/.test(code),
    '🔴 A1b (negative): there is NO costing/loading ratio split — one key or none ([[R-155]])');

  // A1c (negative) — 🔴 AND THE OTHER 0.7 IS A DIFFERENT FACT. `tradeGallonFactor = 0.7` is trade
  // gallons vs true gallons, a statement about the POT, owned by the uppot production model. The
  // BOM does not touch it, and merging the two 0.7s would put a pot measurement in a recipe.
  ok(!/tradeGallonFactor/.test(code),
    '🔴 A1c (negative): the BOM never reads tradeGallonFactor — it is a pot fact, not a mix ratio');

  // A1d — 🔴 THE REACH CONTROL, and it is not decoration: A1b and A1c BOTH failed against `src`
  // because the ruling's own explanation names the strings it forbids. Without this probe, a
  // stripper that silently stopped working would turn A1b/A1c green on a file that had the split
  // back in it (tech-debt #182 — a check that cannot reach its target reports the same as a pass).
  ok(/mixRatioCosting/.test(src) && !/mixRatioCosting/.test(code)
     && /tradeGallonFactor/.test(src) && !/tradeGallonFactor/.test(code),
    '🔴 A1d: the comment stripper is REACHING — both forbidden names are in the prose and NOT in the code');

  // A2 (negative) — the cost model's mulch line is materials that are never bought. Lauren states
  // mulch is not used. Asserted over the SOURCE so nobody can add one back quietly.
  ok(!/\bmulch\s*[:=]/i.test(src) && !/mulchPerTree|mulchYards|mulchBags/i.test(src),
    '🔴 A2 (negative): there is NO mulch quantity anywhere in the model (tech-debt #299)');
  ok(/no mulch/i.test(LOAD_LIST_COPY.noMulch),
    'A3: the page says so out loud rather than merely omitting it');

  // A4–A7 — 🔴 THE T-POST RULE IS COMPUTED, NOT LOOKED UP. David's correction, 2026-09-12: a table
  // of five rows is exactly why the 200 gallon Live Oak fell off the end. `tPostsFor` is now TOTAL
  // over every readable container size, and the probes below say so in both directions.
  ok(tPostsFor(15) === 2 && tPostsFor(30) === 2 && tPostsFor(45) === 2 && tPostsFor(65) === 2,
    'A4: 2 T-posts per tree UP TO AND INCLUDING 65 gallon');
  ok(tPostsFor(95) === 4 && tPostsFor(200) === 4 && tPostsFor(300) === 4 && tPostsFor(1000) === 4,
    '🔴 A5: 4 per tree at 95 gallon AND ANYTHING LARGER — no upper bound');
  ok(tPostsFor(3) === 2 && tPostsFor(1) === 2 && tPostsFor(7) === 2,
    'A6: a small container is below the threshold and gets 2 — not a hand-work case either');
  // A7 — 🔴 THE PROPERTY THAT REPLACES THE TABLE. Every positive size answers, including sizes
  // nobody has ever sold. A lookup cannot satisfy this; only a rule can.
  const everySize = Array.from({ length: 400 }, (_, i) => i + 1);
  ok(everySize.every(g => tPostsFor(g) === 2 || tPostsFor(g) === 4),
    '🔴 A7: EVERY container size from 1 to 400 gallon resolves to 2 or 4 — no gap, no null, no hand-work');
  ok(everySize.filter(g => tPostsFor(g) === 2).length === 65,
    '🔴 A7b: and the boundary is exactly at 65 — 65 sizes take 2, the rest take 4');
  // A7c — the 66–94 band is an INFERENCE from David's two anchors, recorded as one, and it errs
  // LARGE on his own instruction for this build rather than short.
  ok(tPostsFor(66) === 4 && tPostsFor(94) === 4,
    'A7c: the 66–94 band David did not name reads 4 — err large, and it is recorded as an inference');

  // A7d (negative) — 🔴 the table must not come back. Asserted over the SOURCE, because the
  // regression is not a wrong number, it is a shape: five rows and a hole after the fifth.
  ok(!/tPostsByGallons/.test(src) && !/\{\s*15:\s*2,\s*30:\s*2/.test(src),
    '🔴 A7d (negative): there is NO size→posts lookup table anywhere in the model');

  ok(BOM_RULES.ropeFeetPerTPost === 4, 'A8: 4 ft of rope per T-post');
  ok(BOM_RULES.bubblersPerTree === 1, 'A9: one bubbler per tree');
  ok(BOM_RULES.deerFenceTPostsPerTree === 4, 'A10: a fenced tree needs 4 T-posts in total');

  // A11 — the yard conversion. A wrong constant here is invisible on the page and wrong on the
  // trailer, so it is pinned to the definition (46,656 in³ / 231 in³) rather than a typed decimal.
  ok(Math.abs(GALLONS_PER_CUBIC_YARD - 201.974025974) < 1e-6,
    'A11: 201.974 US gallons per cubic yard, from the cubic-inch definition');
}

// ══ §H THE RING IS A TOTAL FUNCTION ([[R-156]]) ════════════════════════════════════
// 🔴 THE SAME DEFECT SHAPE AS THE T-POST TABLE, ONE QUANTITY OVER. A lookup that stops at 95
// returns nothing for a 200 gallon tree, and *nothing printed beside a quantity heading reads as
// zero* — the yard person loads no fence and the page never said it could not work one out. So
// every probe below is about TOTALITY first and the anchors second.
{
  // H1 — exact at both anchors, by construction rather than by rounding luck.
  ok(Math.abs(ringDiameterFeet(15) - 5) < 1e-9,
    '🔴 H1: 15 gallon → 5 ft, David’s first anchor, exactly');
  ok(Math.abs(ringDiameterFeet(95) - 12) < 1e-9,
    '🔴 H1b: 95 gallon → 12 ft, David’s second anchor, exactly');

  // H2 — 🔴 THE PROPERTY THAT REPLACES A TABLE. Every size answers with a finite positive number,
  // including sizes nobody has ever sold. A lookup cannot satisfy this; only a rule can.
  const everySize = Array.from({ length: 500 }, (_, i) => i + 1);
  ok(everySize.every(g => Number.isFinite(ringDiameterFeet(g)) && ringDiameterFeet(g) > 0),
    '🔴 H2: EVERY container size from 1 to 500 gallon resolves to a real diameter — no gap, no null');

  // H2b — the 2026-08-29 Live Oak specifically. This is the tree the T-post table dropped, and it
  // is named here so the ring can never repeat that failure quietly.
  ok(Number.isFinite(ringDiameterFeet(200)) && ringDiameterFeet(200) > 12,
    '🔴 H2b: the 200 gallon Live Oak gets a ring bigger than the 95 gallon anchor — it does not fall off the end');

  // H3 — monotonic. A bigger container never gets a smaller ring, at any size.
  ok(everySize.slice(1).every((g, i) => ringDiameterFeet(g) > ringDiameterFeet(everySize[i])),
    'H3: the diameter strictly increases with gallons across the whole range');

  // H4 — it is √-shaped, not linear. Doubling gallons must NOT double the ring; the whole reason
  // David gave a square root is that a linear rule over-orders fence badly at the big end.
  const d45 = ringDiameterFeet(45), d90 = ringDiameterFeet(90);
  ok(d90 < d45 * 2 - 1,
    '🔴 H4: doubling the container does NOT double the ring — the rule is square-root, not linear');

  // H5 (negative) — no table. Asserted over the SOURCE, because the regression is a shape.
  ok(!/ringByGallons|RING_TABLE/.test(src) && !/\{\s*15:\s*5,\s*95:\s*12/.test(src),
    '🔴 H5 (negative): there is NO size→diameter lookup table anywhere in the model');

  // H6 — the anchors are PARAMETERS, not answers: the fit is derived from RING_ANCHORS, so moving
  // an anchor moves the curve. Proven by reading the anchors back and re-deriving both endpoints.
  ok(RING_ANCHORS.length === 2
     && RING_ANCHORS.every(a => Math.abs(ringDiameterFeet(a.gallons) - a.diameterFeet) < 1e-9),
    '🔴 H6: the curve is FITTED THROUGH the declared anchors — change an anchor and it moves');

  // H7 — fence is the circumference of the ring. David: *"by the roll, measured as the
  // circumference of the ring."* π·d, not 2πd and not the diameter.
  ok(Math.abs(ringCircumferenceFeet(15) - Math.PI * 5) < 1e-9,
    'H7: deer fence per tree is the ring CIRCUMFERENCE — π × diameter');

  // H8 — the page carries the rule in words as well as the number (D-9: a bare figure on a
  // printout cannot be questioned by the person holding it).
  ok(/square root/i.test(LOAD_LIST_COPY.ringRule) && /15 gallon/.test(LOAD_LIST_COPY.ringRule),
    'H8: the printed ring rule states the shape and both anchors');

  // H9 — 🔴 a tree row CARRIES its ring, so the page never re-derives one (the D4 rule).
  const day = buildLoadList('2026-08-29', [stop('s1', 'A', [line(1, 'Live Oak - 200 Gallon')])]);
  ok(day.trees.length === 1
     && Math.abs(day.trees[0].ringDiameterFeet - ringDiameterFeet(200)) < 1e-9
     && Math.abs(day.trees[0].fenceFeetPerTree - ringCircumferenceFeet(200)) < 1e-9,
    '🔴 H9: every tree row carries its own ring diameter and fence feet, computed once in the model');

  // H10 (negative) — 🔴 fence feet are NOT folded into any day total. Nothing in the data says
  // which trees are fenced (measured 2026-09-12: zero lines, zero stop notes across the tenant),
  // so a day total would be a number nobody can stand behind. Printing a per-tree figure for a
  // hand-add is honest; printing a day total is a fabricated quantity.
  ok(!Object.prototype.hasOwnProperty.call(day, 'fenceFeet')
     && !Object.prototype.hasOwnProperty.call(day, 'deerFenceFeet'),
    '🔴 H10 (negative): no day-level fence total — nothing records which trees are fenced');
}

// ══ §B RESOLVING ONE LINE — INCLUDING EVERY WAY IT CAN FAIL ════════════════════════
{
  const t = resolveLoadItem(line(1, 'Mexican Sycamore - 45 gallon', 'MS45'));
  ok(t.kind === 'tree' && t.gallons === 45 && t.name === 'Mexican Sycamore',
    'B1: a sized description resolves to a tree with its gallons and its own name');
  ok(t.sizeText === '45 gallon',
    'B2: the size is kept EXACTLY as written, never normalised (D-23 — the tag is what the yard person reads)');

  const comma = resolveLoadItem(line(2, 'Colorama Scarlet Crape Myrtle, 15 gallon', 'CSCM15'));
  ok(comma.kind === 'tree' && comma.gallons === 15 && comma.name === 'Colorama Scarlet Crape Myrtle',
    'B3: a COMMA separator reads the same as a dash — both are live in LAWNS’s books');

  const paren = resolveLoadItem(line(1, 'Live Oak - 200 gallon (Install & Warranty)', 'LO200'));
  ok(paren.kind === 'tree' && paren.gallons === 200,
    'B4: a trailing parenthetical remark is stripped before the size is read');

  const midParen = resolveLoadItem(line(1, 'Eagleston Holly (Tree Form) - 45 Gallon', 'EH45TF'));
  ok(midParen.kind === 'tree' && midParen.gallons === 45 && midParen.name === 'Eagleston Holly (Tree Form)',
    'B5: a parenthetical in the MIDDLE stays in the name — "(Tree Form)" is part of what is on the tag');

  // B6 (negative) — a fee. 🔴 The kind is `no_size_stated`, NOT `fee`: nothing stored classifies a
  // line (R-144 / tech-debt #139) and the model must not pretend otherwise.
  const fee = resolveLoadItem(line(1, 'Trip Charge', 'TC'));
  ok(fee.kind === 'no_size_stated' && fee.gallons === null,
    'B6 (negative): a line with no size is not a tree and earns no bill of materials');
  ok(!/fee/i.test(fee.kind), '🔴 B7 (negative): the model never asserts a line IS a fee — only that it states no size');

  // B8 (negative) — unreadable. The raw fragment survives onto the page.
  const bad = resolveLoadItem(line(1, 'Military Discount 5%', 'Military Discount'));
  ok(bad.kind === 'unresolved' && bad.unreadText === '5%',
    '🔴 B8 (negative): a size-shaped token the parser declines is UNRESOLVED and carries the text it tried');

  // B9 (negative) — nothing at all. The worst input, and it still produces a printable row.
  const empty = resolveLoadItem(line(1, null, null));
  ok(empty.kind === 'unresolved' && empty.quantity === 1 && empty.reason !== null,
    '🔴 B9 (negative): a line with no description and no sku is UNRESOLVED with a reason — never dropped');

  // B10 — non-gallon units load but take no BOM.
  const bag = resolveLoadItem(line(10, 'Gardenline Lawn & Garden 19-5-9 Fertilizer - 40 lb', 'R190'));
  ok(bag.kind === 'other_goods' && bag.gallons === null && /weight|lb/i.test(bag.reason ?? ''),
    'B10: a 40 lb bag is other goods — it loads, and it takes no stake, mix or bubbler');

  // B11 (negative) — 🔴 THE SKU IS NOT A SIZE SOURCE. `TSK2` is a T-POST COUNT and `MT10002` is a
  // catalogue code; a digit-scraping fallback turns a 1 lb ant killer into a 10,002-gallon tree.
  const tsk = resolveLoadItem(line(1, 'T-Post Stake Kit', 'TSK2'));
  ok(tsk.kind !== 'tree' && tsk.gallons === null,
    '🔴 B11 (negative): the SKU’s digits are NEVER read as a size — TSK2 is a post count, not a 2 gallon tree');
  const ant = resolveLoadItem(line(2, "Martin's Surrender Fire Ant Killer Insecticide - 1 lb", 'MT10002'));
  ok(ant.gallons === null,
    '🔴 B12 (negative): MT10002 does not become a 10,002 gallon container');

  // B13 — a range refuses rather than picking an end. The BOM would differ between them.
  const range = resolveLoadItem(line(1, 'Some Shrub - 10/15 gallon', 'X'));
  ok(range.kind === 'unresolved' && /range/i.test(range.reason ?? ''),
    '🔴 B13 (negative): a size RANGE is refused, not collapsed to either end');

  // B14 — the anchored lot wins, and its own `size` column is read.
  const anchored = resolveLoadItem(line(3, null, null, { name: 'Monterrey Oak', size: '30' }));
  ok(anchored.kind === 'tree' && anchored.gallons === 30 && anchored.name === 'Monterrey Oak',
    'B14: a checkout line resolves off its LOT — a bare trade number "30" is gallon-class');

  // B15 — the resolver is IMPORTED from shared, never re-implemented (R-27 / §6 r8). A second
  // size grammar in this file is how the vocabulary drifts.
  ok(/readProductFromDescription/.test(src) && /parseUnitOfMeasure/.test(src)
     && !/gal(?:lon)?s\?\\b/.test(src),
    '🔴 B15: size reading is imported from shared — this file owns NO unit vocabulary of its own');
}

// ══ §C NOTHING IS EVER SILENTLY OMITTED ════════════════════════════════════════════
{
  const m = buildLoadList('2026-09-01', [
    stop('s1', 'Has trees', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'No order',  [], { orderId: null }),
    stop('s3', 'Withheld',  [], { canReadLines: false }),
    stop('s4', 'Read failed', [], { linesRead: false }),
    stop('s5', 'Empty order', []),
  ]);

  ok(m.stopCount === 5 && m.stops.length === 5,
    '🔴 C1: EVERY stop appears — a six-stop day that prints five is silent and wrong');
  ok(m.stops[1].problem !== null && /no order/i.test(m.stops[1].problem!),
    'C2: a stop with no linked order says so on the page');
  ok(m.stops[2].problem !== null && /permission/i.test(m.stops[2].problem!),
    '🔴 C3: a withheld order says it is WITHHELD — never "no items", which would report a fact about the viewer as a fact about the business');
  ok(m.stops[3].problem !== null && /could not read/i.test(m.stops[3].problem!),
    '🔴 C4: a FAILED read is distinguishable from an EMPTY order (D-9 / A9)');
  ok(m.stops[4].problem !== null && /no items are recorded/i.test(m.stops[4].problem!),
    'C5: an order that genuinely has no lines says that instead');
  ok(m.unreadStops === 2,
    'C6: withheld and failed stops are COUNTED, so the header can warn the list may be short');

  // C7 (negative) — the two states must not collapse into one sentence.
  ok(m.stops[2].problem !== m.stops[4].problem,
    '🔴 C7 (negative): "withheld" and "no items" are DIFFERENT sentences');

  // C8 — an unresolved line reaches the top-level bucket, not just the stop.
  const u = buildLoadList('2026-09-01', [stop('s1', 'X', [line(1, null, null)])]);
  ok(u.unresolved.length === 1 && u.treeCount === 0,
    '🔴 C8: an unresolvable line is carried to the page as UNRESOLVED and counted in NO total');
  ok(/blank/i.test(LOAD_LIST_COPY.unresolvedWhy),
    'C9: the page states WHY those rows are printed — a blank cannot be told from a zero');

  // C10 — 🔴 AN UNREADABLE STOP RAISES THE FLOOR ON ITS OWN, with every line it CAN see perfectly
  // readable. Added because mutant C3b survived: dropping `unreadStops` from the floor condition
  // broke nothing, so a whole withheld order could print under totals claiming to be complete.
  const withheld = buildLoadList('2026-09-01', [
    stop('s1', 'Readable', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'Withheld', [], { canReadLines: false }),
  ]);
  ok(withheld.unresolved.length === 0,
    'C10a: nothing on this day is an unreadable LINE — the floor must come from the STOP alone');
  ok(withheld.totalsAreFloors === true,
    '🔴 C10b: a withheld STOP makes every total a FLOOR, even with zero unreadable lines');

  const failed = buildLoadList('2026-09-01', [
    stop('s1', 'Readable', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'Read failed', [], { linesRead: false }),
  ]);
  ok(failed.totalsAreFloors === true,
    '🔴 C10c: a FAILED read does the same — the two unreadable-stop states both raise it');

  // C10d (negative) — and a day where everything was read is NOT a floor, or the flag says nothing.
  const allRead = buildLoadList('2026-09-01', [stop('s1', 'X', [line(1, 'Live Oak - 45 gallon', 'LO45')])]);
  ok(allRead.totalsAreFloors === false,
    '🔴 C10d (negative): a fully-read day does NOT cry floor — a warning that always fires is ignored');
}

// ══ §D THE REAL SATURDAY 2026-08-29 LAWNS DELIVERY DAY ═════════════════════════════
// Six stops, fifteen order_items rows, read live 2026-09-12. Every description verbatim.
{
  const AUG29: LoadStopInput[] = [
    stop('57c31e32', 'Paul Christ', [
      line(1, 'Trip Charge', 'TC'),
      line(1, 'Mexican Sycamore - 45 gallon', 'MS45'),
    ]),
    stop('681c35dd', 'mark & vanessa Ashcraft', [
      line(1, 'Lacey Oak - 45 Gallon', 'LAO45'),
      line(1, 'Trip Charge', 'TC'),
    ]),
    stop('df0fd6d1', 'Andrea & Angel Navarrette', [
      line(1, 'Joan Lionetti Texas Live Oak - 45 Gallon', 'JLTL045'),
      line(1, 'Eagleston Holly (Tree Form) - 45 Gallon', 'EH45TF'),
      line(1, 'Trip Charge', 'TC'),
    ]),
    stop('ccf2c0e7', 'Humberto Garza', [
      line(2, 'Colorama Scarlet Crape Myrtle, 15 gallon', 'CSCM15'),
      line(1, 'Little Gem Magnolia - 15 gallon', 'LGM15'),
      line(2, 'Eagleston Holly (Tree Form) - 15 gallon', 'EH15TF'),
    ]),
    stop('2d4f50b4', 'Sherry Cooper', [
      line(1, 'Trip Charge', 'TC'),
      line(1, 'Live Oak - 200 gallon (Install & Warranty)', 'LO200'),
    ]),
    stop('55935667', 'Leroy & Lila Ludemann', [
      line(1, 'Trip Charge', 'TC'),
      line(1, 'Military Discount 5%', 'Military Discount'),
      line(1, 'Live Oak - 15 gallon (Install & Warranty)', 'LO15'),
    ]),
  ];
  const d = buildLoadList('2026-08-29', AUG29);

  ok(d.stopCount === 6, 'D1: six stops, as the database holds them');

  // D2 — eleven trees: four at 45, six at 15, one at 200.
  ok(d.treeCount === 11, `D2: ELEVEN trees on the day (got ${d.treeCount})`);
  const at = (g: number) => d.trees.filter(t => t.gallons === g).reduce((n, t) => n + t.quantity, 0);
  ok(at(45) === 4, `D3: four 45 gallon trees (got ${at(45)})`);
  ok(at(15) === 6, `D4: six 15 gallon trees (got ${at(15)})`);
  ok(at(200) === 1, `D5: one 200 gallon Live Oak (got ${at(200)})`);

  // D6 — special mix. 4×45 + 6×15 + 1×200 = 470 gallons → 2.33 yards → 2½ rounded UP. The 200
  // gallon contributes its FULL container volume: the mix rule is the container at every size.
  ok(d.mixGallons === 470, `D6: 470 gallons of special mix (got ${d.mixGallons})`);
  ok(d.mixYards === 2.5, `🔴 D7: 2½ yards — rounded UP to the next half yard, err large (got ${d.mixYards})`);

  // D8 — T-posts: ten trees at or below 65 gal × 2 = 20, PLUS the 200 gallon Live Oak at 4 = 24.
  // 🔴 Under the old five-row table this read 20 and the biggest tree on the trailer contributed
  // nothing. That is the whole reason the rule was rewritten as a computation.
  ok(d.tPosts === 24, `🔴 D8: TWENTY-FOUR T-posts — 10 small trees × 2, plus the 200 gallon at 4 (got ${d.tPosts})`);
  const bigOak = d.trees.find(t => t.gallons === 200)!;
  ok(bigOak.tPosts === 4,
    `🔴 D9: the 200 gallon Live Oak carries FOUR T-posts, not a hand-work note (got ${bigOak.tPosts})`);
  ok(d.trees.every(t => typeof t.tPosts === 'number'),
    'D9b: every tree on the day carries a computed post count — none is left for a person to work out');

  ok(d.ropeFeet === 96, `🔴 D11: NINETY-SIX feet of rope (24 posts × 4 ft) (got ${d.ropeFeet})`);
  ok(bigOak.gallons * bigOak.quantity === 200 && bigOak.tPosts * BOM_RULES.ropeFeetPerTPost === 16,
    'D11b: the 200 gallon alone is ~200 gallons of mix and 16 ft of rope, per David’s worked example');
  ok(d.bubblers === 11, `D12: eleven bubblers, one per tree (got ${d.bubblers})`);

  // D10 — 🔴 THE FLOORS FLAG NO LONGER FIRES ON A TREE SIZE, BECAUSE THAT STATE IS GONE. It now
  // fires on the one line of this day nobody could read. Different claim, still true, still printed.
  ok(d.totalsAreFloors === true,
    'D10: the day still declares a floor — but on account of the ONE unreadable line, not the 200 gallon');
  const clean = buildLoadList('2026-09-01', [stop('s1', 'X', [line(1, 'Live Oak - 200 gallon', 'LO200')])]);
  ok(clean.totalsAreFloors === false && clean.tPosts === 4 && clean.ropeFeet === 16 && clean.mixGallons === 200,
    '🔴 D10b: a day of nothing but a 200 gallon tree is NOT a floor — 4 posts, 16 ft, 200 gal, fully computed');

  // D13 — the five Trip Charges and the discount are listed, never counted, never filtered away.
  ok(d.noSizeStated.filter(i => i.sku === 'TC').length === 5,
    'D13: all five Trip Charge lines are listed under "no container size" — shown, not filtered (R-144)');
  ok(d.unresolved.length === 1 && d.unresolved[0].unreadText === '5%',
    '🔴 D14: the Military Discount 5% line is the day’s ONE unresolved row, and it prints the text it could not read');

  // D15 — every one of the fifteen real lines is accounted for somewhere. This is the assertion
  // that makes the page trustworthy: the counts must sum to the input, or something was dropped.
  const accounted = d.stops.reduce((n, s) => n + s.items.length, 0);
  ok(accounted === 15, `🔴 D15: all FIFTEEN real order_items rows are on the page (got ${accounted})`);
  const bucketed = d.trees.length; // tree ROWS, not units
  ok(bucketed + d.otherGoods.length + d.noSizeStated.length + d.unresolved.length > 0 && bucketed === 9,
    `D16: the eleven trees consolidate to nine distinct name+size rows (got ${bucketed})`);

  // D17 — biggest first.
  ok(d.trees[0].gallons === 200, 'D17: the consolidated list is ordered biggest tree first');

  // D18 (negative) — nothing on this day is mistaken for a tree.
  ok(!d.trees.some(t => /trip charge|discount/i.test(t.name)),
    '🔴 D18 (negative): no fee or discount line ever becomes a tree');

  // D19 — per-stop breakdown is what you need when a stop gets dropped, so each stop carries its
  // OWN totals rather than only a share of the day's.
  const garza = d.stops.find(s => s.customerName === 'Humberto Garza')!;
  ok(garza.treeCount === 5 && garza.mixGallons === 75 && garza.tPosts === 10,
    `D19: Garza’s stop stands alone — 5 trees, 75 gallons of mix, 10 posts (got ${garza.treeCount}/${garza.mixGallons}/${garza.tPosts})`);
  const cooper = d.stops.find(s => s.customerName === 'Sherry Cooper')!;
  ok(cooper.treeCount === 1 && cooper.tPosts === 4 && cooper.mixGallons === 200 && cooper.unresolvedCount === 0,
    `🔴 D20: Cooper’s 200 gallon stop is FULLY computed on its own — 4 posts, 200 gallons of mix, nothing owed to a person (got ${cooper.tPosts}/${cooper.mixGallons})`);
  const ludemann = d.stops.find(s => s.customerName === 'Leroy & Lila Ludemann')!;
  ok(ludemann.unresolvedCount === 1,
    'D20b: the unreadable line is attributed to the STOP it is on, not only to the day');
}

// ══ §E THE DEER FENCE GAP IS PRINTED, NOT HIDDEN ═══════════════════════════════════
{
  // E1 — measured 2026-09-12: zero order lines and zero stop notes across the whole LAWNS tenant
  // mention deer, fence, T-post or stake. Nothing can compute it, so the page says so and gives
  // the rule for a person to apply. David: generate the list, do not stop on the question.
  ok(/nothing recorded/i.test(LOAD_LIST_COPY.deerFenceGap),
    '🔴 E1: the page states that deer fence is NOT recorded — silence would read as "none needed"');
  ok(/4 T-posts in total/i.test(LOAD_LIST_COPY.deerFenceGap) && /2 MORE/.test(LOAD_LIST_COPY.deerFenceGap),
    'E2: the delta rule is printed so the yard person can apply it by hand');
  ok(/circumference/i.test(LOAD_LIST_COPY.deerFenceGap),
    'E3: fence material is by the roll, measured as the ring’s circumference');
  ok(/not settled/i.test(LOAD_LIST_COPY.deerFence95Open),
    '🔴 E4: the open 95 gallon question (4 more, or reuse the 4 it has?) is printed as OPEN, not answered by assumption');

  // E5 (negative) — no deer-fence quantity is ever added to a total. If a future edit starts
  // counting it, the model would be asserting data it does not have.
  const m = buildLoadList('2026-09-01', [stop('s1', 'X', [line(1, 'Live Oak - 45 gallon', 'LO45')])]);
  ok(m.tPosts === 2,
    '🔴 E5 (negative): a tree gets its plain 2 posts — no fence delta is ever silently added');
}

// ══ §F THE FILE STATES ITS OWN CONSTRAINTS ═════════════════════════════════════════
{
  ok(/AC-1/.test(src) && /NOT in `shared`/.test(src),
    'F1: the AC-1 reasoning for living in cultivar-os is recorded at the code');
  // ✏️ WAS "#290 and #291". Both renumbered (#299/#300 — they collided with `main`), and the mix
  // half is CLOSED by [[R-155]] rather than reconciled, so what must be cited now is the RULING
  // beside the mix rule and the still-open MULCH item beside the absent mulch row.
  ok(/R-155/.test(src) && /tech-debt #299/.test(src),
    'F2: the mix ruling and the still-open mulch item are both cited beside the rules they govern');
  ok(/R-144|tech-debt #139/.test(src),
    'F3: the "nothing stored classifies a line" ruling is cited where the kinds are defined');
}

// ══ §G CONSOLIDATION, AND THE REFUSAL THE DESCRIPTION PATH CANNOT REACH ════════════
// Added because three mutants SURVIVED the first green run (§6 r19b — a check nobody has seen
// refuse is a claim). Each probe below is the one that catches one of them.
{
  // G1 — MUTANT D1. Two separate lines of the same tree must become one row of ×2. A yard person
  // counting rows off the sheet loads what the rows say, so a failure to consolidate is a
  // miscount, not a cosmetic one.
  const two = buildLoadList('2026-09-01', [
    stop('s1', 'A', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'B', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
  ]);
  ok(two.trees.length === 1 && two.trees[0].quantity === 2,
    `🔴 G1: two lines of one tree consolidate to a single row of ×2 (got ${two.trees.length} row(s) × ${two.trees[0]?.quantity})`);
  ok(two.tPosts === 4 && two.mixGallons === 90,
    'G2: and the totals follow the consolidated quantity, not the row count');

  // G3 — MUTANT B6. The comparison key folds SPELLING; the displayed text does not. LAWNS's own
  // catalogue carries six spellings of three sizes (tech-debt #56), so this is live, not
  // hypothetical: "45 Gallon" and "45 gal" are one physical size on one trailer.
  const spelled = buildLoadList('2026-09-01', [
    stop('s1', 'A', [line(1, 'Live Oak - 45 Gallon', 'LO45')]),
    stop('s2', 'B', [line(1, 'Live Oak - 45 gal', 'LO45')]),
  ]);
  ok(spelled.trees.length === 1 && spelled.trees[0].quantity === 2,
    `🔴 G3: two SPELLINGS of one size consolidate — normalizeSize folds the KEY (got ${spelled.trees.length} rows)`);
  ok(spelled.trees[0].sizeText === '45 Gallon',
    'G4: and the row still displays the spelling its source used, never a rewritten one (D-23)');

  const cased = buildLoadList('2026-09-01', [
    stop('s1', 'A', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'B', [line(1, 'live oak - 45 gallon', 'LO45')]),
  ]);
  ok(cased.trees.length === 1,
    'G5: case differences in the NAME fold too — one tree, not two rows');

  // G6 — MUTANT B2. The refusal the description path cannot reach. `readProductFromDescription`
  // only reports `sized` when the parser already accepted, so a LOT is the only way a stored size
  // reaches `classify` unparsed. `3GP` is a real LAWNS trade code the parser deliberately refuses.
  const badLot = resolveLoadItem(line(1, null, 'X', { name: 'Some Tree', size: '3GP' }));
  ok(badLot.kind === 'unresolved' && badLot.unreadText === '3GP',
    `🔴 G6: a LOT whose stored size the parser refuses is UNRESOLVED, not "no size stated" (got ${badLot.kind})`);
  ok(badLot.kind !== 'no_size_stated',
    '🔴 G7 (negative): "we could not read the size it has" must never be reported as "it has no size"');

  // G8 — and a lot with genuinely no size is the OTHER answer. The two must stay apart.
  const noSizeLot = resolveLoadItem(line(1, null, 'X', { name: 'Some Tree', size: null }));
  ok(noSizeLot.kind === 'no_size_stated',
    'G8: a lot with no size at all states that, which is a different fact');
}

console.log(`\nloadList: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
