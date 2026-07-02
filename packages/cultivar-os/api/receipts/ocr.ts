// STD-010 ACTIVE — File Upload / Ingest Safety. All rules applied here.
// This function is the ONLY server-side path for receipt OCR.
// Client-side never sees provider API keys or raw binary data.
//
// PROVIDER CHAIN: Gemini 2.5 Flash (primary) → Claude Haiku 4.5 (fallback) → clean user error.
// Each provider has its own try/catch and timeout. One failure never kills the chain.
//
// MODEL CONFIG — BENCH-E rule: model names are VALUES, not source constants.
// Resolution order (getOcrModels):
//   1. platform_config table (key: ocr_primary_model / ocr_fallback_model) — edit one DB row to swap
//   2. env vars OCR_PRIMARY_MODEL / OCR_FALLBACK_MODEL
//   3. hardcoded defaults below (last resort — should never be reached in production)
// A model swap is a config change, never a code edit.
//
// KIND-2 BENCHED (explicitly NOT in this build):
//   - Usage limiting / billing → benched, awaiting payments/first paying customer
//   - Quality-analysis dashboard → benched; accept_vs_edit signal captured now
//   - QB write-back for receipts → benched; v1 is local-only

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const TRACE_RECEIPT = true; // [TRACE:RECEIPT] STD-003 — comment out when David says "proven"

// STD-010: allowed MIME types — never execute content
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

// STD-010: size limit — 10 MB
const MAX_BYTES = 10 * 1024 * 1024;

// Hardcoded defaults — last resort only. In production these should be
// overridden by platform_config rows or OCR_*_MODEL env vars.
const DEFAULT_PRIMARY_MODEL = 'gemini-2.5-flash';
const DEFAULT_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

// Claude vision supports jpeg/png/gif/webp only — no heic/heif/pdf
const CLAUDE_VISION_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

// NOTE: unit_price artifact — Gemini may return trailing-decimal noise on unit_price
// (e.g., 1.611 instead of 1.61). Totals are always exact. Benched until a unit_price
// display column is added to the line-item grid UI — round to 2 decimal places on display.

// Strict OCR prompt — validated in bake-off against McCoy's receipt (2026-06-11).
// "Extract ONLY what's printed" eliminates hallucination on missing fields.
const PROMPT = `You are a receipt parser. Extract ONLY what is literally printed on this receipt — do not infer, estimate, or fill in values that are not visible.

Return a JSON object with these exact fields (use null for any field you cannot read directly from the receipt):
{
  "vendor": "string — store or business name as printed",
  "date": "string — date in YYYY-MM-DD format, or as printed if format is unclear",
  "amount": number — total amount paid (numeric only, no currency symbol),
  "subtotal": number or null — subtotal before tax if printed,
  "tax": number or null — tax amount if printed,
  "category": "string — best fit from: fuel, supplies, meals, parts, equipment, maintenance, office, other",
  "line_items": array or null — each item as: {"description": "as printed", "quantity": number or null, "unit_price": number or null, "amount": number} — null if no itemized list is visible,
  "payment_method": "string or null — cash, credit, debit, check, as indicated on the receipt",
  "receipt_number": "string or null — receipt, invoice, or transaction number if printed"
}

Rules:
- Extract ONLY values that appear on the receipt. Do not infer or estimate missing values.
- For line_items: include quantity and unit_price only if they are printed on the receipt; otherwise set to null.
- For amounts: numeric values only — no currency symbols, no commas.
- Return ONLY the JSON object. No explanation, no markdown fences, no commentary.`;

