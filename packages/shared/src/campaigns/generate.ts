import { executeCapability } from '../ai/execute';
import type { CampaignToneSample } from './types';

const ADVERT_DEBUG = false;

export interface AdvertChannel {
  type:    string;   // 'social' | 'sms' | 'email' — from channels.kind, drives post count only
  name:    string;   // a `channels.name`; the vocabulary lives in the table, never in this comment
  enabled: boolean;
  /**
   * From `channels.guidance`. Optional because the tenant's own config carries no guidance — the
   * endpoint joins it on by name. A channel without it falls back to DEFAULT_CHANNEL_GUIDANCE, which
   * is what lets a new channel be a row.
   */
  guidance?: string | null;
}

interface PostDraft {
  channel:        string;   // channel name — drives platform col in campaign_posts
  scheduled_date: string | null;
  copy_text:      string;
  /**
   * Email only. NULL for every channel whose post is a caption — the model is told to omit it, and
   * the mapper below coerces an empty string to NULL so an absent subject never reaches the database
   * as a present-but-blank one (A9).
   */
  subject:        string | null;
  image_prompt:   string | null;
}

// ANTI-FABRICATION (story: "Truth in advertising — suggest facts, never censor, keep the record",
// user_stories.md § NEEDED). TRACE NEVER ORIGINATES AN UNVERIFIED FACTUAL CLAIM. The second sentence
// below is not a bolt-on — it reconciles the word "specific" in the first, which is what invited the
// invention: asking for specific copy while supplying no facts to be specific about is an instruction
// to make some up. Placed in the SYSTEM prompt because it governs BOTH prompts in this call (system +
// the user prompt built in generateCampaignPosts, which repeats "warm, local, specific").
// ⚠️ NOT PROVABLE BY `npm run verify` — no probe can assert that a model stopped inventing numbers.
// The proof is David generating a week of posts with no factual context and reading every line
// (owner-test card, social-campaign board). A test asserting this string exists would assert a
// CONFIGURATION and call it covered, which is STD-025's exact shape — deliberately not written.
const SYSTEM_PROMPT = 'You write content for owner-operated small businesses. Posts are warm, local, specific, and authentic — never corporate, never generic. They always sound like the owner wrote them personally, not a marketing department. Specific means grounded in the facts you were given, never invented: no statistic, percentage, dollar figure, date, award, certification or comparative claim unless it appears in the supplied data. If a number would strengthen a post and you do not have one, write the sentence without it — a fabricated figure publishes under the name of the business, and the owner carries the liability.';

// 🔴 `CHANNEL_GUIDANCE` WAS HERE AND IS DELETED (ledger #310, R-152). It was a hardcoded map keyed
// by channel name, and the moment `public.channels` gained a `guidance` column it would have become a
// SECOND copy of the same fact — replacing four copies of the list with three copies plus a new copy
// of the guidance is not a fix. Guidance now arrives ON the channel, read from the table by the
// endpoint that already reads the tenant's config.
//
// The DEFAULT stays, and it is what makes a new channel a ROW rather than a code change: a channel
// seeded with NULL guidance still generates, it simply generates generically.
const DEFAULT_CHANNEL_GUIDANCE = 'Short, warm, and authentic. One clear message.';

/**
 * Channel kinds that get ONE message per campaign rather than a run of posts. An SMS blast and an
 * email are single sends; a feed is a cadence. Stated as a LIST because `=== 'sms'` was the old test
 * and adding email would have silently given it three posts.
 */
const ONE_PER_CAMPAIGN_KINDS: readonly string[] = ['sms', 'email'];

function postsPerChannel(advertChannels: AdvertChannel[], campaignDays: number): number {
  // Derive count from campaign length — not hardcoded.
  // A week-long campaign = 1–2 posts per channel. Longer windows get more.
  const weeks = Math.max(1, Math.ceil(campaignDays / 7));
  return Math.min(weeks, 3); // cap at 3 per channel to avoid bloat
}

