// ============================================================
// landedCost — WHAT A PURCHASE ACTUALLY COST, ONCE THE FREIGHT IS ON IT (ledger #370)
//
// PURPOSE:      A recipe costs what its components cost, and a component costs what it cost to get
//               HERE — not what its line says. [[R-118]] measures the gap and it is not small:
//               Bailey Bark's material line reads **$13.75 a yard**; with freight (245 mi × $4.60)
//               and fuel (14% of freight) spread across it, the yard landed at **$30.88**. Verified
//               live 2026-09-21 against the 7 Jul 2026 receipt: 1,031.25 + 1,127 + 157.78 = 2,316.03,
//               the receipt's own header, ÷ 75 yd = 30.88. **Take the line and every figure downstream
//               is wrong by 55%, and it looks perfectly reasonable.**
//
// 🔴 THE HEADER DECIDES WHICH LINE SET IS REAL — NEVER THE DEDUPE (David, 2026-09-21).
//   A captured receipt can repeat its own lines, and measured over LAWNS's 127 receipts on
//   2026-09-21, TWO do — and both of them reconcile on the RAW set, i.e. the repeat was two real
//   purchases, not a double read. That is David's caution, evidenced: the dedupe alone would have
//   halved them. So both candidate sets are totalled, the one that reconciles to the header wins,
//   and `reconciledOn` RECORDS WHICH. When neither reconciles, this module returns
//   a REFUSAL and no unit cost exists — a landed figure computed off lines that do not add up to the
//   document is a number with no provenance (D-9: a refusal, never a plausible total).
//
// ⚠️ THE OTHER DUPLICATION IS NOT THIS MODULE'S AND MUST NOT BE SOLVED HERE: the SAME DOCUMENT
//   captured more than once, as three separate `receipts` rows. Bailey Bark's 7 Jul invoice is in
//   three times, its 28 Apr twice, and eight vendor/date/amount groups repeat in all (measured
//   2026-09-21) — tech-debt #143's class, and it triples a cost that sums captures rather than
//   documents. Each row lands correctly on its own; whoever ASKS "what did we last pay" picks one
//   capture per document. Named here so the next reader does not mistake one problem for the other.
//
// 🔴 BOTH SPREADS, ALWAYS, AND LAUREN CHOOSES (David, 2026-09-21): *"purchasing and fuel differ every
//   time, so we give our best analysis and they choose."* `equalPerItem` — freight split evenly across
//   the goods lines — is shown FIRST and is the default, because that is what they chose on
//   2026-09-18. `proRataByValue` is computed beside it, every time. This module never picks.
//   ⚠️ On a single-goods-line receipt the two are IDENTICAL by construction (Bailey Bark: both
//   $30.88). They part on multi-line receipts — bwi 2 Sep 2026 puts Ferrous Sulfate at $0.5889/lb
//   equal-per-item against $0.5618 by value. Equal-per-item charges the cheap line more.
//
// DEPENDENCIES: none — pure arithmetic over a receipt's own lines.
// OUTPUTS:      classifyReceiptLine · landedCostForReceipt · LandedReceipt · LandedGoodsLine.
// AC-1:         generic. A receipt is a receipt; nothing here knows what a nursery is.
// STORY:        `user_stories.md` → the cost-to-produce arc (the recipe builder, R-118).
// ============================================================

/** One captured line, as `receipts.line_items` stores it (jsonb; numbers may arrive as strings). */
export interface ReceiptLineInput {
  description?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  amount?: number | string | null;
  pack_size?: number | string | null;
  pack_unit?: string | null;
}

/**
 * What a line IS, for the spread. `goods` carries the freight; `carrier` IS the freight (and the fuel
 * surcharge that rides on it); `tax` and `adjustment` are neither — they are not goods and they are
 * not spread onto goods.
 */
export type ReceiptLineKind = 'goods' | 'carrier' | 'tax' | 'adjustment';

const CARRIER = /\b(freight|fuel\s*surcharge|shipping|delivery\s*charge|haul(age|ing)?)\b/i;
const TAX = /\b(tax|vat|gst)\b/i;
const ADJUSTMENT = /\b(discount|credit|refund|rebate|adjustment)\b/i;

