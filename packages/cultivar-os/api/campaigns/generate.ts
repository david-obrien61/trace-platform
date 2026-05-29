import { createClient } from '@supabase/supabase-js';
import { generateCampaignPosts } from '../../../shared/src/campaigns/generate';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY!);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessId, campaign } = req.body;
  if (!businessId || !campaign?.name) {
    return res.status(400).json({ error: 'businessId and campaign.name are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI unavailable' });

  const db = adminDb();

  try {
    const { data: biz } = await db
      .from('businesses')
      .select('name, business_type')
      .eq('id', businessId)
      .single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const { data: samples } = await db
      .from('campaign_tone_samples')
      .select('id, business_id, platform, original_text, edited_text, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(5);

    const posts = await generateCampaignPosts({
      businessName: biz.name,
      vertical: biz.business_type,
      campaign: {
        name:            campaign.name,
        campaign_type:   campaign.campaign_type   ?? 'seasonal',
        start_date:      campaign.start_date       ?? null,
        end_date:        campaign.end_date         ?? null,
        target_category: campaign.target_category  ?? null,
        description:     campaign.description      ?? null,
      },
      toneSamples: samples ?? [],
      apiKey,
    });

    const { data: newCampaign, error: campErr } = await db
      .from('campaigns')
      .insert({
        business_id:     businessId,
        name:            campaign.name,
        campaign_type:   campaign.campaign_type   ?? 'seasonal',
        start_date:      campaign.start_date       ?? null,
        end_date:        campaign.end_date         ?? null,
        target_category: campaign.target_category  ?? null,
        description:     campaign.description      ?? null,
        status:          'active',
      })
      .select('id')
      .single();
    if (campErr) throw new Error(`Campaign: ${campErr.message}`);

    const postRows = posts.map(p => ({
      campaign_id:    newCampaign!.id,
      business_id:    businessId,
      platform:       p.platform,
      scheduled_date: p.scheduled_date,
      copy_text:      p.copy_text,
      image_prompt:   p.image_prompt,
      status:         'draft',
    }));

    const { error: postsErr } = await db.from('campaign_posts').insert(postRows);
    if (postsErr) throw new Error(`Posts: ${postsErr.message}`);

    res.json({ campaignId: newCampaign!.id, postCount: posts.length });
  } catch (err: any) {
    console.error('[campaigns/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
}
