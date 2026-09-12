import { createClient } from '@supabase/supabase-js';
import { callerCan } from '../../shared/src/auth/callerPermission';
import { generateCampaignPosts, type AdvertChannel } from '../../shared/src/campaigns/generate';
import { campaignAppendPlan } from '../../shared/src/business-logic/campaignLifecycle';
import { CAMPAIGN_TERMS_COLUMNS } from '../../shared/src/business-logic/campaignFields';

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

// 🔴 CALLER AUTHORITY — MB_D-015. ADDED 2026-07-27; this endpoint had NONE.
// Both branches take `businessId` off the REQUEST BODY and write through adminDb() — the SERVICE
// KEY, which bypasses RLS entirely. Until this gate existed anyone reaching the URL could write
// campaigns, campaign_posts and business_voice_samples into ANY tenant by naming its id.
// `campaigns:update` is the authority for both: generating a campaign and editing a post's copy
// are both AUTHORING acts on the campaign surface. Owner passes via businesses.owner_id.
async function requireCampaignAuthority(req: any, res: any, businessId: string): Promise<boolean> {
  if (await callerCan(req.headers?.authorization, businessId, 'campaigns:update')) return true;
  console.log('[TRACE:AUTHORITY] campaigns REFUSED — caller lacks campaigns:update/owner', { businessId });
  res.status(403).json({ error: 'Not authorized to author campaigns for this business', code: 'FORBIDDEN' });
  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, ...body } = req.body ?? {};

  // ── ACTION: generate ─────────────────────────────────────────────────────

  if (action === 'generate') {
    const { businessId, campaign, campaignId } = body;

    // ── R-147 · APPEND ────────────────────────────────────────────────────
    // "Generate more posts for this campaign" must do that. The plan is the ONE decision, taken by
    // the shared function so the button and this endpoint cannot disagree about what it means.
    // APPEND supplies `campaignId` and NO campaign payload; CREATE supplies the payload and no id.
    const plan = campaignAppendPlan(campaignId);

    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (plan.mode === 'create' && !campaign?.name) {
      return res.status(400).json({ error: 'businessId and campaign.name are required' });
    }
    if (!(await requireCampaignAuthority(req, res, businessId))) return;

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

      // 🔴 ON APPEND THE CAMPAIGN'S OWN ROW IS THE SOURCE, NOT THE REQUEST BODY. The client asking
      // for more posts must not be able to quietly regenerate against different dates or a different
      // focus — "in the campaign she already made" (user_stories.md:1132-1133) means its terms too.
      // Scoped by business_id as well as id: an id from another tenant resolves to NOTHING rather
      // than to a wrong-tenant row (AC-3).
      let target: any = null;
      if (plan.mode === 'append') {
        const { data: row } = await db
          .from('campaigns')
          .select(CAMPAIGN_TERMS_COLUMNS)
          .eq('id', plan.campaignId)
          .eq('business_id', businessId)
          .maybeSingle();
        if (!row) return res.status(404).json({ error: 'Campaign not found', code: 'NO_CAMPAIGN' });
        target = row;
      }

      const source = plan.mode === 'append' ? target : campaign;

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
        .from('business_voice_samples')
        .select('id, business_id, platform, original_text, edited_text, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);

      const posts = await generateCampaignPosts({
        businessName:   biz.name,
        businessType:   biz.business_type,
        advertChannels,
        campaign: {
          name:            source.name,
          campaign_type:   source.campaign_type   ?? 'seasonal',
          start_date:      source.start_date       ?? null,
          end_date:        source.end_date         ?? null,
          target_category: source.target_category  ?? null,
          description:     source.description      ?? null,
        },
        toneSamples: samples ?? [],
        apiKey,
      });

      // 🔴 THE DEFECT, IN ONE LINE: this INSERT used to run unconditionally, so the append path
      // minted a SECOND campaign and the caller navigated onto it. It is now reached only when the
      // plan says CREATE.
      let targetId: string;
      if (plan.mode === 'append') {
        targetId = plan.campaignId!;
      } else {
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
        targetId = newCampaign!.id;
      }

      const postRows = posts.map(p => ({
        campaign_id:    targetId,
        business_id:    businessId,
        platform:       p.channel,          // advert_channels name → campaign_posts.platform
        scheduled_date: p.scheduled_date,
        copy_text:      p.copy_text,
        image_prompt:   p.image_prompt,
        status:         'draft',
      }));

      const { error: postsErr } = await db.from('campaign_posts').insert(postRows);
      if (postsErr) throw new Error(`Posts: ${postsErr.message}`);

      // STD-003 — ON by default, not behind ADVERT_DEBUG. The mode is the thing a reader of this
      // trail needs: an append that silently created would be invisible without it.
      console.log('[TRACE:CAMPAIGN] generate', { mode: plan.mode, campaignId: targetId, postCount: posts.length });

      return res.json({ campaignId: targetId, postCount: posts.length, mode: plan.mode });
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
    if (!(await requireCampaignAuthority(req, res, businessId))) return;

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
        await db.from('business_voice_samples').insert({
          business_id:   businessId,
          platform:      post.platform,
          original_text: post.copy_text,
          edited_text:   editedCopy.trim(),
          source:        'campaign_generate',
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
