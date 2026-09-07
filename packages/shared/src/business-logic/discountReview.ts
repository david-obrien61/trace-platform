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
// 🔴 EVERY NUMBER IS MEASURED FROM HER OWN BOOKS. Not one rate is typed into this repo. The
// percentages come from `|amount| ÷ base` on her invoice lines; the line counts, the dates and
// the item ids come from the same read. A rate we cannot measure is REFUSED and she enters it —
// which is the whole difference between a suggestion and a guess, and it is why the refusals
// below are a first-class output rather than an empty array.
//
// ⚠️ THE PERCENT IS A DISTRIBUTION, NEVER AN AVERAGE. See `DiscountNameTally.percents`. A tier
// is suggested ONLY when every measurable line granted the SAME rate; two rates under one name
// is a question for the owner, not a mean for us to compute.
// ─────────────────────────────────────────────────────────────────────────────
import type { DiscountBreakdown, DiscountNameTally } from '../quickbooks/invoiceList';
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

/** Why a discount that EXISTS in the books is still not being suggested. Ordered by how much it
 *  matters to a reader; the first matching reason is the one reported. */
export const REVIEW_REFUSALS = {
  noMeasurableRate: 'no-measurable-rate',
  ratesDisagree: 'rates-disagree',
  reservedName: 'reserved-name',
} as const;
export type ReviewRefusal = typeof REVIEW_REFUSALS[keyof typeof REVIEW_REFUSALS];

export interface EvidencedDiscount {
  /** Stable key for a list render AND the tier name that will be written. Her books' item name. */
  tierName: string;
  /** The TYPE it is grouped under — suggested from the item's own words, EDITABLE before accept. */
  typeName: string;
  /** The rate, as a percent off. Measured, never assumed. `null` when it could not be measured. */
  percent: number | null;
  /** Invoice lines carrying this discount. */
  lines: number;
  /** Lines whose rate we could actually measure (a positive base and an amount). */
  measuredLines: number;
  /** Intuit `TxnDate` of the most recent invoice carrying it — the "is this still in use" fact. */
  mostRecent: string | null;
  /** Every rate found under this name, most-used first. One entry = one rate, always. */
  rates: { pct: number; lines: number }[];
  /** The item record behind it, when the item read found one. */
  item: DiscountItemFact | null;
  /** The item's own published rate as a percent (|−0.1| → 10), when it publishes one. */
  itemPercent: number | null;
  /** 🔴 TWO SOURCES AGREEING. True when the item's published rate matches what the invoices did. */
  sourcesAgree: boolean;
  /** Set only on a REFUSED row — why we are not suggesting a number for it. */
  refusal: ReviewRefusal | null;
}

/** A tier the OWNER told us about that her books do not evidence. Measured absence, not a guess. */
export interface StatedTier {
  name: string;
  /** Did any invoice line grant it? */
  invoiceLines: number;
  /** Does an item by that name exist in her books at all? */
  existsAsItem: boolean;
}

