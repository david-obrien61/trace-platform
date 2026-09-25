// ============================================================
// loadList — WHAT GOES ON THE TRAILER FOR ONE DELIVERY DAY, AS VALUES.
//
// PURPOSE:      Lauren hand-assembles the yard person's copy of the day from several printouts.
//               The route goes to the driver digitally; the LOAD goes on paper. This is the load
//               half: a consolidated bill of materials at the top (the yard person needs
//               "14 T-posts"), the per-stop breakdown underneath (what you need when a stop gets
//               dropped). A print view over data that already exists — no new capture surface.
//
//               🔴 THE PAGE MAY NEVER SILENTLY OMIT SOMETHING IT COULD NOT COMPUTE. David,
//               2026-09-12: *"Blank is indistinguishable from zero, and a yard person cannot tell
//               the difference between 'no T-posts needed' and 'we could not work it out.'"* So
//               every line resolves into exactly one of four KINDS and every one of them is
//               printed. `unresolved` is a first-class outcome with the raw text beside it, not a
//               filter. This is D-9 / A9 (absent is not empty) applied to a piece of paper.
//
// 🔴 ONE LOCATION, MANY READS (ledger #343 — David, 2026-09-16): *"Every size is read from the
//               ladder; each consumer applies its own math. No second list of sizes, no size
//               thresholds, no size parsed outside the resolver."* So this file holds NO numbers of
//               its own. The per-SIZE figures (volume, T-posts) are the RUNG's —
//               `container_ladder`, read by `containerLadderRead.ts`. The per-TREE figures (mix
//               ratio, rope, bubblers, deer-fence posts, gallons per yard) are the business's
//               Operations config. Both arrive as `LoadListSettings`; this file only multiplies.
//
// DEPENDENCIES: ./stopLoad (StopOrderItem — the SAME line shape the stop card reads, §6 r8) ·
//               @trace/shared/quickbooks/qboItemAdapter (readProductFromDescription — finds the
//               size-shaped fragment in an invoice sentence) · @trace/shared/inventory
//               (resolveRung — the ONE place a size is interpreted) · @trace/shared/production
//               (the OperationsConfig type). Otherwise PURE — no db, no clock, no DOM, no env.
// OUTPUTS:      LoadItemKind · ResolvedLoadItem · TreeTally · LoadStop · LoadListModel ·
//               LoadListSettings · LoadStopInput · RING_ANCHORS · ringDiameterFeet ·
//               ringCircumferenceFeet · LOAD_LIST_COPY · resolveLoadItem · buildLoadList.
//
// AC-1: this file lives in `cultivar-os`, NOT in `shared`, and deliberately. Its vocabulary —
//       tree, special mix, T-post, bubbler, deer fence — is a TREE FARM's bill of materials, and
//       putting it in `shared` would hardcode one vertical's operations into platform code. The
//       two things that ARE general (finding a size in a sentence, placing it on a ladder) are
//       imported FROM shared rather than re-implemented here (R-27).
// ============================================================

import { readProductFromDescription } from '@trace/shared/quickbooks/qboItemAdapter';
import { resolveRung, type Ladder, type Rung } from '@trace/shared/inventory';
import type { OperationsConfig } from '@trace/shared/production';
import type { StopOrderItem } from './stopLoad';
import { isNoteLine, isReplacementLine, replacementGallons } from './loadListChecks';

/**
 * 🔴 THE FIGURES THIS PAGE MULTIPLIES BY, AND WHERE EACH ONE LIVES.
 *
 * [[R-155]] — ONE MIX RATIO. ✏️ **AMENDED 2026-09-15/16: the ratio is 2.0, not 1.0.** David:
 * *"install mix is TWICE the container volume (30 gal → 60 gal). The earlier 1.0 was Lightning's
 * figure, not LAWNS's."* And it is CONFIGURATION now (`installMixContainerVolumesPerTree`), because
 * a figure pinned in code is exactly what made the wrong one unchangeable without a build.
 *   🔴 **STILL ONE RATIO — THERE IS NO COSTING RATIO AND NO LOADING RATIO. Do not re-split it.** The
 *     split was a live proposal — `mixRatioCosting` / `mixRatioLoading` — and the ruling removed a
 *     key rather than adding one. A second ratio would be two representations of one fact
 *     (STD-011), and the copy that drifts is always the one nobody loads against.
 *   🔴 **`OPERATIONS_DEFAULTS.tradeGallonFactor = 0.7` IS A DIFFERENT FACT.** It is trade gallons vs
 *     true gallons — a statement about the POT, used by the uppot production model. **The BOM does
 *     not touch it.** Anyone "unifying" the two is merging a pot measurement into a recipe.
 *
 * T-POSTS — the RUNG's `install_t_posts_per_tree`. There is no threshold here any more: *"2 up to
 * and including 65, 4 at 95 and above"* is now DATA on nine rows, and a grower who stakes a 45 with
 * three posts edits one row. Rope, bubblers and deer-fence posts are per-tree Operations keys.
 *
 * ⚠️ MULCH — absent, on Lauren's statement: mulch is NOT used, only the ingredients in the special
 * mix. There is no mulch row here and there must not be one. The mulch line in the 2026-09-11
 * install-cost figures was **Lightning's invention, not a LAWNS fact**; building that cost model is
 * tech-debt #299.
 */
export interface LoadListSettings {
  /** This tenant's container ladder — retired rungs INCLUDED (they still resolve, R-133). An EMPTY
   *  ladder is legal: every container line then prints as unresolved, "no sizes set up". */
  ladder: Ladder;
  ops: Pick<OperationsConfig,
    | 'installMixContainerVolumesPerTree' | 'ropeFeetPerTPost' | 'bubblersPerTree'
    | 'deerFenceTPostsPerTree' | 'trueGallonsPerCubicYard'>;
}

