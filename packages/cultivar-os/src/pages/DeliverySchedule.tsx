/**
 * ── DELIVERY SCHEDULE (day view) · THUNDER Wave 2 (loop close) · 2026-06-20 ──────
 *
 * PURPOSE      Day-grouped view of SCHEDULED deliveries (the `deliveries` table —
 *              created by the OCR-invoice "Schedule delivery" destination). Groups
 *              by delivery_date, soonest day forward. The hub that closes the loop:
 *              snap invoice → schedule → delivery shows under its DAY here → tap
 *              "Route this day" → it plots on the existing DeliveryRoute map.
 *              Each card carries an inline date-edit (v1, 2026-07-01): move a delivery
 *              to a working day (e.g. off a Sunday) → RLS UPDATE of delivery_date →
 *              re-groups under the new day. Data KEPT, never deleted. Consolidating two
 *              deliveries onto one day feeds the multi-stop "Route this day" map.
 * DEPENDENCIES supabase client; the `deliveries` table (+ customers join for names).
 *              Reached from the dashboard delivery_routing tile (→ /delivery-schedule).
 *              Routes a day via /deliveries?date=YYYY-MM-DD (DeliveryRoute reused).
 *              Date-edit is a client-side RLS UPDATE (deliveries_owner_all /
 *              deliveries_member_all, FOR ALL, business_id-scoped) — no endpoint.
 * OUTPUTS      Day-grouped list; per-card date-edit; per-card in-context "Edit customer"
 *              (owner-only CustomerEditModal, opens over this page — no re-nav to the roster);
 *              navigation to the route map per day.
 *
 * GAP (future ticket — do NOT build here): a business "working days" setting would let
 * the invoice router flag/validate a scheduled non-working day (it scheduled a Sunday
 * delivery with no warning) and suggest the nearest working day — connects to the
 * MASTER_BRIEF suggestion-engine. v1 relies on the shown day-of-week; David moves manually.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Navigation, Phone, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { CustomerPartyEditor, type PartyCustomer } from '../components/customers/CustomerPartyEditor';
import { CUSTOMER_SELECT_FULL, CUSTOMER_SELECT_CORE } from '../components/customers/customerFieldRegistry';
import { readPricingConfig, normalizeDiscountTypes, RETAIL_TIER_NAME } from '@trace/shared/business-logic';
import { CaptureInvoiceLauncher } from '../components/CaptureInvoiceLauncher';
import { NotPermitted, WithheldData, requirementText } from '@trace/shared/components/SurfaceState';
import { parseYmd } from '../lib/operationsCalendar';
import { BUSINESS_MODULE_COLUMNS, type BusinessModuleRow } from '@trace/shared/business-logic/moduleState';
import {
  crewStopModel, fulfilmentPatch, startPatch, reviewAskDecision, reviewAskPatch,
  REVIEW_ASK_SHOWN, REVIEW_ASK_SKIPPED, DELIVERY_STATUS_FULFILLED, type ReviewAskOffer,
} from '../lib/deliveryFulfilment';
import { ReviewAskSheet } from '../components/delivery/ReviewAskSheet';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

interface DeliveryRow {
  id: string;
  customer_id: string | null;
  delivery_date: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  service_type: string | null;
  notes: string | null;
  // Added by 20260831c. NULL on every row until a stop is actually worked.
  started_at: string | null;
  completed_at: string | null;
  review_asked_at: string | null;
  review_ask_outcome: string | null;
  // Widened (3a) to the 8 editable fields so "Edit customer" opens the full customer
  // object with zero extra round-trip.
  customers: {
    first_name: string; last_name: string; phone: string | null; email: string | null;
    address_line1: string | null; city: string | null; state: string | null; zip: string | null;
  } | null;
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  planting:      'Planting / install',
  delivery_only: 'Delivery only',
};

function fullAddress(d: DeliveryRow): string {
  return [d.address_line1, d.city, d.state, d.zip].filter(Boolean).join(', ');
}

// delivery_date comes back as 'YYYY-MM-DD' (a DATE column). Parsed as LOCAL midnight so the
// day label never slips a day across the timezone boundary. The parse itself is now the ONE
// shared `parseYmd` (§6 r8 — the same operation was inline here and needed again by the
// calendar; a second copy is the one that drifts).
function formatDay(dateStr: string | null): string {
  if (!dateStr) return 'No date set';
  const d = parseYmd(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * `filterDate` — when the operations calendar has a day selected, this list shows THAT DAY
 * only. It is the same list, filtered; it is NOT a second delivery list (David's ONE
 * DELIVERY LIST ruling). Undefined/null = every scheduled day, which is what this route
 * rendered before the calendar was put above it.
 */