// INVOICE shape (Wave 2) — superset of the receipt shape. Reuses the SAME "extract only
// what's printed" discipline (no hallucination on missing fields — D-9) and keeps the
// proven vendor/date/line_items/subtotal/tax/total fields so the receipt-save path is
// unchanged, then ADDS the customer / addresses / phone / due-date / delivery-date that
// the live LAWNS-invoice test showed dropped. Selected via the `shape` request param.
const INVOICE_PROMPT = `You are an invoice parser. Extract ONLY what is literally printed on this invoice — do not infer, estimate, or fill in values that are not visible.

Return a JSON object with these exact fields (use null for any field you cannot read directly from the invoice — never guess, never use 0 for a missing value):
{
  "vendor": "string — the business that ISSUED the invoice (the seller), as printed",
  "date": "string — invoice date in YYYY-MM-DD, or as printed if unclear",
  "due_date": "string or null — payment due date in YYYY-MM-DD if printed",
  "delivery_date": "string or null — delivery / ship / service date in YYYY-MM-DD if printed",
  "customer_name": "string or null — the bill-to / sold-to customer name (person or company)",
  "customer_kind": "string — classify customer_name as 'person' or 'organization'. A named individual (Robert Nguyen, Diane Foster) is 'person'. A company, HOA, LLC, residence-by-name, contractor, nursery, or any business/entity (Cedar Park HOA, Hillside Landscapes, The Bradt Residence) is 'organization'. Default 'person' when customer_name is null or ambiguous.",
  "customer_phone": "string or null — the customer's phone if printed",
  "customer_email": "string or null — the customer's email if printed",
  "bill_to": {"line1": "string or null", "city": "string or null", "state": "string or null", "zip": "string or null"} or null,
  "ship_to": {"line1": "string or null", "city": "string or null", "state": "string or null", "zip": "string or null"} or null,
  "line_items": array or null — each item as: {"description": "as printed", "sku": "string or null", "quantity": number or null, "unit_price": number or null, "amount": number} — null if no itemized list is visible,
  "subtotal": number or null — subtotal before tax if printed,
  "tax": number or null — tax amount if printed,
  "amount": number — invoice total (numeric only, no currency symbol),
  "category": "string — best fit from: fuel, supplies, meals, parts, equipment, maintenance, office, other",
  "payment_method": "string or null — cash, credit, debit, check, as indicated",
  "receipt_number": "string or null — invoice / order number if printed"
}

Rules:
- Extract ONLY values that appear on the invoice. Do not infer or estimate missing values.
- Distinguish the VENDOR (seller, usually top/letterhead) from the CUSTOMER (bill-to / sold-to / ship-to).
- Always return customer_kind ('person' or 'organization') classifying customer_name — this is a classification, not a copied value, so it is exempt from the "only what is printed" rule.
- bill_to is the customer's billing address; ship_to is the delivery address — keep them separate even if identical.
- For line_items: include sku, quantity, unit_price only if printed; otherwise set to null.
- For amounts: numeric values only — no currency symbols, no commas.
- Return ONLY the JSON object. No explanation, no markdown fences, no commentary.`;

// ASSET shape — identify a physical asset from a PHOTO (not a document) and
// estimate its worth. Unlike receipt/invoice, VALUE here is deliberately an
// ESTIMATE (there is no printed number on a tractor) — that is exactly why the
// caller lands it at cost_confidence=ESTIMATED and lets the owner confirm.
// `categoryHint` is the ONLY vertical-specific input: the caller passes its own
// vocabulary (nursery vs auto categories) so the function itself stays
// vertical-agnostic (AC-1 — no vertical noun baked into the shared seam).
function assetPrompt(categoryHint?: string): string {
  const vocab = (categoryHint && categoryHint.trim())
    ? categoryHint.trim()
    : 'equipment, vehicle-fuel, supplies, materials, repairs, other';
  return `You are an asset appraiser looking at a PHOTO of a single physical business asset (a tool, machine, vehicle, piece of equipment, or similar).

Return a JSON object with these exact fields (use null for any field you cannot determine from the photo):
{
  "name": "string — a short specific name for the asset (e.g. 'tractor', 'cordless drill', 'leaf blower'), a plain description if the type is unclear",
  "make": "string or null — the BRAND / manufacturer if legible on a plate or badge (e.g. 'Mahindra', 'Stihl', 'Craftsman'). Null if not legible — do NOT guess.",
  "model": "string or null — the MODEL number/name if legible, SEPARATE from make (e.g. '4025', 'BG 56 C', 'CMXECXM331'). Null if not legible — do NOT guess.",
  "category": "string — best fit from: ${vocab}",
  "estimated_value": number or null — your best estimate of the asset's current used market value in US dollars (numeric only, no currency symbol). Null ONLY if you truly cannot tell what the asset is,
  "confidence": "string — HIGH, MEDIUM, or LOW: how confident you are in the value estimate given photo clarity and how identifiable the asset is"
}

Rules:
- Identify the asset from what is VISIBLE. Read any legible brand/model plates.
- make and model are SEPARATE fields: make = the brand (Mahindra, Stihl, Craftsman); model = the model designation (4025, BG 56 C, CMXECXM331). Put the brand in make, the model code in model — never both in one field.
- estimated_value is an ESTIMATE of resale/used worth — this is expected and wanted; do NOT return null just because no price is printed. Return null ONLY when the object is unidentifiable.
- Do not invent a brand or model that is not legible — return null for that field and describe the asset plainly in name instead.
- Numeric value only — no currency symbols, no commas, no ranges (give a single best estimate).
- Return ONLY the JSON object. No explanation, no markdown fences, no commentary.`;
}

