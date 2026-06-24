/**
 * AppLayout — authenticated shell for Cultivar OS.
 *
 * PURPOSE:      Mount the persistent app chrome ONCE around every authenticated route — the identity
 *               header (tenant + name + role) and the navigation chrome (hamburger/nav-rail + the
 *               breadcrumb) — so identity AND navigation are present on every page from one mount,
 *               not per-page. Nested inside PrivateRoute, so it renders only for signed-in users.
 * DEPENDENCIES: <AppHeader> (shared, identity from BusinessProvider) · <AppNav> + <Breadcrumb>
 *               (cultivar nav, both read the single tileRegistry IA) · react-router <Outlet>.
 * OUTPUTS:      <AppHeader/> + a sticky chrome bar (<AppNav/> + <Breadcrumb/>) + the matched child
 *               route via <Outlet/>.
 */
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@trace/shared/components/AppHeader';
import { AppNav } from '../nav/AppNav';
import { Breadcrumb } from '../nav/Breadcrumb';

export function AppLayout() {
  return (
    <>
      <AppHeader />
      <div className="appchrome">
        <AppNav />
        <Breadcrumb />
      </div>
      <Outlet />
    </>
  );
}
