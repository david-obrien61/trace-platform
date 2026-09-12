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
//               filter. This is D-9 / A9 (absent is not empty) applied to a piece of paper, where
//               it matters more than on a screen: nobody can click a blank on a printout to ask
//               what it meant.
//
// DEPENDENCIES: ./stopLoad (StopOrderItem — the SAME line shape the stop card reads, §6 r8) ·
//               @trace/shared/quickbooks/qboItemAdapter (readProductFromDescription) ·
//               @trace/shared/inventory/unitOfMeasure (parseUnitOfMeasure) ·
//               @trace/shared/utils/sizeLabel (normalizeSize). Otherwise PURE — no db, no clock,
//               no DOM, no env.
// OUTPUTS:      LoadItemKind · ResolvedLoadItem · LoadStop · LoadListModel · BOM_RULES ·
//               LOAD_LIST_COPY · GALLONS_PER_CUBIC_YARD · resolveLoadItem · buildLoadList.
//
// AC-1: this file lives in `cultivar-os`, NOT in `shared`, and deliberately. Its vocabulary —
//       tree, special mix, T-post, bubbler, deer fence — is a TREE FARM's bill of materials, and
//       putting it in `shared` would hardcode one vertical's operations into platform code. The
//       two things that ARE general (reading a size out of a sentence, naming a unit) are
//       imported FROM shared rather than re-implemented here (R-27).
// ============================================================

import { readProductFromDescription } from '@trace/shared/quickbooks/qboItemAdapter';
import { parseUnitOfMeasure } from '@trace/shared/inventory/unitOfMeasure';
import { normalizeSize } from '@trace/shared/utils/sizeLabel';
import type { StopOrderItem } from './stopLoad';

/** US gallons in one cubic yard. The special mix is bought and loaded by the yard; the bill of
 *  materials is computed per container gallon, so the two meet here. 231 in³ per gallon,
 *  46,656 in³ per cubic yard. */
export const GALLONS_PER_CUBIC_YARD = 46656 / 231; // 201.974025974…

/**
 * 🔴 DAVID'S BILL OF MATERIALS, 2026-09-12 — FROM HIM, NOT FROM THE INSTALL COST MODEL.
 *
 * The cost model and this list DISAGREE, twice, and the disagreements are filed as tech-debt
 * #290 and #291 rather than reconciled here:
 *   · SPECIAL MIX — the cost model uses a 0.7 ratio (23.55 gal at 45G). David: approximately ONE
 *     container volume per tree, and *"err large, do not skimp."* This list uses 1.0.
 *   · MULCH — the cost model carries a mulch line ($7.49 at 15G to $43.12 at 95G). Lauren states
 *     mulch is NOT used; only the ingredients in the special mix (tech-debt #290). There is no
 *     mulch row here and there must not be one.
 */
export const BOM_RULES = {
  /** Container volumes of special mix per tree. 1.0, not the cost model's 0.7 (tech-debt #291). */
  mixRatioOfContainerVolume: 1.0,
  /** 🔴 T-POSTS ARE COMPUTED FROM THE CONTAINER, NOT LOOKED UP. 2 per tree up to and INCLUDING
   *  65 gallon; 4 per tree at 95 gallon AND ANYTHING LARGER. There is no upper bound and no
   *  hand-work case. See `tPostsFor` for why the table this replaced was the defect. */
  tPostsSmallThresholdGallons: 65,
  tPostsAtOrBelowThreshold: 2,
  tPostsAboveThreshold: 4,
  /** Feet of rope per T-post. */
  ropeFeetPerTPost: 4,
  /** Bubblers per tree. */
  bubblersPerTree: 1,
  /** T-posts a deer-fenced tree needs in total — so a tree already carrying 2 needs 2 MORE.
   *  ⚠️ NOT APPLIED ANYWHERE IN THIS MODEL: nothing in the data marks a stop as needing fence
   *  (measured 2026-09-12 — zero order lines and zero stop notes mention deer, fence, T-post or
   *  stake across the whole tenant). The number is recorded so the page can PRINT THE RULE for a
   *  person to apply by hand, which is what David asked for rather than a stop. */
  deerFenceTPostsPerTree: 4,
} as const;

