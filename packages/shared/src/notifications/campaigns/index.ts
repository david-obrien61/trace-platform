// ─────────────────────────────────────────────────────────────────────────────
// TRACE Notifications — Campaign Sender
//
// Sends one template to a list of recipients with optional throttle.
// TCPA compliance is enforced per-recipient inside sendNotification().
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CampaignPayload,
  CampaignResult,
  NotificationConfig,
} from '../types';
import { sendNotification } from '../send';

export async function sendCampaign(
  campaign: CampaignPayload,
  config: NotificationConfig = {},
): Promise<CampaignResult> {
  const { vertical, templateId, recipients, data, throttleMs = 100 } = campaign;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    // Throttle between sends (avoids rate limiting)
    if (i > 0 && throttleMs > 0) {
      await new Promise((r) => setTimeout(r, throttleMs));
    }

    const result = await sendNotification(
      { vertical, templateId, to: recipient, data },
      config,
    );

    if (result.skipped) {
      skipped++;
    } else if (result.success) {
      sent++;
    } else {
      failed++;
      console.warn(
        `[Campaign] Failed for ${recipient.email ?? recipient.phone}: ${result.error}`,
      );
    }
  }

  console.log(
    `[Campaign] ${vertical}:${templateId} — total: ${recipients.length}, sent: ${sent}, failed: ${failed}, skipped: ${skipped}`,
  );

  return { total: recipients.length, sent, failed, skipped };
}
