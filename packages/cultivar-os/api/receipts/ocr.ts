// STD-010 ACTIVE — File Upload / Ingest Safety. All rules applied here.
// This function is the ONLY server-side path for receipt OCR.
// Client-side never sees the GEMINI_API_KEY or the raw binary.
//
// KIND-2 BENCHED (explicitly NOT in this build):
//   - Usage limiting / billing → benched, awaiting payments/first paying customer
//   - Quality-analysis dashboard → benched; accept_vs_edit signal captured now
//   - QB write-back for receipts → benched; v1 is local-only
//
// GEMINI_API_KEY must be set in Vercel cultivar-os project environment variables.
// Storage bucket: 'receipts' — David must create in Supabase Storage if not exists.

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('[TRACE:RECEIPT] GEMINI_API_KEY not set — OCR unavailable');
    return res.status(503).json({ error: 'OCR unavailable — GEMINI_API_KEY not configured' });
  }

  const { businessId, userId, imageBase64, mimeType, fileSizeBytes } = req.body ?? {};

  if (!businessId || !userId || !imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'businessId, userId, imageBase64, and mimeType are required' });
  }

  // STD-010: content-type validation — reject anything not in the allowlist
  if (!ALLOWED_TYPES.has(mimeType)) {
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] rejected mimeType:', mimeType);
    return res.status(415).json({ error: `File type not accepted: ${mimeType}. Allowed: JPEG, PNG, WEBP, HEIC, PDF.` });
  }

  // STD-010: size limit enforcement
  const sizeBytes = fileSizeBytes ?? Buffer.byteLength(imageBase64, 'base64');
  if (sizeBytes > MAX_BYTES) {
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] rejected size:', sizeBytes, 'max:', MAX_BYTES);
    return res.status(413).json({ error: `File too large (${Math.round(sizeBytes / 1024)}KB). Max: 10MB.` });
  }

  if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] OCR request — businessId:', businessId, 'mimeType:', mimeType, 'sizeBytes:', sizeBytes);

  // STD-010: per-tenant storage path — {bucket}/{business_id}/{receipt_id}
  // Storage is handled client-side (Supabase Storage JS) with path = `receipts/${businessId}/${receiptId}`
  // The server receives base64 for OCR only; the client stores to Storage separately.
  // OCR result is the artifact — not the raw image bytes (STD-010 OCR clause).

  const prompt = `You are a receipt parser. Extract structured data from this receipt image.

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

  try {
    const startMs = Date.now();

    // Abort after 8s — stays under Vercel Hobby's 10s hard kill, lets us return a clean error
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 8000);

    let geminiRes: Response;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
            },
          }),
        }
      );
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[TRACE:RECEIPT] Gemini fetch timed out after 8s — sizeBytes:', sizeBytes);
        return res.status(408).json({ ok: false, error: 'OCR timed out — try a smaller or clearer photo' });
      }
      throw fetchErr; // re-throw non-timeout errors to outer catch
    }

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startMs;

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[TRACE:RECEIPT] Gemini error', geminiRes.status, errBody);
      return res.status(502).json({ ok: false, error: 'OCR failed — upstream error', detail: geminiRes.status });
    }

    const geminiData = await geminiRes.json();

    // KIND-1: ocr_cost_estimate — log token counts so David can compute cost
    const usage = geminiData.usageMetadata ?? {};
    const inputTokens  = usage.promptTokenCount    ?? null;
    const outputTokens = usage.candidatesTokenCount ?? null;
    // Gemini Flash pricing as of 2026-06: ~$0.075 per 1M input tokens, $0.30 per 1M output tokens
    // Estimate is approximate — used for cost-discovery, not billing
    const costEstimate = (inputTokens && outputTokens)
      ? (inputTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.30
      : null;

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] Gemini response — inputTokens:', inputTokens, 'outputTokens:', outputTokens, 'estimatedCost:', costEstimate, 'latencyMs:', latencyMs);

    // Extract the text response
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // STD-010: OCR result is the artifact — parse structured data, never execute
    let parsed: Record<string, any> | null = null;
    let parseError: string | null = null;

    try {
      // Strip markdown fences if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Try regex fallback for JSON object
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* genuinely unparseable */ }
      }
      if (!parsed) parseError = 'OCR returned unparseable text — manual entry required';
    }

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] parsed result — vendor:', parsed?.vendor, 'amount:', parsed?.amount, 'date:', parsed?.date, 'parseError:', parseError);

    return res.json({
      ok: true,
      ocr_raw: geminiData,          // full Gemini response for ocr_raw column
      parsed,                        // structured extract for pre-fill
      parseError,
      inputTokens,
      outputTokens,
      ocr_cost_estimate: costEstimate,
      latencyMs,
    });

  } catch (err: any) {
    console.error('[TRACE:RECEIPT] fetch error:', err.message);
    return res.status(500).json({ error: 'OCR request failed', detail: err.message });
  }
}
