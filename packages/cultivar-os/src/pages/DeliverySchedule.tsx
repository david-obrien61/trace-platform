/**
 * ── DELIVERY SCHEDULE (day view) · THUNDER Wave 2 (loop close) · 2026-06-20 ──────
 *
 * PURPOSE      Day-grouped view of SCHEDULED deliveries (the `deliveries` table —
 *              created by the OCR-invoice "Schedule delivery" destination). Groups
 *              by delivery_date, soonest day forward. The hub that closes the loop:
 *              snap invoice → schedule → delivery shows under its DAY here → tap
 *              "Route this day" → it plots on the existing DeliveryRoute map.
 * DEPENDENCIES supabase client; the `deliveries` table (+ customers join for names).
 *              Reached from the dashboard delivery_routing tile (→ /delivery-schedule).
 *              Routes a day via /deliveries?date=YYYY-MM-DD (DeliveryRoute reused).
 * OUTPUTS      Read-only list; navigation to the route map per day.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Navigation, Phone, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

interface DeliveryRow {
  id: string;
  delivery_date: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  service_type: string | null;
  notes: string | null;
  customers: { first_name: string; last_name: string; phone: string | null } | null;
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
  const { businessId } = useBusinessContext();

  const [rows, setRows]       = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    load();
  }, [businessId]);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('deliveries')
      .select(`
        id, delivery_date, address_line1, city, state, zip, status, service_type, notes,
        customers ( first_name, last_name, phone )
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
              onClick={() => navigate('/receipts')}
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
    </div>
  );
}
