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

// ═════════════════════════════════════════════════════════════════════════════
// 🔴 GOOGLE REFUSING THE KEY IS NOT AN EXCEPTION — IT IS A CALLBACK, AND NOBODY WAS LISTENING
// ═════════════════════════════════════════════════════════════════════════════
// FOUND LIVE 2026-09-25: Settings → Delivery showed an EMPTY PALE BOX on production and said
// nothing. Every `try/catch` around the loader was intact and none of them fired, because a
// rejected key does not throw: the bootstrap script loads fine, `importLibrary` resolves fine,
// `new Map()` succeeds — and Google then reports the refusal by calling a GLOBAL,
// `window.gm_authFailure`, and by writing to the console. Nothing defined that global, so the
// only record of the failure was a console line nobody at a nursery will ever open.
//
// ⚠️ THIS IS EXACTLY [[R-33]]'s SHAPE IN A FAILURE PATH: three catch blocks that could not
// catch the most likely failure. The catch handles "the script did not load"; this handles "the
// script loaded and Google said no", and they are different events with one appearance.
//
// It is installed HERE, in the loader, because the loader is what owns the key — a component
// that wanted this would have to know how the key is passed, and then every component would
// need its own copy (§6 r8).
type MapsAuthListener = () => void;
const authListeners = new Set<MapsAuthListener>();
let authFailed = false;

/**
 * Be told when Google refuses the key. Returns an unsubscribe.
 *
 * 🔴 IT FIRES IMMEDIATELY IF THE REFUSAL ALREADY HAPPENED. A second map mounted after the first
 * one was refused would otherwise wait forever for an event that has already been and gone, and
 * show the same empty box this exists to abolish.
 */
export function onMapsAuthFailure(fn: MapsAuthListener): () => void {
  authListeners.add(fn);
  if (authFailed) fn();
  return () => { authListeners.delete(fn); };
}

/** Has Google already refused this key in this page's life? */
export function mapsAuthFailed(): boolean { return authFailed; }

/** Test seam — the module remembers a refusal for the page's lifetime, and a suite proving both
 *  sides of that needs a way back. Never called by the app. */
export function __resetMapsAuthForTest(): void { authFailed = false; authListeners.clear(); }

function installAuthFailureHook(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { gm_authFailure?: () => void };
  // Do not stamp over a hook somebody else installed — call it too, then ours.
  const prior = w.gm_authFailure;
  w.gm_authFailure = () => {
    authFailed = true;
    if (TRACE_MAP) console.log('[TRACE:MAP] gm_authFailure — Google refused the browser map key for', window.location.origin);
    try { prior?.(); } catch { /* another listener's problem is not ours */ }
    for (const fn of [...authListeners]) { try { fn(); } catch { /* one bad listener must not silence the rest */ } }
  };
}

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
  // BEFORE the script tag is appended — Google reads this global when auth fails, and a hook
  // installed after the refusal has already happened is a hook that never runs.
  installAuthFailureHook();
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
