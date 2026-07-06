import { Navigate, Outlet } from 'react-router-dom';
import { useBusinessContext } from '../context';

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
 * Owner ⇒ always allowed (can() short-circuits true). Waits for BusinessProvider to resolve
 * before deciding, so an owner isn't briefly bounced during load.
 *
 * This is the render/route layer of the wall — it also keeps a low-role member off the cost
 * surfaces so the cost SELECT never fires. It is NOT the sole control: wages + pricing config
 * also have the data-layer RLS wall (Phase 2). Route enforcement + RLS are defense-in-depth.
 */
export function PermissionRoute({
  permission,
  redirectTo = '/dashboard',
}: {
  permission: string;
  /** Where to send an unauthorized session. Defaults to the safe landing surface. */
  redirectTo?: string;
}) {
  const { can, loading, businessId, userEmail, role } = useBusinessContext();
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
    refused: true,
  });
  return <Navigate to={redirectTo} replace />;
}
