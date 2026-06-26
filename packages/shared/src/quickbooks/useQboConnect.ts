/**
 * ── SHARED QBO CONNECT ACTION (one action, multiple mount points) ──────────────
 *
 * PURPOSE: The single QuickBooks-Online connect handshake — open a popup, fetch the
 *   OAuth auth-url, navigate the popup, then poll /api/qbo/status until connected (with
 *   a circuit-breaker for a persistently-erroring status endpoint, tech-debt #34). One
 *   implementation consumed by BOTH the Dashboard QB tile and the Settings → Accounting
 *   card, so the two surfaces can never drift (rule-of-three consolidation — the connect
 *   logic previously lived inline only in Dashboard; Settings used a dead `<a href>`).
 *
 * DEPENDENCIES: the two QBO UI endpoints `${apiBase}/api/qbo/auth-url` and
 *   `${apiBase}/api/qbo/status`. This hook NEVER touches oauth.ts / the token exchange —
 *   it is the UI mount/trigger layer only.
 *
 * OUTPUTS: { connect, connecting, error, clearError }. `onConnected` fires once the
 *   round-trip is confirmed connected (Dashboard reloads metrics; Settings reloads context).
 *
 * Instrumentation: emits [TRACE:QBO] on a confirmed connect. ON by default.
 */
import { useEffect, useRef, useState } from 'react';

export interface UseQboConnectOptions {
  businessId: string | null | undefined;
  /** API base — '' for same-origin (default). */
  apiBase?: string;
  /** Fired once OAuth is confirmed connected via the status poll. */
  onConnected?: () => void;
}

// After this many consecutive failed status checks, stop polling and surface the error
// rather than hammering /api/qbo/status every 2s while the popup stays open (tech-debt #34).
const STATUS_FAIL_LIMIT = 5;

export function useQboConnect({ businessId, apiBase = '', onConnected }: UseQboConnectOptions) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError]           = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failRef    = useRef(0);

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  // Self-clean the poll interval on unmount.
  useEffect(() => stopPolling, []);

  async function checkStatus(): Promise<boolean> {
    try {
      const res = await fetch(`${apiBase}/api/qbo/status?business_id=${businessId!}`);
      if (res.ok) {
        failRef.current = 0; // endpoint healthy — reset the breaker
        const data = await res.json();
        return !!data.connected;
      }
      failRef.current += 1; // non-ok (e.g. 500) — count it so the poll can break the loop
    } catch {
      failRef.current += 1; // network / function-invocation failure
    }
    return false;
  }

  async function connect() {
    if (!businessId) { setError('No business selected'); return; }
    setConnecting(true);
    setError('');

    let popup: Window | null = null;
    let step = 'init';

    try {
      step = 'open-popup';
      popup = window.open('', 'qb-connect', 'width=720,height=640,left=200,top=100');

      step = 'fetch';
      const res = await fetch(`${apiBase}/api/qbo/auth-url?business_id=${businessId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`[step:${step}] ` + (body.error || `Server error ${res.status}`));
      }

      step = 'parse';
      const { url } = await res.json();

      step = 'validate-url';
      try { new URL(url); } catch {
        throw new Error(`[step:${step}] Malformed URL returned by server — check QBO env vars`);
      }

      step = 'navigate';
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        // Popup blocked — fall back to a full-page redirect.
        window.location.href = url;
        return;
      }

      step = 'poll';
      failRef.current = 0; // fresh poll session — reset the breaker
      pollingRef.current = setInterval(() => {
        void (async () => {
          const connected = await checkStatus();
          if (connected) {
            stopPolling();
            setConnecting(false);
            console.info('[TRACE:QBO] connected', { businessId });
            onConnected?.();
            return;
          }
          if (failRef.current >= STATUS_FAIL_LIMIT) {
            stopPolling();
            setConnecting(false);
            setError('[step:poll] QuickBooks status check is failing repeatedly — the /api/qbo/status endpoint may be erroring (check Vercel function logs). Stopped polling.');
            return;
          }
          if (!popup || popup.closed) {
            stopPolling();
            setConnecting(false);
          }
        })();
      }, 2000);
    } catch (err: any) {
      popup?.close();
      const msg = String(err?.message || err || 'Unknown error');
      setError(msg.startsWith('[step:') ? msg : `[step:${step}] ${msg}`);
      setConnecting(false);
    }
  }

  return { connect, connecting, error, clearError: () => setError('') };
}
