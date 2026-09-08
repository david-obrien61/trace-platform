// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Turn a QuickBooks books-read into a REVIEW a business owner can agree to — the
//               SERVICES half of the catalogue. Classifies every item her books hold into the
//               destination it belongs in, prices the ones her invoices actually evidence, and
//               REFUSES the rest by name. Every number carries the lines it was measured from.
// DEPENDENCIES: ./discountReview (isDiscountItem — ONE definition of "this is a discount",
//               shared with the /discounts review) · ../quickbooks/invoiceList (BUNDLE_ITEM_NAMES).
//               PURE — no client, no fetch, no React. Every probe runs it without a network.
// OUTPUTS:      buildServiceReview · buildServiceRows · classifyDestination · readPriceEvidence
//               · readUnitEvidence · buildPlacementLadder · SERVICE_REFUSALS · the thresholds.
//
// Run: node scripts/run-tests.mjs serviceReview
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS. The catalogue import filters `Type: 'Category'` AND NOTHING ELSE
// (`qboItemAdapter.ts`), so every one of the 147 `Type: 'Service'` items becomes a
// `business_inventory` row with `sell_price = item.unitPrice` and no shape check. MEASURED on
// LAWNS's complete 685-item capture: `Military Discount 5%` lands as a scannable product priced
// **minus five cents**, and `Tree Replacement` as a **free** one. The import button says
// "647 products". Her books hold 500.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE CLASSIFICATION AXIS IS THE INCOME ACCOUNT, AND IT IS ALREADY IN HER BOOKS.
// Nothing here guesses what a thing is from its name. Every item QuickBooks holds carries an
// `IncomeAccountRef` — HER OWN word for what the money is — and MEASURED across the 147:
//     64 → Sales of Nursery Stock      35 → Sales of Product Income
//     22 → Landscaping/Installation     8 → Discounts given        6 → Delivery Income
//      7 → Income                       5 → one each (Refund · Late Fee · Warranty COGS · …)
// So `Lacey Oak 45G` is typed `Service` in QuickBooks and booked to **nursery stock**: it is a
// TREE, and this screen must never offer it as a service. The account says so; we do not have
// to decide it. ⚠️ The match is on the account's NAME, never its id — an id is a tenant literal
// and would be wrong at the next customer; `Sales of Nursery Stock` is QuickBooks' own vocabulary.
//
// ⚠️ AND WHERE THE ACCOUNT DOES NOT SETTLE IT, THE SCREEN SAYS SO RATHER THAN PICKING.
// `Sales of Product Income` holds compost bags AND the Tree Bubbler — a thing she buys and a
// thing she fits. Her books genuinely do not distinguish them, so a row whose account
// contradicts its proposed destination is marked `contested` and is NEVER pre-selected.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A SERVICE WITH NO PRICE IS NEVER WRITTEN. `service_offerings.price` is NOT NULL, so the
// existing `seedServiceOfferings` writes `0` as a placeholder and holds `is_active = false`. This
// module will not do that: **$0 on a live service reads as FREE to a customer**, and a row that
// exists but is switched off is a trap the next person switches on. An unpriced service is simply
// not written — it appears on screen, unaddable, with the reason it cannot be priced.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 "WE'RE SURE OF THE PRICE" IS A MAJORITY, AND IT IS TWO CLAUSES, NOT A TUNED NUMBER.
//   ① the same price on MORE THAN HALF the priced lines — i.e. *this is what she charges more
//      often than not*. Anything less is a spread, and a spread has no single answer to give;
//   ② at least three lines agreeing. Two agreeing observations can be a coincidence; a price
//      charged three separate times is a price. Without this clause an item sold ONCE reports
//      100% agreement and outranks a service billed eighty times.
// ⚠️ $0 LINES ARE EXCLUDED FROM THE DISTRIBUTION AND COUNTED SEPARATELY. A giveaway is not a
// price, and averaging it in drags every rate toward a number she never charged.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE UNIT IS MEASURED FROM `Qty`, NOT ASSUMED. MEASURED on LAWNS: trip charge carries
// `Qty = 1` on **516 of 523 lines (99%)** — it is charged once per ORDER. The tree bubbler
// carries `Qty = 1` on **26 of 81 (32%)**, running 2·3·4·5·6 — it is charged per PLANT. That is
// the whole inference, and where the share lands between the two it is reported as UNKNOWN and
// she picks. `service_offerings` already holds this distinction (`price_type` + `price_unit`);
// nothing new is needed for it.
// ─────────────────────────────────────────────────────────────────────────────
import { isDiscountItem } from './discountReview';
import { BUNDLE_ITEM_NAMES, type QboInvoiceRow } from '../quickbooks/invoiceList';
import { normalizeSize } from '../utils/sizeLabel';

