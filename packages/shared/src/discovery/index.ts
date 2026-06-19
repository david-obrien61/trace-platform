export type { BusinessDiscoveryProfile, BusinessIdentity, SilentPartnerAnalysis, SuggestedOffering, DiscoveryResult, VerticalSchema } from './types';
export { fetchWebsiteContent } from './adapters/website';
export { runIdentity, runAnalysis, runEngine } from './engine';
export { runSynthesis } from './synthesis';
export { compareEnteredVsSite, filterDiscrepancies, buildDiscrepancyMessage, looksSame, buildComparePrompt } from './compare';
export type { EnteredBusinessData, Discrepancy, CompareResult, DiscrepancyConfidence, CompareOpts } from './compare';
export { nurserySchema } from './verticals/nursery';
export { seedServiceOfferings } from './seed';
// DiscoveryGlimpse is client-side only — import directly from
// '@trace/shared/discovery/DiscoveryGlimpse' to avoid bundling server-side engine deps.
