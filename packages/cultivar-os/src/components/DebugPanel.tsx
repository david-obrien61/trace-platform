// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: On-screen field-debug panel — lets David read the captured [TRACE:*]
//   trail ON THE PHONE and send it to Lightning as a file/text. Reads the shared
//   captureBuffer (which is always capturing); this is just the UI to retrieve it.
// DEPENDENCIES: @trace/shared/debug (captureBuffer helpers).
// OUTPUTS: a floating 🐞 button (bottom-right) → panel with Copy / Share / Download /
//   Clear, and the OP-15 SHA STAMP in the footer (the 7-char commit this bundle was
//   built from — 'dev' outside Vercel). The button only renders when debug is
//   ENABLED, so Lauren's demo stays clean: enable via URL ?debug=1 (sticky) or
//   localStorage 'traceDebug'='1'.
// NOTE: the SHA stamp makes owner-prove GATE 0 mechanical — read the SHA here
//   instead of a Vercel dashboard round-trip. __COMMIT_SHA__ is a build-time
//   define (vite.config.ts), declared for tsc in src/vite-env.d.ts.
// INSTRUMENTATION: [TRACE:CAPTURE] is emitted by the shared buffer helpers.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import {
  getCaptureText,
  getCaptureCount,
  clearCapture,
  downloadCapture,
  shareCapture,
} from '@trace/shared/debug';

function debugEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      localStorage.setItem('traceDebug', '1'); // sticky once enabled
      return true;
    }
    if (params.get('debug') === '0') {
      localStorage.removeItem('traceDebug');
      return false;
    }
    return localStorage.getItem('traceDebug') === '1';
  } catch {
    return false;
  }
}

export function DebugPanel() {
  const [enabled] = useState(debugEnabled);
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
            <div style={{ color: '#27500A', fontWeight: 600, fontFamily: 'monospace', marginBottom: 2 }}>
              SHA: {__COMMIT_SHA__}
            </div>
            May contain tenant ids/emails — internal use. Add ?debug=0 to URL to hide.
          </div>
        </div>
      )}
    </div>
  );
}