/**
 * 🔴 [[R-156]] — THE RING DIAMETER IS A TOTAL FUNCTION OF CONTAINER GALLONS, NEVER A TABLE.
 *
 * David, 2026-09-14: *"Ring diameter scales with the square root of container gallons, through
 * 15 gal → 5 ft and 95 gal → 12 ft. A total function, never a table — a lookup that stops at 95 is
 * what dropped the 200 gallon Live Oak on 2026-08-29, and rope is a quantity so a missing one reads
 * as zero."*
 *
 * ⚠️ **THAT LAST CLAUSE IS THE REASON THIS IS A FUNCTION AND NOT A LOOKUP, AND IT IS THE SAME
 * DEFECT `tPostsFor` ALREADY CARRIES A SCAR FROM.** A table answers only for the sizes somebody
 * thought to type. Every size nobody typed returns nothing, and **nothing printed beside a
 * quantity heading reads as zero** — the yard person loads no fence and nothing on the page said
 * it could not work one out. So the rule is total: a 200 gallon, a 300 gallon and a size nobody
 * has sold yet all resolve, and the ANCHORS are the parameters rather than the answers.
 *
 * 🔴 **WHY √ NEEDS TWO PARAMETERS AND NOT ONE, RECORDED BECAUSE IT IS A CHOICE.** The simplest
 * reading of *"scales with the square root"* is `d = k·√g`, and **no single k passes through both
 * anchors**: k from 15 gal gives 12.58 ft at 95 (the anchor says 12); k from 95 gal gives 4.77 ft
 * at 15 (the anchor says 5). David gave both anchors and said *through*, so the curve is fitted
 * THROUGH both — `d = a·√g + b` — which is exact at 15 and at 95 and √-shaped between and beyond.
 * ⚠️ **The two readings differ by up to ~6% away from the anchors** (at 200 gal: 17.2 ft here,
 * 18.3 ft for k-from-15, 17.4 ft for k-from-95). ✅ **PUT TO DAVID RATHER THAN ASSUMED, AND
 * CONFIRMED 2026-09-14: through BOTH anchors.** Recorded here because the three readings are
 * **exact at 15 and 95 alike**, so no owner-test on a size LAWNS actually sells can tell them
 * apart — the anchors are the only place the curve is pinned, and everything between and beyond
 * rests on that one word.
 */
export const RING_ANCHORS = [
  { gallons: 15, diameterFeet: 5 },
  { gallons: 95, diameterFeet: 12 },
] as const;

/** `a` and `b` in `d = a·√g + b`, DERIVED from the two anchors rather than typed. Change an anchor
 *  and the curve moves with it; there is no second place holding a stale coefficient. */
const RING_FIT = (() => {
  const [lo, hi] = RING_ANCHORS;
  const a = (hi.diameterFeet - lo.diameterFeet) / (Math.sqrt(hi.gallons) - Math.sqrt(lo.gallons));
  return { a, b: lo.diameterFeet - a * Math.sqrt(lo.gallons) };
})();

/**
 * Watering-ring diameter in feet for a tree in a container of this many gallons. **TOTAL — every
 * non-negative gallon figure gets a number, at every size, with no upper bound and no hand-work
 * case.** Exact at both anchors by construction.
 */
export function ringDiameterFeet(gallons: number): number {
  const g = gallons > 0 ? gallons : 0;
  return RING_FIT.a * Math.sqrt(g) + RING_FIT.b;
}

/** Feet around the ring — what deer fence is measured in, because it is bought by the roll.
 *  David, 2026-09-12: *"Fence material is by the roll, measured as the circumference of the ring."* */
export function ringCircumferenceFeet(gallons: number): number {
  return Math.PI * ringDiameterFeet(gallons);
}

/**
 * 🔴 THE SHEET IS AN ALLOW-LIST (David, 2026-09-17, after running the load list live).
 * *"Trees, T-posts, SPM (yards), deer fence if marked, trunk protection. That is the whole list. It is
 * an ALLOW-LIST of what goes on the trailer, not a filter of fees."*
 *
 * ⚠️ THIS SUPERSEDES [[R-144]] FOR THIS PAGE ONLY. R-144 says show every line and label none, BECAUSE
 * nothing stored classifies a line goods-vs-fee. That is still true of the DATA — so this file matches
 * on the line's own DESCRIPTION and SKU, which is a statement about what we RECOGNISE, never a claim
 * that the database knows. David: *"we will have these labeled in the future in our system"* — when a
 * per-item label exists, read it and delete `NON_LOAD_LINES`. R-144 still governs every other surface.
 *
 * ⚠️ THE MATCH LIST IS MEASURED, NOT IMAGINED: every name below appears in LAWNS's own 144 order lines
 * (44 distinct non-tree rows, read 2026-09-17). ✏️ It is NOT `service_offerings` — that table holds FOUR
 * rows for LAWNS (Trip Charge · Tree Bubbler · Tree Installation · Tree Tarp) and carries neither Trunk
 * Protection nor Deer Fencing, so it cannot answer this question today.
 */
export type LoadItemKind =
  /** Resolved to a RUNG on this nursery's ladder: a tree. The only kind that earns a bill of materials. */
  | 'tree'
  /** Trunk protection — on the list, so it prints with its quantity, per stop and per day. */
  | 'trunk_protection'
  /** 🔴 A BILLED BUBBLER — and it is the ONLY thing that says a tree gets one (David, 2026-09-18:
   *  *"the bubbler is manufactured and added with a cost so not on every tree, only those
   *  specified"*). The LINE carries the count; nothing says WHICH trees. */
  | 'bubbler'
  /** A billed water monitor kit — ON TOP of the one every installed tree gets. */
  | 'water_monitor'
  /** A deer-fence line: the stop SAYING it needs fence. Nothing else in the data can say it. */
  | 'deer_fence'
  /** 🔴 PLANTING WORK ON THE SITE, NOT A FEE (David, 2026-09-17). At Chris Dubec, *"8 trees plus 1
   *  extra on site which is (PYT)"* — the crew plants NINE. Its size is unknown, so it is NOT counted
   *  as a tree and earns no mix or posts; it is printed on its stop and it raises the FLOOR. */
  | 'plant_on_site'
  /** Physical goods a customer bought — a 50 lb bag, a 4.4 cf bale, a tarp. They ride the trailer, so
   *  they print under "Also on the truck" with their quantity. They are NOT trees: no mix, no posts. */
  | 'other_goods'
  /** A MONEY line, or a service with nothing to load — a charge, a discount, a delivery option, a
   *  removal, or a billed bubbler (computed per tree above). It prints NOWHERE. */
  | 'not_loaded'
  /** 🔴 A MESSAGE, NOT A THING (David, 2026-09-25). *"Bring Birthday Cake for Vera!!!"* — no item
   *  code, no lot, no size. It prints as a NOTE on its stop and on the crew link, and it does NOT
   *  go on page 4: page 4 is for what could not be READ, and a note read perfectly. */
  | 'note'
  /** It might be loadable and we could not read it — including a container size this nursery's ladder
   *  does not have (`offLadder`), and a tree whose size we cannot reach. The ONE printed refusal. */
  | 'unresolved';

