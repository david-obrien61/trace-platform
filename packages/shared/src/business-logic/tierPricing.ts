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
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}
