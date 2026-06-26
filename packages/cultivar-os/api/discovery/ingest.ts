// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: discovery endpoint — multiplexes several POST actions through ONE Vercel
//   function (12-fn ceiling): website identity/analysis/synthesis, service-offering
//   seed, recipient send, and the cost-to-produce reasoning flow (cost-discovery /
//   cost-apply). cost-apply WRITES protected financial data, so it is permission-gated.
// DEPENDENCIES: @supabase/supabase-js (service key for writes, anon key for the
//   caller permission check), shared discovery engine + costDiscovery, shared
//   financialPermissions (VIEW_COSTS), shared notifications.
// OUTPUTS: JSON per action. cost-apply: writes business_inventory.unit_cost ONLY
//   after the caller is proven to hold view_costs (MB_D-015 write-wall).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { fetchWebsiteContent } from '../../../shared/src/discovery/adapters/website';
import { runIdentity, runAnalysis } from '../../../shared/src/discovery/engine';
import { runSynthesis } from '../../../shared/src/discovery/synthesis';
import { nurserySchema } from '../../../shared/src/discovery/verticals/nursery';
import { seedServiceOfferings } from '../../../shared/src/discovery/seed';
import { reasonCostTurn, applyCostReasoning } from '../../../shared/src/discovery/costDiscovery';
import type { CostDiscoveryLine, CostAnswer, CostReasoning } from '../../../shared/src/discovery/costDiscovery';
import { compareEnteredVsSite, type Discrepancy } from '../../../shared/src/discovery/compare';
import { populateCatalog } from '../../../shared/src/discovery/populate';
import { VIEW_COSTS } from '../../../shared/src/auth/financialPermissions';
import { sendNotification } from '../../../shared/src/notifications/send';
import type { VerticalSchema, SilentPartnerAnalysis } from '../../../shared/src/discovery/types';

const VERTICAL_SCHEMAS: Record<string, VerticalSchema> = {
  nursery: nurserySchema,
};

// WRITE-WALL gate (MB_D-015 — write-authority ≥ read-authority). Resolve the caller from the
// request AUTH CONTEXT (the Bearer token), NEVER the request body, and confirm they hold `perm`
// for the TARGET business via the canonical has_permission RPC. That RPC is SECURITY DEFINER and
// reads business_members for auth.uid(), so running it under the caller's anon-key+token returns
// true only for an active member of that business holding the permission — a forged businessId the
// caller doesn't belong to returns false. The service key is the write MECHANISM (below); this is
// the GATE. `_rpc` is an injectable test seam that replaces ONLY the network call, never the token
// guard (so the no-token refusal is always exercised). Returns true only on an explicit grant.
export async function callerHoldsPermission(
  authHeader: string | undefined,
  businessId: string,
  perm: string,
  _rpc?: (token: string, businessId: string, perm: string) => Promise<boolean>,
): Promise<boolean> {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false; // no caller token → refuse (the auth guard, runs before any RPC)
  if (_rpc) return _rpc(token, businessId, perm);
  const url = process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await caller.rpc('has_permission', { p_business_id: businessId, p_perm: perm });
  return !error && data === true;
}

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
    // WRITE-WALL (MB_D-015): the caller must hold view_costs for THIS business, resolved from the
    // auth context (never the body). The service-key write below runs ONLY after this gate passes —
    // closing the bypass where a service-key write tunneled under the cost-wall RLS.
    const allowed = await callerHoldsPermission(req.headers?.authorization, costLine.businessId, VIEW_COSTS);
    if (!allowed) {
      console.warn(`[TRACE:WRITEWALL] cost-apply REFUSED — caller lacks ${VIEW_COSTS} for business ${costLine.businessId}`);
      return res.status(403).json({ ok: false, error: `forbidden: ${VIEW_COSTS} required` });
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

  // ── action='populate' — seed a new business's catalog FROM their live site ─────
  // Crawls the site → extracts the real catalog → clears sandbox + prior-discovery rows →
  // writes THEIR varieties into business_inventory (D-9 flagged). Service-key WRITE, routed
  // through this existing function (NO new Vercel function — 12-fn ceiling, tech-debt #41).
  // Ungated by design, matching the sibling seedServiceOfferings write below: it touches only
  // namespaced sandbox/DISC- rows (never real inventory) and sets unit_cost=null (UNKNOWN),
  // so it never crosses the view_costs cost-wall. Degrades gracefully if business_discovery_profiles
  // is unapplied (populateCatalog treats the profile upsert as non-fatal — inventory still seeds).
  if (action === 'populate') {
    const aiKey = process.env.ANTHROPIC_API_KEY;
    if (!aiKey) return res.status(503).json({ error: 'AI unavailable' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: 'DB unavailable' });
    if (!businessId || !url) return res.status(400).json({ error: 'businessId and url required' });
    try {
      console.log(`[TRACE:POPULATE] ingest action=populate business=${businessId} url=${url}`);
      const db = createClient(supabaseUrl, serviceKey);
      const result = await populateCatalog(businessId, url, db, { apiKey: aiKey });
      return res.json({
        ok: !result.error, inserted: result.inserted, flaggedInserted: result.flaggedInserted,
        status: result.status, error: result.error,
      });
    } catch (err: any) {
      console.error('[discovery/ingest] populate:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
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

    // Step 2d: Entered-vs-site discrepancy compare (capability 1.1). Reads the entered
    // onboarding data from the businesses row (service-key) and compares it against the
    // ALREADY-FETCHED `content` (injected — NO second site fetch). Surfaces hedged, D-9-gated
    // discrepancies (incl. ADDRESS) for the reveal to raise gracefully. Non-fatal: a compare
    // failure (or a business-less call) returns an empty list and never blocks the reveal.
    let discrepancies: Discrepancy[] = [];
    if (businessId) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
      if (supabaseUrl && serviceKey) {
        try {
          const db = createClient(supabaseUrl, serviceKey);
          const { data: biz } = await db
            .from('businesses')
            .select('name, address, phone, email, website')
            .eq('id', businessId)
            .maybeSingle();
          if (biz) {
            const cmp = await compareEnteredVsSite(
              {
                businessName: biz.name,  address: biz.address,
                phone:        biz.phone, email:   biz.email,
                website:      url,
              },
              { apiKey, _fetchContent: async () => content },
            );
            discrepancies = cmp.discrepancies;
            console.log(`[TRACE:DISCOVERY] ingest compare business=${businessId} surfaced=${discrepancies.length} fields=${discrepancies.map(d => d.field).join(',')}`);
          }
        } catch (cmpErr: any) {
          console.error('[discovery/ingest] compare (non-fatal):', cmpErr.message);
        }
      }
    }

    // Step 3: Silent partner email from the deep analysis (unchanged)
    const analysis = await runSynthesis(profile, apiKey);

    res.json({ identity, profile, analysis, discrepancies, fetchError: content.error ?? null, seeded });

  } catch (err: any) {
    console.error('[discovery/ingest]', err.message);
    res.status(500).json({ error: err.message });
  }
}
