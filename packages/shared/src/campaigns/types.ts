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
  platform: 'instagram' | 'facebook' | 'sms' | 'email';
  scheduled_date: string | null;
  copy_text: string;
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
