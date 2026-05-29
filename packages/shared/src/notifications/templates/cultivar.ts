import type { TemplateDef } from '../types';
import { baseEmailHtml } from './base';

const BASE = {
  headerColor:   '#27500A',
  logoText:      'LAWNS Tree Farm',
  footerName:    'LAWNS Tree Farm, LLC — 400 Honeycomb Mesa, Leander TX 78641',
  footerAddress: '(512) 450-3336 · info@lawnstrees.com',
  appUrl:        'https://cultivar-os.app',
  unsubscribeUrl: 'https://cultivar-os.app/unsubscribe',
};

// ── order_confirmation ────────────────────────────────────────────────────────
// Triggered on every checkout. Always transactional.

interface OrderConfirmData extends Record<string, unknown> {
  customerName:   string;
  invoiceNumber:  string;
  plantName:      string;
  container:      string;
  quantity:       number;
  plantTotal:     string;   // formatted "$400.00"
  addonsTotal:    string;
  subtotal:       string;
  tax:            string;
  total:          string;
  transport:      'self' | 'delivery' | 'install';
  nettingActive:  boolean;
  payOnline:      boolean;
  payUrl:         string;
}

const orderConfirmation: TemplateDef<OrderConfirmData> = {
  id:       'order_confirmation',
  vertical: 'cultivar',
  channel:  'both',
  type:     'transactional',

  subject: (d) => `Your LAWNS Tree Farm order is confirmed — ${d.invoiceNumber}`,

  html: (d) => baseEmailHtml(`
    <h1>Your order is confirmed.</h1>
    <p>Hi ${d.customerName}, thank you for your purchase from LAWNS Tree Farm.</p>

    <h2>Order ${d.invoiceNumber}</h2>
    <div class="line-item"><span>${d.plantName} · ${d.container} × ${d.quantity}</span><span>${d.plantTotal}</span></div>
    ${d.addonsTotal !== '$0.00' ? `<div class="line-item"><span>Add-ons</span><span>${d.addonsTotal}</span></div>` : ''}
    <div class="line-item"><span>Tax (8.25%)</span><span>${d.tax}</span></div>
    <div class="line-item"><span>Total</span><span>${d.total}</span></div>

    ${d.transport === 'self' && d.nettingActive ? `
    <div class="alert">
      <strong>✓ Netting applied</strong> — Your tree is wrapped and ready to load safely.
    </div>` : ''}

    ${d.transport === 'self' && !d.nettingActive ? `
    <div class="alert alert-red">
      <strong>⚠ No netting</strong> — Please secure your load before leaving the lot.
      Texas Transportation Code Ch. 725 applies to open-bed transport.
    </div>` : ''}

    ${d.transport === 'delivery' ? `<p><strong>Delivery:</strong> LAWNS will contact you to schedule your delivery.</p>` : ''}
    ${d.transport === 'install' ? `<p><strong>Installation:</strong> LAWNS will contact you to schedule delivery and installation.</p>` : ''}

    ${d.payOnline ? `<a class="btn" href="${d.payUrl}">Pay your invoice — ${d.total}</a>` : `<p>You can pay when you visit the office. Your invoice is saved.</p>`}

    <p style="font-size:13px;color:#9ca3af;">Questions? Call us at (512) 450-3336.</p>
  `, BASE),

  text: (d) =>
    `Hi ${d.customerName}, your LAWNS Tree Farm order is confirmed.\n\n` +
    `Order: ${d.invoiceNumber}\n` +
    `${d.plantName} · ${d.container} × ${d.quantity}: ${d.plantTotal}\n` +
    `Total: ${d.total}\n` +
    (d.transport === 'self' && !d.nettingActive
      ? `\nREMINDER: Secure your load before driving. Texas TCC Ch. 725.\n`
      : '') +
    (d.payOnline ? `\nPay online: ${d.payUrl}` : '\nPay at the office — your invoice is saved.') +
    `\n\nQuestions? Call (512) 450-3336.`,
};

// ── netting_waiver_reminder ───────────────────────────────────────────────────
// Nurture: sent 30 min after checkout when netting was declined. Transactional.

interface NettingWaiverData extends Record<string, unknown> {
  customerName: string;
  invoiceNumber: string;
}

const nettingWaiverReminder: TemplateDef<NettingWaiverData> = {
  id:       'netting_waiver_reminder',
  vertical: 'cultivar',
  channel:  'sms',
  type:     'transactional',

  text: (d) =>
    `Hi ${d.customerName} — just a reminder from LAWNS Tree Farm: ` +
    `you declined netting on order ${d.invoiceNumber}. ` +
    `Please secure your tree before driving per TX law. ` +
    `Drive safe! (512) 450-3336`,
};

// ── delivery_scheduled ────────────────────────────────────────────────────────

interface DeliveryScheduledData extends Record<string, unknown> {
  customerName:  string;
  plantName:     string;
  deliveryDate:  string;
  deliveryWindow: string;   // "10am – 12pm"
  staffName:     string;
}

