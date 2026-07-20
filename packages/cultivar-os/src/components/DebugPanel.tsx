// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: On-screen field-debug panel — lets David read the captured [TRACE:*]
//   trail ON THE PHONE and send it to Lightning as a file/text. Reads the shared
//   captureBuffer (which is always capturing); this is just the UI to retrieve it.
// DEPENDENCIES: @trace/shared/debug (captureBuffer helpers).
// OUTPUTS: a floating 🐞 button (bottom-right) → panel with Copy / Share / Download /
//   Clear.
// ACTIVATION (changed 2026-07-20, ledger #142 — read this before "restoring" a flag):
//   OWNER-ONLY, via the account-menu toggle → the ONE shared gate
//   (@trace/shared/devtools). `?debug=1` and the raw `traceDebug` localStorage key
//   are GONE and must not come back:
//     · the flag had to be TYPED, and typing a URL flag on a phone in a lot is not
//       a control surface;
//     · this component mounted OUTSIDE the router, so the flag worked PRE-LOGIN on
//       the customer-facing /plant/:tagId QR page — and this panel shows tenant ids
//       and emails (see the footer). That was the leak; the fix is structural.
//   TWO independent gates now: WHERE it mounts (inside the authenticated shell —
//   AppLayout) and WHO may toggle it (owner-only menu item). Neither is load-bearing
//   alone.
// NOTE: the capture BUFFER is unaffected — installCapture() still runs in main.tsx
//   before React, so the pre-login trail is still RECORDED. Only the VIEWER is gated:
//   sign in as owner to read it. No debugging capability was lost.
// NOTE: the SHA line was REMOVED from this footer — the always-visible
//   <VersionStamp> is its one home now (STD-011: two surfaces printing one fact
//   drift, and a drifted version stamp asserts a build you are not running).
// INSTRUMENTATION: [TRACE:CAPTURE] is emitted by the shared buffer helpers;
//   [TRACE:DEVGATE] by the shared gate.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import {
  getCaptureText,
  getCaptureCount,
  clearCapture,
  downloadCapture,
  shareCapture,
} from '@trace/shared/debug';
import { useDevSurface } from '@trace/shared/devtools';

export function DebugPanel() {
  const enabled = useDevSurface('debug');
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('');
  const preRef = useRef<HTMLPreElement | null>(null);

  // Refresh the count/tail while the panel is open.
  useEffect(() => {
    if (!open) return;
    setCount(getCaptureCount());
    const id = setInterval(() => setCount(getCaptureCount()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!enabled) return null;

  const tail = open ? getCaptureText().split('\n').slice(-200).join('\n') : '';

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  const onCopy = () => {
    const text = getCaptureText();
    navigator.clipboard?.writeText(text).then(
      () => flash('copied'),
      () => flash('copy failed — use Download'),
    );
  };

  const onShare = () => {
    shareCapture().then((r) => flash(r), () => flash('share failed'));
  };

  const btn: React.CSSProperties = {
    fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #27500A',
    background: '#fff', color: '#27500A', fontWeight: 600,
  };

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 99999 }}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ ...btn, borderRadius: 24, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}
          aria-label="Open debug capture"
        >
          🐞 TRACE
        </button>
      )}
      {open && (
        <div style={{
          width: 'min(94vw, 420px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          background: '#fff', border: '2px solid #27500A', borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: '#EAF3DE', borderBottom: '1px solid #27500A' }}>
            <strong style={{ color: '#27500A', flex: 1 }}>TRACE capture · {count}</strong>
            <button onClick={() => setOpen(false)} style={btn} aria-label="Close">✕</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10 }}>
            <button onClick={onShare} style={btn}>Share</button>
            <button onClick={downloadCapture} style={btn}>Download</button>
            <button onClick={onCopy} style={btn}>Copy</button>
            <button onClick={() => { clearCapture(); setCount(0); flash('cleared'); }} style={{ ...btn, color: '#A32D2D', borderColor: '#A32D2D' }}>Clear</button>
            {status && <span style={{ alignSelf: 'center', color: '#27500A', fontSize: 12 }}>{status}</span>}
          </div>
          <pre ref={preRef} style={{
            margin: 0, padding: 10, overflow: 'auto', flex: 1, fontSize: 11, lineHeight: 1.4,
            background: '#0d1f08', color: '#cfe8b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{tail || '(no entries yet)'}</pre>
          <div style={{ padding: '6px 10px', fontSize: 10, color: '#777', borderTop: '1px solid #eee' }}>
            May contain tenant ids/emails — internal use. Turn off in the account menu.
          </div>
        </div>
      )}
    </div>
  );
}
