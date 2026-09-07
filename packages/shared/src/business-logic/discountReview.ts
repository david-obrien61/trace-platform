// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Turn a QuickBooks books-read into a REVIEW a nursery owner can agree to — the
//               discount half of `business_pricing_config.config`. Every suggestion carries the
//               evidence it was derived from; anything unevidenced is REFUSED, never guessed.
// DEPENDENCIES: ../quickbooks/invoiceList (DiscountBreakdown — the tally) · ./tierPricing
//               (normalizeDiscountTypes, RETAIL_TIER_NAME) · ./CostToProduce (EMPTY_COST_CONFIG).
//               PURE — no client, no fetch, no React. Every probe runs it without a network.
// OUTPUTS:      buildDiscountReview · buildAcceptancePatch · suggestTypeName · REVIEW_REFUSALS
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS. `business_pricing_config` for LAWNS holds `{"taxRate": 0.0825}` and nothing
// else — measured 2026-09-07, the whole row. That single key is what checkout prices from, so
// `normalizeDiscountTypes` falls back to its seed, `resolveTier` returns the retail floor for
// every customer, and a contractor is charged retail. Nothing is broken; the config simply says
// this business gives no discounts, and the app believes it.
//
// The row was never seeded. `seedPricingConfig` produces twelve keys; this row has one, and one
// key is exactly what `mergePricingConfig(…, { taxRate })` writes onto an absent row. It was
// created sideways by two presses of Save on the Settings tax field, two minutes apart.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SURFACE, DON'T DECIDE — AND THE REASON IS THAT THIS IS A PRICE.
// A script that fills the config behind the owner is the wrong artifact. She is agreeing to what
// her business charges contractors; she has to see what she is agreeing to, and see what we read
// it from. So this module DERIVES and EXPLAINS, and writes nothing — `buildAcceptancePatch` is
// called only by a surface, only after a person pressed something.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// ✏️ CORRECTED 2026-09-07, AFTER THE SCREEN PRINTED DOLLARS WITH A PERCENT SIGN.
// The first version derived every rate from `|amount| ÷ qty` on an item line, on the strength of
// a comment in `invoiceList.ts` that said a discount line's `Qty` is the dollar base. **It is
// not. It is 1, on all 21 of LAWNS's item lines** — so the division did nothing and the screen
// rendered `$182.50` as **"18250%"**, then correctly concluded that six such "rates" disagreed
// and refused to suggest anything. **"0 we're sure about" was an artifact of the arithmetic.**
// [[R-26]] in our own corpus: a written declaration nobody checked against reality, steering a
// build — and I quoted that very comment as the justification.
//
// 🔴 THE ARCHITECTURE THAT REPLACES IT HAS THREE SOURCES AND NEVER BLENDS THEM:
//   ① THE PRICE CARD (the product list) — the NAME and the PUBLISHED rate, e.g. `CD10%` at
//      −0.1. **Exact, and the only source that carries a name.** It is what becomes a tier.
//   ② THE NATIVE DISCOUNT LINES (`DiscountLineDetail`) — the rate QuickBooks STATED, from
//      `DiscountPercent`. No arithmetic, so this class of error cannot recur. MEASURED on LAWNS:
//      67 of these against 21 item lines — **this is where the business actually discounts.**
//      ⚠️ They carry NO name (all 67 point at one account, `92 · Discounts given`), so they
//      corroborate a rate and can never name a programme.
//   ③ THE ITEM LINES — named, rate DERIVED from the other charged lines on the same invoice,
//      **presented as derived with the working shown**, never as a stated fact.
//
// 🔴 AND A RATIO GUARD, BECAUSE THE DEFECT WAS ONE LINE OF ARITHMETIC: nothing renders as a
// percent unless it was computed as a ratio, and anything above 100 is REFUSED as evidence that
// the code producing it is wrong. See `PERCENT_CEILING`.
//
// ⚠️ THE PERCENT IS STILL A DISTRIBUTION, NEVER AN AVERAGE — that fix was right and stands. It
// was simply downstream of this one: the values being distributed were never rates.
// ─────────────────────────────────────────────────────────────────────────────
import type { DiscountBreakdown, DiscountNameTally, DiscountRateTally } from '../quickbooks/invoiceList';
import { normalizeDiscountTypes, RETAIL_TIER_NAME, type DiscountType } from './tierPricing';
import { EMPTY_COST_CONFIG } from './CostToProduce';

