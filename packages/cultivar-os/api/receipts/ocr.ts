// STD-010 ACTIVE — File Upload / Ingest Safety. All rules applied here.
// This function is the ONLY server-side path for receipt OCR.
// Client-side never sees provider API keys or raw binary data.
//
// PROVIDER CHAIN: Gemini 2.0 Flash (primary) → Claude Haiku 4.5 (fallback) → clean user error.
// Each provider has its own try/catch and timeout. One failure never kills the chain.
//
// KIND-2 BENCHED (explicitly NOT in this build):
//   - Usage limiting / billing → benched, awaiting payments/first paying customer
//   - Quality-analysis dashboard → benched; accept_vs_edit signal captured now
//   - QB write-back for receipts → benched; v1 is local-only

import Anthropic from '@anthropic-ai/sdk';

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

// Provider model IDs
const GEMINI_MODEL = 'gemini-2.0-flash';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// Claude vision supports jpeg/png/gif/webp only — no heic/heif/pdf
const CLAUDE_VISION_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

// Shared OCR prompt — identical for both providers
const PROMPT = `You are a receipt parser. Extract structured data from this receipt image.

Return a JSON object with these fields (use null for any field you cannot read clearly):
{
  "vendor": "string — business/store name",
  "date": "string — date in YYYY-MM-DD format if possible, otherwise as-read",
  "amount": number — total amount paid (numeric, no currency symbol),
  "subtotal": number or null,
  "tax": number or null,
  "category": "string — one of: fuel, supplies, meals, parts, equipment, maintenance, office, other",
  "line_items": [{"description": "string", "amount": number}] or null,
  "payment_method": "string or null — cash, credit, debit, check",
  "receipt_number": "string or null"
}

Be conservative: if you cannot confidently read a value, use null rather than guessing.
Return ONLY the JSON object, no explanation.`;

interface ProviderResult {
  provider: 'gemini' | 'claude';
  rawText: string;
  ocr_raw: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimate: number | null;
  latencyMs: number;
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

// Provider 1: Gemini 2.0 Flash — cheapest, fastest, supports HEIC/PDF
async function tryGemini(imageBase64: string, mimeType: string, geminiKey: string): Promise<ProviderResult> {
  const startMs = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  let fetchRes: Response;
  try {
    fetchRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    if (fetchErr.name === 'AbortError') throw new Error('Gemini timed out after 8s');
    throw fetchErr;
  }
  clearTimeout(timeoutId);
  if (!fetchRes.ok) {
    const body = await fetchRes.text().catch(() => '');
    throw new Error(`Gemini ${fetchRes.status}: ${body.slice(0, 200)}`);
  }
  const data = await fetchRes.json();
  const usage = data.usageMetadata ?? {};
  const inp = usage.promptTokenCount ?? null;
  const out = usage.candidatesTokenCount ?? null;
  // Gemini 2.0 Flash pricing estimate (June 2026): ~$0.075/1M input, $0.30/1M output
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

// Provider 2: Claude Haiku 4.5 vision — fallback when Gemini fails
// Supports: jpeg/png/gif/webp only. Throws immediately for unsupported types.
async function tryClaude(imageBase64: string, mimeType: string, claudeKey: string): Promise<ProviderResult> {
  if (!CLAUDE_VISION_TYPES.has(mimeType)) {
    throw new Error(`Claude vision does not support ${mimeType} — skipping`);
  }
  // Normalize image/jpg → image/jpeg for Claude's strict media_type union
  const mediaMime = (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType) as
    'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const startMs = Date.now();
  const client = new Anthropic({ apiKey: claudeKey, timeout: 9000 }); // 9s — inside Vercel's 10s kill
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
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

  const { businessId, userId, imageBase64, mimeType, fileSizeBytes } = req.body ?? {};

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

  if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] OCR request — businessId:', businessId, 'mimeType:', mimeType, 'sizeBytes:', sizeBytes);

  // Provider chain — each entry: { name, canHandle, fn }
  // canHandle prevents unnecessary attempts (missing key, unsupported type)
  const providers: Array<{ name: 'gemini' | 'claude'; canHandle: boolean; fn: () => Promise<ProviderResult> }> = [
    { name: 'gemini', canHandle: !!geminiKey, fn: () => tryGemini(imageBase64, mimeType, geminiKey) },
    { name: 'claude', canHandle: !!claudeKey && CLAUDE_VISION_TYPES.has(mimeType), fn: () => tryClaude(imageBase64, mimeType, claudeKey) },
    // provider 3 slot: { name: 'azure', canHandle: !!azureKey, fn: () => tryAzure(...) },
  ];

  let result: ProviderResult | null = null;
  let lastErr = '';
  let lastFailedProvider = '';

  for (const p of providers) {
    if (!p.canHandle) continue;
    try {
      result = await p.fn();
      if (lastFailedProvider) {
        // Fallback activated — log greppably for operator monitoring
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
    `[TRACE:RECEIPT] ${result.provider} response — inputTokens:`, result.inputTokens,
    'outputTokens:', result.outputTokens,
    'estimatedCost:', result.costEstimate,
    'latencyMs:', result.latencyMs,
  );
  if (TRACE_RECEIPT) console.log(
    '[TRACE:RECEIPT] parsed result — vendor:', parsed?.vendor,
    'amount:', parsed?.amount,
    'date:', parsed?.date,
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
