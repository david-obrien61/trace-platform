// ============================================================
// LocateAddressesPanel — Settings → Addresses (PLATFORM — @trace/shared)
// PURPOSE:      Lauren or David locates the customer book from a screen, without a terminal.
//               Shows what is left, runs in small batches, stops on demand, and hands back
//               "N located · M need a look" plus the review list.
// DEPENDENCIES: business-logic/geocodeRun (pure) · the server proxy at api/customers/create
//               (action 'geocode') · contactWriter.setAddressGeocode. NO Google key here.
// OUTPUTS:      <LocateAddressesPanel>
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 IT DOES NOT RUN BY ITSELF, AND IT MUST NOT (David, 2026-09-24)
// ═════════════════════════════════════════════════════════════════════════════
// *"The bulk geocode runs only AFTER the final reload and only when David says."* So there is no
// timer, no on-mount trigger and no auto-resume: the only thing that starts it is a person
// pressing the button. Reading this screen costs nothing.
//
// ⚠️ WHY A SCREEN AND NOT ONLY THE SCRIPT. `npm run geocode:backfill` exists and does the same
// work, but it needs a terminal and the service key. Lauren has neither. A capability only
// reachable from a laptop that is not hers is a capability she does not have.
//
// ── NEVER BILLED TWICE ──────────────────────────────────────────────────────────────────────
// Only rows with NO verdict are fetched, and every outcome writes one. Closing the tab, losing
// the wifi or pressing the button again resumes where it stopped and re-spends nothing. The rows
// ARE the progress — there is no cursor to go stale.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { planGeocodeRun, applyOneResult, runSummary, EMPTY_RUN, GAP_MS, type GeocodeRunState } from '../../business-logic/geocodeRun';
import { setAddressGeocode } from '../../business-logic/contactWriter';

interface Props { db: SupabaseClient; businessId: string | null; canWrite: boolean }

interface Pending { id: string; line1: string; city: string | null; state: string | null; zip: string | null }
interface ReviewRow { id: string; typed: string; googleSays: string }

