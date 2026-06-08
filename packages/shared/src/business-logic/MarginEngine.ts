/**
 * Shared canonical margin/pricing engine (THUNDER · Build 1 · 2026-06-10).
 * Replaces: packages/ignition-os/MarginEngine.js (A — source of truth for slab logic)
 *           packages/shared/src/pricing/marginEngine.ts (B — dead 17-line stub, broken rounding)
 *           DataBridge.getActiveMargin / .calculateRetail (C — prot_matrix model, retired)
 *
 * AC-1 compliance: tier names (FLEET, LEGACY, FF, STANDARD, …) are pure string values
 * in config data. They are NEVER TypeScript identifiers, enum members, or switch-case
 * labels. A vertical can configure any tier taxonomy — the engine is vertical-agnostic.
 *
 * Charm rounding matches A exactly: Math.ceil(retail) - 0.01  (NOT Math.floor + 0.99).
 * Overhead wires the prot_matrix.monthly totals into loaded cost before markup (TD#16).
 */

// ── Config types ──────────────────────────────────────────────────────────────

export interface MarginSlab {
  /** Human label, optional. */
  label?: string;
  /**
   * Upper bound of this slab (inclusive). Use 9999999 to represent "no cap"
   * (Infinity is not JSON-serializable; callers that read config from DB use this value).
   */
  maxCost: number;
  multiplier: number;
}

export interface PricingTier {
  /** Tier identifier as a plain string — not a TS enum or constant. */
  name: string;
  discountPercent: number;
  isDefault?: boolean;
}

export interface MarginEngineConfig {
  slabs: MarginSlab[];
  /** All valid pricing tiers for this business. Tier names are vertical data, not code. */
  pricingTiers: PricingTier[];
  /**
   * Overhead cost per unit (e.g. monthly rent+electric+fuel ÷ monthly part count).
   * Added to vendor cost before slab selection and markup.
   * Wires DataBridge overhead_config into the price — previously orphaned (TD#16).
   */
  overheadPerUnit: number;
}

// ── Transaction analysis input ────────────────────────────────────────────────

export interface MarginTransaction {
  cost: number;
  actualPrice?: number;
  /** Must match a name in config.pricingTiers. Falls back to the isDefault tier. */
  tierName?: string;
}

export interface MarginAnalysis {
  loadedCost: number;
  suggested: number;
  leakage: number;
  /** Gross profit margin as a percentage string, e.g. "58.34" */
  margin: string;
}

// ── Default config — Ignition OS baseline ─────────────────────────────────────
// Preserves exact Ignition behavior when callers migrate from MarginEngine.js.
// Tier names are string values here, not code identifiers.

export const DEFAULT_MARGIN_CONFIG: MarginEngineConfig = {
  slabs: [
    { label: 'Consumables', maxCost: 50,      multiplier: 4.0  }, // $0–$50:   300% markup
    { label: 'Mid-Range',   maxCost: 200,     multiplier: 2.0  }, // $51–$200: 100% markup
    { label: 'Heavy',       maxCost: 1000,    multiplier: 1.5  }, // $201–$1k:  50% markup
    { label: 'Major',       maxCost: 9999999, multiplier: 1.25 }, // $1001+:    25% markup
  ],
  pricingTiers: [
    { name: 'STANDARD', discountPercent: 0,  isDefault: true },
    { name: 'FLEET',    discountPercent: 10 },
    { name: 'LEGACY',   discountPercent: 20 },
    { name: 'FF',       discountPercent: 5  },
  ],
  overheadPerUnit: 0,
};

// ── Core engine (pure functions — no DataBridge, no Supabase, no vertical imports) ──

/** Loaded cost = vendor cost + overhead-per-unit. This is the input to slab selection. */
function loadedCost(vendorCost: number, config: MarginEngineConfig): number {
  return vendorCost + (config.overheadPerUnit ?? 0);
}

/** Find the slab that applies to a loaded cost value. */
function slabForCost(cost: number, config: MarginEngineConfig): MarginSlab {
  return (
    config.slabs.find(s => cost <= s.maxCost) ??
    config.slabs[config.slabs.length - 1]
  );
}

/** Look up a tier's discount by name. Returns 0 for the default/unknown tier. */
function tierDiscount(tierName: string | undefined, config: MarginEngineConfig): number {
  if (!tierName) {
    const def = config.pricingTiers.find(t => t.isDefault);
    return def?.discountPercent ?? 0;
  }
  const tier = config.pricingTiers.find(t => t.name === tierName);
  return tier?.discountPercent ?? 0;
}

/**
 * Calculate retail price.
 *
 * Rounding: Math.ceil(retail) - 0.01   — matches MarginEngine.js (A) exactly.
 * Example: cost=$6, STANDARD → loaded=$6, slab=4×, base=$24 → $23.99.
 * With overhead: cost=$6, overhead=$2 → loaded=$8, slab=4×, base=$32 → $31.99.
 *
 * @param vendorCost  Raw vendor/wholesale cost (before overhead)
 * @param config      Engine config (slabs + tiers + overhead)
 * @param tierName    Tier name string from config.pricingTiers[].name (optional)
 */
export function calculateRetail(
  vendorCost: number,
  config: MarginEngineConfig = DEFAULT_MARGIN_CONFIG,
  tierName?: string,
): number {
  const numCost = parseFloat(String(vendorCost));
  if (isNaN(numCost) || numCost <= 0) return 0;

  const loaded    = loadedCost(numCost, config);
  const slab      = slabForCost(loaded, config);
  const baseRetail = loaded * slab.multiplier;
  const discount  = tierDiscount(tierName, config);
  const retail    = baseRetail * (1 - discount / 100);

  return Math.ceil(retail) - 0.01;
}

/**
 * Gross profit margin percentage.
 * @returns string like "58.34"
 */
export function getProfitMargin(vendorCost: number, retail: number): string {
  const r = parseFloat(String(retail));
  const c = parseFloat(String(vendorCost));
  if (!r || r <= 0) return '0.00';
  return (((r - c) / r) * 100).toFixed(2);
}

/**
 * Markup percent for a given vendor cost based on the active slab.
 * Does NOT include tier discounts.
 */
export function getMarkupPercent(vendorCost: number, config: MarginEngineConfig = DEFAULT_MARGIN_CONFIG): number {
  const loaded = loadedCost(parseFloat(String(vendorCost)) || 0, config);
  const slab   = slabForCost(loaded, config);
  return Math.round((slab.multiplier - 1) * 100);
}

/**
 * Leakage analysis: what should this transaction have earned vs what it did.
 * Drop-in replacement for MarginEngine.js analyzeTransaction().
 */
export function analyzeTransaction(tx: MarginTransaction, config: MarginEngineConfig = DEFAULT_MARGIN_CONFIG): MarginAnalysis {
  const loaded    = loadedCost(tx.cost, config);
  const suggested = calculateRetail(tx.cost, config, tx.tierName);
  const leakage   = Math.max(0, suggested - (tx.actualPrice ?? 0));
  const margin    = getProfitMargin(tx.cost, tx.actualPrice ?? 0);
  return { loadedCost: loaded, suggested, leakage, margin };
}
