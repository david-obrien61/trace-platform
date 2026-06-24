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
import { Outlet, useNavigate } from 'react-router-dom';
import { AppHeader } from '@trace/shared/components/AppHeader';
import { AppNav } from '../nav/AppNav';
import { Breadcrumb } from '../nav/Breadcrumb';
import { auth } from '../../lib/auth';

export function AppLayout() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await auth.signOut();
    navigate('/login');
  }

  return (
    <>
      <AppHeader onSignOut={handleSignOut} />
      <div className="appchrome">
        <AppNav />
        <Breadcrumb />
      </div>
      <Outlet />
    </>
  );
}
