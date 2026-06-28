// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: Customer-zero RHYTHM logger UI — a data-gathering INSTRUMENT (not a
//   product feature), modeled on DebugPanel. Captures the day's rhythm on
//   customer-zero (David): LOCATION (foreground geolocation), NARRATION (voice or
//   text notes), and SHAPE/THREAD tags. David opens it during narrated sessions,
//   then exports the trail for Lightning to design the north-star TIMING LAYER.
// DEPENDENCIES: @trace/shared/rhythm (rhythmBuffer helpers); browser geolocation +
//   optional Web Speech API.
// OUTPUTS: a floating 🟢 button (bottom-LEFT, to not collide with DebugPanel's
//   bottom-right) → panel: start/stop logging, add-note (voice/text), shape chips,
//   thread label, live point/note counts, Share/Download/Clear. Renders ONLY when
//   ?rhythm=1 (sticky) — normal app stays clean, same as ?debug=1.
// INSTRUMENTATION: [TRACE:RHYTHM] emitted by the shared buffer helpers (ON by birth).
// HONEST CONSTRAINT: FOREGROUND-ONLY. Web apps can't get location while the phone is
//   locked/pocketed (iOS kills it). Background = a future NATIVE build. The UI says so.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import {
  pushPoint,
  pushNote,
  getRhythmCount,
  clearRhythm,
  downloadRhythm,
  shareRhythm,
  haversineMeters,
  type RhythmShape,
} from '@trace/shared/rhythm';

const MOVE_THRESHOLD_M = 10; // log a point when David moves >10m
const HEARTBEAT_MS = 60_000; // ...and every 60s while still, so "sat at desk" shows

const SHAPES: RhythmShape[] = ['buy', 'task', 'inventory-check', 'project'];

function rhythmEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('rhythm') === '1') {
      localStorage.setItem('traceRhythm', '1'); // sticky once enabled
      return true;
    }
    if (params.get('rhythm') === '0') {
      localStorage.removeItem('traceRhythm');
      return false;
    }
    return localStorage.getItem('traceRhythm') === '1';
  } catch {
    return false;
  }
}

