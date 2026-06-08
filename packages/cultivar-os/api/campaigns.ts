import { createClient } from '@supabase/supabase-js';
import { generateCampaignPosts, type AdvertChannel } from '../../shared/src/campaigns/generate';

const ADVERT_DEBUG = false;

// SEAM DECLARATIONS (hidden, demand-gated, priced — do NOT activate without reading these):
//
// auto-publish seam: inert. Campaign posts use handoff model (owner copies + posts manually).
//   When activated: integrate a VETTED publisher adapter (Blotato was removed — it
//   misrepresented capability). No refactor needed to activate; wire the adapter here.
//   Gate: demand-driven + pricing decision.
//
// sms-auto-send seam: inert. SMS posts are draft text the owner copies to send.
//   When activated: on activation, opt-out/STOP/consent FOLLOWS the SMS provider's standard
//   TCPA model — ADOPT, do not rebuild. Compliance footer (10DLC/STOP/consent ledger) is
//   real work at activation time, NOT now.
//   Gate: demand-driven + pricing decision + provider selection.

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY!);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, ...body } = req.body ?? {};

  // ── ACTION: generate ─────────────────────────────────────────────────────

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

      // Read advert_channels from config — the single source of truth.
      // Generate ONLY for enabled channels. Never hardcode channel names or counts.
      const { data: mod } = await db
        .from('business_modules')
        .select('config')
        .eq('business_id', businessId)
        .eq('module_key', 'social_media')
        .maybeSingle();

      const advertChannels: AdvertChannel[] = Array.isArray(mod?.config?.advert_channels)
        ? mod!.config.advert_channels
        : [{ type: 'social', name: 'instagram', enabled: true }]; // safe default: instagram only

      if (ADVERT_DEBUG) console.log('[TRACE:advert] campaigns generate — channels:', advertChannels.filter(c => c.enabled).map(c => c.name));

      const { data: samples } = await db
        .from('campaign_tone_samples')
        .select('id, business_id, platform, original_text, edited_text, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);

      const posts = await generateCampaignPosts({
        businessName:   biz.name,
        businessType:   biz.business_type,
        advertChannels,
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
        platform:       p.channel,          // advert_channels name → campaign_posts.platform
        scheduled_date: p.scheduled_date,
        copy_text:      p.copy_text,
        image_prompt:   p.image_prompt,
        status:         'draft',
      }));

      const { error: postsErr } = await db.from('campaign_posts').insert(postRows);
      if (postsErr) throw new Error(`Posts: ${postsErr.message}`);

      if (ADVERT_DEBUG) console.log('[TRACE:advert] campaigns inserted:', posts.length, 'posts');

      return res.json({ campaignId: newCampaign!.id, postCount: posts.length });
    } catch (err: any) {
      console.error('[campaigns/generate]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── ACTION: copy-post ────────────────────────────────────────────────────
  //
  // Handoff model: owner copies text manually and posts. No auto-publish.
  // Marks the post as reviewed ('published' = owner acknowledged, NOT pushed to any service).
  // Preserves tone-learning: if owner edited the copy, saves original vs. edited pair.
  //
  // auto-publish seam is inert — see SEAM DECLARATIONS at top.

  if (action === 'copy-post') {
    const { postId, businessId, editedCopy } = body;
    if (!postId || !businessId) {
      return res.status(400).json({ error: 'postId and businessId are required' });
    }

    const db = adminDb();

    try {
      const { data: post } = await db
        .from('campaign_posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const wasEdited = editedCopy?.trim() && editedCopy.trim() !== post.copy_text;

      if (wasEdited) {
        await db.from('campaign_posts').update({ edited_copy: editedCopy.trim() }).eq('id', postId);
        // Tone learning: save original vs. edited pair for future generation
        await db.from('campaign_tone_samples').insert({
          business_id:   businessId,
          platform:      post.platform,
          original_text: post.copy_text,
          edited_text:   editedCopy.trim(),
        });
      }

      // Mark as reviewed — owner copied it, not auto-published
      await db.from('campaign_posts').update({
        status:       'published',
        published_at: new Date().toISOString(),
      }).eq('id', postId);

      if (ADVERT_DEBUG) console.log('[TRACE:advert] copy-post — postId:', postId, 'wasEdited:', wasEdited);

      return res.json({ ok: true, channel: post.platform });
    } catch (err: any) {
      console.error('[campaigns/copy-post]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'action must be "generate" or "copy-post"' });
}