export interface ResolvedLoadItem {
  quantity: number;
  /** The product name as its source wrote it. NEVER normalised (D-23). */
  name: string;
  /** The size exactly as written ("45 Gallon", "#3/5"), or null. */
  sizeText: string | null;
  /** The rung this line landed on. Null unless `kind === 'tree'`. */
  rung: Rung | null;
  /** The RUNG's container volume in gallons — never a number read out of the size text. Null when
   *  the line is not a tree, and null for a tree whose rung has no volume set (a slip). */
  gallons: number | null;
  kind: LoadItemKind;
  /** True when the size reads as a container this nursery's ladder does not have. Such a line is
   *  almost certainly a tree, so it is COUNTED as one — it simply cannot be staked or mixed. */
  offLadder: boolean;
  /** Why this line is not a tree, in the yard person's words. Null for a tree. */
  reason: string | null;
  sku: string | null;
  /** The exact fragment we tried to read as a size and could not place. Null unless we tried. */
  unreadText: string | null;
}

/** One consolidated tree row: "Live Oak 45 gallon ×2". */
export interface TreeTally {
  name: string;
  /** A spelling the source used — the first one seen for this row (D-23). */
  sizeText: string;
  /** The rung's label — what consolidated this row. */
  rungLabel: string;
  /** Ladder position, for ordering. Never sort by volume: a slip has none. */
  sortOrder: number;
  /** The rung's volume, or null when the rung has none set. */
  gallons: number | null;
  quantity: number;
  /** T-posts for ONE tree, read off the rung. */
  tPosts: number;
  /** Where that post count came from (the rung's own note). */
  tPostsBecause: string;
  /** Special mix for ONE tree, in gallons — rung volume × the configured ratio. Null without a volume. */
  mixGallonsPerTree: number | null;
  /** Watering-ring diameter in feet for ONE tree ([[R-156]]). Null when the rung has no volume. */
  ringDiameterFeet: number | null;
  /** Feet of deer fence for ONE tree — the ring's circumference, bought by the roll. Null without a volume. */
  fenceFeetPerTree: number | null;
}

/** Whether a stop needs deer fence, as far as anything stored can say. */
type DeerFenceState = 'yes' | 'no' | 'unknown';

export interface LoadStop {
  stopId: string;
  customerName: string;
  address: string;
  serviceType: string | null;
  /** Present only when the stop's lines could not be read at all — the stop still prints. */
  problem: string | null;
  items: ResolvedLoadItem[];
  /** Trees on this stop, consolidated. */
  trees: TreeTally[];
  /** Trunk protection units on this stop — on the list, so it prints. */
  trunkProtection: number;
  /** Bubblers SPECIFIED on this stop's order. 0 is a real answer and the page says so in words. */
  bubblers: number;
  /** Water monitor kits: one per tree LAWNS installs, plus any billed on the order. */
  waterMonitors: number;
  /** True when this stop's order is an INSTALL — every tree on it gets a water monitor kit. */
  installs: boolean;
  /** Planting work on this stop: a tree already on site. Counted in no total (David, 2026-09-17). */
  plantOnSite: ResolvedLoadItem[];
  /** Every tree on the stop, INCLUDING the ones whose size is off the ladder. */
  treeCount: number;
  mixGallons: number;
  /** Special mix for this stop alone, rounded up to the next half yard. */
  mixYards: number;
  tPosts: number;
  /** Extra posts deer fence adds on this stop. 0 unless the stop says it is fenced. */
  deerFencePosts: number;
  deerFence: DeerFenceState;
  /** Trees on this stop whose size is not on the ladder. Counted; not staked or mixed. */
  offLadderTreeCount: number;
  /** Lines on this stop that are UNRESOLVED (unreadable, or off the ladder). */
  unresolvedCount: number;
}

/** The figures the page used, printed so nobody has to trust a number they cannot see. */
export interface ValuesUsed {
  installMixContainerVolumesPerTree: number;
  ropeFeetPerTPost: number;
  bubblersPerTree: number;
  deerFenceTPostsPerTree: number;
  gallonsPerCubicYard: number;
  /** Every rung that appears on the day, in ladder order (biggest first). */
  rungs: Array<{ label: string; volumeGallons: number | null; tPosts: number; tPostsBecause: string }>;
}

export interface LoadListModel {
  date: string;
  stopCount: number;
  /** Every stop, in the order given. A stop with no order still appears. */
  stops: LoadStop[];

  // ── the consolidated headline ──────────────────────────────────────────────
  /** Special mix, rounded UP to the next half yard. Loads FIRST, trees on top. */
  mixYards: number;
  mixGallons: number;
  /** Trees on the ladder, consolidated by name + rung, biggest rung first. */
  trees: TreeTally[];
  /** Every tree on the day, INCLUDING off-ladder ones — a bubbler does not depend on the size. */
  treeCount: number;
  /** Staking T-posts, read off each tree's rung. */
  tPosts: number;
  /** Extra posts for the stops that SAY they are fenced. Never guessed. */
  deerFencePosts: number;
  /** Feet of staking rope — staking posts × the configured feet per post. */
  ropeFeet: number;
  /** 🔴 BUBBLERS ARE THE ONES BILLED, NOT ONE PER TREE (David, 2026-09-18). 0 when none is specified,
   *  and the page prints "none specified on these orders" rather than a bare zero. */
  bubblers: number;
  /** Water monitor kits — one per tree LAWNS installs, PLUS any billed line. Prebuilt and on the
   *  shelf, so the sheet prints a COUNT only: never the PVC, the bamboo or the drilling. */
  waterMonitors: number;
  /** Trees on install stops — the part of `waterMonitors` the install rule produced. */
  installTreeCount: number;
  /** Trunk protection for the day. */
  trunkProtection: number;
  /** Planting work across the day — trees already on site, size unknown. */
  plantOnSite: ResolvedLoadItem[];
  /** Trees whose size is not on the ladder: counted, not staked or mixed. */
  offLadderTreeCount: number;
  /** Tree rows whose rung has no volume set: counted and staked, their mix unknown. */
  noVolumeTrees: TreeTally[];
  /** Stops carrying trees where nothing stored says whether deer fence is needed. A COUNT for the
   *  trace only: ✏️ David, 2026-09-17 — the page prints the fence RULE once at the top, and does not
   *  list these stops as unresolved. */
  deerFenceUnknownStops: number;
  /**
   * True when something on this day could not be worked out, so every total is a FLOOR: a line or
   * stop we could not read, a container size not on the ladder, or a rung with no volume.
   * ⚠️ DEER FENCE IS NOT IN THIS FLAG — it is unknown on every day LAWNS has, so a flag that included
   * it would fire always and mean nothing. The page prints the fence rule once, at the top.
   */
  totalsAreFloors: boolean;