/** What one line turned out to be. Four outcomes, all of them printed — see the header. */
export type LoadItemKind =
  /** Resolved to a gallon container: a tree. The only kind that earns a bill of materials. */
  | 'tree'
  /** Resolved to a real unit that is NOT a gallon container — a 50 lb bag, a 4.4 cf bale, a
   *  24 box. It loads; it takes no stake, mix or bubbler, and we are not guessing that it does. */
  | 'other_goods'
  /** Read in full and states no size — Trip Charge, Tree Bubbler, Deer Fencing, Trunk Protection.
   *  🔴 This is NOT a claim that the line is a fee. Nothing stored classifies a line (R-144 /
   *  tech-debt #139): it is a statement about what we could READ, which is all we know. */
  | 'no_size_stated'
  /** We tried and failed, or there was nothing to try. Printed loudest. */
  | 'unresolved';

export interface ResolvedLoadItem {
  quantity: number;
  /** The product name as its source wrote it. NEVER normalised — the yard person is matching
   *  against what is physically printed on the tag (D-23, faithful before connected). */
  name: string;
  /** The size exactly as written ("45 Gallon", "15 gallon"), or null. */
  sizeText: string | null;
  /** Container gallons, when the size is a gallon container. Null otherwise. */
  gallons: number | null;
  kind: LoadItemKind;
  /** Why this line is not a tree, in the yard person's words. Null for a tree. */
  reason: string | null;
  sku: string | null;
  /** The exact fragment we tried to read as a size and could not. Null unless we tried. */
  unreadText: string | null;
}

/** One consolidated tree row: "Live Oak 45 gallon ×2". */
export interface TreeTally {
  name: string;
  sizeText: string;
  gallons: number;
  quantity: number;
  /** T-posts for this row. Always a number — every readable container size has a rule. */
  tPosts: number;
}

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
  treeCount: number;
  mixGallons: number;
  tPosts: number;
  /** Lines on this stop whose size could not be read at all — the ONLY unresolved case now. */
  unresolvedCount: number;
}

export interface LoadListModel {
  date: string;
  stopCount: number;
  /** Every stop, in the order given. A stop with no order still appears — it is a place the
   *  trailer goes, and printing five stops on a six-stop day is the failure this guards. */
  stops: LoadStop[];

  // ── the consolidated headline ──────────────────────────────────────────────
  /** Special mix, rounded UP to the next half yard. Loads FIRST, trees on top. */
  mixYards: number;
  mixGallons: number;
  /** Trees across the whole day, consolidated by name + size, biggest first. */
  trees: TreeTally[];
  treeCount: number;
  /** T-posts for the day. Complete for every tree whose container size could be read. */
  tPosts: number;
  /** Feet of rope. A FLOOR on the same condition as `tPosts`. */
  ropeFeet: number;
  bubblers: number;
  /**
   * True when something on this day could not be read, so every total is a FLOOR.
   *
   * 🔴 THIS NO LONGER MEANS "A SIZE WE HAVE NO RULE FOR" — that state is gone: `tPostsFor` is total
   * over every readable container size, so a 200 gallon tree is as fully computed as a 15. It now
   * means what it should always have meant: a LINE WE COULD NOT READ, or a STOP WE COULD NOT READ.
   * Either could be a tree, and if it is, everything above is short.
   */
  totalsAreFloors: boolean;

  // ── everything the headline does not cover, never dropped ──────────────────
  /** Lines that resolved to a non-gallon unit. They load; they take no bill of materials. */
  otherGoods: ResolvedLoadItem[];
  /** Lines that state no size. Listed so the yard person sees Trip Charge, Trunk Protection,
   *  a bubbler line and anything else that was on the paperwork. */
  noSizeStated: ResolvedLoadItem[];
  /** 🔴 Lines we could not work out at all. The reason this page can be trusted. */
  unresolved: ResolvedLoadItem[];
  /** Stops whose lines could not be read (permission or a failed query) — NEVER rendered as an
   *  empty stop, which would assert a fact about the business from a fact about the viewer. */
  unreadStops: number;
}

