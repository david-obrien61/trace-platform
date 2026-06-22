import { Navigate, Outlet } from 'react-router-dom';
import { useBusinessContext } from '@trace/shared/context';

/**
 * PermissionRoute — route gate keyed on the permission chokepoint (decision 2026-06-21).
 * Nested INSIDE PrivateRoute (auth already ensured). Redirects to /dashboard when the
 * active-business session lacks `permission`. DEFAULT-DENY. Owner ⇒ always allowed
 * (can() returns true). Waits for BusinessProvider to resolve before deciding so an
 * owner isn't briefly bounced during load.
 *
 * This is the render/route layer of the wall (Phase 3/4) — it keeps a low-role member
 * off the cost surfaces so the cost SELECT never fires (cost absent from the network).
 * It is NOT the sole control: wages + pricing config also have the data-layer wall (Phase 2).
 */
export function PermissionRoute({ permission }: { permission: string }) {
  const { can, loading } = useBusinessContext();
  if (loading) return null; // don't decide until the session resolves
  return can(permission) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
