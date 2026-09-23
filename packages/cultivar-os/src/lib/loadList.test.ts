/**
 * ── loadList — the yard person's copy of the day ───────────────────────────────────
 *
 * 🔴 EVERY FIXTURE IN §D IS THE REAL SATURDAY 2026-08-29 LAWNS DELIVERY DAY, read out of the
 * live database on 2026-09-12 and RE-READ 2026-09-16 (six stops, fifteen `order_items` rows, every
 * one unanchored because all six orders are `order_kind='history'` from the QuickBooks ingest).
 * Nothing here is invented, which is the only reason the numbers below can be compared against
 * what actually went on the trailer.
 *
 * 🔴 AND THE LADDER IN THIS FILE IS LAWNS'S LIVE LADDER (ledger #343). Read 2026-09-16 after David
 * applied `20260914_container_ladder.sql` — nine rungs, labels, aliases and volumes verbatim — with
 * the T-posts from `20260916_container_ladder_install_t_posts.sql`'s backfill (David, 2026-09-12).
 *
 * ✏️ REWRITTEN 2026-09-16 (ledger #343) — WHAT CHANGED, AND WHY EACH ONE HAD TO:
 *   · A1 (was `BOM_RULES.mixContainerVolumesPerTree === 1.0`) → the ratio is now CONFIG and it is
 *     2.0. David, 2026-09-15: *"install mix is TWICE the container volume (30 gal → 60 gal). The
 *     earlier 1.0 was Lightning's figure, not LAWNS's."* A constant pinned in code is what made the
 *     wrong figure unchangeable without a build.
 *   · A4–A7d (was `tPostsFor`, a threshold at 65) → GONE. David, 2026-09-16: *"no size thresholds."*
 *     Posts are a column on the rung, and the probes now assert that the model READS the rung —
 *     including a rung edited to a number no threshold could produce.
 *   · A8–A10 (were `BOM_RULES` numbers) → Operations config, with a stored value overriding.
 *   · B13 (a range "is refused") → a range is now whatever the LADDER says. "10/15 gallon" is still
 *     refused — no rung claims both ends — but "#3/5" is ONE rung at LAWNS and now resolves.
 *   · B15 (size reading imported from shared) → tightened: this file no longer calls the unit
 *     parser at all. Every size goes through `resolveRung`.
 *   · ✏️ 2026-09-17 — DAVID'S FIVE CHANGES AFTER RUNNING CARD 19 LIVE. The sheet is an ALLOW-LIST:
 *     *"trees, T-posts, SPM (yards), deer fence if marked, trunk protection. That is the whole list."*
 *     So B6/B10/B10b/B12/D13 and the old `other_goods` / `no_size_stated` kinds are GONE — a known
 *     non-load line does not print anywhere, a line that might be loadable and could not be read is
 *     the ONE "could not work out" section, and Plant Your Tree is WORK on a stop, not a fee.
 *   · E4 (the 95 gallon deer-fence question "not settled") → settled by the rule's own wording,
 *     *"4 T-posts per tree IN TOTAL"*: a 95 gallon tree already has 4 and takes no more.
 *
 * PROBES BOTH DIRECTIONS (STD-022). The negatives matter more than usual — the whole point of the
 * page is that it refuses to print a blank where it could not compute.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/loadList.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOAD_LIST_COPY, RING_ANCHORS,
  buildLoadList, resolveLoadItem, ringDiameterFeet, ringCircumferenceFeet,
  type LoadStopInput, type LoadListSettings,
} from './loadList';
import type { StopOrderItem } from './stopLoad';
import type { Ladder, Rung } from '@trace/shared/inventory';
import {
  OPERATIONS_DEFAULTS, OPERATIONS_BASIS, GALLONS_PER_CUBIC_YARD, resolveConfig,
} from '@trace/shared/production';

const SELF = join(process.cwd(), 'packages/cultivar-os/src/lib/loadList.ts');
const src = readFileSync(SELF, 'utf8');

/**
 * The source with comments removed. 🔴 EVERY "this must NOT appear" CHECK RUNS AGAINST THIS, NOT
 * AGAINST `src` — the [[R-155]] probes once went RED against correct code because the ruling's own
 * explanation names the strings it forbids (tech-debt #146).
 * ⚠️ Deliberately crude, and never used for a POSITIVE assertion. The class of copies of this idiom
 * is tech-debt #302.
 */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── LAWNS's live ladder, 2026-09-16 ─────────────────────────────────────────────
const rung = (label: string, sortOrder: number, volumeGallons: number | null, posts: number,
              aliases: string[] = [], active = true): Rung => ({
  label, aliases, sortOrder, volumeGallons,
  handlingMinutes: null, handlingBecause: 'not timed — the yard-wide rate stands in',
  installTPostsPerTree: posts, installTPostsBecause: 'LAWNS, David 2026-09-12', caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set',
  installPrice: null, installPriceBecause: 'not set', active,
});
const LAWNS: Ladder = [
  rung('slip',    10, null, 0, ['slips', 'cutting', 'cuttings']),
  rung('4 in',    20, null, 0, ['4"', '4 inch', '4in']),
  rung('3/5 gal', 30, 4,    0, ['#3/5', '3/5 Gallon']),
  rung('15 gal',  40, 15,   2),
  rung('30 gal',  50, 30,   2),
  rung('45 gal',  60, 45,   2),
  rung('65 gal',  70, 65,   2),
  rung('95/100',  80, 95,   4, ['95 gal', '100 gal', '95 gallon', '100 gallon']),
  rung('200 gal', 90, 200,  4),
];
const SETTINGS: LoadListSettings = { ladder: LAWNS, ops: OPERATIONS_DEFAULTS };
const build = (date: string, stops: LoadStopInput[], s: LoadListSettings = SETTINGS) => buildLoadList(date, stops, s);
const res = (item: StopOrderItem, ladder: Ladder = LAWNS) => resolveLoadItem(item, ladder);

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
  orderId: 'o1', canReadLines: true, linesRead: true, items, deerFence: null, ...over,
});

