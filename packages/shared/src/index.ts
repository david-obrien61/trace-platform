// Supabase
export { supabase } from './supabase/client';
export * from './supabase/auth';
export * from './supabase/types';

// Auth factory
export * from './auth';

// QuickBooks
export * from './quickbooks/oauth';
export * from './quickbooks/customer';
export * from './quickbooks/invoice';

// AI Engine
export { default as AIEngine } from './ai/AIEngine';
export type { AIPayload, AIOptions, AIResult } from './ai/AIEngine';

// Notifications
export * from './notifications/index';

// QR
export * from './qr/generate';
export * from './qr/print';

// Field-debug capture (console interceptor → persisted ring buffer → share/export)
export * from './debug';

// Pricing — canonical shared engine (business-logic/MarginEngine.ts, THUNDER · Build 1 · 2026-06-10)
// Replaces dead stub at pricing/marginEngine.ts (broken Math.floor+0.99 rounding; zero callers).
export {
  calculateRetail,
  getProfitMargin,
  getMarkupPercent,
  analyzeTransaction,
  DEFAULT_MARGIN_CONFIG,
} from './business-logic/MarginEngine';
export type {
  MarginSlab,
  PricingTier,
  MarginEngineConfig,
  MarginTransaction,
  MarginAnalysis,
} from './business-logic/MarginEngine';

// Cost-to-Produce — period-pool engine (THUNDER · 2026-06-14). MarginEngine-fed.
export {
  accumulate as accumulateCost,
  analyze as analyzeCostToProduce,
  confidenceMix,
  marginConfigForTarget,
  EMPTY_COST_CONFIG,
} from './business-logic/CostToProduce';
export type {
  CostConfidence,
  CostPeriod,
  CostLine,
  LaborConfig,
  MarginTier,
  MarginPolicy,
  CostLocation,
  CostToProduceConfig,
  Accumulation,
  SensitivityRow,
  ConfidenceMix,
  CostToProduceResult,
} from './business-logic/CostToProduce';

// Utils
export { formatDollars, formatMoney, formatMoneyOrDash } from './utils/formatCurrency';
export { formatDateShort, formatDateTimeShort, todayRange, daysBetween } from './utils/dateHelpers';
export { STATUS_COLORS, PMI_STATUS_COLORS, ORDER_STATUS_COLORS } from './utils/statusColors';
export type { StatusLevel } from './utils/statusColors';
export { normalizePhone } from './utils/normalizePhone';
export { nameTokenSet, canonicalNameKey, tokenSetsEqual } from './utils/canonicalName';

// Components
export { FormField, inputStyle, inputErrorStyle } from './components/FormField';
export type { FormFieldProps } from './components/FormField';
export { ProgressBar } from './components/ProgressBar';
export type { ProgressBarProps } from './components/ProgressBar';
export { Skeleton, SkeletonCard } from './components/Skeleton';
export type { SkeletonProps } from './components/Skeleton';
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';
export { Card, CardHeader } from './components/Card';
export type { CardProps, CardHeaderProps } from './components/Card';
export { Badge } from './components/Badge';
export type { BadgeProps, BadgeVariant } from './components/Badge';
export { LockedOverlay } from './components/LockedOverlay';
export type { LockedOverlayProps } from './components/LockedOverlay';
export { TileGrid } from './components/tiles/TileGrid';
export type { TileGridProps } from './components/tiles/TileGrid';
export { Tile } from './components/tiles/Tile';
export type { TileProps, TileState } from './components/tiles/Tile';
