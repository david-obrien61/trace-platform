// ============================================================
// RingMap — the delivery rings on a real map (PLATFORM — @trace/shared)
// PURPOSE:      Settings → Delivery. The owner sees their delivery area on a map centred on their
//               own yard, drags a ring's edge or types the distance, and saves. Located customers
//               show as dots coloured by the ring they fall in.
// DEPENDENCIES: maps/loadGoogleMaps (shared, extracted) · business-logic/deliveryRings (pure) ·
//               business-logic/ringWriter (the ONE writer). Browser maps key, passed in.
// OUTPUTS:      <RingMap>
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 BUILT TO THE 2026-09-15 DEMO David approved (`delivery-zones.html`), WITH ONE STATED CHANGE
// ═════════════════════════════════════════════════════════════════════════════
// The demo's layout is kept: the map on the left, the ring table on the right
// (Ring · Out to · Charge · Per mile), the beyond-the-last-ring line underneath, and a note that
// distances are straight-line from the farm.
//
// ⚠️ THE DEMO DREW SVG COMPASS CIRCLES — *"the same way a compass draws a circle on paper"*. This
// draws the same circles on a GOOGLE MAP, because David asked for that on 2026-09-25 and because
// a circle over real streets answers the question the paper one could not: WHICH TOWNS are in
// which ring. The trade is recorded rather than made quietly — if the paper look was the point,
// this is the thing to change back.
//
// 🔴 STRAIGHT-LINE MILES, SAID ON THE SCREEN. A circle on a map invites the reading "this is how
// far the truck drives", and it is not — it is the crow's flight. A delivery round the lake is
// further than one straight up the road, and the label says so rather than letting the picture
// imply otherwise.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadGoogleMaps, onMapsAuthFailure } from '../../maps/loadGoogleMaps';
import { distanceMiles, orderedRings, impliedMiles, type DeliveryRing, type Point } from '../../business-logic/deliveryRings';
import { saveRings, type RingEdit } from '../../business-logic/ringWriter';

export interface LocatedDot { id: string; name: string; latitude: number; longitude: number }

interface Props {
  db: SupabaseClient;
  businessId: string;
  /** The yard — the business-profile address's coordinate. Null until it is geocoded. */
  depot: Point | null;
  rings: readonly DeliveryRing[];
  dots?: readonly LocatedDot[];
  /** Addresses with no coordinate — counted, never plotted, never guessed. */
  unlocatedCount?: number;
  mapsKey?: string | null;
  ratePerMile?: number;
  canEdit?: boolean;
  onSaved?: () => void;
}

const GREEN = '#27500A';
const RING_COLOURS = ['#27500A', '#3d7a1a', '#6aa02f', '#9cc24f', '#c8dc8a'];
const METRES_PER_MILE = 1609.344;
const TRACE_RINGMAP = true;   // STD-003: on by default until owner-proven.

