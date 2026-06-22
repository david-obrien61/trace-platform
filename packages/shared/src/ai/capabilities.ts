export interface CapabilityConfig {
  provider: 'claude';
  model: string;
  maxTokens: number;
  cache: 'none' | 'ephemeral';
  batch: boolean;
  trace: boolean;
  responseFormat: 'json' | 'text';
}

export const CAPABILITIES: Record<string, CapabilityConfig> = {
  discovery_identity:  { provider: 'claude', model: 'claude-haiku-4-5-20251001', maxTokens: 1000, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  discovery_analysis:  { provider: 'claude', model: 'claude-sonnet-4-6',         maxTokens: 2000, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  discovery_synthesis: { provider: 'claude', model: 'claude-sonnet-4-6',       maxTokens: 2000, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  discovery_compare:   { provider: 'claude', model: 'claude-sonnet-4-6',       maxTokens: 1500, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  discovery_catalog:   { provider: 'claude', model: 'claude-haiku-4-5-20251001', maxTokens: 3000, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  // Cost-discovery REASONS about a grower's cost-to-produce under uncertainty → Opus.
  // Per-business override still honored via business_modules.config (execute.ts).
  // Opus 4.8 id verified against the environment model card, not memory (claude-opus-4-8).
  discovery_cost:      { provider: 'claude', model: 'claude-opus-4-8',           maxTokens: 1500, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  campaign_generate:   { provider: 'claude', model: 'claude-sonnet-4-6',       maxTokens: 3000, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  social_generate:     { provider: 'claude', model: 'claude-sonnet-4-6',       maxTokens: 800,  cache: 'none', batch: false, trace: true, responseFormat: 'json' },
};