// ══ §A THE RATIOS ARE CONFIGURATION, AND ONE OF THEM WAS WRONG ═════════════════════
{
  // A1 — 🔴 THE MIX RATIO IS 2.0, AND IT IS A CONFIG DEFAULT, NOT A CONSTANT. It was 1.0 in code;
  // David corrected the figure and ruled it must be configurable.
  ok(OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree === 2,
    '🔴 A1: the install mix ratio defaults to 2.0 container volumes per tree (David, 2026-09-15)');
  ok(/Lightning/.test(OPERATIONS_BASIS.installMixContainerVolumesPerTree.because)
     && /2026-09-15/.test(OPERATIONS_BASIS.installMixContainerVolumesPerTree.because),
    '🔴 A1a: its provenance says WHO and WHEN, and that the earlier 1.0 was Lightning’s');

  // A1b/A1c/A1d — the R-155 negatives, kept: one ratio (no costing/loading split), and the BOM never
  // reads the POT factor. A1d is the reach control that proves the stripper is working.
  ok(!/mixRatioCosting|mixRatioLoading/.test(code),
    '🔴 A1b (negative): there is NO costing/loading ratio split — one key or none ([[R-155]])');
  ok(!/tradeGallonFactor/.test(code),
    '🔴 A1c (negative): the BOM never reads tradeGallonFactor — it is a pot fact, not a mix ratio');
  ok(/mixRatioCosting/.test(src) && !/mixRatioCosting/.test(code)
     && /tradeGallonFactor/.test(src) && !/tradeGallonFactor/.test(code),
    '🔴 A1d: the comment stripper is REACHING — both forbidden names are in the prose and NOT in the code');

  // A2 — mulch, unchanged: Lauren states none is used.
  ok(!/\bmulch\s*[:=]/i.test(src) && !/mulchPerTree|mulchYards|mulchBags/i.test(src),
    '🔴 A2 (negative): there is NO mulch quantity anywhere in the model (tech-debt #299)');
  ok(/no mulch/i.test(LOAD_LIST_COPY.noMulch), 'A3: the page says so out loud rather than merely omitting it');

  // A4 — 🔴 NO NUMBER LIVES IN THE MODEL'S BOM ANY MORE. The constant object and the threshold
  // function are both gone; asserted over CODE because the regression is a shape.
  ok(!/BOM_RULES/.test(code), '🔴 A4 (negative): there is no BOM_RULES constant — the figures are configuration');
  ok(!/tPostsFor|Threshold/.test(code), '🔴 A5 (negative): there is no T-post threshold — posts are read off the rung');
  ok(!/<=\s*65|>\s*65|>=\s*95/.test(code), '🔴 A6 (negative): no size boundary appears in the code at all');

  // A7 — the four keys are Operations config and a stored value OVERRIDES each default.
  const stored = resolveConfig({ installMixContainerVolumesPerTree: 1.5, ropeFeetPerTPost: 5, bubblersPerTree: 2, deerFenceTPostsPerTree: 6 }, null, false).ops;
  ok(stored.installMixContainerVolumesPerTree === 1.5 && stored.ropeFeetPerTPost === 5
     && stored.bubblersPerTree === 2 && stored.deerFenceTPostsPerTree === 6,
    '🔴 A7: a STORED value overrides every one of the four defaults');
  // A8 — 🔴 A MISSING OR UNUSABLE STORED KEY READS ITS DEFAULT. A spread let `null` through.
  const broken = resolveConfig({ installMixContainerVolumesPerTree: null as unknown as number, ropeFeetPerTPost: 'abc' as unknown as number }, null, false).ops;
  ok(broken.installMixContainerVolumesPerTree === 2 && broken.ropeFeetPerTPost === 4,
    '🔴 A8: a stored null or non-number reads the default — never NaN on a printed load');
  ok(resolveConfig({}, null, false).ops.bubblersPerTree === 1 && resolveConfig(null, null, false).ops.deerFenceTPostsPerTree === 4,
    'A9: nothing stored at all reads every default (1 bubbler, 4 fence posts)');
  ok(resolveConfig({ coverMonthsOverride: null }, null, false).ops.coverMonthsOverride === null,
    'A9b (negative): a NULLABLE key still means something by being null — the guard is for numeric defaults only');

  // A10 — ONE cubic-yard definition. The model and the page both read the configured figure, and
  // the configured figure defaults to the definition.
  ok(Math.abs(GALLONS_PER_CUBIC_YARD - 46656 / 231) < 1e-12 && OPERATIONS_DEFAULTS.trueGallonsPerCubicYard === GALLONS_PER_CUBIC_YARD,
    '🔴 A10: 46,656 in³ ÷ 231 in³, defined ONCE — the Operations default IS that definition');
  ok(!/201\.97|46656/.test(code), '🔴 A11 (negative): the model types no conversion of its own');
}

