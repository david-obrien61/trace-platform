import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppRouter } from './router';
import { CrewDay } from './pages/CrewDay';
import { BusinessProvider } from '@trace/shared/context';
import { VersionStamp } from './components/VersionStamp';
import { NewVersionPrompt } from './components/NewVersionPrompt';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* THE CREW DAY LINK (ledger #347) mounts OUTSIDE the business provider: the token is its only
            credential, so a phone that happens to be signed in (with several businesses and none
            picked) must not be shown the business picker or the device lock instead of the day —
            and the driver's phone makes no login calls at all. */}
        <Route path="/crew" element={<CrewDay />} />
        <Route path="*" element={
          <BusinessProvider businessType="nursery" addBusinessHref="/add-business" deviceEnrollment>
            <AppRouter />
          </BusinessProvider>
        } />
      </Routes>

      {/* VERSION STAMP — deliberately HERE, outside the router and outside every auth
          gate, so it renders for EVERY user on EVERY screen including pre-login and
          error states. GATE 0 (OP-15) reads it to decide whether a screen is evidence
          at all; gating it behind debug would let a broken deploy hide its own tell. */}
      <VersionStamp />
      {/* #313 — a page left open across a deploy is told, and reloads on tap. Same placement rule. */}
      <NewVersionPrompt />

      {/* DebugPanel + RhythmLogger are NO LONGER MOUNTED HERE (ledger #142).
          They moved INSIDE AppLayout — i.e. inside PrivateRoute — because mounting
          them at this level is exactly what let `?debug=1` open a panel full of
          tenant ids and emails on the pre-login customer QR page. The gate is now
          structural (where they mount), not a conditional that could be re-bypassed. */}
    </BrowserRouter>
  );
}
