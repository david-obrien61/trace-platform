import { createClient } from '@supabase/supabase-js';
import { generateCampaignPosts } from '../../shared/src/campaigns/generate';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY!);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, ...body } = req.body ?? {};

  if (action === 'generate') {
    const { businessId, campaign } = body;
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

      return res.json({ campaignId: newCampaign!.id, postCount: posts.length });
    } catch (err: any) {
      console.error('[campaigns/generate]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'publish-post') {
    const { postId, businessId, editedCopy } = body;
    if (!postId || !businessId) {
      return res.status(400).json({ error: 'postId and businessId are required' });
    }

    const blatoKey = process.env.BLOTATO_API_KEY;
    if (!blatoKey) return res.status(503).json({ error: 'Social publishing unavailable' });

    const db = adminDb();

    try {
      const { data: post } = await db
        .from('campaign_posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const finalCopy = editedCopy?.trim() || post.copy_text;
      const wasEdited  = editedCopy?.trim() && editedCopy.trim() !== post.copy_text;

      if (wasEdited) {
        await db.from('campaign_posts').update({ edited_copy: editedCopy.trim() }).eq('id', postId);
        await db.from('campaign_tone_samples').insert({
          business_id:   businessId,
          platform:      post.platform,
          original_text: post.copy_text,
          edited_text:   editedCopy.trim(),
        });
      }

      if (post.platform === 'sms') {
        await db.from('campaign_posts').update({
          status:       'published',
          published_at: new Date().toISOString(),
        }).eq('id', postId);
        return res.json({ ok: true, platform: 'sms', note: 'SMS marked published — send via notification pipeline' });
      }

      const { data: mod } = await db
        .from('business_modules')
        .select('config')
        .eq('business_id', businessId)
        .eq('module_key', 'social_media')
        .single();

      const accountId = mod?.config?.blotato_account_id;
      if (!accountId) {
        return res.status(400).json({
          error: 'Social media not configured — add your Blotato account ID in Settings → Social Media',
        });
      }

      const blatoResp = await fetch('https://backend.blotato.com/v2/posts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'blotato-api-key': blatoKey },
        body: JSON.stringify({
          post: {
            accountId,
            content: { text: finalCopy, mediaUrls: [], platform: post.platform },
            target:  { targetType: post.platform },
          },
        }),
      });

      const blatoData = blatoResp.headers.get('content-type')?.includes('json')
        ? await blatoResp.json()
        : {};

      await db.from('campaign_posts').update({
        status:             blatoResp.ok ? 'published' : 'failed',
        published_at:       blatoResp.ok ? new Date().toISOString() : null,
        post_submission_id: blatoData.postSubmissionId ?? null,
      }).eq('id', postId);

      return res.json({ ok: blatoResp.ok, postSubmissionId: blatoData.postSubmissionId ?? null });
    } catch (err: any) {
      console.error('[campaigns/publish-post]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'action must be "generate" or "publish-post"' });
}
