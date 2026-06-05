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
  campaign_generate:   { provider: 'claude', model: 'claude-sonnet-4-6',       maxTokens: 3000, cache: 'none', batch: false, trace: true, responseFormat: 'json' },
  social_generate:     { provider: 'claude', model: 'claude-sonnet-4-6',       maxTokens: 800,  cache: 'none', batch: false, trace: true, responseFormat: 'json' },
};
