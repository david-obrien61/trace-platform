import type { TemplateDef } from '../types';
import { baseEmailHtml } from './base';

const BASE = {
  headerColor:   '#1a1a2e',
  logoText:      'Built with CAI — AI Assessment',
  footerName:    'Built with CAI — A TRACE Enterprises Platform',
  appUrl:        'https://builtwithcai.com',
  unsubscribeUrl: 'https://builtwithcai.com/unsubscribe',
};

// ── assessment_confirmed ──────────────────────────────────────────────────────

interface AssessmentConfirmedData extends Record<string, unknown> {
  ownerName:    string;
  businessName: string;
  meetingDate:  string;
  meetingTime:  string;
  meetingUrl:   string;    // Google Meet / Calendly link
}

const assessmentConfirmed: TemplateDef<AssessmentConfirmedData> = {
  id:       'assessment_confirmed',
  vertical: 'assessment',
  channel:  'email',
  type:     'transactional',

  subject: (d) => `Your AI Assessment is confirmed — ${d.meetingDate}`,

  html: (d) => baseEmailHtml(`
    <h1>Your AI Assessment is confirmed.</h1>
    <p>Hi ${d.ownerName}, we're looking forward to your session.</p>
    <p>
      <strong>Business:</strong> ${d.businessName}<br />
      <strong>Date:</strong> ${d.meetingDate}<br />
      <strong>Time:</strong> ${d.meetingTime}<br />
    </p>
    <a class="btn" href="${d.meetingUrl}">Join the meeting</a>
    <h2>What to expect</h2>
    <p>Our 45-minute session will walk through the tasks and workflows in your business that are costing you the most time and margin.
    You'll leave with a clear prioritized list of where AI automation delivers the fastest ROI — specific to your operation.</p>
    <p>No preparation needed. Just show up and talk through a normal week.</p>
    <p>Questions? Reply to this email.</p>
  `, BASE),

  text: (d) =>
    `Hi ${d.ownerName} — your AI Assessment with Built with CAI is confirmed. ` +
    `${d.meetingDate} at ${d.meetingTime}. ` +
    `Join: ${d.meetingUrl}`,
};

// ── report_ready ──────────────────────────────────────────────────────────────

interface ReportReadyData extends Record<string, unknown> {
  ownerName:    string;
  businessName: string;
  reportUrl:    string;
  topGap:       string;    // e.g. "parts markup — est. $2,400/mo"
  callUrl:      string;    // scheduling link
}

const reportReady: TemplateDef<ReportReadyData> = {
  id:       'report_ready',
  vertical: 'assessment',
  channel:  'both',
  type:     'transactional',

  subject: (d) => `Your automation roadmap is ready — ${d.businessName}`,

  html: (d) => baseEmailHtml(`
    <h1>Your automation roadmap is ready.</h1>
    <p>Hi ${d.ownerName}, your AI Assessment for <strong>${d.businessName}</strong> is complete.</p>
    <div class="alert">
      <strong>Biggest gap identified:</strong> ${d.topGap}
    </div>
    <p>Your full report includes:</p>
    <ul>
      <li>Prioritized automation opportunities (impact × effort matrix)</li>
      <li>Estimated monthly margin recaptured per fix</li>
      <li>Your 4-day quick-win plan</li>
      <li>Which Built with CAI modules address each gap</li>
    </ul>
    <a class="btn" href="${d.reportUrl}">View your roadmap</a>
    <p>Ready to see it live in your business? <a href="${d.callUrl}">Schedule a 20-minute implementation call →</a></p>
  `, BASE),

  text: (d) =>
    `${d.ownerName} — your AI Assessment report for ${d.businessName} is ready. ` +
    `Top gap: ${d.topGap}. ` +
    `View: ${d.reportUrl}`,
};

// ── follow_up_7d ──────────────────────────────────────────────────────────────

interface FollowUp7dData extends Record<string, unknown> {
  ownerName:    string;
  businessName: string;
  callUrl:      string;
}

const followUp7d: TemplateDef<FollowUp7dData> = {
  id:       'follow_up_7d',
  vertical: 'assessment',
  channel:  'email',
  type:     'nurture',

  subject: (d) => `Quick check-in — ${d.businessName}`,

  html: (d) => baseEmailHtml(`
    <h1>A quick check-in.</h1>
    <p>Hi ${d.ownerName},</p>
    <p>It's been a week since your AI Assessment for ${d.businessName}.
    I wanted to check in — have you had a chance to look through the roadmap?</p>
    <p>If you're ready to see how Built with CAI automates the top gaps we identified,
    a 20-minute call is all it takes to show you the live system.</p>
    <a class="btn" href="${d.callUrl}">Schedule a 20-minute call</a>
    <p>If now isn't the right time, no pressure — just reply and let me know where things stand.</p>
  `, BASE),

  text: (d) =>
    `Hi ${d.ownerName} — following up on your AI Assessment for ${d.businessName}. ` +
    `Ready to see the system live? ${d.callUrl}`,
};

export const assessmentTemplates = [
  assessmentConfirmed,
  reportReady,
  followUp7d,
] as TemplateDef[];
