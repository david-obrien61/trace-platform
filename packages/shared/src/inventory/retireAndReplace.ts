// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: decide what happens to every existing inventory row when a business's real product
//   list arrives from QuickBooks. David's ruling: the 447 rows from the 2026-08-25 price-list
//   import — source never identified, 443 at quantity zero, no SKUs, six duplicate name+size
//   pairs — are RETIRED AND REPLACED by the 685 QuickBooks items, which carry SKUs, prices,
//   descriptions and a category hierarchy.
// DEPENDENCIES: ./variantGroup (variantGroupSlug) · ./unitOfMeasure (parseUnitOfMeasure).
//   Pure: no db, no network, no env, no clock, no DOM.
// OUTPUTS: Disposition · ExistingRow · IncomingItem · RetireReplacePlan · planRetireAndReplace.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 RETIRE, NEVER HARD-DELETE — AND THAT IS ENFORCED BY THE TYPE, NOT BY DISCIPLINE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// There is no `delete` disposition. A caller cannot act on one because the plan cannot express
// one. The 447 rows are evidence of what someone typed, and a row nobody can explain is still a
// row somebody made — the fix for a bad import is not a second irreversible act.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A ROW CARRYING A REAL COUNT IS NEVER RETIRED. THAT IS THE DATA NOBODY CAN RECREATE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CORRECTED 2026-09-06, AND THE RULE ABOVE IS NOW SUPERSEDED FOR LAWNS BY R-94.
//   ① "Four of the 447" WAS WRONG — it is TWO. Measured live 2026-09-06: `qty > 0` returns Brodie
//      Juniper 30 gallon (qty 1) and Arizona Cypress, Blue Ice 30 gallon (qty 1), and nothing
//      else. The two rows people confuse them with are `status='archived'` at qty ZERO.
//   ② R-94 (David, 2026-09-06): *"ALL 447 RETIRE. NO EXCEPTIONS. The two rows carrying a count are
//      MY test data — I put them there to see whether the inventory widget worked."* This clause
//      exists to protect a count nobody could walk a lot twice to recreate; one tree apiece, put
//      there to test a widget, is not that. The catalogue import (`itemImportWriter.ts`) therefore
//      retires on `business_id` + `retired_at IS NULL` and does not consult this planner's
//      adopt/carry buckets at all.
// The rule stays HERE, unweakened, because it is right for the general case and for the next
// tenant — a business with real counted stock must never lose it to a price-list replacement.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE SHARP ONE: A COUNTED ROW THAT MATCHES AN INCOMING ITEM IS *ADOPTED*, NOT CARRIED
//    ALONGSIDE A NEW ONE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The obvious reading of "keep counted rows, create the 685" produces TWO rows for one product —
// the counted row and its QuickBooks twin — and the on-hand is then split across them. That is
// exactly tech-debt #56/#58's live defect (*"two spellings of one physical size, on-hand split
// across both"*) manufactured deliberately at import time, on the one row whose number matters.
//
// So a counted row that matches an incoming item ADOPTS its identity: the row survives with its
// count, and takes the SKU and the QuickBooks id. **No second row is created for it**, and the
// plan proves that by conservation rather than asserting it.
//
// ⚠️ AND A COUNTED ROW MATCHING NOTHING IS *CARRIED*, WHICH IS A FINDING RATHER THAN A TIDY-UP.
// It is stock the business physically has and its accounting system has never heard of. It is
// kept and NAMED, because deleting it loses a count and silently keeping it hides a discrepancy.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ MATCHING IS BY SKU, ELSE BY NAME-SLUG + PARSED UNIT — AND NEVER BY RAW STRING EQUALITY.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `30 gal` and `30 Gallon` are the same shelf. Raw equality would treat them as different
// products and create a duplicate for each — the defect this file exists to avoid, arriving
// through the matcher instead of through the plan. Both normalisers are REUSED, never re-written:
// `variantGroupSlug` for the name and `parseUnitOfMeasure` for the size (§6 r8).
//
// ⚠️ AN UNPARSEABLE SIZE DOES NOT MATCH A PARSED ONE. `parseUnitOfMeasure` returns null for a
// label it does not understand, and treating two nulls as equal would make every unrecognised
// size match every other unrecognised size of the same name — merging things nobody compared.
// Null matches null ONLY when the raw labels are also equal after trimming and casing.
// ─────────────────────────────────────────────────────────────────────────────
import { variantGroupSlug } from './variantGroup';
import { parseUnitOfMeasure } from './unitOfMeasure';

