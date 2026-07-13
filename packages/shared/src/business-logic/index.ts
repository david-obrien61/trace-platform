export {
  calculateRetail,
  getProfitMargin,
  getMarkupPercent,
  analyzeTransaction,
  DEFAULT_MARGIN_CONFIG,
} from './MarginEngine';

export type {
  MarginSlab,
  PricingTier,
  MarginEngineConfig,
  MarginTransaction,
  MarginAnalysis,
} from './MarginEngine';

// Customer price-tier → discount (percent-off-baseline) — the SOLE arithmetic for the cultivar
// checkout tier discount (Item-1 AC-4 close, 2026-07-09). Reuses PricingTier from MarginEngine.
export {
  applyTierDiscount,
  tierDiscountPercent,
  normalizePricingTiers,
  clampPercent,
  DEFAULT_PRICING_TIERS,
  // Discount TYPES × TIERS — the generalized model (owner-named types, N tiers, per-tier basis;
  // THUNDER · 2026-07-10). normalizeDiscountTypes forward-migrates legacy pricingTiers non-destructively.
  normalizeDiscountTypes,
  resolveTier,
  applyTierPrice,
  RETAIL_TIER_NAME,
  RETAIL_FLOOR,
  DEFAULT_DISCOUNT_TYPES,
  // Order pricing — the single computation both Review and submit run (D-39 · 2026-07-10):
  // tier discounts GOODS lines only, services never, tax on the discounted subtotal.
  computeOrderPricing,
  // Tax on the money boundary (D-40 · 2026-07-13): the resolveTaxRate seam (per-tenant origin rate;
  // absent → null = "not identified"; Level-2 tax-API slots in here).
  resolveTaxRate,
} from './tierPricing';
export type {
  DiscountBasis, DiscountTier, DiscountType, TierPriceResult,
  PricingLineKind, PricingLineInput, PricedLine, OrderPricing,
  TaxStatus, OrderTaxExemption,
} from './tierPricing';
// Tax-exemption vocabulary + the single three-state tax-line presenter (D-40).
export {
  TAX_EXEMPTION_REASONS, taxExemptionLabel, describeTaxLine, TX_COMPTROLLER_RATE_LOCATOR_URL,
} from './taxExemption';
export type { TaxExemptionReason, TaxLineView } from './taxExemption';

// Cost-to-Produce — period-pool engine (THUNDER · 2026-06-14). MarginEngine-fed.
export {
  accumulate,
  analyze,
  confidenceMix,
  marginConfigForTarget,
  EMPTY_COST_CONFIG,
} from './CostToProduce';

export type {
  CostConfidence,
  CostPeriod,
  CostLine,
  LaborConfig,
  MarginTier,
  MarginPolicy,
  CostLocation,
  CostToProduceConfig,
  AccumulateOptions,
  AccumulatedLine,
  Accumulation,
  SensitivityRow,
  ConfidenceMix,
  CostToProduceResult,
} from './CostToProduce';

// Count-once slice seam — Core-2a SPIKE (THUNDER · 2026-06-15). The highest-risk
// accumulator→pool edge (§14). Query-time reconciliation; event is the unit of truth.
export {
  sameCost,
  classifyShape,
  enforceCountOnce,
  fromCostObject,
  fromRecurringLine,
} from './CountOnceSeam';

export type {
  AmountConfidence,
  Substantiation,
  Realization,
  CostBucket,
  CostShape,
  Cadence,
  CostEvent,
  MatchOutcome,
  EpistemicBucket,
  SuggestedDisposition,
  CostMatch,
  CountedEvent,
  ResidueLine,
  DedupRecord,
  SeamResult,
  CostObjectNodeRow,
  RecurringLineRow,
} from './CountOnceSeam';

// Dual-edge cost rollup — Core-2b SUB-2 (THUNDER · 2026-06-15). Traverses BOTH edge
// tables (structural use_fraction + temporal period-share, §5.2/§5.9) and feeds the
// attributed events THROUGH the count-once seam. Pure; no DB.
export { rollup } from './CostRollup';

export type {
  CostObjectEdgeRow,
  CostObjectAssignmentRow,
  CostGraph,
  Contribution,
  IdleCapital,
  NodeRollup,
} from './CostRollup';

// Project-lens adapter — D-10 (THUNDER · 2026-06-16). Re-cuts the SAME honest cost data
// BY PROJECT: synthesizes containment edges from cost_objects.parent_id (PATH A) and rolls
// each group up THROUGH CostRollup + the count-once seam. Pure; no DB.
export { buildProjectLens, OVERHEAD_GROUP_ID } from './ProjectLens';

export type {
  ProjectLensRow,
  ProjectGroup,
  ProjectLensView,
} from './ProjectLens';

// Schedule C cost-category set + label — shared by every cost-categorize surface
// (CostToProduceSettings recurring rows, BusinessAssets capital rows) so they can't drift.
export { CATEGORY_OPTS, UNCATEGORIZED, categoryLabel } from './costCategories';

// service_offerings schema enums (all-vertical, AC-1) — the ONE option-set for the
// service editor's category / price_type / price_unit / transport_mode selects, sourced
// from the migration column CHECKs so the picker can't offer or omit a rejected value.
export {
  CATEGORY_OPTIONS,
  TIMING_OPTIONS,
  PRICE_TYPE_OPTIONS,
  PRICE_UNIT_OPTIONS,
  TRANSPORT_MODE_OPTIONS,
  CATEGORY_LABEL,
  TIMING_LABEL,
  PRICE_UNIT_LABEL,
  TRANSPORT_MODE_LABEL,
} from './serviceOfferingEnums';
export type { EnumOption } from './serviceOfferingEnums';

// Customer find-or-create — the ONE shared customer write (cart + OCR-invoice both call it).
// Extracted from api/orders/submit.ts so a customer can be created without an order (Wave 2).
export { findOrCreateCustomer } from './customerUpsert';
export type { CustomerInput, CustomerUpsertResult } from './customerUpsert';

// Person create-or-link — the ONE shared write for the global `people` spine (Person-spine
// build, 2026-06-25). Owner signup / invite accept / customer upsert all call it. person_id
// is an OVERLAY, never the auth principal. See data/grower-scan/person-spine-recon.md.
export { findOrCreatePerson } from './personUpsert';
export type { PersonInput, PersonResult } from './personUpsert';

// Financial-wall data access (Phase 2, decision 2026-06-21) — the ONE seam that reads/writes
// the walled surfaces (labor WAGES child + PRICING CONFIG child), migration-window-resilient.
export {
  readLaborResources,
  writeLaborResource,
  readPricingConfig,
  writePricingConfig,
  mergePricingConfig,
} from './financialDataAccess';
export type { LaborResourceRow } from './financialDataAccess';