  valuesUsed: ValuesUsed;

  // ── everything the headline does not cover ─────────────────────────────────
  /** 🔴 PHYSICAL GOODS — printed under "Also on the truck", counted in no tree, mix or post total. */
  otherGoods: ResolvedLoadItem[];
  /** 🔴 THE ONE PRINTED REFUSAL: lines that might be loadable and could not be read. */
  unresolved: ResolvedLoadItem[];
  /** Lines we RECOGNISE as not going on the trailer. Carried for the trace; printed NOWHERE
   *  (David, 2026-09-17: *"additional information to yard crew is too confusing"*). */
  notLoaded: ResolvedLoadItem[];
  /** Stops whose lines could not be read (permission or a failed query). */
  unreadStops: number;
}

/**
 * 🔴 THE RULE, IN DAVID'S WORDS (2026-09-17, second pass): **ANYTHING PHYSICAL PRINTS; MONEY LINES
 * NEVER DO.** *"Fertiliser, fungicide, perlite, ant killer and anything else physical that a customer
 * bought is loaded on the truck, so it prints."* His first list — trees, T-posts, special mix, deer
 * fence, trunk protection — named the INSTALL MATERIALS, not the whole sheet.
 * ⚠️ So this list holds ONLY money lines and services with nothing to load. A physical thing is never
 * in it. The one deliberate exception is a billed **Tree Bubbler**: bubblers are computed one per tree
 * in the hardware total, so the billed line would read as a second demand for the same object — and
 * NOTHING compares the two (tech-debt #326, filed not built).
 *
 * Matched on the description OR the SKU. Every entry was read out of LAWNS's own order lines on
 * 2026-09-17, with its line count.
 * ⚠️ A DATED "Flat fee …" IS DELIBERATELY ABSENT. David's own worked example keeps it in the one
 * printed refusal — we cannot read it, and a thing we cannot read is not a thing we recognise. (His
 * two instructions disagreed on that line; this is the reading his Saturday example gives.)
 */
const NON_LOAD_LINES: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /^trip charge$|^TC$/i,            why: 'a delivery charge' },              // 31 lines
  { re: /discount/i,                      why: 'a discount' },                      // 7
  { re: /^\d+(\.\d+)?% off\b/i,          why: 'a discount' },
  { re: /surcharge|credit card fee/i,     why: 'a charge' },
  { re: /^(morning|tailgate) delivery\b/i, why: 'a delivery option, not a thing to load' },
  { re: /^existing tree removal$|^TR$/i,  why: 'work on site, not a thing to load' },
];

/** Physical things that state no size — they go on the truck, so they print (David, 2026-09-17). */
const KNOWN_GOODS = /^tree tarp$|^stake kit$|^t-post stake kit$|^TSK\d*$/i;

/** Lines that ARE on David's list, matched the same way. */
const TRUNK_PROTECTION = /^trunk protection\b|^TP$/i;
/** 🔴 THE BUBBLER MARKER, AND THERE IS NO OTHER ONE (measured 2026-09-18): the `Tree Bubbler` line.
 *  `order_service_selections` is EMPTY for LAWNS, and no column on a line or a lot marks a tree. Five
 *  such lines exist in the whole book — quantities 7, 2, 6, 8 and 3 — and the fifth is 3 bubblers
 *  against 9 trees, which is David's ruling visible in the data. ✏️ This REPLACES ledger #350's
 *  exception, where the billed line was left off because bubblers were computed one per tree. */
const BUBBLER_LINE = /^tree bubblers?\b|^TB$/i;
/** A billed water monitor kit — QuickBooks item 102, *"Augur Holes, and install water monitor pipe"*.
 *  It ADDS to the count on top of the per-installed-tree rule: a customer can buy them for trees they
 *  plant themselves. Measured 2026-09-18: the catalogue item exists and no order line has used it yet. */
const WATER_MONITOR_LINE = /augur hole|water monitor/i;
const DEER_FENCE_LINE  = /^deer fenc|^DF$/i;
/** Planting WORK with no container size — the tree is already on site. Never a sized tree line. */
const PLANT_ON_SITE    = /^plant your tree$|^PYT$|^tree install(ation)?$/i;

const matches = (re: RegExp, name: string, sku: string | null): boolean =>
  re.test(name.trim()) || (sku != null && re.test(sku.trim()));

/**
 * Read ONE line into a load item.
 *
 * THE RESOLUTION ORDER, AND WHY THE SKU IS NOT IN IT:
 *   1. The anchored LOT. A checkout line carries `business_inventory`, whose `size` is its own
 *      column — our catalogue record, and the strongest thing available.
 *   2. The line's own DESCRIPTION, through the shared `readProductFromDescription`, which finds
 *      the size-shaped fragment at the end of the sentence. Every QuickBooks and photographed
 *      invoice line takes this path, which on LAWNS is every line there is.
 *   3. There is no step 3. 🔴 **THE SKU IS NOT A SIZE SOURCE AND THE MEASUREMENT IS WHY.** `MS45`
 *      looks like it carries a size and then `TSK2` is a T-POST COUNT and `MT10002` is a 1 lb ant
 *      killer. A digit-scraping fallback is the confident wrong answer D-9 forbids.
 *
 * 🔴 AND WHATEVER SIZE TEXT IS FOUND GOES TO THE LADDER — NOWHERE ELSE (ledger #343). This file
 * does not parse a size; `resolveRung` says whether it is a rung, goods, off the ladder, or
 * unreadable, and this file only maps that answer to a kind.
 */
