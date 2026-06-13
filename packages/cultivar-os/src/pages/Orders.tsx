import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Truck, Package, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';

interface OrderRow {
  id: string;
  created_at: string;
  total_amount: number;
  transport_method: string;
  leakage_flag: boolean;
  notes: string | null;
  status: string;
  customers: { first_name: string; last_name: string; email: string } | null;
  order_items: { quantity: number; cultivar_plants: { tag_id: string; common_name: string | null; species: string } | null }[];
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

  useEffect(() => {
    if (!businessId) return;
    load();
  }, [businessId]);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('orders')
      .select(`
        id, created_at, total_amount, transport_method,
        leakage_flag, notes, status,
        customers ( first_name, last_name, email ),
        order_items ( quantity, cultivar_plants ( tag_id, common_name, species ) )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) { setError(err.message); setLoading(false); return; }
    setOrders((data ?? []) as OrderRow[]);
    setLoading(false);
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
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={22} color="#27500A" />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#27500A' }}>
            Orders
          </h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
            {orders.length} recent checkout{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading && (
        <p style={{ textAlign: 'center', color: '#6b7280', paddingTop: 40 }}>Loading…</p>
      )}

      {error && (
        <p style={{ textAlign: 'center', color: '#A32D2D', paddingTop: 40 }}>{error}</p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60, color: '#6b7280' }}>
          <Package size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No orders yet</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
            Scan a QR tag to create your first checkout
          </p>
        </div>
      )}

      {/* ── Order list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map(order => {
          const item    = order.order_items?.[0];
          const plant   = item?.cultivar_plants;
          const qty     = item?.quantity ?? 1;
          const tagId   = plant?.tag_id ?? '—';
          const plantName = plant?.common_name ?? plant?.species ?? 'Unknown plant';

          return (
            <div
              key={order.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                borderLeft: order.leakage_flag ? '4px solid #A32D2D' : '4px solid #27500A',
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
                </span>

                <span style={{
                  fontSize: '0.75rem', color: '#6b7280',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {TRANSPORT_ICON[order.transport_method]}
                  {TRANSPORT_LABEL[order.transport_method] ?? order.transport_method}
                </span>

                {order.leakage_flag && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#A32D2D',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <AlertTriangle size={12} /> Add-ons declined
                  </span>
                )}

                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: 'auto' }}>
                  {fmt(order.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
