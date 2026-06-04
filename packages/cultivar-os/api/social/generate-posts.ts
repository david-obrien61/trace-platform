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

const SYSTEM_PROMPT = `You are a social media writer for small owner-operated plant nurseries in Texas.
Your job is to write short, warm, friendly social media posts after a sale.

Rules for every post:
- Under 280 characters total (including hashtags)
- 3-5 relevant hashtags at the end
- Warm nursery voice — not corporate, not salesy
- Never mention prices
- Never include customer last name, email, or any contact info
- Customer first name only if used at all

Return ONLY a JSON object. No markdown, no explanation, no preamble. Exactly this shape:
{"posts":[{"type":"educational","content":"..."},{"type":"customer_story","content":"..."},{"type":"seasonal","content":"..."}]}`;

export default async function handler(req: any, res: any) {
  console.log('[generate-posts] ENTRY method:', req.method, 'body:', JSON.stringify(req.body));

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[generate-posts] EARLY EXIT — ANTHROPIC_API_KEY not set');
    return res.status(200).json({ ok: false, reason: 'api_key_missing' });
  }

  const {
    business_id,
    order_id,
    plant_species,
    plant_common_name,
    plant_container,
    customer_first_name,
    addons_purchased,
  } = req.body;

  if (!business_id || !order_id) {
    console.warn('[generate-posts] EARLY EXIT — missing business_id or order_id', { business_id, order_id });
    return res.status(400).json({ error: 'Missing business_id or order_id' });
  }

  const db = adminDb();

  // Check social_media module is enabled + configured for this business
  const { data: nm, error: nmErr } = await db
    .from('business_modules')
    .select('enabled, configured')
    .eq('business_id', business_id)
    .eq('module_key', 'social_media')
    .single();

  console.log('[generate-posts] business_modules row:', JSON.stringify(nm), 'error:', nmErr?.message ?? null);

  if (!nm?.enabled || !nm?.configured) {
    console.warn('[generate-posts] EARLY EXIT — module_not_enabled');
    return res.status(200).json({ ok: false, reason: 'module_not_enabled' });
  }

  // Get business name for the posts
  const { data: biz } = await db
    .from('businesses')
    .select('name')
    .eq('id', business_id)
    .single();
  const businessName = (biz as any)?.name ?? 'Our Nursery';

  const currentMonth   = MONTH_NAMES[new Date().getMonth()];
  const commonName     = plant_common_name ?? plant_species ?? 'tree';
  const addonsList     = Array.isArray(addons_purchased) && addons_purchased.length > 0
    ? addons_purchased.join(', ')
    : 'none';

  const userPrompt = `Write 3 social media posts for ${businessName}.

Sale details:
- Plant: ${commonName}${plant_species ? ` (${plant_species})` : ''}
- Container: ${plant_container ?? 'unknown'}
- Customer first name: ${customer_first_name ?? 'a customer'}
- Month: ${currentMonth}
- Add-ons purchased: ${addonsList}

Generate:
1. educational — an interesting fact or care tip about ${commonName}
2. customer_story — celebrate ${customer_first_name ?? 'the customer'}'s purchase (first name only)
3. seasonal — a planting or care tip relevant to ${currentMonth} in Texas`;

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log('[generate-posts] calling Claude API...');
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system: [
        {
          type:          'text',
          text:          SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
    console.log('[generate-posts] Claude API returned. stop_reason:', message.stop_reason);

    const raw  = message.content.find(b => b.type === 'text');
    const text = raw?.type === 'text' ? raw.text.trim() : '';
    const parsed = JSON.parse(text) as { posts: Array<{ type: string; content: string }> };

    const inserts = parsed.posts.map(post => ({
      business_id,
      order_id,
      platform:  'instagram',
      content:   post.content,
      post_type: post.type,
      status:    'draft',
    }));

    console.log('[generate-posts] inserting', inserts.length, 'rows into social_drafts...');
    const { error: insertErr } = await db.from('social_drafts').insert(inserts);
    console.log('[generate-posts] insert complete. error:', insertErr?.message ?? null);

    return res.status(200).json({ ok: true, count: inserts.length });
  } catch (err: any) {
    console.error('[generate-posts] generation error:', err?.message ?? err);

    try {
      const { error: failErr } = await db.from('social_drafts').insert({
        business_id,
        order_id,
        platform:  'instagram',
        content:   null,
        post_type: null,
        status:    'failed',
      });
      console.log('[generate-posts] failed-row insert error:', failErr?.message ?? null);
    } catch { /* non-fatal */ }

    return res.status(200).json({ ok: false, reason: 'generation_failed' });
  }
}
