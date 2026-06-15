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
  enforceCountOnce,
  fromCostObject,
  fromRecurringLine,
} from './CountOnceSeam';

export type {
  AmountConfidence,
  Substantiation,
  Realization,
  CostBucket,
  CostEvent,
  SameCostVerdict,
  CountedEvent,
  ResidueLine,
  DedupRecord,
  SeamResult,
  CostObjectNodeRow,
  RecurringLineRow,
} from './CountOnceSeam';
