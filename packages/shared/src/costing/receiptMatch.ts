// ============================================================
// receiptMatch — PROPOSE A PURCHASE, LET A PERSON CONFIRM IT (ledger #370)
//
// PURPOSE:      A recipe component is a name and a quantity — "Osmocote 21-4-8, 25 lb". What it COST
//               is on a receipt somebody photographed. This proposes the line it probably came from,
//               in one sentence a person answers yes or no to: *"we found Osmocote Blend 21-4-8
//               (12-14M) - 50 lb, bwi, 50 lb @ $68.24, 2 Sep — correct?"* Nothing here decides.
//
// 🔴 A MATCH IS PROPOSED, NEVER APPLIED ([[R-118]]: a recipe is *authored by hand*; David, killing
//   derivation outright: *"how do you propose a bubbler with no context"*). This module ranks and
//   explains; a confirmed match is written by the caller and becomes tenant config that survives a
//   catalogue wipe. An unconfirmed proposal costs nothing and prices nothing.
//
// 🔴 ONE CAPTURE PER DOCUMENT (David, 2026-09-21 · tech-debt #143 — THIS IS WHERE IT BITES).
//   The same invoice is photographed more than once: measured on LAWNS 2026-09-21, bwi's 29 July
//   invoice is captured TWICE (same vendor, date and $1,283.88, two and a half minutes apart), Bailey
//   Bark's 7 July THREE times, and eight vendor/date/amount groups repeat in all. A matcher that
//   ranks captures would offer the same purchase twice and "what did we last pay" would average a
//   document against itself. So candidates are grouped by DOCUMENT first — vendor + date + amount —
//   and one capture per document is carried forward, with the collapse REPORTED rather than hidden.
//   ⚠️ It does not merge or delete anything: #143's fix is its own build. This only refuses to be
//   fooled by the duplicates while they exist.
//
// 🔴 WHY TIERS, AND WHY THE TOP TIER IS A CODE. The catalogue carries `qb_item_name` on all 632 rows
//   (measured 2026-09-21) and invoice lines carry their item id — an exact key beats any similarity
//   score, so it is tried first and a name score is never allowed to outrank it. Below that, an exact
//   name, then a containment, then shared words. A weak match is still SHOWN — with its reason — so
//   the person can say no; silence would leave them wondering whether we looked.
//
// DEPENDENCIES: ./landedCost (each proposal carries the landed figure, both ways).
// OUTPUTS:      documentKeyOf · oneCapturePerDocument · proposeMatches · proposalSentence.
// AC-1:         generic. A receipt is a receipt.
// ============================================================
import { landedCostForReceipt, num, type ReceiptLineInput } from './landedCost';

/** A captured receipt, as `receipts` holds one. */
export interface CapturedReceipt {
  id: string;
  vendor: string | null;
  /** 'YYYY-MM-DD'. */
  date: string | null;
  amount: number | string | null;
  receiptNumber?: string | null;
  /** When this capture was made — the tie-break when two captures are otherwise identical. */
  createdAt?: string | null;
  lineItems: ReceiptLineInput[] | null;
}

/**
 * WHICH DOCUMENT this capture is of: vendor, date and amount, as a reader sees them. Two photographs
 * of one invoice share it; two genuine purchases from one vendor on one day for the same money do
 * not exist in the data measured (and if they ever do, the person confirming will see both lines).
 */
export function documentKeyOf(r: CapturedReceipt): string {
  const vendor = (r.vendor ?? '').trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  const amount = num(r.amount);
  return `${vendor}|${r.date ?? ''}|${amount == null ? '' : amount.toFixed(2)}`;
}

export interface DocumentSet {
  /** One capture per document — the one a reader should be shown. */
  kept: CapturedReceipt[];
  /** How many captures were set aside, and of which documents. Reported, never silently dropped. */
  collapsed: Array<{ documentKey: string; captures: number; keptId: string }>;
}

/**
 * Collapse repeated captures of one document.
 * The kept capture is the one carrying a receipt NUMBER (it was read off the page); failing that,
 * the EARLIEST capture, because the later ones are the re-photographs.
 */
export function oneCapturePerDocument(receipts: CapturedReceipt[]): DocumentSet {
  const byDoc = new Map<string, CapturedReceipt[]>();
  for (const r of receipts) {
    const k = documentKeyOf(r);
    byDoc.set(k, [...(byDoc.get(k) ?? []), r]);
  }
  const kept: CapturedReceipt[] = [];
  const collapsed: DocumentSet['collapsed'] = [];
  for (const [k, group] of byDoc) {
    const ranked = [...group].sort((a, b) => {
      const an = a.receiptNumber ? 0 : 1, bn = b.receiptNumber ? 0 : 1;
      if (an !== bn) return an - bn;
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
    });
    kept.push(ranked[0]);
    if (group.length > 1) collapsed.push({ documentKey: k, captures: group.length, keptId: ranked[0].id });
  }
  return { kept, collapsed };
}

export type MatchTier = 'code' | 'exact_name' | 'contains' | 'shared_words';

export interface MatchProposal {
  receiptId: string;
  lineIndex: number;
  description: string;
  sku: string | null;
  vendor: string | null;
  purchasedOn: string | null;
  documentKey: string;
  tier: MatchTier;
  /** 0–1. A code match is 1 by construction; nothing below it may reach 1. */
  score: number;
  /** Why this line was proposed, in the words the person reads under the sentence. */
  because: string;
  packSize: number | null;
  packUnit: string | null;
  lineUnitPrice: number | null;
  /** The landed figures for this line, both ways — null when the receipt did not reconcile. */
  landedPackCostEqualPerItem: number | null;
  landedPackCostProRataByValue: number | null;
  /** Said out loud when the receipt's own lines do not add up: no cost can be taken from it. */
  landedRefusal: string | null;
}

