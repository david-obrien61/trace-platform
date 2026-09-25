// ============================================================
// CustomerMap — the map is its own page, a base with layers (PAGE — cultivar-os)
// PURPOSE:      /map. Lauren sees her customers as dots on a real map, switches layers on and
//               off, draws a saved route, and gets the LIST of customers along it.
// DEPENDENCIES: shared maps/loadGoogleMaps · business-logic/mapLayers (pure) ·
//               business-logic/locatedCustomers (the read) · business-logic/stopPoints ·
//               business-logic/deliveryRings · lib/stopRead · lib/teams. Browser maps key.
// OUTPUTS:      <CustomerMap>
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE MAP IS A LENS, NEVER A DEPENDENCY (David, 2026-09-16)
// ═════════════════════════════════════════════════════════════════════════════
// Delivery, routing and pricing must all keep working with this page switched off, broken, or
// refused by Google. Nothing on this page WRITES anything. The rings are drawn from config and
// edited in Settings → Delivery; the route is read from what was already saved; the locations are
// core data this page only reads. A map something depends on is a map whose outage is an outage.
//
// ── 🔴 WHAT CANNOT BE PLACED IS COUNTED AND NAMED, NEVER PLOTTED ────────────────────────────
// Measured on LAWNS 2026-09-25: **208 of 1,497 customer addresses are located.** A page that
// silently drew 208 dots would look like a small customer book instead of an unfinished job, and
// every conclusion drawn from it — "nobody lives out that way" — would be false. The count is on
// the page, in words, above the map.
//
// ── ⚠️ THE ROUTE LINE IS STRAIGHT BETWEEN STOPS, AND IT SAYS SO ─────────────────────────────
// It draws the SAVED ORDER (`route_position`) as a polyline through the stops. It does NOT call
// Directions: the road-following route belongs to /deliveries, and a second routing engine here
// is exactly what §6 r8 forbids. So the corridor measures from straight lines between stops, not
// from the tarmac — stated on screen, like every other distance in the platform.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '../lib/supabase';
import { loadGoogleMaps, onMapsAuthFailure } from '@trace/shared/maps/loadGoogleMaps';
import {
  WINDOW_PRESETS, customersNearPath, dotPasses, purchaseCutoff,
  type WindowPreset, type PurchaseStatus, type DotFilter, type MapCustomer,
} from '@trace/shared/business-logic/mapLayers';
import { readCustomerMapData, type LocatedAddress } from '@trace/shared/business-logic/locatedCustomers';
import { resolveStopPoints } from '@trace/shared/business-logic/stopPoints';
import { orderedRings, type DeliveryRing, type Point } from '@trace/shared/business-logic/deliveryRings';
import { readRingInputs } from '../lib/deliveryRingsRead';
import { readStops, type StopRow } from '../lib/stopRead';
import { readTeams, type Team } from '../lib/teams';

