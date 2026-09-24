// ============================================================
// AddressInput — the ONE address field (PLATFORM — @trace/shared)
// PURPOSE:      Every place a person types an address: customer create/edit, vendor create/edit,
//               checkout, the post-order stop edit. Typing offers real addresses; picking one
//               stores it located; typing past the suggestions falls back to the ③ check.
// DEPENDENCIES: react · the server proxy at `api/customers/create` (action 'autocomplete').
//               NO Google SDK, NO key — see below.
// OUTPUTS:      <AddressInput> · AddressValue.
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE KEY NEVER REACHES THIS FILE, AND THAT IS THE WHOLE DESIGN
// ═════════════════════════════════════════════════════════════════════════════
// TRACE's Google key has **Application restrictions = NONE** — that is what lets it answer from a
// server, and it is precisely why it must never appear in a browser, a bundle or a response body.
// So this component calls OUR endpoint, which holds the key. It imports no Google SDK and reads
// no env var; there is nothing here for a verify check to find, which is the point.
//
// ⚠️ IT RIDES `customers/create` BECAUSE `api/` IS 12 OF 12 (§6 r11). A 13th function does not
// error — it makes the whole deploy fail silently while Vercel serves the last-good bundle.
//
// ── ONE FIELD, NOT FIVE COPIES (§6 r8) ──────────────────────────────────────────────────────
// David, 2026-09-24: autocomplete must be available EVERYWHERE an address is entered, and similar
// screens share functions. Every address surface routes through this component; a verify check
// refuses a new free-text address form outside it. The alternative — a per-screen implementation —
// is how the three phone writers drifted until `normalizePhone` consolidated them.
//
// ── WHAT PICKING MEANS, AND WHAT TYPING MEANS ───────────────────────────────────────────────
// · PICKED from the list → the address is LOCATED. It is stored with its coordinate and
//   `geocoded_at = now`, and the ③ check does not run: there is nothing left to ask.
// · TYPED and not picked → nothing is known. It goes through the ③ planner exactly as before —
//   ROOFTOP silent, RANGE_INTERPOLATED or a correction asks once, anything else cannot be placed.
//
// ── LOCATION BIAS: A RANKING IMPROVEMENT, AND ✏️ A CORRECTION TO WHAT THIS COMMENT USED TO SAY ──
// 🔴 THIS BLOCK PREVIOUSLY CLAIMED BIAS WAS A *CORRECTNESS REQUIREMENT*, citing an unbiased
// "153 Twin Cr" returning *Apex, North Carolina* and *Washington, West Virginia*. RE-MEASURED
// 2026-09-24 against the real depot coordinate and with `includedRegionCodes: ['us']` — which is
// what the proxy actually sends — THAT RESULT DID NOT REPRODUCE. Both lists put the right address
// first:
//     UNBIASED : 153 Twin Creekview Ln, Georgetown TX · Twin Creek Dr, Georgetown · Jonestown PA
//                · Comanche TX · Del Valle TX
//     BIASED   : 153 Twin Creekview Ln, Georgetown TX · Manchaca TX · Dripping Springs TX
//                · Burnet TX · Jonestown PA
// So bias moves ranks 2–5 from scattered to Central Texas; it is NOT the difference between the
// right address and a wrong-state one for this query. The original figure was a real observation
// of something — most likely a run without the region filter — but nobody re-derived it before it
// was written down as a requirement, which is [[R-26]] in this build's own source comment.
// It is still worth having: a shorter list of plausible neighbours is a smaller chance of a
// mis-tap, and a picked suggestion is stored as located WITHOUT a second check. BIAS, never
// RESTRICTION: LAWNS delivers across several towns, and Twin Creekview is in Georgetown while the
// yard is in Leander.
//
// ⚠️ AUTOCOMPLETE DOES NOT CATCH EVERYTHING. Same measurement: "Long Wed" (for Longwedge) returns
// nothing in Texas at all — Maine, Alabama, Oregon. It reduces bad addresses; the ③ check is
// still what catches the rest.
//
// RULE 24: if the service is unreachable the field keeps working as a plain text input and the ③
// check runs. It never blocks entry, and it never stores an unlocated address as located.
// ============================================================
import { useEffect, useRef, useState } from 'react';

export interface AddressValue {
  line1: string;
  city: string;
  state: string;
  zip: string;
  /** Set only when the person PICKED a suggestion — then it is located and needs no check. */
  latitude?: number | null;
  longitude?: number | null;
  /** ISO timestamp, set with the coordinate. Starts the 30-day clock (Google ToS §6.3.1). */
  geocoded_at?: string | null;
}

