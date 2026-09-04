/**
 * ── booksReport — the thing that lands on a desk and gets shown to an accountant ──────
 *
 * 🔴 WHAT IS UNDER TEST IS WHAT THE DOCUMENT MUST NEVER DO. It outlives the session that made
 * it, it gets emailed, and nobody who reads it can ask it a question. So: it never names a
 * customer, never prints a field name, never asks for a decision, never shows a count without
 * its denominator, and never omits a read it did not do. Every one of those is a property of
 * the TEXT — which is why the renderer is a pure string function and not a component. A report
 * with a section missing reads calmly and completely, so looking at it cannot find this class.
 *
 * §A  what it says about itself — date, corrections, the three walks
 * §B  a walk NOT read is named, not omitted
 * §C  🔴 no jargon, no field names, no customer names
 * §D  the recommendation's four parts reach the page
 * §E  what could not be worked out is present and framed as neither good nor bad
 * §F  🔴 it asks for nothing
 * §G  escaping — a catalogue is free text
 * §H  🔴 one number per fact, and one date: the day their books were READ
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/booksReport.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { buildBooksReport, renderBooksReportHtml, REPORT_TITLE,
         type WalkState, type ReportInput } from './booksReport';
import type { Finding } from './booksFindings';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const walk = (entity: WalkState['entity'], o: Partial<WalkState> = {}): WalkState =>
  ({ entity, read: true, expected: 100, retrieved: 100, complete: true, fromFile: false,
     queriedAt: '2026-08-29T09:00:00.000Z', ...o });

const finding = (o: Partial<Finding> = {}): Finding => ({
  id: 'f1', tier: 'money', shape: 'two-sources-disagree',
  sentence: 'Nine sales were charged below the price you set.',
  population: { matched: 9, of: 230, noun: 'sales' },
  measured: true, notMeasured: null, quoted: '53 rows', value: 1200,
  // The drift record the REPORT must never print. It stays on `Finding` because the SCREEN
  // still shows it — the audience changed, not the data.
  remeasured: 'CONFIRMED — $30,736 across 14 invoices. 41 is not derivable from any of the three reads.',
  recommendation: null, needsAnswer: null, ...o,
});

const build = (o: Partial<ReportInput> = {}) => buildBooksReport({
  walks: [walk('Item'), walk('Customer'), walk('Invoice')],
  findings: [finding()], corrections: [], ...o,
});

// ── §A what it says about itself ─────────────────────────────────────────────
{
  const html = renderBooksReportHtml(build());
  ok(html.includes(REPORT_TITLE), 'the report carries its title');
  // 🔴 RETARGETED 2026-09-04, AND THE OLD FORM IS RECORDED BECAUSE IT WAS THE DEFECT.
  // This read `html.includes('2026-09-02')` — the fixture's GENERATION timestamp — and passed
  // for as long as the page printed "Generated <today>". It asserted the document outlives its
  // session, which is true and is not the point: the date a reader needs is the day the books
  // were READ, because every figure below it is a fact about that moment and about no other.
  ok(html.includes('2026-08-29'),
    'and states WHEN THEIR BOOKS WERE READ — it outlives the session that made it, and the date it carries is the one the figures are true of');
  ok(!html.includes('14:32'), 'to the DAY, not the second — a precise timestamp invites it to be read as a transaction record');
  ok(/no corrections/i.test(html),
    '🔴 with NO corrections it SAYS "no corrections" — an absent line reads as "none were needed" rather than "none were made"');
  ok(html.includes('all 100 of them'),
    'each read states it is WHOLE and gives its count (R-24) — never a bare "read"');
}
{
  const html = renderBooksReportHtml(build({
    corrections: [{ at: '3 September', what: 'display 30 gal as 30 Gallon', population: '214 items' }],
  }));
  ok(html.includes('30 Gallon') && html.includes('214 items'),
    'when corrections exist it names them and what they were applied to');
  ok(!/no corrections/i.test(html), 'and drops the none-were-made line');
}

// ── §B a walk not read is NAMED ──────────────────────────────────────────────
{
  const html = renderBooksReportHtml(build({
    walks: [walk('Item'), walk('Customer', { read: false }), walk('Invoice')],
  }));
  ok(html.includes('Your customers') && /not read/i.test(html),
    '🔴 a read that was never run is NAMED as not run — omitting it would read as "nothing to report"');
  ok(/should be read as a verdict|nothing in this report is based on it/i.test(html),
    'and it says what that means for the rest of the document');
}
{
  const html = renderBooksReportHtml(build({
    walks: [walk('Invoice', { complete: false, retrieved: 900, expected: 1469 })],
  }));
  ok(/NOT proven complete/i.test(html) && html.includes('900'),
    'a read that could not be proven whole says so, with what it did get');
  ok(!html.includes('all 1,469 of them'), 'and never claims the total it failed to reach');
}

// ── §C 🔴 no jargon, no field names, no customer names ───────────────────────
{
  const html = renderBooksReportHtml(build({
    findings: [finding(), finding({ id: 'f2', tier: 'risk', sentence: 'Two invoices share a number.',
      population: { matched: 2, of: 1469, noun: 'invoices' }, value: null })],
  }));
  const BANNED = ['DocNumber', 'UnitPrice', 'QueryResponse', 'business_id', 'qb_invoice_id',
                  'PurchaseCost', 'CustomerRef', 'Intuit', 'RLS', 'null', 'undefined',
                  'business_inventory', 'order_items'];
  const hits = BANNED.filter(b => html.includes(b));
  ok(hits.length === 0, `🔴 no jargon, table name or field name reaches the page — found: ${hits.join(', ') || 'none'}`);
  ok(!html.includes('Item<') && !html.includes('>Customer<') && !html.includes('>Invoice<'),
    "Intuit's own entity words never appear as headings — the owner's words do");
  ok(html.includes('Your products &amp; services') && html.includes('Your invoice history'),
    'and the owner\'s words are what she reads');
  ok(html.includes('9 of 230'),
    '🔴 every count carries its denominator — "9" alone reads as a verdict');
}

// ── §D the recommendation, all four parts ────────────────────────────────────
{
  const html = renderBooksReportHtml(build({
    findings: [finding({ recommendation: {
      statusQuoCost: 4820, remedy: 'Charge your published price.', remedyCost: 0,
      paybackMonths: 0, limits: 'It cannot see a discount you meant to give.',
    } })],
  }));
  ok(html.includes('$4,820'), 'part 1 — what the status quo costs, in whole dollars');
  ok(html.includes('Charge your published price.'), 'part 2 — the remedy');
  ok(/decision, not a purchase/i.test(html),
    '🔴 part 3 — a zero remedy cost is SAID rather than left blank, because a blank reads as an unknown');
  ok(/Immediately/i.test(html), 'part 4 — the payback');
  ok(/cannot see a discount you meant to give/i.test(html),
    '⚠️ and what it does NOT fix — a recommendation that hides its limits gets found out on day two');
}
{
  const html = renderBooksReportHtml(build({
    findings: [finding({ recommendation: {
      statusQuoCost: 36735, remedy: 'Move typed-in payments to tapped.', remedyCost: 5000,
      paybackMonths: 6, limits: 'Tap to Pay needs a phone; a tablet needs a reader.',
    } })],
  }));
  ok(html.includes('$5,000') && /about 6 months/i.test(html),
    'a NON-zero remedy cost and a real payback period render as themselves');
  ok(!/decision, not a purchase/i.test(html), 'and the zero-cost wording does not leak onto a purchase');
}

// ── §E what could not be worked out ──────────────────────────────────────────
{
  const html = renderBooksReportHtml(build({
    findings: [finding(), finding({ id: 'ar', measured: false, sentence: '',
      notMeasured: 'We cannot tell you what you are owed.', value: null })],
  }));
  ok(/What we could not work out/i.test(html), '🔴 the section is present');
  ok(html.includes('We cannot tell you what you are owed.'), 'and names each question it could not answer');
  ok(/neither good nor bad|good news or bad/i.test(html),
    '🔴 framed as neither good news nor bad — a silent omission reads as a clean bill of health');
}
{
  const html = renderBooksReportHtml(build({ findings: [finding()] }));
  ok(!/What we could not work out/i.test(html),
    'and the section is absent entirely when everything could be computed — not an empty heading');
}

// ── §F 🔴 IT ASKS FOR NOTHING ────────────────────────────────────────────────
{
  const html = renderBooksReportHtml(build());

  // 🔴 THIS PROBE WAS NARROWED ON 2026-09-03, AND THE NARROWING IS THE INTERESTING PART.
  // It used to ban the STRING `<button` outright, and it caught the save control the moment one
  // was added — correctly, by its own text, and for the wrong reason. "The report asks for
  // nothing" is about DECISIONS: no Accept, no Ingest, no next step, nothing that advances a
  // funnel. A control that lets an owner KEEP the document asks for nothing; it is the opposite
  // of an ask, and the report having no way to be saved was a defect rather than a virtue.
  //
  // ⚠️ SO THE BAN IS NOW ON THE ASK, AND THE SAVE CONTROL IS ASSERTED POSITIVELY BELOW —
  // because a probe that merely stopped banning buttons would let a "Continue" through as long
  // as nobody wrote the word.
  // ⚠️ `Ingest` ALONE cannot be banned — the report's own TITLE is "FIRST LOOK PRIOR TO
  // INGEST", which is a description of when it was written, not an invitation to press
  // anything. The banned forms are imperative.
  const ASKS = ['Accept', 'Ingest my data', 'Ingest now', 'Continue', 'Next step', 'Click here', 'Get started', 'Sign up'];
  const found = ASKS.filter(a => html.toLowerCase().includes(a.toLowerCase()));
  ok(found.length === 0,
    `🔴 the report asks for NO DECISION — the screen is where a decision is made; this is what they keep. Found: ${found.join(', ') || 'none'}`);

  // The ONLY control it may carry, and it must be exactly one.
  ok((html.match(/<button/g) ?? []).length === 1,
    '🔴 EXACTLY ONE control — the save bar. A second button on this page is a funnel appearing');
  ok(/window\.print\(\)/.test(html),
    'and it is the print/save control: the owner can keep the document. Its absence was the real gap inside the "do we need a PDF library" question — the answer to which was already settled as print-to-PDF');
  ok(/@media print\s*\{\s*\.bar\s*\{\s*display:\s*none/.test(html),
    '🔴 AND IT REMOVES ITSELF FROM THE PRINT — the saved PDF must not carry a button nobody can press on paper');
  ok(!html.includes('<script'), 'and carries no script — it is a document, not an application');
}

// ── §G escaping — a catalogue is free text ───────────────────────────────────
{
  const html = renderBooksReportHtml(build({
    findings: [finding({ sentence: 'The item 3" Caliper <B&B> was sold below list.' })],
  }));
  ok(html.includes('&lt;B&amp;B&gt;'),
    '🔴 anything from their own books is escaped — an item name is free text, and one with a bracket in it would break the document they are about to hand someone');
  ok(!html.includes('<B&B>'), 'and the raw form does not survive into the markup');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// §H 🔴 THE CUSTOMER DOCUMENT CARRIES ONE NUMBER PER FACT, AND ONE DATE: WHEN IT WAS READ
// ══════════════════════════════════════════════════════════════════════════════════════════
// WHAT WAS ON THE PAGE HANDED TO TERRY, and why this section exists: every finding printed its
// live figure AND a "Re-measured 3 September 2026" line, and they disagreed —
//   "$32,934 is still owed to you across 15 invoices"
//   "Re-measured 3 September 2026: CONFIRMED — $30,736 across 14 invoices"
// Two numbers for one fact, disagreeing, in a document a customer keeps. Alongside working
// notes addressed to us: "41 is not derivable from any of the three reads", "the quoted pair is
// right under that second definition", "not previously computed".
//
// 🔴 NO PROBE IN THIS FILE EVER ASSERTED ANYTHING ABOUT THAT LINE, in either direction. The
// report suite tested structure and never read the sentences the document actually prints —
// which is why a working note could sit in a customer deliverable through a green suite.
//
// The drift record is NOT deleted, it is RELOCATED to the screen panel David reads. So these
// probes assert an AUDIENCE boundary: `remeasured` is populated on every fixture finding here,
// and must appear nowhere in the rendered HTML.
{
  const html = renderBooksReportHtml(build());

  ok(html.indexOf('Re-measured') === -1 && html.indexOf('re-measured') === -1,
    '🔴 the report prints NO re-measurement line — the fixture findings all carry one, so this can only pass by the renderer refusing it');
  ok(html.indexOf('$30,736') === -1,
    'and the second, disagreeing figure is not in the document at all — one fact, one number');
  for (const note of ['not derivable', 'not previously computed', 'second definition']) {
    ok(html.indexOf(note) === -1,
      `and the working note "${note}" does not reach a page a customer keeps`);
  }

  // 🔴 THE COULD-NOT-WORK-OUT PAGE TOO — ADDED AFTER A MUTANT SURVIVED (R13).
  // The block above renders only MEASURED findings, so it exercised one of the two places that
  // printed the drift line. A mutant restoring it on the OTHER page passed green: the notes most
  // likely to be internal are attached to the rules that could not be computed, which is exactly
  // the page this probe was not looking at. Both surfaces, or the probe covers the tidier half.
  const unmeasured = renderBooksReportHtml(build({ findings: [finding({
    measured: false,
    notMeasured: 'We could not work out how many income accounts are in use.',
    remeasured: '13 accounts across the 685 products. 41 is not derivable from any of the three reads.',
  })] }));
  ok(unmeasured.indexOf('We could not work out how many income accounts') !== -1,
    'the unmeasured finding really is on the page — otherwise the next assertion proves nothing');
  ok(unmeasured.indexOf('Re-measured') === -1 && unmeasured.indexOf('not derivable') === -1,
    '🔴 and the could-not-work-out page carries no drift line and no working note either — the page whose notes are MOST likely to be internal');

  // ── the one date, and it is the READ ──────────────────────────────────────────────
  ok(html.indexOf('2026-08-29') !== -1,
    '🔴 the page carries the date their books were READ (2026-08-29), taken off the walks');
  ok(html.indexOf('Generated') === -1,
    'and it does NOT say "Generated" — that was the day someone pressed a button, not the day the figures became true');
  ok((html.match(/2026-\d\d-\d\d/g) ?? []).every(d => d === '2026-08-29'),
    '🔴 and it is the ONLY date on the page — every date the document prints is that same read date');
}

// ── §H2 the read date is derived, not assumed: span, absence, and a negative control ──
{
  // Walks read on different days: BOTH ends named, never one standing in for the other.
  const span = renderBooksReportHtml(build({ walks: [
    walk('Item',     { queriedAt: '2026-08-29T09:00:00.000Z' }),
    walk('Customer', { queriedAt: '2026-08-29T09:10:00.000Z' }),
    walk('Invoice',  { queriedAt: '2026-09-04T11:00:00.000Z' }),
  ] }));
  ok(span.indexOf('2026-08-29') !== -1 && span.indexOf('2026-09-04') !== -1,
    '🔴 walks read on different days print BOTH ends — collapsing them would assert a read that did not happen on that day for half the figures below it');

  // Nothing read: it says so. A date over a report built on nothing is its most confident-
  // looking claim and its least true one.
  const none = renderBooksReportHtml(build({ walks: [
    walk('Item',     { read: false, queriedAt: null }),
    walk('Customer', { read: false, queriedAt: null }),
    walk('Invoice',  { read: false, queriedAt: null }),
  ] }));
  ok(none.indexOf('Nothing has been read yet') !== -1,
    'a report over nothing SAYS it is over nothing rather than falling back to today');
  ok((none.match(/\d{4}-\d\d-\d\d/g) ?? []).length === 0,
    '🔴 and it prints no date at all — not even one that looks harmless');

  // NEGATIVE CONTROL (R-33): an unread walk must not contribute its stale timestamp.
  const mixed = buildBooksReport({
    walks: [walk('Item', { queriedAt: '2026-09-04T11:00:00.000Z' }),
            walk('Customer', { read: false, queriedAt: '2026-01-01T00:00:00.000Z' }),
            walk('Invoice', { read: false, queriedAt: null })],
    findings: [finding()], corrections: [],
  });
  ok(mixed.readOn.kind === 'one' && mixed.readOn.date === '2026-09-04',
    '🔴 NEGATIVE CONTROL — a walk that never RAN contributes no date, even carrying one: a read that did not happen did not happen on a day');
}


console.log(`\n  booksReport — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