// ══ §H THE RING IS A TOTAL FUNCTION ([[R-156]]) ════════════════════════════════════
{
  ok(Math.abs(ringDiameterFeet(15) - 5) < 1e-9, '🔴 H1: 15 gallon → 5 ft, David’s first anchor, exactly');
  ok(Math.abs(ringDiameterFeet(95) - 12) < 1e-9, '🔴 H1b: 95 gallon → 12 ft, David’s second anchor, exactly');
  const everySize = Array.from({ length: 500 }, (_, i) => i + 1);
  ok(everySize.every(g => Number.isFinite(ringDiameterFeet(g)) && ringDiameterFeet(g) > 0),
    '🔴 H2: EVERY container size from 1 to 500 gallon resolves to a real diameter — no gap, no null');
  ok(Number.isFinite(ringDiameterFeet(200)) && ringDiameterFeet(200) > 12,
    '🔴 H2b: the 200 gallon Live Oak gets a ring bigger than the 95 gallon anchor');
  ok(everySize.slice(1).every((g, i) => ringDiameterFeet(g) > ringDiameterFeet(everySize[i])),
    'H3: the diameter strictly increases with gallons across the whole range');
  const d45 = ringDiameterFeet(45), d90 = ringDiameterFeet(90);
  ok(d90 < d45 * 2 - 1, '🔴 H4: doubling the container does NOT double the ring — square-root, not linear');
  ok(!/ringByGallons|RING_TABLE/.test(src) && !/\{\s*15:\s*5,\s*95:\s*12/.test(src),
    '🔴 H5 (negative): there is NO size→diameter lookup table anywhere in the model');
  ok(RING_ANCHORS.length === 2
     && RING_ANCHORS.every(a => Math.abs(ringDiameterFeet(a.gallons) - a.diameterFeet) < 1e-9),
    '🔴 H6: the curve is FITTED THROUGH the declared anchors — change an anchor and it moves');
  ok(Math.abs(ringCircumferenceFeet(15) - Math.PI * 5) < 1e-9, 'H7: deer fence per tree is the ring CIRCUMFERENCE');
  ok(/square root/i.test(LOAD_LIST_COPY.ringRule) && /15 gallon/.test(LOAD_LIST_COPY.ringRule),
    'H8: the printed ring rule states the shape and both anchors');

  // H9 — a tree row carries its ring, computed from the RUNG's volume.
  const day = build('2026-08-29', [stop('s1', 'A', [line(1, 'Live Oak - 200 Gallon')])]);
  ok(day.trees.length === 1
     && Math.abs((day.trees[0].ringDiameterFeet ?? NaN) - ringDiameterFeet(200)) < 1e-9
     && Math.abs((day.trees[0].fenceFeetPerTree ?? NaN) - ringCircumferenceFeet(200)) < 1e-9,
    '🔴 H9: every tree row carries its own ring diameter and fence feet, from the rung volume');
  ok(!Object.prototype.hasOwnProperty.call(day, 'fenceFeet') && !Object.prototype.hasOwnProperty.call(day, 'deerFenceFeet'),
    '🔴 H10 (negative): no day-level fence FEET total — nothing records which trees are fenced');
  // H11 — a rung with NO volume has no ring figure, and says so rather than printing 0.
  const slip = build('2026-08-29', [stop('s1', 'A', [line(1, null, null, { name: 'Vitex', size: 'slip' })])]);
  ok(slip.trees.length === 1 && slip.trees[0].ringDiameterFeet === null && slip.trees[0].fenceFeetPerTree === null,
    '🔴 H11: a rung with no volume carries NO ring figure — null, never a 0 that reads as measured');
}

// ══ §B RESOLVING ONE LINE — THROUGH THE LADDER ════════════════════════════════════
{
  const t = res(line(1, 'Mexican Sycamore - 45 gallon', 'MS45'));
  ok(t.kind === 'tree' && t.gallons === 45 && t.name === 'Mexican Sycamore' && t.rung?.label === '45 gal',
    'B1: a sized description resolves to a TREE on its RUNG, carrying the rung’s volume');
  ok(t.sizeText === '45 gallon', 'B2: the size is kept EXACTLY as written, never normalised (D-23)');

  const comma = res(line(2, 'Colorama Scarlet Crape Myrtle, 15 gallon', 'CSCM15'));
  ok(comma.kind === 'tree' && comma.gallons === 15, 'B3: a COMMA separator reads the same as a dash');
  const paren = res(line(1, 'Live Oak - 200 gallon (Install & Warranty)', 'LO200'));
  ok(paren.kind === 'tree' && paren.rung?.label === '200 gal', 'B4: a trailing parenthetical is stripped first');
  const midParen = res(line(1, 'Eagleston Holly (Tree Form) - 45 Gallon', 'EH45TF'));
  ok(midParen.kind === 'tree' && midParen.name === 'Eagleston Holly (Tree Form)',
    'B5: a parenthetical in the MIDDLE stays in the name');

  // ✏️ B6/B7 REWRITTEN 2026-09-17: a KNOWN non-load line is `not_loaded` and never prints. It is
  // matched BY NAME (the description and SKU), which is a statement about what we recognise today —
  // see `NON_LOAD_LINES`. R-144's "show everything, labelled" no longer governs THIS page.
  const fee = res(line(1, 'Trip Charge', 'TC'));
  ok(fee.kind === 'not_loaded' && fee.gallons === null, 'B6: a Trip Charge is NOT LOADED and does not print');
  ok(/not one of the things this sheet carries|charge|fee|discount/i.test(fee.reason ?? ''),
    'B7: …and it carries the reason it was left off, for the trace and nothing else');

  // ✏️ B8's SUBJECT CHANGED 2026-09-17: "Military Discount 5%" is now a recognised discount and does
  // not print at all. The claim still needs a case, so it uses a line nobody recognises and nobody can
  // read — the dated Flat fee David kept in the refusal section.
  const bad = res(line(1, 'Flat fee - Applied on Aug 9, 2026', 'Late fee'));
  ok(bad.kind === 'unresolved' && bad.unreadText === '9, 2026',
    '🔴 B8 (negative): a size-shaped token nobody can read is UNRESOLVED and carries the text it tried');
  ok(res(line(1, 'Military Discount 5%', 'Military Discount')).kind === 'not_loaded',
    'B8b: …while a RECOGNISED discount does not print, however unreadable its trailing "5%"');
  const empty = res(line(1, null, null));
  ok(empty.kind === 'unresolved' && empty.quantity === 1 && empty.reason !== null,
    '🔴 B9 (negative): a line with no description and no sku is UNRESOLVED with a reason');

  // ✏️ B10/B10b, SECOND PASS 2026-09-17 — DAVID CORRECTED MY FIRST READING. I had goods printing
  // nowhere; he ruled: *"anything physical that a customer bought is loaded on the truck, so it
  // prints."* His original list named the INSTALL materials, not the whole sheet.
  const bag = res(line(10, 'Gardenline Lawn & Garden 19-5-9 Fertilizer - 40 lb', 'R190'));
  ok(bag.kind === 'other_goods' && bag.gallons === null && /rides the trailer/i.test(bag.reason ?? ''),
    '🔴 B10: a 40 lb bag is GOODS — it prints, and it takes no mix or posts');
  const fifteenLb = res(line(1, 'Some Compost - 15 lb', 'X'));
  ok(fifteenLb.kind === 'other_goods' && fifteenLb.rung === null,
    '🔴 B10b: a 15 POUND bag is goods, NOT a tree on the 15 GALLON rung — the kind is checked, not the number');

  const tsk = res(line(1, 'T-Post Stake Kit', 'TSK2'));
  ok(tsk.kind !== 'tree' && tsk.gallons === null, '🔴 B11 (negative): the SKU’s digits are NEVER read as a size');
  ok(tsk.kind === 'other_goods', 'B11b: a stake kit is a physical thing — it prints under "Also on the truck"');
  const ant = res(line(2, "Martin's Surrender Fire Ant Killer Insecticide - 1 lb", 'MT10002'));
  ok(ant.gallons === null, '🔴 B12 (negative): MT10002 does not become a 10,002 gallon container');

  // B13 — a range the ladder does not own is still refused; the reason names the ladder.
  const range = res(line(1, 'Some Shrub - 10/15 gallon', 'X'));
  ok(range.kind === 'unresolved' && /container sizes/i.test(range.reason ?? ''),
    '🔴 B13 (negative): "10/15 gallon" spans two rungs — refused, not collapsed, and the reason names the ladder');

  const anchored = res(line(3, null, null, { name: 'Monterrey Oak', size: '30' }));
  ok(anchored.kind === 'tree' && anchored.rung?.label === '30 gal' && anchored.name === 'Monterrey Oak',
    'B14: a checkout line resolves off its LOT — a bare "30" lands on the 30 gal rung');

  // B15 — 🔴 NO SIZE IS PARSED OUTSIDE THE RESOLVER (David, 2026-09-16).
  ok(/resolveRung/.test(code), '🔴 B15: every size goes through the ladder resolver');
  ok(!/parseUnitOfMeasure|normalizeSize|sameSizeLabel/.test(code),
    '🔴 B16 (negative): the model calls no unit parser and no size fold of its own');
  ok(!/gal(?:lon)?s\?\\b/.test(src), 'B17 (negative): and owns no unit vocabulary');
}

// ══ §L THE LADDER IS THE ONE SOURCE ═════════════════════════════════════════════════
{
  const hundred = res(line(1, 'Live Oak - 100 gal', 'LO100'));
  ok(hundred.kind === 'tree' && hundred.rung?.label === '95/100' && hundred.gallons === 95,
    '🔴 L1: "100 gal" lands on the 95/100 rung, with the rung’s volume — 95 and 100 are ONE container');

  const threeFive = res(line(1, null, null, { name: 'Cedar Elm', size: '#3/5' }));
  ok(threeFive.kind === 'tree' && threeFive.rung?.label === '3/5 gal' && threeFive.gallons === 4,
    '🔴 L2: "#3/5" is ONE rung (3/5 gal, 4 gallons) — no longer refused as a range');
  const threeFiveText = res(line(1, 'Cedar Elm - 3/5 Gallon', 'CE35'));
  ok(threeFiveText.kind === 'tree' && threeFiveText.rung?.label === '3/5 gal',
    '🔴 L2b: …and the live spelling "3/5 Gallon" in an invoice description lands on it too');
  const three = res(line(1, null, null, { name: 'Cedar Elm', size: '#3' }));
  ok(three.rung?.label === '3/5 gal', 'L2c: "#3" lands on the same rung');

  // L3 — 🔴 OFF THE LADDER: UNRESOLVED, NAMED, AND STILL COUNTED.
  const seven = res(line(2, 'Vitex - 7 gallon', 'VX7'));
  ok(seven.kind === 'unresolved' && seven.offLadder === true && seven.unreadText === '7 gallon',
    '🔴 L3: "7 gallon" is UNRESOLVED and marked off-ladder, with the text it could not place');
  ok(/not one of this nursery/i.test(seven.reason ?? '') && /Container sizes/.test(seven.reason ?? ''),
    'L3b: the reason says what to do — add the size in Settings → Container sizes');
  const withSeven = build('2026-09-01', [stop('s1', 'A', [line(1, 'Live Oak - 45 gallon', 'LO45'), line(2, 'Vitex - 7 gallon', 'VX7')])]);
  ok(withSeven.unresolved.length === 1 && withSeven.offLadderTreeCount === 2,
    '🔴 L3c: the off-ladder line is on the UNRESOLVED list and its 2 trees are COUNTED');
  ok(withSeven.treeCount === 3 && withSeven.bubblers === 0,
    '🔴 L3d: they are in the day’s tree count — and take no bubbler, because none is billed (David, 2026-09-18)');
  ok(withSeven.mixGallons === 90 && withSeven.tPosts === 2 && withSeven.totalsAreFloors === true,
    '🔴 L3e: their mix and posts cannot be known, so those totals are FLOORS and say so');
  ok(withSeven.stops[0].offLadderTreeCount === 2, 'L3f: the stop carries its own off-ladder count');

  // L4 — a rung with NO volume: the tree is counted, its mix is not, and it is named.
  const slipDay = build('2026-09-01', [stop('s1', 'A', [line(3, null, null, { name: 'Vitex', size: 'slip' })])]);
  ok(slipDay.treeCount === 3 && slipDay.mixGallons === 0 && slipDay.noVolumeTrees.length === 1 && slipDay.totalsAreFloors,
    '🔴 L4: a tree on a rung with no volume is counted, its mix is NOT invented, it is named, and mix is a floor');

  // L5 — a RETIRED rung still resolves on an old lot (R-133).
  const RETIRED: Ladder = [...LAWNS, rung('10 gal', 35, 10, 2, [], false)];
  const old = res(line(1, null, null, { name: 'Old Lot', size: '10 gal' }), RETIRED);
  ok(old.kind === 'tree' && old.rung?.label === '10 gal' && old.rung.active === false,
    '🔴 L5: a RETIRED rung still resolves on an old lot — retire never means delete');
  ok(res(line(1, null, null, { name: 'Old Lot', size: '10 gal' })).kind === 'unresolved',
    'L5b (negative control): without that row the same lot is off the ladder');

  // L6 — NO LADDER AT ALL: every container line is unresolved and says the sizes are not set up.
  const none = res(line(1, 'Live Oak - 45 gallon', 'LO45'), []);
  ok(none.kind === 'unresolved' && /no container sizes are set up/i.test(none.reason ?? ''),
    '🔴 L6: with no ladder, a 45 gallon line is UNRESOLVED and says the sizes are not set up — never a guess');
  ok(res(line(1, 'Fertilizer - 40 lb', 'X'), []).kind === 'other_goods',
    'L6b: goods print with or without a ladder — the ladder is for containers only');

  // L7b — 🔴 AN ALIAS THE PARSER CANNOT READ IS STILL A SIZE. "cuttings" is only the slip rung's
  // alias; nothing numeric can place it, so a resolver that skipped aliases would call it unreadable.
  const cuttings = res(line(4, null, null, { name: 'Vitex', size: 'cuttings' }));
  ok(cuttings.kind === 'tree' && cuttings.rung?.label === 'slip', '🔴 L7b: "cuttings" lands on the slip rung BY ALIAS');

  // L7 — ADDING A ROW MAKES A SIZE AVAILABLE. The same "7 gallon" line resolves once the rung exists.
  const WITH7: Ladder = [...LAWNS, rung('7 gal', 35, 7, 2)];
  const sevenNow = res(line(2, 'Vitex - 7 gallon', 'VX7'), WITH7);
  ok(sevenNow.kind === 'tree' && sevenNow.rung?.label === '7 gal',
    '🔴 L7: add a 7 gal row and the same line is a tree — no code, no migration (R-157)');
}

// ══ §P T-POSTS COME OFF THE RUNG ═══════════════════════════════════════════════════
{
  const posts = (desc: string, ladder: Ladder = LAWNS) =>
    build('2026-09-01', [stop('s1', 'A', [line(1, desc, 'X')])], { ladder, ops: OPERATIONS_DEFAULTS }).tPosts;
  ok(posts('Oak - 65 gallon') === 2, '🔴 P1: 65 gallon → 2 posts (the 65 gal rung)');
  ok(posts('Oak - 95 gallon') === 4 && posts('Oak - 100 gallon') === 4, '🔴 P2: 95/100 → 4 posts');
  ok(posts('Oak - 200 gallon') === 4, '🔴 P3: 200 gallon → 4 posts');
  ok(posts('Oak - 15 gallon') === 2, 'P4: 15 gallon → 2 posts');
  ok(posts('Oak - 3/5 Gallon') === 0, 'P5: a 3/5 rung set to 0 takes none');

  // P6 — 🔴 THE PROOF IT IS READ, NOT COMPUTED: edit a rung to 3 and the model says 3. No threshold
  // could ever produce 3.
  const EDITED: Ladder = LAWNS.map(r => r.label === '45 gal' ? { ...r, installTPostsPerTree: 3 } : r);
  ok(posts('Oak - 45 gallon', EDITED) === 3, '🔴 P6: a rung edited to 3 posts reads 3 — the number comes from the row');
  ok(posts('Oak - 45 gallon') === 2, 'P6b (negative control): the unedited ladder still says 2');
}

// ══ §M MIX, ROPE AND BUBBLERS COME OFF THE CONFIG ══════════════════════════════════
{
  const one30 = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 30 gallon', 'X')])]);
  ok(one30.mixGallons === 60, `🔴 M1: a 30 gallon tree takes 60 gallons of mix — rung volume × 2.0 (got ${one30.mixGallons})`);
  ok(one30.trees[0].mixGallonsPerTree === 60, 'M1b: the tree row carries its own per-tree mix');

  const OVERRIDE: LoadListSettings = {
    ladder: LAWNS,
    ops: { ...OPERATIONS_DEFAULTS, installMixContainerVolumesPerTree: 1.5, ropeFeetPerTPost: 5, bubblersPerTree: 2 },
  };
  const o = build('2026-09-01', [stop('s1', 'A', [line(2, 'Oak - 30 gallon', 'X')])], OVERRIDE);
  ok(o.mixGallons === 90, `🔴 M2: a STORED ratio overrides — 2 × 30 × 1.5 = 90 (got ${o.mixGallons})`);
  ok(o.ropeFeet === 20, `M3: rope = posts × the stored feet per post — 4 × 5 = 20 (got ${o.ropeFeet})`);
  // ✏️ M4 REWRITTEN 2026-09-18: `bubblersPerTree` multiplies the SPECIFIED trees, not every tree.
  const oB = build('2026-09-01', [stop('s1', 'A', [line(2, 'Oak - 30 gallon', 'X'), line(2, 'Tree Bubbler', 'TB')])], OVERRIDE);
  ok(oB.bubblers === 4, `M4: 2 bubblers specified × a stored 2 per specified tree = 4 (got ${oB.bubblers})`);
  ok(o.bubblers === 0, 'M4b: …and an order that specifies none gets none, whatever the multiplier');

  // M5 — the yard conversion is the CONFIGURED figure.
  const yards = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 200 gallon', 'X')])],
    { ladder: LAWNS, ops: { ...OPERATIONS_DEFAULTS, trueGallonsPerCubicYard: 100 } });
  ok(yards.mixYards === 4, `M5: 400 gallons ÷ a configured 100 per yard = 4 yards (got ${yards.mixYards})`);
}

