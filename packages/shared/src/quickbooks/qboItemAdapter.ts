// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: turn a QuickBooks item list into the `IncomingItem[]` the retire-and-replace planner
//   has been able to accept since it was built but has never been handed. This is THE GAP: the
//   planner is written, probed and mutant-covered, and nothing has ever adapted real data into
//   it. Three jobs, in order — exclude the category FOLDERS, read the product's real name and
//   size out of `Description`, and FLAG the items that collide instead of silently dropping one.
// DEPENDENCIES: ./itemList (QboItemRow) · ../inventory/unitOfMeasure (parseUnitOfMeasure) ·
//   ../inventory/variantGroup (variantGroupSlug) · ../inventory/retireAndReplace (IncomingItem).
//   Pure: no db, no network, no env, no clock, no DOM.
// OUTPUTS: SizeState · AdaptedItem · ItemCollision · AdaptedItemList · adaptQboItems ·
//   readProductFromDescription.
// STORY: user_stories.md → *Her own catalogue, from her own books* (2.3, asset-inventory-pmi).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE JOIN FIELD IS `Description`, NOT `Sku`, AND TWO WRITTEN CLAIMS SAID OTHERWISE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// MEASURED against LAWNS's complete capture (`qbo-items-9341455222430707-2026-09-04`, 685 items,
// `complete: true`): **`Sku` is on 2 of 685. `Description` is on 632 of 685.**
//   · `docs/RULINGS.md` R-70: *"the 685 QuickBooks items, which carry SKUs"* — FALSE.
//   · `retireAndReplace.ts`: *"The 685 QuickBooks items ALL have SKUs."* — FALSE.
// Both corrected in this pass. This is R-26's shape — a written declaration nobody checked
// against reality, steering a decision — inside the file R-70 itself built.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE ADAPTER'S JOB IS EXTRACTING SIZE, NOT MATCHING OLD TO NEW.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Every existing row retires (R-A), so there is nothing to match against. What is left is the
// job nothing else can do: **without a size, all 647 rows arrive size-less**, and `size` is what
// the unit projection reads (`unit_parsed_from`), what every ladder groups on, and what the
// uppot plan splits by. A catalogue with no sizes is a list of names.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THREE SIZE STATES, NEVER TWO.
// ══════════════════════════════════════════════════════════════════════════════════════════
// STANDARDS.md §6/R1: *"A READ WHOSE ERROR PATH RETURNS A VALUE MUST KEEP 'FAILED'
// DISTINGUISHABLE FROM 'EMPTY.'"* So:
//   · `sized`          — a size expression was found and `parseUnitOfMeasure` read it.
//   · `not_stated`     — the description was read in full and states no size. "Deer Fencing" has
//                        no size, and saying so is a true answer about the product.
//   · `could_not_read` — either there is NO description to read (15 items), or a size-shaped
//                        token was found at the end and the parser DECLINED it ("450 sq. ft",
//                        "20-20-20 Water Soluble Fertilizer"). We looked and failed.
// Collapsing the last two into one blank would tell Lauren her fertiliser has no size when what
// actually happened is that we could not read the one it has.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ EXTRACTION IS LOCAL; INTERPRETATION IS NOT. R-27 IS OBEYED BY A CLEAN SPLIT.
// ══════════════════════════════════════════════════════════════════════════════════════════
// R-27: size stays the stored value and the unit columns are derived from it *through
// `parseUnitOfMeasure` and no other*. This file therefore contains **no unit vocabulary** — no
// list of "gallon/gal/g", no size grammar, no second parse. What it owns is purely positional:
// WHERE in a sentence a size sits. Every candidate it finds is handed to `parseUnitOfMeasure`,
// and that function alone says yes or no. Adding a unit word to this file would be the second
// implementation R-27 forbids; adding one to `unitOfMeasure.ts` is how the vocabulary grows.
// ─────────────────────────────────────────────────────────────────────────────
import type { QboItemRow } from './itemList';
import { parseUnitOfMeasure } from '../inventory/unitOfMeasure';
import { variantGroupSlug } from '../inventory/variantGroup';
import type { IncomingItem } from '../inventory/retireAndReplace';

/** How confident we are about this product's size. Three states — see the header. */
export type SizeState = 'sized' | 'not_stated' | 'could_not_read';

/** The owner-facing sentence for each state, in ONE place so the report, the grid and any future
 *  surface cannot describe the same fact three ways (STD-011). */
export const SIZE_STATE_NOTE: Record<SizeState, string> = {
  sized:          'Size read from the QuickBooks description.',
  not_stated:     'QuickBooks does not state a size for this product.',
  could_not_read: 'We could not read a size for this product — check it before you rely on it.',
};

