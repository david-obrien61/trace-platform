/**
 * tierPricing.ts — customer price-tier → discount, the SOLE arithmetic for the cultivar
 * checkout path (THUNDER · 2026-07-09). Closes the Item-1 (D-35) AC-4 hold — "price_tier
 * read but not applied; tier math undefined."
 *
 * DECIDED (D-35 addendum, do NOT re-derive): tier → discount = PERCENT-OFF-BASELINE, owner-set
 * per tier, default 0%. The BASELINE is the stored business_inventory.sell_price (D-35 — the
 * charge is the stored retail price, NEVER re-derived from cost). This is DELIBERATELY separate
 * from MarginEngine.calculateRetail, which derives a price FROM vendor cost via markup slabs —
 * the cultivar order path never touches cost. The reusable piece is the tier arithmetic (lookup
 * + ×(1−d/100)), not the slab engine. PricingTier is shared with MarginEngine (one shape).
 *
 * AC-1: tier NAMES (retail/contractor/wholesale/…) are plain string DATA in the per-business
 * config jsonb — never TS identifiers, enum members, or switch labels. A business can configure
 * any tier taxonomy. The seed names below are generic small-business pricing tiers (not vertical
 * nouns), safe as a shared default.
 *
 * WHERE THE % LIVES: business_pricing_config.config.pricingTiers[] (jsonb, additive — no migration).
 * WHO APPLIES IT: submit.ts, SERVER-SIDE against the server-authoritative sell_price (tamper
 * defense — the client never supplies the discount or the tier).
 */

import type { PricingTier } from './MarginEngine';
export type { PricingTier };

/**
 * The seed tier set: retail (default, 0%) + the two other known pricing tiers at 0%. Every
 * percentage defaults to 0 (no discount) — "owner-set per tier, default 0%"; the owner sets
 * contractor/wholesale in Settings. Used when a business has no pricingTiers configured yet so
 * the config UI + the customer tier picker always present the full known value-set.
 */
export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  { name: 'retail',     discountPercent: 0, isDefault: true },
  { name: 'contractor', discountPercent: 0 },
  { name: 'wholesale',  discountPercent: 0 },
];

/** Clamp a raw percent into [0, 100]; non-finite / negative → 0. A discount never exceeds 100%. */
export function clampPercent(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 100 ? 100 : n;
}

/** Round to cents (money). */
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** THE percent-off primitive — the SINGLE place the ×(1−d/100) arithmetic lives. Both the legacy
 *  flat applyTierDiscount and the nested applyTierPrice call this, so the two can never drift. */
function pctOff(price: number, pct: number): number {
  return round2(price * (1 - pct / 100));
}

/**
 * Coerce a raw jsonb pricingTiers value into a clean PricingTier[]. Missing / empty / malformed
 * → a fresh copy of the seed. Guarantees exactly one isDefault (retail if present, else first)
 * so the "no tier / unknown tier → default" lookup always resolves.
 */
export function normalizePricingTiers(raw: unknown): PricingTier[] {
  const seed = () => DEFAULT_PRICING_TIERS.map(t => ({ ...t }));
  if (!Array.isArray(raw)) return seed();
  const clean = raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object' && typeof (t as Record<string, unknown>).name === 'string')
    .map(t => ({
      name: String((t as Record<string, unknown>).name),
      discountPercent: clampPercent(Number((t as Record<string, unknown>).discountPercent)),
      isDefault: (t as Record<string, unknown>).isDefault === true,
    }));
  if (clean.length === 0) return seed();
  if (!clean.some(t => t.isDefault)) {
    const def = clean.find(t => t.name.toLowerCase() === 'retail') ?? clean[0];
    def.isDefault = true;
  }
  return clean;
}

/** Look up a tier's discount percent by name; 0 for the default / unknown / null tier. */
export function tierDiscountPercent(tierName: string | null | undefined, tiers: PricingTier[]): number {
  if (!tierName) {
    const def = tiers.find(t => t.isDefault);
    return clampPercent(def?.discountPercent ?? 0);
  }
  const tier = tiers.find(t => t.name === tierName);
  return clampPercent(tier?.discountPercent ?? 0);
}

