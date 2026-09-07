// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the ONE definition of "two rows are the same product at the same size". Used by the
//   QuickBooks catalogue adapter to FLAG collisions at import time and by the inventory grid to
//   MARK them at read time — one rule, so the screen and the import report cannot disagree.
// DEPENDENCIES: ./variantGroup (variantGroupSlug) · ./unitOfMeasure (parseUnitOfMeasure).
//   Pure: no db, no network, no clock, no DOM.
// OUTPUTS: shapeCollisionKey · ShapeCandidate · ShapeCollision · findShapeCollisions ·
//   collisionReason · moneyAtStake.
// STORY: R-101 — *the collisions are her first edits, so they live on the grid.*
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS FILE EXISTS: ONE OPERATION WAS IMPLEMENTED TWICE AND THE TWO DISAGREED.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The adapter keyed on `variantGroupSlug(name)` + the PARSED unit and found eleven collisions in
// LAWNS's 685 items. The grid keyed on `sizeGroupKey(variant_group, size.toLowerCase())` and found
// none of them — for two independent reasons, both measured 2026-09-07:
//   ① `sizeGroupKey` returns null when `variant_group` is blank, and the import wrote none, so it
//     was null on **647 of 647** rows. The rule did not run at all — an UNREACHED check, not a
//     narrow one.
//   ② Even reached, it compares the size TEXT, so `45G` and `45 gallon` are different products.
//     Brodie Juniper ($1,400 vs $1,250) and Skyward Holly ($65 vs $60) are invisible to it.
// David found the pair by eye on the Inventory screen. Nothing else would have.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 DERIVED AT READ TIME, NEVER STORED (R-101 clause ③, and it is [[R-84]]'s argument).
// ══════════════════════════════════════════════════════════════════════════════════════════
// A stored collision flag goes stale the moment the owner fixes the price: she corrects Lacey Oak
// to $1,250 and the red mark stays until somebody re-imports. Derived, **the mark clears itself**.
// It also means a collision is a property of the CATALOGUE rather than of an import — a duplicate
// typed by hand or arriving through the CSV importer is flagged identically, and the six that have
// been sitting in LAWNS's hand-made rows all along become visible for the first time.
//
// ⚠️ THIS DOES NOT REPLACE `sizeGroupKey` AND MUST NOT (R-101 clause ②). That key feeds the
// editor's PRE-WRITE uniqueness guard, which REFUSES a save. This one is a DISPLAY mark. David:
// *"the editor's uniqueness guard is a pre-write refusal, not a display mark, and widening what it
// refuses is its own decision."* Two keys, two jobs, deliberately.
// ─────────────────────────────────────────────────────────────────────────────
import { variantGroupSlug } from './variantGroup';
import { parseUnitOfMeasure } from './unitOfMeasure';

/** The minimum a row must offer. `price` is optional — a collision is a collision without one. */
export interface ShapeCandidate {
  name: string;
  size: string | null;
  price?: number | null;
}

export interface ShapeCollision<T extends ShapeCandidate> {
  key: string;
  members: T[];
  /** True when the members do not all publish the same price — the sharp case. */
  pricesDiffer: boolean;
  /** Widest gap between any two published prices, 0 when they agree or none are published.
   *  This is the SORT KEY (R-101 clause ①, and [[R-66]]'s shape — sort by money at stake). */
  moneyAtStake: number;
  reason: string;
}

/**
 * The key. Two rows collide when they share a variety name AND a parsed size.
 *
 * 🔴 THE PARSED SIZE, NOT THE SIZE TEXT, AND THAT IS THE WHOLE POINT. `45G` and `45 gallon` are
 * two spellings of one shelf; R-27 built the unit projection precisely so the platform could stop
 * caring which one somebody typed. A key over the raw string reports nine of LAWNS's eleven
 * collisions and misses Brodie Juniper and Skyward Holly — the two with a price gap and a spelling
 * difference at the same time, which is the combination that costs money.
 *
 * ⚠️ AN UNPARSEABLE SIZE FALLS BACK TO ITS LITERAL LABEL, lowercased and trimmed — never to a
 * shared "unknown" bucket. Two labels nobody could interpret are not evidence of one product, and
 * merging them would invent a collision rather than find one.
 */
export function shapeCollisionKey(name: string, size: string | null | undefined): string {
  const u = parseUnitOfMeasure(size ?? null);
  const sizeKey = u
    ? `u:${u.kind}:${u.value ?? ''}:${u.valueMax ?? ''}:${u.unit}`
    : `raw:${(size ?? '').trim().toLowerCase()}`;
  return `n:${variantGroupSlug(name)}|${sizeKey}`;
}

const priceOf = (r: ShapeCandidate): number | null =>
  typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : null;

/** The widest gap between any two PUBLISHED prices in the group. Rows with no price are ignored
 *  rather than treated as zero — a missing price is not a $0 price (itemList's own rule). */
export function moneyAtStake(members: ShapeCandidate[]): number {
  const prices = members.map(priceOf).filter((p): p is number => p !== null);
  if (prices.length < 2) return 0;
  return Math.max(...prices) - Math.min(...prices);
}

/**
 * The owner-facing sentence.
 *
 * 🔴 IT NAMES THE PRODUCT, AND THAT WAS ADDED BECAUSE ITS ABSENCE COST A MORNING. The first
 * version said "under this name and size" without ever saying WHICH, so a reader who had just seen
 * a colliding pair on the grid searched the collision list for it, found nothing, and reasonably
 * concluded the detector had missed it. It had not. A sentence about a row must be findable by the
 * name of that row.
 */
export function collisionReason(members: ShapeCandidate[]): string {
  const label = `${members[0].name}${members[0].size ? ` ${members[0].size}` : ''}`;
  const prices = new Set(members.map(m => (priceOf(m) === null ? 'null' : String(priceOf(m)))));
  if (prices.size <= 1) {
    return `${label} — QuickBooks lists ${members.length} separate products under this name and size. Both are here so you can see them; neither was chosen for you.`;
  }
  const shown = members.map(m => (priceOf(m) === null ? 'no price' : `$${priceOf(m)}`)).join(' vs ');
  return `${label} — QuickBooks lists ${members.length} separate products under this name and size, and they do not agree on price (${shown}). Both are here so you can see them; neither was chosen for you.`;
}

/**
 * Every group of two-or-more rows sharing a name and a parsed size.
 *
 * Ordered **by money at stake, biggest first** — R-101 clause ①: *"the six money ones lead, the
 * five tidy-ups don't get lost."* Ties break by member count then by key, so two runs over one
 * catalogue report in the same order.
 */
export function findShapeCollisions<T extends ShapeCandidate>(rows: T[]): ShapeCollision<T>[] {
  const byKey = new Map<string, T[]>();
  for (const r of rows) {
    const k = shapeCollisionKey(r.name, r.size);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(r); else byKey.set(k, [r]);
  }
  const out: ShapeCollision<T>[] = [];
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    const prices = new Set(members.map(m => (priceOf(m) === null ? 'null' : String(priceOf(m)))));
    out.push({
      key, members,
      pricesDiffer: prices.size > 1,
      moneyAtStake: moneyAtStake(members),
      reason: collisionReason(members),
    });
  }
  return out.sort((a, b) =>
    b.moneyAtStake - a.moneyAtStake
    || b.members.length - a.members.length
    || a.key.localeCompare(b.key));
}
