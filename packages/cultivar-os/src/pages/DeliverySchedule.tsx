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
 *              CaptureInvoiceLauncher · ../components/delivery/CrewLinkPanel + ../lib/crewDayLink
 *              (the crew day link and what it recorded — ledger #347). Reached from the dashboard delivery_routing tile
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
import { readLatestEstimates, type DayEstimateRow } from '../lib/dayEstimate';
import { shipToLine } from '../lib/stopWrites';
import { StopCard } from '../components/delivery/StopCard';
import { useStopActions } from '../components/delivery/useStopActions';
import { CrewLinkPanel } from '../components/delivery/CrewLinkPanel';
import { PlanTheDayPanel } from '../components/delivery/PlanTheDayPanel';
// ── THE SCHEDULE SPLIT BY TEAM (ledger #376, teams piece 5 — David, 2026-09-21) ────────────
// 🔴 THE SAME PARTITION THE LOAD SHEET USES (ledger #373). One operation, one place (§6 r8): if
//    the schedule grouped stops its own way, the office and the paper could disagree about who is
//    taking a stop — and the paper is what the yard loads from.
import { groupStopsByTeam, sheetIsSectioned } from '../lib/loadListSubset';
import { readTeams, teamLabel, type Team } from '../lib/teams';
import { readStopEvents, stopActivity, type StopEvent } from '../lib/crewDayLink';
import { ymd } from '../lib/dashboardWindows';
import { routeOrderLine, dayRoutedAt } from '../lib/routeOrder';

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
  // The crew link's record per stop. `null` = could not be read; `undefined` = not applied yet.
  const [crewEvents, setCrewEvents] = useState<Map<string, StopEvent[]> | null | undefined>(undefined);
  // The latest per-crew estimate for the day on screen. `undefined` = the table is not there
  // (20260922c not applied); `null` = the read failed; an empty map = nothing routed yet (A9).
  const [estimates, setEstimates] = useState<Map<string | null, DayEstimateRow> | null | undefined>(undefined);
  const [crewPanelDay, setCrewPanelDay] = useState<string | null>(null);
  // Which day's crew-split proposal is open. One at a time, like the crew-link panel above.
  const [planDay, setPlanDay] = useState<string | null>(null);
  // 🔴 NAMES ONLY (ledger #376). A stop carries `team_id`; the NAME lives in the team list. A failed
  // team read never hides a stop — the sections are built from the stops themselves, so an unnamed
  // team still shows its work.
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    if (!businessId) return;
    void readTeams(supabase, businessId).then(r => { if (r.ok) setTeams(r.teams); });
  }, [businessId]);

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
    const ev = await readStopEvents(supabase, businessId!, res.value.stops.map(x => x.id));
    setCrewEvents(ev.ok ? ev.byStop : ev.absent ? undefined : null);
    if (TRACE_DELIVERY && !ev.ok) console.log('[TRACE:DELIVERY] crew link events', ev.absent ? 'table absent (20260917c not applied)' : `read FAILED — ${ev.message}`);
    // Capacity per crew, READ from the snapshot rather than recomputed here — see
    // `readLatestEstimates`. A day view only; a window has no single day to estimate.
    if (bounds.kind === 'day') {
      const est = await readLatestEstimates(supabase, businessId!, bounds.date);
      setEstimates(est.ok ? est.byTeam : est.absent ? undefined : null);
      if (TRACE_DELIVERY && !est.ok) console.log('[TRACE:DELIVERY] estimates', est.absent ? 'table absent (20260922c not applied)' : `read FAILED — ${est.message}`);
    } else { setEstimates(undefined); }
    setRead(res.value);
    setLoading(false);
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] day view loaded —', res.value.stops.length, 'stops · fulfilment columns', res.value.fulfilmentColumns ? 'present' : 'ABSENT (20260831d not applied)');
  }

  const actions = useStopActions({ onChanged: load, stops: read?.stops ?? [] });
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

        {/* 🔴 THE GOOD HALF OF #319, IN ITS OWN COLOUR. "Stop finished, and its order is marked
            fulfilled" is the sentence that tells Lauren stock has moved — the whole point of the
            change. Rendering it in the red box would read as a failure; leaving it out would make
            a fulfilment the one thing on this screen that happens silently. */}
        {actions.actionNote && (
          <div style={{ background: '#ECFDF5', color: '#065F46', borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', marginBottom: 12, display: 'flex', gap: 8 }}>
            <span style={{ flex: 1 }}>{actions.actionNote}</span>
            <button onClick={actions.clearActionError} style={{ background: 'none', border: 'none', color: '#065F46', fontWeight: 700, cursor: 'pointer' }}>×</button>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color={GREEN} />
                  <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: DARK }}>{formatDay(group.date)}</span>
                  <span style={{ fontSize: '0.75rem', color: GRAY }}>
                    · {group.items.length} stop{group.items.length !== 1 ? 's' : ''}
                    {/* Lauren's screen names the ACTION when a day is unplanned — she can fix it (David, 2026-09-18). */}
                    {group.date && <> · {routeOrderLine(dayRoutedAt(group.items), 'office')}</>}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                {/* Crew link: today or later, for the people who may change deliveries. */}
                {group.date && group.date >= ymd(new Date()) && can('deliveries:update') && (
                  <button
                    onClick={() => setCrewPanelDay(crewPanelDay === group.date ? null : group.date)}
                    aria-expanded={crewPanelDay === group.date}
                    style={{
                      padding: '7px 12px', minHeight: 40, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`,
                      borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                    }}
                  >
                    Crew link
                  </button>
                )}
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
                {/* PLAN THE DAY — beside Crew link and Route this day, on the same gate and the
                    same date, because this is where a person stands when they ask "who goes out".
                    It opens a PANEL under the header rather than navigating: the proposal needs
                    two columns, a stop list and an accept, which is more room than a header has,
                    and CrewLinkPanel already established that pattern directly below. */}
                {group.date && dayAddrs.length > 0 && can('deliveries:update') && (
                  <button
                    onClick={() => setPlanDay(prev => (prev === group.date ? null : group.date))}
                    style={{
                      padding: '7px 12px', minHeight: 40, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`,
                      borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                    }}
                  >
                    {planDay === group.date ? 'Hide the plan' : 'Plan the day'}
                  </button>
                )}
                </div>
              </div>
              {group.date && crewPanelDay === group.date && businessId && (
                <CrewLinkPanel businessId={businessId} date={group.date} />
              )}
              {group.date && planDay === group.date && businessId && (
                <PlanTheDayPanel
                  businessId={businessId} date={group.date} teams={teams}
                  canWrite={can('deliveries:update')}
                  onAccepted={() => { setPlanDay(null); void load(); }}
                />
              )}

              {/* 🔴 ONE SECTION PER TEAM (ledger #376, teams piece 5). A day nobody has split shows
                  exactly the flat list it always did — `sheetIsSectioned` is false and the map below
                  runs once with no heading. Splitting a single-crew nursery's day would be telling
                  it about a feature it does not use. */}
              {(() => {
                const sections = groupStopsByTeam(group.items);
                const split = sheetIsSectioned(sections);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sections.map(sec => (
                      <div key={sec.teamId ?? 'no-team'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {split && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                            marginTop: 4, paddingTop: 8, borderTop: '2px solid #e5edd8' }}>
                            {/* `teamLabel` says "No team", "(retired)" or "A team that is no longer
                                listed" — never a blank heading, and never a missing section (D-9). */}
                            <strong style={{ fontSize: '0.875rem', color: GREEN }}>
                              {teamLabel(teams, sec.teamId)}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {sec.stops.length} stop{sec.stops.length === 1 ? '' : 's'}
                            </span>
                            {/* 🔴 ROUTE THIS TEAM, NOT THE DAY ([[R-169]]). The route page refuses a
                                set spanning two teams BY NAME, so the button hands it a set it can
                                actually route. A teamless section gets NO button — routing it is
                                exactly what R-169 refuses, and offering a control that must fail is
                                a dead affordance (§1.6 item 5). */}
                            {/* ── CAPACITY PER CREW (David, 2026-09-25) ────────────────────────
                                Drive + planting against the day limit X, for THIS crew, with its
                                working. 🔴 READ FROM THE SNAPSHOT, so it says "as at" and never
                                pretends to be current; a crew nobody has routed reads "not
                                estimated yet", never 0 h — a zero would read as "an easy day". */}
                            {sec.teamId && estimates && (() => {
                              const e = estimates.get(sec.teamId);
                              if (!e) return (
                                <span style={{ fontSize: '0.75rem', color: GRAY }}>
                                  not estimated yet — press Route this team
                                </span>
                              );
                              const over = e.suggested_teams > 1;
                              const floor = !e.drive_known ? ' at least' : '';
                              const planting = e.working?.find(w => w.label === 'Planting time');
                              const notCounted = e.working?.find(w => w.label === 'Trees not counted');
                              return (
                                <span title={[planting?.because, notCounted?.because].filter(Boolean).join(' · ')}
                                      style={{ fontSize: '0.75rem', fontWeight: 700, color: over ? '#8a6d1f' : GREEN }}>
                                  {e.total_hours} h{floor} of {e.threshold_hours} h
                                  {/* The working, in David's own form: "45 gal × 1 min = 45 min". */}
                                  {planting ? <span style={{ fontWeight: 400, color: GRAY }}> · {planting.because.split(' — ')[0]}</span> : null}
                                  {notCounted ? <span style={{ fontWeight: 400, color: '#8a6d1f' }}> · {notCounted.value}</span> : null}
                                  <span style={{ fontWeight: 400, color: GRAY }}> · as at {new Date(e.created_at).toLocaleTimeString()}</span>
                                </span>
                              );
                            })()}
                            {sec.teamId && group.date && (
                              <button
                                onClick={() => {
                                  if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] route team —', group.date, sec.teamId, sec.stops.length, 'stops');
                                  navigate(`/deliveries?date=${group.date}&team=${sec.teamId}`);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', minHeight: 36,
                                  background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 8,
                                  fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                                <Navigation size={13} /> Route this team
                              </button>
                            )}
                            {sec.teamId === null && (
                              <span style={{ fontSize: '0.75rem', color: '#8a6d1f' }}>
                                Not assigned to a team yet — give these to a team before routing.
                              </span>
                            )}
                          </div>
                        )}
                        {sec.stops.map(d => (
                          <StopCard key={d.id} stop={d} read={read} actions={actions}
                            crewActivity={crewEvents === undefined ? undefined : crewEvents === null ? null : stopActivity(crewEvents.get(d.id) ?? [], d)} />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
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
