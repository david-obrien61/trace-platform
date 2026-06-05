export type { BusinessDiscoveryProfile, BusinessIdentity, SilentPartnerAnalysis, SuggestedOffering, DiscoveryResult, VerticalSchema } from './types';
export { fetchWebsiteContent } from './adapters/website';
export { runIdentity, runAnalysis, runEngine } from './engine';
export { runSynthesis } from './synthesis';
export { nurserySchema } from './verticals/nursery';
// DiscoveryGlimpse is client-side only — import directly from
// '@trace/shared/discovery/DiscoveryGlimpse' to avoid bundling server-side engine deps.