/**
 * Read ONE line into a load item.
 *
 * THE RESOLUTION ORDER, AND WHY THE SKU IS NOT IN IT:
 *   1. The anchored LOT. A checkout line carries `business_inventory`, whose `size` is its own
 *      column — our catalogue record, and the strongest thing available.
 *   2. The line's own DESCRIPTION, through the shared `readProductFromDescription`. Every line of
 *      every QuickBooks and photographed invoice takes this path (a history line has no lot by
 *      invariant), which on LAWNS is every line there is.
 *   3. There is no step 3. 🔴 **THE SKU IS NOT A SIZE SOURCE AND THE MEASUREMENT IS WHY.** The
 *      tree codes look like they carry one — `MS45`, `LAO45`, `CHO95` — and then `TSK2` is a
 *      T-POST COUNT, `R190` is a fertiliser, and `OS98615`, `MT10002`, `TX412X`, `HE6849`,
 *      `SY38687` are catalogue codes whose digits mean nothing. A digit-scraping fallback would
 *      turn a 1 lb ant killer into a 10,002-gallon container. Reading a trailing number out of a
 *      code is the confident wrong answer D-9 forbids, so this refuses instead and says so.
 */
export function resolveLoadItem(item: StopOrderItem): ResolvedLoadItem {
  const quantity = Number(item.quantity) || 0;
  const sku = item.sku?.trim() || null;

  // ── 1. the anchored lot ───────────────────────────────────────────────────
  const lotName = item.business_inventory?.name?.trim() || null;
  const lotSize = item.business_inventory?.size?.trim() || null;
  if (lotName) {
    const parsed = lotSize ? parseUnitOfMeasure(lotSize) : null;
    return classify(quantity, lotName, lotSize, parsed, sku, null);
  }

  // ── 2. the line's own words ───────────────────────────────────────────────
  const read = readProductFromDescription(item.description);
  if (read.state === 'could_not_read') {
    return {
      quantity,
      name: read.name ?? sku ?? 'Unnamed line',
      sizeText: null, gallons: null, kind: 'unresolved', sku,
      unreadText: read.unreadSizeText,
      reason: read.name === null
        ? 'This line carries no description and no size — nothing on it says what it is.'
        : `We could not read “${read.unreadSizeText}” as a size. Check the invoice.`,
    };
  }
  const parsed = read.size ? parseUnitOfMeasure(read.size) : null;
  return classify(quantity, read.name ?? sku ?? 'Unnamed line', read.size, parsed, sku, null);
}

type Parsed = ReturnType<typeof parseUnitOfMeasure>;

function classify(
  quantity: number, name: string, sizeText: string | null, parsed: Parsed,
  sku: string | null, unreadText: string | null,
): ResolvedLoadItem {
  const base = { quantity, name, sizeText, sku, unreadText };

  if (!parsed) {
    // A size was written and the shared parser declined it — or none was written at all. The two
    // are different facts and are kept apart: an unread size is a defect, a stated absence is not.
    if (sizeText) {
      return { ...base, gallons: null, kind: 'unresolved', unreadText: sizeText,
        reason: `We could not read “${sizeText}” as a size. Check the invoice.` };
    }
    return { ...base, gallons: null, kind: 'no_size_stated',
      reason: 'No container size on this line, so it is not counted as a tree.' };
  }

  // 🔴 A RANGE IS NOT A SIZE YOU CAN LOAD AGAINST. "#3/5" means one of two containers and the
  // bill of materials would differ. Refused rather than collapsed to either end.
  if (parsed.kind === 'container' && parsed.unit === 'gallon' && parsed.valueMax != null) {
    return { ...base, gallons: null, kind: 'unresolved', unreadText: sizeText,
      reason: `“${sizeText}” is a range, so the mix and posts cannot be worked out. Ask which size shipped.` };
  }

  if (parsed.kind === 'container' && parsed.unit === 'gallon' && parsed.value != null) {
    return { ...base, gallons: parsed.value, kind: 'tree', reason: null };
  }

  return { ...base, gallons: null, kind: 'other_goods',
    reason: `Sold by ${parsed.unit}, not by container — no stake, mix or bubbler counted for it.` };
}

/** The comparison key for consolidating two tree rows. Case and spacing folded for the KEY only;
 *  the DISPLAYED name stays exactly as its source wrote it (D-23). */
