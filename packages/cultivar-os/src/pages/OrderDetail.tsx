// ============================================================
// OrderDetail — the order drill-in (READ all lines + services + customer; owner/manager CRUD).
// PURPOSE: the roster (Orders.tsx) shows first-line-only and no detail. This is the drill-in the
//   as-built recon §7 named missing — ALL line items (dual-anchor names), ALL services
//   (order_service_selections, written but never displayed), customer, delivery date, transport,
//   status, totals. Owner/manager (isOwner || can('manage_orders')) can edit line quantities +
//   delivery date, remove lines, change status, and delete the order; staff is READ-ONLY (the
//   controls never render, and the server independently refuses — submit.ts action gate).
// DEPENDENCIES: supabase (owner-RLS read), useBusinessContext (isOwner/can), /api/orders/submit
//   (action=update|delete|status, Bearer-token gated), orderItemName, orderStatus.
// OUTPUTS: the order detail view + the edit/delete/status affordances.
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { orderItemName, orderItemTag, orderItemAnchor, type OrderItemAnchorFields } from '../lib/orderItemName';
import { ORDER_STATUSES, ORDER_STATUS_META } from '../lib/orderStatus';

interface DetailItem extends OrderItemAnchorFields {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
interface DetailSelection {
  id: string;
  quantity: number;
  unit_price_at_time: number;
  subtotal: number;
  service_offerings: { name: string | null; category: string | null; price_type: string | null; price_unit: string | null } | null;
}
interface OrderDetailRow {
  id: string;
  created_at: string;
  status: string;
  transport_method: string;
  transport_note: string | null;
  netting_declined: boolean | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  addons_amount: number | null;
  leakage_flag: boolean;
  notes: string | null;
  delivery_date?: string | null;
  customers: { first_name: string; last_name: string; email: string; phone: string | null; address_line1: string | null; city: string | null; state: string | null; zip: string | null } | null;
  order_items: DetailItem[];
  order_service_selections: DetailSelection[];
}

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n ?? 0));

// order_items is fetched in its OWN top-level query (ITEM_COLS below), NOT embedded here.
// WHY: a nested order_items embed under this .maybeSingle() orders query returned 0 lines while
// the sibling order_service_selections embed populated in the SAME successful query (a PostgREST
// nested-embed drop — the "PLANTS (0) but subtotal includes plant cost" bug). A dedicated
// top-level query returns every line regardless of D-34 anchor (stock-line or specimen).
const SELECT_COLS = `
  id, created_at, status, transport_method, transport_note, netting_declined,
  subtotal, tax_amount, total_amount, addons_amount, leakage_flag, notes,
  customers ( first_name, last_name, email, phone, address_line1, city, state, zip ),
  order_service_selections (
    id, quantity, unit_price_at_time, subtotal,
    service_offerings ( name, category, price_type, price_unit )
  )`;

const ITEM_COLS = `
  id, quantity, unit_price, subtotal, plant_id, business_inventory_id,
  cultivar_plants ( tag_id, common_name, species ),
  business_inventory ( name, size, sku )`;

