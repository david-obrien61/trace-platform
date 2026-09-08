// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: measure what a business gives away, and — the actual finding — HOW MANY DIFFERENT WAYS
//   it records doing so. A line that charged $0 is a decision somebody made; when the same
//   decision is written three different ways on three different invoices, **nothing can add them
//   up**, and the business holds no figure at all for what that policy costs.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow · mentionsReplacement) · ./itemList (QboItemRow).
//   Pure: no db, no network, no clock, no DOM.
// OUTPUTS: GiveawayShape · GIVEAWAY_SHAPES · GiveawayCensus · censusGiveawayLines.
// STORY: *David rehearses the import on a saved copy* (`user_stories.md`, ARC: ocr-doc-routing).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 IT VALUES AT COST OR IT DOES NOT VALUE AT ALL — DAVID'S RULING, AND IT CHANGES THE NUMBER
//    BY A FACTOR OF THREE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Every one of these lines carries an item whose catalogue price is a RETAIL price, and totalling
// those would print *"$48,000 of warranty"* for something that cost the business the price of
// growing or buying the plant. David: *"Saying '$48,000 of warranty' when it is $16,000 of cost is
// the overstatement Lauren already caught once."*
//
// So: `costTotal` is populated **only when every counted line's item publishes a purchase cost**.
// A partial total is not a smaller truth, it is a DIFFERENT number wearing the same label — and
// once it is on the page nobody reading it knows which lines it covers. When coverage is partial
// the census reports the count, reports how many lines have no recorded cost, and leaves the money
// unstated. `costTotal === null` is the honest answer and the consumer says so out loud.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 AND THE METHOD IS STATED, BECAUSE THE THING IT CANNOT SEE IS THE INTERESTING PART.
// ══════════════════════════════════════════════════════════════════════════════════════════
// A $0 line whose item says nothing and whose wording says nothing is **counted as
// `nothing-names-it`, never dropped**. On LAWNS that is one line — an item coded `BPJ30REP`, which
// a person can read as a replacement and no rule can. It is reported so its owner can tell us
// whether there is a FOURTH way we have not seen, instead of us silently deciding there is not.
//
// ⚠️ NO WORD IS INVENTED FOR AN ITEM CODE. Reading `…REP` as *"replacement"* would work on these
// rows and be a rule nobody agreed to (R-50 — retro-classification arriving as a helpful default).
// The census says *we could not read it*, which is true, and which is actionable.
// ─────────────────────────────────────────────────────────────────────────────
import { mentionsReplacement, type QboInvoiceRow } from './invoiceList';
import type { QboItemRow } from './itemList';

/**
 * The three ways a giveaway can be recorded, in decreasing order of how easily a REPORT could add
 * them up. That order is the finding: only the first is visible to anything that reads the item.
 */
export const GIVEAWAY_SHAPES = {
  'item-names-it':    'the item itself says what it is',
  'wording-names-it': 'only the line’s wording says what it is',
  'nothing-names-it': 'neither the item nor the wording says what it is',
} as const;
export type GiveawayShape = keyof typeof GIVEAWAY_SHAPES;

export interface GiveawayCensus {
  /** Lines that charged $0 and carried a real item. The population, and the denominator. */
  lines: number;
  /** How many invoices those lines sit on. */
  invoices: number;
  /** Lines per shape. The three sum to `lines` — a line is classified exactly once. */
  byShape: Record<GiveawayShape, number>;
  /** How many of the three shapes actually OCCUR. `> 1` is the finding. */
  shapesInUse: number;
  /** Distinct item ids used across the giveaway lines — *"and it is not always the same item"*. */
  distinctItems: number;
  /** Earliest and latest `TxnDate` among them, so the finding names the period it covers. */
  first: string | null;
  last: string | null;
  /** See the header. Populated ONLY when every counted line's item publishes a purchase cost. */
  costTotal: number | null;
  /** How many counted lines have no recorded cost — the reason `costTotal` is null when it is. */
  linesWithoutCost: number;
  /**
   * 🔴 WHAT THE RETAIL TOTAL WOULD HAVE BEEN, CARRIED SO THE OVERSTATEMENT IS VISIBLE RATHER THAN
   * MERELY AVOIDED. It is NEVER the finding's value and no consumer may print it as the cost — it
   * exists so the gap between the two framings can be shown to David, who ruled on it. Null when
   * no counted line's item publishes a price.
   */
  retailTotalNotToBeQuoted: number | null;
}

