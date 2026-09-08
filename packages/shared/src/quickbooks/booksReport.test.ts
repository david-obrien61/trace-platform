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
         CLEAN_HEADING, type WalkState, type ReportInput } from './booksReport';
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
  recommendation: null, needsAnswer: null,
  // The five properties, 2026-09-08. A fixture that omits them is a fixture that cannot provoke
  // the renderer reading them, which is #182's shape — a probe that never reaches its target.
  version: 1, rows: null, rowsTotal: 0, window: null, blocks: [], clean: false, ...o,
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


// ══ §G 🔴 THE PDF CARRIES NO CUSTOMER NAMES — DAVID'S RULING, ENFORCED HERE AND NOT IN PROSE ══
//
// `Finding` now carries the RECORDS behind a count, because a union of three duplicate axes cannot
// be computed from tallies. Every one of those rows is a real person's name. The screen shows them;
// the document an accountant keeps does not, and the only thing that can hold that line as the
// renderer grows is a probe that fails when a name reaches the page.
{
  const NAMES = ['Rebeca Cedillos', 'Rebecca Cedillos', 'Turnstile Ranch', 'Turnstyle Ranch'];
  const withRows = finding({
    id: 'customers-entered-more-than-once', tier: 'risk', shape: 'reused-unique-value', value: null,
    sentence: '4 customer records look like the same person or company entered more than once.',
    population: { matched: 4, of: 1953, noun: 'customer records' },
    rows: NAMES.map((label, i) => ({ id: `c${i}`, label, group: 'g1', note: 'a shared email address' })),
    rowsTotal: 4,
  });
  const html = renderBooksReportHtml(build({ findings: [withRows] }));

  for (const name of NAMES) {
    ok(!html.includes(name),
      `🔴 "${name}" DOES NOT REACH THE PAGE. The finding carries it, the screen renders it, and the document a customer emails to their accountant must not — a list of their customers in that document is a data export nobody asked for`);
  }
  ok(!html.includes('c0') || !html.includes('"c0"'),
    'and neither does the record id — an identifier is not a name and is still their data');
  ok(html.includes('4 of 1,953'),
    '🔴 THE COUNT DOES REACH IT. Withholding the rows is not withholding the finding: "we identified 4 potential duplicates" is exactly what the ruling says the paper carries');
  ok(html.includes('Customers screen in Cultivar'),
    '🔴 AND IT NAMES WHERE TO GO. A document that says "review your customers" and stops has handed somebody a task with no next step');
  ok(/fix them in QuickBooks and read your books again/.test(html),
    'including what to do when she gets there, which is the reason the finding exists at all');

  // NEGATIVE CONTROL — the probe must be able to FAIL. A finding with NO rows must not print the
  // pointer, or the assertion above would pass on a renderer that printed it unconditionally.
  const noRows = renderBooksReportHtml(build({ findings: [finding()] }));
  ok(!noRows.includes('Customers screen in Cultivar'),
    'a finding with no records to look at does not send the reader anywhere — the pointer is conditional, so the assertion above is a real one');

  // 🔴 THE SAME RULE THROUGH THE OTHER RENDERER, AND MUTANT R24 IS WHY IT IS HERE.
  // The clean section has its own renderer, and a leak added there passed every assertion above —
  // which is exactly how a rule enforced in ONE place gets around itself. A clean finding does not
  // carry rows today (matched 0 means no groups), so this is a REACHABLE-BUT-UNREACHED state: the
  // moment a future rule reports clean while carrying context rows, the ruling must still hold.
  const cleanWithRows = renderBooksReportHtml(build({ findings: [finding({
    clean: true, value: null,
    sentence: 'No two of your customer records share an email address, a phone number or a name.',
    population: { matched: 0, of: 1953, noun: 'customer records' },
    rows: [{ id: 'c1', label: 'Turnstile Ranch', group: 'g1', note: 'a shared email address' }],
    rowsTotal: 1,
  })] }));
  ok(!cleanWithRows.includes('Turnstile Ranch'),
    '🔴 AND NO NAME REACHES THE PAGE THROUGH THE CLEAN SECTION EITHER. The rule is "no customer name on the paper", not "no customer name in one function" — and a second renderer is where the first one\'s rule quietly stops applying');
}

// ══ §H 🔴 A CLEAN RESULT IS RENDERED AS LOUDLY AS A FAULT ══════════════════════════════════
{
  const clean = finding({
    id: 'same-document-recorded-twice', tier: 'risk', clean: true, value: null,
    sentence: 'No two invoices record the same customer, the same day, the same items AND the same total.',
    population: { matched: 0, of: 1480, noun: 'invoices we could compare' },
  });
  const r = build({ findings: [finding(), clean] });
  ok(r.clean.length === 1 && r.measured.length === 1,
    '🔴 CLEAN AND NOT-CLEAN ARE SPLIT, NOT FILTERED. Both halves reach the page; a clean finding dropped here is indistinguishable from a rule nobody ever wrote');
  const html = renderBooksReportHtml(r);
  ok(html.includes(CLEAN_HEADING),
    'the clean section has its own heading, phrased as a result — "what we checked and found nothing wrong with", never "nothing to report"');
  ok(html.includes('checked 1,480 invoices we could compare'),
    '🔴 AND THE POPULATION IS THE POINT. "Nothing found" over 1,480 records is a different statement from "nothing found" over three, and only the denominator tells them apart');
  ok(html.indexOf(CLEAN_HEADING) < html.indexOf('What we could not work out')
     || !html.includes('What we could not work out'),
    'the clean results sit ABOVE what could not be worked out — a result is a result, and "we could not check" is not one');

  // the clean finding is NOT in the fault tiers
  const faultSection = html.slice(html.indexOf('Where there is money in this'), html.indexOf(CLEAN_HEADING));
  ok(!faultSection.includes('No two invoices record the same'),
    'and it does not also appear among the faults, which would say the same thing twice with opposite meanings');
}

// ══ §J 🔴 THE WINDOW AND THE BLOCKED CAPABILITIES ══════════════════════════════════════════
{
  const windowed = finding({
    window: { from: '2025-04-30', to: '2026-09-03', of: 'your invoice history' },
    blocks: ['Campaigns', 'Review requests'],
  });
  const html = renderBooksReportHtml(build({ findings: [windowed] }));
  ok(html.includes('Measured over your invoice history, 2025-04-30 to 2026-09-03'),
    '🔴 THE PERIOD IS PRINTED BESIDE THE FINDING, and it is NOT the read date. The page already says when the books were read; this says what span of trading the figure covers, and a reader will otherwise assume they are one fact');
  ok(html.includes('What this switches off: Campaigns · Review requests'),
    '🔴 CAPABILITY NAMES, NEVER FAULT DESCRIPTIONS. "Campaigns", not "125 customers have no contact details" — the sentence already says what is true, this says what she cannot do until it changes');

  const bare = renderBooksReportHtml(build({ findings: [finding()] }));
  ok(!bare.includes('Measured over') && !bare.includes('What this switches off'),
    'a finding with no window and nothing blocked prints neither line — so both assertions above are real rather than matching boilerplate');
}

console.log(`\n  booksReport — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