/** Numbers arrive as strings from jsonb. A value that is not a finite number is `null`, never 0. */
export function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * 🔴 SPLIT A SUM OF MONEY SO THE PARTS ADD BACK TO IT — EXACTLY. Freight of $16.61 over four lines
 * is $4.1525 each; rounded independently that is 4×$4.15 = $16.60 and a cent of freight has
 * VANISHED. Found by the test that checks the shares sum to the carrier total (§C8), which is the
 * only reason it is not in the shipped code. Allocated in CENTS by the largest-remainder method: the
 * cents left over go to the lines with the largest fractional part, biggest weight breaking a tie.
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((t, w) => t + w, 0);
  const even = sum <= 0;                       // no weights to go on: split as evenly as cents allow
  const exact = weights.map(w => (even ? totalCents / n : (totalCents * w) / sum));
  const floors = exact.map(v => Math.floor(v));
  let left = totalCents - floors.reduce((t, v) => t + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v), w: even ? 0 : weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  const out = [...floors];
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i] += 1;
  return out;
}

/**
 * Which kind a line is. Read off its OWN text — there is no other signal in the data (measured
 * 2026-09-21: captured lines carry description, quantity, pack and price, and nothing that says
 * "this is freight"). A negative amount is an adjustment whatever it is called.
 */
export function classifyReceiptLine(line: ReceiptLineInput): ReceiptLineKind {
  const text = `${line.description ?? ''} ${line.sku ?? ''}`;
  const amount = num(line.amount);
  if (amount != null && amount < 0) return 'adjustment';
  if (ADJUSTMENT.test(text)) return 'adjustment';
  if (CARRIER.test(text)) return 'carrier';
  if (TAX.test(text)) return 'tax';
  return 'goods';
}

/** One goods line, landed both ways. A share is what the freight put on THIS line. */
export interface LandedGoodsLine {
  description: string;
  sku: string | null;
  /** The line's own amount, as captured. */
  lineAmount: number;
  quantity: number | null;
  packSize: number | null;
  packUnit: string | null;
  /** Freight carried, split evenly across the goods lines. Shown first; the default. */
  shareEqualPerItem: number;
  /** Freight carried, in proportion to the line's share of the goods value. */
  shareProRataByValue: number;
  landedTotalEqualPerItem: number;
  landedTotalProRataByValue: number;
  /** Landed cost of ONE unit as the receipt counts them — `null` when the line states no quantity. */
  landedUnitEqualPerItem: number | null;
  landedUnitProRataByValue: number | null;
}

export type LandedReceipt =
  | {
      ok: true;
      /** WHICH line set reconciled to the header — recorded, because the dedupe alone never decides. */
      reconciledOn: 'raw' | 'deduped';
      /** True when the two sets differed at all, i.e. the document repeated lines. */
      hadRepeatedLines: boolean;
      goods: LandedGoodsLine[];
      goodsTotal: number;
      /** Freight and fuel spread across the goods. */
      carrierTotal: number;
      taxTotal: number;
      adjustmentTotal: number;
      headerAmount: number;
    }
  | {
      ok: false;
      reason: 'no_lines' | 'does_not_reconcile' | 'no_goods' | 'no_header';
      /** In the reader's words — this is printed, not logged. */
      detail: string;
      /** What each candidate set summed to, so a person can see the gap themselves. */
      rawTotal: number | null;
      dedupedTotal: number | null;
      headerAmount: number | null;
    };

/** Exact-duplicate key: same text, same quantity, same unit price, same amount. */
const dupKey = (l: ReceiptLineInput): string =>
  JSON.stringify([
    (l.description ?? '').trim().toLowerCase(),
    (l.sku ?? '').trim().toLowerCase(),
    num(l.quantity), num(l.unit_price), num(l.amount),
  ]);

const sumOf = (lines: ReceiptLineInput[]): number =>
  round2(lines.reduce((t, l) => t + (num(l.amount) ?? 0), 0));

/**
 * Land a receipt's goods.
 *
 * `tolerance` is the cent-rounding slack allowed between a candidate set's sum and the header. It is
 * NOT a fudge for a receipt that does not add up: at 0.02 a missing $16.61 fuel line still refuses.
 */
