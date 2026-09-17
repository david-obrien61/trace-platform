/**
 * ── CrewDay — the driver's page for one day, opened from a link, no login (ledger #347) ─────────
 *
 * PURPOSE      Lauren texts the driver a link (`/crew#<token>`). This page shows that day's stops in
 *              the schedule's order: address with a Maps button, the customer's name and number (readable,
 *              and a Call button), the office's
 *              notes for the stop, and what is on the order (item + quantity — never a price). Per stop:
 *              Start, Done, Undo (while the link lives), and a Note. Every tap carries the
 *              name typed once on this phone and a device id.
 *              What it does NOT do: fulfil the order or move stock. NOTHING here sends anything to a
 *              customer by itself — no SMS, no email, no review ask (§ the no-outbound-action ruling).
 *              ✏️ 2026-09-17, David: the number IS a Call button as well as text — "the crew already get
 *              the number by text and call on arrival". A tap dials from the driver's own phone; the
 *              platform still sends nothing.
 *              Story: user_stories.md → "Lauren does the job twice, every delivery day" (crew_route_send).
 *              Standard named (§6 r16): the magic-link / bearer-link page (a share link that opens without
 *              an account) with a first-visit name prompt, as field-service "job link" pages do.
 *              Deviation: no PIN — David's pilot call; the link is day-scoped, expires 06:00 next day,
 *              and can be turned off from the schedule.
 * DEPENDENCIES ../lib/crewDayLink (readCrewDay · crewStopAction · tokenFromHash · the device helpers).
 *              No Supabase client, no business context — the token is the only credential, sent in a
 *              header to /api/crew/day. The token lives in the URL FRAGMENT, which the browser never
 *              sends to a server.
 * OUTPUTS      <CrewDay /> at /crew — mounted in App.tsx OUTSIDE BusinessProvider (no picker, no device
 *              lock, no login calls on the driver's phone).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { MapPin, RefreshCw, Phone } from 'lucide-react';
import {
  readCrewDay, crewStopAction, tokenFromHash, isDeadLink, crewDeviceId, rememberedCrewName,
  rememberCrewName, mapsUrl, type CrewDay as Day, type CrewStop, type CrewAction,
} from '../lib/crewDayLink';

const GREEN = '#27500A';
const SAGE = '#EAF3DE';
const GRAY = '#4b5563';
const DARK = '#111827';
const RED = '#A32D2D';

const big = {
  width: '100%', boxSizing: 'border-box', minHeight: 52, borderRadius: 12, fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 14px',
} as const;
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
function dayLabel(ymdStr: string) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function Shell({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '100vh', background: SAGE, padding: '16px 16px 48px', boxSizing: 'border-box', maxWidth: 560, margin: '0 auto' }}>{children}</div>;
}

function Message({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginTop: 40, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: DARK }}>{title}</h1>
        <p style={{ margin: '10px 0 0', fontSize: '1rem', color: GRAY, lineHeight: 1.5 }}>{body}</p>
        {action && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    </Shell>
  );
}

export function CrewDay() {
  const [token] = useState(() => tokenFromHash(typeof window === 'undefined' ? '' : window.location.hash));
  const [name, setName] = useState(() => rememberedCrewName());
  const [draftName, setDraftName] = useState(name);
  const [askName, setAskName] = useState(!name);
  const [day, setDay] = useState<Day | null>(null);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    setLoading(true);
    const r = await readCrewDay(token);
    setLoading(false);
    if (!r.ok) { setLoadError({ code: r.code, message: r.message }); return; }
    setLoadError(null);
    setDay(r.value);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function replaceStop(stop: CrewStop) {
    setDay(prev => (prev ? { ...prev, stops: prev.stops.map(s => (s.id === stop.id ? stop : s)) } : prev));
  }

  if (!token) {
    return <Message title="This link does not work" body="Ask Lauren for today’s link." />;
  }
  if (loadError && isDeadLink(loadError.code)) {
    return <Message title="Link not working" body={loadError.message} />;
  }

  if (askName) {
    const trimmed = draftName.trim();
    return (
      <Shell>
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginTop: 24 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: DARK }}>Your name?</h1>
          <p style={{ margin: '8px 0 14px', fontSize: '0.9375rem', color: GRAY }}>It goes with each Start and Done. This phone remembers it.</p>
          <form onSubmit={e => { e.preventDefault(); if (!trimmed) return; rememberCrewName(trimmed); setName(trimmed); setAskName(false); }}>
            <label htmlFor="crew-name" style={{ fontSize: '0.875rem', fontWeight: 700, color: DARK }}>Name</label>
            <input id="crew-name" autoFocus value={draftName} maxLength={60} autoComplete="name"
              onChange={e => setDraftName(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 52, marginTop: 6, border: '1.5px solid #d1d5db', borderRadius: 10, padding: '10px 12px', fontSize: '1.0625rem' }} />
            <button type="submit" disabled={!trimmed}
              style={{ ...big, marginTop: 14, background: trimmed ? GREEN : '#9ca3af', color: '#fff', border: 'none' }}>
              OK
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: GRAY }}>{day?.business_name ?? ''}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: '1.375rem', color: DARK }}>{day ? dayLabel(day.service_date) : 'Today’s stops'}</h1>
          <div style={{ fontSize: '0.875rem', color: GRAY, marginTop: 2 }}>
            {name} · <button onClick={() => { setDraftName(name); setAskName(true); }} style={{ background: 'none', border: 'none', color: GREEN, fontWeight: 700, padding: '10px 2px', margin: '-10px 0', cursor: 'pointer', fontSize: '0.875rem' }}>not you?</button>
          </div>
        </div>
        <button onClick={() => { void load(); }} disabled={loading} aria-label="Refresh"
          style={{ minHeight: 48, minWidth: 48, borderRadius: 12, border: `1.5px solid ${GREEN}`, background: '#fff', color: GREEN, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, padding: '0 12px' }}>
          <RefreshCw size={16} /> {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {loadError && (
        <div role="alert" style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: 12, marginTop: 12, fontSize: '0.9375rem' }}>
          {loadError.message}
        </div>
      )}
      {loading && !day && <p style={{ color: GRAY, fontSize: '1rem', marginTop: 24 }}>Loading the stops…</p>}
      {day && day.stops.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginTop: 16, color: GRAY, fontSize: '1rem' }}>
          No stops are scheduled on this day. If that looks wrong, call Lauren.
        </div>
      )}
      {day && day.stops.length > 0 && (
        <p style={{ margin: '12px 0 0', fontSize: '0.8125rem', color: GRAY }}>
          {day.stops.length} stop{day.stops.length === 1 ? '' : 's'} · <strong>Not the planned route — follow the order in Lauren’s text.</strong>
        </p>
      )}
      {day?.stops.map((s, i) => (
        <StopBlock key={s.id} n={i + 1} stop={s} token={token} name={name} onStop={replaceStop}
          onDead={(code, message) => setLoadError({ code, message })} />
      ))}
    </Shell>
  );
}

function StopBlock({ n, stop: s, token, name, onStop, onDead }: {
  n: number; stop: CrewStop; token: string; name: string;
  onStop: (s: CrewStop) => void; onDead: (code: string, message: string) => void;
}) {
  const [busy, setBusy] = useState<CrewAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const done = s.status === 'fulfilled';
  const maps = mapsUrl(s);
  const street = s.address_line1?.trim() || null;
  const place = [s.city, [s.state, s.zip].filter(Boolean).join(' ')].filter(x => x && x.trim()).join(', ');

  async function tap(action: CrewAction) {
    setBusy(action); setError(null);
    const r = await crewStopAction(token, { stopId: s.id, action, name, deviceId: crewDeviceId(), note: action === 'note' ? note : undefined });
    setBusy(null);
    if (!r.ok) {
      if (isDeadLink(r.code)) { onDead(r.code, r.message); return; }
      setError(r.message);
      return;
    }
    if (r.value.stop) onStop(r.value.stop);
    if (action === 'note') { setNote(''); setNoteOpen(false); }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginTop: 12, borderLeft: `6px solid ${done ? GREEN : '#d1d5db'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: GRAY }}>STOP {n}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: done ? GREEN : s.started_at ? '#92400e' : GRAY }}>
          {done ? `DONE ${clock(s.completed_at)}${s.completed_by_name ? ` · ${s.completed_by_name}` : ''}` : s.started_at ? `STARTED ${clock(s.started_at)}` : 'NOT STARTED'}
        </span>
      </div>

      <div style={{ fontSize: '1.125rem', fontWeight: 800, color: DARK, marginTop: 4 }}>{street ?? 'No street address on this stop'}</div>
      {place && <div style={{ fontSize: '1rem', color: DARK }}>{place}</div>}
      {maps
        ? <a href={maps} target="_blank" rel="noopener noreferrer" style={{ ...big, marginTop: 10, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`, textDecoration: 'none', boxSizing: 'border-box' }}><MapPin size={18} /> Maps</a>
        : <div style={{ marginTop: 8, color: RED, fontSize: '0.9375rem' }}>No address — call Lauren.</div>}

      <div style={{ marginTop: 10, fontSize: '1rem', color: DARK }}>
        <strong>{s.customer_name ?? 'Customer name not on file'}</strong>
        {/* The number stays readable as text (a driver reads it aloud) AND dials on a tap — David's call. */}
        <div style={{ color: GRAY, userSelect: 'text' }}>{s.customer_phone ?? 'No phone on file'}</div>
        {s.customer_phone && (
          <a href={`tel:${s.customer_phone.replace(/[^0-9+]/g, '')}`}
            style={{ ...big, marginTop: 8, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`, textDecoration: 'none' }}>
            <Phone size={18} /> Call
          </a>
        )}
      </div>

      {s.instructions && (
        <div style={{ marginTop: 10, background: '#FEF3C7', borderRadius: 10, padding: 10, fontSize: '0.9375rem', color: '#78350F' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: 2 }}>FROM THE OFFICE</div>
          {s.instructions}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 800, fontSize: '0.75rem', color: GRAY }}>ON THIS ORDER</div>
        {!s.has_order && <div style={{ fontSize: '0.9375rem', color: GRAY }}>No order is linked to this stop — check the paper sheet.</div>}
        {s.has_order && s.lines.length === 0 && <div style={{ fontSize: '0.9375rem', color: GRAY }}>The order has no items listed — check the paper sheet.</div>}
        {s.lines.map((l, i) => (
          <div key={i} style={{ fontSize: '1rem', color: DARK, padding: '3px 0' }}>
            <strong>{l.quantity ?? '?'} ×</strong> {l.item}{l.size ? ` · ${l.size}` : ''}
          </div>
        ))}
      </div>

      {s.notes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: GRAY }}>CREW NOTES</div>
          {s.notes.map((x, i) => (
            <div key={i} style={{ fontSize: '0.9375rem', color: DARK, padding: '2px 0' }}>
              <span style={{ color: GRAY }}>{clock(x.at)} · {x.by}:</span> {x.note}
            </div>
          ))}
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: 10, color: RED, fontSize: '0.9375rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!done && !s.started_at && (
          <button onClick={() => { void tap('start'); }} disabled={!!busy}
            style={{ ...big, background: '#fff', color: GREEN, border: `2px solid ${GREEN}`, opacity: busy ? 0.6 : 1 }}>
            {busy === 'start' ? 'Saving…' : 'Start'}
          </button>
        )}
        {!done && (
          <button onClick={() => { void tap('done'); }} disabled={!!busy}
            style={{ ...big, background: GREEN, color: '#fff', border: 'none', opacity: busy ? 0.6 : 1 }}>
            {busy === 'done' ? 'Saving…' : 'Done'}
          </button>
        )}
        {done && s.completed_by_name && (
          <button onClick={() => { void tap('undo_done'); }} disabled={!!busy}
            style={{ ...big, background: '#fff', color: RED, border: `1.5px solid ${RED}`, opacity: busy ? 0.6 : 1 }}>
            {busy === 'undo_done' ? 'Saving…' : 'Undo'}
          </button>
        )}
      </div>

      {!noteOpen && (
        <button onClick={() => setNoteOpen(true)} style={{ ...big, marginTop: 8, background: 'none', color: GREEN, border: '1.5px dashed #9ca3af' }}>
          Note
        </button>
      )}
      {noteOpen && (
        <div style={{ marginTop: 8 }}>
          <label htmlFor={`note-${s.id}`} style={{ fontSize: '0.875rem', fontWeight: 700, color: DARK }}>Note for the office</label>
          <textarea id={`note-${s.id}`} value={note} maxLength={1000} rows={3} onChange={e => setNote(e.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, border: '1.5px solid #d1d5db', borderRadius: 10, padding: 10, fontSize: '1rem' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { setNoteOpen(false); setNote(''); }} style={{ ...big, background: '#fff', color: GRAY, border: '1.5px solid #d1d5db' }}>Cancel</button>
            <button onClick={() => { void tap('note'); }} disabled={!!busy || !note.trim()}
              style={{ ...big, background: note.trim() ? GREEN : '#9ca3af', color: '#fff', border: 'none' }}>
              {busy === 'note' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