export function resolveLoadItem(item: StopOrderItem, ladder: Ladder): ResolvedLoadItem {
  const quantity = Number(item.quantity) || 0;
  const sku = item.sku?.trim() || null;

  // ── 0. the ALLOW-LIST, BEFORE ANY SIZE READING (David, 2026-09-17) ────────
  // 🔴 IT MUST COME FIRST, AND "Military Discount 5%" IS WHY. The description reader finds "5%" at
  // the end, calls it an unreadable SIZE and returns — so a line we plainly recognise would have
  // printed in the one refusal section. Recognition is about the NAME, and the name is known before
  // any size is read.
  const label = item.business_inventory?.name?.trim() || item.description?.trim() || '';
  if (label || sku) {
    const flat = { quantity, name: label || sku || 'Unnamed line', sizeText: null, sku,
                   rung: null, gallons: null, offLadder: false, unreadText: null } as const;
    if (matches(TRUNK_PROTECTION, label, sku)) return { ...flat, kind: 'trunk_protection', reason: null };
    if (matches(BUBBLER_LINE, label, sku)) return { ...flat, kind: 'bubbler', reason: null };
    if (matches(WATER_MONITOR_LINE, label, sku)) return { ...flat, kind: 'water_monitor', reason: null };
    if (matches(DEER_FENCE_LINE, label, sku))  return { ...flat, kind: 'deer_fence', reason: null };
    if (matches(PLANT_ON_SITE, label, sku)) {
      return { ...flat, kind: 'plant_on_site', reason: 'A tree already on site, to plant — size unknown; add its mix and T-posts by hand.' };
    }
    if (matches(KNOWN_GOODS, label, sku)) {
      return { ...flat, kind: 'other_goods', reason: 'Goods — it rides the trailer; it is not a tree, so it takes no mix or posts.' };
    }
    const known = NON_LOAD_LINES.find(n => matches(n.re, label, sku));
    if (known) return { ...flat, kind: 'not_loaded', reason: `Not loaded — ${known.why}.` };
  }

  // ── 0b. A NOTE IS NOT A TREE (David, 2026-09-25) ──────────────────────────
  // 🔴 AFTER the allow-list and BEFORE any size reading. A note has no code and no lot, so nothing
  // above can claim it; and if the size reader saw it first it would hunt for digits in
  // "Bring Birthday Cake for Vera!!!", fail, and file the note as an UNREADABLE LINE — putting a
  // birthday cake on page 4 beside a tree nobody can size.
  if (isNoteLine(item)) {
    return { quantity, name: item.description?.trim() || 'Note', sizeText: null, sku: null,
             rung: null, gallons: null, offLadder: false, unreadText: null,
             kind: 'note', reason: 'A note for the crew — nothing to load.' };
  }

  // ── 0c. A WARRANTY REPLACEMENT WHOSE SIZE IS ONLY IN ITS CODE ─────────────
  // David, 2026-09-25: *"BPJ30REP → 30 gal; AZBI45 → 45 gal — the digits are the size."*
  // 🔴 ONLY when nothing else carries a size. A replacement that names its size in words keeps the
  //    words (D-23 — never normalise what the source wrote); this is the FALLBACK, not the rule.
  if (isReplacementLine(item)) {
    const named = (item.business_inventory?.size ?? '').trim() || null;
    if (!named) {
      const gal = replacementGallons(item);
      if (gal !== null) {
        // Hand `classify` a size it can place, so the tree lands on its real rung and earns its mix
        // and posts — a replacement is planted, so it must be a full tree on the sheet.
        const r = classify(quantity, item.business_inventory?.name?.trim() || item.description?.trim() || (item.sku ?? 'Replacement'),
                           `${gal} gal`, item.sku?.trim() || null, ladder);
        return { ...r, sizeText: `${gal} gal`, reason: r.reason };
      }
    }
  }

  // ── 1. the anchored lot ───────────────────────────────────────────────────
  const lotName = item.business_inventory?.name?.trim() || null;
  const lotSize = item.business_inventory?.size?.trim() || null;
  if (lotName) return classify(quantity, lotName, lotSize, sku, ladder);

  // ── 2. the line's own words ───────────────────────────────────────────────
  const read = readProductFromDescription(item.description);
  if (read.state === 'could_not_read') {
    return {
      quantity, name: read.name ?? sku ?? 'Unnamed line',
      sizeText: null, rung: null, gallons: null, kind: 'unresolved', offLadder: false, sku,
      unreadText: read.unreadSizeText,
      reason: read.name === null
        ? 'This line carries no description and no size — nothing on it says what it is.'
        : `We could not read “${read.unreadSizeText}” as a size. Check the invoice.`,
    };
  }
  return classify(quantity, read.name ?? sku ?? 'Unnamed line', read.size, sku, ladder);
}

function classify(
  quantity: number, name: string, sizeText: string | null, sku: string | null, ladder: Ladder,
): ResolvedLoadItem {
  const base = { quantity, name, sizeText, sku, rung: null, gallons: null, offLadder: false, unreadText: null };

  // ⚠️ The allow-list ran in `resolveLoadItem` BEFORE any size was read — see step 0 there. It is
  // re-checked here ONLY for the name the description reader extracted, which can differ from the
  // raw line ("Tree Bubbler. ( no existing irrigation … )" reads out as "Tree Bubbler").
  const known = NON_LOAD_LINES.find(n => matches(n.re, name, sku));
  if (known && !sizeText) {
    return { ...base, kind: 'not_loaded', reason: `Not loaded — ${known.why}.` };
  }

  if (!sizeText) {
    return { ...base, kind: 'unresolved', reason: 'No container size on this line, and we do not recognise it — check it before you load.' };
  }

  const r = resolveRung(ladder, sizeText);
  if (r.ok) {
    return { ...base, rung: r.rung, gallons: r.rung.volumeGallons, kind: 'tree', reason: null };
  }
  switch (r.reason) {
    case 'blank':
      return { ...base, kind: 'unresolved', reason: 'No container size on this line, and we do not recognise it — check it before you load.' };
    case 'not_container':
      // 🔴 GOODS PRINT (David, 2026-09-17, correcting the first pass): a customer bought it, so it is
      // on the truck. 12 live LAWNS lines are goods — fertiliser, fungicide, perlite, ant killer.
      return { ...base, kind: 'other_goods', reason: `Sold by ${r.unit}, not by container — it rides the trailer, and takes no mix or posts.` };
    case 'off_ladder':
      return {
        ...base, kind: 'unresolved', offLadder: true, unreadText: sizeText,
        reason: ladder.length === 0
          ? `No container sizes are set up for this nursery, so “${sizeText}” cannot be staked or mixed. Set them up in Settings → Container sizes.`
          : `“${sizeText}” is not one of this nursery's container sizes — counted as a tree, but its mix and posts are not. Add the size in Settings → Container sizes, or check the invoice.`,
      };
    case 'unreadable':
      return { ...base, kind: 'unresolved', unreadText: sizeText, reason: `We could not read “${sizeText}” as a size. Check the invoice.` };
  }
}

