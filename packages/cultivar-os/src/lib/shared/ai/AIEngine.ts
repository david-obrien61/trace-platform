/**
 * AIEngine.ts — Unified AI Router for all TRACE platform verticals.
 * Ported from CAI/AIEngine.js.
 *
 * All AI calls go through here. Callers never know which provider runs.
 * Keys live on the FastAPI backend — this file routes via your local API.
 *
 * Usage:
 *   import AIEngine from '@trace/shared/ai/AIEngine';
 *   const result = await AIEngine.call('dtc_decode', { codes: ['P0171'] });
 *
 * To add vertical-specific tasks:
 *   Add a row to TASK_ROUTING and a handler in ai_router.py.
 *   Do not modify existing task entries.
 */

const API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:8000';

// ── Task → Provider + Model routing table ─────────────────────────────────────

type Provider = 'gemini' | 'claude' | 'openai';
type TaskType  = 'vision' | 'text' | 'audio';

interface RouteConfig {
  provider: Provider;
  model:    string;
  type:     TaskType;
}

const TASK_ROUTING: Record<string, RouteConfig> = {
  // Gemini Flash — vision / multimodal
  vin_decode:          { provider: 'gemini', model: 'gemini-2.0-flash',          type: 'vision' },
  invoice_scan:        { provider: 'gemini', model: 'gemini-2.0-flash',          type: 'vision' },
  label_read:          { provider: 'gemini', model: 'gemini-2.0-flash',          type: 'vision' },
  part_photo_id:       { provider: 'gemini', model: 'gemini-2.0-flash',          type: 'vision' },

  // Two-stage: Gemini OCR → Claude audit (handled entirely in backend)
  invoice_audit:       { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text'   },

  // Claude Haiku — fast structured reasoning
  dtc_decode:          { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text'   },
  estimate_draft:      { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text'   },
  compliance_check:    { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text'   },
  customer_summary:    { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text'   },
  pmi_suggest:         { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text'   },

  // Claude Sonnet — complex / long-context reasoning
  predictive_analysis: { provider: 'claude', model: 'claude-sonnet-4-6',         type: 'text'   },
  savings_report:      { provider: 'claude', model: 'claude-sonnet-4-6',         type: 'text'   },

  // OpenAI — voice and NLP
  voice_transcribe:    { provider: 'openai', model: 'whisper-1',                 type: 'audio'  },
  parts_nlp:           { provider: 'openai', model: 'gpt-4o-mini',               type: 'text'   },
  intent_classify:     { provider: 'openai', model: 'gpt-4o-mini',               type: 'text'   },
};

// ── Tier access gates ─────────────────────────────────────────────────────────

const TIER_TASKS: Record<string, string[]> = {
  TRIAL:        Object.keys(TASK_ROUTING),
  STARTER:      [],
  PROFESSIONAL: [
    'vin_decode', 'invoice_scan', 'invoice_audit', 'label_read', 'part_photo_id',
    'dtc_decode', 'estimate_draft', 'customer_summary', 'pmi_suggest',
    'voice_transcribe', 'parts_nlp', 'intent_classify',
  ],
  PREMIER: Object.keys(TASK_ROUTING),
};

// ── Payload shape ─────────────────────────────────────────────────────────────

export interface AIPayload {
  prompt?:        string;
  image_base64?:  string;
  audio_base64?:  string;
  shop_id?:       string;
  codes?:         string[];
  vehicle?:       Record<string, any>;
  transcript?:    string;
  tool?:          Record<string, any>;
  job?:           Record<string, any>;
  inventory?:     any[];
  media_type?:    string;
  [key: string]:  any;
}

export interface AIOptions {
  tier?:           string;
  fallback?:       boolean;
  _override_model?: string;
}

export interface AIResult {
  ok:       boolean;
  locked?:  boolean;
  error?:   string;
  task?:    string;
  tier?:    string;
  message?: string;
  [key: string]: any;
}

// ── Main interface ────────────────────────────────────────────────────────────

const AIEngine = {
  /**
   * call(task, payload, options)
   *
   * task     — key from TASK_ROUTING above
   * payload  — { prompt, image_base64, audio_base64, shop_id, ... }
   * options  — { tier: 'PROFESSIONAL', fallback: true }
   */
  async call(task: string, payload: AIPayload = {}, options: AIOptions = {}): Promise<AIResult> {
    const tier    = options.tier ?? 'TRIAL';
    const allowed = TIER_TASKS[tier] ?? [];

    if (tier !== 'TRIAL' && !allowed.includes(task)) {
      return { ok: false, locked: true, task, tier,
               message: `${task} requires a higher tier. Current: ${tier}` };
    }

    const route = TASK_ROUTING[task];
    if (!route) {
      return { ok: false, error: `Unknown task: ${task}` };
    }

    const effectiveRoute = options._override_model
      ? { ...route, model: options._override_model }
      : route;

    try {
      const res = await fetch(`${API_URL}/ai/${task}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...payload, _route: effectiveRoute }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail ?? `HTTP ${res.status}`);
      }

      return { ok: true, ...(await res.json()) };

    } catch (e: any) {
      console.error(`[AIEngine] ${task} failed:`, e.message);

      if (options.fallback && route.model !== 'claude-haiku-4-5-20251001') {
        console.warn(`[AIEngine] Retrying ${task} with Haiku fallback`);
        return AIEngine.call(task, payload, { ...options, fallback: false,
          _override_model: 'claude-haiku-4-5-20251001' });
      }

      return { ok: false, error: e.message, task };
    }
  },

  // ── Convenience wrappers ────────────────────────────────────────────────────

  async decodeVIN(imageBase64: string, shopId: string, tier: string) {
    return AIEngine.call('vin_decode', { image_base64: imageBase64, shop_id: shopId }, { tier });
  },

  async decodeDTC(codes: string[], vehicleContext: Record<string, any>, shopId: string, tier: string) {
    return AIEngine.call('dtc_decode', { codes, vehicle: vehicleContext, shop_id: shopId }, { tier });
  },

  async transcribeVoice(audioBase64: string, shopId: string, tier: string) {
    return AIEngine.call('voice_transcribe', { audio_base64: audioBase64, shop_id: shopId }, { tier });
  },

  async extractParts(transcript: string, shopId: string, tier: string) {
    return AIEngine.call('parts_nlp', { transcript, shop_id: shopId }, { tier });
  },

  async readToolLabel(imageBase64: string, shopId: string, tier: string) {
    return AIEngine.call('label_read', { image_base64: imageBase64, shop_id: shopId }, { tier });
  },

  async suggestPMI(toolData: Record<string, any>, shopId: string, tier: string) {
    return AIEngine.call('pmi_suggest', { tool: toolData, shop_id: shopId }, { tier });
  },

  async auditInvoice(imageBase64: string, shopId: string, tier: string, mediaType = 'image/jpeg') {
    return AIEngine.call('invoice_audit',
      { image_base64: imageBase64, shop_id: shopId, media_type: mediaType }, { tier });
  },

  async draftEstimate(jobData: Record<string, any>, shopId: string, tier: string) {
    return AIEngine.call('estimate_draft', { job: jobData, shop_id: shopId }, { tier });
  },

  async savingsReport(shopId: string, tier: string) {
    return AIEngine.call('savings_report', { shop_id: shopId }, { tier });
  },

  // ── Tier check helper ───────────────────────────────────────────────────────
  canUse(task: string, tier: string): boolean {
    const allowed = TIER_TASKS[tier] ?? [];
    return allowed.includes(task);
  },
};

export default AIEngine;
