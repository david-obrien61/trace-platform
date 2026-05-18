// ─────────────────────────────────────────────────────────────────────────────
// TRACE Notifications — Public API
//
// Usage (any vertical):
//
//   import { sendNotification, sendSilently, sendCampaign } from '@trace/shared/notifications';
//   import type { NotificationPayload } from '@trace/shared/notifications';
//
//   // Fire-and-forget — safe in checkout handlers (never throws)
//   sendSilently({
//     vertical: 'cultivar',
//     templateId: 'order_confirmation',
//     to: { email: customer.email, name: customer.name },
//     data: { customerName, invoiceNumber, total, ... },
//     entityId: orderId,
//   });
//
//   // Bulk campaign
//   await sendCampaign({
//     vertical: 'cultivar',
//     templateId: 'seasonal_offer',
//     recipients: [...],
//     data: { offerHeadline: 'Spring sale — 20% off compost', ... },
//   });
// ─────────────────────────────────────────────────────────────────────────────

export { sendNotification }         from './send';
export { sendSilently, NotificationQueue } from './queue';
export { sendCampaign }             from './campaigns/index';
export { getTemplate, listTemplates } from './templates/index';

export type {
  TraceVertical,
  NotificationType,
  NotificationChannel,
  NotificationRecipient,
  NotificationPayload,
  NotificationResult,
  NotificationConfig,
  TemplateDef,
  QueuedNotification,
  CampaignPayload,
  CampaignResult,
} from './types';
