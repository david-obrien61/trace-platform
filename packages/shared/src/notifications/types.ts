// ─────────────────────────────────────────────────────────────────────────────
// TRACE Notifications — Shared Types
// Used by every vertical. No vertical-specific logic lives here.
// ─────────────────────────────────────────────────────────────────────────────

export type TraceVertical = 'cultivar' | 'ignition' | 'assessment' | 'conduit';

export type NotificationType =
  | 'transactional'   // invoices, confirmations — always send, no opt-in needed
  | 'nurture'         // post-purchase sequences — requires email opt-in
  | 'promotional'     // owner-triggered campaigns — requires explicit opt-in
  | 'reminder'        // appointment/deadline reminders — always send if scheduled
  | 'status';         // status updates (RO ready, delivery en route) — always send

export type NotificationChannel = 'email' | 'sms' | 'both';

// ── Sending business identity ───────────────────────────────────────────────────
// The ACTIVE business whose name/contact a customer-facing notification renders. Threaded as a
// per-render DATA token (never a hardcoded literal — AC-1) so a shared template renders the true
// tenant, resolved from the business_id-scoped context (BusinessProvider). OMIT-NOT-FAKE (D-9):
// any field left unset is rendered as NOTHING, never a placeholder or a different business's value.
export interface NotifyBusiness {
  name:     string;
  address?: string | null;
  phone?:   string | null;
  email?:   string | null;
}

// ── Recipient ─────────────────────────────────────────────────────────────────

export interface NotificationRecipient {
  email?:      string;
  phone?:      string;    // E.164 preferred: +15125550100
  name?:       string;
  smsOptIn?:   boolean;   // TCPA: required for promotional SMS
  emailOptIn?: boolean;   // required for promotional email
}

// ── Payload — what callers pass in ───────────────────────────────────────────

export interface NotificationPayload {
  vertical:   TraceVertical;
  templateId: string;
  to:         NotificationRecipient;
  data:       Record<string, unknown>;
  channel?:   NotificationChannel;    // overrides template default if provided
  entityId?:  string;                 // orderId, roId, etc. — for logging
  tenantId?:  string;                 // nurseryId, shopId, etc. — for logging
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface NotificationResult {
  success:  boolean;
  channel:  NotificationChannel | 'none';
  emailId?: string;
  smsId?:   string;
  error?:   string;
  skipped?: string;   // reason if skipped (e.g. "sms_not_opted_in")
  demo:     boolean;  // true when running without API keys
}

// ── Template definition ───────────────────────────────────────────────────────

export type TemplateRenderer<T extends Record<string, unknown> = Record<string, unknown>> =
  (data: T) => string;

export interface TemplateDef<T extends Record<string, unknown> = Record<string, unknown>> {
  id:       string;
  vertical: TraceVertical;
  channel:  NotificationChannel;
  type:     NotificationType;
  subject?: string | TemplateRenderer<T>;
  html?:    TemplateRenderer<T>;  // email body HTML (inside base wrapper)
  text:     TemplateRenderer<T>;  // SMS body OR email plain-text fallback
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export interface QueuedNotification {
  id:            string;
  payload:       NotificationPayload;
  attempts:      number;
  maxAttempts:   number;
  nextAttemptAt: number;     // unix timestamp ms
  result?:       NotificationResult;
  createdAt:     number;
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export interface CampaignPayload {
  vertical:    TraceVertical;
  templateId:  string;
  recipients:  NotificationRecipient[];
  data:        Record<string, unknown>;  // shared across all recipients
  throttleMs?: number;                  // delay between sends, default 100ms
}

export interface CampaignResult {
  total:   number;
  sent:    number;
  failed:  number;
  skipped: number;   // TCPA non-compliant
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface NotificationConfig {
  resendApiKey?:  string;
  fromEmail?:     string;    // e.g. "noreply@cultivar-os.app"
  fromName?:      string;    // e.g. "LAWNS Tree Farm"
  twilioSid?:     string;
  twilioToken?:   string;
  twilioFrom?:    string;    // Twilio phone number E.164
  demoMode?:      boolean;   // force demo mode even if keys are set
}
