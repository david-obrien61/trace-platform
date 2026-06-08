import { createClient } from '@supabase/supabase-js';
import { generateSocialDrafts } from '../../../shared/src/social/generate';

const SOCIALDRAFT_DEBUG = false;

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[generate-posts] ANTHROPIC_API_KEY not set');
    return res.status(200).json({ ok: false, reason: 'api_key_missing' });
  }

  const { business_id, period_days: rawPeriodDays } = req.body;
  if (!business_id) return res.status(400).json({ error: 'Missing business_id' });

  const db = adminDb();

  if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] handler called — business_id:', business_id);

  // ── Read business context ─────────────────────────────────────────────────

  const { data: mod, error: modErr } = await db
    .from('business_modules')
    .select('enabled, configured, config')
    .eq('business_id', business_id)
    .eq('module_key', 'social_media')
    .single();

  if (modErr || !mod?.enabled || !mod?.configured) {
    console.warn('[generate-posts] module not enabled:', modErr?.message);
    return res.status(200).json({ ok: false, reason: 'module_not_enabled' });
  }

  const config    = (mod.config ?? {}) as { platforms?: string[]; cadence?: string };
  const platforms = Array.isArray(config.platforms) && config.platforms.length > 0
    ? config.platforms
    : ['instagram'];
  const cadence   = config.cadence ?? 'weekly';

  const periodDays = typeof rawPeriodDays === 'number' && rawPeriodDays > 0
    ? rawPeriodDays
    : cadence === 'few_times' ? 3 : 7;

  const periodEnd   = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const { data: biz } = await db
    .from('businesses')
    .select('name, business_type')
    .eq('id', business_id)
    .single();

  const businessName = (biz as any)?.name ?? 'Our Business';
  const businessType = (biz as any)?.business_type ?? 'nursery';

  // ── Gather period context (vertical-assembled; passed to shared generator) ─

  const { data: orders } = await db
    .from('orders')
    .select('id, customer_id, total, customers(first_name)')
    .eq('business_id', business_id)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  const orderCount = (orders ?? []).length;
  const orderIds   = (orders ?? []).map((o: any) => o.id);

  let subjectSummary = 'plants and trees';
  if (orderIds.length > 0) {
    const { data: items } = await db
      .from('order_items')
      .select('plants(common_name, species)')
      .in('order_id', orderIds);

    const plantNames = [...new Set(
      (items ?? [])
        .map((i: any) => i.plants?.common_name ?? i.plants?.species)
        .filter(Boolean),
    )].slice(0, 6) as string[];

    if (plantNames.length > 0) subjectSummary = plantNames.join(', ');
  }

  const customerNames = [...new Set(
    (orders ?? [])
      .map((o: any) => o.customers?.first_name)
      .filter(Boolean),
  )].slice(0, 4) as string[];

  if (SOCIALDRAFT_DEBUG) {
    console.log('[TRACE:socialdraft] context — orderCount:', orderCount, 'subject:', subjectSummary, 'businessType:', businessType);
  }

  // ── Generate via shared module (gateway → Sonnet) ─────────────────────────

  try {
    const drafts = await generateSocialDrafts({
      businessName,
      businessType,
      platforms,
      periodStart,
      periodEnd,
      orderCount,
      subjectSummary,
      customerNames,
      apiKey,
    });

    const inserts = platforms
      .filter(p => typeof drafts[p] === 'string' && drafts[p].trim())
      .map(p => ({
        business_id,
        platform:     p,
        original_text: drafts[p].trim(),
        post_type:    null,
        status:       'draft',
        subject_type: 'inventory',  // Cultivar posts are about inventory (AC-1: value, not column)
        subject_id:   null,         // period aggregate — no single entity
        cadence,
        period_start: periodStart.toISOString(),
        period_end:   periodEnd.toISOString(),
      }));

    if (inserts.length === 0) {
      console.warn('[generate-posts] no posts parsed from AI response');
      return res.status(200).json({ ok: false, reason: 'parse_failed' });
    }

    if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] inserting', inserts.length, 'rows');

    const { error: insertErr } = await db.from('social_drafts').insert(inserts);
    if (insertErr) {
      console.error('[generate-posts] insert error:', insertErr.message);
      return res.status(200).json({ ok: false, reason: 'insert_failed', detail: insertErr.message });
    }

    if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] insert success — platforms:', inserts.map(i => i.platform));

    return res.status(200).json({ ok: true, count: inserts.length, platforms: inserts.map(i => i.platform) });

  } catch (err: any) {
    console.error('[generate-posts] error:', err?.message ?? err);
    return res.status(200).json({ ok: false, reason: 'generation_failed' });
  }
}