export interface DiscountReview {
  /** Measured, one consistent rate, not already configured — safe to suggest as-is. */
  sure: EvidencedDiscount[];
  /** Found in the books, rate NOT suggestible — she sets it. Carries `refusal`. */
  needsHer: EvidencedDiscount[];
  /** Named by the owner, absent from the books. Shown and deliberately NOT seeded. */
  notSuggesting: StatedTier[];
  /** Tier names already in the config — reported so the screen never offers a duplicate. */
  alreadyConfigured: string[];
  /** Top-level plumbing keys absent from the config. Filled silently; nothing to decide. */
  plumbingMissing: string[];
  /** 🔴 The write-safety gate. See `buildAcceptancePatch`. */
  configRowPresent: boolean;
  taxRatePresent: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Suggest the TYPE a discount belongs under, from the item's own words.
 *
 * "Contractor Discount" → "Contractor". "Military Discount 5" → "Military". The word `discount`
 * carries no information here (every row is one) and a bare number is a rate, not a name.
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
    .split(/\s+/)
    .filter(w => !/^discounts?$/i.test(w) && !/^disc\.?$/i.test(w))
    // A token with no letter is a rate, a code or punctuation — never part of a name.
    .filter(w => /[A-Za-z]/.test(w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')))
    .join(' ')
    .trim();
  return kept || src;
}

/** The item's published rate as a PERCENT. Intuit stores −0.1 for "10% off". */
function itemPercentOf(item: DiscountItemFact | null): number | null {
  if (!item || item.unitPrice === null) return null;
  const p = Math.abs(item.unitPrice);
  // A published FRACTION is what a percent discount item carries. A value ≥ 1 is a flat dollar
  // amount (or a mis-keyed item) and must NOT be read as "100% off" — refuse rather than convert.
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  return round2(p * 100);
}

function readOne(tally: DiscountNameTally, items: DiscountItemFact[]): EvidencedDiscount {
  const key = tally.itemName.trim().toLowerCase();
  // Case-insensitive, for the same reason `isNamedDiscount` is: comparing against Intuit's own
  // casing is the bug class `normalizeSize` exists for.
  const item = items.find(i => i.name.trim().toLowerCase() === key) ?? null;
  const rates = tally.percents;
  const measuredLines = rates.reduce((n, r) => n + r.lines, 0);
  const itemPercent = itemPercentOf(item);

  let percent: number | null = null;
  let refusal: ReviewRefusal | null = null;
  if (rates.length === 0) refusal = REVIEW_REFUSALS.noMeasurableRate;
  else if (rates.length > 1) refusal = REVIEW_REFUSALS.ratesDisagree;
  else percent = rates[0].pct;

  // The reserved floor name can never be a tier (`Discounts` validate() rejects it, and
  // `resolveTier` treats it as "no discount"), so it is refused HERE rather than written and
  // bounced — a suggestion the editor would reject is not a suggestion.
  if (tally.itemName.trim().toLowerCase() === RETAIL_TIER_NAME) {
    refusal = REVIEW_REFUSALS.reservedName;
    percent = null;
  }

  return {
    tierName: tally.itemName,
    typeName: suggestTypeName(item?.description ?? tally.itemName),
    percent,
    lines: tally.lines,
    measuredLines,
    mostRecent: tally.mostRecent,
    rates,
    item,
    itemPercent,
    // Agreement is only claimable when BOTH sides produced a number. Two nulls are not a match.
    sourcesAgree: percent !== null && itemPercent !== null && Math.abs(percent - itemPercent) < 0.005,
    refusal,
  };
}

/**
 * Read the books into a review.
 *
 * `statedTiers` are names the OWNER gave us that the books may not evidence — LAWNS's spreadsheet
 * names a Contractor 35% and a Contractor 25%. They are MEASURED against the books here and put
 * on screen in their own section: she will ask why her spreadsheet's tiers are missing, and the
 * answer should already be in front of her.
 */
export function buildDiscountReview(input: {
  discounts: DiscountBreakdown | null;
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

  const rows = (discounts?.byName ?? []).map(t => readOne(t, items));
  const alreadyConfigured: string[] = [];
  const sure: EvidencedDiscount[] = [];
  const needsHer: EvidencedDiscount[] = [];

  for (const r of rows) {
    if (configured.has(r.tierName.trim().toLowerCase())) { alreadyConfigured.push(r.tierName); continue; }
    if (r.refusal === null && r.percent !== null) sure.push(r); else needsHer.push(r);
  }

  // The owner's own names, measured. `existsAsItem` and `invoiceLines` are two different absences
  // — "she has no such item" and "the item exists but nobody ever used it" are different facts
  // about her business, and the screen says which one it found.
  const notSuggesting: StatedTier[] = statedTiers.map(name => {
    const k = name.trim().toLowerCase();
    const tally = (discounts?.byName ?? []).find(t => t.itemName.trim().toLowerCase() === k) ?? null;
    return {
      name,
      invoiceLines: tally?.lines ?? 0,
      existsAsItem: items.some(i => i.name.trim().toLowerCase() === k),
    };
  });

  const plumbingMissing = Object.keys(EMPTY_COST_CONFIG).filter(k => !config || config[k] === undefined);

  return {
    sure,
    needsHer,
    notSuggesting,
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
    if (!Number.isFinite(a.percent) || a.percent < 0 || a.percent > 100) {
      return { ok: false, reason: `"${tier}" needs a percent between 0 and 100.` };
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