/** What happens to a row. 🔴 There is deliberately no `delete`. */
export type Disposition = 'adopt' | 'carry' | 'retire' | 'create';

export interface ExistingRow {
  id: string;
  sku: string | null;
  name: string;
  size: string | null;
  /** The physical count. `> 0` makes this row irreplaceable. */
  qty: number;
}

export interface IncomingItem {
  /** Intuit's Item.Id — the stable identity, unlike a name an owner edits. */
  qboId: string;
  sku: string | null;
  name: string;
  size: string | null;
}

export interface RetireReplacePlan {
  /** Counted rows that ARE in QuickBooks: keep the row and its count, take the QB identity. */
  adopt: { existing: ExistingRow; incoming: IncomingItem; reason: string }[];
  /** Counted rows QuickBooks has never heard of. Kept and NAMED — a finding, not a tidy-up. */
  carry: { existing: ExistingRow; reason: string }[];
  /** Uncounted rows superseded by the real list. Retired, never deleted. */
  retire: { existing: ExistingRow; reason: string }[];
  /** QuickBooks items with no surviving counterpart. */
  create: { incoming: IncomingItem; reason: string }[];
  counts: {
    adopted: number; carried: number; retired: number; created: number;
    /** What went IN, so a reader can check the split adds up rather than trusting it. */
    existingIn: number; incomingIn: number;
  };
}

/**
 * 🔴 MATCHING IS TWO PASSES, AND THE REASON IS THE ONE FACT THAT DEFINES THIS DATA SET.
 *
 * 🔴 CORRECTED 2026-09-06 — THE SECOND HALF OF THIS SENTENCE WAS FALSE AND IT WAS LOAD-BEARING.
 * It said: *"The 447 existing rows have NO SKUs. The 685 QuickBooks items ALL have SKUs."*
 * MEASURED against LAWNS's complete capture (`qbo-items-9341455222430707-2026-09-04`, 685 items,
 * `complete: true`): **`Sku` is present on 2 of 685.** `docs/RULINGS.md` R-70 carried the same
 * claim (*"the 685 QuickBooks items, which carry SKUs"*) and `itemList.ts` carried a third
 * version of it. All three are corrected; the real join field is `Description`, on 632 of 685.
 *
 * ✏️ THE TWO-PASS DESIGN BELOW IS STILL CORRECT — it is the REASON that changed, not the code.
 * A single "SKU wins if present" key is asymmetric whenever the two sides carry SKUs at different
 * rates, and 447-with-none against 685-with-two is a more extreme version of that, not a milder
 * one. Nothing would ever match, every counted row would be retired and duplicated, and the
 * on-hand would split across two rows — precisely the defect this file exists to prevent,
 * arriving through the matcher instead of through the plan.
 *
 * ✏️ It was written that way in the first draft and caught by the §C probe, not by reading.
 *
 * So: SKU is used ONLY when BOTH sides carry one, in a first pass; everything unmatched then
 * falls back to name-slug + parsed unit. A product whose SKU changed still matches by name and
 * size, and a product renamed in QuickBooks still matches by SKU.
 */
function skuKey(sku: string | null): string | null {
  const s = (sku ?? '').trim().toLowerCase();
  return s ? `sku:${s}` : null;
}

function shapeKey(name: string, size: string | null): string {
  const u = parseUnitOfMeasure(size);
  // A parsed size compares by MEANING; an unparseable one compares by its literal label, so two
  // labels nobody could interpret are never silently merged.
  const sizeKey = u
    ? `u:${u.kind}:${u.value ?? ''}:${u.valueMax ?? ''}:${u.unit}`
    : `raw:${(size ?? '').trim().toLowerCase()}`;
  return `n:${variantGroupSlug(name)}|${sizeKey}`;
}

/**
 * Plan the replacement.
 *
 * 🔴 CONSERVATION IS THE CONTRACT: every existing row lands in exactly one of adopt/carry/retire,
 * and every incoming item in exactly one of adopt/create. A plan that loses a row or double-counts
 * one is worse than no plan, because the report would still add up on screen.
 */
