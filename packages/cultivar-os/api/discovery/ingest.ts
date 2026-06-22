import { createClient } from '@supabase/supabase-js';
import { fetchWebsiteContent } from '../../../shared/src/discovery/adapters/website';
import { runIdentity, runAnalysis } from '../../../shared/src/discovery/engine';
import { runSynthesis } from '../../../shared/src/discovery/synthesis';
import { nurserySchema } from '../../../shared/src/discovery/verticals/nursery';
import { seedServiceOfferings } from '../../../shared/src/discovery/seed';
import { reasonCostTurn, applyCostReasoning } from '../../../shared/src/discovery/costDiscovery';
import type { CostDiscoveryLine, CostAnswer, CostReasoning } from '../../../shared/src/discovery/costDiscovery';
import { sendNotification } from '../../../shared/src/notifications/send';
import type { VerticalSchema, SilentPartnerAnalysis } from '../../../shared/src/discovery/types';

const VERTICAL_SCHEMAS: Record<string, VerticalSchema> = {
  nursery: nurserySchema,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    url, vertical = 'nursery', painPoint, businessId,
    action, analysis: sentAnalysis, recipientEmail, recipientName, businessName,
    line, answers, reasoning,
  } = req.body;

  // ── action='cost-discovery' — one turn of the cost-to-produce reasoning flow ───
  // Reasons (Opus) about a line's cost, returns current estimate + the next question.
  // No new Vercel function — routed through the existing discovery endpoint (12-fn ceiling).
  if (action === 'cost-discovery') {
    const aiKey = process.env.ANTHROPIC_API_KEY;
    if (!aiKey) return res.status(503).json({ error: 'AI unavailable' });
    const costLine = line as CostDiscoveryLine | undefined;
    if (!costLine?.id || !costLine?.businessId || !costLine?.name) {
      return res.status(400).json({ error: 'line { id, businessId, name } required' });
    }
    try {
      const turn = await reasonCostTurn(costLine, (answers as CostAnswer[]) ?? [], { apiKey: aiKey });
      return res.json({ ok: true, ...turn });
    } catch (err: any) {
      // CostConfidenceViolation (a CONFIRMED attempt) surfaces here as a hard 422, never silently.
      return res.status(422).json({ ok: false, error: err.message });
    }
  }

  // ── action='cost-apply' — write a reasoned (ESTIMATED/DERIVED) cost to the line ─
  // UNKNOWN leaves the line untouched; CONFIRMED is rejected by applyCostReasoning.
  if (action === 'cost-apply') {
    const costLine = line as CostDiscoveryLine | undefined;
    const r = reasoning as CostReasoning | undefined;
    if (!costLine?.id || !costLine?.businessId || !r) {
      return res.status(400).json({ error: 'line { id, businessId } and reasoning required' });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: 'DB unavailable' });
    try {
      const db = createClient(supabaseUrl, serviceKey);
      const result = await applyCostReasoning(costLine, r, db);
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      return res.status(422).json({ ok: false, error: err.message });
    }
  }

  // ── action='send' — deliver a pre-generated analysis to a recipient ──────────
  // No new Vercel function needed — routed through the existing endpoint.
  if (action === 'send') {
    const analysis = sentAnalysis as SilentPartnerAnalysis | undefined;
    if (!analysis?.subject || !analysis?.body || !recipientEmail) {
      return res.status(400).json({ error: 'analysis (subject+body) and recipientEmail required' });
    }
    const result = await sendNotification({
      vertical:   'cultivar',
      templateId: 'silent_partner_analysis',
      entityId:   recipientEmail,
      to:         { email: recipientEmail },
      data: {
        subject:       analysis.subject,
        body:          analysis.body,
        htmlContent:   analysis.html ?? '',
        recipientName: recipientName ?? 'there',
        businessName:  businessName  ?? 'your business',
      },
    });
    if (!result.success && !result.demo) {
      return res.status(500).json({ ok: false, error: result.error });
    }
    return res.json({ ok: true, demo: result.demo });
  }

  // ── Normal ingest flow ────────────────────────────────────────────────────────
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI unavailable' });
  }

  const schema = VERTICAL_SCHEMAS[vertical] ?? nurserySchema;

  try {
    // Step 1: Fetch website
    const content = await fetchWebsiteContent(url);
    if (content.error && !content.text) {
      return res.status(422).json({
        error: `Could not read website: ${content.error}`,
        url: content.url,
      });
    }

    // Step 2a: Fast identity extraction (Haiku) — feeds recognition moment
    // NOTE: ingest.ts returns this as `identity` in the response JSON.
    // DiscoveryGlimpse reads `data.profile` (the deep analysis) — unchanged.
    const identity = await runIdentity(content, schema, apiKey);

    // Step 2b: Deep analysis (Sonnet) — uses identity context, avoids re-extraction
    const profile = await runAnalysis(content, schema, painPoint ?? null, identity, apiKey);

    // Step 2c: Seed service_offerings in-memory while profile is available.
    // businessId must be present in the POST body — callers that omit it skip seeding cleanly.
    // No DB lookup required; seeding happens here or not at all (v2 will add signup-path lookup).
    let seeded = 0;
    if (businessId) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
      if (supabaseUrl && serviceKey) {
        try {
          const db = createClient(supabaseUrl, serviceKey);
          const r  = await seedServiceOfferings(profile, businessId, db);
          seeded   = r.seeded;
        } catch (seedErr: any) {
          console.error('[discovery/ingest] seed (non-fatal):', seedErr.message);
        }
      }
    }

    // Step 3: Silent partner email from the deep analysis (unchanged)
    const analysis = await runSynthesis(profile, apiKey);

    res.json({ identity, profile, analysis, fetchError: content.error ?? null, seeded });

  } catch (err: any) {
    console.error('[discovery/ingest]', err.message);
    res.status(500).json({ error: err.message });
  }
}