// ── the thresholds, named so a probe can move them and watch a verdict change ────────────────
/** More than half the priced lines at one price. Not tuned: "more often than not". */
export const PRICE_MAJORITY = 0.5;
/** Two agreeing lines can be a coincidence. Three is a price. */
export const MIN_AGREEING_LINES = 3;
/** `Qty = 1` this often → charged once per order. */
export const UNIT_ORDER_SHARE = 0.9;
/** `Qty = 1` this rarely → charged per plant. Between the two we do not claim to know. */
export const UNIT_PLANT_SHARE = 0.6;
/**
 * A charge that almost never repeats is not a price — it is a negotiated figure.
 *
 * 🔴 THE MEASUREMENT IS DISTINCTNESS, AND THE FIRST DRAFT GOT THIS WRONG AGAINST REAL BOOKS.
 * Keying on "the top price holds less than a quarter of the lines" swept in **tree removal — 85
 * invoices, $22,285** — which is not a bundle, it is a service she prices job by job. The two
 * separate cleanly on a different question: *how many DIFFERENT figures are there?* MEASURED on
 * LAWNS: `DIW` charges **21 distinct prices across 22 lines** and `Installation` **5 across 5**;
 * tree removal charges 17 distinct across 83, and tailgate delivery 16 across 125. A price
 * repeated eighty times is a price she has not settled; a price never repeated is not a price.
 */
export const BUNDLE_DISTINCT_SHARE = 0.9;

/** The five values `service_offerings.category` will accept. A sixth is refused by the DATABASE. */
export const SERVICE_CATEGORIES = ['transport', 'addon', 'maintenance', 'inspection', 'subscription'] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

/** The four values `service_offerings.price_unit` will accept. */
export const PRICE_UNITS = ['order', 'plant', 'vehicle', 'visit'] as const;
export type PriceUnit = typeof PRICE_UNITS[number];

/** One item from her product list, as `/api/qbo/items` returns it. */
export interface ServiceItemFact {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number | null;
  /** Intuit's `Type` — `Service` · `NonInventory` · `Category`. */
  type: string | null;
  /** Intuit's `IncomeAccountRef.name` — HER word for what the money is. The classification axis. */
  incomeAccountName: string | null;
}

/** What her invoices did with one item. Every field is a count, never an average. */
export interface ServiceLineTally {
  itemId: string;
  lines: number;
  invoices: number;
  amountTotal: number;
  customers: number;
  /** Lines charged $0 — counted, never priced. */
  zeroLines: number;
  /** Distinct unit prices with their line counts, most-used first. $0 excluded. */
  prices: { price: number; lines: number }[];
  /** Lines carrying `Qty = 1`. The unit inference, and nothing else. */
  qtyOneLines: number;
  first: string | null;
  last: string | null;
}

export const DESTINATIONS = {
  service: 'service',
  product: 'product',
  discount: 'discount',
  notASale: 'not-a-sale',
  /** A QuickBooks Category — a FOLDER. Not a thing anybody sells, and not an import row either. */
  folder: 'folder',
} as const;
export type Destination = typeof DESTINATIONS[keyof typeof DESTINATIONS];

export const SERVICE_REFUSALS = {
  noInvoicePrice: 'no-invoice-price',
  everyLineFree: 'every-line-free',
  pricesDisagree: 'prices-disagree',
  neverBilled: 'never-billed',
  bundle: 'bundle',
  contestedAccount: 'contested-account',
} as const;
export type ServiceRefusal = typeof SERVICE_REFUSALS[keyof typeof SERVICE_REFUSALS];

export type PriceConfidence = 'sure' | 'cannot-tell' | 'free' | 'never-billed';

/** An account name that books money as something other than a sale. */
const ACCOUNT_NOT_A_SALE = /refund|late\s*fee|overpayment|balance\s+correction/i;
/** An account name that books money as a discount given. */
const ACCOUNT_DISCOUNT = /discount/i;
/** An account name that books money as PLANT STOCK — a tree, whatever Intuit types it. */
const ACCOUNT_STOCK = /nursery\s+stock|plant\s+sales/i;
/** An account name that books money as goods sold. Does NOT settle service-vs-product on its own. */
const ACCOUNT_GOODS = /product\s+income|merchandise/i;
/** An account name that books money as carriage. */
const ACCOUNT_DELIVERY = /delivery|freight|shipping/i;
/** An account name that books money as work done. */
const ACCOUNT_LABOUR = /install|landscap|labor|labour|service/i;

export interface DestinationRead {
  destination: Destination;
  /** The sentence the screen prints. Always names the evidence, never the rule's number. */
  reason: string;
  /** Her account disagrees with the destination. Surfaced, and never pre-selected. */
  contested: boolean;
}

/**
 * Where does this item belong? Read from her books, in order, each clause stated.
 *
 * 🔴 THE ORDER IS THE ARGUMENT. A discount is checked FIRST because a discount item typed
 * `Service` and booked to `Discounts given` is all three signals at once, and routing it here as
 * a service would put a NEGATIVE price on a live checkout row. `isDiscountItem` is imported
 * rather than re-derived — the /discounts review already owns that definition and a second copy
 * is the one that drifts (§6 r8, STD-011).
 */
