import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderItemName } from '../lib/orderItemName';
import {
  Truck, MapPin, Navigation, Copy, Send,
  CheckSquare, Square, Plus, X, Phone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { customerDisplayName } from '@trace/shared/utils/personName';
import { CaptureInvoiceLauncher } from '../components/CaptureInvoiceLauncher';
import { NotPermitted } from '@trace/shared/components/SurfaceState';
import { buildRouteHandoff, driverSmsBody, type HandoffStop } from '../lib/routeHandoff';
// ?date= mode renders the ONE stop (ledger #301, STD-017): the same read, card and actions as the
// schedule and the order screen. This page adds only its own axis — the selection and the sequence.
import { readStops, type StopRead } from '../lib/stopRead';
import { shipToLine } from '../lib/stopWrites';
import { StopCard } from '../components/delivery/StopCard';
import { useStopActions } from '../components/delivery/useStopActions';

interface DeliveryOrder {
  id: string;
  created_at: string;
  notes: string | null;
  customers: {
    first_name: string;
    last_name: string;
    phone: string | null;
    address_line1: string | null;
    billing_line1?: string | null; billing_city?: string | null; billing_state?: string | null; billing_zip?: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  // description/sku carried so a line with no lot can still name itself (a history order has no
  // lot on any line, by invariant). Shape kept compatible with OrderItemAnchorFields.
  order_items: { description?: string | null; sku?: string | null; business_inventory: { name: string | null } | null }[];
}

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

function fullAddress(c: DeliveryOrder['customers']): string {
  if (!c) return '';
// D-41 read repoint (2026-07-29): billing_* is canonical, the unprefixed columns are its
// legacy mirror. Read canonical FIRST and fall back — the same order the QBO invoice already used,
// which is why the invoice printed the curated address while these surfaces showed the stale one.
  const parts = [c.billing_line1 ?? c.address_line1, c.billing_city ?? c.city,
                 c.billing_state ?? c.state, c.billing_zip ?? c.zip].filter(Boolean);
  return parts.join(', ');
}

// "1h 5m" / "45m" from a minutes value (Directions legs sum).
function formatDriveTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// [TRACE:DELIVERY] STD-003 — ON until David owner-proves the scheduled-deliveries route
const TRACE_DELIVERY = true;

// Client-side Google Maps key. VITE_-prefixed so Vite injects it into the browser
// bundle (the unprefixed name is invisible to the client). Referrer-restricted key,
// safe to expose. Absent/blank → the embedded map is skipped entirely and the
// "Open in Google Maps" URL-handoff card below remains the working fallback.
const MAPS_KEY = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Client-side loader for the Maps JS API — no new Vercel function (api/ stays 12/12).
// Uses Google's OFFICIAL "Dynamic Library Import" bootstrap loader. This is the ONLY
// load method that GUARANTEES `google.maps.importLibrary` exists — the legacy
// `maps/api/js?...&loading=async` script tag does NOT reliably attach it (that was the
// "importLibrary missing" bug). The bootstrap installs importLibrary synchronously; each
// caller then awaits the specific library it needs (geocoding, maps, marker).
let mapsBootstrapped = false;
function installMapsBootstrap(apiKey: string): void {
  if (mapsBootstrapped) return;
  mapsBootstrapped = true;
  // Google's documented inline bootstrap, TS-typed and de-async'd (the original's
  // `new Promise(async …)` is an anti-pattern that trips no-async-promise-executor —
  // the awaited createElement was a no-op, so removing async is behaviour-identical).
  ((g: any) => {
    let h: any, a: any, k: any;
    const p = 'The Google Maps JavaScript API', c = 'google', l = 'importLibrary',
      q = '__ib__', m = document;
    let b: any = window;
    b = b[c] || (b[c] = {});
    const d = b.maps || (b.maps = {});
    const r = new Set<string>();
    const e = new URLSearchParams();
    const u = () => h || (h = new Promise((f: any, n: any) => {
      a = m.createElement('script');
      e.set('libraries', [...r] + '');
      for (k in g) e.set(k.replace(/[A-Z]/g, (t: string) => '_' + t[0].toLowerCase()), g[k]);
      e.set('callback', c + '.maps.' + q);
      a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
      d[q] = f;
      a.onerror = () => (h = n(Error(p + ' could not load.')));
      a.nonce = (m.querySelector('script[nonce]') as any)?.nonce || '';
      m.head.append(a);
    }));
    // If importLibrary already exists (real API loaded), leave it; else install the stub
    // that lazily boots the script on first use. Google overwrites d[l] with the real
    // implementation once the script loads, so the .then re-dispatch hits the real one.
    if (d[l]) {
      console.warn(p + ' only loads once. Ignoring:', g);
    } else {
      d[l] = (f: any, ...n: any[]) => r.add(f) && u().then(() => d[l](f, ...n));
    }
  })({ key: apiKey, v: 'weekly' });
}

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  installMapsBootstrap(apiKey);
  if (!w.google?.maps?.importLibrary) {
    return Promise.reject(new Error('maps bootstrap did not install importLibrary'));
  }
  if (TRACE_DELIVERY) console.log('[TRACE:MAP] bootstrap loader ready — importLibrary present');
  return Promise.resolve(w.google.maps);
}

// The stop shape is `HandoffStop` — the SAME type the driver-facing derivation consumes, so a stop
// cannot be shaped one way for the screen and another way for the link (§6 r8).
type RouteStop = HandoffStop;

// Result reported by RouteMap back to the parent after a route renders: drive
// distance/time (null when Directions was skipped/failed) + the stops in optimized
// driving order (null on the straight-polyline fallback → parent keeps built order).
interface RouteResult { miles: number | null; minutes: number | null; orderedStops: RouteStop[] | null; }

/**
 * RouteMap — embedded Google Maps JS map with a ROAD-FOLLOWING route + NUMBERED pins.
 * PURPOSE: render the built delivery route (business origin anchor ⌂ + ordered customer
 *          stops) as an interactive map — a real driving route drawn on roads via the
 *          Directions API, with numbered markers in OPTIMIZED (shortest-path) order — so
 *          the owner/driver sees the day's route visually. ADDITIVE to, never a
 *          replacement for, the "Open in Google Maps" URL handoff below it.
 * DEPENDENCIES: Google Maps JavaScript API + Geocoding + Directions (client-side script
 *          loader; key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY, referrer-restricted).
 *          ZERO Vercel functions.
 * OUTPUTS: geocodes each address → asks DirectionsService for a round-trip driving route
 *          (origin=⌂, waypoints=stops, dest=⌂, optimizeWaypoints:true) → DirectionsRenderer
 *          draws the road polyline (suppressMarkers:true) while our own numbered markers are
 *          renumbered to the optimized order → sums legs for miles + drive time → reports
 *          {miles, minutes, orderedStops} to the parent. On ANY failure (no key, load error,
 *          every geocode misses, Directions error, >25 waypoints) it degrades quietly — a
 *          straight polyline fallback or a muted note; the parent's URL card is always the floor.
 * NOTE (standard-by-value): loads Geocoder/Map/Marker/Directions via the modular
 *          `importLibrary` (current Maps JS pattern — core does NOT bundle them). Directions API
 *          (classic) chosen over Routes API: it is the only one with a drop-in JS renderer for our
 *          existing client map + referrer-restricted key + zero-function constraint. Keeps the
 *          classic `Marker` for numbered labels — AdvancedMarkerElement needs a mapId + more setup
 *          that buys nothing for numbered pins; deferred. Divergences recorded.
 * [TRACE:MAP] on the lib-ready → geocode → directions-requested → directions-ok → render path (STD-003, ON until owner-proven).
 */
function RouteMap({ apiKey, origin, stops, onResult }: { apiKey: string; origin: string; stops: RouteStop[]; onResult?: (r: RouteResult) => void }) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [note, setNote] = useState<string>('');
  // Keep the latest onResult in a ref so it is NOT an effect dependency — passing an
  // inline callback from the parent would otherwise re-run the whole map init every render.
  const onResultRef = React.useRef(onResult);
  onResultRef.current = onResult;

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
        const [{ Geocoder }, { Map }, { Marker }, { DirectionsService, DirectionsRenderer }] = await Promise.all([
          maps.importLibrary('geocoding'),
          maps.importLibrary('maps'),
          maps.importLibrary('marker'),
          maps.importLibrary('routes'),
        ]);
        if (TRACE_DELIVERY) console.log('[TRACE:MAP] geocoding + routes libs ready');
        if (cancelled || !mapRef.current) return;

        const geocoder = new Geocoder();
        if (TRACE_DELIVERY) console.log('[TRACE:MAP] Geocoder constructed OK');
        const geocode = (address: string) => new Promise<any | null>((resolve) => {
          geocoder.geocode({ address }, (results: any, gcStatus: string) => {
            if (gcStatus === 'OK' && results && results[0]) resolve(results[0].geometry.location);
            else { if (TRACE_DELIVERY) console.warn('[TRACE:MAP] geocode miss', { address, gcStatus }); resolve(null); }
          });
        });

        // Ordered points: origin anchor first (⌂), then customer stops 1..N in entered order
        // (renumbered later to the optimized driving order). `stop` carries the RouteStop so we
        // can report the optimized sequence back to the parent for the on-card list.
        const points: { marker: string; title: string; address: string; isOrigin: boolean; stop: RouteStop | null }[] = [];
        if (origin) points.push({ marker: '⌂', title: 'Start / return (business)', address: origin, isOrigin: true, stop: null });
        stops.forEach((s, i) => points.push({ marker: String(i + 1), title: `${i + 1}. ${s.label}`, address: s.address, isOrigin: false, stop: s }));

        if (TRACE_DELIVERY) console.log('[TRACE:MAP] geocoding', points.length, 'points', { hasOrigin: !!origin, stops: stops.length });

        const located = await Promise.all(points.map(async p => ({ ...p, loc: await geocode(p.address) })));
        if (cancelled || !mapRef.current) return;

        const good = located.filter(p => p.loc);
        if (good.length === 0) {
          if (TRACE_DELIVERY) console.warn('[TRACE:MAP] no points geocoded — hiding map', { attempted: points.length });
          if (!cancelled) { setStatus('error'); setNote('Couldn’t locate these addresses on the map — use the link below.'); }
          return;
        }

        const originPt = located.find(p => p.isOrigin && p.loc) ?? null;
        const stopPts  = located.filter(p => !p.isOrigin && p.loc);

        const map = new Map(mapRef.current, {
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        const bounds = new maps.LatLngBounds();
        const label = (t: string) => ({ text: t, color: '#fff', fontWeight: '700', fontSize: '0.8125rem' });

        // Attempt a real driving route via Directions. Round-trip when we have a farm anchor
        // (origin=dest=⌂, waypoints=stops); otherwise first→last stop with the middle as
        // waypoints. optimizeWaypoints reorders for shortest path and returns waypoint_order.
        let orderedStops = stopPts;                                  // default = entered order
        let usedDirections = false;
        let summary: { miles: number; minutes: number } | null = null;
        // JS Directions supports up to 25 waypoints; over that (or too few points) we skip it.
        const wpCount = originPt ? stopPts.length : Math.max(0, stopPts.length - 2);
        const canRoute = wpCount <= 25 && (originPt ? stopPts.length >= 1 : stopPts.length >= 2);

        if (canRoute) {
          try {
            if (TRACE_DELIVERY) console.log('[TRACE:MAP] directions requested', { stops: stopPts.length, hasOrigin: !!originPt, waypoints: wpCount });
            const wp = originPt ? stopPts : stopPts.slice(1, -1);
            const reqOrigin = originPt ? originPt.loc : stopPts[0].loc;
            const reqDest   = originPt ? originPt.loc : stopPts[stopPts.length - 1].loc;
            const result = await new DirectionsService().route({
              origin: reqOrigin,
              destination: reqDest,
              waypoints: wp.map(p => ({ location: p.loc, stopover: true })),
              optimizeWaypoints: true,
              travelMode: maps.TravelMode.DRIVING,
            });
            if (cancelled || !mapRef.current) return;

            const r = result.routes[0];
            const order: number[] = (r.waypoint_order && r.waypoint_order.length) ? r.waypoint_order : wp.map((_: any, i: number) => i);
            orderedStops = originPt
              ? order.map((i: number) => wp[i])
              : [stopPts[0], ...order.map((i: number) => wp[i]), stopPts[stopPts.length - 1]];

            let meters = 0, seconds = 0;
            r.legs.forEach((l: any) => { meters += l.distance?.value ?? 0; seconds += l.duration?.value ?? 0; });
            summary = { miles: meters / 1609.344, minutes: seconds / 60 };

            // Draw the road polyline only — our numbered markers are drawn below.
            new DirectionsRenderer({
              map, directions: result, suppressMarkers: true, preserveViewport: true,
              polylineOptions: { strokeColor: GREEN, strokeOpacity: 0.85, strokeWeight: 4 },
            });
            usedDirections = true;
            if (TRACE_DELIVERY) console.log('[TRACE:MAP] directions ok', { miles: +summary.miles.toFixed(1), minutes: Math.round(summary.minutes), optimizedOrder: order });
          } catch (dirErr) {
            // Directions failed → keep entered order, fall through to the straight polyline.
            if (TRACE_DELIVERY) console.warn('[TRACE:MAP] directions failed — straight-line fallback', dirErr);
            orderedStops = stopPts;
            usedDirections = false;
          }
        } else if (TRACE_DELIVERY) {
          console.warn('[TRACE:MAP] directions skipped — straight-line fallback', { waypoints: wpCount, stops: stopPts.length, reason: wpCount > 25 ? 'over-25-waypoints' : 'too-few-points' });
        }

        // Numbered markers, in the (optimized when routed) driving order: ⌂ then 1..N.
        if (originPt) { new Marker({ position: originPt.loc, map, label: label('⌂'), title: 'Start / return (business)' }); bounds.extend(originPt.loc); }
        orderedStops.forEach((p, i) => {
          new Marker({ position: p.loc, map, label: label(String(i + 1)), title: `${i + 1}. ${p.stop?.label ?? ''}` });
          bounds.extend(p.loc);
        });

        // Straight-line fallback ONLY when Directions did not draw the road route.
        if (!usedDirections) {
          const path: any[] = [];
          if (originPt) path.push(originPt.loc);
          orderedStops.forEach(p => path.push(p.loc));
          new maps.Polyline({ path, map, geodesic: false, strokeColor: GREEN, strokeOpacity: 0.7, strokeWeight: 3 });
        }

        map.fitBounds(bounds, 48);
        if (good.length === 1) map.setZoom(14);

        if (!cancelled) {
          setStatus('ready');
          onResultRef.current?.({
            miles: summary ? summary.miles : null,
            minutes: summary ? summary.minutes : null,
            orderedStops: usedDirections ? orderedStops.map(p => p.stop).filter((s): s is RouteStop => s !== null) : null,
          });
          if (TRACE_DELIVERY) console.log('[TRACE:MAP] rendered', { located: good.length, missed: located.length - good.length, directions: usedDirections });
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
  const { businessId, can } = useBusinessContext();

  const [orders, setOrders]     = useState<DeliveryOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Selected order IDs for the route
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Address overrides for orders missing customer address
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Route result state.
  // 🔴 `routeUrl` IS NOT STATE AND MUST NOT BECOME STATE AGAIN. It is DERIVED below from the exact
  // array the numbered list renders, so the link cannot disagree with the screen (David's ruling,
  // 2026-09-08 — option B). A stored copy is what shipped the un-optimised route to the driver for
  // fourteen months: it was frozen in buildRoute() before the optimiser had run, and never revisited.
  const [copied, setCopied]     = useState(false);

  // The route model: ordered stops + origin anchor, published by buildRoute(). It is the ONLY
  // route state — the map optimises it, the list renders it, and the driver's URL is derived
  // from it. There is no second copy to keep in step, which is the point.
  const [routeStops, setRouteStops]   = useState<RouteStop[]>([]);
  const [routeOrigin, setRouteOrigin] = useState<string>('');

  // Business address — injected as the route origin/destination (round-trip anchor).
  const [originAddress, setOriginAddress] = useState<string>('');

  // Drive summary (miles + minutes) + optimized stop order, reported by RouteMap after it
  // renders the Directions route. Null until a route with a road path resolves.
  const [routeSummary, setRouteSummary] = useState<RouteResult | null>(null);

  // ?date= mode: the stops for the day, read through the ONE stop read (ledger #301).
  const [stopData, setStopData] = useState<StopRead | null>(null);
  // Set when a stop changed while a route was on screen. The route and its Google Maps link are DERIVED
  // from the stops' addresses, so a changed ship-to must rebuild them from the re-read — a link that
  // outlives the address it was built from is the stale-handoff defect (ledger #286) wearing a new coat.
  const [rebuildPending, setRebuildPending] = useState(false);
  const actions = useStopActions({
    stops: stopData?.stops ?? [],
    onChanged: async () => {
      if (routeStops.length > 0) setRebuildPending(true);
      clearRoute();
      await load();
    },
  });

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

    // ── SCHEDULED-DELIVERIES MODE (?date=) — the day's STOPS, through the ONE stop read ──
    // Before ledger #301 this mapped each stop into the cart-order shape through a synthetic
    // `customers` object carrying the stop's address — which is why the route showed a name and a
    // location and nothing else. It now reads the same stop the schedule and the order screen read.
    if (dateParam) {
      const res = await readStops(supabase, businessId!, { kind: 'day', date: dateParam }, { readLines: can('order_items:read') });
      if (!res.ok) { setError(res.error); setLoading(false); return; }
      setStopData(res.value);
      const withAddr = new Set(res.value.stops.filter(s => shipToLine(s).length > 0).map(s => s.id));
      setSelected(withAddr);
      setLoading(false);
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] route mode — date:', dateParam, 'stops:', res.value.stops.length, 'withAddr:', withAddr.size);
      return;
    }

    // ── DEFAULT MODE — cart-order deliveries (unchanged) ──
    const { data, error: err } = await supabase
      .from('orders')
      .select(`
        id, created_at, notes,
        customers ( first_name, last_name, phone, address_line1, city, state, zip, billing_line1, billing_city, billing_state, billing_zip ),
        order_items ( description, sku, business_inventory ( name ) )
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
    clearRoute();
  }

  function getAddress(order: DeliveryOrder): string {
    return overrides[order.id] ?? fullAddress(order.customers);
  }

  function buildRoute() {
    // The ordered set, structured for the embedded map AND for the driver handoff (label = customer
    // name). ONE array, built ONCE: the map optimises it, the list renders it, the link is derived
    // from it. (It was previously assembled twice — a bare address list for the URL and this model
    // for the map — which is precisely the parallel-copy shape that let the two drift apart.)
    const stopModels: RouteStop[] = selectedCandidates
      .map(c => ({ label: c.label, address: c.address }))
      .filter(s => s.address.length > 0);

    if (stopModels.length === 0) return;

    // Anchor the route at the business address (round-trip: farm → stops → farm). The bookending
    // and the URL itself now live in `buildRouteHandoff` — this function's ONLY job is to publish
    // the stop MODEL. It deliberately builds no URL: at this instant the optimised order does not
    // exist yet (RouteMap has not mounted, let alone called Directions), which is exactly how the
    // stale link was minted before.
    //
    // SEAM (AC-4 — settle once, encode as variable; DEFERRED, do NOT build here):
    //   • endpointMode — future settable option: 'round_trip' (default) | 'one_way' | 'custom_end',
    //     carried as a parameter of buildRouteHandoff so round-trip is a default, never a weld.
    const origin = originAddress.trim();
    if (TRACE_DELIVERY && !origin) {
      console.warn('[TRACE:ROUTE] no business address — route built without anchor', { stops: stopModels.length });
    }

    setRouteSummary(null);           // cleared until RouteMap reports the new Directions result
    setRouteStops(stopModels);
    setRouteOrigin(origin);
    if (TRACE_DELIVERY) console.log('[TRACE:MAP] route model set', { origin: !!origin, stops: stopModels.length, keyPresent: !!MAPS_KEY });
  }

  // Discard the built route. ONE operation, three callers (selection changed · address typed ·
  // Rebuild pressed) — previously three inline `setRouteUrl(null)` calls, which is the shape that
  // lets one caller forget a field (§6 r8). Clearing the stops is what retracts the route now:
  // the URL is derived, so it disappears with the array it is made of.
  function clearRoute() {
    setRouteStops([]);
    setRouteOrigin('');
    setRouteSummary(null);
  }

  function copyLink() {
    if (!routeUrl) return;
    navigator.clipboard.writeText(routeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function textDriver() {
    // Body and count come from the SAME handoff object as the link — never a count computed here.
    // It used to read `selectedCandidates.length`, so five selected orders with two blank addresses
    // texted "(5 stops)" above a three-stop link.
    const body = driverSmsBody(handoff);
    if (!body) return;
    if (TRACE_DELIVERY) console.log('[TRACE:ROUTE] texting driver', { stops: handoff.stopCount, optimized: routeSummary?.orderedStops != null });
    window.open(`sms:?body=${encodeURIComponent(body)}`);
  }

  // The route's candidates, from whichever source this mode reads. ?date= reads STOPS and their
  // snapshotted ship-to; the legacy mode reads cart orders and the customer's address. One shape, so the
  // build, the count and the handoff below do not care which.
  const candidates: { id: string; label: string; address: string }[] = dateParam
    ? (stopData?.stops ?? []).map(s => ({ id: s.id, label: customerDisplayName(s.customers, 'Customer'), address: shipToLine(s) }))
    : orders.map(o => ({ id: o.id, label: customerDisplayName(o.customers, 'Customer'), address: getAddress(o) }));
  const selectedCandidates = candidates.filter(c => selected.has(c.id));
  const canBuild = selectedCandidates.some(c => c.address.length > 0);

  // A stop changed while a route was on screen → rebuild from the re-read, once it has landed. The link
  // is derived from `displayStops`, so rebuilding the stops is what makes it carry the new address.
  useEffect(() => {
    if (!rebuildPending || loading) return;
    setRebuildPending(false);
    if (TRACE_DELIVERY) console.log('[TRACE:ROUTE] stop changed — rebuilding the route from the re-read');
    buildRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildPending, loading, stopData]);

  // Stops shown on the route-ready card: optimized driving order when Directions resolved,
  // else the built order. Keeps pins + list + route in agreement.
  const displayStops = routeSummary?.orderedStops ?? routeStops;

  // 🔴 THE ONE DERIVATION. Link, SMS body, clipboard and the "Route ready — N stops" header all
  // read this object, and it is built from `displayStops` — the very array the numbered list below
  // renders. Optimised when Directions resolved, built order when it did not; either way the
  // driver receives what the manager saw, because there is only one array to receive.
  const handoff = React.useMemo(
    () => buildRouteHandoff(displayStops, routeOrigin),
    [displayStops, routeOrigin],
  );
  const routeUrl = handoff.url;
  const routeStopCount = handoff.stopCount;
  // `routeStops` (not the URL) is what says a route has been built — cleared by clearRoute().
  const routeBuilt = routeStops.length > 0;

  // [TRACE:ROUTE] STD-003 — the handoff trail, ON until owner-proven. Emitted in an effect rather
  // than in render so it fires once per real change, not once per paint: `optimized` flipping
  // false→true with a changed `first` IS the fix working, and that is the line to read on the card.
  useEffect(() => {
    if (!TRACE_DELIVERY || !handoff.url) return;
    console.log('[TRACE:ROUTE] handoff derived', {
      stops: handoff.stopCount,
      optimized: routeSummary?.orderedStops != null,
      first: displayStops[0]?.label ?? null,
      last: displayStops[displayStops.length - 1]?.label ?? null,
      url: handoff.url,
    });
  }, [handoff, displayStops, routeSummary]);

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
              : dateParam ? `${dateParam} · ${candidates.length} stop${candidates.length !== 1 ? 's' : ''}`
              : `${candidates.length} pending deliver${candidates.length !== 1 ? 'ies' : 'y'}`}
          </p>
        </div>
        {/* Second door into the invoice OCR→infer→route flow (owner action, matches the delivery-card gating). */}
        {/* Capturing an invoice WRITES a cost record — `costs:create`, the capability exercised,
            rather than the identity of the person exercising it (ruling 2026-07-30). */}
        {can('costs:create') && <CaptureInvoiceLauncher />}
        {!can('costs:create') && (
          <NotPermitted permission="costs:create" what="Capturing an invoice" inline />
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {loading && <p style={{ textAlign: 'center', color: GRAY, paddingTop: 40 }}>Loading…</p>}
        {error  && <p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p>}

        {actions.actionError && (
          <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{actions.actionError}</span>
            <button onClick={actions.clearActionError} style={{ background: 'none', border: 'none', color: '#991B1B', fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>Dismiss</button>
          </div>
        )}

        {!loading && !error && candidates.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: GRAY }}>
            <Truck size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>{dateParam ? 'Nothing scheduled on this day' : 'No pending deliveries'}</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
              {dateParam ? 'Pick another day on the schedule to route its stops.' : 'Delivery orders will appear here when customers choose delivery at checkout.'}
            </p>
          </div>
        )}

        {!loading && !error && candidates.length > 0 && (
          <>
            <p style={{ fontSize: '0.8125rem', color: GRAY, marginBottom: 12 }}>
              Select stops to include in today's route.
            </p>

            {/* Stop list. ?date= renders the ONE StopCard (ledger #301); this page's own axis — the
                selection and the sequence — is passed in as `leading`. The legacy cart-order list below
                it is unchanged (tech-debt #277). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {dateParam && stopData && stopData.stops.map(s => {
                const isSelected = selected.has(s.id);
                const seq = selectedCandidates.findIndex(c => c.id === s.id) + 1;
                return (
                  <StopCard
                    key={s.id}
                    stop={s}
                    read={stopData}
                    actions={actions}
                    selected={isSelected}
                    leading={
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => toggleSelect(s.id)}
                          aria-label={isSelected ? 'Leave this stop out of the route' : 'Include this stop in the route'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 10, margin: -10 }}
                        >
                          {isSelected ? <CheckSquare size={22} color={GREEN} /> : <Square size={22} color="#d1d5db" />}
                        </button>
                        {isSelected && (
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%', background: GREEN, color: '#fff',
                            fontSize: '0.6875rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {seq}
                          </span>
                        )}
                      </div>
                    }
                  />
                );
              })}
              {!dateParam && orders.map((order, idx) => {
                const isSelected = selected.has(order.id);
                const addr = getAddress(order);
                const hasAddr = addr.length > 0;
                // Routed through the ONE shared resolver (§6 r8) rather than reading the lot
                // directly. The old `p?.name ?? 'Plant'` printed the generic word "Plant" for every
                // history-order line — not a false claim like "Unknown plant", but still a screen
                // discarding "Mexican Sycamore - 45 gallon" that was sitting on the same row.
                const firstItem = order.order_items?.[0];
                const plant = firstItem ? orderItemName(firstItem) : 'No items';
                const custName = customerDisplayName(order.customers, 'Unknown customer');

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
                              {selectedCandidates.findIndex(c => c.id === order.id) + 1}
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
                                clearRoute();
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
            {/* A route exists only when stops were built AND at least one carries a drivable
                address. Naming both halves in the condition also narrows `routeUrl` to a string
                for the link below — the card can never render a null href. */}
            {!routeBuilt || routeUrl === null ? (
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
                Route {selectedCandidates.length} Stop{selectedCandidates.length !== 1 ? 's' : ''}
              </button>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {/* Embedded map — numbered pins in route order. Skipped entirely when
                    no key/no stops; on failure it self-degrades. The URL card below
                    is the always-present fallback (never lost). */}
                {MAPS_KEY && routeStops.length > 0 && (
                  <RouteMap apiKey={MAPS_KEY} origin={routeOrigin} stops={routeStops} onResult={setRouteSummary} />
                )}

                {/* Route summary */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: routeSummary?.miles != null ? 4 : 14 }}>
                  <Navigation size={18} color={GREEN} />
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: GREEN }}>
                    Route ready — {routeStopCount} stop{routeStopCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {routeSummary?.miles != null && routeSummary?.minutes != null && (
                  <p style={{ margin: '0 0 14px 26px', fontSize: '0.8125rem', color: GRAY, fontWeight: 600 }}>
                    {routeSummary.miles.toFixed(1)} miles · {formatDriveTime(routeSummary.minutes)} drive · optimized order
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {displayStops.map((s, i) => (
                    <div key={`${i}-${s.address}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', background: GREEN,
                        color: '#fff', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 1}</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: DARK }}>
                          {s.label}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: GRAY }}>{s.address}</p>
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
                    onClick={clearRoute}
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

      {/* The review ask and the customer editor, once for the page (useStopActions). */}
      {actions.overlays}
    </div>
  );
}