/** The ITEM-side fact for a discount: what her books say the thing IS, beside what it DID. */
export interface DiscountItemFact {
  /** Intuit's item `Id` — the evidence anchor a person can look up in QuickBooks. */
  id: string;
  name: string;
  description: string | null;
  /** Intuit's `UnitPrice` on the item. For a percent discount it is a NEGATIVE FRACTION (−0.1). */
  unitPrice: number | null;
}

/**
 * 🔴 NOTHING ABOVE THIS IS A PERCENT. The defect this constant exists for rendered `$182.50` as
 * `18250%`, and every number on that screen was above 100 — so the cheapest possible guard is
 * also a complete one for that failure. A discount above 100% would pay the customer to take the
 * tree; if one is ever computed, the code that produced it is wrong and the number is REFUSED
 * rather than printed.
 */
export const PERCENT_CEILING = 100;

/** Why a discount that EXISTS in the books is still not being suggested. */
export const REVIEW_REFUSALS = {
  noPublishedRate: 'no-published-rate',
  ratesDisagree: 'rates-disagree',
  reservedName: 'reserved-name',
  impossibleRate: 'impossible-rate',
} as const;
export type ReviewRefusal = typeof REVIEW_REFUSALS[keyof typeof REVIEW_REFUSALS];

/** One derived rate with the working that produced it, so a reader can check it. */
export interface DerivedRate {
  pct: number;
  lines: number;
}

export interface EvidencedDiscount {
  /** Stable key AND the tier name that will be written. Her books' own item name. */
  tierName: string;
  /** The TYPE it is grouped under — suggested from the item's own words, EDITABLE before accept. */
  typeName: string;
  /** 🔴 THE SUGGESTION, AND IT COMES FROM THE PRICE CARD — `|UnitPrice| × 100`, exact. `null`
   *  when the item publishes no usable rate, which is a REFUSAL and never a guess. */
  percent: number | null;
  /** The item record behind it. Always present for a suggestible row — it is the name's source. */
  item: DiscountItemFact;

  // ── ② corroboration from the NATIVE lines, matched on the rate ──────────────────────────
  /** Native `DiscountLineDetail` lines that granted EXACTLY this item's published rate. */
  grantedLines: number;
  grantedAmount: number;
  grantedCustomers: number;
  grantedFirst: string | null;
  grantedLast: string | null;
  /** 🔴 How many OTHER items publish this same rate. >0 means the native lines above CANNOT be
   *  attributed to this programme, and the screen must say so rather than implying they can. */
  sharesRateWith: string[];

  // ── ③ corroboration from the ITEM lines, derived ────────────────────────────────────────
  itemLines: number;
  /** Lines carrying $0 — counted, never rated. A giveaway is not a discount. */
  zeroLines: number;
  /** Derived rates, most-used first. Present as DERIVED with the working, never as fact. */
  derived: DerivedRate[];
  /** Derived rates BELOW the published one — the honest reading is that the discount covered
   *  part of the invoice (the trees and not the delivery), which is what it is supposed to do. */
  derivedBelow: number;
  /** 🔴 Derived rates ABOVE the published one. A real anomaly: more was given than the programme
   *  says. Surfaced, never averaged away. */
  derivedAbove: number;
  mostRecent: string | null;
  /** A handful of real invoices with the arithmetic spelled out. */
  workings: { docNumber: string | null; txnDate: string | null; amount: number; base: number | null; derivedPct: number | null }[];

  refusal: ReviewRefusal | null;
}

/** A rate her invoices granted that NOTHING in her product list names. */
export interface UnnamedRate {
  pct: number;
  lines: number;
  amountTotal: number;
  customers: number;
  first: string | null;
  last: string | null;
}

/** A tier the OWNER told us about that her books do not evidence. Measured absence, not a guess. */
export interface StatedTier {
  name: string;
  invoiceLines: number;
  existsAsItem: boolean;
}

