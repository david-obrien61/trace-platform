import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Truck, MapPin, Navigation, Copy, Send,
  CheckSquare, Square, Plus, X, Phone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';

interface DeliveryOrder {
  id: string;
  created_at: string;
  notes: string | null;
  customers: {
    first_name: string;
    last_name: string;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  order_items: { cultivar_plants: { common_name: string | null; species: string } | null }[];
}

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

function fullAddress(c: DeliveryOrder['customers']): string {
  if (!c) return '';
  const parts = [c.address_line1, c.city, c.state, c.zip].filter(Boolean);
  return parts.join(', ');
}

function buildMapsUrl(addresses: string[]): string {
  const stops = addresses.map(a => encodeURIComponent(a)).join('/');
  return `https://www.google.com/maps/dir/${stops}/`;
}

// [TRACE:DELIVERY] STD-003 — ON until David owner-proves the scheduled-deliveries route
const TRACE_DELIVERY = true;

// Client-side Google Maps key. VITE_-prefixed so Vite injects it into the browser
// bundle (the unprefixed name is invisible to the client). Referrer-restricted key,
// safe to expose. Absent/blank → the embedded map is skipped entirely and the
// "Open in Google Maps" URL-handoff card below remains the working fallback.
const MAPS_KEY = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Singleton client-side loader for the Maps JS API — one <script>, no new Vercel
// function (api/ stays 12/12). The modern Maps JS loader is MODULAR: loading the core
// bootstrap does NOT attach Geocoder/Map/Marker to google.maps. What the bootstrap DOES
// give us is `google.maps.importLibrary(name)` — each caller awaits the specific library
// it needs (geocoding, maps, marker) before constructing anything from it. So this loader
// resolves once `importLibrary` is available; RouteMap awaits the libraries it uses.
let mapsLoaderPromise: Promise<any> | null = null;
function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const ready = () => {
      // Resolve on importLibrary (the modular entry point) — NOT on google.maps alone,
      // which exists before any library is attached.
      if (w.google?.maps?.importLibrary) { resolve(w.google.maps); return true; }
      return false;
    };
    if (ready()) return;

    const fail = (msg: string) => { mapsLoaderPromise = null; reject(new Error(msg)); };
    const onLoad = () => { if (!ready()) fail('maps loaded but importLibrary missing'); };

    // Reuse an existing tag (StrictMode double-mount / prior route) rather than duplicate it.
    const existing = document.getElementById('gmaps-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', () => fail('maps script load failed'));
      return;
    }

    const script = document.createElement('script');
    script.id = 'gmaps-js';
    // `loading=async` makes `google.maps.importLibrary` available; libraries are pulled
    // on demand via importLibrary, so no `&libraries=` list is needed here.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = onLoad;
    script.onerror = () => fail('maps script load failed');
    document.head.appendChild(script);
  });
  return mapsLoaderPromise;
}

interface RouteStop { label: string; address: string; }

/**
 * RouteMap — embedded Google Maps JS map with NUMBERED pins in route order.
 * PURPOSE: render the built delivery route (business origin anchor + ordered
 *          customer stops) as an interactive map — numbered markers + a connecting
 *          polyline — so the owner/driver sees the day's route visually. ADDITIVE to,
 *          never a replacement for, the "Open in Google Maps" URL handoff below it.
 * DEPENDENCIES: Google Maps JavaScript API + Geocoding (client-side script loader;
 *          key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY, referrer-restricted).
 *          ZERO Vercel functions.
 * OUTPUTS: geocodes each address → numbered markers (⌂ = origin) → fits bounds. On
 *          ANY failure (no key, load error, every geocode misses) it degrades quietly
 *          to a muted note; the parent's URL-handoff card is always the fallback.
 * NOTE (standard-by-value): loads Geocoder/Map/Marker via the modular `importLibrary`
 *          (the current Maps JS pattern — core does NOT bundle them). Uses the classic
 *          `Marker` (from the 'marker' library) for numbered labels — AdvancedMarkerElement
 *          needs a mapId + more setup that buys nothing for v1 numbered pins. Divergence recorded.
 * [TRACE:MAP] on the lib-ready → Geocoder-construct → geocode → render path (STD-003, ON until owner-proven).
 */