const deliveryScheduled: TemplateDef<DeliveryScheduledData> = {
  id:       'delivery_scheduled',
  vertical: 'cultivar',
  channel:  'both',
  type:     'reminder',

  subject: (d) => `Your ${d.plantName} delivery is scheduled — ${d.deliveryDate}`,

  html: (d) => baseEmailHtml(`
    <h1>Delivery scheduled.</h1>
    <p>Hi ${d.customerName},</p>
    <p>Your <strong>${d.plantName}</strong> will be delivered by <strong>${d.staffName}</strong> on:</p>
    <p style="font-size:20px;font-weight:700;color:#27500A;">${d.deliveryDate} · ${d.deliveryWindow}</p>
    <p>Please have the planting area cleared and accessible. If you need to reschedule, call us at (512) 450-3336.</p>
  `, BASE),

  text: (d) =>
    `Hi ${d.customerName} — your ${d.plantName} delivery from LAWNS is scheduled for ` +
    `${d.deliveryDate} between ${d.deliveryWindow}. ` +
    `Questions: (512) 450-3336.`,
};

// ── care_tips_30d ─────────────────────────────────────────────────────────────
// Nurture: 30-day post-purchase care guide. Requires emailOptIn.

interface CareTips30dData extends Record<string, unknown> {
  customerName: string;
  plantName:    string;
  container:    string;
}

const careTips30d: TemplateDef<CareTips30dData> = {
  id:       'care_tips_30d',
  vertical: 'cultivar',
  channel:  'email',
  type:     'nurture',

  subject: (d) => `30-day check-in: how is your ${d.plantName} doing?`,

  html: (d) => baseEmailHtml(`
    <h1>30 days in — here's what to watch for.</h1>
    <p>Hi ${d.customerName},</p>
    <p>It's been about a month since your <strong>${d.plantName}</strong> from LAWNS went in the ground. Here are a few things to check:</p>
    <h2>Watering</h2>
    <p>For a ${d.container} tree, water deeply 2–3 times per week for the first 3 months.
    The root ball should stay consistently moist but never waterlogged.</p>
    <h2>Mulch</h2>
    <p>Keep a 3-inch mulch ring (4 ft wide) around the base.
    Pull mulch away from the trunk — it should not touch the bark.</p>
    <h2>Signs of stress</h2>
    <p>Yellowing leaves or wilting despite watering? Call us — it's usually fixable early. (512) 450-3336</p>
    <p>Thanks for growing with LAWNS.</p>
  `, BASE),

  text: (d) =>
    `Hi ${d.customerName} — 30-day check-in from LAWNS Tree Farm on your ${d.plantName}. ` +
    `Water deeply 2-3x/week. Keep mulch 3" deep. Questions? Call (512) 450-3336.`,
};

// ── seasonal_offer ────────────────────────────────────────────────────────────
// Promotional. Requires smsOptIn / emailOptIn.

interface SeasonalOfferData extends Record<string, unknown> {
  customerName:   string;
  offerHeadline:  string;
  offerBody:      string;
  ctaText:        string;
  ctaUrl:         string;
  expiresDate:    string;
}

const seasonalOffer: TemplateDef<SeasonalOfferData> = {
  id:       'seasonal_offer',
  vertical: 'cultivar',
  channel:  'both',
  type:     'promotional',

  subject: (d) => d.offerHeadline,

  html: (d) => baseEmailHtml(`
    <h1>${d.offerHeadline}</h1>
    <p>Hi ${d.customerName},</p>
    <p>${d.offerBody}</p>
    <a class="btn" href="${d.ctaUrl}">${d.ctaText}</a>
    <p style="font-size:13px;color:#9ca3af;">Offer expires ${d.expiresDate}.</p>
  `, BASE),

  text: (d) =>
    `LAWNS Tree Farm: ${d.offerHeadline}. ${d.offerBody} ` +
    `Shop now: ${d.ctaUrl} · Expires ${d.expiresDate}. ` +
    `Reply STOP to unsubscribe.`,
};

// ── owner_leakage_alert ───────────────────────────────────────────────────────
// Internal alert to the business owner when a large-container order closes
// with zero add-ons. Status type — no opt-in required (operator notification).

interface OwnerLeakageData extends Record<string, unknown> {
  customerName:  string;
  plantName:     string;
  container:     string;
  invoiceNumber: string;
  quantity:      number;
}

const ownerLeakageAlert: TemplateDef<OwnerLeakageData> = {
  id:       'owner_leakage_alert',
  vertical: 'cultivar',
  channel:  'sms',
  type:     'status',

  text: (d) =>
    `Missed add-on — ${d.customerName} picked up ${d.quantity > 1 ? `${d.quantity}x ` : ''}` +
    `${d.container} ${d.plantName} with no services. Invoice ${d.invoiceNumber}.`,
};

export const cultivarTemplates = [
  orderConfirmation,
  nettingWaiverReminder,
  deliveryScheduled,
  careTips30d,
  seasonalOffer,
  ownerLeakageAlert,
] as TemplateDef[];
