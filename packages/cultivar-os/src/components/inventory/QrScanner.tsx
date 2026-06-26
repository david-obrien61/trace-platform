// ============================================================
// QrScanner — live in-app QR decode for the walk-and-count loop.
// PURPOSE:  open the rear camera, decode QR frames with jsQR, hand the raw
//           decoded string up via onScan — WITHOUT navigating away (unlike the
//           OS camera, which opens the encoded /plant/:tag URL).
// DEPENDENCIES: jsqr (pure-JS decoder — chosen over the native BarcodeDetector,
//           which iOS Safari, our target device, does not support), getUserMedia.
// OUTPUTS:  onScan(rawText) on each successful decode; renders the camera + a
//           manual-entry fallback (camera denied / unavailable / not-HTTPS).
// Standard-by-value (CLAUDE.md §6 r10): BarcodeDetector is the web standard but
//   absent on iOS Safari → diverge to jsQR for cross-device coverage.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const TRACE_COUNT = true; // [TRACE:COUNT] STD-003 — on until OWNER-PROVEN

interface QrScannerProps {
  /** When false the decode loop pauses (camera stays warm) — e.g. while a review sheet is open. */
  active: boolean;
  /** Fired with the raw decoded string (a URL or bare code) on each successful read. */
  onScan: (raw: string) => void;
}

export function QrScanner({ active, onScan }: QrScannerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(active);
  const onScanRef = useRef(onScan);
  activeRef.current = active;
  onScanRef.current = onScan;

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual]           = useState('');

  // Acquire the stream once on mount; tear it down on unmount.
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not available on this device/browser.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true'); // iOS: stay inline, don't fullscreen
          await video.play().catch(() => { /* autoplay race — non-fatal */ });
        }
        loop();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (TRACE_COUNT) console.log('[TRACE:COUNT] camera unavailable —', msg);
        setCameraError('Camera blocked or unavailable. Type the tag below.');
      }
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      if (!activeRef.current) return; // paused while a sheet is open
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        // Pause immediately so one physical scan fires exactly once.
        activeRef.current = false;
        if (TRACE_COUNT) console.log('[TRACE:COUNT] scan decoded —', code.data);
        onScanRef.current(code.data);
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    if (TRACE_COUNT) console.log('[TRACE:COUNT] manual entry —', v);
    setManual('');
    onScan(v);
  }

  return (
    <div style={S.wrap}>
      {!cameraError && (
        <div style={S.viewport}>
          <video ref={videoRef} style={S.video} muted playsInline />
          {active && <div style={S.reticle} />}
          {active && <div style={S.hint}>Point at a plant tag QR</div>}
        </div>
      )}
      {cameraError && <div style={S.camErr}>{cameraError}</div>}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Manual fallback — always present so the loop never dead-ends. */}
      <form onSubmit={submitManual} style={S.manualRow}>
        <input
          style={S.manualInput}
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="Or type the tag (e.g. SCV-0031)"
          autoCapitalize="characters"
          autoCorrect="off"
        />
        <button type="submit" style={S.manualBtn}>Look up</button>
      </form>
    </div>
  );
}

const S = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties,
  viewport:    { position: 'relative', width: '100%', aspectRatio: '3 / 4', maxHeight: '60vh', background: '#000', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  video:       { width: '100%', height: '100%', objectFit: 'cover' } as React.CSSProperties,
  reticle:     { position: 'absolute', inset: '22%', border: '3px solid rgba(255,255,255,0.9)', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)' } as React.CSSProperties,
  hint:        { position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: '0.85rem', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.7)' } as React.CSSProperties,
  camErr:      { background: '#fef3c7', color: '#92400e', borderRadius: 12, padding: '1rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 } as React.CSSProperties,
  manualRow:   { display: 'flex', gap: 8 } as React.CSSProperties,
  manualInput: { flex: 1, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box' } as React.CSSProperties,
  manualBtn:   { minHeight: 44, padding: '0 1rem', background: '#27500A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' } as React.CSSProperties,
};
