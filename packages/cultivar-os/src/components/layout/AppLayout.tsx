/**
 * AppLayout — authenticated shell for Cultivar OS.
 *
 * PURPOSE:      Mount the persistent identity header ONCE around every authenticated route, so
 *               identity (tenant + email + role) is visible on every page without per-page
 *               headers. Nested inside PrivateRoute, so it only renders for signed-in users.
 * DEPENDENCIES: <AppHeader> (shared, identity from BusinessProvider context); react-router <Outlet>.
 * OUTPUTS:      <AppHeader/> + the matched child route via <Outlet/>.
 */
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@trace/shared/components/AppHeader';

export function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
