// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: show a business what is actually in its own QuickBooks, in its own words, BETWEEN
//   reading the books and importing them — money first, then risk, then tidiness.
// DEPENDENCIES: ../quickbooks/booksFindings (evaluateBooks — the rules, and the ONLY place the
//   sentences and the sort live).
// OUTPUTS: <BooksReview findings /> — mounted inside QboBooksReader, above the ingest panels.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 NOTHING ON THIS PANEL CAN STOP ANYTHING, AND THAT IS ITS FIRST PROPERTY.
// ══════════════════════════════════════════════════════════════════════════════
//   There is no acknowledge-to-continue, no "resolve these first", no disabled button waiting
//   on a checkbox. The panel sits BESIDE the import controls, not in front of them. If a
//   finding could stop Lauren she is stuck at 4pm on a Friday and phones David — and the build
//   has failed regardless of how good the finding was. She can press ingest with every finding
//   unread and it works.
//
// 🔴 IT RENDERS THE UNMEASURED ROWS TOO, IN GREY, SAYING WHY. Hiding them would produce a
//   shorter, calmer, more confident screen that quietly asserts everything worth checking was
//   checked. A row the reader cannot see is a row the reader assumes passed (D-9 / A9), and
//   the whole point of a review is that its silences are honest.
//
// 🔴 EVERY MEASURED ROW SHOWS ITS POPULATION AND THE QUOTED FIGURE BESIDE THE MEASURED ONE.
//   The quoted numbers come from an analysis of the 29 August capture and none was re-measured
//   before it was written down — so the screen shows both and lets the reader see the drift,
//   rather than restating a stale number as a current fact (R-26). They are deliberately never
//   subtracted from each other: one is a quote, the other is a measurement.
//
// ⚠️ NOTHING HERE NAMES A PERSON. The findings carry counts and nouns only — `evaluateBooks`
//   receives parsed invoice rows that have no customer NAME on them at all (invoiceList.ts
//   drops the field structurally) and a customer BREAKDOWN rather than customer records. R-24
//   clause (b) holds by construction, not by care.
// ─────────────────────────────────────────────────────────────────────────────
import type { Finding, FindingTier } from '../quickbooks/booksFindings';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const AMBER = '#92400e';

const TIER_HEADING: Record<FindingTier, string> = {
  // 🔴 THE HEADINGS ARE CLAIMS AND EACH MUST HOLD FOR EVERY ROW BENEATH IT (§6 r18). None of
  // the three asserts anything is WRONG — "worth money", not "errors"; "worth knowing", not
  // "problems" — because an unmeasured row sits under the same heading as a measured one, and
  // a heading saying "problems found" above "we did not check this" says two things at once.
  money:    'Worth money',
  risk:     'Worth checking',
  tidiness: 'Worth knowing',
};

const TIER_SUB: Record<FindingTier, string> = {
  money:    'Things that look like they cost you money, or could.',
  risk:     'Things that could cause trouble later if nobody knows about them.',
  tidiness: 'Things that are simply true about your books, and useful to know.',
};

export function BooksReview({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;
  const measuredCount = findings.filter(f => f.measured).length;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
      <p style={{ fontSize: '0.875rem', color: DARK, fontWeight: 700, margin: '0 0 4px' }}>
        What we found in your books
      </p>
      {/* THE COUNT IS THE DENOMINATOR OF THE WHOLE PANEL. "9 of 12 checked" is the honest
          summary; "9 findings" would let three unrun checks disappear into a tidy number. */}
      <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 12px', lineHeight: 1.5 }}>
        {measuredCount} of {findings.length} checks could be run on what has been read so far.
        Nothing here has to be dealt with before importing — you can read it now or later, and
        the import works either way.
      </p>

      {(Object.keys(TIER_HEADING) as FindingTier[]).map(tier => {
        const rows = findings.filter(f => f.tier === tier);
        if (rows.length === 0) return null;
        return (
          <div key={tier} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 2px' }}>
              {TIER_HEADING[tier]}
            </p>
            <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 8px' }}>{TIER_SUB[tier]}</p>

            {rows.map(f => (
              <div
                key={f.id}
                style={{
                  padding: '10px 12px', borderRadius: 9, marginBottom: 8,
                  background: f.measured ? '#f9fafb' : '#fff',
                  border: `1px solid ${f.measured ? '#e5e7eb' : '#f3f4f6'}`,
                }}
              >
                {f.measured ? (
                  <>
                    <p style={{ fontSize: '0.8125rem', color: DARK, margin: 0, lineHeight: 1.55 }}>
                      {f.sentence}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: GRAY, margin: '6px 0 0' }}>
                      {/* POPULATION FIRST AND ALWAYS. "22 of 1,469 invoices", never "22". */}
                      <strong style={{ color: DARK }}>
                        {f.population.matched.toLocaleString()} of {f.population.of.toLocaleString()}
                      </strong>{' '}
                      {f.population.noun}
                      {' · '}
                      {/* The QUOTE, labelled as a quote and dated, so it cannot be mistaken for
                          a second measurement of the same thing. */}
                      <span style={{ color: AMBER }}>29 Aug analysis said: {f.quoted}</span>
                    </p>
                    {f.needsAnswer && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '0.8125rem', color: DARK, margin: '0 0 6px', fontWeight: 600 }}>
                          {f.needsAnswer.question}
                        </p>
                        {/* ⚠️ THE CHOICES ARE SHOWN AND NOT YET WIRED, AND THE SCREEN SAYS SO
                            RATHER THAN OFFERING A BUTTON THAT DOES NOTHING. A control that
                            looks like it acts and does not is the dead affordance §1.6 item 5
                            forbids — worse here than showing nothing, because she would
                            believe she had answered. */}
                        <p style={{ fontSize: '0.75rem', color: GRAY, margin: 0, lineHeight: 1.5 }}>
                          Your options are: {f.needsAnswer.options.join(' · ')}. There is nowhere
                          to record your answer yet — tell David, and it will not hold up the import.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: GRAY, margin: 0, lineHeight: 1.55 }}>
                    {/* An unmeasured row NAMES ITSELF and says what is missing. It is grey and
                        quiet, and it is present — the two together are the honest rendering. */}
                    <span style={{ color: '#9ca3af' }}>Not checked — </span>
                    {f.notMeasured}
                    <span style={{ color: AMBER }}> · 29 Aug analysis said: {f.quoted}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <p style={{ fontSize: '0.75rem', color: GREEN, margin: '4px 0 0', lineHeight: 1.5 }}>
        Nothing on this panel changed anything in QuickBooks or here. It is a read.
      </p>
    </div>
  );
}
