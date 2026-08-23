import { executeCapability } from '../ai/execute';
import type { CampaignToneSample } from './types';

const ADVERT_DEBUG = false;

export interface AdvertChannel {
  type:    string;   // 'social' | 'sms'
  name:    string;   // e.g. 'instagram', 'facebook', 'tiktok', 'twitter', 'sms'
  enabled: boolean;
}

interface PostDraft {
  channel:        string;   // channel name — drives platform col in campaign_posts
  scheduled_date: string | null;
  copy_text:      string;
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

// Per-channel formatting guidance injected into the prompt.
// Keys match the channel names in advert_channels.
// New channels: add an entry here — no code branching needed.
const CHANNEL_GUIDANCE: Record<string, string> = {
  instagram: '(Instagram) Visual and upbeat. Under 220 characters. 3–5 relevant hashtags at end.',
  facebook:  '(Facebook) 50–120 words. Warm and conversational. 2–3 hashtags max. More storytelling.',
  tiktok:    '(TikTok) Under 150 characters. Punchy and energetic. 3–5 hashtags.',
  twitter:   '(Twitter/X) Under 260 characters. Brief and direct. 2–3 hashtags.',
  sms:       '(SMS) Under 160 characters. Direct, one clear call to action. Include the business name. No hashtags.',
};

const DEFAULT_CHANNEL_GUIDANCE = 'Short, warm, and authentic. One clear message.';

function postsPerChannel(advertChannels: AdvertChannel[], campaignDays: number): number {
  // Derive count from campaign length — not hardcoded.
  // A week-long campaign = 1–2 posts per channel. Longer windows get more.
  const weeks = Math.max(1, Math.ceil(campaignDays / 7));
  return Math.min(weeks, 3); // cap at 3 per channel to avoid bloat
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
}): Promise<PostDraft[]> {
  const enabledChannels = params.advertChannels.filter(c => c.enabled);

  if (enabledChannels.length === 0) return [];

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

  // Build per-channel instructions from enabled channels — no vertical nouns, no hardcoded names
  const channelInstructions = enabledChannels.map(ch => {
    const guidance = CHANNEL_GUIDANCE[ch.name] ?? DEFAULT_CHANNEL_GUIDANCE;
    const count = ch.type === 'sms' ? 1 : countPerSocialChannel;
    return `- ${count} × ${guidance}`;
  }).join('\n');

  const totalPosts = enabledChannels.reduce((sum, ch) => sum + (ch.type === 'sms' ? 1 : countPerSocialChannel), 0);

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
    "channel": "<channel name from the list above>",
    "scheduled_date": "YYYY-MM-DD or null",
    "copy_text": "full post text ready to copy and paste",
    "image_prompt": "what to photograph for this post (empty string for sms)"
  }
]
Return only valid JSON. No markdown fences. No explanation.`;

  if (ADVERT_DEBUG) console.log('[TRACE:advert] prompt channels:', enabledChannels.map(c => c.name), 'total:', totalPosts);

  const raw = await executeCapability('campaign_generate', {
    system: SYSTEM_PROMPT,
    user:   userPrompt,
    apiKey: params.apiKey,
  });

  return (raw as any[]).map((p: any) => ({
    channel:        p.channel        ?? p.platform   ?? enabledChannels[0]?.name ?? 'instagram',
    scheduled_date: p.scheduled_date ?? null,
    copy_text:      p.copy_text      ?? '',
    image_prompt:   p.image_prompt   || null,
  }));
}