type OcrShape = 'receipt' | 'invoice' | 'asset';
function promptForShape(shape: OcrShape, categoryHint?: string): string {
  if (shape === 'asset') return assetPrompt(categoryHint);
  return shape === 'invoice' ? INVOICE_PROMPT : PROMPT;
}

interface ProviderResult {
  provider: 'gemini' | 'claude';
  rawText: string;
  ocr_raw: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimate: number | null;
  latencyMs: number;
}

// Config resolution: platform_config table → env var → hardcoded default
// Called once per request (~20-50ms DB lookup — immaterial vs 2-8s OCR latency)
async function getOcrModels(): Promise<{ primaryModel: string; fallbackModel: string }> {
  // Layer 1: platform_config table (service key bypasses RLS — infrastructure config, not tenant data)
  try {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && serviceKey) {
      const db = createClient(supabaseUrl, serviceKey);
      const { data } = await db
        .from('platform_config')
        .select('key, value')
        .in('key', ['ocr_primary_model', 'ocr_fallback_model']);
      if (data && data.length > 0) {
        const map = Object.fromEntries(data.map((r: any) => [r.key as string, r.value as string]));
        return {
          primaryModel: map['ocr_primary_model'] ?? process.env.OCR_PRIMARY_MODEL ?? DEFAULT_PRIMARY_MODEL,
          fallbackModel: map['ocr_fallback_model'] ?? process.env.OCR_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL,
        };
      }
    }
  } catch {
    // platform_config migration not yet applied or Supabase unavailable — fall through to env/defaults
  }

  // Layer 2: env vars (Vercel dashboard, no code edit needed)
  return {
    primaryModel: process.env.OCR_PRIMARY_MODEL ?? DEFAULT_PRIMARY_MODEL,
    fallbackModel: process.env.OCR_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL,
  };
}

// Shared JSON extraction — both providers return freetext that may have markdown fences
function parseOcrText(rawText: string): { parsed: Record<string, any> | null; parseError: string | null } {
  let parsed: Record<string, any> | null = null;
  let parseError: string | null = null;
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* genuinely unparseable */ }
    }
    if (!parsed) parseError = 'OCR returned unparseable text — manual entry required';
  }
  return { parsed, parseError };
}