export function classifyDestination(item: ServiceItemFact): DestinationRead {
  const acct = (item.incomeAccountName ?? '').trim();
  const named = acct || 'no income account';

  if (isDiscountItem({ name: item.name, description: item.description, unitPrice: item.unitPrice })
      || ACCOUNT_DISCOUNT.test(acct)) {
    return { destination: DESTINATIONS.discount, contested: false,
      reason: `Your books put this under "${named}". It is a discount, and it belongs on the discounts screen — never on a checkout menu.` };
  }
  if (ACCOUNT_NOT_A_SALE.test(acct)) {
    return { destination: DESTINATIONS.notASale, contested: false,
      reason: `Your books put this under "${named}". It is bookkeeping, not something you sell.` };
  }
  if ((item.type ?? '').toLowerCase() === 'category') {
    // A folder cannot be an invoice line's `ItemRef` and nobody sells one. The catalogue import
    // already drops these; naming the destination stops the census from counting a folder as a
    // product, which is the arithmetic that produced "647" in the first place.
    return { destination: DESTINATIONS.folder, contested: false,
      reason: 'This is a folder in QuickBooks, not a thing you sell. Nothing imports it.' };
  }
  if ((item.type ?? '').toLowerCase() !== 'service') {
    return { destination: DESTINATIONS.product, contested: false,
      reason: `QuickBooks types this as ${item.type ?? 'an untyped item'}. It comes across with your products.` };
  }
  if (ACCOUNT_STOCK.test(acct)) {
    return { destination: DESTINATIONS.product, contested: true,
      reason: `QuickBooks types this as a service, but your books book the money to "${named}". That makes it a plant you sell, not a service — so it comes across with your products.` };
  }
  if (ACCOUNT_GOODS.test(acct)) {
    return { destination: DESTINATIONS.service, contested: true,
      reason: `Your books put this under "${named}", which is where you also book bags and containers. We cannot tell from your books whether this is a thing you sell or a thing you fit, so nothing is ticked for you.` };
  }
  if (ACCOUNT_DELIVERY.test(acct) || ACCOUNT_LABOUR.test(acct)) {
    return { destination: DESTINATIONS.service, contested: false,
      reason: `Your books put this under "${named}" — work you do, not stock you sell.` };
  }
  return { destination: DESTINATIONS.service, contested: true,
    reason: acct
      ? `Your books put this under "${named}", which does not say whether it is work or stock. Nothing is ticked for you.`
      : 'This item has no income account in QuickBooks, so your books do not say what it is. Nothing is ticked for you.' };
}

export interface PriceEvidence {
  confidence: PriceConfidence;
  /** The price we would suggest. `null` unless `confidence === 'sure'` — never a guess. */
  price: number | null;
  /** Lines agreeing on that price, out of the priced lines. The working, on screen. */
  agreeing: number;
  pricedLines: number;
  /** Distinct prices seen. `1` and a majority is the strongest evidence there is. */
  distinctPrices: number;
  /** The most-used price even when we refuse to suggest it — she may recognise it. */
  mostCommon: number | null;
  zeroLines: number;
  refusal: ServiceRefusal | null;
}

/**
 * What does her invoice history say this costs?
 *
 * 🔴 IT RETURNS A REFUSAL AS READILY AS A PRICE, AND THE REFUSAL IS THE POINT. Eight of the
 * thirteen services on LAWNS's screen have no answer here, and a screen that produced one anyway
 * would be putting a number on a customer's invoice that her books never supported.
 */
export function readPriceEvidence(tally: ServiceLineTally | null): PriceEvidence {
  const none = { agreeing: 0, pricedLines: 0, distinctPrices: 0, mostCommon: null, zeroLines: 0 };
  if (!tally || tally.lines === 0) {
    return { confidence: 'never-billed', price: null, ...none, refusal: SERVICE_REFUSALS.neverBilled };
  }
  const priced = [...tally.prices].sort((a, b) => b.lines - a.lines || a.price - b.price);
  const pricedLines = priced.reduce((n, p) => n + p.lines, 0);
  if (pricedLines === 0) {
    return { confidence: 'free', price: null, ...none, zeroLines: tally.zeroLines,
      refusal: SERVICE_REFUSALS.everyLineFree };
  }
  const top = priced[0];
  const share = top.lines / pricedLines;
  const base = {
    agreeing: top.lines, pricedLines, distinctPrices: priced.length,
    mostCommon: top.price, zeroLines: tally.zeroLines,
  };
  if (share > PRICE_MAJORITY && top.lines >= MIN_AGREEING_LINES) {
    return { confidence: 'sure', price: top.price, ...base, refusal: null };
  }
  return {
    confidence: 'cannot-tell', price: null, ...base,
    // The two refusals are different facts and the screen says which: a spread of prices is a
    // business that negotiates; a single observation is a business we have not watched enough.
    refusal: share > PRICE_MAJORITY ? SERVICE_REFUSALS.noInvoicePrice : SERVICE_REFUSALS.pricesDisagree,
  };
}

export interface UnitEvidence {
  unit: PriceUnit | null;
  priceType: 'flat' | 'per_unit' | null;
  qtyOneLines: number;
  lines: number;
  /** True when the share landed in the band where we do not claim to know. */
  unknown: boolean;
}

