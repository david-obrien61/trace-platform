// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: build "DATA ANALYSIS: FIRST LOOK PRIOR TO INGEST" — the artefact that lands on an
//   owner's desk and gets shown to their accountant. The SCREEN exists for a decision (ingest
//   or not); this exists for the VALUE — here is what is in your books. It ends by asking for
//   nothing at all.
// DEPENDENCIES: ./booksFindings (Finding · FindingTier · Recommendation) · ./qboRead (QboEntity).
//   Pure: no db, no network, no env, no DOM, and no clock it was not handed.
// OUTPUTS: WalkState · ReportCorrection · ReportInput · BooksReport · buildBooksReport ·
//   renderBooksReportHtml.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE HTML IS A PURE STRING FUNCTION, AND THAT IS THE WHOLE REASON THIS FILE EXISTS.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Everything this document must never do — name a customer, print a field name, ask for a
// decision, show a count without saying what it is out of — is a property of the TEXT. Built
// as a component it could only be checked by looking at it, and a report that reads calmly is
// exactly what a missing section looks like. As a string it is probed directly.
//
// 🔴 THREE THINGS THE REPORT STATES ABOUT ITSELF, BECAUSE IT OUTLIVES THE SESSION THAT MADE IT.
//   ① WHEN it was generated. ② WHICH corrections it reflects — and when there are none it SAYS
//   "none", because an absent line reads as "none were needed" rather than "none were made".
//   ③ WHICH of the three reads it is built on, each stating whether it is WHOLE and its count
//   (R-24). A walk that was not read is NAMED as not read, never omitted — the difference
//   between "we looked and found nothing" and "we did not look" is the difference this whole
//   platform is built to preserve, and it survives into print or it was never real.
//
// ⚠️ NO CUSTOMER NAMES, EVER. Findings carry counts and populations; the one place a person's
// name could reach paper is an "example", so there are none. Who the seven customers were
// belongs on a screen, not in a document that gets emailed to an accountant.
//
// ⚠️ AND IT ESCAPES. Item names come from the customer's own catalogue, and a catalogue is free
// text — an item called `3" Caliper <B&B>` would otherwise silently break the document or, on
// a hostile string, inject markup into a page the owner is about to hand someone.
// ─────────────────────────────────────────────────────────────────────────────
import type { Finding, FindingTier, Recommendation } from './booksFindings';
import type { QboEntity } from './qboRead';

/** The owner's word for each read. `Item`/`Customer`/`Invoice` never reach the page. */
export const WALK_TITLE: Record<QboEntity, string> = {
  Item:     'Your products & services',
  Customer: 'Your customers',
  Invoice:  'Your invoice history',
};

export interface WalkState {
  entity: QboEntity;
  /** `false` = this read was never run. NOT the same as a read that returned nothing. */
  read: boolean;
  expected: number | null;
  retrieved: number;
  complete: boolean;
  /** True when this read came back from a saved file rather than a live connection. */
  fromFile: boolean;
  /**
   * 🔴 WHEN THIS WALK READ THEIR BOOKS — `YYYY-MM-DD`, or null if the read never ran.
   *
   * The report used to print "Generated <today>", which is the day somebody pressed a button.
   * David: *"the report states ONE number — the one measured from the read in front of it — and
   * says WHEN IT WAS READ. That is the only date on the page."* Generation date and read date
   * are the same day on a live pull and can be weeks apart on a saved one, and it is the read
   * date that every figure below is a fact about. The field did not previously reach this
   * module at all, so deleting the drift lines alone would have left the wrong date behind.
   */
  queriedAt: string | null;
}

/** One thing the owner chose, and what it was applied to. Recorded so the paper can cite it. */
export interface ReportCorrection {
  at: string;
  what: string;
  population: string;
}

export interface ReportInput {
  // 🔴 `generatedAt: Date` WAS HERE AND IS REMOVED. The page no longer carries a generation
  // date, so a required input nobody reads is a dead parameter the next author would assume
  // matters — and the clock is the one dependency this pure module is better off without.
  walks: WalkState[];
  findings: Finding[];
  corrections: ReportCorrection[];
}