// Provider 1: Gemini (primary) — cheapest, fastest, supports HEIC/PDF
// model param comes from getOcrModels() — never hardcoded here
async function tryGemini(imageBase64: string, mimeType: string, geminiKey: string, model: string, prompt: string): Promise<ProviderResult> {
  const startMs = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  let fetchRes: Response;
  try {
    fetchRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
          // thinkingBudget: 0 disables gemini-2.5-flash's extended reasoning layer.
          // Thinking adds 10-20s latency for large images (McCoy's 2.2MB) with no accuracy
          // benefit for fixed-schema receipt extraction. Without this, thinking reliably
          // exceeds the 9s AbortController on full-res receipts.
          generationConfig: { temperature: 0, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    if (fetchErr.name === 'AbortError') throw new Error(`Gemini (${model}) timed out after 9s`);
    throw fetchErr;
  }
  clearTimeout(timeoutId);
  if (!fetchRes.ok) {
    const body = await fetchRes.text().catch(() => '');
    throw new Error(`Gemini ${fetchRes.status} (model: ${model}): ${body.slice(0, 200)}`);
  }
  const data = await fetchRes.json();
  const usage = data.usageMetadata ?? {};
  const inp = usage.promptTokenCount ?? null;
  const out = usage.candidatesTokenCount ?? null;
  // Gemini 2.5 Flash pricing estimate (June 2026): ~$0.075/1M input, $0.30/1M output
  const cost = inp && out ? (inp / 1e6) * 0.075 + (out / 1e6) * 0.30 : null;
  return {
    provider: 'gemini',
    rawText: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    ocr_raw: data,
    inputTokens: inp,
    outputTokens: out,
    costEstimate: cost,
    latencyMs: Date.now() - startMs,
  };
}

// Provider 2: Claude (fallback) — supports jpeg/png/gif/webp only; throws for unsupported types
// model param comes from getOcrModels() — never hardcoded here
async function tryClaude(imageBase64: string, mimeType: string, claudeKey: string, model: string, prompt: string): Promise<ProviderResult> {
  if (!CLAUDE_VISION_TYPES.has(mimeType)) {
    throw new Error(`Claude vision does not support ${mimeType} — skipping`);
  }
  // Normalize image/jpg → image/jpeg for Claude's strict media_type union
  const mediaMime = (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType) as
    'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const startMs = Date.now();
  const client = new Anthropic({ apiKey: claudeKey, timeout: 9000 }); // 9s — inside Vercel's 10s kill
  const msg = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image', source: { type: 'base64', media_type: mediaMime, data: imageBase64 } },
      ],
    }],
  });
  const textBlock = msg.content.find((b: any) => b.type === 'text') as any;
  const rawText = textBlock?.text ?? '';
  const inp = msg.usage?.input_tokens ?? null;
  const out = msg.usage?.output_tokens ?? null;
  // Claude Haiku 4.5 pricing estimate (June 2026): ~$0.80/1M input, $4.00/1M output
  const cost = inp && out ? (inp / 1e6) * 0.80 + (out / 1e6) * 4.00 : null;
  return {
    provider: 'claude',
    rawText,
    ocr_raw: { model: msg.model, usage: msg.usage, stop_reason: msg.stop_reason },
    inputTokens: inp,
    outputTokens: out,
    costEstimate: cost,
    latencyMs: Date.now() - startMs,
  };
}