/** What one QuickBooks item becomes, plus the provenance that makes the result checkable. */
export interface AdaptedItem extends IncomingItem {
  /** Intuit's own `Type`, carried through so the report can say what kind of thing this is. */
  qboType: string | null;
  /** Intuit's `FullyQualifiedName` — what tells two identically-named items apart on screen. */
  fullyQualifiedName: string | null;
  /** The item's published price, or null. NEVER coerced to 0 (itemList's own rule). */
  unitPrice: number | null;
  /** The description the name and size were read out of. Null when the item had none. */
  sourceDescription: string | null;
  sizeState: SizeState;
  /** The literal fragment we tried to read as a size, when we tried and failed. Null otherwise.
   *  This is what makes `could_not_read` actionable rather than merely honest. */
  unreadSizeText: string | null;
}

/** Two or more items that would occupy the SAME catalogue row. Every member is created; the
 *  collision is REPORTED. See the ruling block on `adaptQboItems`. */
export interface ItemCollision {
  /** The shared name+size shape, as the planner computes it. */
  shapeKey: string;
  members: AdaptedItem[];
  /** True when the members do not all publish the same price — the sharp case. */
  pricesDiffer: boolean;
  reason: string;
}

export interface AdaptedItemList {
  items: AdaptedItem[];
  collisions: ItemCollision[];
  counts: {
    /** Everything QuickBooks returned. */
    readIn: number;
    /** `Type: 'Category'` — the hierarchy, excluded. */
    categories: number;
    /** What an invoice line can point at, and what becomes a catalogue row. */
    sellable: number;
    sized: number;
    notStated: number;
    couldNotRead: number;
    /** Items involved in a collision (2 for one pair, not 1). */
    collidingItems: number;
    /** Of those, the ones whose members disagree about price. */
    collisionsWithPriceDifference: number;
  };
}

// ── SIZE EXTRACTION — POSITION ONLY ───────────────────────────────────────────────────────────
//
// A size sits at the END of these descriptions, after a separator that is inconsistent and always
// will be: "Afgan Black Pine, 45 Gallon" · "Prime Ark Traveller Blackberry - 5 Gallon" ·
// "Blue Point Juniper 1 gallon" · "Royal Purple Bougainvillea - 3gal" · "Bougainvillea Elizabeth
// Agnus 3G" · "Mexican Buckeye 10/15 gallon". Splitting on a separator cannot cover that set.
// So: walk the trailing words and ask `parseUnitOfMeasure` about each candidate.

/** How many trailing words can make up a size. "10/15 gallon" is 2; "1/2 Yard Scoop" is 3. Four
 *  is one more than the longest real one, so the ceiling is not the thing doing the work. */
const MAX_SIZE_WORDS = 4;

/**
 * A candidate must BEGIN with a digit (optionally behind `#` or `[`).
 *
 * 🔴 THIS IS THE ANCHOR, AND IT IS DOING TWO JOBS THAT BOTH MATTER.
 *
 * ① It is why the scan runs SHORTEST-FIRST without eating the sentence. `parseUnitOfMeasure` is
 *    deliberately permissive — it finds a size INSIDE a longer string — so a longest-first scan
 *    read "myrtle - 15 gallon" as a size and left "Natchez Crape" as the name. Measured: 24 rows
 *    got a size of `"myrtle - 15 gallon"` that way. Shortest-first plus this anchor gets
 *    `"15 gallon"` and a name of `"Natchez Crape Myrtle"`.
 *
 * ② It refuses a BARE TRAILING NUMBER. `parseUnitOfMeasure('15')` legitimately returns 15 gallon
 *    — inside a size cell that is the right reading. At the end of a prose description it is not:
 *    "…4# p 1000 Heritage G" would become a 1000-gallon container. A size at the end of a
 *    sentence has to announce itself with a unit or a `#`, or we are guessing.
 *
 * ⚠️ It is POSITIONAL, not lexical. It contains no unit word, so it does not fork the vocabulary
 *    (R-27). Teach `unitOfMeasure.ts` a new unit and this file picks it up for free.
 */