export function DeliverySchedule({ filterDate }: { filterDate?: string | null } = {}) {
  const navigate = useNavigate();
  const { businessId, can } = useBusinessContext();

  const [rows, setRows]       = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // A1/E1 — ONE customer form. This route mounts the SAME <CustomerPartyEditor> the /customers
  // roster and /customers/:id use; the old 8-field CustomerEditModal is deleted. Cost of the merge,
  // accepted deliberately (David, 2026-07-29): this surface loses per-field auto-save and gains a
  // Save button. "Small change, close, stay on the route" is exactly where a silent partial write
  // does the most damage, because the user never looks at the record again.
  const [editing, setEditing] = useState<PartyCustomer | null>(null);
  // The follow-up module's per-tenant row — the ONLY thing that decides whether a review may be
  // asked for. Null until loaded, and a null row means OFF (absent is not enabled).
  const [followUp, setFollowUp] = useState<BusinessModuleRow | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  // The stop whose prompt is open, and the offer to render. `offer: null` renders NOTHING.
  const [asking, setAsking] = useState<{ id: string; offer: ReviewAskOffer | null } | null>(null);
  // 🔴 DEPLOY-WINDOW HONESTY. 20260831c is GATED — David applies it by hand — so this code can be
  // live for a while against a table that does not yet have the four columns. PostgREST answers a
  // select for a missing column with 42703/PGRST204 and returns NO ROWS, which would blank the
  // whole delivery list. So the read falls back to the pre-migration column set and the fulfilment
  // controls SAY they are unavailable rather than silently not appearing. Same pattern as
  // openEditor's CUSTOMER_SELECT_FULL → CORE fallback below.
  const [schemaReady, setSchemaReady] = useState(true);
  const [tierOptions, setTierOptions] = useState<{ value: string; label: string }[]>([{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }]);

  useEffect(() => {
    if (!businessId) return;
    void load(); // pre-existing floating promise, fixed in passing (§1.6 fix-all-in-one-pass)
  }, [businessId]);

  // The editor prices from the configured tiers, same source the roster uses.
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data } = await readPricingConfig(supabase, businessId);
      const opts = [{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }];
      for (const ty of normalizeDiscountTypes((data?.config ?? {}) as Record<string, unknown>))
        for (const ti of ty.tiers) opts.push({ value: ti.name, label: `${ty.name} · ${ti.name}` });
      setTierOptions(opts);
    })();
  }, [businessId]);

  // The two column lists, in one place. CORE is what the table held before 20260831c; FULL adds the
  // four fulfilment/ask columns. A second hand-written copy of either is how the next reader forgets
  // a column the first one needs (STD-011).
  const DELIVERY_CUSTOMER_JOIN =
    'customers ( first_name, last_name, phone, email, address_line1, city, state, zip, billing_line1, billing_city, billing_state, billing_zip )';
  const DELIVERY_SELECT_CORE =
    `id, customer_id, delivery_date, address_line1, city, state, zip, status, service_type, notes, ${DELIVERY_CUSTOMER_JOIN}`;
  const DELIVERY_SELECT_FULL =
    `id, customer_id, delivery_date, address_line1, city, state, zip, status, service_type, notes, started_at, completed_at, review_asked_at, review_ask_outcome, ${DELIVERY_CUSTOMER_JOIN}`;

  async function load() {
    setLoading(true);
    const q = (cols: string) => supabase
      .from('deliveries')
      .select(cols)
      .eq('business_id', businessId!)
      .neq('status', 'cancelled')
      .order('delivery_date', { ascending: true, nullsFirst: false })
      .limit(200);

    let { data, error: err } = await q(DELIVERY_SELECT_FULL);
    let ready = true;
    // 42703 = undefined_column, PGRST204 = column not found in schema cache. Either means 20260831c
    // has not been applied yet. Fall back rather than blank the screen — and REMEMBER that we did,
    // so the controls can say why they are missing instead of just not being there.
    if (err && ((err as { code?: string }).code === '42703' || (err as { code?: string }).code === 'PGRST204')) {
      ready = false;
      ({ data, error: err } = await q(DELIVERY_SELECT_CORE));
    }
    setSchemaReady(ready);

    if (err) { setError(err.message); setLoading(false); return; }
    const list = (data ?? []) as unknown as DeliveryRow[];
    setRows(list);
    setLoading(false);
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] day view loaded —', list.length, 'stops · fulfilment columns', ready ? 'present' : 'ABSENT (20260831c not applied)');
  }

  // The follow-up module row + the business's own name (the customer screen greets with it).
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data: mod } = await supabase
        .from('business_modules')
        .select(BUSINESS_MODULE_COLUMNS)
        .eq('business_id', businessId)
        .eq('module_key', 'followup_engine')
        .maybeSingle();
      setFollowUp((mod ?? null) as BusinessModuleRow | null);
      const { data: biz } = await supabase
        .from('businesses').select('name').eq('id', businessId).maybeSingle();
      setBusinessName((biz as { name?: string } | null)?.name ?? null);
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] follow-up module —', mod ? `enabled=${(mod as BusinessModuleRow).enabled}` : 'NO ROW (off)');
    })();
  }, [businessId]);

  /**
   * THE TAP. One action; five consumers eventually read it (review request · completion status ·
   * contractor pay · material consumption · what actually happened on a day). Today two exist.
   *
   * The write is a plain RLS UPDATE under the crew member's own session — `deliveries_owner_all` /
   * `deliveries_member_all` are FOR ALL and business_id-scoped — exactly as the date edit above.
   * No endpoint, no service key, and no new Vercel function (api/ is at 12 of 12, §6 r11).
   */
  async function markStop(d: DeliveryRow, kind: 'start' | 'finish') {
    if (!can('deliveries:update')) { setError(requirementText('deliveries:update')); return; }
    setSavingId(d.id);
    const now = new Date();
    const patch = kind === 'start'
      ? startPatch(now)
      : fulfilmentPatch(now, { started_at: d.started_at, completed_at: d.completed_at });

    const { data: hit, error: err } = await supabase
      .from('deliveries')
      .update(patch)
      .eq('id', d.id)
      .eq('business_id', businessId!)
      .select('id');   // A8 — evidence it landed, not merely the absence of an error
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY]', kind, { id: d.id, patch, rows: hit?.length ?? 0, error: err?.message ?? null });
    if (err) { setError(err.message); setSavingId(null); return; }
    if (!hit?.length) {
      setError('That stop was not saved — you may not have permission, or it was removed.');
      setSavingId(null); return;
    }

    // 🔴 THE ASK IS CONSULTED ONLY AFTER THE STOP IS ALREADY DONE — which is both the honest moment
    // (you cannot ask about a job that has not happened) and the reason the crew's own screen above
    // never has to know whether the business pays for the tile.
    if (kind === 'finish') {
      let lastAsked: string | null = null;
      if (d.customer_id && followUp?.enabled) {
        const { data: prior } = await supabase
          .from('deliveries')
          .select('review_asked_at')
          .eq('business_id', businessId!)
          .eq('customer_id', d.customer_id)
          .not('review_asked_at', 'is', null)
          .order('review_asked_at', { ascending: false })
          .limit(1);
        lastAsked = (prior?.[0] as { review_asked_at?: string } | undefined)?.review_asked_at ?? null;
      }
      const decision = reviewAskDecision({
        moduleEnabled:    !!followUp?.enabled,
        moduleConfigured: !!followUp?.configured,
        config:           followUp?.config ?? null,
        businessName,
        status:           DELIVERY_STATUS_FULFILLED,   // we just wrote it, in the update above
        customerId:       d.customer_id,
        reviewAskedAt:    d.review_asked_at,
        customerLastAskedAt: lastAsked,
        now,
      });
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] review ask —', decision.offer ? 'OFFERED' : `suppressed:${decision.suppressedBy}`);
      // offer === null → setAsking with a null offer → <ReviewAskSheet> renders nothing. The
      // no-op is a value, not a branch someone has to remember to write.
      if (decision.offer) setAsking({ id: d.id, offer: decision.offer });
    }

    await load();
    setSavingId(null);
  }

  /**
   * Record that the prompt was reached — shown or skipped. Both are recorded; see §4 of the lib.
   *
   * A8 — the write must PROVE it wrote. A refused update here is not cosmetic: the ask record is
   * what the repeat-customer window reads, so a silently-lost row means this customer gets asked
   * again on their next visit. `.select('id')` returning nothing is a FAILURE, not a quiet success.
   */
  async function recordAsk(deliveryId: string, outcome: typeof REVIEW_ASK_SHOWN | typeof REVIEW_ASK_SKIPPED) {
    const { data: hit, error: err } = await supabase
      .from('deliveries')
      .update(reviewAskPatch(new Date(), outcome))
      .eq('id', deliveryId)
      .eq('business_id', businessId!)
      .select('id');
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] review ask recorded —', outcome, 'rows', hit?.length ?? 0, err?.message ?? 'ok');
    if (err || !hit?.length) {
      // Surfaced to the OWNER-facing error line, not to the customer screen the crew may still be
      // holding out. The stop itself is already done — that write succeeded and is not undone here.
      setError('The review prompt was not recorded — this customer may be asked again next time.');
    }
    if (outcome === REVIEW_ASK_SKIPPED) setAsking(null);
    await load();
  }

  // Move a delivery to a different day (e.g. off a Sunday). A pure delivery_date UPDATE —
  // data KEPT, never deleted. RLS (deliveries_*_all, FOR ALL, business_id-scoped) permits
  // this under the owner/member's own session; no endpoint or service key. Empty → null
  // (undated). Re-load() re-buckets the row under its new day automatically.
  async function editDate(d: DeliveryRow, newVal: string) {
    const next = newVal || null;
    if (next === d.delivery_date) return; // no change → no write
    setSavingId(d.id);
    // PRE-EMPTIVE, not apologetic (Phase 3). Same reasoning as Customers' grid cells: the
    // permission is knowable before the write, and the post-write check below stays as the
    // backstop for refusals the client cannot predict.
    if (!can('deliveries:update')) { setError(requirementText('deliveries:update')); setSavingId(null); return; }
    const { data: hit, error: err } = await supabase
      .from('deliveries')
      .update({ delivery_date: next })
      .eq('id', d.id)
      .eq('business_id', businessId!)
      .select('id'); // A8 — evidence it landed, not merely the absence of an error
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] date edit', { id: d.id, from: d.delivery_date, to: next, rows: hit?.length ?? 0, error: err?.message ?? null });
    if (err) { setError(err.message); setSavingId(null); return; }
    if (!hit?.length) { setError('That delivery date was not saved — you may not have permission, or the delivery was removed.'); setSavingId(null); return; }
    await load();
    setSavingId(null);
  }

  // Open the ONE customer editor over this page (owner-only). 🔴 It fetches the FULL row rather than
  // reusing this page's 8-column join: the editor edits the whole party record, and handing it a
  // partial row would let a Save write defaults over fields the page never loaded. One extra
  // round-trip, deliberately. Columns come from the field registry (A4) — deploy-window-safe.
  async function openEditor(d: DeliveryRow) {
    if (!d.customer_id) return;
    let { data, error } = await supabase.from('customers').select(CUSTOMER_SELECT_FULL).eq('id', d.customer_id).maybeSingle();
    if (error && ((error as any).code === '42703' || (error as any).code === 'PGRST204')) {
      ({ data, error } = await supabase.from('customers').select(CUSTOMER_SELECT_CORE).eq('id', d.customer_id).maybeSingle());
    }
    if (error || !data) { console.error('[TRACE:customers] could not open editor', error?.message); return; }
    setEditing(data as unknown as PartyCustomer);
  }

  // The editor commits ONCE now (A3/E2 phase B), so there is nothing to stream per field — reload
  // the cards after a successful Save so every card sharing that customer reflects it.

  // Group by delivery_date, soonest day forward (undated grouped last).
  const groups: { date: string | null; items: DeliveryRow[] }[] = [];
  // The filter is applied to the SOURCE of the grouping, so the count in the header below
  // counts what is actually on screen. A header counting rows the list does not show is the
  // §6 r18 lie in its plainest form.
  const visible = filterDate ? rows.filter(r => r.delivery_date === filterDate) : rows;
  for (const r of visible) {
    const key = r.delivery_date;
    let g = groups.find(x => x.date === key);
    if (!g) { g = { date: key, items: [] }; groups.push(g); }
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
            {loading ? 'Loading…'
              : filterDate
                ? `${visible.length} stop${visible.length !== 1 ? 's' : ''} on this day · ${rows.length} scheduled in total`
                : `${rows.length} scheduled deliver${rows.length !== 1 ? 'ies' : 'y'}`}
          </p>
        </div>
        {/* Second door into the invoice OCR→infer→route flow (owner action, matches "Edit customer" gating). */}
        {/* `costs:create` — see DeliveryRoute. Same control, same string, one rule. */}
        {can('costs:create') && <CaptureInvoiceLauncher />}
        {!can('costs:create') && (
          <NotPermitted permission="costs:create" what="Capturing an invoice" inline />
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {loading && <p style={{ textAlign: 'center', color: GRAY, paddingTop: 40 }}>Loading…</p>}
        {error  && <p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p>}

        {/* A SELECTED DAY WITH NOTHING ON IT IS A DIFFERENT FACT from a business with nothing
            scheduled anywhere, and it must not borrow the other's words (the "Unknown plant"
            lesson, #224). The "Snap an invoice" prompt belongs only to the second. */}
        {!loading && !error && filterDate && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: GRAY }}>
            <Truck size={32} color="#d1d5db" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Nothing scheduled on this day</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
              {rows.length} deliver{rows.length !== 1 ? 'ies are' : 'y is'} scheduled on other days.
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

        {!loading && !error && groups.map(group => {
          const dayAddrs = group.items.filter(d => fullAddress(d).length > 0);
          return (
            <div key={group.date ?? 'undated'} style={{ marginBottom: 24 }}>
              {/* Day header */}
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
                      padding: '7px 12px', background: GREEN, color: '#fff', border: 'none',
                      borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                    }}
                  >
                    <Navigation size={14} /> Route this day
                  </button>
                )}
              </div>

              {/* Deliveries for the day */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.items.map(d => {
                  const addr = fullAddress(d);
                  const name = d.customers ? `${d.customers.first_name} ${d.customers.last_name}`.trim() : 'Customer';
                  return (
                    <div key={d.id} style={{
                      background: '#fff', borderRadius: 12, padding: '14px 16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${GREEN}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: DARK }}>{name}</span>
                        {d.service_type && (
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 700,
                            color: d.service_type === 'planting' ? '#1d4ed8' : '#4b7a2e',
                            background: d.service_type === 'planting' ? '#eff6ff' : '#f0f7e6',
                            borderRadius: 6, padding: '1px 7px',
                          }}>
                            {SERVICE_TYPE_LABEL[d.service_type] ?? d.service_type}
                          </span>
                        )}
                      </div>
                      {addr ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={13} color={GREEN} />
                          <span style={{ fontSize: '0.8125rem', color: DARK }}>{addr}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={13} color="#d1d5db" />
                          <span style={{ fontSize: '0.8125rem', color: GRAY }}>No address on file</span>
                        </div>
                      )}
                      {d.customers?.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <Phone size={12} color={GRAY} />
                          <span style={{ fontSize: '0.75rem', color: GRAY }}>{d.customers.phone}</span>
                        </div>
                      )}

                      {/* ── THE TAP. The crew's primary action, and the one this card exists for on
                          a phone. `crewStopModel` takes ONLY the row — no module state, no
                          entitlement — so this block is byte-identical whether or not the business
                          pays for the review tile (see deliveryFulfilment §3). ── */}
                      {(() => {
                        const crew = crewStopModel(d);
                        if (!schemaReady) {
                          // Honest about WHY the control is absent, rather than absent (D-9).
                          return (
                            <div style={{ marginTop: 10, fontSize: '0.75rem', color: GRAY }}>
                              Marking stops done isn’t available yet — the database update (20260831c) hasn’t been applied.
                            </div>
                          );
                        }
                        return (
                          <div style={{ marginTop: 12 }}>
                            {crew.action && can('deliveries:update') && (
                              <button
                                onClick={() => { void markStop(d, crew.action === 'start' ? 'start' : 'finish'); }}
                                disabled={savingId === d.id}
                                style={{
                                  width: '100%', minHeight: 48, padding: '13px 16px',
                                  background: crew.action === 'finish' ? GREEN : '#fff',
                                  color: crew.action === 'finish' ? '#fff' : GREEN,
                                  border: crew.action === 'finish' ? 'none' : `1.5px solid ${GREEN}`,
                                  borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem',
                                  cursor: savingId === d.id ? 'default' : 'pointer',
                                  opacity: savingId === d.id ? 0.6 : 1,
                                }}
                              >
                                {savingId === d.id ? 'Saving…' : crew.actionLabel}
                              </button>
                            )}
                            {crew.action && !can('deliveries:update') && (
                              <NotPermitted permission="deliveries:update" what="Marking a stop done" inline />
                            )}
                            {!crew.action && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.75rem', fontWeight: 700, color: crew.statusColor,
                                  background: crew.statusBg, borderRadius: 6, padding: '3px 9px',
                                }}>
                                  {crew.statusLabel}
                                </span>
                                {/* Equal stamps mean UNMEASURED, so `minutes` is null and nothing is
                                    printed — never a fabricated "0 min". */}
                                {crew.minutes !== null && (
                                  <span style={{ fontSize: '0.75rem', color: GRAY }}>{crew.minutes} min on site</span>
                                )}
                                {d.review_ask_outcome && (
                                  <span style={{ fontSize: '0.75rem', color: GRAY }}>
                                    · review {d.review_ask_outcome === 'shown' ? 'asked' : 'not asked'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Inline date-edit — move this delivery to a working day (data kept). */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                        <Calendar size={13} color={GREEN} />
                        <input
                          type="date"
                          value={d.delivery_date ?? ''}
                          disabled={savingId === d.id}
                          onChange={e => { void editDate(d, e.target.value); }}
                          aria-label="Delivery date"
                          style={{
                            border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 9px',
                            fontSize: '0.8125rem', color: DARK, outline: 'none',
                            background: savingId === d.id ? '#f3f4f6' : '#fff',
                          }}
                        />
                        {savingId === d.id && (
                          <span style={{ fontSize: '0.75rem', color: GRAY }}>Moving…</span>
                        )}
                      </div>

                      {/* Edit customer → in-context modal over THIS page. Opens the full customer
                          object from the widened join; close → stay on the same route, no re-nav.
                          `customers:update` — the capability the modal exercises (ruling
                          2026-07-30). The customer BLOCK's own redaction is handled in Phase 3;
                          this gate is only the edit affordance. */}
                      {/* 🔴 WITHHELD DATA (Phase 3) — the counter-example named in the ruling.
                          The customer block simply VANISHED for anyone without access, leaving a
                          delivery row that read as "this delivery has no customer" — a fact about
                          the BUSINESS, not about the viewer. That is the dangerous half of the
                          silent-refusal class: plausible, and acted upon. */}
                      {!can('customers:read') && d.customer_id && (
                        <WithheldData permission="customers:read" what="Customer details" inline
                          style={{ marginTop: 8 }} />
                      )}
                      {can('customers:update') && d.customer_id && d.customers && (
                        <button
                          onClick={() => { void openEditor(d); }}
                          style={{
                            marginTop: 8, background: 'none', border: 'none', padding: 0,
                            color: GREEN, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                          }}
                        >
                          Edit customer →
                        </button>
                      )}
                    </div>
                  );
                })}
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

      {/* The review ask. `offer` is null whenever there is nothing to offer — a business without
          the tile, an unconfigured link, a customer asked recently — and a null offer renders
          NOTHING at all. There is no greyed control and no upgrade copy on a crew member's phone. */}
      <ReviewAskSheet
        offer={asking?.offer ?? null}
        onShown={() => { if (asking) void recordAsk(asking.id, REVIEW_ASK_SHOWN); }}
        onSkip={()  => { if (asking) void recordAsk(asking.id, REVIEW_ASK_SKIPPED); }}
        onClose={()  => setAsking(null)}
      />

      {/* The ONE customer form (A1/E1), opened over this route page — no re-nav to the roster. */}
      {editing && (
        <CustomerPartyEditor
          customer={editing}
          tierOptions={tierOptions}
          onSaved={() => { void load(); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
