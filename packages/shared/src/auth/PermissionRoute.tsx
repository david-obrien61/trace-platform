import { Outlet, useLocation } from 'react-router-dom';
import { useBusinessContext } from '../context';
import { PageWithoutAccess } from '../components/SurfaceState';

/**
 * PermissionRoute — the AGNOSTIC route-entry permission gate (D-31 / security class fix
 * 2026-07-06). Lives in shared so EVERY react-router + BusinessProvider vertical inherits one
 * rule: a gated route REFUSES unauthorized entry regardless of HOW it was reached (nav link,
 * dashboard tile, deep link, typed URL). It is keyed ONLY on the shared `can()` chokepoint —
 * zero vertical nouns (AC-1) — so it is not Cultivar-specific; a vertical that does not mount
 * BusinessProvider / react-router (e.g. Ignition's PIN+DataBridge model) simply never renders
 * it (inert, no breakage — same opt-in shape as deviceEnrollment).
 *
 * WHY route-entry, not nav-hiding: hiding a nav link only removes ONE door. Enforcing on route
 * ENTRY closes the whole class — any second door (tile, deep link, typed URL) hits the same
 * gate. Nest INSIDE the auth gate (PrivateRoute) so auth is already ensured. DEFAULT-DENY.
 * Waits for BusinessProvider to resolve before deciding, so nobody is briefly bounced during load.
 *
 * This is the render/route layer of the wall — it also keeps a low-role member off the cost
 * surfaces so the cost SELECT never fires. It is NOT the sole control: wages + pricing config
 * also have the data-layer RLS wall. Route enforcement + RLS are defense-in-depth.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IT NO LONGER REDIRECTS (ruling 2026-07-30 — "a page without access RENDERS AND SAYS SO").
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * It used to end `return <Navigate to="/dashboard" replace />`. That was the single worst refusal
 * available to us, and it was the default on 26 routes:
 *
 *   · the member taps a nav item and lands somewhere ELSE with no explanation — which is
 *     INDISTINGUISHABLE FROM A BUG, and was read as one (the Accounting bounce, 2026-07)
 *   · the URL is replaced, so the thing they tried to open is not even quotable to the person
 *     who could grant it
 *   · it destroys the only information they need: WHICH PERMISSION, and WHO CAN GIVE IT
 *
 * And the consequence is not cosmetic. A manager who hits a silent wall gets made an OWNER as a
 * workaround — thirty seconds, it works, and the cost basis is now permanently visible to a
 * manager because of an undocumented Tuesday shortcut. A refusal that NAMES ITS PERMISSION
 * produces a grant request instead. The surface is what keeps the permission model credible.
 *
 * The refusal is unchanged — `<Outlet/>` is still never rendered without the permission. What
 * changed is what the person sees when refused. DEFAULT-DENY is intact; silence is not.
 *
 * `redirectTo` is GONE, not deprecated. It was briefly kept "for signature compatibility" — but a
 * grep shows NO PermissionRoute call site ever passed it (router.tsx's one `redirectTo` belongs to
 * PrivateRoute). Keeping a dead prop to protect callers that do not exist is an invented
 * constraint, and it would have left a prop whose name promises a behaviour the component no
 * longer has. Removed.
 */
export function PermissionRoute({
  permission,
  title,
}: {
  permission: string;
  /**
   * The surface's own name, shown on the refusal page ("Accounting", "Cost to Produce"). Optional
   * because 26 call sites predate it; it falls back to the pathname, which is honest but plainer.
   */
  title?: string;
}) {
  const { can, loading, businessId, userEmail, role } = useBusinessContext();
  const location = useLocation();
  if (loading) return null; // don't decide until the session resolves
  if (can(permission)) return <Outlet />;

  // [TRACE:PERMGATE] a gated route refused an unauthorized entry — ON by default (STD-003).
  // Fires ONLY on refusal, so it is silent for permitted sessions. Reports the capability
  // refused + who was refused so a second-door bypass is visible in the trail.
  console.log('[TRACE:PERMGATE] route entry refused', {
    cap: permission,
    member: userEmail,
    role,
    businessId,
    path: location.pathname,
    // NAMED so the trail distinguishes the new behaviour from the old bounce at a glance.
    behavior: 'render-and-say-so',
    refused: true,
  });

  // Derive a readable title from the path when the caller did not pass one: '/operating-costs'
  // → 'Operating Costs'. Plainer than a hand-written name, never wrong, and it means the 26
  // existing call sites get a usable page without 26 edits in an authority-focused commit.
  const derived = location.pathname
    .split('/').filter(Boolean).slice(0, 1)
    .map((s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join('') || 'This page';

  return <PageWithoutAccess permission={permission} title={title ?? derived} />;
}
