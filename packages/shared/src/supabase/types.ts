// Shared Supabase row types — tables that exist in every vertical's schema.
// Vertical-specific row types live in packages/<vertical>/src/types/.

// ── shared tables ─────────────────────────────────────────────────────────────

export interface NotificationLog {
  id:            string;
  tenant_id:     string;
  vertical:      string;
  template_id:   string;
  channel:       'sms' | 'email';
  recipient:     string;
  status:        'queued' | 'sent' | 'failed';
  provider_id:   string | null;
  error_message: string | null;
  sent_at:       string | null;
  created_at:    string;
}

export interface SubscriptionTier {
  id:           string;
  tenant_id:    string;
  vertical:     string;
  tier:         'TRIAL' | 'STARTER' | 'PROFESSIONAL' | 'PREMIER';
  trial_started_at: string | null;
  subscribed_at:    string | null;
  stripe_customer_id:      string | null;
  stripe_subscription_id:  string | null;
  monthly_amount:  number | null;
  created_at:      string;
  updated_at:      string;
}

export interface GrowthGoal {
  id:           string;
  tenant_id:    string;
  vertical:     string;
  category:     string;
  status:       'intended' | 'in_progress' | 'active';
  vendor_id:    string | null;
  created_at:   string;
  activated_at: string | null;
}

export interface Vendor {
  id:            string;
  tenant_id:     string;
  name:          string;
  contact_name:  string | null;
  phone:         string | null;
  email:         string | null;
  categories:    string[];
  payment_terms: string | null;
  notes:         string | null;
  created_at:    string;
}

export interface AIUsageLog {
  id:           string;
  tenant_id:    string;
  vertical:     string;
  task_type:    string;
  provider:     'claude' | 'gemini' | 'whisper' | 'openai';
  input_tokens:  number;
  output_tokens: number;
  cost_usd:      number;
  latency_ms:    number | null;
  created_at:    string;
}

// ── utility types ─────────────────────────────────────────────────────────────

export type UUID = string;

export type VerticalId =
  | 'ignition-os'
  | 'cultivar-os'
  | 'conduit-os'
  | 'pantry-os'
  | 'coolrunnings';

export type SubscriptionTierName = 'TRIAL' | 'STARTER' | 'PROFESSIONAL' | 'PREMIER';

// Generic paginated response for Supabase list queries
export interface PagedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

// Standard error shape returned from shared async operations
export interface TraceError {
  code:    string;
  message: string;
  context?: Record<string, unknown>;
}
