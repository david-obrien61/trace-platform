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