function treeKey(name: string, sizeText: string | null): string {
  return `${name.toLowerCase().replace(/\s+/g, ' ').trim()}|${normalizeSize(sizeText).toLowerCase()}`;
}

/**
 * T-posts for one tree of this container size. **TOTAL — every readable container size gets a
 * number.**
 *
 * 🔴 THIS WAS A TABLE OF FIVE ROWS (15·30·45·65·95) AND THAT IS WHY THE 200 GALLON LIVE OAK ON
 * SATURDAY 2026-08-29 FELL OFF THE END. A lookup answers only for the sizes somebody thought to
 * type, and every size nobody typed became a hand-work case on a printed page. David's correction,
 * 2026-09-12: *"the ladder does not stop at 95 gal … There is no upper bound and no hand-work
 * case. The rule is the container, not a lookup in a table of five sizes."* So the rule is a
 * THRESHOLD, and a 200 gallon, a 300 gallon and a size nobody has sold yet all resolve.
 *
 * ⚠️ THE 66–94 GALLON BAND IS NOT A SIZE LAWNS SELLS AND THE RULE STILL HAS TO ANSWER FOR IT.
 * David gave two anchors — 2 up to and including 65, 4 at 95 and above — and said nothing about
 * between. It reads 4, on his own standing instruction for this build (*"err large, do not
 * skimp"*): two stakes short on a tree that wanted four is a tree on the ground, and two spare
 * stakes cost nothing. Recorded because it is an INFERENCE from two anchors, not something he said.
 *
 * ⚠️ **DO NOT REACH FOR `lib/constants.ts`'s `CONTAINER_SIZES` / `LARGE_CONTAINERS`.** They exist,
 * they look like the vocabulary this needs, and they are **demo-era lists with ZERO importers**
 * (knip reports both unused) whose sizes — `60 gal`, `100 gal` — are not sizes LAWNS sells and do
 * not match David's boundaries of 65 and 95. Wiring them here would reintroduce a lookup table
 * that is both a table AND wrong. Named rather than left for the next reader to rediscover.
 */
export function tPostsFor(gallons: number): number {
  return gallons <= BOM_RULES.tPostsSmallThresholdGallons
    ? BOM_RULES.tPostsAtOrBelowThreshold
    : BOM_RULES.tPostsAboveThreshold;
}

function tallyTrees(items: ResolvedLoadItem[]): TreeTally[] {
  const by = new Map<string, TreeTally>();
  for (const it of items) {
    if (it.kind !== 'tree' || it.gallons == null) continue;
    const k = treeKey(it.name, it.sizeText);
    const existing = by.get(k);
    if (existing) { existing.quantity += it.quantity; continue; }
    by.set(k, {
      name: it.name,
      sizeText: it.sizeText ?? `${it.gallons} gallon`,
      gallons: it.gallons,
      quantity: it.quantity,
      tPosts: tPostsFor(it.gallons),
    });
  }
  // Biggest first: the yard person loads big trees before small ones, and the exceptions (the
  // sizes with no T-post rule) are almost always at the extremes where they are easiest to see.
  return [...by.values()].sort((a, b) => b.gallons - a.gallons || a.name.localeCompare(b.name));
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
}

/**
 * Build the whole day.
 *
 * 🔴 EVERY STOP APPEARS, WHATEVER STATE IT IS IN. A stop with no linked order, a stop whose lines
 * are withheld from this viewer, a stop whose read failed — each prints with a sentence saying
 * which of those it is. A six-stop day that prints five stops is the failure this exists to
 * prevent, and it is silent by nature: nothing on the page would be wrong, there would just be
 * less of it.
 */
