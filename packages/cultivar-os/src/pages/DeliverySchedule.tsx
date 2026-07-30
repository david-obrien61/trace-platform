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

// delivery_date comes back as 'YYYY-MM-DD' (a DATE column). Parse as LOCAL midnight so
// the day label never slips a day across the timezone boundary.
function formatDay(dateStr: string | null): string {
  if (!dateStr) return 'No date set';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function DeliverySchedule() {
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

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('deliveries')
      .select(`
        id, customer_id, delivery_date, address_line1, city, state, zip, status, service_type, notes,
        customers ( first_name, last_name, phone, email, address_line1, city, state, zip, billing_line1, billing_city, billing_state, billing_zip )
      `)
      .eq('business_id', businessId!)
      .neq('status', 'cancelled')
      .order('delivery_date', { ascending: true, nullsFirst: false })
      .limit(200);

    if (err) { setError(err.message); setLoading(false); return; }
    const list = (data ?? []) as unknown as DeliveryRow[];
    setRows(list);
    setLoading(false);
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] day view loaded —', list.length, 'scheduled deliveries');
  }

  // Move a delivery to a different day (e.g. off a Sunday). A pure delivery_date UPDATE —
  // data KEPT, never deleted. RLS (deliveries_*_all, FOR ALL, business_id-scoped) permits
  // this under the owner/member's own session; no endpoint or service key. Empty → null
  // (undated). Re-load() re-buckets the row under its new day automatically.
  async function editDate(d: DeliveryRow, newVal: string) {
    const next = newVal || null;
    if (next === d.delivery_date) return; // no change → no write
    setSavingId(d.id);
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
  for (const r of rows) {
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
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 40 }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Scheduled Deliveries</h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#a8c890' }}>
            {loading ? 'Loading…' : `${rows.length} scheduled deliver${rows.length !== 1 ? 'ies' : 'y'}`}
          </p>
        </div>
        {/* Second door into the invoice OCR→infer→route flow (owner action, matches "Edit customer" gating). */}
        {/* `costs:create` — see DeliveryRoute. Same control, same string, one rule. */}
        {can('costs:create') && <CaptureInvoiceLauncher />}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {loading && <p style={{ textAlign: 'center', color: GRAY, paddingTop: 40 }}>Loading…</p>}
        {error  && <p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p>}

        {!loading && !error && rows.length === 0 && (
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
