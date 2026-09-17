// ============================================================
// NewVersionPrompt — "A new version is ready — reload" (#313, ledger #345)
// PURPOSE:      When production is newer than the code this page is running, say so, and reload on
//               tap. Checked on every navigation and whenever the window regains focus (a phone
//               brought back to the front is the case that voided CARD 15's first run).
// DEPENDENCIES: newVersion (the rule + the fetch) · react-router (navigation) · `__COMMIT_SHA__`.
// OUTPUTS:      a fixed banner, or nothing. Mounted once in App.tsx, outside every auth gate, beside
//               <VersionStamp>, so it shows on every screen including the public QR pages.
// TRACE:        [TRACE:VERSION] on a detected new build (ON by default, STD-003).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchDeployedVersion, shouldOfferReload, VERSION_CHECK_MIN_GAP_MS } from '../lib/newVersion';

const TRACE_VERSION = true;

export function NewVersionPrompt() {
  const location = useLocation();
  const [newer, setNewer] = useState<string | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheck.current < VERSION_CHECK_MIN_GAP_MS) return;
    lastCheck.current = now;
    const deployed = await fetchDeployedVersion();
    if (shouldOfferReload(__COMMIT_SHA__, deployed)) {
      if (TRACE_VERSION) console.log('[TRACE:VERSION] a newer build is deployed', { running: __COMMIT_SHA__, deployed: deployed?.sha });
      setNewer(deployed!.sha);
    }
  }, []);

  useEffect(() => { void check(); }, [location.pathname, check]);
  useEffect(() => {
    const onFocus = () => { void check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); };
  }, [check]);

  if (!newer) return null;
  return (
    <div role="alert" data-testid="new-version-prompt"
      style={{ position: 'fixed', left: 12, right: 12, bottom: 28, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 12,
               background: '#27500A', color: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
      <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600 }}>A new version is ready — reload</span>
      <button type="button" onClick={() => window.location.reload()}
        style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, border: 'none', background: '#fff', color: '#27500A', fontWeight: 700, cursor: 'pointer' }}>
        Reload
      </button>
    </div>
  );
}