/**
 * Per order, or per plant? Read from `Qty`, and reported as UNKNOWN in the middle.
 *
 * ⚠️ THE MIDDLE BAND IS NOT INDECISION, IT IS THE HONEST READING. A service billed `Qty = 1` on
 * seven lines of ten is a business that sometimes charges once and sometimes charges each — and
 * picking one silently writes a rule into her checkout that her own books contradict.
 */
export function readUnitEvidence(tally: ServiceLineTally | null): UnitEvidence {
  if (!tally || tally.lines === 0) return { unit: null, priceType: null, qtyOneLines: 0, lines: 0, unknown: true };
  const share = tally.qtyOneLines / tally.lines;
  const base = { qtyOneLines: tally.qtyOneLines, lines: tally.lines };
  if (share >= UNIT_ORDER_SHARE) return { unit: 'order', priceType: 'flat', ...base, unknown: false };
  if (share <= UNIT_PLANT_SHARE) return { unit: 'plant', priceType: 'per_unit', ...base, unknown: false };
  return { unit: null, priceType: null, ...base, unknown: true };
}

/** A category suggestion from her own account name — a SUGGESTION, editable, never a silent write. */
export function suggestCategory(item: ServiceItemFact): ServiceCategory | null {
  const acct = (item.incomeAccountName ?? '').trim();
  if (ACCOUNT_DELIVERY.test(acct)) return 'transport';
  if (ACCOUNT_LABOUR.test(acct) || ACCOUNT_GOODS.test(acct)) return 'addon';
  return null;
}

export interface ServiceRow {
  /** Intuit's item id — the anchor a person can look up. */
  id: string;
  name: string;
  description: string | null;
  /** Her account name, printed on every row. The evidence for the classification. */
  accountName: string | null;
  /** The item's published list price, shown when the invoices cannot price it. */
  listPrice: number | null;
  destination: DestinationRead;
  price: PriceEvidence;
  unit: UnitEvidence;
  category: ServiceCategory | null;
  invoices: number;
  lines: number;
  amountTotal: number;
  customers: number;
  first: string | null;
  last: string | null;
  /** A bundle: many lines, a price that almost never repeats. Reported, never suggested. */
  bundle: boolean;
  /** Already a row in `service_offerings` under this name. Not re-offered. */
  alreadyOffered: boolean;
  /** Every reason this row cannot be accepted as-is. Empty = it can. */
  blockers: ServiceRefusal[];
}

/** One rung of the placement ladder: what installing a tree of this size adds to its price. */
export interface LadderRung {
  /** The size exactly as her books write it — never normalised. */
  size: string;
  /** The measured premium: median installed unit price − median bare unit price, per item. */
  premium: number;
  installedLines: number;
  items: number;
}

/** One observation the ladder is built from — one invoice line for a plant. */
export interface PlacementObservation {
  itemId: string;
  size: string | null;
  unitPrice: number;
  installed: boolean;
}

const median = (a: number[]): number => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export interface PlacementLadder {
  rungs: LadderRung[];
  /** Items sold BOTH ways — the population the ladder rests on. */
  itemsSoldBothWays: number;
  /** Median of (installed ÷ bare) across those items. On LAWNS this is almost exactly 2. */
  medianRatio: number | null;
  installedLines: number;
  installedRevenue: number;
}

/**
 * Build the placement ladder from the plant lines her invoices already carry.
 *
 * 🔴 PLACEMENT IS NOT A LINE ON ANY INVOICE. It is inside the tree price — an invoice line reads
 * *"Lacey Oak 45 Gallon (Install & Warranty)"* and charges one figure. So the premium cannot be
 * read off a service item; it has to be measured as the DIFFERENCE between the same plant sold
 * installed and sold bare. That is the only reason this function exists, and it is why the ladder
 * is offered as a suggestion with its own arithmetic printed rather than as a fact.
 *
 * ⚠️ THE COMPARISON IS PER ITEM, THEN POOLED BY SIZE — never a pooled average of prices. A 95
 * gallon oak and a 15 gallon redbud sold installed on the same day would otherwise average into a
 * premium neither of them ever carried. The per-item delta is the only comparison where both
 * halves describe the same plant.
 *
 * ⚠️ AND A RUNG IS DROPPED RATHER THAN PRINTED THIN: `MIN_AGREEING_LINES` applies here too, so a
 * size evidenced by one sale does not get a price on a screen beside a size evidenced by 283.
 */
