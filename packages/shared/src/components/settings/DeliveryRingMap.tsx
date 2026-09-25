// ============================================================
// DeliveryRingMap — the delivery rings, drawn (PLATFORM — @trace/shared)
// PURPOSE:      Settings → Delivery. The owner sees their delivery area as rings, sees where
//               their located customers actually fall, seeds the rings from their own invoice
//               history, and edits them. David 2026-09-23: "the ring map is the key."
// DEPENDENCIES: business-logic/deliveryRings (pure) · business_delivery_rings (20260924e).
// OUTPUTS:      <DeliveryRingMap>.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ §6 r16 — THE STANDARD, NAMED, AND THE DELIBERATE DEVIATION
// ═════════════════════════════════════════════════════════════════════════════
// THE STANDARD for a delivery-zone editor is a slippy map (Google Maps, Leaflet) with circle
// overlays the owner drags — Shopify, DoorDash and every route planner do exactly that, and it
// gives street context: which side of the river, which subdivision.
//
// THIS IS NOT THAT, AND THE REASON IS A DEPENDENCY DECISION THAT IS DAVID'S, NOT MINE. A slippy
// map means a new front-end dependency and a map key in the browser, on the same day a Google
// key had to be rotated for reaching a chat window. So V1 draws the rings and the real customer
// positions in plain SVG: zero dependencies, nothing keyed, and every dot placed by its TRUE
// bearing and distance from the depot, so the SHAPE of the delivery area is honest even though
// the streets are not drawn.
//
// 🔴 WHAT IS LOST IS STATED ON THE SCREEN, NOT HIDDEN: no streets, and straight-line distance
// rather than road distance. An owner reading "13 miles" must not think a truck drives 13.
//
// ── SHOW, DON'T PRICE (David, 2026-09-23) ───────────────────────────────────────────────────
// Customers beyond the last ring are DRAWN, counted, and carry no price. There is no
// "everywhere else" ring to fall into and no default charge anywhere in this file.
// ============================================================
import { useMemo, useState } from 'react';
import {
  distanceMiles, orderedRings, proposeRingsFromCharges, impliedMiles,
  type DeliveryRing, type Point, type ProposedRing,
} from '../../business-logic/deliveryRings';

export interface LocatedCustomer { id: string; name: string; latitude: number; longitude: number }

interface Props {
  depot: Point | null;
  rings: readonly DeliveryRing[];
  customers: readonly LocatedCustomer[];
  /** Trip-charge amounts off their own invoices, for the seed proposal. */
  charges?: readonly { charge: number }[];
  /** Addresses with no coordinate yet — counted, never plotted. */
  unlocatedCount?: number;
  ratePerMile?: number;
  onSave?: (rings: DeliveryRing[]) => void | Promise<void>;
  canEdit?: boolean;
}

const GREEN = '#27500A';
const SIZE = 340;           // the SVG viewport, square
const CENTRE = SIZE / 2;