// ══ §V THE PAGE STATES THE VALUES IT USED ══════════════════════════════════════════
{
  const d = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 45 gallon', 'X'), line(1, 'Oak - 200 gallon', 'Y')])]);
  const v = d.valuesUsed;
  ok(v.installMixContainerVolumesPerTree === 2 && v.ropeFeetPerTPost === 4 && v.bubblersPerTree === 1
     && v.deerFenceTPostsPerTree === 4 && v.gallonsPerCubicYard === GALLONS_PER_CUBIC_YARD,
    '🔴 V1: the model returns every ratio it used, so the page can print them');
  ok(v.rungs.map(r => r.label).join(',') === '200 gal,45 gal',
    'V2: and the rungs it used, biggest first — only the sizes actually on the day');
  ok(v.rungs[0].tPosts === 4 && v.rungs[0].volumeGallons === 200 && /LAWNS, David/.test(v.rungs[0].tPostsBecause),
    'V3: each with its volume, its posts and where the posts came from');
}

// ══ §C NOTHING IS EVER SILENTLY OMITTED ════════════════════════════════════════════
{
  const m = build('2026-09-01', [
    stop('s1', 'Has trees', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'No order',  [], { orderId: null }),
    stop('s3', 'Withheld',  [], { canReadLines: false }),
    stop('s4', 'Read failed', [], { linesRead: false }),
    stop('s5', 'Empty order', []),
  ]);
  ok(m.stopCount === 5 && m.stops.length === 5, '🔴 C1: EVERY stop appears');
  ok(m.stops[1].problem !== null && /no order/i.test(m.stops[1].problem!), 'C2: a stop with no linked order says so');
  ok(m.stops[2].problem !== null && /permission/i.test(m.stops[2].problem!), '🔴 C3: a withheld order says it is WITHHELD');
  ok(m.stops[3].problem !== null && /could not read/i.test(m.stops[3].problem!), '🔴 C4: a FAILED read is not an EMPTY order');
  ok(m.stops[4].problem !== null && /no items are recorded/i.test(m.stops[4].problem!), 'C5: an empty order says that');
  ok(m.unreadStops === 2, 'C6: withheld and failed stops are COUNTED');
  ok(m.stops[2].problem !== m.stops[4].problem, '🔴 C7 (negative): "withheld" and "no items" are DIFFERENT sentences');

  const u = build('2026-09-01', [stop('s1', 'X', [line(1, null, null)])]);
  ok(u.unresolved.length === 1 && u.treeCount === 0,
    '🔴 C8: an unreadable line is UNRESOLVED and — being unknown to be a tree — counted in no tree total');
  // ✏️ C9 REWORDED 2026-09-17: the section is now "might be loadable and could not be read", and the
  // sentence also says what is left off entirely, so a short sheet cannot be mistaken for a full one.
  ok(/could not read/i.test(LOAD_LIST_COPY.unresolvedWhy) && /left off entirely/i.test(LOAD_LIST_COPY.unresolvedWhy),
    'C9: the page states WHY those rows are printed AND that recognised non-load lines are left off');

  const withheld = build('2026-09-01', [
    stop('s1', 'Readable', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'Withheld', [], { canReadLines: false }),
  ]);
  ok(withheld.unresolved.length === 0 && withheld.totalsAreFloors === true,
    '🔴 C10: a withheld STOP makes every total a FLOOR, even with zero unreadable lines');
  const failedRead = build('2026-09-01', [
    stop('s1', 'Readable', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'Read failed', [], { linesRead: false }),
  ]);
  ok(failedRead.totalsAreFloors === true, '🔴 C10c: a FAILED read does the same');
  const allRead = build('2026-09-01', [stop('s1', 'X', [line(1, 'Live Oak - 45 gallon', 'LO45')])]);
  ok(allRead.totalsAreFloors === false, '🔴 C10d (negative): a fully-read day does NOT cry floor');
}

