import { useEffect, useRef, useState } from 'react';
import { DEMO_NURSERY_ID } from '../lib/constants';

interface DashMetrics {
  today_order_count: number;
  today_revenue:     number;
  inventory_value:   number;
  plant_count:       number;
  available_count:   number;
  leakage_count:     number;
  qb_connected:      boolean;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px', flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

export function Dashboard() {
  const [metrics, setMetrics]       = useState<DashMetrics | null>(null);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbCompany, setQbCompany]   = useState('');
  const [connecting, setConnecting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadMetrics() {
    try {
      const res = await fetch(`/api/dashboard?nursery_id=${DEMO_NURSERY_ID}`);
      if (res.ok) {
        const data: DashMetrics = await res.json();
        setMetrics(data);
        setQbConnected(data.qb_connected);
      }
    } catch {}
  }

  async function checkQbStatus() {
    try {
      const res = await fetch(`/api/qbo/status?nursery_id=${DEMO_NURSERY_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setQbConnected(true);
          setQbCompany(data.companyName || '');
          return true;
        }
      }
    } catch {}
    return false;
  }

  useEffect(() => {
    loadMetrics();
    checkQbStatus();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch(`/api/qbo/auth-url?nursery_id=${DEMO_NURSERY_ID}`);
      if (!res.ok) throw new Error('Could not get auth URL');
      const { url } = await res.json();

      const popup = window.open(url, 'qb-connect', 'width=720,height=640,left=200,top=100');

      pollingRef.current = setInterval(async () => {
        const connected = await checkQbStatus();
        if (connected) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConnecting(false);
          loadMetrics();
        }
        if (!popup || popup.closed) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConnecting(false);
        }
      }, 2000);
    } catch {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch(`/api/qbo/status?nursery_id=${DEMO_NURSERY_ID}`, { method: 'GET' });
      // Simple: just clear the state — a real disconnect would POST to /api/qbo/disconnect
      setQbConnected(false);
      setQbCompany('');
    } catch {}
  }

  const fmt$ = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#27500A', padding: '24px 20px 20px', color: '#fff' }}>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', margin: '0 0 4px', letterSpacing: '0.05em', fontWeight: 600, textTransform: 'uppercase' }}>
          LAWNS Tree Farm
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Owner Dashboard</h1>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640, margin: '0 auto' }}>

        {/* QB connect banner */}
        {!qbConnected ? (
          <div style={{ background: '#fff', border: '2px solid #27500A', borderRadius: 12, padding: '18px 16px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#27500A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              QuickBooks Online
            </p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
              Connect QuickBooks to auto-create invoices
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>
              Every checkout automatically creates an invoice in QuickBooks — no typing required.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{ width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem', cursor: connecting ? 'wait' : 'pointer', opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? 'Opening QuickBooks…' : 'Connect QuickBooks'}
            </button>
          </div>
        ) : (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#27500A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>✓</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534', margin: 0 }}>QuickBooks connected</p>
                <p style={{ fontSize: '0.8125rem', color: '#4ade80', margin: '2px 0 0' }}>
                  {qbCompany || 'Sandbox company'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              style={{ background: 'none', border: 'none', fontSize: '0.8125rem', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' }}
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Metric cards */}
        {metrics ? (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <MetricCard
                label="Today's sales"
                value={String(metrics.today_order_count)}
                sub={`${fmt$(metrics.today_revenue)} revenue`}
              />
              <MetricCard
                label="Inventory value"
                value={fmt$(metrics.inventory_value)}
                sub={`${metrics.available_count} plants available`}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <MetricCard
                label="Plants tracked"
                value={String(metrics.plant_count)}
              />
              <MetricCard
                label="Leakage alerts"
                value={String(metrics.leakage_count)}
                sub={metrics.leakage_count > 0 ? 'Orders with no add-ons' : 'None this week'}
              />
            </div>

            {metrics.leakage_count > 0 && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#92400e', marginBottom: 4 }}>
                  ⚠ {metrics.leakage_count} sale{metrics.leakage_count !== 1 ? 's' : ''} with no add-ons
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#b45309', lineHeight: 1.5 }}>
                  Large-container trees were sold without compost, fertilizer, or netting. Each sale is a missed upsell opportunity.
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ flex: 1, height: 80, background: '#e5e7eb', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={loadMetrics}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', fontSize: '0.875rem', color: '#6b7280', cursor: 'pointer' }}
        >
          Refresh data
        </button>
      </div>
    </div>
  );
}
