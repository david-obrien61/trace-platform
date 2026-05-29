import Anthropic from '@anthropic-ai/sdk';
import type { CampaignToneSample } from './types';

interface PostDraft {
  platform: 'instagram' | 'facebook' | 'sms' | 'email';
  scheduled_date: string | null;
  copy_text: string;
  image_prompt: string | null;
}

export async function generateCampaignPosts(params: {
  businessName: string;
  vertical: string;
  campaign: {
    name: string;
    campaign_type: string;
    start_date: string | null;
    end_date: string | null;
    target_category: string | null;
    description: string | null;
  };
  toneSamples: CampaignToneSample[];
  apiKey: string;
}): Promise<PostDraft[]> {
  const anthropic = new Anthropic({ apiKey: params.apiKey });

  const dateRange = params.campaign.start_date && params.campaign.end_date
    ? `${params.campaign.start_date} to ${params.campaign.end_date}`
    : 'upcoming';

  const toneBlock = params.toneSamples.length > 0
    ? `\n\nLearn from this business's editing style — original AI draft vs. what they actually posted:\n${
        params.toneSamples.slice(0, 3).map((s, i) =>
          `Example ${i + 1} (${s.platform}):\nAI wrote: "${s.original_text}"\nThey changed it to: "${s.edited_text}"`
        ).join('\n\n')
      }\n\nMatch this tone and style in every post you write.`
    : '';

  const prompt = `Generate social media content for a campaign at ${params.businessName}, a ${params.vertical} business.

Campaign: ${params.campaign.name}
Type: ${params.campaign.campaign_type}
Date range: ${dateRange}
${params.campaign.target_category ? `Product focus: ${params.campaign.target_category}` : ''}
${params.campaign.description ? `Context: ${params.campaign.description}` : ''}
${toneBlock}

Write 5 posts spread across the campaign window:
- 2 Instagram posts (visual, short paragraphs, 3–5 hashtags relevant to the business and season)
- 2 Facebook posts (slightly longer, community-focused, conversational — no hashtags needed)
- 1 SMS (under 160 characters, direct, one clear call to action, includes the business name)

Each post must sound like the owner wrote it — warm, local, specific. Not a marketing agency. Not generic.
Reference the actual season, the actual location (Leander TX), and what makes this campaign real.

Return a JSON array of exactly 5 objects:
[
  {
    "platform": "instagram" | "facebook" | "sms",
    "scheduled_date": "YYYY-MM-DD",
    "copy_text": "full post text ready to copy and paste",
    "image_prompt": "what to photograph for this post (empty string for sms)"
  }
]
Return only valid JSON. No markdown fences. No explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: 'You write social media content for owner-operated small businesses. Posts are warm, local, specific, and authentic — never corporate, never generic. They always sound like the owner wrote them personally, not a marketing department.',
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as any).text?.trim() ?? '[]';
  const stripped = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  let posts: any[];
  try {
    posts = JSON.parse(stripped);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Campaign generation returned unparseable JSON');
    posts = JSON.parse(match[0]);
  }

  return posts.map((p: any) => ({
    platform: p.platform ?? 'instagram',
    scheduled_date: p.scheduled_date ?? null,
    copy_text: p.copy_text ?? '',
    image_prompt: p.image_prompt || null,
  }));
}