// ══ §D THE REAL SATURDAY 2026-08-29 LAWNS DELIVERY DAY ═════════════════════════════
{
  const AUG29: LoadStopInput[] = [
    stop('57c31e32', 'Paul Christ', [line(1, 'Trip Charge', 'TC'), line(1, 'Mexican Sycamore - 45 gallon', 'MS45')]),
    stop('681c35dd', 'mark & vanessa Ashcraft', [line(1, 'Lacey Oak - 45 Gallon', 'LAO45'), line(1, 'Trip Charge', 'TC')]),
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
    stop('2d4f50b4', 'Sherry Cooper', [line(1, 'Trip Charge', 'TC'), line(1, 'Live Oak - 200 gallon (Install & Warranty)', 'LO200')]),
    stop('55935667', 'Leroy & Lila Ludemann', [
      line(1, 'Trip Charge', 'TC'),
      line(1, 'Military Discount 5%', 'Military Discount'),
      line(1, 'Live Oak - 15 gallon (Install & Warranty)', 'LO15'),
    ]),
  ];
  const d = build('2026-08-29', AUG29);

  ok(d.stopCount === 6, 'D1: six stops, as the database holds them');
  ok(d.treeCount === 11, `D2: ELEVEN trees on the day (got ${d.treeCount})`);
  const at = (label: string) => d.trees.filter(t => t.rungLabel === label).reduce((n, t) => n + t.quantity, 0);
  ok(at('45 gal') === 4 && at('15 gal') === 6 && at('200 gal') === 1,
    `D3: four on the 45 rung, six on the 15, one on the 200 (got ${at('45 gal')}/${at('15 gal')}/${at('200 gal')})`);

  // D6 — 🔴 THE CORRECTION, IN NUMBERS. 4×45 + 6×15 + 1×200 = 470 container gallons; × 2.0 = 940
  // gallons of mix → 4.65 yards → FIVE rounded up. Under the 1.0 figure this page printed 2½.
  ok(d.mixGallons === 940, `🔴 D6: 940 gallons of special mix — 470 container gallons × 2 (got ${d.mixGallons})`);
  ok(d.mixYards === 5, `🔴 D7: FIVE yards, rounded UP to the next half yard (got ${d.mixYards}; was 2½ at 1.0)`);

  ok(d.tPosts === 24, `🔴 D8: twenty-four T-posts — 10 trees × 2 off their rungs, plus the 200 gallon’s 4 (got ${d.tPosts})`);
  const bigOak = d.trees.find(t => t.rungLabel === '200 gal')!;
  ok(bigOak.tPosts === 4, `🔴 D9: the 200 gallon Live Oak carries FOUR T-posts, read off its rung (got ${bigOak.tPosts})`);
  ok(d.ropeFeet === 96, `🔴 D11: ninety-six feet of rope (24 posts × 4 ft) (got ${d.ropeFeet})`);
  // ✏️ D12 REVERSED 2026-09-18 ON DAVID'S CORRECTION. It asserted one bubbler per tree; he ruled the
  // bubbler is manufactured and billed — *"not on every tree, only those specified"*. No stop on
  // 08-29 carries a Tree Bubbler line, so the day specifies NONE.
  ok(d.bubblers === 0, `🔴 D12: ZERO bubblers — none is specified on any of these orders (got ${d.bubblers})`);
  ok(/none specified/i.test(LOAD_LIST_COPY.bubblersNoneSpecified), 'D12b: and the page says so in words, never a bare 0');

  // ✏️ D10 FLIPPED 2026-09-17: the day's only "unreadable" line was the Military Discount, which is
  // now recognised and not printed. Nothing on 08-29 is unreadable, so the day is NOT a floor — which
  // is the honest answer and the one the flag exists to make meaningful.
  ok(d.totalsAreFloors === false,
    '🔴 D10: with the discount recognised, nothing on this day is unreadable — so it does NOT cry floor');
  ok(d.offLadderTreeCount === 0 && d.noVolumeTrees.length === 0, 'D10a: every tree on the day is on the ladder with a volume');
  const clean = build('2026-09-01', [stop('s1', 'X', [line(1, 'Live Oak - 200 gallon', 'LO200')])]);
  ok(clean.totalsAreFloors === false && clean.tPosts === 4 && clean.ropeFeet === 16 && clean.mixGallons === 400,
    '🔴 D10b: a day of one 200 gallon tree is NOT a floor — 4 posts, 16 ft, 400 gal of mix');

  // ✏️ D13 REVERSED 2026-09-17 ON DAVID'S INSTRUCTION. It asserted that all five Trip Charge lines
  // were LISTED (R-144, "show everything, labelled"). He ran the sheet and ruled the opposite for
  // THIS page: *"It is an ALLOW-LIST of what goes on the trailer, not a filter of fees."*
  ok(d.notLoaded.filter(i => i.sku === 'TC').length === 5 && !JSON.stringify(d.stops).includes('"kind":"no_size_stated"'),
    '🔴 D13: the five Trip Charge lines are NOT LOADED — counted for the trace, printed nowhere');
  ok(d.unresolved.length === 0 && d.notLoaded.filter(i => /discount/i.test(i.name)).length === 1,
    '🔴 D14: the Military Discount line is RECOGNISED and left off — the day has no unresolved lines at all');
  // ✏️ D14b CHANGED 2026-09-17 (David): the fence question is a RULE printed once at the top, not an
  // UNRESOLVED line per stop. The model still counts the stops (for the trace) and adds nothing to the
  // unresolved lines.
  ok(d.deerFenceUnknownStops === 6 && d.unresolved.length === 0,
    `🔴 D14b: six stops with trees record no fence — counted, and NOT added to the unresolved lines (got ${d.deerFenceUnknownStops}/${d.unresolved.length})`);

  const accounted = d.stops.reduce((n, s) => n + s.items.length, 0);
  ok(accounted === 15, `🔴 D15: all FIFTEEN real order_items rows are on the page (got ${accounted})`);
  ok(d.trees.length === 9, `D16: the eleven trees consolidate to nine distinct name+rung rows (got ${d.trees.length})`);
  ok(d.trees[0].rungLabel === '200 gal', 'D17: the consolidated list is ordered by LADDER position, biggest first');
  ok(!d.trees.some(t => /trip charge|discount/i.test(t.name)), '🔴 D18 (negative): no fee or discount line ever becomes a tree');

  const garza = d.stops.find(s => s.customerName === 'Humberto Garza')!;
  ok(garza.treeCount === 5 && garza.mixGallons === 150 && garza.tPosts === 10 && garza.mixYards === 1,
    `D19: Garza’s stop stands alone — 5 trees, 150 gallons (1 yd), 10 posts (got ${garza.treeCount}/${garza.mixGallons}/${garza.mixYards}/${garza.tPosts})`);
  const cooper = d.stops.find(s => s.customerName === 'Sherry Cooper')!;
  ok(cooper.treeCount === 1 && cooper.tPosts === 4 && cooper.mixGallons === 400 && cooper.unresolvedCount === 0,
    `🔴 D20: Cooper’s 200 gallon stop is FULLY computed — 4 posts, 400 gallons (got ${cooper.tPosts}/${cooper.mixGallons})`);
  const ludemann = d.stops.find(s => s.customerName === 'Leroy & Lila Ludemann')!;
  ok(ludemann.unresolvedCount === 0 && ludemann.items.filter(i => i.kind === 'not_loaded').length === 2,
    '✏️ D20b: that stop\'s Trip Charge and Military Discount are both recognised — nothing unresolved is attributed to it');
  const withBad = build('2026-08-29', [stop('x', 'X', [line(1, 'Oak - 15 gallon', 'A'), line(1, 'Flat fee - Applied on Aug 9, 2026', 'Late fee')])]);
  ok(withBad.stops[0].unresolvedCount === 1,
    'D20c: an unreadable line IS attributed to the stop it is on — the claim D20b used to carry');
}