/** The comparison key for consolidating two tree rows: the NAME folded, and the RUNG. Case and
 *  spacing are folded for the KEY only; the displayed name stays as its source wrote it (D-23). */
function treeKey(name: string, rung: Rung): string {
  return `${name.toLowerCase().replace(/\s+/g, ' ').trim()}|${rung.label}`;
}

function tallyTrees(items: ResolvedLoadItem[], s: LoadListSettings): TreeTally[] {
  const by = new Map<string, TreeTally>();
  for (const it of items) {
    if (it.kind !== 'tree' || !it.rung) continue;
    const k = treeKey(it.name, it.rung);
    const existing = by.get(k);
    if (existing) { existing.quantity += it.quantity; continue; }
    const v = it.rung.volumeGallons;
    by.set(k, {
      name: it.name,
      sizeText: it.sizeText ?? it.rung.label,
      rungLabel: it.rung.label,
      sortOrder: it.rung.sortOrder,
      gallons: v,
      quantity: it.quantity,
      tPosts: it.rung.installTPostsPerTree,
      tPostsBecause: it.rung.installTPostsBecause,
      mixGallonsPerTree: v == null ? null : v * s.ops.installMixContainerVolumesPerTree,
      ringDiameterFeet: v == null ? null : ringDiameterFeet(v),
      fenceFeetPerTree: v == null ? null : ringCircumferenceFeet(v),
    });
  }
  // Biggest rung first — LADDER order, never volume: the yard person loads big trees first.
  return [...by.values()].sort((a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name));
}

/** Round UP to the next half yard. David: *"err large, do not skimp."* A yard person who runs out
 *  of mix on the last tree has to drive back; a half yard over costs nothing. */
function toHalfYards(gallons: number, s: LoadListSettings): number {
  return Math.ceil((gallons / s.ops.trueGallonsPerCubicYard) * 2) / 2;
}

interface Sums {
  treeCount: number; offLadderTreeCount: number; mixGallons: number; tPosts: number; deerFencePosts: number;
}

function sumTrees(trees: TreeTally[], items: ResolvedLoadItem[], fence: DeerFenceState, s: LoadListSettings): Sums {
  const offLadderTreeCount = items.filter(i => i.offLadder).reduce((n, i) => n + i.quantity, 0);
  return {
    treeCount: trees.reduce((n, t) => n + t.quantity, 0) + offLadderTreeCount,
    offLadderTreeCount,
    mixGallons: trees.reduce((n, t) => n + (t.mixGallonsPerTree ?? 0) * t.quantity, 0),
    tPosts: trees.reduce((n, t) => n + t.tPosts * t.quantity, 0),
    // 🔴 FENCE BRINGS A TREE TO THE FIGURE *IN TOTAL*. A tree already staked with that many or more
    // takes none — which settles the old "does a 95 gallon need 4 more?" question by the rule's own
    // words. Applied ONLY where the stop says so; an unknown stop adds nothing.
    deerFencePosts: fence !== 'yes' ? 0
      : trees.reduce((n, t) => n + Math.max(0, s.ops.deerFenceTPostsPerTree - t.tPosts) * t.quantity, 0),
  };
}

export interface LoadStopInput {
  stopId: string;
  customerName: string;
  address: string;
  serviceType: string | null;
  orderId: string | null;
  /** The viewer holds `order_items:read`. */
  canReadLines: boolean;
  /** The lines query ran and did not error. */
  linesRead: boolean;
  items: StopOrderItem[];
  /** True when the linked order's `transport_method` is `install` — LAWNS plants these trees, and
   *  every one of them gets a water monitor kit (David, 2026-09-18). */
  installs?: boolean;
  /**
   * Whether this stop needs deer fence, if anything stored says so. `null` = the data cannot tell.
   * ⚠️ TODAY IT IS ALWAYS NULL: measured 2026-09-12 across the LAWNS tenant, zero order lines and
   * zero stop notes mention deer, fence, T-post or stake, and nothing on a stop marks it. The field
   * exists so the arithmetic is written and proven for the day something does.
   */
  deerFence?: boolean | null;
}

/**
 * Build the whole day.
 *
 * 🔴 EVERY STOP APPEARS, WHATEVER STATE IT IS IN. A six-stop day that prints five stops is the
 * failure this exists to prevent, and it is silent by nature.
 */
