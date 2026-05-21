import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@trace/shared/components/Card';
import { supabase } from '../lib/supabase';
import { auth } from '../lib/auth';
import { DEMO_NURSERY_ID } from '../lib/constants';

// Configurable — will move to verticalConfig post-demo
const LEAKAGE_AVG_VALUE = 28;

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmt$(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Components ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="card" padding="none">
      <div style={{ padding: '18px 16px' }}>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
        }}>
          {label}
        </p>
        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.2 }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', marginTop: 4 }}>{sub}</p>
        )}
      </div>
    </Card>
  );
}

function SkeletonCard() {
  return <div className="skeleton" style={{ flex: 1, minWidth: 0, height: 88, borderRadius: 12 }} />;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = auth.useSession();
  const navigate  = useNavigate();

  const [nurseryName, setNurseryName]         = useState('LAWNS Tree Farm');
  const [plantCount, setPlantCount]           = useState(0);
  const [inventoryValue, setInventoryValue]   = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [todayRevenue, setTodayRevenue]       = useState(0);
  const [installsThisWeek, setInstalls]       = useState(0);
  const [leakageCount, setLeakageCount]       = useState(0);
  const [loading, setLoading]                 = useState(true);

  const [qbConnected, setQbConnected] = useState(false);
  const [qbCompany, setQbCompany]     = useState('');
  const [connecting, setConnecting]   = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadMetrics() {
    setLoading(true);
    const today = todayStart();
    const week  = weekStart();

    const [nurseryRes, plantsRes, todayRes, installsRes, leakageRes] = await Promise.all([
      supabase
        .from('nurseries')
        .select('name')
        .eq('id', DEMO_NURSERY_ID)
        .single(),

      supabase
        .from('plants')
        .select('id, base_price')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .eq('status', 'available'),

      supabase
        .from('orders')
        .select('id, total_amount')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .neq('status', 'cancelled')
        .gte('created_at', today),

      supabase
        .from('orders')
        .select('id')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .eq('transport_method', 'install')
        .gte('created_at', week),

      supabase
        .from('orders')
        .select('id')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .eq('leakage_flag', true)
        .gte('created_at', week),
    ]);

    if (nurseryRes.data) setNurseryName(nurseryRes.data.name);

    const plants = plantsRes.data ?? [];
    setPlantCount(plants.length);
    setInventoryValue(plants.reduce((sum, p) => sum + (p.base_price ?? 0), 0));

    const todayOrders = todayRes.data ?? [];
    setTodayOrderCount(todayOrders.length);
    setTodayRevenue(todayOrders.reduce((sum, o) => sum + ((o as any).total_amount ?? 0), 0));

    setInstalls((installsRes.data ?? []).length);
    setLeakageCount((leakageRes.data ?? []).length);

    setLoading(false);
  }

  // ── QB helpers ────────────────────────────────────────────────────────────

  async function checkQbStatus(): Promise<boolean> {
    try {
      const res = await fetch(`/api/qbo/status?nursery_id=${DEMO_NURSERY_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setQbConnected(true);
          setQbCompany(data.companyName ?? '');
          return true;
        }
      }
    } catch { /* QB unavailable — non-fatal */ }
    return false;
  }

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

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await auth.signOut();
    navigate('/login');
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadMetrics();
    checkQbStatus();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const missedRevenue = leakageCount * LEAKAGE_AVG_VALUE;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'var(--green-primary)',
        padding: '20px 16px',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{
            fontSize: '0.6875rem', color: '#a8c890', marginBottom: 2,
            letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase',
          }}>
            {nurseryName}
          </p>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Owner Dashboard</h1>
          {user?.email && (
            <p style={{ fontSize: '0.75rem', color: '#a8c890', marginTop: 4 }}>{user.email}</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
            padding: '8px 12px', color: '#fff', fontSize: '0.8125rem',
            fontWeight: 600, cursor: 'pointer', marginTop: 2,
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, margin: '0 auto' }}>

        {/* ── QB status banner ── */}
        {!qbConnected ? (
          <div style={{ background: '#fff', border: '2px solid var(--green-primary)', borderRadius: 12, padding: '16px' }}>
            <p style={{
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--green-primary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
            }}>
              QuickBooks Online
            </p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 4 }}>
              Connect to auto-create invoices
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: 14, lineHeight: 1.5 }}>
              Every checkout automatically creates an invoice — no typing required.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn btn-primary"
              style={{ opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? 'Opening QuickBooks…' : 'Connect QuickBooks'}
            </button>
          </div>
        ) : (
          <div style={{
            background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12,
            padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--green-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
              }}>✓</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534', margin: 0 }}>
                  QuickBooks connected
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#16a34a', margin: '2px 0 0' }}>
                  {qbCompany || 'Sandbox company'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setQbConnected(false); setQbCompany(''); }}
              style={{ background: 'none', border: 'none', fontSize: '0.8125rem', color: 'var(--gray-600)', cursor: 'pointer', padding: '4px 8px' }}
            >
              Disconnect
            </button>
          </div>
        )}

        {/* ── Metric cards 2×2 ── */}
        {loading ? (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Plants tracked"
                  value={String(plantCount)}
                  sub={`${plantCount} available`}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Inventory value"
                  value={fmt$(inventoryValue)}
                  sub="at base price"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Today's sales"
                  value={String(todayOrderCount)}
                  sub={todayOrderCount > 0 ? `${fmt$(todayRevenue)} revenue` : 'No orders yet today'}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Installs this week"
                  value={String(installsThisWeek)}
                  sub={installsThisWeek === 1 ? '1 scheduled' : `${installsThisWeek} scheduled`}
                />
              </div>
            </div>

            {/* ── US-012: Leakage alert tile ── */}
            {leakageCount > 0 ? (
              <div style={{
                background: 'var(--amber-bg)',
                border: '1.5px solid var(--amber-border)',
                borderRadius: 12,
                padding: '16px',
              }}>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#92400e', marginBottom: 6 }}>
                  ⚠ {leakageCount} sale{leakageCount !== 1 ? 's' : ''} with no add-ons this week
                </p>
                <p style={{ fontSize: '0.875rem', color: '#b45309', lineHeight: 1.5, marginBottom: 10 }}>
                  Large-container trees were sold without compost, fertilizer, or netting.
                  Each is a missed upsell at planting time.
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#92400e' }}>
                    {fmt$(missedRevenue)} estimated missed
                  </p>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4 }}>
                  $28 avg add-on value per tree
                </p>
              </div>
            ) : (
              <div style={{
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: 12,
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>✓</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534' }}>
                    No missed add-ons this week
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#16a34a', marginTop: 2 }}>
                    Every large-container sale included an add-on.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Refresh ── */}
        <button
          onClick={loadMetrics}
          style={{
            background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8,
            padding: '10px 16px', fontSize: '0.875rem', color: 'var(--gray-600)', cursor: 'pointer',
          }}
        >
          Refresh data
        </button>

      </div>
    </div>
  );
}