export interface BooksReport {
  title: string;
  /**
   * 🔴 THE ONE DATE ON THE PAGE: when their books were READ.
   *
   * `{ kind: 'one' }` when every walk that ran read on the same day — the ordinary case.
   * `{ kind: 'span' }` when they did not, because two walks read a fortnight apart is a fact
   * about the report and collapsing it to one date would be inventing one. `{ kind: 'none' }`
   * when nothing has been read; the renderer then says so rather than printing today.
   */
  readOn:
    | { kind: 'one'; date: string }
    | { kind: 'span'; earliest: string; latest: string }
    | { kind: 'none' };
  /** Present and honest even when empty — see ② in the header. */
  corrections: ReportCorrection[];
  walks: WalkState[];
  /** Measured, already ordered by the engine: money → risk → tidiness, by money at stake. */
  measured: Finding[];
  /** Every finding carrying a computed four-part recommendation. */
  recommendations: { finding: Finding; recommendation: Recommendation }[];
  /** 🔴 The most valuable page: what the business itself cannot answer today. */
  notComputed: Finding[];
}

export const REPORT_TITLE = 'DATA ANALYSIS: FIRST LOOK PRIOR TO INGEST';

const TIER_HEADING: Record<FindingTier, string> = {
  money:    'Where there is money in this',
  risk:     'Things worth knowing before they cause trouble',
  tidiness: 'The shape of your business',
};

const money = (n: number): string => `$${Math.round(n).toLocaleString()}`;

/** Assemble the model. No formatting decisions here — those belong to the renderer. */
export function buildBooksReport(input: ReportInput): BooksReport {
  const measured = input.findings.filter(f => f.measured);

  // 🔴 THE DATE COMES OFF THE WALKS, NOT OFF THE CLOCK. Only walks that actually RAN carry one —
  // an unread walk contributes no date, because a read that did not happen did not happen on a
  // day. The DATE ONLY: an accountant does not need 14:32:07, and a timestamp that precise
  // invites someone to treat the page as a transaction record.
  const dates = [...new Set(
    input.walks.filter(w => w.read && w.queriedAt).map(w => (w.queriedAt as string).slice(0, 10)),
  )].sort();
  const readOn: BooksReport['readOn'] =
    dates.length === 0 ? { kind: 'none' }
    : dates.length === 1 ? { kind: 'one', date: dates[0] }
    // Not an average, not the newest: BOTH ends, named. Two walks a fortnight apart is a fact
    // about this report, and choosing one of the two dates would be asserting a read that never
    // happened on that day for half the figures below it.
    : { kind: 'span', earliest: dates[0], latest: dates[dates.length - 1] };

  return {
    title: REPORT_TITLE,
    readOn,
    corrections: input.corrections,
    walks: input.walks,
    measured,
    recommendations: measured
      .filter(f => f.recommendation !== null)
      .map(f => ({ finding: f, recommendation: f.recommendation as Recommendation })),
    notComputed: input.findings.filter(f => !f.measured),
  };
}

