/**
 * ── DELIVERY SCHEDULE (day view) · THUNDER Wave 2 (loop close) · 2026-06-20 ──────
 *
 * PURPOSE      Day-grouped view of SCHEDULED deliveries (the `deliveries` table). Groups by
 *              delivery_date, soonest day forward, and routes a day via "Route this day".
 *              🔴 THIS PAGE'S ONLY AXIS IS THE DAY GROUPING (ledger #301, 2026-09-11). Everything a
 *              stop shows — customer, ship-to, what is on its order, status, actions — is the ONE
 *              <StopCard> the route and the order screen also render, read through the ONE
 *              `readStops` and acting through the ONE `useStopActions` (STD-017). Before that this
 *              page asked for `orders(id, status)` and never the lines, so the crew got an address and
 *              no idea what was on the truck (David, 2026-09-09 09:42, DeliveryDayIssue9Sep0943hrsL.pdf).
 * DEPENDENCIES ../lib/stopRead · ../components/delivery/StopCard · ../components/delivery/useStopActions
 *              · ../lib/deliveryWindow (the date bound) · ../lib/stopWrites (shipToLine) ·
 *              CaptureInvoiceLauncher. Reached from the dashboard delivery_routing tile
 *              (→ /delivery-schedule) and mounted under the operations calendar with `filterDate`.
 *              Routes a day via /deliveries?date=YYYY-MM-DD (DeliveryRoute).
 * OUTPUTS      Day-grouped stop cards; navigation to the route map per day.
 *
 * GAP (future ticket — do NOT build here): a business "working days" setting would let the invoice
 * router flag/validate a scheduled non-working day (it scheduled a Sunday delivery with no warning) and
 * suggest the nearest working day — connects to the MASTER_BRIEF suggestion-engine. v1 relies on the
 * shown day-of-week; David moves manually.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Navigation, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { deliveryQueryBounds } from '../lib/deliveryWindow';
import { useBusinessContext } from '@trace/shared/context';
import { CaptureInvoiceLauncher } from '../components/CaptureInvoiceLauncher';
import { NotPermitted } from '@trace/shared/components/SurfaceState';
import { parseYmd } from '../lib/operationsCalendar';
import { readStops, type StopRead, type StopRow } from '../lib/stopRead';
import { shipToLine } from '../lib/stopWrites';
import { StopCard } from '../components/delivery/StopCard';
import { useStopActions } from '../components/delivery/useStopActions';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

// delivery_date comes back as 'YYYY-MM-DD' (a DATE column). Parsed as LOCAL midnight so the day label
// never slips a day across the timezone boundary — through the ONE shared `parseYmd` (§6 r8).
function formatDay(dateStr: string | null): string {
  if (!dateStr) return 'No date set';
  const d = parseYmd(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * `filterDate` — when the operations calendar has a day selected, this list shows THAT DAY only. It is
 * the same list, filtered; it is NOT a second delivery list (David's ONE DELIVERY LIST ruling).
 * Undefined/null = every scheduled day in the working window.
 */
