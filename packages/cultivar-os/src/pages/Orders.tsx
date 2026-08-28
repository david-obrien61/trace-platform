// ============================================================
// Orders — the roster. PURPOSE: every order for this business, newest first, filterable by
//   status. DEPENDENCIES: orderStatus (orderStatusMeta), orderRosterFilter (chips/matching/
//   count sentence), orderItemName (the line's own name). OUTPUTS: the /orders screen.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Truck, Package, Wrench, ScanLine, ChevronRight, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { orderItemName, orderItemTag, orderItemAnchor, type OrderItemAnchorFields } from '../lib/orderItemName';
import { orderStatusMeta } from '../lib/orderStatus';
import {
  rosterStatusChips, filterOrdersByStatus, rosterCountLabel, ROSTER_PAGE_LIMIT,
} from '../lib/orderRosterFilter';

interface OrderRow {
  id: string;
  created_at: string;
  total_amount: number;
  transport_method: string;
  leakage_flag: boolean;
  notes: string | null;
  status: string;
  customers: { first_name: string; last_name: string; email: string } | null;
  order_items: (OrderItemAnchorFields & { quantity: number })[];
}

const TRANSPORT_ICON: Record<string, React.ReactNode> = {
  self:     <Package size={13} />,
  delivery: <Truck   size={13} />,
  install:  <Wrench  size={13} />,
};

const TRANSPORT_LABEL: Record<string, string> = {
  self:     'Self',
  delivery: 'Delivery',
  install:  'Install',
};