interface Suggestion { text: string; placeId: string }

interface Props {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  /** The business this is typed for — the proxy scopes on it. */
  businessId: string | null;
  /** The tenant's own located address, biasing the suggestions. Read from config, never a
   *  constant: a second tenant is not in Leander. */
  bias?: { latitude: number; longitude: number; radius?: number } | null;
  label?: string;
  disabled?: boolean;
}

/** One typing session bills once. A token is minted per session and retired when one is picked. */
function newSessionToken(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function AddressInput({ value, onChange, businessId, bias, label = 'Street address', disabled }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const session = useRef<string>(newSessionToken());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Below three characters every address in the county matches; asking is noise and spends
    // requests for nothing.
    const q = value.line1.trim();
    if (!businessId || q.length < 3) { setSuggestions([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    // The callback is deliberately NOT async: setTimeout discards what it returns, so an async
    // callback hands back a promise nobody holds — a rejection would surface as an unhandled
    // rejection rather than as Rule 24's visible message. The work is wrapped and voided instead.
    debounce.current = setTimeout(() => { void (async () => {
      try {
        const res = await fetch('/api/customers/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'autocomplete', businessId, address: q,
            bias: bias ?? undefined, sessionToken: session.current,
          }),
        });
        if (!res.ok) { setDegraded(true); setSuggestions([]); return; }
        const body = await res.json();
        const list = (body?.google?.suggestions ?? []) as Array<Record<string, any>>;
        setDegraded(false);
        setSuggestions(list.map(s => ({
          text: s?.placePrediction?.text?.text ?? '',
          placeId: s?.placePrediction?.placeId ?? '',
        })).filter(s => s.text));
        setOpen(true);
      } catch {
        // Rule 24 — the field keeps working, the ③ check will do the rest.
        setDegraded(true); setSuggestions([]);
      }
    })(); }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [value.line1, businessId, bias]);

  /** Picking makes the address LOCATED — the coordinate comes back with the place. */
  async function pick(s: Suggestion) {
    setOpen(false);
    try {
      const res = await fetch('/api/customers/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'geocode', businessId, address: s.text }),
      });
      const body = await res.json();
      const r = body?.google?.results?.[0];
      const loc = r?.geometry?.location;
      const parts = s.text.split(',').map((x: string) => x.trim());
      onChange({
        line1: parts[0] ?? s.text,
        city: parts[1] ?? value.city,
        state: (parts[2] ?? value.state).split(' ')[0] ?? value.state,
        zip: value.zip,
        // 🔴 LOCATED, SO THE ③ CHECK WILL NOT ASK. Only set when a coordinate really came back;
        // a picked suggestion with no coordinate is not located, and saying it is would be the
        // one lie this whole build exists to prevent.
        latitude: typeof loc?.lat === 'number' ? loc.lat : null,
        longitude: typeof loc?.lng === 'number' ? loc.lng : null,
        geocoded_at: typeof loc?.lat === 'number' ? new Date().toISOString() : null,
      });
      session.current = newSessionToken();     // the session ended when she picked
    } catch {
      // Take the text without the coordinate: it is then a TYPED address and the ③ check runs.
      onChange({ ...value, line1: s.text.split(',')[0] ?? s.text, latitude: null, longitude: null, geocoded_at: null });
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{label}</label>
      <input
        value={value.line1}
        disabled={disabled}
        onChange={e => {
          // 🔴 TYPING OVER A PICKED ADDRESS UNLOCATES IT. The coordinate belonged to the text that
          // was picked; keeping it while the text changes would route to the old place.
          onChange({ ...value, line1: e.target.value, latitude: null, longitude: null, geocoded_at: null });
        }}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        style={{ width: '100%', minHeight: 48, padding: '0.6rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '1rem' }}
        placeholder="Start typing the address…"
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 60, left: 0, right: 0, background: '#fff',
                      border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', marginTop: 4 }}>
          {suggestions.map(s => (
            <button key={s.placeId || s.text} onClick={() => { void pick(s); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.7rem 0.8rem',
                       background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.92rem' }}>
              {s.text}
            </button>
          ))}
        </div>
      )}
      {degraded && (
        // Said out loud: a field that quietly stops suggesting looks like a field with nothing to
        // suggest, and the person types on believing they saw every option.
        <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 4 }}>
          Address suggestions are unavailable — type it in full and we&apos;ll still check it.
        </div>
      )}
    </div>
  );
}