export function buildPlacementLadder(obs: PlacementObservation[]): PlacementLadder {
  const perItem = new Map<string, { size: string | null; inst: number[]; bare: number[] }>();
  for (const o of obs) {
    if (!Number.isFinite(o.unitPrice) || o.unitPrice <= 0) continue;
    let r = perItem.get(o.itemId);
    if (!r) { r = { size: o.size, inst: [], bare: [] }; perItem.set(o.itemId, r); }
    (o.installed ? r.inst : r.bare).push(o.unitPrice);
  }
  const both = [...perItem.values()].filter(r => r.inst.length > 0 && r.bare.length > 0);
  const ratios = both.map(r => median(r.inst) / median(r.bare)).filter(Number.isFinite);

  // 🔴 THE SIZES ARE FOLDED BEFORE THEY ARE POOLED, THROUGH THE ONE SHARED `normalizeSize`.
  // Run against the real capture the first draft printed SEVENTEEN rungs, including `15 gallon`
  // at $207 and `15 Gallon` at $225 as two separate rows — one physical size, its evidence split
  // across two spellings, and both premiums wrong. That is tech-debt #56's exact defect arriving
  // in a new place, and its fix already exists and is imported rather than re-derived (§6 r8).
  const bySize = new Map<string, { deltas: number[]; items: number; lines: number }>();
  for (const r of both) {
    const folded = normalizeSize(r.size);
    // A fold that does not land on a container size — `24 inch box`, `65 Gallon + Installation`,
    // a description whose size fragment carried prose — is DROPPED rather than printed as a rung.
    // A ladder is read as *what installing THIS size costs*; a row nobody can point at a pot for
    // makes the four real rows beside it less believable.
    if (!/^\d+(?:\.\d+)? Gallon$/.test(folded)) continue;
    const delta = median(r.inst) - median(r.bare);
    if (!Number.isFinite(delta)) continue;
    const e = bySize.get(folded) ?? { deltas: [], items: 0, lines: 0 };
    // Weighted by the INSTALLED lines behind it — a premium proven forty times outweighs one
    // proven twice, and pooling the raw deltas would treat them as equals.
    for (let i = 0; i < r.inst.length; i++) e.deltas.push(delta);
    e.items++; e.lines += r.inst.length;
    bySize.set(folded, e);
  }
  const rungs: LadderRung[] = [...bySize.entries()]
    .filter(([, e]) => e.lines >= MIN_AGREEING_LINES)
    .map(([size, e]) => ({ size, premium: Math.round(median(e.deltas)), installedLines: e.lines, items: e.items }))
    .filter(r => Number.isFinite(r.premium) && r.premium > 0)
    // Smallest pot first — the order a person reads a ladder in.
    .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

  return {
    rungs,
    itemsSoldBothWays: both.length,
    medianRatio: ratios.length ? Math.round(median(ratios) * 100) / 100 : null,
    installedLines: obs.filter(o => o.installed).length,
    installedRevenue: obs.filter(o => o.installed).reduce((n, o) => n + o.unitPrice, 0),
  };
}

/** An account name that books money as PLANT STOCK, read off the LINE rather than the item. */
const LINE_IS_PLANT = ACCOUNT_STOCK;

/**
 * Read the invoice capture into the two evidence sets this review rests on.
 *
 * 🔴 IT RUNS IN THE BROWSER, ON THE CAPTURE THE ENDPOINT ALREADY RETURNED, AND THAT IS
 * DELIBERATE. `/api/qbo/invoices` returns COUNTS ONLY — the parsed records never leave the
 * function, because an invoice names the human who bought and says what they paid (R-23/R-24).
 * The verbatim bodies do come back, inside `capture`, which is what the browser writes to a file.
 * So the tally is computed here from those bodies and NOTHING is persisted: no new endpoint, no
 * payload carrying a customer's purchases, and no thirteenth Vercel function (§6 r11, 12 of 12).
 *
 * ⚠️ A CUSTOMER IS COUNTED, NEVER NAMED. `QboInvoiceRow` has no name field at all, so `customers`
 * below can only ever be the size of a set of ids — there is no path by which a person reaches
 * the screen even by accident.
 */
export function readServiceEvidence(invoices: QboInvoiceRow[]): {
  tallies: ServiceLineTally[];
  placement: PlacementObservation[];
} {
  const acc = new Map<string, {
    lines: number; invoices: Set<string>; amountTotal: number; customers: Set<string>;
    zeroLines: number; prices: Map<number, number>; qtyOneLines: number;
    first: string | null; last: string | null;
  }>();
  const placement: PlacementObservation[] = [];

  for (const inv of invoices) {
    for (const l of inv.lines) {
      const id = l.itemId;
      if (!id) continue;

      // ── the placement ladder's population: PLANT lines only ────────────────────────────────
      // Read from the LINE's own account, not the item's, because the same item can be booked
      // two ways and the line is the record of what actually happened.
      if (LINE_IS_PLANT.test(l.itemAccountName ?? '') && typeof l.unitPrice === 'number' && l.unitPrice > 0) {
        placement.push({
          itemId: id, size: l.sizeFromDescription,
          unitPrice: l.unitPrice, installed: l.installInDescription,
        });
      }

      let a = acc.get(id);
      if (!a) {
        a = { lines: 0, invoices: new Set(), amountTotal: 0, customers: new Set(),
              zeroLines: 0, prices: new Map(), qtyOneLines: 0, first: null, last: null };
        acc.set(id, a);
      }
      a.lines++;
      a.amountTotal += l.amount ?? 0;
      a.invoices.add(inv.id);
      if (inv.customerId) a.customers.add(inv.customerId);
      if (inv.txnDate) {
        if (!a.first || inv.txnDate < a.first) a.first = inv.txnDate;
        if (!a.last || inv.txnDate > a.last) a.last = inv.txnDate;
      }
      // 🔴 A LINE WITH NO STATED UNIT PRICE IS NOT A $0 LINE. Intuit omits `UnitPrice` on some
      // line shapes entirely, and reading an absent field as zero would report a business giving
      // work away that it simply did not itemise (D-9 / A9 — absent is not empty).
      const up = l.unitPrice;
      if (typeof up === 'number' && up > 0) a.prices.set(up, (a.prices.get(up) ?? 0) + 1);
      else a.zeroLines++;
      // `Qty` absent means one of the thing — Intuit omits it on a single-unit line.
      if (l.qty === null || l.qty === 1) a.qtyOneLines++;
    }
  }

  const tallies: ServiceLineTally[] = [...acc.entries()].map(([itemId, a]) => ({
    itemId,
    lines: a.lines,
    invoices: a.invoices.size,
    amountTotal: Math.round(a.amountTotal * 100) / 100,
    customers: a.customers.size,
    zeroLines: a.zeroLines,
    prices: [...a.prices.entries()]
      .map(([price, lines]) => ({ price, lines }))
      .sort((x, y) => y.lines - x.lines || x.price - y.price),
    qtyOneLines: a.qtyOneLines,
    first: a.first,
    last: a.last,
  }));

  return { tallies, placement };
}

