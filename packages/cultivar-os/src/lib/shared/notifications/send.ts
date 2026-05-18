// Inlined from packages/shared/src/notifications/send.ts
// Browser-safe: runs in demo mode when API keys aren't present in VITE_ env vars.
// Real sends happen server-side in orders.py once Railway is deployed.

export type NotificationChannel = 'email' | 'sms' | 'both';

export interface NotifyPayload {
  to:         { email?: string; name?: string; phone?: string };
  subject:    string;
  html:       string;
  text:       string;
  channel?:   NotificationChannel;
  entityId?:  string;
}

export interface NotifyResult {
  success: boolean;
  demo:    boolean;
  error?:  string;
}

const RESEND_KEY  = (import.meta as { env?: Record<string, string> }).env?.VITE_RESEND_API_KEY;
const FROM_EMAIL  = (import.meta as { env?: Record<string, string> }).env?.VITE_FROM_EMAIL ?? 'noreply@cultivar-os.app';
const FROM_NAME   = 'LAWNS Tree Farm';

export async function sendEmail(payload: NotifyPayload): Promise<NotifyResult> {
  if (!RESEND_KEY || !payload.to.email) {
    // Demo mode — log and succeed silently
    console.log('[Notifications:demo]', { to: payload.to.email, subject: payload.subject });
    return { success: true, demo: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      [payload.to.email],
        subject: payload.subject,
        html:    payload.html,
        text:    payload.text,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[Notifications] Email error:', err);
      return { success: false, demo: false, error: err };
    }
    return { success: true, demo: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email failed';
    console.warn('[Notifications]', msg);
    return { success: false, demo: false, error: msg };
  }
}

export async function sendSilently(payload: NotifyPayload): Promise<void> {
  try { await sendEmail(payload); } catch { /* never throws */ }
}