const CANDIDATE_STARTS_A_SIZE = /^[#[]?\s*\d/;

/** A bare number with no unit and no `#` marker — a quantity in prose, not a size. */
const BARE_NUMBER = /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/;

/**
 * A trailing parenthetical is a REMARK, and it is stripped before the scan begins.
 *
 * 🔴 FOUND BY A MUTANT, NOT BY READING, AND IT WAS A CONFIDENTLY WRONG SIZE — THE WORST KIND.
 * `SRO300`'s description is *"Shumard Red Oak - 300gal (48" Box)"*. The scan reached `48" Box)`
 * first, `parseUnitOfMeasure` reads `box` as a container unit, and the row landed as a **48 BOX**
 * — for a tree that is a **300-gallon** Shumard Red Oak. Not a refusal, not a blank: a wrong
 * number with a unit beside it. Two Yaupon Hollies had the same shape with a height remark
 * (`- 65 Gallon (8'-10')`) and were refused outright when their size was plainly stated.
 *
 * The remark is stripped repeatedly, so `"3 Gallon (Red) (20% off)"` loses both. It is POSITIONAL
 * — it says a bracketed aside at the end of a sentence is not the sentence's subject — and so it
 * forks no unit vocabulary (R-27). A bracketed KIT like `[2 T-Posts]` uses SQUARE brackets and is
 * untouched by this.
 */
const TRAILING_PARENTHETICAL = /\s*\([^()]*\)\s*$/;

export interface ProductRead {
  /** The product's name with the size removed. Null only when there was nothing to read. */
  name: string | null;
  /** The size EXACTLY as QuickBooks wrote it. Never normalised — D-23, faithful before connected:
   *  `size` remains the owner's own string and the unit columns are derived FROM it. */
  size: string | null;
  state: SizeState;
  /** The fragment we tried and failed to read. Null unless `state === 'could_not_read'`. */
  unreadSizeText: string | null;
}

/**
 * Read a product's name and size out of one QuickBooks description.
 *
 * Exported because it is the whole of the risk in this file and deserves to be probed directly.
 */
export function readProductFromDescription(raw: string | null | undefined): ProductRead {
  const flat = String(raw ?? '').replace(/\s+/g, ' ').trim();
  // No description at all: we did not read a size because there was nothing to read from. That is
  // a FAILED read, not an empty one — the item may well have a size nobody wrote down.
  if (flat === '') return { name: null, size: null, state: 'could_not_read', unreadSizeText: null };

  // Drop trailing remarks before looking for a size. See TRAILING_PARENTHETICAL.
  let stripped = flat;
  for (;;) {
    const next = stripped.replace(TRAILING_PARENTHETICAL, '').trim();
    if (next === stripped || next === '') break;
    stripped = next;
  }

  const body = stripped.replace(/[.,;\s]+$/, '');
  const words = body.split(' ');

  for (let k = 1; k <= Math.min(MAX_SIZE_WORDS, words.length); k++) {
    const candidate = words.slice(words.length - k).join(' ').replace(/^[-–—,:(]+\s*/, '').trim();
    if (candidate === '' || !CANDIDATE_STARTS_A_SIZE.test(candidate)) continue;
    if (BARE_NUMBER.test(candidate)) continue;

    // FIRST size-shaped candidate decides the outcome, in BOTH directions. If the parser reads
    // it we have a size; if it declines, we STOP and report `could_not_read` rather than walking
    // further back into the sentence — continuing would find a size somewhere in the middle of a
    // fertiliser name and present it as this product's container. Looking harder is how a scan
    // manufactures a confident wrong answer.
    if (parseUnitOfMeasure(candidate)) {
      const name = words.slice(0, words.length - k).join(' ').replace(/[-–—,:(\s]+$/, '').trim();
      // "45 Gallon" with nothing in front of it is a size and no product. Keep the whole string as
      // the name rather than minting a nameless row.
      if (name === '') return { name: body, size: null, state: 'not_stated', unreadSizeText: null };
      return { name, size: candidate, state: 'sized', unreadSizeText: null };
    }
    return { name: body, size: null, state: 'could_not_read', unreadSizeText: candidate };
  }

  // Read in full, no size-shaped token anywhere at the end. The product genuinely states no size.
  return { name: body, size: null, state: 'not_stated', unreadSizeText: null };
}

/**
 * The planner's own shape key, recomputed here so a collision is detected on EXACTLY the identity
 * the create loop would have collapsed on. Duplicating the arithmetic in a different shape would
 * flag collisions the planner does not have and miss the ones it does.
 */
function shapeKeyOf(name: string, size: string | null): string {
  const u = parseUnitOfMeasure(size);
  const sizeKey = u
    ? `u:${u.kind}:${u.value ?? ''}:${u.valueMax ?? ''}:${u.unit}`
    : `raw:${(size ?? '').trim().toLowerCase()}`;
  return `n:${variantGroupSlug(name)}|${sizeKey}`;
}

/**
 * Adapt a QuickBooks item list into catalogue rows.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CATEGORY FOLDERS ARE EXCLUDED. IT IS A FILTER, NOT A JUDGEMENT.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * `Type: 'Category'` is QuickBooks' word for a FOLDER — Oak, Maple, Chemicals. It cannot be an
 * invoice line's `ItemRef` and it is not a thing anybody sells. MEASURED on LAWNS: 685 =
 * 500 NonInventory + 147 Service + 38 Category → **647 sellable**. Nothing in the planner knew
 * this, so all 38 folders would have become catalogue rows.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EVERY SELLABLE ITEM BECOMES A ROW. A COLLISION IS FLAGGED, NEVER RESOLVED HERE.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * David's ruling on `NZCM30`, the case he found: *"CREATE BOTH, FLAG BOTH… Surface, don't decide:
 * two rows and a collision flag beats one row and silence."*
 *
 * 🔴 AND IT IS NOT ONE CASE. MEASURED, 2026-09-06, over the same capture: **TWELVE shapes
 * collide, and SEVEN of them publish different prices.** The three worst are not the one he saw:
 *     Lacey Oak 45 Gallon      $1,250 (NonInventory, Id 756)  vs  $375 (Service, Id 76)
 *     Shumard Red Oak 45 gallon $1,250 (NonInventory, Id 928) vs  $500 (Service, Id 83)
 *     Lacey Oak 30 Gallon        $900 (NonInventory, Id 753)  vs  $350 (Service, Id 75)
 * The planner's create loop is first-writer-wins, so it kept the CHEAPER row and dropped the
 * dearer one — an $875 pricing error, with no finding, no count and nothing on screen. R-C's
 * reasoning is what generalises; NZCM30 was the instance.
 *
 * ⚠️ THE PLANNER'S CONSUMPTION IS STILL CORRECT WHERE IT APPLIES, AND THIS IS HOW THE TWO ARE
 * SEPARATED. Its `consumedShapes`/`consumedSkus` exist to stop ONE product being created twice —
 * genuinely right when the same thing appears under a Category folder and again at top level.
 * The separation is not a heuristic about which duplicate is real: **the identity is
 * `qb_item_id`.** Two Intuit ids are two products in her books, whatever they are named, so each
 * gets its own row and the pair is flagged. The planner is not asked to tell them apart, because
 * with a per-item identity it never has to — one QuickBooks item, one row, always.
 */
export function adaptQboItems(rows: QboItemRow[]): AdaptedItemList {
  const items: AdaptedItem[] = [];
  let categories = 0;

  for (const row of rows) {
    // Case-insensitive: comparing against Intuit's casing is the bug class `normalizeSize` exists
    // for, and `summariseItems` already counts categories this exact way.
    if ((row.type ?? '').toLowerCase() === 'category') { categories++; continue; }

    const read = readProductFromDescription(row.description);
    items.push({
      qboId: row.id,
      sku: row.sku,
      // Fall back to Intuit's `Name` when there is no description — the shorthand code is a poor
      // catalogue name, and it is still better than a blank row. NOT NULL in the database.
      name: read.name ?? row.name,
      size: read.size,
      qboType: row.type,
      fullyQualifiedName: row.fullyQualifiedName,
      unitPrice: row.unitPrice,
      sourceDescription: row.description,
      sizeState: read.state,
      unreadSizeText: read.unreadSizeText,
    });
  }

  // ── collisions ──────────────────────────────────────────────────────────────────────────────
  const byShape = new Map<string, AdaptedItem[]>();
  for (const it of items) {
    const k = shapeKeyOf(it.name, it.size);
    const bucket = byShape.get(k);
    if (bucket) bucket.push(it); else byShape.set(k, [it]);
  }

  const collisions: ItemCollision[] = [];
  for (const [shapeKey, members] of byShape) {
    if (members.length < 2) continue;
    const prices = new Set(members.map(m => (m.unitPrice === null ? 'null' : String(m.unitPrice))));
    const pricesDiffer = prices.size > 1;
    collisions.push({
      shapeKey,
      members,
      pricesDiffer,
      reason: pricesDiffer
        // The money is named because it is the reason this is urgent rather than untidy.
        ? `QuickBooks lists ${members.length} separate products under this name and size, and they do not agree on price (${members.map(m => (m.unitPrice === null ? 'no price' : `$${m.unitPrice}`)).join(' vs ')}). Both are here so you can see them; neither was chosen for you.`
        : `QuickBooks lists ${members.length} separate products under this name and size. Both are here so you can see them; neither was chosen for you.`,
    });
  }
  // Biggest first, then by key, so two runs over one list report in the same order.
  collisions.sort((a, b) => b.members.length - a.members.length || a.shapeKey.localeCompare(b.shapeKey));

  const sized        = items.filter(i => i.sizeState === 'sized').length;
  const notStated    = items.filter(i => i.sizeState === 'not_stated').length;
  const couldNotRead = items.filter(i => i.sizeState === 'could_not_read').length;

  return {
    items,
    collisions,
    counts: {
      readIn: rows.length,
      categories,
      sellable: items.length,
      sized,
      notStated,
      couldNotRead,
      collidingItems: collisions.reduce((n, c) => n + c.members.length, 0),
      collisionsWithPriceDifference: collisions.filter(c => c.pricesDiffer).length,
    },
  };
}
