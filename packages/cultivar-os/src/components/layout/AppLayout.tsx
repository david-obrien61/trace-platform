/**
 * AppLayout — authenticated shell for Cultivar OS.
 *
 * PURPOSE:      Mount the persistent app chrome ONCE around every authenticated route — the identity
 *               header (tenant + name + role) and the navigation chrome (hamburger/nav-rail + the
 *               breadcrumb) — so identity AND navigation are present on every page from one mount,
 *               not per-page. Nested inside PrivateRoute, so it renders only for signed-in users.
 * DEPENDENCIES: <AppHeader> (shared, identity from BusinessProvider; its account "Sign out" is
 *               injected here so the shared header stays client-free) · <AppNav> + <Breadcrumb>
 *               (cultivar nav, both read the single tileRegistry IA) · react-router <Outlet> ·
 *               cultivar `auth` (the configured auth client) for sign-out.
 * OUTPUTS:      <AppHeader/> (with the account avatar menu) + a sticky chrome bar (<AppNav/> +
 *               <Breadcrumb/>) + the matched child route via <Outlet/>.
 */
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppHeader } from '@trace/shared/components/AppHeader';
import { useBusinessContext } from '@trace/shared/context';
import { bindDevSurfaceIdentity, clearDevSurfaces } from '@trace/shared/devtools';
import { AppNav } from '../nav/AppNav';
import { Breadcrumb } from '../nav/Breadcrumb';
import { DebugPanel } from '../DebugPanel';
import { RhythmLogger } from '../RhythmLogger';
import { auth } from '../../lib/auth';

export function AppLayout() {
  const navigate = useNavigate();
  // userEmail is the identity key: the context does NOT expose a raw user id, and
  // email is unique per signed-in user. `role` here is the context's display-ready
  // role ('OWNER' | 'MANAGER' | 'STAFF'), not the nullable membership role.
  const { userEmail, role, isOwner } = useBusinessContext();

  // Bind the dev-surface gate to the SIGNED-IN identity. If the person or the role
  // changes, the gate purges its stored state — a dev panel never carries across a
  // person or a permission level (that was the old `traceDebug` key's defect).
  useEffect(() => {
    bindDevSurfaceIdentity(userEmail ?? null, role ?? null);
  }, [userEmail, role]);

  async function handleSignOut() {
    // Purge BEFORE the auth call: if signOut throws, the dev surfaces are still off.
    clearDevSurfaces();
    await auth.signOut();
    navigate('/login');
  }

  return (
    <>
      {/* Header + nav chrome are ONE sticky stack, so the nav pins WITH the banner and never
          slides under it (the prior bug: two independent sticky siblings both at top:0). */}
      <div className="appchrome-stack">
        <AppHeader onSignOut={handleSignOut} devSurfaces={isOwner} />
        <div className="appchrome">
          <AppNav />
          <Breadcrumb />
        </div>
      </div>
      <Outlet />

      {/* DEV SURFACES — mounted HERE, not in App.tsx, and this placement IS the gate.
          AppLayout renders only inside <PrivateRoute>, so an unauthenticated visitor
          (e.g. a customer on /plant/:tagId) cannot reach these panels by ANY URL or
          storage trick — there is no code path that mounts them. Visibility is then
          further gated by the shared dev-surface toggle, owner-only in the menu.
          Belt (structural) AND suspenders (toggle) — ledger #142. */}
      <DebugPanel />
      <RhythmLogger />
    </>
  );
}