/**
 * The per-channel lines the model is given.
 *
 * 🔴 IT PRINTS `ch.name`, AND THAT IS THE WHOLE FIX (R-150 is unrelated; this is ledger #310).
 * It used to emit `- ${count} × ${guidance}` — the NAME was used to look up the guidance and never
 * shown. So the only channel identifiers in the entire prompt were the display labels inside the
 * guidance text (`(Instagram)`, `(TikTok)`, `(Twitter/X)`), and the JSON spec then said *"channel
 * name from the list above"*. The model answered with the only names it could see: `TikTok`,
 * `Twitter/X`, `Instagram`. None of those equals a seeded `channels.name`, so the write was refused
 * — by the CHECK before #310, by the FK after it. **The values were never wrong; they were never
 * asked for.** Live since 2026-06-08.
 *
 * ⚠️ A channel with no guidance (email, before the table carried one) fell to the default text,
 * which contains no identifier at all — so for that channel the model had nothing to echo and
 * invented something. Printing the name fixes that case by construction too.
 */
export function buildChannelInstructions(
  enabledChannels: AdvertChannel[], countPerSocialChannel: number,
): string {
  return enabledChannels.map(ch => {
    // Guidance comes off the CHANNEL (sourced from the table). No map in this file to drift.
    const guidance = ch.guidance?.trim() || DEFAULT_CHANNEL_GUIDANCE;
    // A one-to-one channel (sms, email) gets ONE message; a feed gets several.
    const count = ONE_PER_CAMPAIGN_KINDS.includes(ch.type) ? 1 : countPerSocialChannel;
    return `- ${count} × [${ch.name}] ${guidance}`;
  }).join('\n');
}

/** What the model returned for `channel`, once it has been checked against what was offered. */
export type ChannelResolution =
  | { ok: true;  name: string; source: 'model' | 'fallback' }
  | { ok: false; value: string };

/**
 * Resolve one post's channel against the channels that were actually offered.
 *
 * 🔴 THE FALLBACK STAYS A FALLBACK. It fires ONLY when the model omitted the field — which is the
 * one case where there is nothing to disagree with. Before this, `p.channel ?? p.platform ?? first
 * ?? 'instagram'` meant a PRESENT-BUT-WRONG value passed straight through to the database, and the
 * chain produced a valid name only by accident: it reached `enabledChannels[0].name` exactly when
 * the model FAILED to answer. So the write succeeded when the model misbehaved and was refused when
 * it obeyed. A value that is present and unrecognised is now REFUSED and NAMED — never quietly
 * replaced with `instagram`, which would put a post on a channel the owner did not choose and then
 * publish under their name (David's instruction, 2026-09-12).
 */
export function resolvePostChannel(raw: unknown, enabledChannels: AdvertChannel[]): ChannelResolution {
  const offered = enabledChannels.map(c => c.name);
  const given = typeof raw === 'string' ? raw.trim() : '';

  // Absent or blank: nothing was claimed, so the fallback is an inference and not an override.
  if (given === '') {
    const first = offered[0];
    return first ? { ok: true, name: first, source: 'fallback' } : { ok: false, value: '' };
  }
  // Exact match on what was offered. No case-folding and no aliasing: `channels.name` is the
  // vocabulary, and quietly accepting `TikTok` for `tiktok` would re-create the drift the lookup
  // table exists to end — the prompt now asks for the exact string, so a mismatch is a real signal.
  if (offered.includes(given)) return { ok: true, name: given, source: 'model' };
  return { ok: false, value: given };
}

/** A post the model returned on a channel that was never offered. Surfaced, never substituted. */
export interface ChannelRefusal { value: string; offered: string[] }

export interface GeneratedCampaign {
  posts: PostDraft[];
  /** Empty on a clean run. Non-empty means the model named channels nobody offered it. */
  refusals: ChannelRefusal[];
}