export interface ServiceReview {
  /** Services we can price from her books. Pre-selected, editable, written on her press. */
  sure: ServiceRow[];
  /** Services she clearly sells, that her books cannot price. She types the price or leaves it. */
  needsHer: ServiceRow[];
  /** Not offered at all, each with the reason ON SCREEN: a bundle, or work she never charges for. */
  notSuggesting: ServiceRow[];
  /** In her product list, never on an invoice. List price shown; never suggested. */
  neverBilled: ServiceRow[];
  /** Items typed `Service` that her books book as stock or as bookkeeping. Routed, not offered. */
  routedElsewhere: ServiceRow[];
  /**
   * Services her own website names, each with the ONLY thing we can honestly say about it: does
   * any item in her product list use these words? A website states no prices, so no row here
   * ever carries one — and a `false` here is NOT "she does not sell this" (see the note in
   * `buildServiceReview`). Empty when no website was read, never a claim that nothing was found.
   */
  siteServices: { name: string; matchedItem: boolean }[];
  ladder: PlacementLadder;
  /** The counts the import button should be reading. */
  census: { total: number; products: number; services: number; discounts: number; notASale: number; folders: number };
  alreadyOffered: string[];
}

/** A service already on her checkout menu, as `service_offerings` holds it. */
export interface ExistingOffering { id: string; name: string; price: number | null; priceUnit: string | null; isActive: boolean }

/**
 * The columns the review reads to answer ONE question: *is this name already on her menu, and at
 * what price?* Declared once and read at all three sites, because the same list restated three
 * times in one file is the list that drifts (§6 r8 / STD-011) — and the third copy is the one that
 * gets a column added and the other two do not.
 *
 * ⚠️ IT IS A PROJECTION, NOT THE RECORD SHAPE. The Services editor loads the whole row with
 * `select('*')` because it edits every field; this reads five columns to refuse a duplicate.
 *
 * 🔴 AND IT IS PROVEN AGAINST THE MIGRATION, WHICH IS #179's LESSON. `VENDORS_SELECT` named ten
 * columns while its migration created fourteen, and **nothing we own could have caught it** — a
 * column with no reader and no writer is invisible to tsc, eslint, knip and every probe. So this
 * list is asserted against `20260529_businesses_f_service_offerings.sql` in the test file rather
 * than trusted.
 */
export const SERVICE_OFFERING_SELECT = 'id, name, price, price_unit, is_active';

/** Read one PostgREST row into the shape the review compares against. One reader, three call sites. */
export function toExistingOffering(row: Record<string, unknown>): ExistingOffering {
  return {
    id: String(row.id), name: String(row.name ?? ''),
    price: typeof row.price === 'number' ? row.price : null,
    priceUnit: (row.price_unit as string | null) ?? null,
    isActive: row.is_active === true,
  };
}

/**
 * Read the books into a review.
 *
 * 🔴 THE AXIS IS THE PRODUCT LIST, AS IT IS ON THE DISCOUNTS SCREEN, AND FOR THE SAME REASON.
 * Only an item carries a NAME, and only a named thing can become a menu row. Building the rows
 * from the invoice tally would silently drop every service she publishes and has not yet sold —
 * which is exactly how `CD10%` and `CD15%` failed to reach the discounts screen (#280).
 */
