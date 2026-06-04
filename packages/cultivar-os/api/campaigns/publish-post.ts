import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY!);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { postId, businessId, editedCopy } = req.body;
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

    // Save the edit and record a tone sample — automatic learning, zero friction
    if (wasEdited) {
      await db.from('campaign_posts').update({ edited_copy: editedCopy.trim() }).eq('id', postId);
      await db.from('campaign_tone_samples').insert({
        business_id:   businessId,
        platform:      post.platform,
        original_text: post.copy_text,
        edited_text:   editedCopy.trim(),
      });
    }

    // SMS posts are noted — sending via notification pipeline is a separate step
    if (post.platform === 'sms') {
      await db.from('campaign_posts').update({
        status:       'published',
        published_at: new Date().toISOString(),
      }).eq('id', postId);
      return res.json({ ok: true, platform: 'sms', note: 'SMS marked published — send via notification pipeline' });
    }

    // Get Blotato account ID from the social media module config
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

    res.json({ ok: blatoResp.ok, postSubmissionId: blatoData.postSubmissionId ?? null });
  } catch (err: any) {
    console.error('[campaigns/publish-post]', err.message);
    res.status(500).json({ error: err.message });
  }
}