function RouteMap({ apiKey, origin, stops }: { apiKey: string; origin: string; stops: RouteStop[] }) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setNote('');

    async function run() {
      // ONE try/catch around the whole init: script load, library import, geocode, and
      // render. ANY throw (incl. the old `Geocoder is not a constructor`) degrades to the
      // error overlay + the URL-handoff card below — never a stuck "Loading map…" spinner.
      try {
        const maps = await loadGoogleMaps(apiKey);
        if (cancelled || !mapRef.current) return;

        // Modular loader: AWAIT each library before touching its constructors. Importing
        // these also populates the shared google.maps namespace (LatLngBounds, Polyline).
        const [{ Geocoder }, { Map }, { Marker }] = await Promise.all([
          maps.importLibrary('geocoding'),
          maps.importLibrary('maps'),
          maps.importLibrary('marker'),
        ]);
        if (TRACE_DELIVERY) console.log('[TRACE:MAP] geocoding lib ready');
        if (cancelled || !mapRef.current) return;

        const geocoder = new Geocoder();
        if (TRACE_DELIVERY) console.log('[TRACE:MAP] Geocoder constructed OK');
        const geocode = (address: string) => new Promise<any | null>((resolve) => {
          geocoder.geocode({ address }, (results: any, gcStatus: string) => {
            if (gcStatus === 'OK' && results && results[0]) resolve(results[0].geometry.location);
            else { if (TRACE_DELIVERY) console.warn('[TRACE:MAP] geocode miss', { address, gcStatus }); resolve(null); }
          });
        });

        // Ordered points: origin anchor first (⌂), then customer stops 1..N in route order.
        const points: { marker: string; title: string; address: string; isOrigin: boolean }[] = [];
        if (origin) points.push({ marker: '⌂', title: 'Start / return (business)', address: origin, isOrigin: true });
        stops.forEach((s, i) => points.push({ marker: String(i + 1), title: `${i + 1}. ${s.label}`, address: s.address, isOrigin: false }));

        if (TRACE_DELIVERY) console.log('[TRACE:MAP] geocoding', points.length, 'points', { hasOrigin: !!origin, stops: stops.length });

        const located = await Promise.all(points.map(async p => ({ ...p, loc: await geocode(p.address) })));
        if (cancelled || !mapRef.current) return;

        const good = located.filter(p => p.loc);
        if (good.length === 0) {
          if (TRACE_DELIVERY) console.warn('[TRACE:MAP] no points geocoded — hiding map', { attempted: points.length });
          if (!cancelled) { setStatus('error'); setNote('Couldn’t locate these addresses on the map — use the link below.'); }
          return;
        }

        const map = new Map(mapRef.current, {
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        const bounds = new maps.LatLngBounds();

        good.forEach(p => {
          new Marker({
            position: p.loc,
            map,
            label: { text: p.marker, color: '#fff', fontWeight: '700', fontSize: '0.8125rem' },
            title: p.title,
          });
          bounds.extend(p.loc);
        });

        // Connect the located points in order with a light polyline (the visual route line).
        new maps.Polyline({
          path: good.map(p => p.loc),
          map, geodesic: false, strokeColor: GREEN, strokeOpacity: 0.7, strokeWeight: 3,
        });

        map.fitBounds(bounds, 48);
        if (good.length === 1) map.setZoom(14);

        if (!cancelled) {
          setStatus('ready');
          if (TRACE_DELIVERY) console.log('[TRACE:MAP] rendered', { located: good.length, missed: located.length - good.length });
        }
      } catch (e) {
        // Covers script-load failure AND the modular-loader trap (Geocoder/Map/Marker
        // not yet in the namespace). Fall through to the working URL card — no dead spinner.
        if (TRACE_DELIVERY) console.warn('[TRACE:MAP] map init failed — falling back to link', e);
        if (!cancelled) { setStatus('error'); setNote('Map unavailable — use the link below.'); }
      }
    }

    void run();
    return () => { cancelled = true; };
    // `stops` is a stable state reference from the parent (routeStops) — it changes
    // identity only when a route is (re)built, which is exactly when we want to re-run.
  }, [apiKey, origin, stops]);

  // The map div is ALWAYS present + visible so Maps initializes into a sized element;
  // loading/error are overlays. A failure never throws — the card below still works.
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div ref={mapRef} style={{ width: '100%', height: 260, borderRadius: 12, background: '#eef2e6' }} />
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: GRAY, fontSize: '0.8125rem', borderRadius: 12, background: '#eef2e6',
        }}>Loading map…</div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: 16, color: '#9a5b00', fontSize: '0.8125rem',
          borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa',
        }}>{note || 'Map unavailable — use the link below.'}</div>
      )}
    </div>
  );
}