export interface DiscountReview {
  sure: EvidencedDiscount[];
  needsHer: EvidencedDiscount[];
  notSuggesting: StatedTier[];
  /** 🔴 Rates her books GRANTED that no item names — on LAWNS this is the biggest money on the
   *  page ($15,173 at 20%). She can name one herself; we will not invent a name for it. */
  unnamedRates: UnnamedRate[];
  /** Fixed-dollar discounts. Reported as money, NEVER converted into a percentage. */
  fixedDollar: { lines: number; amountTotal: number } | null;
  alreadyConfigured: string[];
  plumbingMissing: string[];
  configRowPresent: boolean;
  taxRatePresent: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Suggest the TYPE a discount belongs under, from the item's own words.
 *
 * "Contractor Discount, 10%" → "Contractor". "Military Discount 5%" → "Military". The word
 * `discount` carries no information here (every row is one) and a bare rate is not a name.
 *
 * ⚠️ IT RETURNS THE INPUT WHEN IT CANNOT IMPROVE ON IT, AND NEVER INVENTS A WORD. An item named
 * `CD10%` with no description yields `CD10%` — which reads oddly as a type and is EXACTLY right:
 * we do not know that CD means contractor, and a screen that silently decided it did would be
 * asserting a fact about her business from two letters. She edits it; that is the pattern.
 */
export function suggestTypeName(raw: string | null | undefined): string {
  const src = (raw ?? '').trim();
  if (!src) return '';
  const kept = src
    .split(/[\s,]+/)
    .filter(w => !/^discounts?,?$/i.test(w) && !/^disc\.?$/i.test(w) && !/^off$/i.test(w))
    // A token with no letter is a rate, a code or punctuation — never part of a name.
    .filter(w => /[A-Za-z]/.test(w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')))
    .join(' ')
    .trim();
  return kept || src;
}

/**
 * The item's published rate as a PERCENT. Intuit stores −0.1 for "10% off".
 *
 * 🔴 THE RANGE TEST IS THE GUARD, NOT A TIDY-UP. A value ≥ 1 is a flat dollar amount or a
 * mis-keyed item; reading `−25` as "2500% off" is the exact shape of the defect this file was
 * corrected for, one field over.
 */
export function itemPercentOf(item: DiscountItemFact | null): number | null {
  if (!item || item.unitPrice === null) return null;
  const p = Math.abs(item.unitPrice);
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  return round2(p * 100);
}

/**
 * Is this product-list item a DISCOUNT rather than something she sells?
 *
 * 🔴 IT CANNOT BE "NEGATIVE PRICE" ALONE, AND MD10 IS WHY. MEASURED on LAWNS: six items carry a
 * negative `UnitPrice` and a seventh — `MD10`, description *"Military Discount  -10%"* — carries
 * **0**. Keying only on the price silently drops a real discount programme, and dropping it is
 * invisible: the screen simply never mentions it.
 *
 * ⚠️ THE CODE PATTERN IS DELIBERATELY NARROW. `^(CD|FD|MD)\d` matches her shorthand for a discount
 * and nothing in a tree catalogue — a broad `/d/` or a bare `/disc/` would start pulling products
 * in, and a product offered as a discount tier is worse than a discount missed.
 */
export function isDiscountItem(item: { name: string; description: string | null; unitPrice: number | null }): boolean {
  if (item.unitPrice !== null && item.unitPrice < 0) return true;
  const name = (item.name ?? '').trim();
  if (/discount/i.test(name)) return true;
  if (/^(CD|FD|MD)\d/i.test(name)) return true;
  return false;
}

function readOne(
  item: DiscountItemFact,
  tally: DiscountNameTally | null,
  rates: DiscountRateTally[],
  allItems: DiscountItemFact[],
): EvidencedDiscount {
  const published = itemPercentOf(item);
  const granted = published === null ? null : (rates.find(r => Math.abs(r.pct - published) < 0.005) ?? null);
  const sharesRateWith = published === null ? [] : allItems
    .filter(o => o.id !== item.id && itemPercentOf(o) !== null && Math.abs((itemPercentOf(o) as number) - published) < 0.005)
    .map(o => o.name);

  const derived = tally?.percents ?? [];
  const derivedAbove = published === null ? 0 : derived.filter(d => d.pct > published + 0.005).reduce((n, d) => n + d.lines, 0);
  const derivedBelow = published === null ? 0 : derived.filter(d => d.pct < published - 0.005).reduce((n, d) => n + d.lines, 0);

  let percent = published;
  let refusal: ReviewRefusal | null = null;
  if (published === null) {
    refusal = REVIEW_REFUSALS.noPublishedRate;
  } else if (published > PERCENT_CEILING) {
    // Unreachable through `itemPercentOf` (it refuses anything ≥ 1 before multiplying), and kept
    // because the ceiling must be enforced where a percent is DECIDED, not only where it is read.
    refusal = REVIEW_REFUSALS.impossibleRate;
    percent = null;
  } else if (derivedAbove > 0) {
    // More was given than the programme says. That is a question for her, not a rate to average.
    refusal = REVIEW_REFUSALS.ratesDisagree;
    percent = null;
  }

  if (item.name.trim().toLowerCase() === RETAIL_TIER_NAME) {
    refusal = REVIEW_REFUSALS.reservedName;
    percent = null;
  }

  return {
    tierName: item.name,
    typeName: suggestTypeName(item.description ?? item.name),
    percent,
    item,
    grantedLines: granted?.lines ?? 0,
    grantedAmount: granted?.amountTotal ?? 0,
    grantedCustomers: granted?.customers ?? 0,
    grantedFirst: granted?.first ?? null,
    grantedLast: granted?.last ?? null,
    sharesRateWith,
    itemLines: tally?.lines ?? 0,
    zeroLines: tally?.zeroAmountLines ?? 0,
    derived,
    derivedBelow,
    derivedAbove,
    mostRecent: tally?.mostRecent ?? null,
    workings: tally?.examples ?? [],
    refusal,
  };
}

/**
 * Read the books into a review.
 *
 * 🔴 THE AXIS IS THE PRODUCT LIST, NOT THE INVOICES, AND THAT IS THE CORRECTION. Only an item
 * carries a NAME, and only a named thing can become a tier — a native `DiscountLineDetail` states
 * a rate and nothing else (all 67 of LAWNS's point at one account). So every candidate row starts
 * as an ITEM, and the invoices are read as evidence ABOUT it. Building the rows from the invoice
 * tally, as the first version did, is why `CD10%` and `CD15%` never reached the screen: they are
 * real items that have simply never been used as item LINES.
 *
 * `statedTiers` are names the OWNER gave us that the books may not evidence — LAWNS's spreadsheet
 * names a Contractor 35% and a Contractor 25%. They are MEASURED against the books here and put
 * on screen in their own section: she will ask why her spreadsheet's tiers are missing, and the
 * answer should already be in front of her.
 */
export function buildDiscountReview(input: {
  discounts: DiscountBreakdown | null;
  /** Every discount-shaped item from her product list. THE SOURCE OF EVERY CANDIDATE ROW. */
  items: DiscountItemFact[];
  /** The `config` jsonb as read, or `null` when the row is ABSENT (≠ an empty config). */
  config: Record<string, unknown> | null;
  statedTiers: string[];
}): DiscountReview {
  const { discounts, items, config, statedTiers } = input;

  // Every tier name already configured, from the ONE reader checkout uses — so "already there"
  // means the same thing here as it does at the till, including the legacy pricingTiers
  // forward-migration. A second flattening rule would drift from `resolveTier` (STD-011).
  const configuredTypes: DiscountType[] = config ? normalizeDiscountTypes(config) : [];
  const configuredNames = new Set<string>();
  for (const ty of configuredTypes) for (const ti of ty.tiers) configuredNames.add(ti.name.trim().toLowerCase());
  // The seed `normalizeDiscountTypes` returns for an unconfigured business is not a CONFIGURED
  // tier — it is the absence of one wearing a default. Treat it as absent, or the screen would
  // report "already configured" to a business that has configured nothing.
  //
  // 🔴 `pricingTiers` COUNTS, AND LEAVING IT OUT WAS A DEFECT — caught by a probe, 2026-09-07.
  // `normalizeDiscountTypes` FORWARD-MIGRATES a legacy flat `pricingTiers` when `discountTypes`
  // is absent, so those tiers ARE configured and resolve at checkout today. Keying "has she
  // configured anything" on `discountTypes` alone would re-offer a legacy business every tier it
  // already has — and accepting one would then be refused as a duplicate name, with no way for
  // her to see why. The seed is the case where NEITHER key is present.
  const seeded = !config || (config.discountTypes === undefined && config.pricingTiers === undefined);
  const configured = seeded ? new Set<string>() : configuredNames;

  const rates = discounts?.byRate ?? [];
  const tallies = discounts?.byName ?? [];
  const findTally = (name: string) =>
    tallies.find(t => t.itemName.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;

  const rows = items.map(it => readOne(it, findTally(it.name), rates, items));
  const alreadyConfigured: string[] = [];
  const sure: EvidencedDiscount[] = [];
  const needsHer: EvidencedDiscount[] = [];

  for (const r of rows) {
    if (configured.has(r.tierName.trim().toLowerCase())) { alreadyConfigured.push(r.tierName); continue; }
    if (r.refusal === null && r.percent !== null) sure.push(r); else needsHer.push(r);
  }
  // Most-evidenced first — a programme used 28 times leads one used twice.
  sure.sort((a, b) => (b.grantedLines + b.itemLines) - (a.grantedLines + a.itemLines) || a.tierName.localeCompare(b.tierName));

  // 🔴 RATES GRANTED THAT NOTHING NAMES. On LAWNS this is the largest money on the page and no
  // previous surface could see it: 20% on 4 lines is $15,173, and no item publishes 20%.
  const publishedRates = items.map(itemPercentOf).filter((p): p is number => p !== null);
  const unnamedRates: UnnamedRate[] = rates
    .filter(r => !publishedRates.some(p => Math.abs(p - r.pct) < 0.005))
    .map(r => ({ pct: r.pct, lines: r.lines, amountTotal: r.amountTotal, customers: r.customers, first: r.first, last: r.last }));

  // The owner's own names, measured. `existsAsItem` and `invoiceLines` are two different absences
  // — "she has no such item" and "the item exists but nobody ever used it" are different facts
  // about her business, and the screen says which one it found.
  const notSuggesting: StatedTier[] = statedTiers.map(name => {
    const k = name.trim().toLowerCase();
    return {
      name,
      invoiceLines: findTally(name)?.lines ?? 0,
      existsAsItem: items.some(i => i.name.trim().toLowerCase() === k),
    };
  });

  const plumbingMissing = Object.keys(EMPTY_COST_CONFIG).filter(k => !config || config[k] === undefined);

  return {
    sure,
    needsHer,
    notSuggesting,
    unnamedRates,
    fixedDollar: discounts ? { lines: discounts.fixedDollar.lines, amountTotal: discounts.fixedDollar.amountTotal } : null,
    alreadyConfigured,
    plumbingMissing,
    configRowPresent: config !== null,
    taxRatePresent: !!config && config.taxRate !== undefined,
  };
}

/** What a person actually accepted on the screen — a name, a type and a rate, all editable. */
export interface AcceptedTier {
  typeName: string;
  tierName: string;
  percent: number;
}

export type PatchRefusal =
  | { ok: false; reason: string };
export type PatchResult =
  | { ok: true; patch: Record<string, unknown>; wroteTaxRate: false; tiersWritten: number; plumbingWritten: string[] }
  | PatchRefusal;

/**
 * Build the ONE patch `mergePricingConfig` will apply. Returns a REFUSAL rather than a patch when
 * anything about the read makes writing unsafe.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IT REFUSES WHEN THE READ RETURNED NO ROW, AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE.
 * `mergePricingConfig` FAILS OPEN on an empty read: an RLS-filtered `readPricingConfig` returns
 * `data: null` with NO error, so `current` becomes `{}` and the write REPLACES THE ENTIRE CONFIG
 * with the patch. At LAWNS that would delete `taxRate: 0.0825` and every invoice after it would
 * charge $0 tax under a redline. A caller who cannot first prove the row exists must not write.
 *
 * 🔴 AND IT NEVER PUTS `taxRate` IN THE PATCH — asserted, not merely omitted. `mergePricingConfig`
 * is `{ ...current, ...patch }`, so patch wins on any shared key. `EMPTY_COST_CONFIG` carries no
 * `taxRate`, which makes the two key sets disjoint and needs no operand reversal — but "disjoint
 * today" is a property of a constant somebody could edit, so the disjointness is CHECKED here and
 * the write refuses if it ever stops holding.
 *
 * ⚠️ PLUMBING IS WRITTEN ONLY WHERE IT IS ABSENT. This is a create-if-absent act, exactly what
 * `seedPricingConfig` was for — and that function is UNUSABLE for an existing tenant:
 * `ignoreDuplicates: true` makes it a silent no-op that returns `error: null` and reads exactly
 * like success. Never call it here. An existing `margin` or `locations` is the owner's, and a
 * seed that overwrote it would be the clobber the merge path exists to prevent.
 */
export function buildAcceptancePatch(input: {
  accepted: AcceptedTier[];
  /** The config AS READ, immediately before writing. `null` = no row = refuse. */
  config: Record<string, unknown> | null;
}): PatchResult {
  const { accepted, config } = input;

  if (config === null) {
    return { ok: false, reason:
      'We could not read this business’s pricing settings, so nothing was written. Writing now ' +
      'would replace the whole record — including the sales-tax rate — instead of adding to it.' };
  }
  if (accepted.length === 0) {
    return { ok: false, reason: 'Nothing was accepted, so there is nothing to write.' };
  }

  // Validate every accepted row against the SAME rules the Discounts editor enforces, so a row
  // that would be rejected there can never be written from here (two writers, one vocabulary).
  const seen = new Set<string>();
  for (const a of accepted) {
    const tier = a.tierName.trim();
    const type = a.typeName.trim();
    if (!tier) return { ok: false, reason: 'A tier with no name cannot be written — name it or remove it.' };
    if (!type) return { ok: false, reason: `"${tier}" has no discount type — name the type or remove the row.` };
    if (tier.toLowerCase() === RETAIL_TIER_NAME) {
      return { ok: false, reason: '"retail" is the reserved full-price floor and cannot be a discount tier.' };
    }
    if (seen.has(tier.toLowerCase())) {
      return { ok: false, reason: `Two rows are both named "${tier}". Tier names must be unique across every type.` };
    }
    seen.add(tier.toLowerCase());
    // 🔴 THE RATIO GUARD, AT THE WRITE. `PERCENT_CEILING` is enforced here as well as at the
    // read because this is the last point before a number becomes a price: the 2026-09-07 defect
    // produced 18250 and every layer that merely passed it along shares the blame.
    if (!Number.isFinite(a.percent) || a.percent < 0 || a.percent > PERCENT_CEILING) {
      return { ok: false, reason:
        a.percent > PERCENT_CEILING
          ? `"${tier}" came through as ${a.percent}%, which is not a percentage — a discount cannot exceed 100%. Nothing was written.`
          : `"${tier}" needs a percent between 0 and ${PERCENT_CEILING}.` };
    }
  }

  // Merge onto what is already configured rather than replacing it — a business part-way through
  // configuring discounts keeps what it had. Existing types absorb new tiers by name.
  const existing: DiscountType[] = config.discountTypes === undefined ? [] : normalizeDiscountTypes(config);
  const byType = new Map<string, DiscountType>();
  for (const ty of existing) byType.set(ty.name.trim().toLowerCase(), { name: ty.name, tiers: [...ty.tiers] });
  for (const a of accepted) {
    const k = a.typeName.trim().toLowerCase();
    const ty = byType.get(k) ?? { name: a.typeName.trim(), tiers: [] };
    ty.tiers.push({ name: a.tierName.trim(), basis: 'retail_minus_percent', discountPercent: a.percent });
    byType.set(k, ty);
  }

  const patch: Record<string, unknown> = { discountTypes: [...byType.values()] };

  // 🔴 PLUMBING — ABSENT KEYS ONLY, and `taxRate` is not among them because EMPTY_COST_CONFIG has
  // no such key. The filter is on the CONFIG, so a tenant that already carries `margin` keeps it.
  const plumbingWritten: string[] = [];
  for (const [k, v] of Object.entries(EMPTY_COST_CONFIG)) {
    if (config[k] === undefined) { patch[k] = v; plumbingWritten.push(k); }
  }

  // The assertion, not the assumption. If a future edit to EMPTY_COST_CONFIG ever adds `taxRate`,
  // this refuses instead of silently overwriting a live sales-tax rate.
  if (Object.prototype.hasOwnProperty.call(patch, 'taxRate')) {
    return { ok: false, reason:
      'Refused: this change would have overwritten the sales-tax rate. Nothing was written.' };
  }

  return { ok: true, patch, wroteTaxRate: false, tiersWritten: accepted.length, plumbingWritten };
}