/** 🔴 Escape before anything from their books reaches the page. See the header. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function walkLine(w: WalkState): string {
  if (!w.read) {
    // 🔴 NAMED, NOT OMITTED. A missing section reads as "nothing to report".
    return `<li><strong>${esc(WALK_TITLE[w.entity])}</strong> — not read. Nothing in this report is based on it, and nothing in it should be read as a verdict on that part of your books.</li>`;
  }
  if (!w.complete || w.expected === null) {
    return `<li><strong>${esc(WALK_TITLE[w.entity])}</strong> — read, but NOT proven complete (${w.retrieved.toLocaleString()} records). Treat anything below that depends on it as partial.</li>`;
  }
  return `<li><strong>${esc(WALK_TITLE[w.entity])}</strong> — read in full: all ${w.expected.toLocaleString()} of them${w.fromFile ? ', from a saved copy of your books' : ''}.</li>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 `remeasuredLine()` WAS HERE AND IS DELIBERATELY GONE (David, 2026-09-04). NOT A TIDY-UP.
// ══════════════════════════════════════════════════════════════════════════════════════════
// It printed "Re-measured 3 September 2026: …" under every finding, beside the quoted figure —
// so the document Terry is handed carried TWO NUMBERS FOR ONE FACT, DISAGREEING. On the page:
// *"$32,934 is still owed to you across 15 invoices"* directly above *"CONFIRMED — $30,736
// across 14 invoices"*. And *"887 invoices do not record the date"* above *"CONFIRMED EXACT —
// 881 of 1,469"*.
//
// David: *"That is my error. I asked for the measured value beside the quoted one so drift was
// visible. THAT WAS FOR MY RECORD, NOT HER REPORT."*
//
// It also carried working notes into a customer document — *"41 is not derivable from any of the
// three reads"*, *"the quoted pair is right under that second definition"*, *"not previously
// computed"*. That is us talking to ourselves, in a document a customer keeps.
//
// ⚠️ THE DRIFT RECORD IS NOT DELETED, IT IS RELOCATED — it stays on the SCREEN panel, which
// David reads and Lauren does not print (`BooksReview.tsx` still renders quoted + re-measured
// side by side, and the reasoning for keeping both there is unchanged). The `remeasured` field
// stays on `Finding` for exactly that reason. What changed is the AUDIENCE, not the honesty:
// a report states ONE number — the one measured from the read in front of it — and says when
// that read happened.
//
// ⚠️ AND THE TWO READS DISAGREE FOR A REAL REASON, RECORDED ONCE HERE SO NOBODY RE-DERIVES IT:
// the live read is 1,480 invoices and 1,946 customers; the 29 August capture was 1,469 and
// 1,936. HER BOOKS GREW. That is time passing, not drift — which is the other half of why a
// report carrying both numbers misleads rather than informs.

function findingLine(f: Finding): string {
  const worth = f.value === null ? '' : ` <span class="worth">${esc(money(f.value))} at stake</span>`;
  return `<li><p class="s">${esc(f.sentence)}${worth}</p>
    <p class="p">${f.population.matched.toLocaleString()} of ${f.population.of.toLocaleString()} ${esc(f.population.noun)}</p></li>`;
}

function recBlock(r: Recommendation, f: Finding): string {
  return `<div class="rec">
    <p class="rh">WHAT WE'D DO ABOUT IT</p>
    <p class="s">${esc(f.sentence)}</p>
    <p class="s">${esc(r.remedy)}</p>
    <table class="four">
      <tr><td>Costing you now</td><td><strong>${esc(money(r.statusQuoCost))}</strong></td></tr>
      <tr><td>What the fix costs</td><td><strong>${r.remedyCost === 0 ? 'Nothing — it is a decision, not a purchase' : esc(money(r.remedyCost))}</strong></td></tr>
      <tr><td>Pays for itself</td><td><strong>${r.paybackMonths === 0 ? 'Immediately' : `In about ${r.paybackMonths} months`}</strong></td></tr>
    </table>
    <p class="lim">What it does not fix: ${esc(r.limits)}</p>
  </div>`;
}

/**
 * 🔴 THE ONLY DATE ON THE PAGE, AND IT IS THE DATE THEIR BOOKS WERE READ.
 *
 * Every figure below it is a fact about a moment, and that moment is the read — not the moment
 * somebody pressed the button to print. A saved read re-opened in November still describes
 * the day it was taken, exactly as the findings engine already measures "past due" against the
 * read rather than against today.
 *
 * ⚠️ THE NO-READ CASE SAYS SO RATHER THAN FALLING BACK TO TODAY. A date printed over a report
 * built on nothing is the report's most confident-looking claim and its least true one.
 */
function readOnLine(r: BooksReport): string {
  if (r.readOn.kind === 'none') {
    return 'Nothing has been read yet — this report is not based on your books.';
  }
  if (r.readOn.kind === 'one') {
    return `Read from your QuickBooks company on ${esc(r.readOn.date)}. Everything in this report describes your books as they were on that day.`;
  }
  // BOTH ends named. See the builder: collapsing a span to one date asserts a read that did not
  // happen on that day for half the figures underneath it.
  return `Read from your QuickBooks company between ${esc(r.readOn.earliest)} and ${esc(r.readOn.latest)} — the parts of this report were read on different days, and both are given rather than one standing in for the other.`;
}

/**
 * The whole document, as one printable HTML string.
 *
 * ⚠️ IT ENDS BY ASKING FOR NOTHING. No Accept, no Ingest, no button, no next step. The screen
 * is where a decision gets made; this is what they keep, and a document that closes with a
 * call to action is a sales sheet rather than a piece of analysis.
 */
