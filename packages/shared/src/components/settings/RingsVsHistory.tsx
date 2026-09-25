// ============================================================
// RingsVsHistory — do the rings match what was actually charged? (PLATFORM — @trace/shared)
// PURPOSE:      Show, per ring, how many past trip charges agree with it and how many do not —
//               and how many deliveries could not be compared at all because nobody knows where
//               they went.
// DEPENDENCIES: business-logic/deliveryRings (compareRingsToHistory, pure) ·
//               business-logic/ringHistoryRead (the read). Reads only; writes nothing.
// OUTPUTS:      <RingsVsHistory>
//
// 🔴 IT RUNS OPPOSITE TO THE SEED, WHICH IS THE ONLY REASON IT IS WORTH ANYTHING.
// `proposeRingsFromCharges` DERIVED each ring's radius from a charge, assuming $3.50 a loaded
// mile held. That assumption is exactly what nobody has checked. This measures how far each
// delivery actually went and asks whether the ring covering that distance charges what the
// invoice charged. One function derives; this one is allowed to disagree with it.
//
// 🔴 THE UNCOMPARABLE COUNT IS THE HEADLINE WHENEVER IT IS LARGE, AND TONIGHT IT IS.
// 208 of 1,497 LAWNS addresses are located. "Your rings match what you charged" printed above
// hundreds of deliveries nobody has placed would be the most confident lie this screen could tell,
// so the count sits in the same sentence as the verdict rather than in a footnote.
// ============================================================
import { useEffect, useState } from 'react';
import { compareRingsToHistory, type DeliveryRing, type Point, type HistoryComparison } from '../../business-logic/deliveryRings';
import { readRingHistory } from '../../business-logic/ringHistoryRead';

const TRACE_RINGS = true;   // STD-003: on by default until owner-proven.

interface Props {
  db: any;
  businessId: string;
  depot: Point | null;
  rings: readonly DeliveryRing[];
  /** Compact form for the map's side panel; the full table is for Settings → Delivery. */
  compact?: boolean;
}

export function RingsVsHistory({ db, businessId, depot, rings, compact = false }: Props) {
  const [cmp, setCmp] = useState<HistoryComparison | null>(null);
  const [found, setFound] = useState(0);
  const [placed, setPlaced] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      const got = await readRingHistory(db, businessId);
      if (!alive) return;
      setFound(got.linesFound); setPlaced(got.linesPlaced); setFailed(got.failed);
      setCmp(got.failed ? null : compareRingsToHistory({ depot, rings, observations: got.observations }));
      setLoading(false);
      if (TRACE_RINGS) console.log('[TRACE:RINGS] rings vs history', {
        linesFound: got.linesFound, linesPlaced: got.linesPlaced, failed: got.failed,
      });
    })();
    return () => { alive = false; };
  }, [db, businessId, depot, rings]);

  if (loading) return <p style={hint}>Reading what you charged…</p>;
  if (failed) {
    return (
      <div style={warn}>
        <strong>Could not read your invoices.</strong> {failed} — so nothing below is a comparison,
        and an empty result here does not mean your rings agree.
      </div>
    );
  }
  if (!cmp || found === 0) {
    return <p style={hint}>No past trip charges to compare against yet.</p>;
  }

  const uncomparable = found - placed;
  const disagreeing = cmp.rings.filter(r => r.verdict === 'disagrees');

  return (
    <div>
      {/* 🔴 THE SENTENCE CARRIES BOTH HALVES. A verdict without the uncomparable count is a
          statement about a sample nobody sized. */}
      <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0 0 8px', lineHeight: 1.5 }}>
        <strong>{placed} of {found} past trip charges could be compared.</strong>
        {uncomparable > 0 && (
          <> {uncomparable} could not — those customers have no located address, or several and we
          cannot tell which one the truck went to. They are not counted as agreeing OR disagreeing.</>
        )}
        {' '}{disagreeing.length === 0
          ? 'Every ring that has enough history matches what you charged.'
          : `${disagreeing.length} ring${disagreeing.length === 1 ? '' : 's'} charge${disagreeing.length === 1 ? 's' : ''} something your invoices do not.`}
      </p>

      {!compact && (
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={th}>Ring</th><th style={th}>Ring charges</th><th style={th}>Compared</th>
              <th style={th}>Agreed</th><th style={th}>Usually charged</th><th style={th}>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {cmp.rings.map(r => (
              <tr key={r.ordinal} style={{ borderTop: '1px solid #eef2e6' }}>
                <td style={td}>ring {r.ordinal} — to {r.ring.outer_radius_miles} mi</td>
                <td style={td}>${Number(r.ring.charge).toFixed(2)}</td>
                <td style={td}>{r.observed}</td>
                <td style={td}>{r.agreed}</td>
                <td style={td}>{r.medianCharged === null ? '—'
                  : `$${r.medianCharged.toFixed(2)}${r.spread && r.spread.min !== r.spread.max ? ` ($${r.spread.min.toFixed(2)}–$${r.spread.max.toFixed(2)})` : ''}`}</td>
                <td style={{ ...td, color: r.verdict === 'disagrees' ? '#A32D2D' : r.verdict === 'agrees' ? '#27500A' : '#6b7280' }}>
                  {r.verdict === 'too-few' ? 'not enough history to say' : r.verdict}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={hint}>
        Distances are straight-line from your yard. A $0 trip charge is read as a waiver, not a
        price, and is left out. <strong>&ldquo;Not enough history to say&rdquo; is not agreement</strong> —
        it means fewer than three comparable deliveries landed in that ring.
      </p>
    </div>
  );
}

const hint: React.CSSProperties = { fontSize: '0.75rem', color: '#6b7280', margin: '8px 0 0', lineHeight: 1.45 };
const th: React.CSSProperties = { padding: '4px 6px' };
const td: React.CSSProperties = { padding: '5px 6px' };
const warn: React.CSSProperties = {
  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
  padding: '0.75rem', fontSize: '0.85rem', color: '#991b1b',
};