export function buildLoadList(date: string, input: LoadStopInput[], settings: LoadListSettings): LoadListModel {
  const stops: LoadStop[] = [];
  let unreadStops = 0;
  let deerFenceUnknownStops = 0;
  let deerFencePosts = 0;

  for (const s of input) {
    const problem =
      !s.orderId     ? 'No order is linked to this stop, so nothing records what goes on the truck.'
      : !s.canReadLines ? 'You do not have permission to see what is on this order.'
      : !s.linesRead    ? 'We could not read what is on this order — this stop may need more than is listed.'
      : s.items.length === 0 ? 'No items are recorded on this order.'
      : null;
    if (problem && s.orderId && (!s.canReadLines || !s.linesRead)) unreadStops++;

    const items = s.items.map(i => resolveLoadItem(i, settings.ladder));
    const trees = tallyTrees(items, settings);
    // 🔴 A DEER-FENCE LINE IS THE STOP SAYING SO. Until something else can record it, the order's own
    // line is the only thing in the data that can (David, 2026-09-17: print nothing unless marked).
    const fenceLine = items.some(i => i.kind === 'deer_fence');
    const fence: DeerFenceState = s.deerFence === true || fenceLine ? 'yes' : s.deerFence === false ? 'no' : 'unknown';
    const sums = sumTrees(trees, items, fence, settings);
    if (fence === 'unknown' && sums.treeCount > 0) deerFenceUnknownStops++;
    if (s.installs) deerFencePosts += sums.deerFencePosts;   // materials only on an install stop (#416)

    stops.push({
      stopId: s.stopId, customerName: s.customerName, address: s.address,
      serviceType: s.serviceType, problem, items, trees,
      trunkProtection: items.filter(i => i.kind === 'trunk_protection').reduce((n, i) => n + i.quantity, 0),
      // 🔴 THE BILLED LINE IS THE COUNT. `bubblersPerTree` is the multiplier per SPECIFIED tree — not
      // a per-tree default any more (David, 2026-09-18).
      bubblers: items.filter(i => i.kind === 'bubbler').reduce((n, i) => n + i.quantity, 0) * settings.ops.bubblersPerTree,
      // One per tree LAWNS installs, PLUS any billed kit (a customer may buy them for trees they plant).
      waterMonitors: (s.installs ? sums.treeCount : 0)
        + items.filter(i => i.kind === 'water_monitor').reduce((n, i) => n + i.quantity, 0),
      installs: !!s.installs,
      plantOnSite: items.filter(i => i.kind === 'plant_on_site'),
      treeCount: sums.treeCount,
      // 🔴 INSTALL MATERIALS GO ONLY ON AN INSTALL STOP — David's ruling, 2026-09-25/26 (ledger #416):
      // *"install materials (mix, T-posts, rope, water monitors) go ONLY on install stops (marked
      // install, a trip-charge line, or warranty replacements); delivery-only carries trees only."*
      // 🔴 `s.installs` ALREADY CARRIES THE WHOLE OF THAT DEFINITION and is not re-derived here: the
      // LoadList page sets it from `stopChecks(...).basis !== null`, which reads the mark, a TRIP
      // CHARGE and a WARRANTY REPLACEMENT (ledger #415). This clause is the CONSEQUENCE half — #415
      // built the predicate and wired it only to `waterMonitors`, so mix, posts and rope were still
      // being loaded for stops LAWNS does not plant. Measured 2026-09-25: 26 of LAWNS's 63 stops are
      // `delivery` (tech-debt #364).
      // ⚠️ THE TREES ARE UNTOUCHED. A delivery stop still lists and counts every tree — it is the
      // MATERIALS that stay behind. `trees[]` keeps each rung's own per-tree figures, because those
      // describe the SIZE and are what the "values used" block prints.
      mixGallons: s.installs ? sums.mixGallons : 0,
      mixYards: s.installs ? toHalfYards(sums.mixGallons, settings) : 0,
      tPosts: s.installs ? sums.tPosts : 0,
      deerFencePosts: s.installs ? sums.deerFencePosts : 0,
      deerFence: fence,
      offLadderTreeCount: sums.offLadderTreeCount,
      unresolvedCount: items.filter(i => i.kind === 'unresolved').length,
    });
  }

  const allItems = stops.flatMap(s => s.items);
  const trees = tallyTrees(allItems, settings);
  const day = sumTrees(trees, allItems, 'no', settings);
  // 🔴 THE DAY'S MATERIALS ARE THE INSTALL STOPS' ONLY, AND THAT NEEDED ITS OWN TALLY RATHER THAN A
  // SUM OF THE STOPS. `day` above is recomputed over EVERY item, so gating the per-stop figures does
  // not change it — a delivery stop's mix would still have reached the headline the yard loads from.
  // ⚠️ `trees` and `day.treeCount` stay whole ON PURPOSE: a delivery stop's trees DO go on the
  // trailer. Only the materials stay behind.
  const installItems = stops.filter(st => st.installs).flatMap(st => st.items);
  const installMaterials = sumTrees(tallyTrees(installItems, settings), installItems, 'no', settings);
  const unresolved = allItems.filter(i => i.kind === 'unresolved');
  const plantOnSite = allItems.filter(i => i.kind === 'plant_on_site');
  const noVolumeTrees = trees.filter(t => t.gallons == null);

  const seen = new Map<string, ValuesUsed['rungs'][number]>();
  for (const t of trees) {
    if (!seen.has(t.rungLabel)) {
      seen.set(t.rungLabel, { label: t.rungLabel, volumeGallons: t.gallons, tPosts: t.tPosts, tPostsBecause: t.tPostsBecause });
    }
  }

  return {
    date,
    stopCount: stops.length,
    stops,
    mixYards: toHalfYards(installMaterials.mixGallons, settings),
    mixGallons: installMaterials.mixGallons,
    trees,
    treeCount: day.treeCount,
    tPosts: installMaterials.tPosts,
    deerFencePosts,
    ropeFeet: installMaterials.tPosts * settings.ops.ropeFeetPerTPost,
    bubblers: stops.reduce((n, st) => n + st.bubblers, 0),
    waterMonitors: stops.reduce((n, st) => n + st.waterMonitors, 0),
    installTreeCount: stops.filter(st => st.installs).reduce((n, st) => n + st.treeCount, 0),
    trunkProtection: stops.reduce((n, st) => n + st.trunkProtection, 0),
    plantOnSite,
    offLadderTreeCount: day.offLadderTreeCount,
    noVolumeTrees,
    deerFenceUnknownStops,
    // Planting work raises the floor: the crew plants more trees than this sheet counts.
    totalsAreFloors: unresolved.length > 0 || unreadStops > 0 || noVolumeTrees.length > 0 || plantOnSite.length > 0,
    valuesUsed: {
      installMixContainerVolumesPerTree: settings.ops.installMixContainerVolumesPerTree,
      ropeFeetPerTPost: settings.ops.ropeFeetPerTPost,
      bubblersPerTree: settings.ops.bubblersPerTree,
      deerFenceTPostsPerTree: settings.ops.deerFenceTPostsPerTree,
      gallonsPerCubicYard: settings.ops.trueGallonsPerCubicYard,
      rungs: [...seen.values()],
    },
    otherGoods: allItems.filter(i => i.kind === 'other_goods'),
    unresolved,
    notLoaded: allItems.filter(i => i.kind === 'not_loaded'),
    unreadStops,
  };
}

/** Every sentence the printed page can say, in ONE place (STD-011). None of them is a blank. The
 *  rules that carry a NUMBER are functions of the figures used, so the sentence can never state a
 *  figure the arithmetic did not use. */