export function renderBooksReportHtml(r: BooksReport): string {
  const tiers = (['money', 'risk', 'tidiness'] as FindingTier[]).map(t => {
    const rows = r.measured.filter(f => f.tier === t);
    if (rows.length === 0) return '';
    return `<h2>${esc(TIER_HEADING[t])}</h2><ul class="f">${rows.map(findingLine).join('')}</ul>`;
  }).join('');

  const recs = r.recommendations.length === 0 ? '' :
    `<h2>What we would do about it</h2>${r.recommendations.map(x => recBlock(x.recommendation, x.finding)).join('')}`;

  const notComputed = r.notComputed.length === 0 ? '' :
    `<h2>What we could not work out</h2>
     <p class="note">These are not problems we found. They are questions we could not answer from
     what has been read — so nothing below should be taken as good news or bad. They are usually
     the most useful page in here, because they are the questions your books cannot answer today.</p>
     <ul class="f">${r.notComputed.map(f => `<li><p class="s">${esc(f.notMeasured ?? '')}</p></li>`).join('')}</ul>`;

  const corrections = r.corrections.length === 0
    // 🔴 SAID, NOT OMITTED. An absent line reads as "none were needed".
    ? `<p class="note">This report reflects <strong>no corrections</strong> — none had been recorded when it was generated. It describes your books exactly as they were read.</p>`
    : `<p class="note">This report reflects the following corrections, and was generated after them:</p>
       <ul class="f">${r.corrections.map(c => `<li><p class="s">${esc(c.at)} — ${esc(c.what)} (${esc(c.population)})</p></li>`).join('')}</ul>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
  @page { margin: 18mm; }
  body { font: 11pt/1.55 Georgia, 'Times New Roman', serif; color: #111827; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 15pt; letter-spacing: .04em; margin: 0 0 2px; }
  h2 { font-size: 12pt; margin: 22px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; page-break-after: avoid; }
  .sub { color: #6b7280; font-size: 9.5pt; margin: 0 0 18px; }
  ul.f { list-style: none; padding: 0; margin: 0; }
  ul.f li { margin: 0 0 11px; page-break-inside: avoid; }
  p.s { margin: 0; }
  p.p { margin: 2px 0 0; color: #6b7280; font-size: 9.5pt; }
  p.note { color: #374151; font-size: 10pt; background: #f9fafb; padding: 9px 11px; border-left: 3px solid #9ca3af; }
  .worth { font-weight: 700; white-space: nowrap; }
  .rec { border: 1px solid #27500A; padding: 11px 13px; margin: 0 0 12px; page-break-inside: avoid; }
  .rh { font-size: 8.5pt; letter-spacing: .06em; color: #27500A; font-weight: 700; margin: 0 0 5px; }
  table.four { border-collapse: collapse; margin: 7px 0 5px; width: 100%; }
  table.four td { padding: 3px 0; font-size: 10pt; vertical-align: top; }
  table.four td:first-child { color: #6b7280; width: 42%; }
  .lim { font-size: 9.5pt; color: #6b7280; margin: 4px 0 0; }
  ul.w { font-size: 10pt; }
  /* ══════════════════════════════════════════════════════════════════════════════
     🔴 THE SAVE BAR — AND IT IS THE ONLY THING ON THE PAGE THAT DOES NOT PRINT.
     ══════════════════════════════════════════════════════════════════════════════
     There was NO print or download control here at all: the report opened in a window
     with no way to keep it but the browser's own menu, and the button an owner presses
     to walk away with the document was simply missing. That was the real gap inside the
     "should we add a PDF library" question — the answer to which was already settled and
     built (print-to-PDF, the qr/print.ts precedent, no dependency).
     The @media print block removes it, so the saved PDF never carries a button that cannot be
     pressed on paper. */
  .bar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e5e7eb;
         margin: -24px -24px 18px; padding: 11px 24px; display: flex; gap: 10px; align-items: center; }
  .bar button { font: inherit; font-size: 10pt; font-weight: 700; color: #fff; background: #27500A;
                border: none; border-radius: 8px; padding: 9px 15px; cursor: pointer; min-height: 40px; }
  .bar span { color: #6b7280; font-size: 9.5pt; }
  @media print { .bar { display: none; } }
</style></head><body>
  <div class="bar">
    <button type="button" onclick="window.print()">&#x2193;&nbsp; Download or print this report</button>
    <span>Choose &ldquo;Save as PDF&rdquo; to keep a copy.</span>
  </div>
  <h1>${esc(r.title)}</h1>
  <p class="sub">${readOnLine(r)}</p>
  ${corrections}
  <h2>What this is built on</h2>
  <ul class="f w">${r.walks.map(walkLine).join('')}</ul>
  ${tiers}
  ${recs}
  ${notComputed}
</body></html>`;
}