export function planRetireAndReplace(
  existing: ExistingRow[],
  incoming: IncomingItem[],
): RetireReplacePlan {
  // Two indexes, one per pass. FIRST WRITER WINS in both: the QuickBooks list can itself carry
  // two spellings of one product, and consuming the same incoming item twice would adopt it onto
  // two different rows.
  const bySku   = new Map<string, IncomingItem>();
  const byShape = new Map<string, IncomingItem>();
  for (const item of incoming) {
    const sk = skuKey(item.sku);
    if (sk && !bySku.has(sk)) bySku.set(sk, item);
    const shk = shapeKey(item.name, item.size);
    if (!byShape.has(shk)) byShape.set(shk, item);
  }

  // 🔴 THREE CONSUMPTION SETS, NOT ONE, AND THE SHAPE SET IS THE ONE THAT WAS MISSING.
  // Tracking only the qboId lets a product QuickBooks lists TWICE under two ids slip through:
  // the first id is adopted onto the counted row, the second is not "taken", and a second row is
  // created for it — splitting the on-hand by a duplicate WE imported. Consuming the SHAPE (and
  // the SKU) at the moment a match is taken is what closes it.
  const takenIds       = new Set<string>();
  const consumedShapes = new Set<string>();
  const consumedSkus   = new Set<string>();

  const consume = (item: IncomingItem) => {
    takenIds.add(item.qboId);
    consumedShapes.add(shapeKey(item.name, item.size));
    const sk = skuKey(item.sku);
    if (sk) consumedSkus.add(sk);
  };

  const matchFor = (row: ExistingRow): IncomingItem | undefined => {
    const sk = skuKey(row.sku);
    const bySkuHit = sk ? bySku.get(sk) : undefined;
    if (bySkuHit && !takenIds.has(bySkuHit.qboId)) return bySkuHit;
    const byShapeHit = byShape.get(shapeKey(row.name, row.size));
    if (byShapeHit && !takenIds.has(byShapeHit.qboId)) return byShapeHit;
    return undefined;
  };

  const plan: RetireReplacePlan = {
    adopt: [], carry: [], retire: [], create: [],
    counts: { adopted: 0, carried: 0, retired: 0, created: 0,
              existingIn: existing.length, incomingIn: incoming.length },
  };

  for (const row of existing) {
    const match = matchFor(row);
    const counted = Number.isFinite(row.qty) && row.qty > 0;

    // 🔴 THE COUNT IS CHECKED FIRST AND WINS. Everything below is about a row nobody has counted.
    if (counted) {
      if (match) {
        consume(match);
        plan.adopt.push({ existing: row, incoming: match,
          reason: `Kept — ${row.qty} on hand. This is the same product as your QuickBooks item, so the row keeps its count and takes the QuickBooks details rather than a second row being made for it.` });
      } else {
        plan.carry.push({ existing: row,
          reason: `Kept — ${row.qty} on hand, and QuickBooks has no matching product. Nothing was changed about it. Worth a look: you are holding stock your accounting system does not list.` });
      }
      continue;
    }

    // Uncounted. Superseded by the real list — retired, never deleted.
    //
    // 🔴 AND THE MATCH IS DELIBERATELY *NOT* CONSUMED HERE. That is the REPLACE half: the old row
    // is hidden and the QuickBooks item is created fresh, carrying the SKU, price and description
    // the old row never had. Consuming it would retire the row AND suppress its replacement, so
    // the product would disappear from the catalogue altogether — a silent deletion dressed up as
    // a retirement, on a build whose first rule is that nothing is deleted.
    //
    // ✏️ The first draft DID consume here. No probe covered it; the mutation harness did (T10),
    // by flagging the line's REMOVAL as an improvement rather than a regression.
    plan.retire.push({ existing: row,
      reason: match
        ? 'Retired — nothing on hand, and QuickBooks has this product with its own details. It is hidden, not deleted.'
        : 'Retired — nothing on hand, and it is not in your QuickBooks product list. It is hidden, not deleted.' });
  }

  // Anything not already adopted becomes a new row — including the replacement for every retired
  // row. A product QuickBooks lists TWICE (under two ids, or twice under one SKU) is created ONCE.
  for (const item of incoming) {
    const shk = shapeKey(item.name, item.size);
    const sk  = skuKey(item.sku);
    // `consumedShapes`/`consumedSkus` hold only what was ADOPTED plus what has already been
    // created in this loop, so this suppresses duplicates without suppressing replacements.
    if (consumedShapes.has(shk) || (sk && consumedSkus.has(sk))) continue;
    consume(item);
    plan.create.push({ incoming: item, reason: 'Added from your QuickBooks product list.' });
  }

  plan.counts.adopted = plan.adopt.length;
  plan.counts.carried = plan.carry.length;
  plan.counts.retired = plan.retire.length;
  plan.counts.created = plan.create.length;
  return plan;
}
