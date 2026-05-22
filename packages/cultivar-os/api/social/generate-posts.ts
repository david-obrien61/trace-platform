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

// Cached system prompt — stable instructions that never change per-request
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[social/generate-posts] ANTHROPIC_API_KEY not set — skipping post generation');
    return res.status(200).json({ ok: false, reason: 'api_key_missing' });
  }

  const {
    nursery_id,
    order_id,
    plant_species,
    plant_common_name,
    plant_container,
    customer_first_name,
    addons_purchased,
  } = req.body;

  if (!nursery_id || !order_id) {
    return res.status(400).json({ error: 'Missing nursery_id or order_id' });
  }

  const db = adminDb();

  // Check social_media module is enabled + configured for this nursery
  const { data: nm } = await db
    .from('nursery_modules')
    .select('enabled, configured')
    .eq('nursery_id', nursery_id)
    .eq('module_key', 'social_media')
    .single();

  if (!nm?.enabled || !nm?.configured) {
    return res.status(200).json({ ok: false, reason: 'module_not_enabled' });
  }

  // Get nursery name for the posts
  const { data: nursery } = await db
    .from('nurseries')
    .select('name')
    .eq('id', nursery_id)
    .single();
  const nurseryName = (nursery as any)?.name ?? 'LAWNS Tree Farm';

  const currentMonth   = MONTH_NAMES[new Date().getMonth()];
  const commonName     = plant_common_name ?? plant_species ?? 'tree';
  const addonsList     = Array.isArray(addons_purchased) && addons_purchased.length > 0
    ? addons_purchased.join(', ')
    : 'none';

  const userPrompt = `Write 3 social media posts for ${nurseryName}.

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
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system: [
        {
          type:          'text',
          text:          SYSTEM_PROMPT,
          // Stable system prompt — cached after first request per region
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw  = message.content.find(b => b.type === 'text');
    const text = raw?.type === 'text' ? raw.text.trim() : '';
    const parsed = JSON.parse(text) as { posts: Array<{ type: string; content: string }> };

    const inserts = parsed.posts.map(post => ({
      nursery_id,
      order_id,
      platform:  'instagram',
      content:   post.content,
      post_type: post.type,
      status:    'pending',
    }));

    await db.from('social_drafts').insert(inserts);

    return res.status(200).json({ ok: true, count: inserts.length });
  } catch (err: any) {
    console.error('[social/generate-posts] generation error:', err?.message ?? err);

    // Insert a single failed row so the dashboard can show it
    try {
      await db.from('social_drafts').insert({
        nursery_id,
        order_id,
        platform:  'instagram',
        content:   null,
        post_type: null,
        status:    'failed',
      });
    } catch { /* non-fatal */ }

    return res.status(200).json({ ok: false, reason: 'generation_failed' });
  }
}