export function DeliveryRoute() {
  const [searchParams] = useSearchParams();
  // When ?date=YYYY-MM-DD is present we route SCHEDULED deliveries (the `deliveries`
  // table) for that day. Absent → the original cart-order route path, unchanged.
  const dateParam = searchParams.get('date');
  const { businessId } = useBusinessContext();

  const [orders, setOrders]     = useState<DeliveryOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Selected order IDs for the route
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Address overrides for orders missing customer address
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Route result state
  const [routeUrl, setRouteUrl] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  // Structured route model for the embedded map — ordered stops + origin anchor,
  // set alongside routeUrl in buildRoute() so the map + the URL share one source.
  const [routeStops, setRouteStops]   = useState<RouteStop[]>([]);
  const [routeOrigin, setRouteOrigin] = useState<string>('');

  // Business address — injected as the route origin/destination (round-trip anchor).
  const [originAddress, setOriginAddress] = useState<string>('');

  useEffect(() => {
    if (!businessId) return;
    load();
  }, [businessId, dateParam]);

  async function load() {
    setLoading(true);
    setError(null);

    // Anchor address for the route (origin + destination) = the business's own address.
    // Both modes (scheduled + cart) use it; loaded once per businessId.
    const { data: bizRow } = await supabase
      .from('businesses').select('address').eq('id', businessId!).maybeSingle();
    setOriginAddress(bizRow?.address?.trim() ?? '');

    // ── SCHEDULED-DELIVERIES MODE (?date=) — the OCR-invoice loop close ──
    // Loads the `deliveries` table for the day and maps each row into the existing
    // DeliveryOrder shape (address lives on the delivery row, surfaced via the synthetic
    // `customers` object) so the route UI + buildMapsUrl below are reused verbatim.
    if (dateParam) {
      const { data, error: err } = await supabase
        .from('deliveries')
        .select(`
          id, created_at, delivery_date, notes, address_line1, city, state, zip,
          customers ( first_name, last_name, phone )
        `)
        .eq('business_id', businessId!)
        .eq('delivery_date', dateParam)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })
        .limit(50);

      if (err) { setError(err.message); setLoading(false); return; }

      const rows: DeliveryOrder[] = (data ?? []).map((d: any) => ({
        id: d.id,
        created_at: d.delivery_date ?? d.created_at,
        notes: d.notes ?? null,
        customers: d.customers ? {
          first_name: d.customers.first_name,
          last_name:  d.customers.last_name,
          phone:      d.customers.phone,
          address_line1: d.address_line1, // address is on the delivery row, not the customer
          city:  d.city,
          state: d.state,
          zip:   d.zip,
        } : null,
        order_items: [],
      }));
      setOrders(rows);
      const withAddr = new Set(rows.filter(o => fullAddress(o.customers).length > 0).map(o => o.id));
      setSelected(withAddr);
      setLoading(false);
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] route mode — date:', dateParam, 'stops:', rows.length, 'withAddr:', withAddr.size);
      return;
    }

    // ── DEFAULT MODE — cart-order deliveries (unchanged) ──
    const { data, error: err } = await supabase
      .from('orders')
      .select(`
        id, created_at, notes,
        customers ( first_name, last_name, phone, address_line1, city, state, zip ),
        order_items ( cultivar_plants ( common_name, species ) )
      `)
      .eq('business_id', businessId!)
      .eq('transport_method', 'delivery')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(30);

    if (err) { setError(err.message); setLoading(false); return; }

    const rows = (data ?? []) as DeliveryOrder[];
    setOrders(rows);

    // Pre-select orders that have an address
    const withAddr = new Set(rows.filter(o => fullAddress(o.customers).length > 0).map(o => o.id));
    setSelected(withAddr);

    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // Clear route when selection changes
    setRouteUrl(null);
  }

  function getAddress(order: DeliveryOrder): string {
    return overrides[order.id] ?? fullAddress(order.customers);
  }

  function buildRoute() {
    const stops = orders
      .filter(o => selected.has(o.id))
      .map(o => getAddress(o))
      .filter(Boolean);

    if (stops.length === 0) return;

    // Anchor the route at the business address. DEFAULT = round-trip (farm → stops → farm):
    // origin injected as BOTH start and end; customer stops stay in their entered order between.
    //
    // SEAM (AC-4 — settle once, encode as variable; DEFERRED, do NOT build here):
    //   • endpointMode — future settable option: 'round_trip' (default) | 'one_way' | 'custom_end'
    //   • stop-order OPTIMIZATION (reorder stops for shortest path) — deferred
    // Encoded as a variable so round-trip is the default, never welded as the only possibility.
    const endpointMode: 'round_trip' | 'one_way' | 'custom_end' = 'round_trip';
    const origin = originAddress.trim();
    const ordered = [...stops];
    if (origin) {
      ordered.unshift(origin);                               // start at the farm
      if (endpointMode === 'round_trip') ordered.push(origin); // …and return to it
      if (TRACE_DELIVERY) console.log('[TRACE:ROUTE] anchor injected', { endpointMode, origin, stops: stops.length, total: ordered.length });
    } else if (TRACE_DELIVERY) {
      console.warn('[TRACE:ROUTE] no business address — route built without anchor', { stops: stops.length });
    }
    setRouteUrl(buildMapsUrl(ordered));

    // Same ordered set, structured for the embedded map (label = customer name).
    const stopModels: RouteStop[] = selectedOrders
      .map(o => ({
        label: o.customers ? `${o.customers.first_name} ${o.customers.last_name}` : 'Customer',
        address: getAddress(o),
      }))
      .filter(s => s.address.length > 0);
    setRouteStops(stopModels);
    setRouteOrigin(origin);
    if (TRACE_DELIVERY) console.log('[TRACE:MAP] route model set', { origin: !!origin, stops: stopModels.length, keyPresent: !!MAPS_KEY });
  }

  function copyLink() {
    if (!routeUrl) return;
    navigator.clipboard.writeText(routeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function textDriver() {
    if (!routeUrl) return;
    const count = selectedOrders.length;
    const body  = `Today's delivery route (${count} stop${count !== 1 ? 's' : ''}):\n${routeUrl}`;
    window.open(`sms:?body=${encodeURIComponent(body)}`);
  }

  const selectedOrders = orders.filter(o => selected.has(o.id));
  const canBuild = selectedOrders.some(o => getAddress(o).length > 0);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            {dateParam ? 'Delivery — Scheduled Day' : 'Delivery'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#a8c890' }}>
            {loading ? 'Loading…'
              : dateParam ? `${dateParam} · ${orders.length} stop${orders.length !== 1 ? 's' : ''}`
              : `${orders.length} pending deliver${orders.length !== 1 ? 'ies' : 'y'}`}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {loading && <p style={{ textAlign: 'center', color: GRAY, paddingTop: 40 }}>Loading…</p>}
        {error  && <p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: GRAY }}>
            <Truck size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No pending deliveries</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>Delivery orders will appear here when customers choose delivery at checkout.</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <p style={{ fontSize: '0.8125rem', color: GRAY, marginBottom: 12 }}>
              Select stops to include in today's route.
            </p>

            {/* Order list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {orders.map((order, idx) => {
                const isSelected = selected.has(order.id);
                const addr = getAddress(order);
                const hasAddr = addr.length > 0;
                const p = order.order_items?.[0]?.cultivar_plants;
              const plant = p?.common_name ?? p?.species ?? 'Plant';
                const custName = order.customers
                  ? `${order.customers.first_name} ${order.customers.last_name}`
                  : 'Unknown customer';

                return (
                  <div key={order.id} style={{
                    background: '#fff', borderRadius: 12, padding: '14px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                    borderLeft: isSelected ? `4px solid ${GREEN}` : '4px solid #e5e7eb',
                    opacity: isSelected ? 1 : 0.6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

                      {/* Checkbox */}
                      <button onClick={() => toggleSelect(order.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, flexShrink: 0 }}>
                        {isSelected
                          ? <CheckSquare size={20} color={GREEN} />
                          : <Square size={20} color="#d1d5db" />}
                      </button>

                      <div style={{ flex: 1 }}>
                        {/* Stop number + name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {isSelected && (
                            <span style={{
                              width: 20, height: 20, borderRadius: '50%', background: GREEN,
                              color: '#fff', fontSize: '0.6875rem', fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              {selectedOrders.indexOf(order) + 1}
                            </span>
                          )}
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: DARK }}>{custName}</span>
                        </div>

                        {/* Plant + date */}
                        <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: GRAY }}>
                          {plant} · {fmt(order.created_at)}
                        </p>

                        {/* Address */}
                        {hasAddr ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={13} color={GREEN} />
                            <span style={{ fontSize: '0.8125rem', color: DARK }}>{addr}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MapPin size={13} color="#d1d5db" />
                            <input
                              placeholder="Enter delivery address…"
                              value={overrides[order.id] ?? ''}
                              onChange={e => {
                                setOverrides(o => ({ ...o, [order.id]: e.target.value }));
                                setRouteUrl(null);
                              }}
                              style={{
                                flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px',
                                fontSize: '0.8125rem', outline: 'none', color: DARK,
                              }}
                            />
                          </div>
                        )}

                        {/* Phone */}
                        {order.customers?.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <Phone size={12} color={GRAY} />
                            <span style={{ fontSize: '0.75rem', color: GRAY }}>{order.customers.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Build route button */}
            {!routeUrl ? (
              <button
                onClick={buildRoute}
                disabled={!canBuild}
                style={{
                  width: '100%', padding: '15px 20px',
                  background: canBuild ? GREEN : '#e5e7eb',
                  color: canBuild ? '#fff' : '#9ca3af',
                  fontWeight: 700, fontSize: '0.9375rem', borderRadius: 12, border: 'none',
                  cursor: canBuild ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Navigation size={18} />
                Route {selectedOrders.length} Stop{selectedOrders.length !== 1 ? 's' : ''}
              </button>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {/* Embedded map — numbered pins in route order. Skipped entirely when
                    no key/no stops; on failure it self-degrades. The URL card below
                    is the always-present fallback (never lost). */}
                {MAPS_KEY && routeStops.length > 0 && (
                  <RouteMap apiKey={MAPS_KEY} origin={routeOrigin} stops={routeStops} />
                )}

                {/* Route summary */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Navigation size={18} color={GREEN} />
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: GREEN }}>
                    Route ready — {selectedOrders.length} stop{selectedOrders.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {selectedOrders.map((o, i) => (
                    <div key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', background: GREEN,
                        color: '#fff', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 1}</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: DARK }}>
                          {o.customers ? `${o.customers.first_name} ${o.customers.last_name}` : 'Customer'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: GRAY }}>{getAddress(o)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <a
                    href={routeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 20px', background: GREEN, color: '#fff',
                      fontWeight: 700, fontSize: '0.9375rem', borderRadius: 12, textDecoration: 'none',
                    }}
                  >
                    <Navigation size={16} /> Open in Google Maps
                  </a>

                  <button
                    onClick={textDriver}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 20px', background: '#eff6ff', border: '1.5px solid #93c5fd',
                      color: '#1d4ed8', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 12, cursor: 'pointer',
                    }}
                  >
                    <Send size={16} /> Text Route to Driver
                  </button>

                  <button
                    onClick={copyLink}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 20px', background: '#f9fafb', border: '1.5px solid #e5e7eb',
                      color: DARK, fontWeight: 600, fontSize: '0.875rem', borderRadius: 12, cursor: 'pointer',
                    }}
                  >
                    <Copy size={15} /> {copied ? 'Copied!' : 'Copy Route Link'}
                  </button>

                  <button
                    onClick={() => setRouteUrl(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: GRAY, fontSize: '0.8125rem', fontWeight: 600, padding: '4px 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    <X size={13} /> Rebuild Route
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