export function Orders() {
  const navigate              = useNavigate();
  const { businessId }        = useBusinessContext();
  const [orders, setOrders]   = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  // DEFAULT TO ALL (David's ruling). An empty selection means every row, not none: Lauren's habit
  // is the unfiltered screen, and a filter that hides rows on day one is how someone concludes an
  // order vanished. The chips are the discovery, not a gate in front of the data.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!businessId) return;
    void load();
  }, [businessId]);

  async function load() {
    setLoading(true);
    // Clear the previous error BEFORE the read. Without this a single transient failure stuck to
    // the screen until remount, so a later successful load rendered rows underneath a stale
    // error — the screen asserting a failure that had already been superseded.
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select(`
        id, created_at, total_amount, transport_method,
        leakage_flag, notes, status,
        customers ( first_name, last_name, email ),
        order_items (
          quantity, business_inventory_id, description, sku,
          business_inventory ( name, size, sku )
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(ROSTER_PAGE_LIMIT);

    if (err) { setError(err.message); setLoading(false); return; }
    const rows = (data ?? []) as OrderRow[];
    // [TRACE:ROSTER] which anchor named each order's first line (specimen vs stock line) — the
    // fix for the "Unknown plant" gap on stock-line/scan orders (as-built recon §7).
    // The status distribution is logged alongside the anchors so the DEPLOYED-bar check for the
    // vocabulary rename is one glance: after R-STATUS there must be ZERO `confirmed` here.
    const dist: Record<string, number> = {};
    for (const r of rows) { const k = String(r.status ?? ''); dist[k] = (dist[k] ?? 0) + 1; }
    console.log('[TRACE:ROSTER] roster loaded', {
      count: rows.length,
      atPageCap: rows.length >= ROSTER_PAGE_LIMIT,
      statusDistribution: dist,
      anchors: rows.map(o => o.order_items?.[0] ? orderItemAnchor(o.order_items[0]) : 'no-line'),
    });
    setOrders(rows);
    setLoading(false);
  }

  const chips    = useMemo(() => rosterStatusChips(orders), [orders]);
  const view     = useMemo(() => filterOrdersByStatus(orders, selected), [orders, selected]);
  const filtering = selected.size > 0;

  function toggleChip(value: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      console.log('[TRACE:ROSTER] status filter changed', {
        toggled: value, active: [...next], shown: filterOrdersByStatus(orders, next).length, loaded: orders.length,
      });
      return next;
    });
  }

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div style={{ minHeight: '100vh', background: '#EAF3DE', padding: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#27500A' }}>
            Orders
          </h1>
          {/* The count sentence. It says what the screen is HIDING — both the filter and the
              page cap. The old copy read "N recent checkouts", which at the cap asserted a
              total nobody had counted. */}
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
            {loading ? 'Loading…' : error ? '' : rosterCountLabel(view.length, orders.length, filtering)}
          </p>
        </div>
        <button
          onClick={() => navigate('/checkout/scan')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px',
            background: '#27500A', color: '#fff', border: 'none', borderRadius: 10,
            fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <ScanLine size={16} /> New order
        </button>
      </div>

      {/* ── Status filter chips ──
          DERIVED from ORDER_STATUSES ∪ the statuses actually present in the loaded rows, so no
          row can exist that no chip selects (orderRosterFilter). Multi-select; "All" clears.
          Hidden while loading or errored — offering a filter over data we do not have would be
          a control that appears to do something and does not (D-9). */}
      {!loading && !error && orders.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <button
            onClick={() => setSelected(new Set())}
            aria-pressed={!filtering}
            style={{
              minHeight: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 700,
              border: !filtering ? '1px solid #27500A' : '1px solid #d1d5db',
              background: !filtering ? '#27500A' : '#fff',
              color: !filtering ? '#fff' : '#374151',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {filtering && <RotateCcw size={12} />} All
          </button>

          {chips.map(c => {
            const m      = orderStatusMeta(c.value);
            const active = selected.has(c.value);
            return (
              <button
                key={c.value}
                onClick={() => toggleChip(c.value)}
                aria-pressed={active}
                title={c.known ? undefined
                  : `"${c.label}" is in your data but is not one of the four order statuses — these rows are shown so they are not lost`}
                style={{
                  minHeight: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 700,
                  border: active ? `2px solid ${m.color}` : '1px solid #d1d5db',
                  background: active ? m.bg : '#fff',
                  color: active ? m.color : '#374151',
                  display: 'flex', alignItems: 'center', gap: 5,
                  // An unrecognised value is shown, and shown AS unrecognised — a row with a
                  // status the vocabulary does not know must not silently look canonical.
                  fontStyle: c.known ? 'normal' : 'italic',
                }}
              >
                {!c.known && <AlertTriangle size={11} />}
                {c.label}
                <span style={{ opacity: 0.65, fontWeight: 600 }}>{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', color: '#6b7280', paddingTop: 40 }}>Loading…</p>
      )}

      {/* ERROR ≠ EMPTY. A filtered list that fails to load must never render as "nothing
          matched" — one of those sentences says your data is fine and the other says we could
          not read it, and showing the wrong one sends someone hunting a missing order. */}
      {error && (
        <div style={{ textAlign: 'center', paddingTop: 40, color: '#A32D2D' }}>
          <AlertTriangle size={32} style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontWeight: 700 }}>Couldn&apos;t load orders</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{error}</p>
          <button
            onClick={() => void load()}
            style={{
              marginTop: 14, minHeight: 40, padding: '0 18px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #A32D2D', background: '#fff', color: '#A32D2D',
              fontSize: '0.8125rem', fontWeight: 700,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Genuinely no orders — a fact about the business. */}
      {!loading && !error && orders.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60, color: '#6b7280' }}>
          <Package size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No orders yet</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
            Scan a QR tag to create your first checkout
          </p>
        </div>
      )}

      {/* Orders exist, the filter excluded them all — a fact about the FILTER, said as one,
          with the way back in reach. */}
      {!loading && !error && orders.length > 0 && view.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60, color: '#6b7280' }}>
          <Package size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No orders match these filters</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
            {orders.length} order{orders.length === 1 ? '' : 's'} {orders.length === 1 ? 'is' : 'are'} hidden by the status filter.
          </p>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              marginTop: 14, minHeight: 40, padding: '0 18px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #27500A', background: '#fff', color: '#27500A',
              fontSize: '0.8125rem', fontWeight: 700,
            }}
          >
            Show all orders
          </button>
        </div>
      )}

      {/* ── Order list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {view.map(order => {
          const item      = order.order_items?.[0];
          const qty       = item?.quantity ?? 1;
          const tagId     = item ? orderItemTag(item) : '—';
          // An order with NO order_items row at all is a different thing from a line we could not
          // name, and it must not borrow the other one's words. "Unknown plant" here claimed a plant
          // existed and was unidentified; "No items" states the row's actual condition.
          const plantName = item ? orderItemName(item) : 'No items';
          const st        = orderStatusMeta(order.status);

          return (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                borderLeft: order.leakage_flag ? '4px solid #A32D2D' : '4px solid #27500A',
                cursor: 'pointer',
              }}
            >
              {/* Row 1: customer + amount */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>
                    {order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : 'Unknown customer'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    {order.customers?.email ?? ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#27500A' }}>
                    {fmtMoney(order.total_amount)}
                  </p>
                  {order.notes && (
                    <p style={{ margin: 0, fontSize: '0.6875rem', color: '#9ca3af' }}>
                      #{order.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: plant + transport + date */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginTop: 10, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: '0.75rem', color: '#374151', background: '#f3f4f6',
                  borderRadius: 6, padding: '3px 8px', fontWeight: 600,
                }}>
                  {qty}× {plantName} · {tagId}
                  {order.order_items && order.order_items.length > 1 && ` +${order.order_items.length - 1} more`}
                </span>

                <span style={{
                  fontSize: '0.75rem', color: '#6b7280',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {TRANSPORT_ICON[order.transport_method]}
                  {TRANSPORT_LABEL[order.transport_method] ?? order.transport_method}
                </span>

                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: st.color, background: st.bg,
                  borderRadius: 6, padding: '2px 7px',
                }}>
                  {st.label}
                </span>

                {order.leakage_flag && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#A32D2D',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <AlertTriangle size={12} /> Add-ons declined
                  </span>
                )}

                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                  {fmt(order.created_at)} <ChevronRight size={13} color="#c4c9d0" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