// ══ §E DEER FENCE ═════════════════════════════════════════════════════════════════
{
  ok(/nothing recorded/i.test(LOAD_LIST_COPY.deerFenceGap),
    '🔴 E1: the page states that deer fence is NOT recorded — silence would read as "none needed"');
  ok(/in total/i.test(LOAD_LIST_COPY.deerFenceGap) && /circumference/i.test(LOAD_LIST_COPY.deerFenceGap),
    'E2: the in-total rule and the by-the-roll measure are both printed for the hand-add');

  // E3 — WHERE A STOP SPECIFIES FENCE, the tree is brought to 4 posts IN TOTAL.
  const fenced = build('2026-09-01', [stop('s1', 'A', [
    line(1, 'Oak - 45 gallon', 'X'),       // has 2 → needs 2 more
    line(1, 'Oak - 200 gallon', 'Y'),      // has 4 → needs none
    line(1, null, null, { name: 'Vitex', size: 'slip' }), // has 0 → needs 4
  ], { deerFence: true })]);
  ok(fenced.deerFencePosts === 6, `🔴 E3: fence posts bring each tree to 4 in total — 2 + 0 + 4 = 6 (got ${fenced.deerFencePosts})`);
  ok(fenced.tPosts === 6, `E3b: the staking posts are unchanged — 2 + 4 + 0 = 6 (got ${fenced.tPosts})`);
  ok(fenced.deerFenceUnknownStops === 0, 'E3c: a stop that states fence is not an unknown');
  const bigFenced = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 95 gallon', 'X')], { deerFence: true })]);
  ok(bigFenced.tPosts + bigFenced.deerFencePosts === 4,
    '🔴 E4: a fenced 95 gallon tree has 4 posts IN TOTAL — it takes no more (the rule’s own words settle it)');

  const noFence = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 45 gallon', 'X')], { deerFence: false })]);
  ok(noFence.deerFencePosts === 0 && noFence.deerFenceUnknownStops === 0, 'E5: a stop that says NO fence adds nothing and is not unknown');

  const unknown = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 45 gallon', 'X')])]);
  ok(unknown.deerFencePosts === 0 && unknown.deerFenceUnknownStops === 1 && unknown.tPosts === 2 && unknown.unresolved.length === 0,
    '🔴 E6: where the data cannot tell, NO fence post is invented, the stop is counted, and nothing is added to the unresolved lines');
  ok(unknown.stops[0].deerFence === 'unknown', 'E6b: the stop itself says its fence is unknown');
  const noTrees = build('2026-09-01', [stop('s1', 'A', [line(1, 'Trip Charge', 'TC')])]);
  ok(noTrees.deerFenceUnknownStops === 0, 'E7 (negative): a stop with no trees is not a fence question');

  const six = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 45 gallon', 'X')], { deerFence: true })],
    { ladder: LAWNS, ops: { ...OPERATIONS_DEFAULTS, deerFenceTPostsPerTree: 6 } });
  ok(six.deerFencePosts === 4, `E8: a stored fence figure is read — 6 in total, minus the 2 staked = 4 (got ${six.deerFencePosts})`);
}