/** `Description` is not on the parsed line (prose is dropped), so the wording arrives as a flag. */
function shapeOf(itemName: string | null, itemDescription: string | null, wordingSaysSo: boolean): GiveawayShape {
  // The ITEM is checked first because it is the only shape a report reading the catalogue could
  // ever total. `description` here is the ITEM's own description from the product list — not the
  // invoice line's, which never reaches this module.
  if (mentionsReplacement(itemName) || mentionsReplacement(itemDescription)) return 'item-names-it';
  if (wordingSaysSo) return 'wording-names-it';
  return 'nothing-names-it';
}

/**
 * Census the $0 goods lines across an invoice history.
 *
 * ⚠️ THE POPULATION IS `amount === 0` **AND** A REAL `itemId`. A `DescriptionOnly` note is $0 and
 * is not a giveaway; a subtotal is $0 and is not a giveaway. Including them would inflate the
 * count with lines nobody decided anything about — the same filter `pricedLines` applies from the
 * other direction, and for the same reason.
 *
 * ⚠️ AND A NULL AMOUNT IS NOT A ZERO AMOUNT. A line whose amount we could not read is skipped
 * rather than counted as free (D-9 / A9) — asserting somebody gave something away is a claim, and
 * an unreadable field is not evidence for it.
 */
export function censusGiveawayLines(invoices: QboInvoiceRow[], items: QboItemRow[]): GiveawayCensus {
  const byId = new Map<string, QboItemRow>();
  for (const it of items) byId.set(it.id, it);

  const byShape: Record<GiveawayShape, number> = { 'item-names-it': 0, 'wording-names-it': 0, 'nothing-names-it': 0 };
  const invoiceIds = new Set<string>();
  const itemIds = new Set<string>();
  let lines = 0, linesWithoutCost = 0;
  let costSum = 0, retailSum = 0, retailLines = 0;
  let first: string | null = null, last: string | null = null;

  for (const inv of invoices) {
    for (const l of inv.lines) {
      if (l.itemId === null) continue;
      if (l.amount === null || l.amount !== 0) continue;
      lines++;
      invoiceIds.add(inv.id);
      itemIds.add(l.itemId);
      const item = byId.get(l.itemId) ?? null;
      byShape[shapeOf(l.itemName ?? item?.name ?? null, item?.description ?? null, l.replacementInDescription)]++;

      // Cost coverage. A cost of 0 is treated as NOT RECORDED rather than as free: an item nobody
      // filled in and an item that genuinely costs nothing are indistinguishable here, and reading
      // the first as the second understates the total — the error this whole census exists to
      // avoid, pointing the other way.
      const cost = item?.purchaseCost ?? null;
      if (cost !== null && cost > 0) costSum += cost; else linesWithoutCost++;

      const price = item?.unitPrice ?? null;
      if (price !== null && price > 0) { retailSum += price; retailLines++; }

      if (inv.txnDate) {
        if (first === null || inv.txnDate < first) first = inv.txnDate;
        if (last === null || inv.txnDate > last) last = inv.txnDate;
      }
    }
  }

  return {
    lines,
    invoices: invoiceIds.size,
    byShape,
    shapesInUse: (Object.values(byShape) as number[]).filter(n => n > 0).length,
    distinctItems: itemIds.size,
    first, last,
    // ONE line without a recorded cost is enough to refuse the total. See the header.
    costTotal: lines > 0 && linesWithoutCost === 0 ? costSum : null,
    linesWithoutCost,
    retailTotalNotToBeQuoted: retailLines > 0 ? retailSum : null,
  };
}
