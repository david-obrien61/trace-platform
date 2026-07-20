import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { BusinessProvider } from '@trace/shared/context';
import { VersionStamp } from './components/VersionStamp';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <BusinessProvider businessType="nursery" addBusinessHref="/add-business" deviceEnrollment>
        <AppRouter />
      </BusinessProvider>

      {/* VERSION STAMP — deliberately HERE, outside the router and outside every auth
          gate, so it renders for EVERY user on EVERY screen including pre-login and
          error states. GATE 0 (OP-15) reads it to decide whether a screen is evidence
          at all; gating it behind debug would let a broken deploy hide its own tell. */}
      <VersionStamp />

      {/* DebugPanel + RhythmLogger are NO LONGER MOUNTED HERE (ledger #142).
          They moved INSIDE AppLayout — i.e. inside PrivateRoute — because mounting
          them at this level is exactly what let `?debug=1` open a panel full of
          tenant ids and emails on the pre-login customer QR page. The gate is now
          structural (where they mount), not a conditional that could be re-bypassed. */}
    </BrowserRouter>
  );
}
