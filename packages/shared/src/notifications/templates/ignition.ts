import type { TemplateDef } from '../types';
import { baseEmailHtml } from './base';

const BASE = {
  headerColor:   '#1e3a5f',
  logoText:      'Ignition OS',
  footerName:    'Ignition OS — Built with CAI',
  appUrl:        'https://ignition-os.com',
  unsubscribeUrl: 'https://ignition-os.com/unsubscribe',
};

// ── ro_approved ───────────────────────────────────────────────────────────────

interface RoApprovedData extends Record<string, unknown> {
  customerName: string;
  roNumber:     string;
  shopName:     string;
  approvedTotal: string;
  itemsList:    string;   // pre-formatted HTML or plain text
}

const roApproved: TemplateDef<RoApprovedData> = {
  id:       'ro_approved',
  vertical: 'ignition',
  channel:  'both',
  type:     'transactional',

  subject: (d) => `RO #${d.roNumber} approved — work is starting`,

  html: (d) => baseEmailHtml(`
    <h1>Your repair order is approved.</h1>
    <p>Hi ${d.customerName}, thanks for approving RO #${d.roNumber} at ${d.shopName}. Our team is starting on your vehicle now.</p>
    <h2>Approved work</h2>
    <p>${d.itemsList}</p>
    <p><strong>Approved total:</strong> ${d.approvedTotal}</p>
    <p>We'll text and email you when your vehicle is ready. Questions? Reply to this email.</p>
  `, BASE),

  text: (d) =>
    `${d.shopName}: RO #${d.roNumber} approved — ${d.approvedTotal}. ` +
    `We'll text you when your vehicle is ready.`,
};

// ── ro_ready ──────────────────────────────────────────────────────────────────

interface RoReadyData extends Record<string, unknown> {
  customerName:  string;
  roNumber:      string;
  shopName:      string;
  shopPhone:     string;
  invoiceTotal:  string;
  payUrl?:       string;
}

const roReady: TemplateDef<RoReadyData> = {
  id:       'ro_ready',
  vertical: 'ignition',
  channel:  'both',
  type:     'transactional',

  subject: (d) => `Your vehicle is ready — ${d.shopName}`,

  html: (d) => baseEmailHtml(`
    <h1>Your vehicle is ready.</h1>
    <p>Hi ${d.customerName}, your vehicle is ready for pickup at ${d.shopName}.</p>
    <p><strong>Invoice total:</strong> ${d.invoiceTotal}</p>
    ${d.payUrl ? `<a class="btn" href="${d.payUrl}">Pay online — ${d.invoiceTotal}</a>` : ''}
    <p>Pick-up hours: Mon–Fri 7am–6pm. Call us if you need after-hours: ${d.shopPhone}</p>
  `, BASE),

  text: (d) =>
    `${d.shopName}: Your vehicle is ready! Invoice: ${d.invoiceTotal}. ` +
    (d.payUrl ? `Pay online: ${d.payUrl} · ` : '') +
    `Questions: ${d.shopPhone}`,
};

// ── invoice_sent ──────────────────────────────────────────────────────────────

interface InvoiceSentData extends Record<string, unknown> {
  customerName: string;
  roNumber:     string;
  shopName:     string;
  total:        string;
  dueDate:      string;
  payUrl:       string;
}

const invoiceSent: TemplateDef<InvoiceSentData> = {
  id:       'invoice_sent',
  vertical: 'ignition',
  channel:  'email',
  type:     'transactional',

  subject: (d) => `Invoice for RO #${d.roNumber} — ${d.total} due ${d.dueDate}`,

  html: (d) => baseEmailHtml(`
    <h1>Invoice ready for review.</h1>
    <p>Hi ${d.customerName}, your invoice from ${d.shopName} is ready.</p>
    <div class="line-item"><span>RO #${d.roNumber}</span><span>${d.total}</span></div>
    <div class="line-item"><span>Due</span><span>${d.dueDate}</span></div>
    <a class="btn" href="${d.payUrl}">Review &amp; Pay — ${d.total}</a>
    <p style="font-size:13px;color:#9ca3af;">Payment is due upon receipt. Contact the shop if you have questions.</p>
  `, BASE),

  text: (d) =>
    `${d.shopName}: Invoice for RO #${d.roNumber} — ${d.total} due ${d.dueDate}. ` +
    `Pay online: ${d.payUrl}`,
};

// ── appointment_24h ───────────────────────────────────────────────────────────

interface Appt24hData extends Record<string, unknown> {
  customerName:  string;
  shopName:      string;
  shopPhone:     string;
  appointmentAt: string;   // formatted: "Tuesday May 20 at 9:00 AM"
  serviceDesc:   string;
}

const appointment24h: TemplateDef<Appt24hData> = {
  id:       'appointment_24h',
  vertical: 'ignition',
  channel:  'sms',
  type:     'reminder',

  text: (d) =>
    `Reminder from ${d.shopName}: your ${d.serviceDesc} appointment is tomorrow, ` +
    `${d.appointmentAt}. Need to reschedule? Call ${d.shopPhone}.`,
};

export const ignitionTemplates = [
  roApproved,
  roReady,
  invoiceSent,
  appointment24h,
] as TemplateDef[];