// ══ §N THE ALLOW-LIST — DAVID, 2026-09-17, AFTER RUNNING CARD 19 LIVE ══════════════
// *"Trees, T-posts, SPM (yards), deer fence if marked, trunk protection. That is the whole list."*
{
  // N1 — what PRINTS. Trunk protection rides the trailer and is counted, per stop and per day.
  const tp = build('2026-09-01', [stop('s1', 'A', [
    line(1, 'Oak - 45 gallon', 'X'),
    line(2, 'Trunk Protection - Green Mesh', 'TP'),
    line(1, 'Trip Charge', 'TC'),
    line(1, 'Customer Discount', null),
  ])]);
  ok(tp.trunkProtection === 2, `🔴 N1: trunk protection is COUNTED — 2 (got ${tp.trunkProtection})`);
  ok(tp.stops[0].trunkProtection === 2, 'N1b: and the stop carries its own count, for when a stop is dropped');
  ok(tp.notLoaded.length === 2 && tp.unresolved.length === 0,
    '🔴 N2: the Trip Charge and the discount are NOT LOADED and NOT unresolved — they do not print at all');
  ok(!('noSizeStated' in tp),
    '🔴 N3 (negative): the "also on these orders" bucket is GONE — David: "too confusing"');
  ok('otherGoods' in tp,
    '✏️ N3b: …but GOODS have their own bucket ("Also on the truck") — David, second pass: anything physical prints');

  // N4 — every known non-load name, from the live LAWNS book (144 lines, 44 distinct non-tree rows).
  for (const [d, sku] of [['Trip Charge', 'TC'], ['Customer Discount', null],
                          ['15% Off - Tree Sale', 'Customer Discount'], ['FUEL Surcharge', null],
                          ['Morning Delivery', null], ['Tailgate Delivery', null],
                          ['CREDIT CARD FEE PLEASE ADD 3.5% IF PAYING WITH A CREDIT CARD', null],
                          ['Existing tree removal', 'TR'], ['Military Discount 5%', 'Military Discount']] as Array<[string, string | null]>) {
    ok(res(line(1, d, sku)).kind === 'not_loaded', `N4: "${d}" is not loaded`);
  }

  // N5 — 🔴 THE LINE DAVID KEPT. A dated "Flat fee" is NOT name-matched: we cannot read it, so it
  // prints in the one "could not work out" section. His two instructions disagreed here and this is
  // his own worked example for Saturday, which is the stronger signal (flagged in the report).
  ok(res(line(1, 'Flat fee - Applied on Aug 9, 2026', 'Late fee')).kind === 'unresolved',
    '🔴 N5: a dated "Flat fee" line stays UNRESOLVED and prints — we could not read it');

  // N6 — 🔴 A TREE WE CANNOT SIZE MUST NOT VANISH WITH THE FEES. The nine #301 lines read as
  // "no size stated" today; under the allow-list that MUST mean unresolved, not dropped.
  const nine = res(line(1, 'Cedar Elm - 30 gallon Install & Warranty', 'CE30'));
  ok(nine.kind === 'unresolved',
    '🔴 N6: a tree line whose size we cannot reach is UNRESOLVED — dropping it with the fees is the failure this page exists to prevent');
  ok(res(line(1, 'Blue Point Juniper (Replacement)', 'BPJ30REP')).kind === 'unresolved',
    'N6b: a replacement tree with no size is unresolved too');

  // N7 — deer fence as a LINE means the stop records it.
  const df = res(line(1, 'Deer Fencing', 'DF'));
  ok(df.kind === 'deer_fence', '🔴 N7: a Deer Fencing line is the stop SAYING it needs fence');
  const fenced = build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 45 gallon', 'X'), line(1, 'Deer Fencing', 'DF')])]);
  ok(fenced.stops[0].deerFence === 'yes' && fenced.deerFencePosts === 2,
    '🔴 N7b: …so the stop is fenced and the in-total arithmetic runs — 2 more posts on a 45 gal');
  ok(build('2026-09-01', [stop('s1', 'A', [line(1, 'Oak - 45 gallon', 'X')])]).stops[0].deerFence === 'unknown',
    'N7c (negative control): with no such line the stop is still unknown, and nothing is invented');
}

// ══ §O ANYTHING PHYSICAL PRINTS; MONEY LINES NEVER DO (David, 2026-09-17, second pass) ══
{
  const day = build('2026-09-01', [stop('s1', 'A', [
    line(1, 'Oak - 45 gallon', 'X'),
    line(10, 'Gardenline Lawn & Garden 19-5-9 Fertilizer - 40 lb', 'R190'),
    line(2, 'Osmocote Blend 21-4-8 (12-14M) - 50 lb', 'OS98615'),
    line(1, 'Trip Charge', 'TC'),
    line(1, 'Customer Discount', null),
  ])]);
  ok(day.otherGoods.length === 2 && day.otherGoods.reduce((n, i) => n + i.quantity, 0) === 12,
    `🔴 O1: both goods lines print, with their quantities (got ${day.otherGoods.length})`);
  // O1b — 🔴 A PHYSICAL THING WE CANNOT READ IS STILL "COULD NOT WORK OUT", NOT GOODS. Perlite is
  // sold by "4.4 cf" and the parser declines it, so the sheet says so rather than inventing a unit.
  // Measured: 2 live LAWNS lines. This is the honest half of "anything physical prints".
  const perlite = res(line(2, 'Hortiperl-G Coarse Perlite - 4.4 cf', 'TX412X'));
  ok(perlite.kind === 'unresolved' && perlite.unreadText === '4.4 cf',
    `🔴 O1b: a good whose unit we cannot read is UNRESOLVED and names the text it tried (got ${perlite.kind})`);
  ok(day.treeCount === 1 && day.mixGallons === 90 && day.tPosts === 2,
    '🔴 O2: and they are in NO tree, mix or post total — a bag is not a tree');
  ok(day.notLoaded.length === 2 && day.unresolved.length === 0,
    '🔴 O3: the charge and the discount are the only lines left off, and nothing is unresolved');
  ok(day.totalsAreFloors === false,
    '🔴 O4: goods do not make the day a floor — they are read, counted and printed');
  ok(/rides the trailer|Also on the truck/i.test(LOAD_LIST_COPY.alsoOnTruckWhy + LOAD_LIST_COPY.alsoOnTruckHeading),
    'O5: the section says what it is');
  ok(/not counted as trees/i.test(LOAD_LIST_COPY.alsoOnTruckWhy) && /not shown anywhere/i.test(LOAD_LIST_COPY.alsoOnTruckWhy),
    'O5b: …and that charges and fees appear nowhere on the sheet');

  // ✏️ O6 REVERSED 2026-09-18 — YESTERDAY'S EXCEPTION IS GONE. It kept the billed Tree Bubbler off the
  // sheet because bubblers were computed per tree. David corrected the model: the billed line IS the
  // number, so it prints and it is the count. **Tech-debt #326 dissolves with it.**
  ok(res(line(4, 'Tree Bubbler', 'TB')).kind === 'bubbler',
    '🔴 O6: a BILLED Tree Bubbler is the MARKER — it prints, and it carries the count');
  ok(res(line(1, 'Tree Tarp', null)).kind === 'other_goods',
    'O7: a Tree Tarp IS physical and prints — it was wrongly in the not-loaded list on the first pass');
}

// ══ §Q THE BUBBLER IS BILLED, AND THE WATER MONITOR IS PER INSTALLED TREE ══════════
// David, 2026-09-18: *"the bubbler is manufactured and added with a cost so not on every tree, only
// those specified"* · *"every tree LAWNS installs gets one [water monitor], and a customer can also
// buy them… a billed line adds to the count on top of the install rule"* · *"the load list prints a
// COUNT ONLY — never the parts, never the drilling."*
{
  // Q1 — the billed line is the count, and it is NOT the tree count.
  const day = build('2026-09-01', [stop('s1', 'A', [
    ...Array.from({ length: 9 }, () => line(1, 'Oak - 30 gallon', 'X')),
    line(3, 'Tree Bubbler', 'TB'),
  ])]);
  ok(day.treeCount === 9 && day.bubblers === 3,
    `🔴 Q1: nine trees, THREE bubblers — the billed line is the count (got ${day.treeCount}/${day.bubblers})`);
  ok(day.stops[0].bubblers === 3, 'Q1b: and the stop carries its own, for when a stop is dropped');
  ok(build('2026-09-01', [stop('s1', 'A', [line(9, 'Oak - 30 gallon', 'X')])]).bubblers === 0,
    '🔴 Q2: an order that specifies none gets NONE — this is the correction, and the old model printed nine');
  ok(/none specified on these orders/i.test(LOAD_LIST_COPY.bubblersNoneSpecified),
    'Q2b: and zero is printed in words, never as a bare 0');

  // Q3 — the line PRINTS now (yesterday's exception is gone).
  ok(res(line(3, 'Tree Bubbler', 'TB')).kind === 'bubbler' && res(line(3, 'Tree Bubbler', 'TB')).quantity === 3,
    '🔴 Q3: the billed bubbler line is its own kind, carrying its quantity — not a money line, not dropped');

  // Q4 — WATER MONITORS: one per tree LAWNS installs.
  const installed = build('2026-09-01', [
    stop('s1', 'Installs', [line(8, 'Oak - 30 gallon', 'X')], { installs: true }),
    stop('s2', 'Delivers', [line(5, 'Oak - 15 gallon', 'Y')]),
  ]);
  ok(installed.waterMonitors === 8 && installed.installTreeCount === 8,
    `🔴 Q4: eight installed trees → eight kits; the five delivered trees get none (got ${installed.waterMonitors})`);
  ok(installed.stops[0].waterMonitors === 8 && installed.stops[1].waterMonitors === 0,
    'Q4b: per stop, the same split');
  ok(installed.stops[0].installs === true && installed.stops[1].installs === false,
    'Q4c: the stop says which it is — an install, or not');

  // Q5 — a BILLED kit ADDS on top, including on a stop we do not install.
  const bought = build('2026-09-01', [
    stop('s1', 'Installs', [line(8, 'Oak - 30 gallon', 'X'), line(2, 'Augur Holes, and install water monitor pipe', null)], { installs: true }),
    stop('s2', 'Delivers', [line(5, 'Oak - 15 gallon', 'Y'), line(3, 'Augur Holes, and install water monitor pipe', null)]),
  ]);
  ok(bought.waterMonitors === 13,
    `🔴 Q5: 8 installed + 2 billed + 3 billed on a delivery stop = 13 (got ${bought.waterMonitors})`);
  ok(bought.stops[1].waterMonitors === 3,
    '🔴 Q5b: a customer planting their own trees can buy them — the delivery stop carries 3');

  // Q6 (negative) — 🔴 A COUNT ONLY. The manufacturing spec belongs to the item, not this sheet.
  ok(!/pvc|bamboo|drill/i.test(JSON.stringify(LOAD_LIST_COPY)),
    '🔴 Q6 (negative): the sheet never says PVC, bamboo or drilling — they are prebuilt and on the shelf');
  ok(!/pvcInches|bambooFeet/.test(code),
    '🔴 Q6b (negative): and the model holds no parts figures — that is the parked recipe work');
  ok(/prebuilt/i.test(LOAD_LIST_COPY.waterMonitorRule) && /install/i.test(LOAD_LIST_COPY.waterMonitorRule),
    'Q6c: the printed rule says where they come from and who gets them');
}

