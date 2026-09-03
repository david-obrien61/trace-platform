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

// 🔴 THE `Vendor` INTERFACE THAT STOOD HERE WAS REMOVED 2026-09-02, AND WHAT IT WAS IS WORTH ONE
// PARAGRAPH BECAUSE THE SHAPE RECURS. It declared a `vendors` table with
// `{ id, tenant_id, name, contact_name, phone, email, categories, payment_terms, notes, created_at }`
// and THE TABLE DID NOT EXIST: 116 migrations swept, zero `create table … vendor`, zero
// `.from('vendors')` in any source file, and `tenant_id` — the pre-`business_id` generation naming —
// appears in ZERO migrations. Nothing imported it (three repo-wide hits for the string `Vendor`;
// the other two were the words "You Paid Vendor" and "Vendor / Store" in JSX labels), so removing
// it broke nothing.
//
// ✏️ THE COST OF LEAVING IT WAS NOT CLUTTER, IT WAS A CONFIDENT WRONG ANSWER. Anyone reading this
// file to settle "do we have vendors?" got YES. That is the same class as the inventory doc that
// said a function slot was free when the count was 12 of 12 — a stale declaration is worse than a
// missing one, because it is the one that gets believed. The real table arrived the same day, in
// 20260902_vendor_identity_and_preference.sql, `business_id`-scoped and under RLS.
//
// 🔴 AND MEASURING IT FOUND THREE MORE — THE FILE IS NOT ONE STALE TYPE, IT IS A PATTERN.
// Probed live 2026-09-02 against a negative control (a table name that cannot exist, to prove
// ABSENT was distinguishable from a broken read) plus `receipts` as a positive control:
//     vendors ABSENT · vendor_aliases ABSENT · growth_goals ABSENT ·
//     notification_log ABSENT · ai_usage_log ABSENT · receipts EXISTS
// So `GrowthGoal`, `NotificationLog` and `AIUsageLog` are phantoms of exactly the same kind as
// `Vendor` was — all four carry `tenant_id`, none has a migration, none is imported anywhere.
//
// ⚠️ ONLY `Vendor` IS REMOVED HERE, because only `Vendor` is this build's business. The other
// three are FLAGGED, not swept: deleting types unrelated to vendors inside a vendor build is the
// scope creep that makes a diff unreviewable, and the file header still calls these "tables that
// exist in every vertical's schema", which is a claim someone should correct deliberately.
//
// ✏️ Worth recording HOW this was found, because the first attempt lied in the reassuring
// direction: the probe reported `vendors` as EXISTING while its own migration sat unapplied.
// That was impossible, so the probe was wrong rather than the database — it was reading `count`
// from a HEAD request that returns null, and null was being read as success. A negative control
// turned it from a table of fiction into the measurement above.

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