export const LOAD_LIST_COPY = {
  // ── ONE SECTION PER TEAM (ledger #373, teams piece 4) ──────────────────────────────────
  teamSectionsHeading: (sections: number, stops: number) =>
    `This day is split across ${sections} section${sections === 1 ? '' : 's'} — ${stops} stop${stops === 1 ? '' : 's'} in total.`,
  teamSectionsNote:
    'Each section below is one team, and every total in it is that team\u2019s. Load one section, then the next — together they are the whole day.',
  teamNoneHeading: 'These stops are not assigned to a team.',
  teamNoneNote:
    'Nobody has been given these yet, so they are listed last rather than left off. Assign them on the schedule or the route page, or load them with whichever team takes them.',

  mixFirst: 'Loads FIRST — trees on top.',
  mixRule: (ratio: number) =>
    `${ratio} gallons of mix per gallon of container — a 30 gallon tree takes ${30 * ratio} gallons. Container volumes are the ones set for each size.`,
  tPostRule: 'T-posts per tree are set for each container size — the figure is listed against each tree.',
  ropeRule: (feet: number) => `About ${feet} ft of rope per T-post.`,
  /** ✏️ 2026-09-18: bubblers are the ones BILLED, so the rule describes the marker, not a per-tree rate. */
  bubblerRule: (n: number) => n === 1
    ? 'One per tree the order specifies — the bubbler line on the order is the count.'
    : `${n} per tree the order specifies — the bubbler line on the order is the count.`,
  /** 🔴 NEVER A BARE ZERO (David, 2026-09-18). */
  bubblersNoneSpecified: 'none specified on these orders',
  /** Prebuilt and on the shelf: the crew count trees, count monitors, load them. A COUNT ONLY —
   *  never the PVC, the bamboo or the drilling (David, 2026-09-18). */
  waterMonitorRule: 'One for every tree we install, plus any bought on the order. Prebuilt — take them off the shelf.',
  waterMonitorNone: 'none — no tree on this day is one we install, and none is on an order',
  noMulch: 'No mulch. Only the ingredients in the special mix.',
  /** The ring rule, in the yard person's words. The NUMBER is printed per tree row beside it. */
  ringRule: 'Ring diameter grows with the square root of container gallons — 5 ft at 15 gallon, 12 ft at 95 gallon, and a figure for every size above and between.',
  /** 🔴 The deer-fence gap, printed rather than hidden. Measured 2026-09-12: nothing in the data
   *  marks a stop as needing fence — zero order lines and zero stop notes across the tenant. */
  deerFenceGap:
    'DEER FENCE — nothing recorded. Nothing in the system marks which stops need deer fence, so no fence posts are counted above. '
    + 'Add by hand: a fenced tree carries the T-posts shown below IN TOTAL — count the stake posts it already has toward that. '
    + 'Fence material is by the roll, measured as the circumference of the ring — the feet per tree are listed against each size below.',
  deerFenceTotal: (n: number) => `A fenced tree carries ${n} T-posts in total.`,
  floorsNote:
    'Something on this day could not be worked out, so every total above is a FLOOR. What is listed below is what we could not count; if any of it is a tree, the numbers above are short.',
  offLadderNote: (n: number) =>
    `${n} tree${n === 1 ? '' : 's'} on this day ${n === 1 ? 'is' : 'are'} a size this nursery has not set up — counted as trees and given bubblers, but NO mix or posts. They are listed below.`,
  noVolumeNote: 'These sizes have no container volume set, so their mix is NOT counted. Set the volume in Settings → Container sizes.',
  unresolvedHeading: 'COULD NOT WORK OUT — check these before you load',
  unresolvedWhy:
    'These lines might go on the trailer and we could not read them. Nothing here is counted in the totals above. Everything this sheet does not carry — charges, discounts, delivery options — is left off entirely.',
  /** 🔴 Planting work on a stop — a tree already there. David, 2026-09-17: the crew plants nine. */
  plantOnSite: 'plus %n tree%s to plant on site (Plant Your Tree) — size unknown; add mix and T-posts by hand.',
  trunkProtectionLine: (n: number) => `${n} trunk protection`,
  /** 🔴 Physical goods the customer bought. David, 2026-09-17: *"anything physical prints."* */
  alsoOnTruckHeading: 'Also on the truck',
  alsoOnTruckWhy:
    'Bought on these orders and loaded with the trees. Not counted as trees, and they take no mix or T-posts. Charges, discounts and fees are not shown anywhere on this sheet.',
  valuesHeading: 'Figures used for this list',
  sizesFailed: 'Could not read this nursery’s container sizes — no tree can be staked or mixed until they load. Reload before you load the trailer.',
  sizesNone: 'No container sizes are set up for this nursery, so no tree can be staked or mixed. Set them up in Settings → Container sizes.',
  emptyDay: 'No stops are scheduled for this day.',
  // 🔴 THE SHEET READS THE WAY THE TRAILER IS LOADED (David, 2026-09-18, ledger #355).
  bulkHeading: 'Bulk materials — loads first',
  stopsHeading: 'Stops',
  // 🔴 ONE SHEET PER CREW (ledger #354). A partial sheet says it is partial, says its totals are its
  // own, and names every stop of the day it does not carry.
  // 🔴 LAUREN PULLS BY VARIETY, THEN STAGES, THEN CHECKS THE NAMES (David, 2026-09-20, ledger #358).
  // The roll-up is the PULL list; the per-stop list is the CHECK at staging, against the customer's
  // name on each tree's tag. Neither is redundant — they are two steps of one job, in order.
  pullHeading: (trees: number, stops: number) =>
    `Trees to pull — ${trees} across ${stops} stop${stops === 1 ? '' : 's'}`,
  pullWhy: 'Pull by variety, stage them, then check the names against the stops overleaf.',
  stopsWhy: 'Each tree is tagged with the customer’s name. Check the tags against these names as you stage.',
  subsetHowTo: 'Untick the stops another crew is taking, then print. Every total is for the ticked stops only.',
  subsetOfDay: (dayStops: number) => `of ${dayStops} on this day`,
  subsetHeading: (kept: number, dayStops: number) =>
    `This sheet carries ${kept} of the day’s ${dayStops} stops — it is not the whole day.`,
  subsetTotalsNote: 'Every total on this sheet is for these stops only.',
  subsetLeftOffLabel: 'On another sheet:',
  subsetUnknown: (n: number) =>
    `${n} stop${n === 1 ? '' : 's'} in this link ${n === 1 ? 'is' : 'are'} not on this day and ${n === 1 ? 'was' : 'were'} left off. Open the load list from the day again.`,
  subsetNone: 'No stops are ticked, so there is nothing on this sheet. Tick the stops this crew is taking.',
};
