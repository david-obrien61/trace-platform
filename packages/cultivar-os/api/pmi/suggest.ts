// ============================================================
// api/pmi/suggest — AI preventive-maintenance schedule suggestion
// PURPOSE:      Given one asset (name/type/make/model/year), ask Claude for 3-8 typical
//               maintenance tasks + intervals. Returns a PREVIEW only — nothing is written
//               here; `PMI.tsx`'s Accept does the write through the caller's own session.
// DEPENDENCIES: @anthropic-ai/sdk (BILLABLE call), shared/auth/callerPermission (callerCan).
//               No database, no service key.
// OUTPUTS:      { ok, tasks: [{ name, interval }] } · 400 missing fields · 403 unauthorized
//               · 503 AI unavailable/failed · 500 unparseable or empty response.
// AUTHORITY:    `pmi:read` for the business named in the body, resolved from the Bearer token
//               (MB_D-015 — never the body). See the gate comment in the handler for why
//               `pmi:read` and not `pmi:update`.
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import { callerCan } from '../../../shared/src/auth/callerPermission';

const PROMPT = `You are a preventive maintenance (PMI) expert for small business equipment.
Given an asset's name and details, return a JSON object with a list of recommended maintenance tasks.

Return ONLY this JSON object, no markdown fences, no explanation:
{"tasks": [{"name": "string", "interval": "string"}]}

Rules:
- name: short, action-oriented task description (e.g. "Change engine oil", "Check tire pressure")
- interval: human-readable frequency — "daily", "weekly", "monthly", "quarterly", "semi-annually", "annually", "every 2 years", or "every N miles/hours" for usage-based
- Include 3-8 tasks typical for the asset type
- Prioritize safety-critical tasks first
- If asset details are sparse, use the asset type to infer sensible defaults`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { businessId, name, asset_type, make, model, year } = req.body ?? {};

  if (!businessId || !name) {
    return res.status(400).json({ ok: false, error: 'businessId and name are required' });
  }

  // 🔴 CALLER AUTHORITY — MB_D-015. ADDED 2026-09-11 (tech-debt #261); this endpoint had NONE.
  // `businessId` comes off the REQUEST BODY and the only thing below it is a BILLABLE Anthropic
  // call. Until this gate existed, anyone who knew the URL could fire Claude at our cost, as many
  // times as they liked, while naming any tenant they liked — the id was never checked against the
  // caller, so it also mis-attributed every `[TRACE:ai]` line to a business the caller may not
  // belong to. `pmi:read` is the authority, and it is the string the CALLING SURFACE already
  // requires: `/pmi` is gated `pmi:read` (router.tsx:249). This endpoint WRITES NOTHING — it
  // returns a preview the owner then accepts — so gating it on `pmi:update` would be a bar
  // stricter than the act, and would lock out the manager this module's own header describes as
  // legitimately holding `pmi:read` and not more.
  //
  // Pattern and wording copied from `api/social/generate-posts.ts:31-38`, which is the SAME defect
  // already fixed on an AI-billing route (2026-07-27) — not a new pattern. `callerCan` resolves the
  // caller from the Bearer token and never from the body, so a forged `businessId` refuses.
  const authHeader = req.headers?.authorization;
  if (!(await callerCan(authHeader, businessId, 'pmi:read'))) {
    console.log('[TRACE:AUTHORITY] pmi/suggest REFUSED — caller lacks pmi:read/owner', { businessId });
    return res.status(403).json({ ok: false, error: 'Not authorized to suggest maintenance for this business', code: 'FORBIDDEN' });
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!claudeKey) {
    console.error('[TRACE:PMI] ANTHROPIC_API_KEY missing');
    return res.status(503).json({ ok: false, error: 'AI unavailable — contact support' });
  }

  const assetDescription = [
    name,
    asset_type ? `(${asset_type})` : '',
    make ? `Make: ${make}` : '',
    model ? `Model: ${model}` : '',
    year ? `Year: ${year}` : '',
  ].filter(Boolean).join(' ');

  // [TRACE:ai] (STD-003) — on by default; this is a live billable Claude call.
  // Stays emitting until owner-proven by David, then comment out (don't delete).
  const MODEL = 'claude-sonnet-4-6';
  const t0 = Date.now();
  console.log('[TRACE:ai] pmi/suggest request', {
    businessId, asset: name, asset_type: asset_type ?? null, model: MODEL,
  });

  try {
    const client = new Anthropic({ apiKey: claudeKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Asset: ${assetDescription}\n\nReturn the JSON maintenance task list.`,
      }],
      system: PROMPT,
    });

    const textBlock = msg.content.find((b: any) => b.type === 'text') as any;
    const rawText: string = textBlock?.text ?? '';

    let tasks: Array<{ name: string; interval: string }> = [];
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
        } catch {
          console.error('[TRACE:PMI] Failed to parse AI response:', rawText.slice(0, 200));
          return res.status(500).json({ ok: false, error: 'AI returned unparseable response — try again' });
        }
      }
    }

    if (tasks.length === 0) {
      // [TRACE:ai] (STD-003) — call succeeded but yielded nothing usable.
      console.error('[TRACE:ai] pmi/suggest error', {
        businessId, asset: name, model: MODEL, ok: false,
        reason: 'no_tasks', latency_ms: Date.now() - t0,
      });
      return res.status(500).json({ ok: false, error: 'AI returned no tasks — try again' });
    }

    // [TRACE:ai] (STD-003) — success: how many tasks, tokens, and how long the billable call took.
    console.log('[TRACE:ai] pmi/suggest response', {
      businessId, asset: name, model: MODEL, ok: true,
      taskCount: tasks.length,
      inTok: msg.usage?.input_tokens ?? 0,
      outTok: msg.usage?.output_tokens ?? 0,
      latency_ms: Date.now() - t0,
    });
    return res.json({ ok: true, tasks });
  } catch (err: any) {
    // [TRACE:ai] (STD-003) — the billable call (or SDK) threw: WHEN and WHAT, not silence.
    console.error('[TRACE:ai] pmi/suggest error', {
      businessId, asset: name, model: MODEL, ok: false,
      error: err?.message?.slice(0, 200) ?? String(err),
      latency_ms: Date.now() - t0,
    });
    return res.status(503).json({ ok: false, error: 'AI suggest failed — try again' });
  }
}