export async function generateCampaignPosts(params: {
  businessName:   string;
  businessType:   string;
  advertChannels: AdvertChannel[];
  campaign: {
    name:            string;
    campaign_type:   string;
    start_date:      string | null;
    end_date:        string | null;
    target_category: string | null;
    description:     string | null;
  };
  toneSamples: CampaignToneSample[];
  apiKey:       string;
}): Promise<GeneratedCampaign> {
  const enabledChannels = params.advertChannels.filter(c => c.enabled);

  if (enabledChannels.length === 0) return { posts: [], refusals: [] };

  if (ADVERT_DEBUG) console.log('[TRACE:advert] generateCampaignPosts — channels:', enabledChannels.map(c => c.name));

  const dateRange = params.campaign.start_date && params.campaign.end_date
    ? `${params.campaign.start_date} to ${params.campaign.end_date}`
    : 'upcoming';

  // Campaign duration for count derivation
  let campaignDays = 7; // default: one week
  if (params.campaign.start_date && params.campaign.end_date) {
    const msPerDay = 24 * 60 * 60 * 1000;
    campaignDays = Math.max(1,
      Math.round((new Date(params.campaign.end_date).getTime() - new Date(params.campaign.start_date).getTime()) / msPerDay),
    );
  }

  const countPerSocialChannel = postsPerChannel(enabledChannels, campaignDays);

  // Tone block — learned from prior edited posts
  const toneBlock = params.toneSamples.length > 0
    ? `\n\nLearn from this business's editing style — original AI draft vs. what they actually posted:\n${
        params.toneSamples.slice(0, 3).map((s, i) =>
          `Example ${i + 1} (${s.platform}):\nAI wrote: "${s.original_text}"\nThey changed it to: "${s.edited_text}"`
        ).join('\n\n')
      }\n\nMatch this tone and style in every post you write.`
    : '';

  const channelInstructions = buildChannelInstructions(enabledChannels, countPerSocialChannel);

  // The allowed values, spelled out in the spec itself rather than left to be inferred from prose.
  const offeredList = enabledChannels.map(c => c.name).join(' | ');

  const totalPosts = enabledChannels.reduce(
    (sum, ch) => sum + (ONE_PER_CAMPAIGN_KINDS.includes(ch.type) ? 1 : countPerSocialChannel), 0);

  const userPrompt = `Generate social content for a campaign at ${params.businessName}, a ${params.businessType} business.

Campaign: ${params.campaign.name}
Type: ${params.campaign.campaign_type}
Date range: ${dateRange}
${params.campaign.target_category ? `Product focus: ${params.campaign.target_category}` : ''}
${params.campaign.description ? `Context: ${params.campaign.description}` : ''}
${toneBlock}

Write ${totalPosts} posts spread across the campaign window:
${channelInstructions}

Each post must sound like the owner wrote it — warm, local, specific. Not a marketing agency. Not generic.

Return a JSON array of exactly ${totalPosts} objects:
[
  {
    "channel": "EXACTLY one of these, copied character for character: ${offeredList}",
    "scheduled_date": "YYYY-MM-DD or null",
    "subject": "email ONLY — the subject line. Empty string for every other channel.",
    "copy_text": "full post text ready to copy and paste",
    "image_prompt": "what to photograph for this post (empty string for sms and email)"
  }
]
An EMAIL is a subject line and a body. The owner copies both and sends it themselves from their own
mail — you are drafting, not sending. Write the subject as a real subject: concrete, under 60
characters, no all-caps, no exclamation marks.
Return only valid JSON. No markdown fences. No explanation.`;

  if (ADVERT_DEBUG) console.log('[TRACE:advert] prompt channels:', enabledChannels.map(c => c.name), 'total:', totalPosts);

  const raw = await executeCapability('campaign_generate', {
    system: SYSTEM_PROMPT,
    user:   userPrompt,
    apiKey: params.apiKey,
  });

  // Every returned row is checked against what was OFFERED before it becomes a post. A row naming a
  // channel nobody offered is dropped and reported — not coerced onto `instagram`.
  const posts: PostDraft[] = [];
  const refusals: ChannelRefusal[] = [];
  const offered = enabledChannels.map(c => c.name);

  for (const p of (raw as any[])) {
    const resolved = resolvePostChannel(p?.channel ?? p?.platform, enabledChannels);
    if (!resolved.ok) {
      refusals.push({ value: resolved.value, offered });
      continue;
    }
    posts.push({
      channel:        resolved.name,
      scheduled_date: p.scheduled_date ?? null,
      copy_text:      p.copy_text      ?? '',
      // `|| null` not `?? null`: the model is told to send '' for a non-email channel, and an empty
      // subject must land as NULL rather than as a blank value a reader would take for a real one.
      subject:        (typeof p.subject === 'string' ? p.subject.trim() : '') || null,
      image_prompt:   p.image_prompt   || null,
    });
  }

  // 🔴 ON BY DEFAULT (STD-003), and it names the VALUE — a refusal that does not say what came
  // back leaves the next reader exactly where this defect left everyone for three months.
  if (refusals.length > 0) {
    console.warn('[TRACE:advert] channel REFUSED — the model named channels that were not offered',
      { refused: refusals.map(r => r.value), offered });
  }

  return { posts, refusals };
}