/**
 * Apply a customer's price tier to a baseline price (percent-off-baseline). Returns the price
 * UNCHANGED for retail / default / unknown / 0% (never ABOVE baseline — a tier only ever
 * discounts). Rounds to cents (money). Pure — the one place the tier→price step lives.
 */
export function applyTierDiscount(price: number, tierName: string | null | undefined, tiers: PricingTier[]): number {
  if (!(price > 0)) return price;
  const pct = tierDiscountPercent(tierName, tiers);
  if (pct <= 0) return price;
  return pctOff(price, pct);
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * DISCOUNT TYPES × TIERS (the generalized model · THUNDER · 2026-07-10)
 *
 * The flat single-level pricingTiers above is generalized to owner-named discount TYPES, each with
 * N owner-named TIERS, each tier a pricing BASIS:
 *   • 'retail_minus_percent' (DEFAULT) — a percent off the stored sell_price (the mechanism above).
 *   • 'at_cost'                        — charge the server-read unit_cost (margin 0 by definition).
 * This is STILL flat/owner-managed (D-38): N tiers is structure, NOT auto-progression. Nothing
 * earns, promotes, decays, or auto-applies. accessTerms is optional DESCRIPTIVE text (D-37) — the
 * platform never charges it.
 *
 * AC-1: type + tier NAMES are plain string DATA in the per-business config jsonb (no vertical noun,
 * no enum, no code branch). AC-4: types AND tiers grow as data — no migration, no count cap.
 *
 * RESOLUTION: customers.price_tier holds a single tier NAME (a flat string — no schema change). It
 * resolves against the FIRST tier matching that name across all types (the editor enforces
 * cross-type name-uniqueness, so first-match is unambiguous). null / 'retail' / an unknown name →
 * the RETAIL FLOOR (full sell_price, no discount) — money-safe: an unrecognized tier never discounts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

export type DiscountBasis = 'retail_minus_percent' | 'at_cost';

export interface DiscountTier {
  name: string;
  basis: DiscountBasis;
  /** Used ONLY when basis === 'retail_minus_percent'. */
  discountPercent: number;
  /** Optional owner-set descriptive text (D-37 — access terms are never charged by the platform). */
  accessTerms?: string;
}

export interface DiscountType {
  name: string;
  tiers: DiscountTier[];
}

/** The reserved floor tier name — always selectable, always full price. */
export const RETAIL_TIER_NAME = 'retail';

/** The always-present retail floor a customer resolves to when they have no tier / 'retail' / unknown. */
export const RETAIL_FLOOR: DiscountTier = { name: RETAIL_TIER_NAME, basis: 'retail_minus_percent', discountPercent: 0 };

/** Fresh-seed types when a business has never configured discounts (a single owner-editable type). */
export const DEFAULT_DISCOUNT_TYPES: DiscountType[] = [
  { name: 'Contractor', tiers: [{ name: 'contractor', basis: 'retail_minus_percent', discountPercent: 0 }] },
];

function cleanTier(raw: unknown): DiscountTier | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || r.name.trim() === '') return null;
  const basis: DiscountBasis = r.basis === 'at_cost' ? 'at_cost' : 'retail_minus_percent';
  const tier: DiscountTier = {
    name: String(r.name),
    basis,
    discountPercent: basis === 'at_cost' ? 0 : clampPercent(Number(r.discountPercent)),
  };
  if (typeof r.accessTerms === 'string' && r.accessTerms.trim() !== '') tier.accessTerms = String(r.accessTerms);
  return tier;
}

function cleanDiscountTypes(raw: unknown): DiscountType[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object' && typeof (t as Record<string, unknown>).name === 'string')
    .map(t => ({
      name: String((t as Record<string, unknown>).name),
      tiers: Array.isArray((t as Record<string, unknown>).tiers)
        ? ((t as Record<string, unknown>).tiers as unknown[]).map(cleanTier).filter((x): x is DiscountTier => x !== null)
        : [],
    }))
    .filter(t => t.name.trim() !== '');
}