const STOP = new Set(['the', 'and', 'of', 'for', 'with', 'lb', 'lbs', 'bag', 'bags', 'gal', 'gallon', 'yard', 'yd', 'each', 'per']);
const words = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\-. ]+/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface ComponentToMatch {
  name: string;
  /** The component's QuickBooks item id, when it has one — the top tier. */
  qbItemId?: string | null;
  /** The catalogue's own name for that item ("OSMO50"), when known. */
  qbItemName?: string | null;
}

/**
 * Rank the receipt lines that might be this component, best first.
 * `limit` caps what a screen shows; the rest are not hidden, they are simply below the fold.
 */
export function proposeMatches(
  component: ComponentToMatch,
  receipts: CapturedReceipt[],
  opts: { limit?: number } = {},
): { proposals: MatchProposal[]; collapsed: DocumentSet['collapsed'] } {
  const { kept, collapsed } = oneCapturePerDocument(receipts);
  const wanted = words(component.name);
  const out: MatchProposal[] = [];

  for (const r of kept) {
    const landed = landedCostForReceipt(r.amount, r.lineItems);
    const lines = r.lineItems ?? [];
    lines.forEach((l, i) => {
      const desc = (l.description ?? '').trim();
      if (!desc && !l.sku) return;
      const lineWords = words(desc);
      let tier: MatchTier | null = null;
      let score = 0;
      let because = '';

      const code = norm(component.qbItemName ?? component.qbItemId);
      if (code && (norm(l.sku) === code || norm(desc) === code)) {
        tier = 'code'; score = 1;
        because = `Its code on the receipt is ${l.sku ?? desc}, the same code as this component.`;
      } else if (norm(desc) === norm(component.name)) {
        tier = 'exact_name'; score = 0.9;
        because = 'The line reads exactly like this component.';
      } else if (norm(desc).includes(norm(component.name)) && component.name.length > 3) {
        tier = 'contains'; score = 0.75;
        because = `The line names "${component.name}" inside a longer description.`;
      } else if (wanted.length > 0) {
        const shared = wanted.filter(w => lineWords.includes(w));
        if (shared.length > 0) {
          tier = 'shared_words';
          // Never allowed to reach a code match: capped well below 1.
          score = Math.min(0.6, 0.2 + 0.2 * shared.length);
          because = `Both mention ${shared.slice(0, 3).map(w => `"${w}"`).join(' and ')}.`;
        }
      }
      if (!tier) return;

      const landedLine = landed.ok
        ? landed.goods.find(g => g.description === desc && g.lineAmount === (num(l.amount) ?? 0)) ?? null
        : null;
      out.push({
        receiptId: r.id, lineIndex: i, description: desc, sku: (l.sku ?? null) || null,
        vendor: r.vendor, purchasedOn: r.date, documentKey: documentKeyOf(r),
        tier, score, because,
        packSize: num(l.pack_size), packUnit: (l.pack_unit ?? null) || null,
        lineUnitPrice: num(l.unit_price),
        landedPackCostEqualPerItem: landedLine?.landedUnitEqualPerItem ?? null,
        landedPackCostProRataByValue: landedLine?.landedUnitProRataByValue ?? null,
        landedRefusal: landed.ok ? null : landed.detail,
      });
    });
  }

  out.sort((a, b) => b.score - a.score
    || String(b.purchasedOn ?? '').localeCompare(String(a.purchasedOn ?? ''))
    || a.description.localeCompare(b.description));
  return { proposals: out.slice(0, opts.limit ?? 8), collapsed };
}

/**
 * The question, in David's own shape (2026-09-17): *"we found <item>, <vendor>, <pack> @ <price>,
 * <date> — correct?"* A figure that is missing is NAMED as missing inside the sentence, because a
 * blank in a question is answered wrongly.
 */
export function proposalSentence(p: MatchProposal): string {
  const pack = p.packSize != null && p.packUnit ? `${p.packSize} ${p.packUnit}` : 'pack size not stated';
  const price = p.lineUnitPrice != null ? `$${p.lineUnitPrice.toFixed(2)}`
    : p.landedPackCostEqualPerItem != null ? `$${p.landedPackCostEqualPerItem.toFixed(2)} landed`
    : 'no price on the line';
  const when = p.purchasedOn ?? 'no date on the receipt';
  return `We found ${p.description || p.sku}, ${p.vendor ?? 'vendor not stated'}, ${pack} @ ${price}, ${when} — correct?`;
}

/**
 * What a purchase LAST cost — per DOCUMENT, never per capture (tech-debt #143). Returns the most
 * recent confirmed-or-proposed line, and says how many documents it had to choose from.
 */
export function lastPaid(proposals: MatchProposal[]): { proposal: MatchProposal | null; documents: number } {
  const byDoc = new Map<string, MatchProposal>();
  for (const p of proposals) {
    const seen = byDoc.get(p.documentKey);
    if (!seen || p.score > seen.score) byDoc.set(p.documentKey, p);
  }
  const all = [...byDoc.values()].sort((a, b) => String(b.purchasedOn ?? '').localeCompare(String(a.purchasedOn ?? '')));
  return { proposal: all[0] ?? null, documents: byDoc.size };
}