const TRACE_MAP = true;   // STD-003: on by default until owner-proven.
const GREEN = '#27500A';
const RING_COLOURS = ['#27500A', '#3d7a1a', '#6aa02f', '#9cc24f', '#c8dc8a'];
const METRES_PER_MILE = 1609.344;
const MAPS_KEY = (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? null;

/** A dot, with the bits the list beside the map shows. */
interface Dot extends MapCustomer {
  city: string | null;
  lastPurchase: string | null;
  phone: string | null;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

export function CustomerMap() {
  const { businessId, can } = useBusinessContext();
  const canRead = can('deliveries:read');

  // ── the layers, each on or off ────────────────────────────────────────────────────────────
  const [showCustomers, setShowCustomers] = useState(true);
  const [showRings, setShowRings] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  const [showNear, setShowNear] = useState(false);

  // ── the customer filters ──────────────────────────────────────────────────────────────────
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('24m');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statuses, setStatuses] = useState<PurchaseStatus[]>([]);

  // ── the route ─────────────────────────────────────────────────────────────────────────────
  const [routeDate, setRouteDate] = useState(todayIso());
  const [teamId, setTeamId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [routeNote, setRouteNote] = useState('');
  const [withinMiles, setWithinMiles] = useState(2);

  // ── the data ──────────────────────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<LocatedAddress[]>([]);
  const [summaries, setSummaries] = useState<Map<string, { purchases: string[]; lastPurchase: string | null; bought: boolean; delivered: boolean; planted: boolean; customerId: string }>>(new Map());
  const [names, setNames] = useState<Map<string, { name: string; phone: string | null }>>(new Map());
  const [neverAttempted, setNeverAttempted] = useState(0);
  const [cannotPlace, setCannotPlace] = useState(0);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [depot, setDepot] = useState<Point | null>(null);
  const [rings, setRings] = useState<DeliveryRing[]>([]);

  // ── the map ───────────────────────────────────────────────────────────────────────────────
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any>(null);
  const [mapProblem, setMapProblem] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<any[]>([]);

  // ── load: customers, rings, teams ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId || !canRead) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      const data = await readCustomerMapData(supabase, businessId);
      if (!alive) return;
      setAddresses(data.addresses);
      setSummaries(data.summaries as never);
      setNeverAttempted(data.neverAttempted);
      setCannotPlace(data.cannotPlace);
      setReadFailed(data.failed);
      if (TRACE_MAP) console.log('[TRACE:MAP] customers read', {
        located: data.addresses.length, neverAttempted: data.neverAttempted,
        cannotPlace: data.cannotPlace, customersWithHistory: data.summaries.size, failed: data.failed,
      });
      const ringInputs = await readRingInputs(businessId);
      if (!alive) return;
      setDepot(ringInputs.depot);
      setRings(ringInputs.rings ?? []);
      const t = await readTeams(supabase, businessId);
      if (alive && t.ok) setTeams(t.teams);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [businessId, canRead]);

  // ── the names and phones, for the dots we might list ──────────────────────────────────────
  useEffect(() => {
    if (!businessId || addresses.length === 0) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase.from('customers')
        .select('id, first_name, last_name, phone').eq('business_id', businessId).limit(2000);
      if (!alive || !data) return;
      const m = new Map<string, { name: string; phone: string | null }>();
      for (const c of data) {
        const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
        m.set(String(c.id), { name: n || '(no name)', phone: (c.phone as string) ?? null });
      }
      setNames(m);
    })();
    return () => { alive = false; };
  }, [businessId, addresses.length]);

  // ── the route's stops ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId || !showRoute || !routeDate) { setStops([]); return; }
    let alive = true;
    void (async () => {
      const res = await readStops(supabase, businessId, { kind: 'day', date: routeDate }, { readLines: false });
      if (!alive) return;
      if (!res.ok) { setStops([]); setRouteNote(`Could not read that day: ${res.error}`); return; }
      const all = res.value.stops;
      const mine = teamId ? all.filter(s => s.team_id === teamId) : all;
      setStops(mine);
      setRouteNote(mine.length === 0
        ? 'No stops on that day for that crew.'
        : `${mine.length} stop${mine.length === 1 ? '' : 's'}${teamId ? '' : ' (whole day)'}`);
      if (TRACE_MAP) console.log('[TRACE:MAP] route read', { date: routeDate, team: teamId || '(all)', stops: mine.length });
    })();
    return () => { alive = false; };
  }, [businessId, showRoute, routeDate, teamId]);

  // ── who is a dot ──────────────────────────────────────────────────────────────────────────
  const filter: DotFilter = useMemo(() => ({
    window: windowPreset, from: from || null, to: to || null, statuses,
  }), [windowPreset, from, to, statuses]);

  const dots: Dot[] = useMemo(() => {
    const now = new Date();
    const out: Dot[] = [];
    for (const a of addresses) {
      if (!a.customerId) continue;
      const s = summaries.get(a.customerId);
      if (!s) continue;                         // no purchase history ⇒ not a customer dot
      if (!dotPasses(s as never, filter, now)) continue;
      const who = names.get(a.customerId);
      out.push({
        id: a.id, name: who?.name ?? (a.line1 ?? ''), city: a.city,
        latitude: a.latitude, longitude: a.longitude,
        lastPurchase: s.lastPurchase, phone: who?.phone ?? null,
      });
    }
    return out;
  }, [addresses, summaries, names, filter]);

  // ── the route's line, from the SAVED order ────────────────────────────────────────────────
  const placement = useMemo(() => resolveStopPoints(stops, addresses.map(a => ({
    customerId: a.customerId, line1: a.line1, latitude: a.latitude, longitude: a.longitude,
  }))), [stops, addresses]);
  const path: Point[] = useMemo(() => placement.placed.map(p => p.point), [placement]);

  const near = useMemo(
    () => customersNearPath(dots, showNear ? path : [], withinMiles),
    [dots, path, withinMiles, showNear],
  );

  // ── create the map once ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPS_KEY || !mapEl || !depot) return;
    let alive = true;
    const stopListening = onMapsAuthFailure(() => {
      if (!alive) return;
      const here = typeof window !== 'undefined' ? window.location.origin : 'this address';
      setMapProblem(`Google will not show a map on ${here}. The map key is locked to a different web `
        + `address — its website restriction has to include ${here}/*, which is a change in the Google `
        + `Cloud console, not in TRACE. Everything below the map still works.`);
    });
    const tooLong = setTimeout(() => {
      if (alive) setMapProblem(prev => prev ?? 'The map has not loaded — it may be blocked by this browser '
        + 'or the network. The list below still works.');
    }, 12000);
    void (async () => {
      try {
        const maps = await loadGoogleMaps(MAPS_KEY);
        const { Map } = await maps.importLibrary('maps');
        if (!alive) return;
        const m = new Map(mapEl, {
          center: { lat: depot.latitude, lng: depot.longitude }, zoom: 10,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        clearTimeout(tooLong);
        setMap(m);                       // state, not a ref — a ref never re-renders (RingMap's bug)
        if (TRACE_MAP) console.log('[TRACE:MAP] customer map created');
      } catch (e) {
        clearTimeout(tooLong);
        setMapProblem(`The map could not load — the list below still works. (${(e as Error).message})`);
      }
    })();
    return () => { alive = false; clearTimeout(tooLong); stopListening(); };
  }, [mapEl, depot]);

  // ── draw every layer, from scratch, whenever anything moves ───────────────────────────────
  useEffect(() => {
    const w = window as any;
    if (!map || !w.google?.maps) return;
    for (const o of overlays) o.setMap(null);
    const next: any[] = [];

    if (showRings && depot) {
      orderedRings(rings).forEach((r, i) => {
        next.push(new w.google.maps.Circle({
          map, center: { lat: depot.latitude, lng: depot.longitude },
          radius: r.outer_radius_miles * METRES_PER_MILE,
          strokeColor: RING_COLOURS[i % RING_COLOURS.length], strokeOpacity: 0.8, strokeWeight: 2,
          fillOpacity: 0, clickable: false,
        }));
      });
    }
    if (depot) {
      next.push(new w.google.maps.Marker({
        position: { lat: depot.latitude, lng: depot.longitude }, map, title: 'your yard',
        label: { text: '⌂', color: '#fff', fontSize: '14px' },
      }));
    }
    if (showCustomers) {
      const highlighted = new Set(near.rows.map(r => r.customer.id));
      for (const d of dots) {
        next.push(new w.google.maps.Marker({
          position: { lat: d.latitude, lng: d.longitude }, map,
          title: `${d.name}${d.city ? ` — ${d.city}` : ''}${d.lastPurchase ? ` · last bought ${d.lastPurchase.slice(0, 10)}` : ''}`,
          icon: {
            path: w.google.maps.SymbolPath.CIRCLE,
            scale: showNear && highlighted.has(d.id) ? 7 : 4,
            fillColor: showNear && highlighted.has(d.id) ? '#A32D2D' : GREEN,
            fillOpacity: 0.9, strokeWeight: showNear && highlighted.has(d.id) ? 1 : 0, strokeColor: '#fff',
          },
        }));
      }
    }
    if (showRoute && path.length > 0) {
      next.push(new w.google.maps.Polyline({
        path: path.map(p => ({ lat: p.latitude, lng: p.longitude })), map,
        geodesic: false, strokeColor: '#1d4ed8', strokeOpacity: 0.9, strokeWeight: 4,
      }));
      placement.placed.forEach((p, i) => {
        next.push(new w.google.maps.Marker({
          position: { lat: p.point.latitude, lng: p.point.longitude }, map,
          label: { text: String(i + 1), color: '#fff', fontSize: '11px' },
          title: `${i + 1}. ${(p.stop.address_line1 as string) ?? ''}`,
        }));
      });
    }
    setOverlays(next);
    // `overlays` is deliberately NOT a dependency: it is what this effect WRITES, and depending on
    // it would make the effect re-run on its own output forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dots, rings, depot, showCustomers, showRings, showRoute, showNear, path, near, placement]);

  if (!canRead) {
    return <div className="page"><div className="section">You don’t have access to the delivery map.</div></div>;
  }

  const cutoff = purchaseCutoff(windowPreset, new Date());
  const totalUnplaced = neverAttempted + cannotPlace;

  return (
    <div className="page">
      <div className="section">
        <h2 style={{ margin: '0 0 4px' }}>Map</h2>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
          A base map with layers. Nothing here changes anything — the rings are edited in
          Settings → Delivery and the route is the one already saved for that day.
        </p>
      </div>

      {/* 🔴 THE UNPLACED COUNT, ABOVE THE MAP, IN WORDS. 208 of 1,497 on LAWNS today. */}
      {totalUnplaced > 0 && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.75rem', fontSize: '0.85rem', color: '#92400e' }}>
            <strong>{addresses.length} of {addresses.length + totalUnplaced} customer addresses are on this map.</strong>
            {' '}{neverAttempted > 0 && <>{neverAttempted} ha{neverAttempted === 1 ? 's' : 've'} never been located — press <em>Locate addresses</em> in Settings → Delivery and leave the page open. </>}
            {cannotPlace > 0 && <>{cannotPlace} could not be found by Google. </>}
            The ones that are missing are not shown anywhere on the map, so read it as an
            incomplete picture rather than a small one.
          </div>
        </div>
      )}
      {readFailed && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem', fontSize: '0.85rem', color: '#991b1b' }}>
            <strong>Could not read your customers.</strong> {readFailed} — the map is not showing
            everything, so do not read anything into what is missing.
          </div>
        </div>
      )}

      <div className="section" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 420px)', gap: 16 }}>
        {/* ── the map ── */}
        <div>
          {mapProblem && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.9rem', marginBottom: 8, fontSize: '0.85rem', lineHeight: 1.5, color: '#92400e' }}>
              <strong>The map isn’t showing.</strong><div style={{ marginTop: 4 }}>{mapProblem}</div>
            </div>
          )}
          {!MAPS_KEY && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.9rem', marginBottom: 8, fontSize: '0.85rem', color: '#92400e' }}>
              No map key on this deployment — the lists below still work.
            </div>
          )}
          {!depot && !loading && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.9rem', marginBottom: 8, fontSize: '0.85rem', color: '#92400e' }}>
              <strong>Your own address has no location yet.</strong> The map centres on your yard,
              so that address has to be found first — Settings → Business profile.
            </div>
          )}
          <div ref={setMapEl} style={{ width: '100%', height: mapProblem ? 0 : 460, overflow: 'hidden', borderRadius: 8, background: '#eef2e6' }} />
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
            Rings and distances are <strong>straight-line</strong> from your yard — a truck drives
            further. The route line runs straight between stops in the order you saved; the
            road-following route is on the Route screen.
          </p>
        </div>

        {/* ── the layer control ── */}
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Layers</h3>

          <Layer on={showCustomers} set={setShowCustomers} label={`Customers (${dots.length})`}>
            <label style={lbl}>Bought
              <select value={windowPreset} onChange={e => setWindowPreset(e.target.value as WindowPreset)} style={sel}>
                {WINDOW_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            {windowPreset === 'custom' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={sel} aria-label="From" />
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={sel} aria-label="To" />
              </div>
            )}
            {cutoff && <p style={hint}>Anyone who bought on or after {cutoff.toISOString().slice(0, 10)}.</p>}
            <div style={{ marginTop: 8 }}>
              {(['bought', 'delivered', 'planted'] as PurchaseStatus[]).map(st => (
                <label key={st} style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox" checked={statuses.includes(st)}
                    onChange={e => setStatuses(prev => e.target.checked ? [...prev, st] : prev.filter(x => x !== st))}
                  />
                  {st === 'planted' ? 'Planted (worked out, not recorded)' : st[0].toUpperCase() + st.slice(1)}
                </label>
              ))}
              <p style={hint}>
                Tick none to show everyone. Two ticks means <em>either</em>.
                {' '}<strong>Planted</strong> is worked out, not recorded: a delivery that was
                completed AND was sold as planting work. Nothing in the system stores the moment a
                tree went in the ground.
              </p>
            </div>
          </Layer>

          <Layer on={showRings} set={setShowRings} label={`Delivery rings (${orderedRings(rings).length})`}>
            <p style={hint}>Read-only here. Edit them in Settings → Delivery.</p>
          </Layer>

          <Layer on={showRoute} set={setShowRoute} label="A saved route">
            <label style={lbl}>Day
              <input type="date" value={routeDate} onChange={e => setRouteDate(e.target.value)} style={sel} />
            </label>
            <label style={lbl}>Crew
              <select value={teamId} onChange={e => setTeamId(e.target.value)} style={sel}>
                <option value="">The whole day</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            {routeNote && <p style={hint}>{routeNote}</p>}
            {placement.unplaceable.length > 0 && (
              <p style={{ ...hint, color: '#92400e' }}>
                {placement.unplaceable.length} stop{placement.unplaceable.length === 1 ? '' : 's'} on
                that day cannot be drawn — {placement.unplaceable[0].why}. They are not on the line,
                so the route shown is shorter than the real one.
              </p>
            )}
          </Layer>

          <Layer on={showNear} set={setShowNear} label="Customers near that route">
            <label style={lbl}>Within
              <input
                type="number" min={0.25} max={50} step={0.25} value={withinMiles}
                onChange={e => setWithinMiles(Math.max(0, Number(e.target.value) || 0))} style={{ ...sel, width: 90 }}
              /> straight-line miles
            </label>
            <p style={hint}>{near.message}</p>
          </Layer>
        </div>
      </div>

      {/* ── the list: the useful output ── */}
      {showNear && near.rows.length > 0 && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              Along this route — {near.rows.length} customer{near.rows.length === 1 ? '' : 's'}, nearest first
            </h3>
            <button className="btn" style={{ minHeight: 36 }} onClick={() => exportCsv(near.rows)}>Export CSV</button>
          </div>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={th}>Customer</th><th style={th}>Phone</th><th style={th}>Town</th>
                <th style={th}>Last bought</th><th style={th}>Miles from the route</th>
              </tr>
            </thead>
            <tbody>
              {near.rows.map(r => (
                <tr key={r.customer.id} style={{ borderTop: '1px solid #eef2e6' }}>
                  <td style={td}>{(r.customer as Dot).name}</td>
                  <td style={td}>{(r.customer as Dot).phone ?? '—'}</td>
                  <td style={td}>{(r.customer as Dot).city ?? '—'}</td>
                  <td style={td}>{(r.customer as Dot).lastPurchase?.slice(0, 10) ?? '—'}</td>
                  <td style={td}>{r.miles.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={hint}>Straight-line from the line between stops — not driving distance.</p>
        </div>
      )}
    </div>
  );
}

// ── small pieces ────────────────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', color: '#374151', marginTop: 6 };
const sel: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 8px', marginTop: 2, border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' };
const hint: React.CSSProperties = { fontSize: '0.75rem', color: '#6b7280', margin: '6px 0 0', lineHeight: 1.45 };
const th: React.CSSProperties = { padding: '4px 6px' };
const td: React.CSSProperties = { padding: '5px 6px' };

function Layer({ on, set, label, children }: {
  on: boolean; set: (v: boolean) => void; label: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', marginBottom: 8, background: on ? '#fff' : '#fafafa' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', fontWeight: 600, color: '#1f2937', cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} />
        {label}
      </label>
      {on && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

/** The list is the useful output, so it leaves the screen. No library: five columns of text. */
function exportCsv(rows: { customer: MapCustomer; miles: number }[]): void {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Customer', 'Phone', 'Town', 'Last bought', 'Straight-line miles from route'].join(',')];
  for (const r of rows) {
    const d = r.customer as Dot;
    lines.push([d.name, d.phone ?? '', d.city ?? '', d.lastPurchase?.slice(0, 10) ?? '', r.miles.toFixed(1)].map(esc).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `customers-near-route.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
