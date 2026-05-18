// ─────────────────────────────────────────────────────────────────────────────
// TRACE Notifications — Core Delivery Engine
//
// DESIGN CONTRACT:
// • Never throws. All errors are caught, logged, and returned in the result.
// • Demo mode: if API keys are absent, logs the notification and returns success.
// • TCPA: promotional SMS is blocked when recipient.smsOptIn !== true.
// • Promotional email is blocked when recipient.emailOptIn !== true.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  NotificationPayload,
  NotificationResult,
  NotificationConfig,
  NotificationChannel,
} from './types';
import { getTemplate } from './templates/index';

// ── TCPA compliance check ─────────────────────────────────────────────────────

function canSendSms(
  type: string,
  smsOptIn: boolean | undefined,
): { allowed: boolean; reason?: string } {
  if (type === 'transactional' || type === 'reminder') return { allowed: true };
  if (type === 'status') return { allowed: true };
  if (!smsOptIn) return { allowed: false, reason: 'sms_not_opted_in' };
  return { allowed: true };
}

function canSendEmail(
  type: string,
  emailOptIn: boolean | undefined,
): { allowed: boolean; reason?: string } {
  if (type === 'transactional' || type === 'reminder' || type === 'status') {
    return { allowed: true };
  }
  if (type === 'promotional' && !emailOptIn) {
    return { allowed: false, reason: 'email_not_opted_in' };
  }
  return { allowed: true };
}

// ── Resend email (REST API — no SDK dependency) ───────────────────────────────

async function sendEmail(opts: {
  apiKey: string;
  from:   string;
  to:     string;
  subject: string;
  html:   string;
  text:   string;
}): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    opts.from,
        to:      [opts.to],
        subject: opts.subject,
        html:    opts.html,
        text:    opts.text,
      }),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) return { error: `Resend ${res.status}: ${body.message ?? res.statusText}` };
    return { id: body.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Email send failed' };
  }
}

// ── Twilio SMS (REST API — no SDK dependency) ─────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

async function sendSms(opts: {
  sid:   string;
  token: string;
  from:  string;
  to:    string;
  body:  string;
}): Promise<{ sid?: string; error?: string }> {
  try {
    const creds = btoa(`${opts.sid}:${opts.token}`);
    const params = new URLSearchParams({
      From: opts.from,
      To:   normalizePhone(opts.to),
      Body: opts.body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${opts.sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) return { error: `Twilio ${res.status}: ${body.message ?? res.statusText}` };
    return { sid: body.sid as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'SMS send failed' };
  }
}

// ── Core: sendNotification ────────────────────────────────────────────────────

export async function sendNotification(
  payload: NotificationPayload,
  config: NotificationConfig = {},
): Promise<NotificationResult> {
  // ── 1. Resolve config from env if not passed explicitly ──────────────────
  const resendKey  = config.resendApiKey  ?? (typeof process !== 'undefined' ? process.env.RESEND_API_KEY  : undefined);
  const twilioSid  = config.twilioSid    ?? (typeof process !== 'undefined' ? process.env.TWILIO_ACCOUNT_SID : undefined);
  const twilioToken = config.twilioToken ?? (typeof process !== 'undefined' ? process.env.TWILIO_AUTH_TOKEN : undefined);
  const twilioFrom = config.twilioFrom   ?? (typeof process !== 'undefined' ? process.env.TWILIO_FROM_NUMBER : undefined);
  const fromEmail  = config.fromEmail    ?? (typeof process !== 'undefined' ? process.env.FROM_EMAIL : undefined);
  const fromName   = config.fromName     ?? payload.vertical;

  const isDemo = config.demoMode || (!resendKey && !twilioSid);

  // ── 2. Look up template ──────────────────────────────────────────────────
  const template = getTemplate(payload.vertical, payload.templateId);
  if (!template) {
    const error = `Template not found: ${payload.vertical}:${payload.templateId}`;
    console.warn('[Notifications]', error);
    return { success: false, channel: 'none', error, demo: isDemo };
  }

  // ── 3. Determine channel ─────────────────────────────────────────────────
  const channel: NotificationChannel = payload.channel ?? template.channel;
  const { to } = payload;

  // ── 4. Render template ───────────────────────────────────────────────────
  const subject = template.subject
    ? typeof template.subject === 'function'
      ? template.subject(payload.data)
      : template.subject
    : `Message from ${fromName}`;

  const htmlBody = template.html ? template.html(payload.data) : undefined;
  const textBody = template.text(payload.data);

  // ── 5. Demo mode ─────────────────────────────────────────────────────────
  if (isDemo) {
    console.log(
      `[Notifications:demo] ${payload.vertical}:${payload.templateId}`,
      { to: to.email ?? to.phone, subject, channel, entityId: payload.entityId },
    );
    return { success: true, channel, demo: true };
  }

  // ── 6. Send ───────────────────────────────────────────────────────────────
  let emailId: string | undefined;
  let smsId: string | undefined;
  const errors: string[] = [];

  if ((channel === 'email' || channel === 'both') && to.email) {
    const compliance = canSendEmail(template.type, to.emailOptIn);
    if (!compliance.allowed) {
      console.log(`[Notifications] Email skipped: ${compliance.reason}`);
    } else if (!resendKey || !fromEmail) {
      console.warn('[Notifications] RESEND_API_KEY or FROM_EMAIL not set — email skipped');
    } else {
      const result = await sendEmail({
        apiKey:  resendKey,
        from:    `${fromName} <${fromEmail}>`,
        to:      to.email,
        subject,
        html:    htmlBody ?? `<pre>${textBody}</pre>`,
        text:    textBody,
      });
      if (result.error) {
        console.error('[Notifications] Email error:', result.error);
        errors.push(result.error);
      } else {
        emailId = result.id;
      }
    }
  }

  if ((channel === 'sms' || channel === 'both') && to.phone) {
    const compliance = canSendSms(template.type, to.smsOptIn);
    if (!compliance.allowed) {
      console.log(`[Notifications] SMS skipped: ${compliance.reason}`);
    } else if (!twilioSid || !twilioToken || !twilioFrom) {
      console.warn('[Notifications] Twilio env vars not set — SMS skipped');
    } else {
      const result = await sendSms({
        sid:   twilioSid,
        token: twilioToken,
        from:  twilioFrom,
        to:    to.phone,
        body:  textBody,
      });
      if (result.error) {
        console.error('[Notifications] SMS error:', result.error);
        errors.push(result.error);
      } else {
        smsId = result.sid;
      }
    }
  }

  const success = errors.length === 0 && (!!emailId || !!smsId);

  return {
    success,
    channel,
    emailId,
    smsId,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    demo: false,
  };
}