export function OrderDetail() {
  const { id }           = useParams<{ id: string }>();
  const navigate         = useNavigate();
  const { businessId, isOwner, can } = useBusinessContext();
  const canManage        = isOwner || can('manage_orders');

  const [order,   setOrder]   = useState<OrderDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [notice,  setNotice]  = useState<string | null>(null);

  // Edit buffers (owner/manager)
  const [qtyEdits, setQtyEdits]     = useState<Record<string, number>>({});
  const [removed,  setRemoved]      = useState<Set<string>>(new Set());
  const [dateEdit, setDateEdit]     = useState<string>('');
  const [statusEdit, setStatusEdit] = useState<string>('');

  const load = useCallback(async () => {
    if (!businessId || !id) return;
    setLoading(true); setError(null);
    // delivery_date is gated (migration 20260708). Try WITH it; on undefined-column, retry without.
    let data: any = null; let err: any = null;
    ({ data, error: err } = await supabase.from('orders')
      .select(`${SELECT_COLS}, delivery_date`).eq('id', id).eq('business_id', businessId).maybeSingle());
    if (err && (err.code === '42703' || err.code === 'PGRST204')) {
      ({ data, error: err } = await supabase.from('orders')
        .select(SELECT_COLS).eq('id', id).eq('business_id', businessId).maybeSingle());
    }
    if (err) { setError(err.message); setLoading(false); return; }
    if (!data) { setError('Order not found'); setLoading(false); return; }
    const o = data as OrderDetailRow;

    // Line items — DEDICATED top-level query (see SELECT_COLS note). ALL rows regardless of anchor
    // (no inner-join, no plant_id filter). Scoped by order_id AFTER the order was verified to
    // belong to businessId above (AC-3 — an order from another business already returned null).
    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items').select(ITEM_COLS).eq('order_id', id);
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return; }
    o.order_items = (itemsData ?? []) as DetailItem[];

    setOrder(o);
    setQtyEdits(Object.fromEntries(o.order_items.map(it => [it.id, it.quantity])));
    setRemoved(new Set());
    setDateEdit(o.delivery_date ?? '');
    setStatusEdit(o.status);
    setLoading(false);

    // Reconciliation (STEP 3): plant lines + services must equal the stored subtotal.
    const plantLinesTotal = o.order_items.reduce((s, it) => s + Number(it.subtotal ?? (it.unit_price * it.quantity)), 0);
    const servicesTotal   = o.order_service_selections.reduce((s, x) => s + Number(x.subtotal ?? 0), 0);
    console.log('[TRACE:ROSTER] order detail loaded', {
      orderId: o.id,
      lines: o.order_items.length,
      anchors: o.order_items.map(orderItemAnchor),
      plantLinesTotal: Math.round(plantLinesTotal * 100) / 100,
      servicesTotal:   Math.round(servicesTotal * 100) / 100,
      storedSubtotal:  Number(o.subtotal),
      reconciles: Math.abs((plantLinesTotal + servicesTotal) - Number(o.subtotal)) < 0.01,
      services: o.order_service_selections.length,
      canManage,
    });
  }, [businessId, id, canManage]);

  useEffect(() => { void load(); }, [load]);

  async function authHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function post(body: Record<string, unknown>): Promise<any> {
    const res = await fetch('/api/orders/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ ...body, orderId: id, businessId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }

  const dirty = order && (
    order.order_items.some(it => (qtyEdits[it.id] ?? it.quantity) !== it.quantity) ||
    removed.size > 0 ||
    (dateEdit || '') !== (order.delivery_date ?? '')
  );

  async function saveEdits() {
    if (!order) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const quantities: Record<string, number> = {};
      for (const it of order.order_items) {
        const q = qtyEdits[it.id] ?? it.quantity;
        if (q !== it.quantity) quantities[it.id] = q;
      }
      const r = await post({
        action: 'update',
        quantities,
        removedItemIds: [...removed],
        deliveryDate: (dateEdit || '') === (order.delivery_date ?? '') ? undefined : (dateEdit || null),
      });
      setNotice(r.qbStale
        ? `Saved. New total ${money(r.total)}. ⚠️ This order’s QuickBooks invoice may now be out of date — re-sync it in QuickBooks.`
        : `Saved. New total ${money(r.total)}.`);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function changeStatus(next: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await post({ action: 'status', status: next });
      setNotice(`Status set to ${ORDER_STATUS_META[next]?.label ?? next}.`);
      await load();
    } catch (e: any) { setError(e.message); setStatusEdit(order?.status ?? ''); }
    finally { setBusy(false); }
  }

  async function deleteOrder() {
    if (!window.confirm('Delete this order? Its inventory reservation will be released. This cannot be undone.')) return;
    setBusy(true); setError(null);
    try {
      await post({ action: 'delete' });
      navigate('/orders');
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  if (loading) return <Shell><p style={{ textAlign: 'center', color: '#6b7280', paddingTop: 40 }}>Loading…</p></Shell>;
  if (error && !order) return <Shell><p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p></Shell>;
  if (!order) return null;

  const st = ORDER_STATUS_META[order.status] ?? { label: order.status, color: '#6b7280', bg: '#f3f4f6' };
  const cust = order.customers;

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/orders')} style={backBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#27500A' }}>
            Order {order.notes ? `#${order.notes}` : ''}
          </h1>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280' }}>
            {new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color, background: st.bg, borderRadius: 6, padding: '4px 9px' }}>
          {st.label}
        </span>
      </div>

      {notice && <Banner tone="ok">{notice}</Banner>}
      {error && <Banner tone="err">{error}</Banner>}
      {order.leakage_flag && <Banner tone="warn"><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Large container went out with no add-ons (leakage flag).</Banner>}

      {/* Customer */}
      <Card title="Customer">
        {cust ? (
          <>
            <p style={row}><b>{cust.first_name} {cust.last_name}</b></p>
            <p style={sub}>{cust.email}{cust.phone ? ` · ${cust.phone}` : ''}</p>
            {(cust.address_line1 || cust.city) && (
              <p style={sub}>{[cust.address_line1, cust.city, cust.state, cust.zip].filter(Boolean).join(', ')}</p>
            )}
          </>
        ) : <p style={sub}>Unknown customer</p>}
      </Card>

      {/* Line items */}
      <Card title={`Plants (${order.order_items.length})`}>
        {order.order_items.map(it => {
          const gone = removed.has(it.id);
          const q = qtyEdits[it.id] ?? it.quantity;
          return (
            <div key={it.id} style={{ ...lineRow, opacity: gone ? 0.4 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#111827', textDecoration: gone ? 'line-through' : 'none' }}>
                  {orderItemName(it)}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>{orderItemTag(it)} · {money(it.unit_price)} ea</p>
              </div>
              {canManage && !gone ? (
                <input type="number" min={1} value={q}
                  onChange={e => setQtyEdits(s => ({ ...s, [it.id]: Math.max(1, Number(e.target.value) || 1) }))}
                  style={qtyInput} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>×{it.quantity}</span>
              )}
              <span style={{ width: 74, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: '#27500A' }}>
                {money((canManage ? q : it.quantity) * it.unit_price)}
              </span>
              {canManage && (
                <button
                  onClick={() => setRemoved(s => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })}
                  style={{ ...iconBtn, color: gone ? '#27500A' : '#A32D2D' }}
                  title={gone ? 'Restore line' : 'Remove line'}
                >
                  {gone ? '↩' : <Trash2 size={15} />}
                </button>
              )}
            </div>
          );
        })}
      </Card>

      {/* Services */}
      <Card title={`Services (${order.order_service_selections.length})`}>
        {order.order_service_selections.length === 0 && <p style={sub}>No services on this order.</p>}
        {order.order_service_selections.map(s => (
          <div key={s.id} style={lineRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
                {s.service_offerings?.name ?? 'Service'}
              </p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>
                {s.service_offerings?.category ?? ''} · {s.service_offerings?.price_type === 'per_unit' ? `per plant · ×${s.quantity}` : `per order · ×${s.quantity}`}
              </p>
            </div>
            <span style={{ width: 74, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: '#27500A' }}>{money(s.subtotal)}</span>
          </div>
        ))}
        {order.transport_note && <p style={{ ...sub, marginTop: 8 }}>{order.transport_note}</p>}
      </Card>

      {/* Delivery + totals */}
      <Card title="Delivery & totals">
        <div style={lineRow}>
          <span style={{ flex: 1, fontSize: '0.82rem', color: '#374151' }}>Delivery date</span>
          {canManage ? (
            <input type="date" value={dateEdit} min={new Date().toISOString().slice(0, 10)}
              onChange={e => setDateEdit(e.target.value)} style={{ ...qtyInput, width: 150 }} />
          ) : (
            <span style={{ fontSize: '0.82rem', color: '#374151' }}>{order.delivery_date ?? '—'}</span>
          )}
        </div>
        <TotalRow label="Subtotal" value={money(order.subtotal)} />
        <TotalRow label="Add-ons" value={money(order.addons_amount)} />
        <TotalRow label="Tax" value={money(order.tax_amount)} />
        <TotalRow label="Total" value={money(order.total_amount)} bold />
      </Card>

      {/* Owner/manager actions */}
      {canManage && (
        <>
          <button onClick={() => void saveEdits()} disabled={busy || !dirty} style={{ ...primaryBtn, opacity: (busy || !dirty) ? 0.5 : 1 }}>
            <Save size={16} /> Save changes
          </button>

          <Card title="Status">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ORDER_STATUSES.map(s => {
                const m = ORDER_STATUS_META[s];
                const active = statusEdit === s;
                return (
                  <button key={s} disabled={busy || active}
                    onClick={() => { setStatusEdit(s); void changeStatus(s); }}
                    style={{
                      minHeight: 40, padding: '0 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: active ? 'default' : 'pointer',
                      border: active ? `2px solid ${m.color}` : '1px solid #d1d5db',
                      background: active ? m.bg : '#fff', color: active ? m.color : '#374151',
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <button onClick={() => void deleteOrder()} disabled={busy} style={dangerBtn}>
            <Trash2 size={16} /> Delete order
          </button>
        </>
      )}
      {!canManage && (
        <p style={{ ...sub, textAlign: 'center', marginTop: 20 }}>You have view-only access to orders.</p>
      )}
    </Shell>
  );
}

// ── small presentational bits ──────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: '#EAF3DE', padding: 16, maxWidth: 640, margin: '0 auto' }}>{children}</div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</p>
      {children}
    </div>
  );
}
function Banner({ tone, children }: { tone: 'ok' | 'err' | 'warn'; children: React.ReactNode }) {
  const c = tone === 'ok' ? { bg: '#DCFCE7', fg: '#166534' } : tone === 'err' ? { bg: '#FEE2E2', fg: '#991B1B' } : { bg: '#FEF3C7', fg: '#92600A' };
  return <div style={{ background: c.bg, color: c.fg, borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', marginBottom: 12 }}>{children}</div>;
}
function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: bold ? '0.95rem' : '0.82rem', fontWeight: bold ? 700 : 500, color: bold ? '#27500A' : '#374151' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

const backBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#27500A', cursor: 'pointer' };
const lineRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f3f4f6' };
const row: React.CSSProperties = { margin: 0, fontSize: '0.9rem', color: '#111827' };
const sub: React.CSSProperties = { margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' };
const qtyInput: React.CSSProperties = { width: 58, minHeight: 36, borderRadius: 8, border: '1px solid #d1d5db', textAlign: 'center', fontSize: '0.85rem', padding: '0 6px' };
const iconBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', marginBottom: 12 };
const dangerBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46, background: '#fff', color: '#A32D2D', border: '1px solid #A32D2D', borderRadius: 10, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', marginTop: 4 };