export function buildLoadList(date: string, input: LoadStopInput[]): LoadListModel {
  const stops: LoadStop[] = [];
  let unreadStops = 0;

  for (const s of input) {
    const problem =
      !s.orderId     ? 'No order is linked to this stop, so nothing records what goes on the truck.'
      : !s.canReadLines ? 'You do not have permission to see what is on this order.'
      : !s.linesRead    ? 'We could not read what is on this order — this stop may need more than is listed.'
      : s.items.length === 0 ? 'No items are recorded on this order.'
      : null;
    if (problem && s.orderId && (!s.canReadLines || !s.linesRead)) unreadStops++;

    const items = s.items.map(resolveLoadItem);
    const trees = tallyTrees(items);
    const treeCount = trees.reduce((n, t) => n + t.quantity, 0);
    const mixGallons = trees.reduce((n, t) => n + t.gallons * t.quantity * BOM_RULES.mixRatioOfContainerVolume, 0);
    const tPosts = trees.reduce((n, t) => n + t.tPosts * t.quantity, 0);
    const unresolvedCount = items.filter(i => i.kind === 'unresolved').length;

    stops.push({
      stopId: s.stopId, customerName: s.customerName, address: s.address,
      serviceType: s.serviceType, problem, items, trees, treeCount,
      mixGallons, tPosts, unresolvedCount,
    });
  }

  const allItems = stops.flatMap(s => s.items);
  const trees = tallyTrees(allItems);
  const treeCount = trees.reduce((n, t) => n + t.quantity, 0);
  const mixGallons = trees.reduce((n, t) => n + t.gallons * t.quantity * BOM_RULES.mixRatioOfContainerVolume, 0);
  const tPosts = trees.reduce((n, t) => n + t.tPosts * t.quantity, 0);
  const unresolved = allItems.filter(i => i.kind === 'unresolved');

  return {
    date,
    stopCount: stops.length,
    stops,
    // Round UP to the next half yard. David: *"err large, do not skimp."* A yard person who runs
    // out of mix on the last tree has to drive back; a half yard over costs nothing.
    mixYards: Math.ceil((mixGallons / GALLONS_PER_CUBIC_YARD) * 2) / 2,
    mixGallons,
    trees, treeCount,
    tPosts,
    ropeFeet: tPosts * BOM_RULES.ropeFeetPerTPost,
    bubblers: treeCount * BOM_RULES.bubblersPerTree,
    totalsAreFloors: unresolved.length > 0 || unreadStops > 0,
    otherGoods:   allItems.filter(i => i.kind === 'other_goods'),
    noSizeStated: allItems.filter(i => i.kind === 'no_size_stated'),
    unresolved,
    unreadStops,
  };
}

/** Every sentence the printed page can say, in ONE place (STD-011). None of them is a blank. */
export const LOAD_LIST_COPY = {
  mixFirst: 'Loads FIRST — trees on top.',
  mixRule: 'About one container volume of mix per tree (a 45 gallon tree takes about 45 gallons).',
  tPostRule: 'T-posts are the stake kit — 2 per tree up to and including 65 gallon, 4 per tree at 95 gallon and anything larger.',
  ropeRule: 'About 4 ft of rope per T-post.',
  bubblerRule: 'One bubbler per tree.',
  noMulch: 'No mulch. Only the ingredients in the special mix.',
  /** 🔴 The deer-fence gap, printed rather than hidden. Measured 2026-09-12: nothing in the data
   *  marks a stop as needing fence — zero order lines and zero stop notes across the tenant. */
  deerFenceGap:
    'DEER FENCE — nothing recorded. Nothing in the system marks which stops need deer fence, so none is counted above. '
    + 'Add by hand: a fenced tree needs 4 T-posts in total, so a tree that already has 2 needs 2 MORE. '
    + 'Fence material is by the roll, measured as the circumference of the ring.',
  deerFence95Open:
    'At 95 gallon and above a tree already has 4 T-posts — whether deer fence needs 4 more or reuses them is not settled. Ask before loading.',
  floorsNote:
    'Something on this day could not be read, so every total above is a FLOOR. Every tree whose container size WAS read is fully counted — mix, posts, rope and bubbler, at any size. What is listed below is what we could not read at all; if any of it is a tree, the numbers above are short.',
  unresolvedHeading: 'COULD NOT WORK OUT — check these before you load',
  unresolvedWhy:
    'These lines are printed because a blank cannot be told apart from a zero. Nothing here has been counted in the totals above.',
  noSizeHeading: 'Also on these orders — no container size, so not counted as trees',
  noSizeWhy:
    'Nothing stored says whether a line is a good or a fee, so every line is shown and none is filtered away.',
  otherGoodsHeading: 'Other goods — sold by weight, volume or length',
  emptyDay: 'No stops are scheduled for this day.',
} as const;