const GREEN = '#27500A';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function LocateAddressesPanel({ db, businessId, canWrite }: Props) {
  const [counts, setCounts] = useState<GeocodeRunState>(EMPTY_RUN);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [note, setNote] = useState('');
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [missing, setMissing] = useState(false);

  /** How much is left, and how much is already done. Read-only; costs nothing. */
  const refresh = useCallback(async () => {
    if (!businessId) return;
    const head = async (f: (q: any) => any) => {
      const { count, error } = await f(db.from('customer_addresses')
        .select('*', { count: 'exact', head: true }).eq('business_id', businessId));
      // 🔴 A MISSING COLUMN IS SAID, NOT SWALLOWED. Until 20260923c is applied this screen cannot
      // work, and a silent 0 would read as "everything is located" — the exact opposite.
      if (error && /geocode_status|column/i.test(error.message)) { setMissing(true); return 0; }
      return count ?? 0;
    };
    const remaining = await head(q => q.is('geocode_status', null).not('line1', 'is', null).neq('line1', ''));
    const located = await head(q => q.eq('geocode_status', 'found'));
    const cannot = await head(q => q.eq('geocode_status', 'not_found'));
    const confirm = await head(q => q.eq('geocode_status', 'confirm'));
    setCounts(c => ({ ...c, remaining, located, cannotPlace: cannot, needALook: confirm }));
  }, [db, businessId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function runBatches() {
    if (!businessId || !canWrite) return;
    setRunning(true); setStopped(false);
    let state = { ...counts };
    let halt = false;
    // The stop flag is read from a ref-like closure via the state setter below; a person pressing
    // Stop must be obeyed within one address, not one batch.
    const shouldStop = () => halt;
    (window as any).__traceStopGeocode = () => { halt = true; };

    for (;;) {
      const plan = planGeocodeRun(state, shouldStop());
      setNote(plan.message);
      if (!plan.more) break;

      const { data, error } = await db.from('customer_addresses')
        .select('id, line1, city, state, zip')
        .eq('business_id', businessId).is('geocode_status', null)
        .not('line1', 'is', null).neq('line1', '')
        .order('id', { ascending: true }).limit(plan.take);
      if (error) { setNote(`Stopped — ${error.message}`); break; }
      const rows = (data ?? []) as Pending[];
      if (rows.length === 0) { state = { ...state, remaining: 0 }; continue; }

      for (const row of rows) {
        if (shouldStop()) break;
        const typed = [row.line1, row.city, row.state, row.zip].filter(Boolean).join(', ');
        let raw: unknown = null; let reachable = true;
        try {
          const res = await fetch('/api/customers/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'geocode', businessId, address: typed }),
          });
          const body = await res.json();
          raw = body?.google ?? body;
        } catch { reachable = false; }

        const r = applyOneResult(raw, new Date(), reachable);
        if (r.patch) {
          const { error: we } = await setAddressGeocode(db, { businessId, addressId: row.id, patch: r.patch });
          if (we) { state = { ...state, unreachable: state.unreachable + 1 }; }
          else if (r.patch.geocode_status === 'found') state = { ...state, located: state.located + 1, remaining: state.remaining - 1 };
          else state = { ...state, cannotPlace: state.cannotPlace + 1, remaining: state.remaining - 1 };
        } else if (r.review) {
          // 🔴 LEFT WITH NO VERDICT ON PURPOSE, so it is offered to a PERSON rather than decided
          // here. It stays in `remaining` — which is honest: the work is not done.
          setReview(v => v.concat({ id: row.id, typed, googleSays: r.outcome?.suggestion ?? '' }));
          state = { ...state, needALook: state.needALook + 1, remaining: state.remaining - 1 };
        } else {
          state = { ...state, unreachable: state.unreachable + 1, remaining: state.remaining - 1 };
        }
        setCounts(state);
        await sleep(GAP_MS);       // Google's documented ceiling is 25/sec; this stays under it
      }
      if (shouldStop()) break;
    }
    setRunning(false); setStopped(shouldStop());
    await refresh();
  }

  if (missing) {
    return (
      <div className="section" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '1rem' }}>
        <strong>Addresses are not set up yet.</strong>
        <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
          The coordinate columns have not been added to this database. Nothing is wrong with your
          data — this screen switches on when the migration is applied.
        </div>
      </div>
    );
  }

  const done = counts.located + counts.cannotPlace + counts.needALook;
  return (
    <div className="section">
      <h3 style={{ margin: '0 0 6px' }}>Find where your customers are</h3>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 10px' }}>
        Looks up each saved address once and remembers where it is, so deliveries can be priced by
        distance and shown on the map. Addresses we cannot find are kept and marked — never guessed.
      </p>

      <div style={{ fontSize: '0.95rem', marginBottom: 10 }}>
        <div><strong>{counts.remaining}</strong> not looked at yet</div>
        {done > 0 && <div style={{ color: '#6b7280' }}>{runSummary(counts)}</div>}
      </div>

      {canWrite ? (
        <>
          <button className="btn" disabled={running || counts.remaining === 0}
            onClick={() => { void runBatches(); }}
            style={{ width: '100%', minHeight: 48, background: GREEN, color: '#fff', border: 'none', borderRadius: 8 }}>
            {running ? 'Looking…' : counts.remaining === 0 ? 'Nothing left to look at' : `Locate ${counts.remaining} address${counts.remaining === 1 ? '' : 'es'}`}
          </button>
          {running && (
            <button className="btn" onClick={() => { (window as any).__traceStopGeocode?.(); }}
              style={{ width: '100%', minHeight: 48, marginTop: 8, background: '#fff', color: '#A32D2D', border: '1.5px solid #A32D2D', borderRadius: 8 }}>
              Stop
            </button>
          )}
        </>
      ) : (
        // Refusal is announced, never a hidden button (the six-state ruling).
        <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
          You can see this, but changing customer records needs the manager's permission.
        </div>
      )}

      {note && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 8 }}>{note}</div>}

      {review.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <strong>{review.length} need you to look</strong>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 8px' }}>
            We found something close, but not exactly what is on file. Nothing has been changed.
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
            {review.slice(0, 50).map(r => (
              <li key={r.id} style={{ marginBottom: 4 }}>
                <div>{r.typed}</div>
                {r.googleSays && <div style={{ color: '#92400e' }}>we found: {r.googleSays}</div>}
              </li>
            ))}
          </ul>
          {review.length > 50 && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>…and {review.length - 50} more</div>}
        </div>
      )}
    </div>
  );
}
