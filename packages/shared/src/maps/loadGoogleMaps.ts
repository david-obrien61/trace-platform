// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Load the Google Maps JS API once, for any screen that needs a map.
// DEPENDENCIES: the browser Maps key, passed in — this module reads no env var.
// OUTPUTS:      loadGoogleMaps().
//
// 🔴 EXTRACTED FROM `DeliveryRoute.tsx`, NOT COPIED (§6 r8). A second screen — Settings →
// Delivery's ring map — needs the same loader, and this one carries a real bug history: the
// legacy `maps/api/js?...&loading=async` script tag does NOT reliably attach `importLibrary`,
// which is the "importLibrary missing" defect the comment below records. Re-typing a loader whose
// correctness was learned the hard way is how the second copy gets the old bug back.
//
// ⚠️ NO NEW SERVER FUNCTION and NO KEY IN THIS FILE: the caller passes the browser key, which is
// referrer-restricted and public by design — and, since 2026-09-25, that restriction is MEASURED
// by `npm run verify:browser-key` rather than asserted in a comment.
// ─────────────────────────────────────────────────────────────────────────────
const TRACE_MAP = true;   // STD-003: on by default until owner-proven.

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

export function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  installMapsBootstrap(apiKey);
  if (!w.google?.maps?.importLibrary) {
    return Promise.reject(new Error('maps bootstrap did not install importLibrary'));
  }
  if (TRACE_MAP) console.log('[TRACE:MAP] bootstrap loader ready — importLibrary present');
  return Promise.resolve(w.google.maps);
}
