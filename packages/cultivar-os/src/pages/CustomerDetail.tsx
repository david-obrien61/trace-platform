// ============================================================
// CustomerDetail — the per-customer drill-in (/customers/:id) with ORDER HISTORY (Cultivar OS)
// PURPOSE:      David's ask — "where do I view all of john smith's orders?" No such view existed
//               (/customers was roster + editor modal only). This is the dedicated PAGE: summary
//               header → 4 live-computed stat cards → order history list → a stubbed insights strip.
//               Order rows LINK to the existing /orders/:id detail (the history is a list of links,
//               not inline expansion). Buildable gap, not a data problem: orders.customer_id is
//               populated (submit.ts writes it) and the orders roster already joins orders→customers,
//               so this reuses that query shape + the Orders roster's row idiom.
// STATS:        Computed LIVE from this customer's own orders (no stored lifetime_value — David's call;
//               one light indexed query over their rows). Orders count = ALL orders (activity). Lifetime
//               value + avg EXCLUDE cancelled (cancelled = no revenue). Last order = max(created_at).
// EDIT (STD-011): the "Edit record" button opens the EXISTING CustomerPartyEditor (edit mode) — this
//               page does NOT re-implement the edit form. One canonical customer edit surface.
// DEPENDENCIES: supabase (customer + orders, business_id-scoped, owner-only RLS), useBusinessContext,
//               CustomerPartyEditor (+ PartyCustomer), orderItemName (roster line summary),
//               orderStatus (ORDER_STATUS_META), readPricingConfig/normalizeDiscountTypes (tierOptions
//               for the editor), taxExemptionLabel. NO migration, NO new dep, NO endpoint.
// GATE:         OWNER-ONLY — /customers/:id sits in the owner-only PermissionRoute group beside
//               /customers, matching customers_business_owner + orders_business_owner (both owner-only).
// INSTRUMENTATION (STD-003): `[TRACE:customers]` / `[TRACE:ROSTER]` on the fetches (ids/counts only —
//               never PII, BENCH-C). ON BY DEFAULT — standing owner instruction (do NOT comment out).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Package, Pencil, ShoppingBag, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { orderItemName, orderItemTag, type OrderItemAnchorFields } from '../lib/orderItemName';
import { ORDER_STATUS_META } from '../lib/orderStatus';
import { CustomerPartyEditor, type PartyCustomer } from '../components/customers/CustomerPartyEditor';
import { readPricingConfig, normalizeDiscountTypes, RETAIL_TIER_NAME, taxExemptionLabel, type DiscountType } from '@trace/shared/business-logic';

interface CustomerRecord extends PartyCustomer {
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
}