export function landedCostForReceipt(
  headerAmount: number | string | null | undefined,
  lines: ReceiptLineInput[] | null | undefined,
  opts: { tolerance?: number } = {},
): LandedReceipt {
  const tolerance = opts.tolerance ?? 0.02;
  const header = num(headerAmount);
  const all = (lines ?? []).filter(l => l != null);

  if (all.length === 0) {
    return { ok: false, reason: 'no_lines', rawTotal: null, dedupedTotal: null, headerAmount: header,
      detail: 'This receipt has no captured lines, so nothing can be costed from it.' };
  }
  if (header == null) {
    return { ok: false, reason: 'no_header', rawTotal: sumOf(all), dedupedTotal: null, headerAmount: null,
      detail: 'This receipt has no total on it, so there is nothing to check the lines against.' };
  }

  // The two candidate sets. The header decides between them (David, 2026-09-21) — a repeated line can
  // be an OCR pass repeating itself OR two of the same thing genuinely bought.
  const seen = new Set<string>();
  const deduped = all.filter(l => { const k = dupKey(l); if (seen.has(k)) return false; seen.add(k); return true; });
  const rawTotal = sumOf(all);
  const dedupedTotal = sumOf(deduped);
  const hadRepeatedLines = deduped.length !== all.length;

  let chosen: ReceiptLineInput[] | null = null;
  let reconciledOn: 'raw' | 'deduped' = 'raw';
  if (Math.abs(rawTotal - header) <= tolerance) { chosen = all; reconciledOn = 'raw'; }
  else if (Math.abs(dedupedTotal - header) <= tolerance) { chosen = deduped; reconciledOn = 'deduped'; }

  if (!chosen) {
    return {
      ok: false, reason: 'does_not_reconcile', rawTotal, dedupedTotal, headerAmount: header,
      detail: `The lines on this receipt do not add up to its total of ${header.toFixed(2)} — `
        + `they come to ${rawTotal.toFixed(2)} as captured`
        + (hadRepeatedLines ? `, or ${dedupedTotal.toFixed(2)} with repeated lines counted once` : '')
        + '. Until that is settled, no cost can be taken from it.',
    };
  }

  const kinds = chosen.map(l => classifyReceiptLine(l));
  const goodsLines = chosen.filter((_, i) => kinds[i] === 'goods');
  const carrierTotal = round2(chosen.filter((_, i) => kinds[i] === 'carrier').reduce((t, l) => t + (num(l.amount) ?? 0), 0));
  const taxTotal = round2(chosen.filter((_, i) => kinds[i] === 'tax').reduce((t, l) => t + (num(l.amount) ?? 0), 0));
  const adjustmentTotal = round2(chosen.filter((_, i) => kinds[i] === 'adjustment').reduce((t, l) => t + (num(l.amount) ?? 0), 0));
  const goodsTotal = round2(goodsLines.reduce((t, l) => t + (num(l.amount) ?? 0), 0));

  if (goodsLines.length === 0) {
    return { ok: false, reason: 'no_goods', rawTotal, dedupedTotal, headerAmount: header,
      detail: 'Every line on this receipt is freight, tax or an adjustment — there is nothing to land a cost onto.' };
  }

  // Both spreads are allocated in cents so each one adds back to the carrier total exactly (§C8).
  const carrierCents = Math.round(carrierTotal * 100);
  const amounts = goodsLines.map(l => num(l.amount) ?? 0);
  const equalShares = allocateCents(carrierCents, goodsLines.map(() => 1)).map(c => c / 100);
  // 🔴 BY VALUE NEEDS A VALUE. When the goods total is 0 (free stock, or amounts not captured), the
  // proportion is undefined, so the weights fall back to even rather than dividing by zero.
  const valueShares = allocateCents(carrierCents, goodsTotal === 0 ? amounts.map(() => 1) : amounts).map(c => c / 100);
  const goods: LandedGoodsLine[] = goodsLines.map((l, i) => {
    const lineAmount = num(l.amount) ?? 0;
    const quantity = num(l.quantity);
    const perLine = equalShares[i];
    const shareByValue = valueShares[i];
    const totalEqual = round2(lineAmount + perLine);
    const totalValue = round2(lineAmount + shareByValue);
    return {
      description: (l.description ?? '').trim(),
      sku: (l.sku ?? null) || null,
      lineAmount: round2(lineAmount),
      quantity,
      packSize: num(l.pack_size),
      packUnit: (l.pack_unit ?? null) || null,
      shareEqualPerItem: round2(perLine),
      shareProRataByValue: round2(shareByValue),
      landedTotalEqualPerItem: totalEqual,
      landedTotalProRataByValue: totalValue,
      // A unit cost needs a quantity. No quantity is a REFUSAL of that one number, not a 0.
      landedUnitEqualPerItem: quantity && quantity > 0 ? round2(totalEqual / quantity) : null,
      landedUnitProRataByValue: quantity && quantity > 0 ? round2(totalValue / quantity) : null,
    };
  });

  return { ok: true, reconciledOn, hadRepeatedLines, goods, goodsTotal, carrierTotal, taxTotal, adjustmentTotal, headerAmount: header };
}

/** The sentence a screen prints about which line set was used. Empty when nothing repeated. */
export function reconciliationNote(r: LandedReceipt): string {
  if (!r.ok) return r.detail;
  if (!r.hadRepeatedLines) return '';
  return r.reconciledOn === 'deduped'
    ? 'This receipt repeated lines; counted once, they match its total.'
    : 'This receipt carries the same line more than once, and counted in full they match its total — so they are separate purchases, not a repeat.';
}