export function RingMap({
  db, businessId, depot, rings, dots = [], unlocatedCount = 0,
  mapsKey, ratePerMile = 3.5, canEdit = false, onSaved,
}: Props) {
  const [draft, setDraft] = useState<RingEdit[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  // 🔴 THE MAP'S READINESS IS STATE, NOT A REF, AND THAT IS A BUG FIX NOT A STYLE CHOICE.
  // The circles effect reads `mapRef.current` and returns early while it is null. The map is
  // created ASYNCHRONOUSLY, and assigning a ref DOES NOT RE-RENDER — so once the two data reads
  // had landed (they are far quicker than a script fetch), nothing ever re-ran the circles
  // effect and NO RINGS WERE EVER DRAWN on a map that had loaded perfectly well. It survived
  // review because the effect is correct in isolation; what was wrong was that nothing woke it.
  const [mapReady, setMapReady] = useState(false);
  // WHY there is no map, in words a person can act on. Null while all is well.
  const [mapProblem, setMapProblem] = useState<string | null>(null);
  // The depot's two numbers, read once. The effects below depend on THESE rather than on the
  // object, so a caller that builds `depot` inline cannot re-fire them every render — the same
  // fix made to AddressInput on 2026-09-25, for the same reason.
  const depotLat = depot?.latitude ?? null;
  const depotLng = depot?.longitude ?? null;
  const mapEl = useRef<HTMLDivElement | null>(null);
  const circlesRef = useRef<any[]>([]);
  const mapRef = useRef<any>(null);

  const live: RingEdit[] = useMemo(
    () => draft ?? orderedRings(rings).map(r => ({
      id: r.id ?? null, outer_radius_miles: r.outer_radius_miles, charge: r.charge, origin_note: r.origin_note ?? null,
    })),
    [draft, rings],
  );

  // ── the map ───────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsKey || depotLat === null || depotLng === null || !mapEl.current) return;
    let alive = true;
    // ── ① GOOGLE REFUSING THE KEY. It does not throw; it calls a global. ───────────────────
    const stopListening = onMapsAuthFailure(() => {
      if (!alive) return;
      const here = typeof window !== 'undefined' ? window.location.origin : 'this address';
      setMapProblem(
        `Google will not show a map on ${here}. The map key is locked to a different web address, `
        + `so the key's website restriction has to include ${here}/* — that is a change in the `
        + `Google Cloud console, not in TRACE. Your rings below are unaffected and deliveries are `
        + `still priced from them.`,
      );
    });
    // ── ② THE SCRIPT NEVER ARRIVING AT ALL — blocked, offline, a content blocker. ──────────
    // 🔴 A PROMISE THAT NEVER SETTLES HAS NO CATCH. Without this, the pale box simply stays
    // pale forever, which is precisely the "shows nothing" David reported.
    const tooLong = setTimeout(() => {
      if (alive) setMapProblem(prev => prev ?? 'The map has not loaded. It may be blocked by this '
        + 'browser or the network. The rings below still work, and deliveries are still priced from them.');
    }, 12000);
    void (async () => {
      try {
        const maps = await loadGoogleMaps(mapsKey);
        const { Map } = await maps.importLibrary('maps');
        if (!alive || !mapEl.current) return;
        const map = new Map(mapEl.current, {
          center: { lat: depotLat, lng: depotLng },
          zoom: 9, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        mapRef.current = map;
        new maps.Marker({ position: { lat: depotLat, lng: depotLng }, map, title: 'your yard' });
        clearTimeout(tooLong);
        // 🔴 THE LINE THAT MAKES THE CIRCLES APPEAR. See `mapReady` above: without a state
        // change here the ring-drawing effect below never runs again after this await.
        setMapReady(true);
        if (TRACE_RINGMAP) console.log('[TRACE:MAP] ring map created', { depotLat, depotLng });
      } catch (e) {
        // Rule 24, one surface over: no map is not no rings. The list below still works.
        clearTimeout(tooLong);
        setMapProblem(`The map could not load — the rings below still work. (${(e as Error).message})`);
      }
    })();
    return () => { alive = false; clearTimeout(tooLong); stopListening(); };
  }, [mapsKey, depotLat, depotLng]);

  // ── the circles, redrawn whenever a ring moves ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const w = window as any;
    if (!map || !w.google?.maps) return;
    for (const c of circlesRef.current) c.setMap(null);
    circlesRef.current = [];
    live.forEach((r, i) => {
      const circle = new w.google.maps.Circle({
        map, center: map.getCenter(),
        radius: r.outer_radius_miles * METRES_PER_MILE,
        strokeColor: RING_COLOURS[i % RING_COLOURS.length], strokeOpacity: 0.9, strokeWeight: 2,
        fillColor: RING_COLOURS[i % RING_COLOURS.length], fillOpacity: 0.06,
        // 🔴 DRAGGING THE EDGE IS THE DEMO'S INTERACTION. `editable` gives Google's own radius
        // handles; the listener below is what keeps the LIST in step, so the two can never
        // disagree about where a ring is.
        editable: canEdit, clickable: false,
      });
      if (canEdit) {
        circle.addListener('radius_changed', () => {
          const miles = Math.round((circle.getRadius() / METRES_PER_MILE) * 10) / 10;
          setDraft(prev => {
            const base = prev ?? live;
            const next = base.map((x, j) => (j === i ? { ...x, outer_radius_miles: miles } : x));
            return next;
          });
        });
      }
      circlesRef.current.push(circle);
    });
    // Which ring a dot falls in — the index, or -1 beyond the last. Declared INSIDE the effect
    // that uses it: as a component-level function it was a missing dependency, and adding it to
    // the array would have re-run the draw on every render. Neither a suppression nor a useCallback
    // is needed if the helper simply lives where it is used.
    const ringOf = (d: LocatedDot): number => {
      const m = depotLat === null || depotLng === null
        ? null : distanceMiles({ latitude: depotLat, longitude: depotLng }, d);
      if (m === null) return -1;
      return live.findIndex(r => m <= r.outer_radius_miles);
    };
    // Dots, coloured by the ring they fall in.
    for (const d of dots) {
      const idx = ringOf(d);
      new w.google.maps.Marker({
        position: { lat: d.latitude, lng: d.longitude }, map, title: d.name,
        icon: {
          path: w.google.maps.SymbolPath.CIRCLE, scale: 4,
          fillColor: idx === -1 ? '#A32D2D' : RING_COLOURS[idx % RING_COLOURS.length],
          fillOpacity: 0.9, strokeWeight: 0,
        },
      });
    }
  }, [live, dots, canEdit, depotLat, depotLng, mapReady]);

  async function save() {
    setSaving(true); setNote('');
    const out = await saveRings(db, { businessId, edits: live, existing: rings });
    setSaving(false);
    if ('kind' in out && out.kind === 'refused') { setNote(out.reason); return; }
    const o = out as { saved: number; retired: number; error: string | null; logged: boolean };
    if (o.error) { setNote(`Not saved — ${o.error}`); return; }
    setDraft(null);
    // 🔴 A SAVE WHOSE HISTORY DID NOT LAND SAYS SO. It still saved — a change log must not undo
    // the change — but "saved" on its own would be a smaller truth than the one available.
    setNote(o.logged
      ? `Saved. ${o.saved} ring${o.saved === 1 ? '' : 's'}${o.retired ? `, ${o.retired} retired` : ''}.`
      : `Saved, but the change history could not be written — tell David.`);
    onSaved?.();
  }

  if (!depot) {
    return (
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '1rem' }}>
        <strong>Your own address has no location yet.</strong>
        <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
          Every ring is measured from your yard, so that address has to be found first —
          Settings → Business, check the address.
        </div>
      </div>
    );
  }

  const beyond = live.length ? live[live.length - 1].outer_radius_miles : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(260px, 380px)', gap: 16 }}>
      {/* ── the map ── */}
      <div>
        {/* 🔴 THE BOX SAYS WHY IT IS EMPTY. David, live on production 2026-09-25: *"do not see the
            map under delivery"* — and the screen offered him nothing to read, because the two
            failures that actually happen (Google refusing the key; the script never arriving)
            neither throw nor resolve. A pale rectangle is not a state; it is the absence of one. */}
        {mapProblem && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
            padding: '0.9rem', marginBottom: 8, fontSize: '0.85rem', lineHeight: 1.5, color: '#92400e',
          }}>
            <strong>The map isn’t showing.</strong>
            <div style={{ marginTop: 4 }}>{mapProblem}</div>
          </div>
        )}
        {/* Hidden rather than unmounted while a problem is showing: the div is the map's
            container and Google holds a reference to it. Removing it would break a later retry. */}
        <div ref={mapEl} style={{
          width: '100%', height: mapProblem ? 0 : 380, overflow: 'hidden',
          borderRadius: 8, background: '#eef2e6',
        }} />
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
          {/* The demo's own sentence, kept, because it is the honest one. */}
          Drawn to scale. Each ring is measured <strong>straight-line</strong> from the farm, the
          same way a compass draws a circle on paper — a truck drives further.
          {canEdit && ' Drag a ring’s edge to move it; the table follows.'}
        </div>
        {!mapsKey && (
          <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: 6 }}>
            No map key on this deployment — the rings below still work.
          </div>
        )}
      </div>

      {/* ── the rings ── */}
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>The rings</h3>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '4px 6px' }}>Ring</th>
              <th style={{ padding: '4px 6px' }}>Out to</th>
              <th style={{ padding: '4px 6px' }}>Charge</th>
              <th style={{ padding: '4px 6px' }}>One way / round</th>
            </tr>
          </thead>
          <tbody>
            {live.map((r, i) => {
              const ow = impliedMiles(r.charge, ratePerMile, 'one-way');
              const rt = impliedMiles(r.charge, ratePerMile, 'round-trip');
              return (
                <tr key={r.id ?? i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px', color: RING_COLOURS[i % RING_COLOURS.length], fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '6px' }}>
                    {canEdit ? (
                      <input type="number" step="0.1" min="0.1" value={r.outer_radius_miles}
                        onChange={e => setDraft(live.map((x, j) => j === i ? { ...x, outer_radius_miles: Number(e.target.value) } : x))}
                        style={{ width: 70, minHeight: 34 }} aria-label={`Ring ${i + 1} distance in miles`} />
                    ) : `${r.outer_radius_miles} mi`}
                  </td>
                  <td style={{ padding: '6px' }}>
                    {canEdit ? (
                      <input type="number" step="1" min="0" value={r.charge}
                        onChange={e => setDraft(live.map((x, j) => j === i ? { ...x, charge: Number(e.target.value) } : x))}
                        style={{ width: 70, minHeight: 34 }} aria-label={`Ring ${i + 1} charge`} />
                    ) : `$${r.charge}`}
                  </td>
                  {/* ⚠️ BOTH READINGS, ALWAYS — the platform never rules which a loaded mile means. */}
                  <td style={{ padding: '6px', color: '#6b7280' }}>
                    {ow === null ? '—' : `${ow.toFixed(1)} / ${rt?.toFixed(1)} mi`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {live.some(r => r.origin_note) && (
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 6 }}>
            {live.find(r => r.origin_note)?.origin_note}
          </div>
        )}

        {/* 🔴 BEYOND THE LAST RING — SHOWN, NOT PRICED. */}
        <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: 10, background: '#FFFBEB',
                      border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px' }}>
          Beyond {beyond} miles there is no ring to fall into, so a delivery is not priced
          automatically — <strong>$3.50–$4.50 per loaded mile, round trip</strong>, and someone sets
          the charge.
        </div>

        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 8 }}>
          {dots.length} located customer{dots.length === 1 ? '' : 's'} shown
          {unlocatedCount > 0 && <> · <span style={{ color: '#92400e' }}>{unlocatedCount} not placed yet</span></>}
        </div>

        {canEdit && (
          <>
            <button onClick={() => { void save(); }} disabled={saving || draft === null}
              style={{ width: '100%', minHeight: 48, marginTop: 10, borderRadius: 8, border: 'none',
                       background: draft === null ? '#cbd5c0' : GREEN, color: '#fff',
                       cursor: draft === null ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : draft === null ? 'No changes to save' : 'Save the rings'}
            </button>
            {draft !== null && (
              <button onClick={() => { setDraft(null); setNote(''); }}
                style={{ width: '100%', minHeight: 40, marginTop: 6, borderRadius: 8,
                         border: '1.5px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                Undo my changes
              </button>
            )}
          </>
        )}
        {note && <div style={{ fontSize: '0.8rem', marginTop: 8, color: /could not|Not saved/.test(note) ? '#A32D2D' : '#27500A' }}>{note}</div>}
      </div>
    </div>
  );
}