export function buildServiceReview(input: {
  items: ServiceItemFact[];
  tallies: ServiceLineTally[];
  existing: ExistingOffering[];
  placement: PlacementObservation[];
  /** Services named on her own website. Reported with NO price — a site states no figures. */
  siteServices: string[];
}): ServiceReview {
  const { items, tallies, existing, placement, siteServices } = input;
  const byItem = new Map(tallies.map(t => [t.itemId, t]));
  const offered = new Set(existing.map(e => e.name.trim().toLowerCase()));

  const rows: ServiceRow[] = items.map(item => {
    const t = byItem.get(item.id) ?? null;
    const destination = classifyDestination(item);
    const price = readPriceEvidence(t);
    const unit = readUnitEvidence(t);
    const alreadyOffered = offered.has(item.name.trim().toLowerCase());

    // A BUNDLE: billed repeatedly, at a price that almost never repeats. It is a container for a
    // negotiated figure, not a service with a rate — so it is reported and never suggested.
    // The named-bundle list adds a sentence when it matches; the measurement stands without it.
    // ⚠️ THE FLOOR IS TWICE THE MINIMUM, AND THAT IS THE SECOND CORRECTION FROM THE REAL RUN.
    // "Never repeats" is a claim about a PATTERN; at three lines it is a claim about three jobs.
    // `Backyard Delivery` — $150, $125, $65 on three invoices — was being told it could not be
    // priced at all, when what it actually needs is for her to type the one she charges now.
    const bundle = (price.pricedLines >= MIN_AGREEING_LINES * 2
                    && price.distinctPrices / price.pricedLines >= BUNDLE_DISTINCT_SHARE)
                || BUNDLE_ITEM_NAMES.some(n => n.toLowerCase() === item.name.trim().toLowerCase());

    const blockers: ServiceRefusal[] = [];
    if (price.refusal) blockers.push(price.refusal);
    if (bundle && !blockers.includes(SERVICE_REFUSALS.bundle)) blockers.push(SERVICE_REFUSALS.bundle);
    if (destination.contested) blockers.push(SERVICE_REFUSALS.contestedAccount);

    return {
      id: item.id, name: item.name, description: item.description,
      accountName: item.incomeAccountName, listPrice: item.unitPrice,
      destination, price, unit, category: suggestCategory(item),
      invoices: t?.invoices ?? 0, lines: t?.lines ?? 0, amountTotal: t?.amountTotal ?? 0,
      customers: t?.customers ?? 0, first: t?.first ?? null, last: t?.last ?? null,
      bundle, alreadyOffered, blockers,
    };
  });

  // Most money first — but a row her books cannot classify sinks below the ones they can, so the
  // services she plainly sells lead and the "we could not tell" rows do not crowd them out.
  const byMoney = (a: ServiceRow, b: ServiceRow) =>
    Number(a.destination.contested) - Number(b.destination.contested)
    || b.amountTotal - a.amountTotal
    || a.name.localeCompare(b.name);
  const candidates = rows.filter(r => r.destination.destination === DESTINATIONS.service && !r.alreadyOffered);

  // NOT SUGGESTED AT ALL means *this should not carry a price on a checkout menu*, which is two
  // things and only two: work she never charges for, and work whose charge has never repeated.
  // Everything else she cannot price is still a service she could price — it belongs in the
  // section where she types one, not in the section that refuses her the option.
  const notSuggesting = candidates.filter(r =>
    r.bundle || r.price.confidence === 'free').sort(byMoney);
  const rest = candidates.filter(r => !notSuggesting.includes(r));
  const neverBilled = rest.filter(r => r.price.confidence === 'never-billed').sort((a, b) => a.name.localeCompare(b.name));
  // 🔴 `sure` IS A STATEMENT ABOUT THE PRICE AND NOTHING ELSE — corrected after running against
  // the real capture. The first draft also required an uncontested account, which put the **tree
  // bubbler — $65 on 80 of 81 lines, the cleanest price in these books** — under "we can't tell
  // you the price", beside services charged at six different figures. Two different doubts were
  // being collapsed into one verdict. A contested row is still SURE of its price; what it is not
  // is pre-ticked, and that is the row's own flag to carry.
  const sure = rest.filter(r => r.price.confidence === 'sure').sort(byMoney);
  const needsHer = rest.filter(r => r.price.confidence !== 'never-billed' && r.price.confidence !== 'sure').sort(byMoney);

  // Items QuickBooks types `Service` that her books book as STOCK — trees, on a services screen.
  // They are named here so the routing is visible, and they are never offerable.
  const routedElsewhere = rows
    .filter(r => r.destination.destination === DESTINATIONS.product && r.destination.contested)
    .sort(byMoney);

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 THE WEBSITE SECTION REPORTS THE TEST WE RAN, NOT A CONCLUSION ABOUT HER BUSINESS.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // The first draft printed two claims and RUNNING IT AGAINST HER REAL BOOKS SHOWED BOTH WERE
  // FALSE. It said *"backyard placement — named on your website, nothing in your invoices bills
  // it"* while `Backyard Delivery` is a real item billed three times; and it said *"deer
  // protection — your website does not mention it"* about `DF`, whose description reads *"Deer
  // Fencing"* and which her site advertises. **A shorthand item code and a marketing phrase are
  // the same service, and no substring test can see that.**
  //
  // Two different errors, both the same shape: a wording comparison dressed up as a fact about
  // what she does and does not sell. So the claim is withdrawn and the MEASUREMENT is printed
  // instead — *these words appear on your site; here is whether any item mentions them* — which
  // is true, checkable, and leaves the judgement where it belongs. She reads `deer protection —
  // no item uses these words` and knows instantly that `DF` is it; we would have told her she
  // does not offer it.
  const haystack = items.map(i => `${i.name} ${i.description ?? ''}`.toLowerCase());
  const siteServices_ = siteServices
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(name => ({
      name,
      matchedItem: haystack.some(h => h.includes(name.toLowerCase())),
    }));

  const census = {
    total: items.length,
    folders: rows.filter(r => r.destination.destination === DESTINATIONS.folder).length,
    products: rows.filter(r => r.destination.destination === DESTINATIONS.product).length,
    services: rows.filter(r => r.destination.destination === DESTINATIONS.service).length,
    discounts: rows.filter(r => r.destination.destination === DESTINATIONS.discount).length,
    notASale: rows.filter(r => r.destination.destination === DESTINATIONS.notASale).length,
  };

  return {
    sure, needsHer, notSuggesting, neverBilled, routedElsewhere,
    siteServices: siteServices_,
    ladder: buildPlacementLadder(placement),
    census,
    alreadyOffered: rows.filter(r => r.alreadyOffered).map(r => r.name),
  };
}


