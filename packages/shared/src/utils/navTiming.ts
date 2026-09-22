// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: measure the thing a person actually waits for — moving BETWEEN screens — and put the
//   number where David can read it. Not a page load: a client-side route change.
// DEPENDENCIES: none. `performance.now()` with a `Date.now()` fallback.
// OUTPUTS: markNavigation · reportScreenReady · lastNavigation · __resetNavTiming · NAV_TIMING_TAG.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS AND WHY CORE WEB VITALS CANNOT REPLACE IT.
//   Vercel Speed Insights reports LCP, CLS, INP, TTFB and FCP from real users — and every one of
//   them is measured on DOCUMENT LOAD. Going from `/customers/:id` back to `/customers` in a
//   React SPA is a route change: no new document, so NO NEW LCP. The five-plus seconds David
//   reported was invisible to it. Speed Insights is still worth having for real page loads; it
//   simply does not answer this question, and adopting it as though it did is [[R-26]]'s shape —
//   a written claim standing in for a measurement.
//
// ⚠️ IT MEASURES TO FIRST PAINT OF THE SCREEN'S OWN CONTENT, not to "the route changed". The route
//   changes instantly; what a person waits for is the list appearing. So the screen reports when
//   ITS rows are on the page, and the number carries the row count and whether the read was served
//   from a held copy — without those, 200 ms and 2,000 ms look like the same event.
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_TIMING_TAG = '[TRACE:NAV_TIMING]';

const now = (): number =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now() : Date.now();

interface NavMark { from: string; to: string; at: number; reported: boolean }
let current: NavMark | null = null;

/** Called on every client-side route change. Cheap: one object, no listener. */
export function markNavigation(to: string, from?: string): void {
  current = { from: from ?? (current?.to ?? '(first)'), to, at: now(), reported: false };
}

/** What the last navigation was, for a screen that wants to name it. Read-only. */
export function lastNavigation(): { from: string; to: string } | null {
  return current ? { from: current.from, to: current.to } : null;
}

/**
 * Called by a screen once its own content is on the page.
 *
 * 🔴 ONCE PER NAVIGATION, AND THE FLAG IS THE POINT. A list re-renders many times — a filter, a
 * sort, an inline edit — and every one of those would otherwise log a number measured from a
 * navigation that finished long ago. The second call for one navigation is ignored, so what is
 * logged is always "how long that move took", never "how long ago that move was".
 */
export function reportScreenReady(
  screen: string, detail: Record<string, unknown> = {},
  log: (msg: string, data: unknown) => void = console.log,
): number | null {
  if (!current || current.reported) return null;
  current.reported = true;
  const ms = Math.round(now() - current.at);
  log(`${NAV_TIMING_TAG} ${current.from} → ${current.to}  ${ms}ms`, { screen, ms, ...detail });
  return ms;
}

/** Test seam: forget the current navigation. Not called by the app. */
export function __resetNavTiming(): void { current = null; }
