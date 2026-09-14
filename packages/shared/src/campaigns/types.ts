import type { ChannelName } from '../business-logic/channelVocabulary';

export interface Campaign {
  id: string;
  business_id: string;
  name: string;
  campaign_type: 'seasonal' | 'holiday' | 'clearance' | 'product_launch' | 'custom';
  start_date: string | null;
  end_date: string | null;
  target_category: string | null;
  description: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface CampaignPost {
  id: string;
  campaign_id: string;
  business_id: string;
  // 🔴 WAS a hand-typed union holding the PRE-8-JUNE list ('instagram'|'facebook'|'sms'|'email'),
  // which rejected `tiktok` at COMPILE time as well as at write time — the fourth copy of one
  // vocabulary, and the one nothing could grep for. Now derived from the single TS list, which a
  // test binds to the migration's seed in both directions (ledger #310, R-152).
  platform: ChannelName;
  scheduled_date: string | null;
  copy_text: string;
  // Email is a subject line and a body; every other channel's post is a caption and carries
  // NULL here (A9 — absent must not render as present). Ledger #310, R-152 ①.
  subject: string | null;
  image_prompt: string | null;
  edited_copy: string | null;
  status: 'draft' | 'reviewed' | 'scheduled' | 'published' | 'failed';
  published_at: string | null;
  post_submission_id: string | null;
  created_at: string;
}

export interface CampaignToneSample {
  id: string;
  business_id: string;
  platform: string;
  original_text: string;
  edited_text: string;
  created_at: string;
}