/** What a person actually accepted on the screen — a name, a price, a unit, all editable. */
export interface AcceptedService {
  name: string;
  description: string | null;
  category: string;
  priceUnit: string;
  price: number;
  sortOrder: number;
}

export type ServiceWriteResult =
  | { ok: true; rows: Record<string, unknown>[] }
  | { ok: false; reason: string };

/**
 * Build the `service_offerings` rows a press will insert. Returns a REFUSAL, never a partial set.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IT REFUSES A $0 PRICE, AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE. `price` is NOT NULL
 * on `service_offerings`, so the only two honest options are a real price or NO ROW. The existing
 * `seedServiceOfferings` takes the third: it writes `0` and holds `is_active = false`. A row that
 * exists with a zero price is one toggle away from telling a customer that placement is free, and
 * the toggle is on a screen that says nothing about why the row is off.
 *
 * 🔴 AND IT REFUSES A CATEGORY THE DATABASE WILL REFUSE. `service_offerings.category` carries a
 * CHECK over five values. MEASURED IN THE CORPUS: `seedServiceOfferings` writes `'uncategorized'`
 * for anything it does not recognise — a D-9 honesty fix that **Postgres rejects outright**, and
 * the caller swallows the error as *"seed (non-fatal)"*. Filed as tech-debt; refused here so this
 * writer cannot join it.
 *
 * ⚠️ IT NEVER UPDATES. A name already on her menu is refused rather than overwritten — this
 * screen adds what her books evidence; correcting an existing row is the Services editor's job,
 * one card down the same page.
 */
export function buildServiceRows(input: {
  accepted: AcceptedService[];
  businessId: string;
  existing: ExistingOffering[];
}): ServiceWriteResult {
  const { accepted, businessId, existing } = input;
  if (!businessId) return { ok: false, reason: 'No business is selected, so nothing was written.' };
  if (accepted.length === 0) return { ok: false, reason: 'Nothing was ticked, so there is nothing to write.' };

  const taken = new Set(existing.map(e => e.name.trim().toLowerCase()));
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (const a of accepted) {
    const name = a.name.trim();
    if (!name) return { ok: false, reason: 'A service with no name cannot be saved — name it or untick it.' };
    const k = name.toLowerCase();
    if (taken.has(k)) {
      return { ok: false, reason: `"${name}" is already on your services list. Nothing was written — edit the existing one on the Services card below instead.` };
    }
    if (seen.has(k)) return { ok: false, reason: `Two rows are both named "${name}". Each service needs its own name.` };
    seen.add(k);

    if (!Number.isFinite(a.price) || a.price <= 0) {
      return { ok: false, reason:
        `"${name}" has no price. A service saved at $0 shows a customer that it is free, so nothing was written — ` +
        'type what you charge, or untick the row and add it later.' };
    }
    if (!(SERVICE_CATEGORIES as readonly string[]).includes(a.category)) {
      return { ok: false, reason: `"${name}" needs a kind before it can be saved. Nothing was written.` };
    }
    if (!(PRICE_UNITS as readonly string[]).includes(a.priceUnit)) {
      return { ok: false, reason: `"${name}" needs to say what the price is per. Nothing was written.` };
    }

    rows.push({
      business_id: businessId,
      name,
      description: a.description?.trim() || null,
      category: a.category,
      timing: 'at_checkout',
      // `flat` and `per_unit` are the same distinction `price_unit` already carries: a price per
      // ORDER is charged once. Deriving it here keeps the two columns from ever disagreeing.
      price_type: a.priceUnit === 'order' ? 'flat' : 'per_unit',
      price_unit: a.priceUnit,
      price: a.price,
      is_active: true,
      pre_selected: false,
      sort_order: a.sortOrder,
    });
  }
  return { ok: true, rows };
}