// Slot for provider 3 — add entry to the providers array below, no other changes needed.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY ?? '';
  const claudeKey = process.env.ANTHROPIC_API_KEY ?? '';

  // Fail fast if no OCR provider is configured at all
  if (!geminiKey && !claudeKey) {
    console.error('[TRACE:RECEIPT] No OCR provider configured — GEMINI_API_KEY and ANTHROPIC_API_KEY both missing');
    return res.status(503).json({ ok: false, error: 'OCR unavailable — contact support' });
  }

  const { businessId, userId, imageBase64, mimeType, fileSizeBytes, categoryHint } = req.body ?? {};
  // shape selects the extraction prompt — 'receipt' (default, backward-compatible for all
  // existing callers), 'invoice' (Wave 2 superset), or 'asset' (photo → {name, category,
  // estimated_value, confidence}). Same provider chain either way. categoryHint is the
  // caller's own category vocabulary, injected only for the asset shape (AC-1 vertical-agnostic).
  const shape: OcrShape =
    req.body?.shape === 'invoice' ? 'invoice' :
    req.body?.shape === 'asset'   ? 'asset'   : 'receipt';
  const activePrompt = promptForShape(shape, typeof categoryHint === 'string' ? categoryHint : undefined);

  if (!businessId || !userId || !imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'businessId, userId, imageBase64, and mimeType are required' });
  }

  // STD-010: content-type validation
  if (!ALLOWED_TYPES.has(mimeType)) {
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] rejected mimeType:', mimeType);
    return res.status(415).json({ error: `File type not accepted: ${mimeType}. Allowed: JPEG, PNG, WEBP, HEIC, PDF.` });
  }

  // STD-010: size limit
  const sizeBytes = fileSizeBytes ?? Buffer.byteLength(imageBase64, 'base64');
  if (sizeBytes > MAX_BYTES) {
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] rejected size:', sizeBytes, 'max:', MAX_BYTES);
    return res.status(413).json({ error: `File too large (${Math.round(sizeBytes / 1024)}KB). Max: 10MB.` });
  }

  if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] OCR request — businessId:', businessId, 'mimeType:', mimeType, 'sizeBytes:', sizeBytes, 'shape:', shape);

  // Resolve model names from config (DB → env var → hardcoded default)
  const { primaryModel, fallbackModel } = await getOcrModels();
  if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] models resolved — primary:', primaryModel, 'fallback:', fallbackModel);

  // Provider chain — each entry: { name, canHandle, fn }
  // canHandle prevents unnecessary attempts (missing key, unsupported type)
  const providers: Array<{ name: 'gemini' | 'claude'; canHandle: boolean; fn: () => Promise<ProviderResult> }> = [
    { name: 'gemini', canHandle: !!geminiKey, fn: () => tryGemini(imageBase64, mimeType, geminiKey, primaryModel, activePrompt) },
    { name: 'claude', canHandle: !!claudeKey && CLAUDE_VISION_TYPES.has(mimeType), fn: () => tryClaude(imageBase64, mimeType, claudeKey, fallbackModel, activePrompt) },
    // provider 3 slot: { name: 'azure', canHandle: !!azureKey, fn: () => tryAzure(imageBase64, mimeType, azureKey, azureModel) },
  ];

  let result: ProviderResult | null = null;
  let lastErr = '';
  let lastFailedProvider = '';

  for (const p of providers) {
    if (!p.canHandle) continue;
    try {
      result = await p.fn();
      if (lastFailedProvider) {
        // Fallback activated — log greppably for operator monitoring (BENCH-E)
        console.log(`[TRACE:RECEIPT] provider-fallback fired: ${lastFailedProvider}→${p.name}, reason: ${lastErr.slice(0, 120)}`);
      }
      break;
    } catch (err: any) {
      if (TRACE_RECEIPT) console.log(`[TRACE:RECEIPT] provider ${p.name} failed:`, err.message?.slice(0, 150));
      lastErr = err.message ?? 'unknown';
      lastFailedProvider = p.name;
      // Continue to next provider
    }
  }

  if (!result) {
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] all providers failed — lastErr:', lastErr);
    // Surface Honesty: user sees actionable message, not technical detail
    return res.status(503).json({ ok: false, error: "Couldn't read this receipt — try a clearer photo or better lighting" });
  }

  const { parsed, parseError } = parseOcrText(result.rawText);

  if (TRACE_RECEIPT) console.log(
    `[TRACE:RECEIPT] ${result.provider} response — model: ${primaryModel}, inputTokens:`, result.inputTokens,
    'outputTokens:', result.outputTokens,
    'estimatedCost:', result.costEstimate,
    'latencyMs:', result.latencyMs,
  );
  if (TRACE_RECEIPT) console.log(
    '[TRACE:RECEIPT] parsed result — vendor:', parsed?.vendor,
    'amount:', parsed?.amount,
    'date:', parsed?.date,
    'line_items:', parsed?.line_items?.length ?? 0,
    'parseError:', parseError,
  );

  return res.json({
    ok: true,
    provider: result.provider,          // which provider succeeded
    ocr_raw: result.ocr_raw,            // full provider response → ocr_raw column
    parsed,                              // structured extract → confirm-step pre-fill
    parseError,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    ocr_cost_estimate: result.costEstimate,
    latencyMs: result.latencyMs,
  });
}