interface HistoryOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  notes: string | null;
  transport_method: string;
  leakage_flag: boolean;
  order_items: (OrderItemAnchorFields & { quantity: number })[];
}

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n ?? 0));
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function CustomerDetail() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { businessId } = useBusinessContext();

  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [orders,   setOrders]   = useState<HistoryOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [editing,  setEditing]  = useState(false);

  // Configured discount tiers → tierOptions for the editor (business-scoped read, mirrors the roster).
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);

  const load = useCallback(async () => {
    if (!businessId || !id) return;
    setLoading(true); setError(null);
    console.log('[TRACE:customers] detail load', { businessId, customerId: id });

    // Customer record — select('*') is deploy-window-safe (returns whatever columns exist, so the
    // gated party/exemption cols need no FULL/CORE fallback here). Owner-only RLS + business_id scope.
    const { data: cust, error: custErr } = await supabase
      .from('customers').select('*').eq('id', id).eq('business_id', businessId).maybeSingle();
    if (custErr) { setError(custErr.message); setLoading(false); return; }
    if (!cust)   { setError('Customer not found'); setLoading(false); return; }
    setCustomer(cust as unknown as CustomerRecord);

    // Order history — orders WHERE customer_id = :id (AC-3: business_id-scoped too, owner-only RLS).
    // Reuses the Orders roster query shape (order_items → business_inventory for the line summary).
    const { data: ords, error: ordErr } = await supabase
      .from('orders')
      .select(`
        id, created_at, total_amount, status, notes, transport_method, leakage_flag,
        order_items ( quantity, business_inventory_id, business_inventory ( name, size, sku ) )
      `)
      .eq('business_id', businessId)
      .eq('customer_id', id)
      .order('created_at', { ascending: false });
    if (ordErr) { setError(ordErr.message); setLoading(false); return; }
    const rows = (ords ?? []) as unknown as HistoryOrder[];
    setOrders(rows);
    setLoading(false);

    console.log('[TRACE:ROSTER] customer order history', {
      customerId: id,
      orderCount: rows.length,
      nonCancelled: rows.filter(o => o.status !== 'cancelled').length,
    });
  }, [businessId, id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data } = await readPricingConfig(supabase, businessId);
      setDiscountTypes(normalizeDiscountTypes((data?.config ?? {}) as Record<string, unknown>));
    })();
  }, [businessId]);

  // tierOptions for the editor — retail floor + every configured tier ∪ the row's current value.
  const tierOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }];
    for (const ty of discountTypes) for (const ti of ty.tiers) opts.push({ value: ti.name, label: `${ty.name} · ${ti.name}` });
    const cur = customer?.price_tier ?? RETAIL_TIER_NAME;
    if (!opts.some(o => o.value === cur)) opts.push({ value: cur, label: cur });
    return opts;
  }, [discountTypes, customer?.price_tier]);

  // ── Live stats (David's rules): count = ALL orders; lifetime + avg EXCLUDE cancelled; last = newest. ──
  const stats = useMemo(() => {
    const nonCancelled = orders.filter(o => o.status !== 'cancelled');
    const lifetime = nonCancelled.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    return {
      count:    orders.length,
      lifetime,
      avg:      nonCancelled.length ? lifetime / nonCancelled.length : 0,
      last:     orders.length ? orders[0].created_at : null, // orders are created_at desc
    };
  }, [orders]);

  if (loading) return <Shell><p style={center}>Loading…</p></Shell>;
  if (error && !customer) return <Shell><p style={{ ...center, color: '#A32D2D' }}>{error}</p></Shell>;
  if (!customer) return null;

  const isOrg = customer.customer_type === 'organization';
  const name = (isOrg
    ? (customer.organization_name?.trim() || customer.first_name)
    : `${customer.first_name} ${customer.last_name ?? ''}`.trim() || customer.first_name) || '—';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  const contact = [customer.email, customer.phone, customer.city].filter(Boolean).join(' · ');

  return (
    <Shell>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/customers')} style={backBtn} title="Back to customers"><ArrowLeft size={18} /></button>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Customers</span>
      </div>

      {/* Header card */}
      <div style={headerCard}>
        <div style={avatar}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#111827' }}>{name}</h1>
          {contact && <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{contact}</p>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <Badge tone="type">{isOrg ? 'Organization' : 'Person'}</Badge>
            <Badge tone="tier">{customer.price_tier && customer.price_tier !== RETAIL_TIER_NAME ? customer.price_tier : 'Retail'}</Badge>
            {customer.tax_exempt
              ? <Badge tone="exempt">Tax exempt · {taxExemptionLabel(customer.tax_exempt_reason)}</Badge>
              : <Badge tone="taxable">Taxable</Badge>}
            {(customer.status ?? 'active') === 'inactive' && <Badge tone="inactive">Inactive</Badge>}
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={editBtn}><Pencil size={14} /> Edit record</button>
      </div>

      {/* Stat cards */}
      <div style={statGrid}>
        <Stat icon={<ShoppingBag size={16} />} label="Orders"        value={String(stats.count)} />
        <Stat icon={<DollarSign size={16} />}  label="Lifetime value" value={money(stats.lifetime)} />
        <Stat icon={<TrendingUp size={16} />}  label="Avg order"      value={money(stats.avg)} />
        <Stat icon={<Calendar size={16} />}    label="Last order"     value={stats.last ? fmtDate(stats.last) : '—'} />
      </div>

      {/* Order history */}
      <div style={{ marginTop: 18 }}>
        <p style={sectionTitle}>Order history</p>
        {orders.length === 0 ? (
          <div style={emptyBox}>
            <Package size={34} color="#d1d5db" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#6b7280' }}>No orders yet</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
              This customer’s checkouts will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(o => {
              const st = ORDER_STATUS_META[o.status] ?? { label: o.status, color: '#6b7280', bg: '#f3f4f6' };
              const first = o.order_items?.[0];
              const summary = first
                ? `${first.quantity}× ${orderItemName(first)}${o.order_items.length > 1 ? ` +${o.order_items.length - 1} more` : ''}`
                : null;
              return (
                <div key={o.id} onClick={() => navigate(`/orders/${o.id}`)} style={orderRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>
                        Order {o.notes ? `#${o.notes}` : ''}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: st.color, background: st.bg, borderRadius: 6, padding: '2px 7px' }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      {fmtDate(o.created_at)}{summary ? ` · ${summary} · ${orderItemTag(first!)}` : ''}
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#27500A' }}>{money(o.total_amount)}</span>
                  <ChevronRight size={16} color="#c4c9d0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Insights strip — STUB (D-9: labeled roadmap marker, NO fabricated numbers). This is the hook
          the future AI advisory (spend trend / reorder cadence / margin) will render into. */}
      <div style={insightsStrip}>
        <span style={{ fontSize: '1.05rem' }}>💡</span>
        <div>
          <div style={{ fontWeight: 700, color: '#4c1d95', fontSize: '0.82rem' }}>Insights — coming</div>
          <div style={{ fontSize: '0.78rem', color: '#6d28d9', marginTop: 2 }}>
            Spend trend, reorder cadence, and margin will surface here. (Advisory — a later update.)
          </div>
        </div>
      </div>

      {editing && (
        <CustomerPartyEditor
          mode="edit"
          customer={customer as PartyCustomer}
          tierOptions={tierOptions}
          onClose={() => setEditing(false)}
          onSaved={() => { void load(); }}
        />
      )}
    </Shell>
  );
}

// ── presentational bits ─────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: '#EAF3DE', padding: 16, maxWidth: 720, margin: '0 auto' }}>{children}</div>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={statCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280' }}>
        {icon}<span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>{value}</p>
    </div>
  );
}
const BADGE_TONE: Record<string, React.CSSProperties> = {
  type:     { color: '#374151', background: '#f3f4f6' },
  tier:     { color: '#3730a3', background: '#eef2ff' },
  exempt:   { color: '#166534', background: '#dcfce7' },
  taxable:  { color: '#6b7280', background: '#f3f4f6' },
  inactive: { color: '#991B1B', background: '#FEE2E2' },
};
function Badge({ tone, children }: { tone: keyof typeof BADGE_TONE; children: React.ReactNode }) {
  return <span style={{ ...BADGE_TONE[tone], fontSize: '0.7rem', fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>{children}</span>;
}

const center: React.CSSProperties = { textAlign: 'center', color: '#6b7280', paddingTop: 40 };
const backBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#27500A', cursor: 'pointer' };
const headerCard: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 14, background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' };
const avatar: React.CSSProperties = { flexShrink: 0, width: 52, height: 52, borderRadius: '50%', background: '#27500A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.05rem' };
const editBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 38, padding: '0 12px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', color: '#27500A', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
const statGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 };
const statCard: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const sectionTitle: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 };
const orderRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' };
const emptyBox: React.CSSProperties = { textAlign: 'center', background: '#fff', borderRadius: 12, padding: '32px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const insightsStrip: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: 12, padding: '12px 16px', marginTop: 18 };
