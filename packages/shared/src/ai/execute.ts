import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CAPABILITIES } from './capabilities';
import { parseTwoPass } from './parseJson';

export interface ExecuteOpts {
  businessId?: string;
  system: string;
  user: string;
  apiKey: string;
  supabase?: SupabaseClient;
}

/**
 * executeCapability — shared server-side executor for all TRACE AI calls.
 *
 * 1. Looks up cfg from CAPABILITIES[capabilityKey]. Throws if unknown.
 * 2. Resolves model: checks business_modules.config for a per-business override,
 *    falls through cleanly to cfg.model on any miss.
 * 3. Emits [TRACE:ai] request/response/error logs when AI_DEBUG=true.
 * 4. Calls Anthropic messages.create; applies ephemeral cache_control on the
 *    system block only when cfg.cache === 'ephemeral'.
 * 5. Parses JSON responses via parseTwoPass; returns raw text for responseFormat:'text'.
 * 6. Rethrows on error — preserves caller error handling.
 */
export async function executeCapability(
  capabilityKey: string,
  opts: ExecuteOpts,
): Promise<any> {
  const cfg = CAPABILITIES[capabilityKey];
  if (!cfg) throw new Error(`executeCapability: unknown capability "${capabilityKey}"`);

  // ── Model override lookup ──────────────────────────────────────────────────
  let overrideModel: string | null = null;
  if (opts.businessId && opts.supabase) {
    try {
      const { data } = await opts.supabase
        .from('business_modules')
        .select('config')
        .eq('business_id', opts.businessId)
        .eq('module_key', capabilityKey)
        .maybeSingle();
      const m = (data as any)?.config?.model;
      if (typeof m === 'string' && m.length > 0) overrideModel = m;
    } catch {
      // override is optional — fall through to default
    }
  }

  const model = overrideModel ?? cfg.model;
  const doLog = cfg.trace && process.env.AI_DEBUG === 'true';
  const t0    = Date.now();

  if (doLog) {
    console.log(JSON.stringify({
      tag: '[TRACE:ai]', phase: 'request',
      capability: capabilityKey, model,
      source: overrideModel ? 'override' : 'default',
      businessId: opts.businessId ?? '-',
      inputChars: opts.user.length,
      ts: new Date().toISOString(),
    }));
  }

  // ── Build system param — cached or plain string ────────────────────────────
  const systemParam: any = cfg.cache === 'ephemeral'
    ? [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
    : opts.system;

  const anthropic = new Anthropic({ apiKey: opts.apiKey });

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: cfg.maxTokens,
      system: systemParam,
      messages: [{ role: 'user', content: opts.user }],
    });

    const latency_ms = Date.now() - t0;
    const inTok      = response.usage?.input_tokens  ?? 0;
    const outTok     = response.usage?.output_tokens ?? 0;
    const raw        = (response.content[0] as any).text?.trim() ?? '';

    if (doLog) {
      console.log(JSON.stringify({
        tag: '[TRACE:ai]', phase: 'response',
        capability: capabilityKey, model, ok: true,
        inTok, outTok, latency_ms,
      }));
    }

    if (cfg.responseFormat === 'json') {
      // Auto-detect array vs object from the raw text
      const shape = raw.trimStart().startsWith('[') ? 'array' as const : 'object' as const;
      return parseTwoPass(raw, shape);
    }
    return raw;

  } catch (err: any) {
    if (doLog) {
      console.log(JSON.stringify({
        tag: '[TRACE:ai]', phase: 'error',
        capability: capabilityKey, model, ok: false,
        error: err?.message ?? String(err),
        latency_ms: Date.now() - t0,
      }));
    }
    throw err;
  }
}