/**
 * Coerce a raw config jsonb into a clean DiscountType[]. NON-DESTRUCTIVE forward-migration:
 *   1. config.discountTypes present + non-empty → clean + return it (the new model).
 *   2. else legacy config.pricingTiers present  → wrap the non-retail flat tiers under a default
 *      "Contractor" type, carrying each tier's discountPercent (nothing already set is lost).
 *   3. else → the fresh seed.
 * Takes the WHOLE config object (needs both keys). Safe on null/garbage.
 */
export function normalizeDiscountTypes(config: unknown): DiscountType[] {
  const c = (config && typeof config === 'object') ? (config as Record<string, unknown>) : {};
  if (c.discountTypes !== undefined) {
    const cleaned = cleanDiscountTypes(c.discountTypes);
    if (cleaned.length) return cleaned;
  }
  if (c.pricingTiers !== undefined) {
    const flat = normalizePricingTiers(c.pricingTiers);
    const nonRetail = flat.filter(t => !t.isDefault && t.name.toLowerCase() !== RETAIL_TIER_NAME);
    const tiers: DiscountTier[] = nonRetail.map(t => ({
      name: t.name, basis: 'retail_minus_percent' as const, discountPercent: clampPercent(t.discountPercent),
    }));
    return [{ name: 'Contractor', tiers: tiers.length ? tiers : [{ name: 'contractor', basis: 'retail_minus_percent', discountPercent: 0 }] }];
  }
  return DEFAULT_DISCOUNT_TYPES.map(ty => ({ name: ty.name, tiers: ty.tiers.map(ti => ({ ...ti })) }));
}

/** Resolve a customer's assigned tier NAME to its tier (basis + percent). null/'retail'/unknown →
 *  the retail floor (full sell_price). First-match across types (names are unique per the editor). */
export function resolveTier(tierName: string | null | undefined, types: DiscountType[]): DiscountTier {
  if (!tierName || tierName.toLowerCase() === RETAIL_TIER_NAME) return { ...RETAIL_FLOOR };
  for (const ty of types) {
    const t = ty.tiers.find(x => x.name === tierName);
    if (t) return { ...t, discountPercent: clampPercent(t.discountPercent) };
  }
  return { ...RETAIL_FLOOR };
}

export interface TierPriceResult {
  /** The charge for one unit. */
  price: number;
  basis: DiscountBasis;
  /** True when the tier actually changed the price off retail. */
  applied: boolean;
  /** True when an at-cost tier had NO cost on file → fell back to retail sell_price (never $0). */
  degraded: boolean;
}

/**
 * THE tier→price step (the one place the basis branch lives). Given the server-authoritative
 * sell_price, the server-read unit_cost, and a resolved tier:
 *   • retail_minus_percent → sell_price × (1 − d/100)  [percent 0 → unchanged].
 *   • at_cost              → unit_cost.  GRACEFUL DEGRADATION (D-9, margin-aware concept): if the
 *     cost is null / ≤ 0 / UNKNOWN, do NOT fabricate $0 and do NOT silently charge $0 — fall back
 *     NEUTRAL to the retail sell_price and flag `degraded` so the caller surfaces an order note.
 * Non-positive sell_price passes through untouched (submit.ts refuses it upstream). Money-safe.
 */
export function applyTierPrice(sellPrice: number, unitCost: number | null | undefined, resolved: DiscountTier): TierPriceResult {
  if (!(sellPrice > 0)) return { price: sellPrice, basis: resolved.basis, applied: false, degraded: false };
  if (resolved.basis === 'at_cost') {
    const cost = Number(unitCost);
    if (!(cost > 0)) return { price: sellPrice, basis: 'at_cost', applied: false, degraded: true };
    return { price: round2(cost), basis: 'at_cost', applied: true, degraded: false };
  }
  const pct = clampPercent(resolved.discountPercent);
  if (pct <= 0) return { price: sellPrice, basis: resolved.basis, applied: false, degraded: false };
  return { price: pctOff(sellPrice, pct), basis: resolved.basis, applied: true, degraded: false };
}