export function DeliverySchedule({ filterDate }: { filterDate?: string | null } = {}) {
  const navigate = useNavigate();
  const { businessId, can } = useBusinessContext();

  const [read, setRead]       = useState<StopRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    void load();
    // 🔴 `filterDate` IS A DEPENDENCY: it reaches the query, so omitting it would leave the previous
    // day's rows on screen under the new day's heading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, filterDate]);

  async function load() {
    setLoading(true);
    // 🔴 THE DATE BOUND REACHES THE QUERY. With 564 imported past stops a client-side filter over the
    // first 200 rows could only ever return nothing for a day outside them. The decision lives in
    // `deliveryWindow.ts` because a bound computed inline in a `.tsx` cannot be asserted (#134).
    const bounds = deliveryQueryBounds(filterDate, new Date());
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] list bound —', bounds);
    const res = await readStops(
      supabase, businessId!,
      bounds.kind === 'day' ? { kind: 'day', date: bounds.date } : { kind: 'window', from: bounds.from },
      { readLines: can('order_items:read') },
    );
    if (!res.ok) { setError(res.error); setLoading(false); return; }
    setError(null);
    setRead(res.value);
    setLoading(false);
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] day view loaded —', res.value.stops.length, 'stops · fulfilment columns', res.value.fulfilmentColumns ? 'present' : 'ABSENT (20260831d not applied)');
  }

  const actions = useStopActions({ onChanged: load });
  const rows: StopRow[] = read?.stops ?? [];

  // Group by delivery_date, soonest day forward (undated grouped last). The filter is applied to the
  // SOURCE of the grouping, so the header count counts what is actually on screen (§6 r18).
  const groups: { date: string | null; items: StopRow[] }[] = [];
  const visible = filterDate ? rows.filter(r => r.delivery_date === filterDate) : rows;
  for (const r of visible) {
    let g = groups.find(x => x.date === r.delivery_date);
    if (!g) { g = { date: r.delivery_date, items: [] }; groups.push(g); }
    g.items.push(r);
  }
  groups.sort((a, b) => {
    if (a.date === b.date) return 0;
    if (!a.date) return 1;        // undated last
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1; // ascending — soonest first
  });

  return (
    <div style={{ minHeight: filterDate ? 0 : '100vh', background: SAGE, paddingBottom: 40 }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            {filterDate ? formatDay(filterDate) : 'Scheduled Deliveries'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#a8c890' }}>
            {/* 🔴 THE HEADER MAY ONLY CLAIM WHAT THE READ ESTABLISHED (§6 r18): the selected DAY, or a
                bounded window — never a total this read did not count. */}
            {loading ? 'Loading…'
              : filterDate
                ? `${visible.length} stop${visible.length !== 1 ? 's' : ''} on this day`
                : `${rows.length} deliver${rows.length !== 1 ? 'ies' : 'y'} — the last 30 days and everything ahead`}
          </p>
        </div>
        {/* Second door into the invoice OCR→infer→route flow. `costs:create` — same control as DeliveryRoute. */}
        {can('costs:create') && <CaptureInvoiceLauncher />}
        {!can('costs:create') && (
          <NotPermitted permission="costs:create" what="Capturing an invoice" inline />
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {loading && <p style={{ textAlign: 'center', color: GRAY, paddingTop: 40 }}>Loading…</p>}
        {error  && <p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p>}
        {actions.actionError && (
          <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{actions.actionError}</span>
            <button onClick={actions.clearActionError} style={{ background: 'none', border: 'none', color: '#991B1B', fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>Dismiss</button>
          </div>
        )}

        {/* A SELECTED DAY WITH NOTHING ON IT IS A DIFFERENT FACT from a business with nothing scheduled
            anywhere, and it must not borrow the other's words (#224). */}
        {!loading && !error && filterDate && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: GRAY }}>
            <Truck size={32} color="#d1d5db" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Nothing scheduled on this day</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
              Pick another day on the calendar above to see its stops.
            </p>
          </div>
        )}

        {!loading && !error && !filterDate && rows.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: GRAY }}>
            <Truck size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No scheduled deliveries</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
              Snap an invoice and check “Schedule delivery” to add one here.
            </p>
            <button
              onClick={() => navigate('/receipts', { state: { from: 'route' } })}
              style={{ marginTop: 16, padding: '11px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Snap an invoice →
            </button>
          </div>
        )}

        {!loading && !error && read && groups.map(group => {
          const dayAddrs = group.items.filter(d => shipToLine(d).length > 0);
          return (
            <div key={group.date ?? 'undated'} style={{ marginBottom: 24 }}>
              {/* Day header — this page's own axis */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color={GREEN} />
                  <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: DARK }}>{formatDay(group.date)}</span>
                  <span style={{ fontSize: '0.75rem', color: GRAY }}>
                    · {group.items.length} stop{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {group.date && dayAddrs.length > 0 && (
                  <button
                    onClick={() => {
                      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] route day —', group.date, dayAddrs.length, 'stops');
                      navigate(`/deliveries?date=${group.date}`);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', minHeight: 40, background: GREEN, color: '#fff', border: 'none',
                      borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                    }}
                  >
                    <Navigation size={14} /> Route this day
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.items.map(d => (
                  <StopCard key={d.id} stop={d} read={read} actions={actions} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Legacy path: route delivery ORDERS from cart checkout (separate source) */}
        {!loading && !error && (
          <button
            onClick={() => navigate('/deliveries')}
            style={{
              width: '100%', marginTop: 8, padding: '12px', background: 'transparent',
              border: `1px solid #cfe3b6`, borderRadius: 10, color: GREEN,
              fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
            }}
          >
            Route delivery orders from checkout →
          </button>
        )}
      </div>

      {actions.overlays}
    </div>
  );
}
