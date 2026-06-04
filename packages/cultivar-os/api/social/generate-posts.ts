import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// One post per platform — formatted for each platform's style.
// Return shape: { "instagram": "caption...", "facebook": "caption...", ... }
const SYSTEM_PROMPT = `You are a social media writer for a small owner-operated plant nursery in Texas.
Your job is to write ONE social media post per platform that celebrates the week's business activity.

The post should feel warm and specific to what actually happened — not a generic template.
Aggregate the week into one compelling moment. Never mention prices. Never include customer
last names, emails, or contact info. Use customer first names only if they feel natural.

Formatting per platform:
- instagram: Under 220 characters, 5–8 relevant hashtags at the end. Visual and upbeat.
- facebook: 50–120 words. Warm and conversational. 2–3 hashtags max. More storytelling.
- tiktok: Under 150 characters, punchy and energetic. 3–5 hashtags.
- twitter: Under 260 characters, brief and direct. 2–3 hashtags.

Return ONLY a JSON object. No markdown, no explanation, no preamble. Keys are platform names,
values are the caption strings. Include only the platforms listed in the user message.
Example: {"instagram":"caption...","facebook":"caption..."}`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[generate-posts] ANTHROPIC_API_KEY not set');
    return res.status(200).json({ ok: false, reason: 'api_key_missing' });
  }

  const { business_id, period_days: rawPeriodDays } = req.body;

  if (!business_id) {
    return res.status(400).json({ error: 'Missing business_id' });
  }

  const db = adminDb();

  // Load module config — platforms + cadence
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

  const config     = (mod.config ?? {}) as { platforms?: string[]; cadence?: string };
  const platforms  = Array.isArray(config.platforms) && config.platforms.length > 0
    ? config.platforms
    : ['instagram'];
  const cadence    = config.cadence ?? 'weekly';

  // Determine period
  const periodDays = typeof rawPeriodDays === 'number' && rawPeriodDays > 0
    ? rawPeriodDays
    : cadence === 'few_times' ? 3 : 7;

  const periodEnd   = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Load business name
  const { data: biz } = await db
    .from('businesses')
    .select('name')
    .eq('id', business_id)
    .single();
  const businessName = (biz as any)?.name ?? 'Our Nursery';

  // Load orders from the period — join plant data via order_items
  const { data: orders } = await db
    .from('orders')
    .select('id, customer_id, total, customers(first_name)')
    .eq('business_id', business_id)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  const orderCount = (orders ?? []).length;

  // Load plants from those orders for species context
  const orderIds = (orders ?? []).map((o: any) => o.id);
  let plantNames: string[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await db
      .from('order_items')
      .select('plants(common_name, species)')
      .in('order_id', orderIds);
    plantNames = [...new Set(
      (items ?? [])
        .map((i: any) => i.plants?.common_name ?? i.plants?.species)
        .filter(Boolean)
    )].slice(0, 6) as string[];
  }

  // Customer first names (deduplicated, limit 4)
  const customerNames = [...new Set(
    (orders ?? [])
      .map((o: any) => o.customers?.first_name)
      .filter(Boolean)
  )].slice(0, 4) as string[];

  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  const plantSummary   = plantNames.length > 0
    ? plantNames.join(', ')
    : 'trees and plants';
  const customerSummary = customerNames.length > 0
    ? customerNames.join(', ')
    : 'customers';

  const userPrompt = `Write social posts for ${businessName}.

Period: ${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${currentMonth} in Texas
Orders this period: ${orderCount}
Plants sold: ${plantSummary}
${customerNames.length > 0 ? `Customer first names: ${customerSummary}` : ''}

Platforms to generate (include ALL of these as keys in the JSON):
${platforms.join(', ')}

${orderCount === 0 ? 'No sales this period — write a general warm nursery post about the season and what\'s growing.' : ''}`;

  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      system: [
        {
          type:          'text',
          text:          SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw  = message.content.find(b => b.type === 'text');
    const text = raw?.type === 'text' ? raw.text.trim() : '';

    // Two-pass JSON extraction — handle stray markdown fences
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const inserts = platforms
      .filter(p => typeof parsed[p] === 'string' && parsed[p].trim())
      .map(p => ({
        business_id,
        platform:      p,
        content:       parsed[p].trim(),
        original_text: parsed[p].trim(),
        post_type:     null,
        status:        'draft',
        cadence,
        period_start:  periodStart.toISOString(),
        period_end:    periodEnd.toISOString(),
      }));

    if (inserts.length === 0) {
      console.warn('[generate-posts] no posts parsed from Claude response');
      return res.status(200).json({ ok: false, reason: 'parse_failed' });
    }

    const { error: insertErr } = await db.from('social_drafts').insert(inserts);
    if (insertErr) {
      console.error('[generate-posts] insert error:', insertErr.message);
      return res.status(200).json({ ok: false, reason: 'insert_failed' });
    }

    return res.status(200).json({ ok: true, count: inserts.length, platforms: inserts.map(i => i.platform) });

  } catch (err: any) {
    console.error('[generate-posts] error:', err?.message ?? err);
    return res.status(200).json({ ok: false, reason: 'generation_failed' });
  }
}