// Minimal Web Speech typing (not in lib.dom for webkit-prefixed builds).
interface SREvent {
  results: ReadonlyArray<ReadonlyArray<{ transcript: string }>>;
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SRCtor = new () => SRInstance;

function getSpeechCtor(): SRCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Pos {
  lat: number;
  lng: number;
  accuracy: number;
}

export function RhythmLogger() {
  const [enabled] = useState(rhythmEnabled);
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [shape, setShape] = useState<RhythmShape | undefined>(undefined);
  const [thread, setThread] = useState('');
  const [counts, setCounts] = useState({ points: 0, notes: 0 });
  const [status, setStatus] = useState('');
  const [listening, setListening] = useState(false);

  const watchId = useRef<number | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLogged = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const posRef = useRef<Pos | null>(null);
  const recRef = useRef<SRInstance | null>(null);
  const noteSource = useRef<'voice' | 'text'>('text');

  const speechSupported = typeof window !== 'undefined' && getSpeechCtor() !== null;

  // Keep the live count fresh while open.
  useEffect(() => {
    if (!open) return;
    setCounts(getRhythmCount());
    const id = setInterval(() => setCounts(getRhythmCount()), 1000);
    return () => clearInterval(id);
  }, [open]);

  // Start/stop the geolocation watch + heartbeat with the logging toggle.
  useEffect(() => {
    if (!logging) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoErr('Geolocation not available in this browser.');
      return;
    }
    setGeoErr(null);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const next: Pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        };
        posRef.current = next;
        setPos(next);
        const last = lastLogged.current;
        const moved =
          !last || haversineMeters(last.lat, last.lng, next.lat, next.lng) > MOVE_THRESHOLD_M;
        if (moved) {
          pushPoint(next.lat, next.lng, next.accuracy, 'move');
          lastLogged.current = { lat: next.lat, lng: next.lng, t: Date.now() };
        }
      },
      (err) => setGeoErr(err.message || 'Location permission denied.'),
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
    );

    heartbeat.current = setInterval(() => {
      const cur = posRef.current;
      const last = lastLogged.current;
      if (cur && (!last || Date.now() - last.t >= HEARTBEAT_MS)) {
        pushPoint(cur.lat, cur.lng, cur.accuracy, 'heartbeat');
        lastLogged.current = { lat: cur.lat, lng: cur.lng, t: Date.now() };
      }
    }, HEARTBEAT_MS);

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      if (heartbeat.current) clearInterval(heartbeat.current);
      heartbeat.current = null;
    };
  }, [logging]);

  if (!enabled) return null;

  const flash = (m: string) => {
    setStatus(m);
    setTimeout(() => setStatus(''), 2500);
  };

  const startListening = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      flash('Voice not supported — type the note');
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e: SREvent) => {
        const t = e.results?.[0]?.[0]?.transcript ?? '';
        if (t) {
          noteSource.current = 'voice';
          setNote((prev) => (prev ? prev + ' ' + t : t));
        }
      };
      rec.onerror = () => {
        setListening(false);
        flash('voice error — type the note');
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      flash('voice unavailable — type the note');
    }
  };

  const stopListening = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  };

  const addNote = () => {
    const text = note.trim();
    if (!text) {
      flash('note is empty');
      return;
    }
    const cur = posRef.current;
    pushNote({
      text,
      shape,
      thread,
      source: noteSource.current,
      lat: cur?.lat,
      lng: cur?.lng,
      accuracy: cur?.accuracy,
    });
    setNote('');
    noteSource.current = 'text';
    setCounts(getRhythmCount());
    flash('note logged');
    // shape + thread stay sticky for fast consecutive notes in the same context
  };

  const onShare = () => {
    shareRhythm('json').then(
      (r) => flash(r),
      () => flash('share failed'),
    );
  };

  const btn: React.CSSProperties = {
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #27500A',
    background: '#fff',
    color: '#27500A',
    fontWeight: 600,
  };

  return (
    <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 99999 }}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ ...btn, borderRadius: 24, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}
          aria-label="Open rhythm logger"
        >
          🟢 RHYTHM
        </button>
      )}
      {open && (
        <div
          style={{
            width: 'min(94vw, 420px)',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            border: '2px solid #27500A',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,.3)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              background: '#EAF3DE',
              borderBottom: '1px solid #27500A',
            }}
          >
            <strong style={{ color: '#27500A', flex: 1 }}>
              Rhythm · {counts.points} pts · {counts.notes} notes
            </strong>
            <button onClick={() => setOpen(false)} style={btn} aria-label="Close">
              ✕
            </button>
          </div>

          <div style={{ padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Logging toggle + live position */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setLogging((v) => !v)}
                style={{
                  ...btn,
                  background: logging ? '#27500A' : '#fff',
                  color: logging ? '#fff' : '#27500A',
                }}
              >
                {logging ? '⏹ Stop logging' : '▶ Start logging'}
              </button>
              <span style={{ fontSize: 12, color: '#555' }}>
                {logging
                  ? pos
                    ? `📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} ±${Math.round(pos.accuracy)}m`
                    : 'acquiring GPS…'
                  : 'idle'}
              </span>
            </div>
            {geoErr && <div style={{ fontSize: 12, color: '#A32D2D' }}>⚠ {geoErr}</div>}

            {/* Narration */}
            <textarea
              value={note}
              onChange={(e) => {
                noteSource.current = 'text';
                setNote(e.target.value);
              }}
              placeholder="What are you doing / where? (type or use 🎤)"
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontSize: 14,
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 8,
                resize: 'vertical',
              }}
            />

            {/* Shape chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SHAPES.map((s) => (
                <button
                  key={s}
                  onClick={() => setShape((cur) => (cur === s ? undefined : s))}
                  style={{
                    ...btn,
                    fontSize: 12,
                    padding: '6px 10px',
                    background: shape === s ? '#27500A' : '#fff',
                    color: shape === s ? '#fff' : '#27500A',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Thread label */}
            <input
              value={thread}
              onChange={(e) => setThread(e.target.value)}
              placeholder="thread (optional, e.g. greenhouse repair)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontSize: 13,
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 8,
              }}
            />

            {/* Note actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {speechSupported ? (
                <button
                  onClick={listening ? stopListening : startListening}
                  style={{ ...btn, background: listening ? '#A32D2D' : '#fff', color: listening ? '#fff' : '#27500A', borderColor: listening ? '#A32D2D' : '#27500A' }}
                >
                  {listening ? '⏹ Listening…' : '🎤 Voice'}
                </button>
              ) : (
                <span style={{ alignSelf: 'center', fontSize: 11, color: '#777' }}>voice n/a — type</span>
              )}
              <button onClick={addNote} style={{ ...btn, flex: 1 }}>
                + Add note
              </button>
            </div>
            {status && <span style={{ color: '#27500A', fontSize: 12 }}>{status}</span>}

            {/* Export */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid #eee', paddingTop: 10 }}>
              <button onClick={onShare} style={btn}>Share</button>
              <button onClick={() => downloadRhythm('json')} style={btn}>JSON</button>
              <button onClick={() => downloadRhythm('txt')} style={btn}>TXT</button>
              <button
                onClick={() => {
                  if (window.confirm('Clear the whole rhythm log?')) {
                    clearRhythm();
                    setCounts({ points: 0, notes: 0 });
                    lastLogged.current = null;
                    flash('cleared');
                  }
                }}
                style={{ ...btn, color: '#A32D2D', borderColor: '#A32D2D' }}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={{ padding: '6px 10px', fontSize: 10, color: '#777', borderTop: '1px solid #eee' }}>
            Foreground-only (web can't track a locked phone). Stays local until you export. ?rhythm=0 to hide.
          </div>
        </div>
      )}
    </div>
  );
}
