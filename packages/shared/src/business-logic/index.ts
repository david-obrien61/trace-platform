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

// Customer find-or-create — the ONE shared customer write (cart + OCR-invoice both call it).
// Extracted from api/orders/submit.ts so a customer can be created without an order (Wave 2).
export { findOrCreateCustomer } from './customerUpsert';
export type { CustomerInput, CustomerUpsertResult } from './customerUpsert';
