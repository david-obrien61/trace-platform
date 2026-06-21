export type { BusinessDiscoveryProfile, BusinessIdentity, SilentPartnerAnalysis, SuggestedOffering, DiscoveryResult, VerticalSchema } from './types';
export { fetchWebsiteContent } from './adapters/website';
export { runIdentity, runAnalysis, runEngine } from './engine';
export { runSynthesis } from './synthesis';
export { compareEnteredVsSite, filterDiscrepancies, buildDiscrepancyMessage, looksSame, buildComparePrompt } from './compare';
export type { EnteredBusinessData, Discrepancy, CompareResult, DiscrepancyConfidence, CompareOpts } from './compare';
export { nurserySchema } from './verticals/nursery';
export { seedServiceOfferings } from './seed';
export {
  fetchCatalogPages, discoverCatalogLinks, categoryHintFromUrl,
  extractCatalog, mapRawToCatalogItem, buildCatalogPrompt,
} from './catalog';
export type { CatalogPage, CatalogItem, CatalogExtract, CatalogConfidence, CrawlOpts, ExtractOpts } from './catalog';
export {
  populateCatalog, clearSandbox, clearDiscovery, catalogItemToInventoryRow,
} from './populate';
export type { PopulateOpts, PopulateResult } from './populate';
// DiscoveryGlimpse is client-side only — import directly from
// '@trace/shared/discovery/DiscoveryGlimpse' to avoid bundling server-side engine deps.