// ══ §W PLANT YOUR TREE IS WORK, NOT A FEE (David, 2026-09-17) ══════════════════════
// At Chris Dubec: *"8 trees plus 1 extra on site which is (PYT)"* — the crew plants NINE.
{
  const day = build('2026-09-01', [stop('s1', 'Chris Dubec', [
    ...Array.from({ length: 8 }, () => line(1, 'Eagleston Holly (Tree Form) - 15 gallon', 'EH15TF')),
    line(1, 'Plant Your Tree', 'PYT'),
    line(1, 'Trip Charge', 'TC'),
  ])]);
  ok(day.plantOnSite.length === 1 && day.stops[0].plantOnSite.length === 1,
    '🔴 W1: a Plant Your Tree line is WORK on the stop — carried, not dropped as a fee');
  ok(day.treeCount === 8,
    `🔴 W2: it is NOT added to the tree count — nobody loads it, its size is unknown (got ${day.treeCount})`);
  ok(day.mixGallons === 8 * 15 * 2 && day.tPosts === 16,
    'W3: and it adds no mix and no posts — they cannot be known without a size');
  ok(day.totalsAreFloors === true, '🔴 W4: the day is a FLOOR because of it — the crew plants nine, the sheet counts eight');
  ok(/size unknown/i.test(LOAD_LIST_COPY.plantOnSite) && /by hand/i.test(LOAD_LIST_COPY.plantOnSite),
    'W5: the printed sentence says the size is unknown and the mix and posts are added by hand');
  ok(res(line(1, 'Tree Installation', null)).kind === 'plant_on_site',
    'W6: the same shape by another name — a planting service line with no container size');
  ok(res(line(1, 'Live Oak - 45 gallon (Install & Warranty)', 'LO45')).kind === 'tree',
    '🔴 W7 (negative control): an "Install & Warranty" SUFFIX on a sized tree is still a TREE, not planting work');
}

// ══ §F THE FILE STATES ITS OWN CONSTRAINTS ═════════════════════════════════════════
{
  ok(/AC-1/.test(src) && /NOT in `shared`/.test(src), 'F1: the AC-1 reasoning for living in cultivar-os is recorded');
  ok(/R-155/.test(src) && /tech-debt #299/.test(src), 'F2: the mix ruling and the open mulch item are both cited');
  ok(/R-144|tech-debt #139/.test(src), 'F3: the "nothing stored classifies a line" ruling is cited');
}

// ══ §G CONSOLIDATION ══════════════════════════════════════════════════════════════
{
  const two = build('2026-09-01', [
    stop('s1', 'A', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'B', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
  ]);
  ok(two.trees.length === 1 && two.trees[0].quantity === 2, '🔴 G1: two lines of one tree consolidate to ×2');
  ok(two.tPosts === 4 && two.mixGallons === 180, 'G2: the totals follow the consolidated quantity');

  // G3 — the RUNG is the consolidation key now, not a text fold.
  const spelled = build('2026-09-01', [
    stop('s1', 'A', [line(1, 'Live Oak - 45 Gallon', 'LO45')]),
    stop('s2', 'B', [line(1, 'Live Oak - 45 gal', 'LO45')]),
  ]);
  ok(spelled.trees.length === 1 && spelled.trees[0].quantity === 2, '🔴 G3: two SPELLINGS of one rung consolidate');
  ok(spelled.trees[0].sizeText === '45 Gallon', 'G4: the row still displays a spelling its source used (D-23)');
  const bucket = build('2026-09-01', [
    stop('s1', 'A', [line(1, null, null, { name: 'Cedar Elm', size: '#3' })]),
    stop('s2', 'B', [line(1, null, null, { name: 'Cedar Elm', size: '5 gal' })]),
  ]);
  ok(bucket.trees.length === 1 && bucket.trees[0].quantity === 2,
    '🔴 G4b: "#3" and "5 gal" are ONE bucket at LAWNS and print as one row — no text fold could know that');
  const cased = build('2026-09-01', [
    stop('s1', 'A', [line(1, 'Live Oak - 45 gallon', 'LO45')]),
    stop('s2', 'B', [line(1, 'live oak - 45 gallon', 'LO45')]),
  ]);
  ok(cased.trees.length === 1, 'G5: case differences in the NAME fold too');

  const badLot = res(line(1, null, 'X', { name: 'Some Tree', size: '3GP' }));
  ok(badLot.kind === 'unresolved' && badLot.unreadText === '3GP', '🔴 G6: a LOT whose stored size nobody can read is UNRESOLVED');
  ok(badLot.kind !== 'not_loaded', '🔴 G7 (negative): "could not read" is never quietly dropped as a non-load line');
  const noSizeLot = res(line(1, null, 'X', { name: 'Some Tree', size: null }));
  ok(noSizeLot.kind === 'unresolved',
    '🔴 G8: a LOT with no size is UNRESOLVED — it is a real catalogue row and may well be a tree, so it prints');
}

// ══ §L THE TREES ARE ONE LINE (ledger #355) ═══════════════════════════════════════
{
  // ✏️ REVERSED 2026-09-20 (ledger #358, Lauren's answer): the roll-up is the PULL list, not a line.
  ok(LOAD_LIST_COPY.pullHeading(29, 8) === 'Trees to pull — 29 across 8 stops',
    '🔴 L1: the roll-up is headed as what it IS — the list the yard pulls against');
  ok(LOAD_LIST_COPY.pullHeading(1, 1) === 'Trees to pull — 1 across 1 stop', 'L2: …and singular reads as singular');
  ok(/tagged with the customer/i.test(LOAD_LIST_COPY.stopsWhy),
    '🔴 L2b: the stops say WHY they are there — the tag carries the customer\'s name, checked at staging');
  ok(LOAD_LIST_COPY.bulkHeading.startsWith('Bulk materials'), 'L3: page 1 is headed as the bulk');
}

console.log(`\nloadList: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