export function DeliveryRingMap({
  depot, rings, customers, charges = [], unlocatedCount = 0,
  ratePerMile = 3.5, onSave, canEdit = false,
}: Props) {
  // Only the SEED proposal needs a single reading (a radius must be one number). The rings
  // themselves show both, above. Round trip is the seed's starting assumption and the proposal
  // says so in its own note — it is not a ruling on what a loaded mile means.
  const [basis] = useState<'one-way' | 'round-trip'>('round-trip');
  const [draft, setDraft] = useState<DeliveryRing[] | null>(null);
  const live = draft ?? orderedRings(rings);

  // Every distance measured once, from the real coordinates.
  const plotted = useMemo(() => customers.map(c => ({
    ...c, miles: distanceMiles(depot, c) ?? null,
  })).filter(c => c.miles !== null) as Array<LocatedCustomer & { miles: number }>,
  [customers, depot]);

  const outerMiles = live.length ? live[live.length - 1].outer_radius_miles : 0;
  const furthest = plotted.reduce((m, c) => Math.max(m, c.miles), 0);
  // 🔴 THE SCALE INCLUDES THE CUSTOMERS OUTSIDE THE RINGS. Scaling to the largest ring alone
  // would push every outside customer off the edge — and those are precisely the ones the owner
  // opened this screen to see.
  const scaleMiles = Math.max(outerMiles, furthest, 1) * 1.08;
  const toXY = (c: { miles: number; latitude: number; longitude: number }) => {
    if (!depot) return { x: CENTRE, y: CENTRE };
    // True bearing from the depot, so the shape of the delivery area is real.
    const dx = (c.longitude - depot.longitude) * Math.cos((depot.latitude * Math.PI) / 180);
    const dy = c.latitude - depot.latitude;
    const len = Math.hypot(dx, dy) || 1;
    const r = (c.miles / scaleMiles) * (CENTRE - 14);
    return { x: CENTRE + (dx / len) * r, y: CENTRE - (dy / len) * r };
  };

  const outside = plotted.filter(c => !live.some(r => c.miles <= r.outer_radius_miles));
  const proposals: ProposedRing[] = useMemo(
    () => (live.length === 0 ? proposeRingsFromCharges(charges, ratePerMile, basis) : []),
    [live.length, charges, ratePerMile, basis],
  );

  if (!depot) {
    // A ring map with no centre is not a map with a missing dot — it is a screen that cannot
    // answer its own question, and it says which fact is missing rather than drawing nothing.
    return (
      <div style={{ padding: '1rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
        <strong>Your own address has no coordinate yet.</strong>
        <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
          The rings are measured from your yard, so that address has to be located first.
          Settings → Business → check the address.
        </div>
      </div>
    );
  }

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
           aria-label={`Delivery rings with ${plotted.length} located customers`}
           style={{ maxWidth: SIZE, display: 'block', margin: '0 auto' }}>
        {[...live].reverse().map(r => {
          const rad = (r.outer_radius_miles / scaleMiles) * (CENTRE - 14);
          return (
            <g key={r.id ?? r.outer_radius_miles}>
              <circle cx={CENTRE} cy={CENTRE} r={rad} fill={GREEN} fillOpacity={0.05}
                      stroke={GREEN} strokeOpacity={0.45} strokeWidth={1} />
              <text x={CENTRE} y={CENTRE - rad + 12} textAnchor="middle"
                    fontSize={10} fill={GREEN}>{r.outer_radius_miles} mi · ${r.charge}</text>
            </g>
          );
        })}
        {plotted.map(c => {
          const { x, y } = toXY(c);
          const isOut = !live.some(r => c.miles <= r.outer_radius_miles);
          return <circle key={c.id} cx={x} cy={y} r={2.6}
                         fill={isOut ? '#A32D2D' : GREEN} fillOpacity={isOut ? 0.9 : 0.55}>
            <title>{`${c.name} — ${c.miles.toFixed(1)} straight-line miles`}</title>
          </circle>;
        })}
        <circle cx={CENTRE} cy={CENTRE} r={4} fill="#111" />
        <text x={CENTRE} y={CENTRE + 16} textAnchor="middle" fontSize={10} fill="#111">your yard</text>
      </svg>

      {/* 🔴 SAID OUT LOUD, EVERY TIME. A number a person will quote a customer must carry what
          it actually measured — and this one measures the crow's flight, not the road. */}
      <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
        Straight-line miles from your yard — a truck drives further. No streets are drawn.
      </p>

      <div style={{ fontSize: '0.9rem', marginTop: 10 }}>
        <div>{plotted.length} located customer{plotted.length === 1 ? '' : 's'} shown.</div>
        {outside.length > 0 && (
          <div style={{ color: '#A32D2D' }}>
            {outside.length} outside your rings — no charge is set for them.
          </div>
        )}
        {unlocatedCount > 0 && (
          // NOT the same sentence as "outside". One is a place you have not priced; the other is
          // an address we could not find. Collapsing them sends the owner to the wrong screen.
          <div style={{ color: '#92400e' }}>
            {unlocatedCount} address{unlocatedCount === 1 ? '' : 'es'} could not be placed — they are saved and unpriced.
          </div>
        )}
      </div>

      {/* 🔴 BOTH READINGS, SIDE BY SIDE, BESIDE EACH RING — David, 2026-09-16: Lauren decides.
          A toggle would show ONE of them and hide the other behind a tap, which is the wrong
          shape for a number whose two readings differ by a factor of two. She should not have to
          discover that; she should see it. */}
      {live.length > 0 && (
        <table style={{ width: '100%', marginTop: 14, fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '4px 6px' }}>Ring</th>
              <th style={{ padding: '4px 6px' }}>Charge</th>
              <th style={{ padding: '4px 6px' }}>as one way</th>
              <th style={{ padding: '4px 6px' }}>as round trip</th>
            </tr>
          </thead>
          <tbody>
            {live.map(r => {
              const ow = impliedMiles(r.charge, ratePerMile, 'one-way');
              const rt = impliedMiles(r.charge, ratePerMile, 'round-trip');
              return (
                <tr key={r.id ?? r.outer_radius_miles} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px' }}>{r.outer_radius_miles} mi</td>
                  <td style={{ padding: '6px' }}>${r.charge}</td>
                  <td style={{ padding: '6px', color: '#6b7280' }}>{ow === null ? '—' : `${ow.toFixed(1)} mi`}</td>
                  <td style={{ padding: '6px', color: '#6b7280' }}>{rt === null ? '—' : `${rt.toFixed(1)} mi`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 6 }}>
        At ${ratePerMile.toFixed(2)} per loaded mile. <strong>Which reading you charge on is your
        call</strong> — it changes every radius by half, and nobody has decided it yet.
      </div>

      {live.length === 0 && (
        <div style={{ marginTop: 14, padding: '0.75rem', background: '#EAF3DE', borderRadius: 10 }}>
          <strong>You have no rings yet.</strong>
          {proposals.length > 0 ? (
            <>
              <div style={{ fontSize: '0.85rem', margin: '6px 0' }}>From your own invoices:</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                {proposals.map(p => (
                  <li key={p.charge}>
                    {p.outer_radius_miles} mi · ${p.charge} — <em>{p.origin_note}</em>
                  </li>
                ))}
              </ul>
              {canEdit && (
                <button onClick={() => setDraft(proposals.map(p => ({
                  outer_radius_miles: p.outer_radius_miles, charge: p.charge,
                  origin_note: p.origin_note, active: true,
                })))}
                  style={{ minHeight: 48, width: '100%', marginTop: 10, borderRadius: 8,
                           border: 'none', background: GREEN, color: '#fff', cursor: 'pointer' }}>
                  Use these as a starting point
                </button>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', marginTop: 6 }}>
              Nothing in your invoice history repeats often enough to suggest a ring. Add one yourself.
            </div>
          )}
        </div>
      )}

      {draft && canEdit && onSave && (
        <button onClick={() => { void onSave(draft); setDraft(null); }}
          style={{ minHeight: 48, width: '100%', marginTop: 10, borderRadius: 8, border: `1.5px solid ${GREEN}`,
                   background: '#fff', color: GREEN, cursor: 'pointer' }}>
          Save these {draft.length} ring{draft.length === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
